import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { licenseKeysTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type AuthedReq = Request & { userId: string };

function licenseStatus(key: typeof licenseKeysTable.$inferSelect): "active" | "expired" | "revoked" {
  if (key.revokedAt) return "revoked";
  if (new Date(key.expiresAt) < new Date()) return "expired";
  return "active";
}

// Public — desktop app calls this on every launch (no auth, key IS the credential)
// Contract: { valid: boolean, expiresAt: string | null, reason?: string }
router.get("/licenses/validate", async (req, res) => {
  try {
    const keyStr = req.query["key"] as string | undefined;
    if (!keyStr) return res.json({ valid: false, expiresAt: null, reason: "missing_key" });

    const [row] = await db
      .select()
      .from(licenseKeysTable)
      .where(eq(licenseKeysTable.key, keyStr.toUpperCase()))
      .limit(1);

    if (!row) return res.json({ valid: false, expiresAt: null, reason: "not_found" });
    const expiresAt = row.expiresAt.toISOString();
    if (row.revokedAt) return res.json({ valid: false, expiresAt, reason: "revoked" });
    if (new Date(row.expiresAt) < new Date()) return res.json({ valid: false, expiresAt, reason: "expired" });

    return res.json({ valid: true, expiresAt });
  } catch (err) {
    req.log.error({ err }, "License validate error");
    return res.status(500).json({ valid: false, expiresAt: null, reason: "internal" });
  }
});

// Desktop-only — no auth required. Records first-activation timestamp and returns
// expiry date. Does NOT bind the key to a user account (use /licenses/activate for
// that once the user logs in from within the desktop app).
// Contract: { ok: true, expiresAt: string } | { error: string }
router.post("/licenses/activate-desktop", async (req, res) => {
  try {
    const { key: keyStr } = req.body as { key?: string };
    if (!keyStr) return res.status(400).json({ error: "missing_key" });

    const normalised = keyStr.toUpperCase().trim();

    // Only allow activation if the key is not yet claimed by a user account.
    // Once a key is bound to a user (via POST /licenses/activate), desktop
    // re-activation must go through the authenticated endpoint — this enforces
    // single-user ownership and prevents key sharing across accounts.
    const result = await pool.query<{
      expires_at: Date;
    }>(
      `UPDATE license_keys
          SET activated_at = COALESCE(activated_at, NOW()),
              updated_at   = NOW()
        WHERE key         = $1
          AND revoked_at  IS NULL
          AND expires_at  > NOW()
          AND user_id     IS NULL
        RETURNING expires_at`,
      [normalised],
    );

    if (result.rowCount === 0) {
      const [row] = await db
        .select()
        .from(licenseKeysTable)
        .where(eq(licenseKeysTable.key, normalised))
        .limit(1);
      if (!row) return res.status(404).json({ error: "not_found" });
      if (row.revokedAt) return res.status(403).json({ error: "revoked" });
      if (new Date(row.expiresAt) < new Date()) return res.status(403).json({ error: "expired" });
      // Key belongs to a user account — must re-activate via POST /licenses/activate
      if (row.userId) return res.status(409).json({ error: "already_claimed" });
      return res.status(400).json({ error: "invalid" });
    }

    return res.json({ ok: true, expiresAt: result.rows[0]!.expires_at.toISOString() });
  } catch (err) {
    req.log.error({ err }, "License activate-desktop error");
    return res.status(500).json({ error: "internal" });
  }
});

// Auth-required — associates key with calling user atomically
router.post("/licenses/activate", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthedReq).userId;
    const { key: keyStr } = req.body as { key?: string };
    if (!keyStr) return res.status(400).json({ error: "missing_key" });

    const normalised = keyStr.toUpperCase().trim();

    // Atomic conditional update: only proceed if the key is unclaimed OR already belongs to this user.
    // Using raw SQL to do a single round-trip with no TOCTOU race.
    const result = await pool.query<{
      id: string;
      user_id: string | null;
      expires_at: Date;
      revoked_at: Date | null;
      activated_at: Date | null;
    }>(
      `UPDATE license_keys
         SET user_id      = $1,
             activated_at = COALESCE(activated_at, NOW()),
             updated_at   = NOW()
       WHERE key = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
         AND (user_id IS NULL OR user_id = $1)
       RETURNING id, user_id, expires_at, revoked_at, activated_at`,
      [userId, normalised],
    );

    if (result.rowCount === 0) {
      // Determine the reason by fetching the row (read-only, race-safe enough here)
      const [row] = await db
        .select()
        .from(licenseKeysTable)
        .where(eq(licenseKeysTable.key, normalised))
        .limit(1);
      if (!row) return res.status(404).json({ error: "not_found" });
      if (row.revokedAt) return res.status(403).json({ error: "revoked" });
      if (new Date(row.expiresAt) < new Date()) return res.status(403).json({ error: "expired" });
      return res.status(409).json({ error: "already_claimed" });
    }

    const updated = result.rows[0]!;
    return res.json({ ok: true, expiresAt: updated.expires_at.toISOString() });
  } catch (err) {
    req.log.error({ err }, "License activate error");
    return res.status(500).json({ error: "internal" });
  }
});

// Auth-required — returns the caller's most recently-expiring active license
router.get("/licenses/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthedReq).userId;

    const rows = await db
      .select()
      .from(licenseKeysTable)
      .where(and(eq(licenseKeysTable.userId, userId), isNull(licenseKeysTable.revokedAt)))
      .orderBy(desc(licenseKeysTable.expiresAt))
      .limit(5);

    const active = rows.find(r => new Date(r.expiresAt) > new Date());
    if (!active) return res.json({ license: null });

    return res.json({
      license: {
        id: active.id,
        key: active.key,
        expiresAt: active.expiresAt,
        activatedAt: active.activatedAt,
        status: licenseStatus(active),
      },
    });
  } catch (err) {
    req.log.error({ err }, "License me error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
