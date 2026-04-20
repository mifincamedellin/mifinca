import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { licenseKeysTable, profilesTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type AuthedReq = Request & { userId: string };

function licenseStatus(key: typeof licenseKeysTable.$inferSelect): "active" | "expired" | "revoked" {
  if (key.revokedAt) return "revoked";
  if (new Date(key.expiresAt) < new Date()) return "expired";
  return "active";
}

router.get("/licenses/validate", async (req, res) => {
  try {
    const keyStr = req.query["key"] as string | undefined;
    if (!keyStr) return res.status(400).json({ valid: false, reason: "missing_key" });

    const [row] = await db
      .select()
      .from(licenseKeysTable)
      .where(eq(licenseKeysTable.key, keyStr.toUpperCase()))
      .limit(1);

    if (!row) return res.json({ valid: false, reason: "not_found" });
    if (row.revokedAt) return res.json({ valid: false, reason: "revoked", expiresAt: row.expiresAt });
    if (new Date(row.expiresAt) < new Date()) return res.json({ valid: false, reason: "expired", expiresAt: row.expiresAt });

    return res.json({ valid: true, expiresAt: row.expiresAt, keyId: row.id });
  } catch (err) {
    req.log.error({ err }, "License validate error");
    return res.status(500).json({ valid: false, reason: "internal" });
  }
});

router.post("/licenses/activate", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthedReq).userId;
    const { key: keyStr } = req.body as { key?: string };
    if (!keyStr) return res.status(400).json({ error: "missing_key" });

    const [row] = await db
      .select()
      .from(licenseKeysTable)
      .where(eq(licenseKeysTable.key, keyStr.toUpperCase().trim()))
      .limit(1);

    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.revokedAt) return res.status(403).json({ error: "revoked" });
    if (new Date(row.expiresAt) < new Date()) return res.status(403).json({ error: "expired" });
    if (row.userId && row.userId !== userId) return res.status(409).json({ error: "already_claimed" });

    const [updated] = await db
      .update(licenseKeysTable)
      .set({ userId, activatedAt: row.activatedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(licenseKeysTable.id, row.id))
      .returning();

    return res.json({ ok: true, expiresAt: updated!.expiresAt, key: updated!.key });
  } catch (err) {
    req.log.error({ err }, "License activate error");
    return res.status(500).json({ error: "internal" });
  }
});

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
