import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { licenseKeysTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth, extractOptionalUserId } from "../middleware/auth.js";

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

// Unified license activation — works with or without authentication.
//
// Unauthenticated (no Bearer / no Clerk session):
//   Activates an unclaimed key (user_id IS NULL) without binding it to a user.
//   If the key is already bound to a user account, returns { error: "login_required" }
//   so the desktop app can prompt the user to log in and retry with a JWT.
//
// Authenticated (Bearer JWT or Clerk session):
//   Binds the key to the calling user atomically. Works for unclaimed keys OR
//   keys already owned by the same user (idempotent re-activation).
//   Returns { error: "already_claimed" } if a DIFFERENT user owns the key.
//
// Contract: { ok: true, expiresAt: string } | { error: string }
router.post("/licenses/activate", async (req, res) => {
  try {
    const { key: keyStr } = req.body as { key?: string };
    if (!keyStr) return res.status(400).json({ error: "missing_key" });
    const normalised = keyStr.toUpperCase().trim();

    const userId = await extractOptionalUserId(req);

    if (userId) {
      // ── Authenticated path: bind key to this user ────────────────────────
      const result = await pool.query<{
        expires_at: Date;
      }>(
        `UPDATE license_keys
           SET user_id      = $1,
               activated_at = COALESCE(activated_at, NOW()),
               updated_at   = NOW()
         WHERE key         = $2
           AND revoked_at  IS NULL
           AND expires_at  > NOW()
           AND (user_id IS NULL OR user_id = $1)
         RETURNING expires_at`,
        [userId, normalised],
      );

      if (result.rowCount === 0) {
        const [row] = await db.select().from(licenseKeysTable)
          .where(eq(licenseKeysTable.key, normalised)).limit(1);
        if (!row) return res.status(404).json({ error: "not_found" });
        if (row.revokedAt) return res.status(403).json({ error: "revoked" });
        if (new Date(row.expiresAt) < new Date()) return res.status(403).json({ error: "expired" });
        return res.status(409).json({ error: "already_claimed" });
      }

      return res.json({ ok: true, expiresAt: result.rows[0]!.expires_at.toISOString() });
    } else {
      // ── Unauthenticated path: activate unclaimed key, no user binding ────
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
        const [row] = await db.select().from(licenseKeysTable)
          .where(eq(licenseKeysTable.key, normalised)).limit(1);
        if (!row) return res.status(404).json({ error: "not_found" });
        if (row.revokedAt) return res.status(403).json({ error: "revoked" });
        if (new Date(row.expiresAt) < new Date()) return res.status(403).json({ error: "expired" });
        // Key is bound to a user — desktop must log in first then retry
        if (row.userId) return res.status(409).json({ error: "login_required" });
        return res.status(400).json({ error: "invalid" });
      }

      return res.json({ ok: true, expiresAt: result.rows[0]!.expires_at.toISOString() });
    }
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
