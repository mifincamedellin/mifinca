import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable, profilesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();

router.get("/farms/:farmId/activity", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const query = req.query as Record<string, string>;
    const parsedLimit = parseInt(query["limit"] ?? "");
    const parsedOffset = parseInt(query["offset"] ?? "");
    const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20, 100);
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

    const entries = await db.select({
      id: activityLogTable.id,
      farmId: activityLogTable.farmId,
      userId: activityLogTable.userId,
      actionType: activityLogTable.actionType,
      entityType: activityLogTable.entityType,
      entityId: activityLogTable.entityId,
      description: activityLogTable.description,
      metadata: activityLogTable.metadata,
      createdAt: activityLogTable.createdAt,
      profile: {
        id: profilesTable.id,
        fullName: profilesTable.fullName,
        role: profilesTable.role,
        preferredLanguage: profilesTable.preferredLanguage,
      },
    }).from(activityLogTable)
      .leftJoin(profilesTable, eq(activityLogTable.userId, profilesTable.id))
      .where(eq(activityLogTable.farmId, farmId))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json(entries);
  } catch (err) {
    req.log.error({ err }, "List activity error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
