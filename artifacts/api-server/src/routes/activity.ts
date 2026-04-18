import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable, profilesTable } from "@workspace/db";
import { eq, desc, and, gte, lte, SQL } from "drizzle-orm";
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

    const filterUserId = query["userId"] || null;
    const filterEntityType = query["entityType"] || null;
    const filterEntityId = query["entityId"] || null;
    const filterFrom = query["from"] || null;
    const filterTo = query["to"] || null;

    // Validate date inputs — reject anything that can't be parsed as a valid date
    if (filterFrom) {
      const d = new Date(filterFrom);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "invalid_from_date" });
    }
    if (filterTo) {
      const d = new Date(filterTo);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "invalid_to_date" });
    }

    const conditions: SQL[] = [eq(activityLogTable.farmId, farmId)];

    if (filterUserId) {
      conditions.push(eq(activityLogTable.userId, filterUserId));
    }
    if (filterEntityType) {
      conditions.push(eq(activityLogTable.entityType, filterEntityType));
    }
    if (filterEntityId) {
      conditions.push(eq(activityLogTable.entityId, filterEntityId));
    }
    if (filterFrom) {
      conditions.push(gte(activityLogTable.createdAt, new Date(filterFrom)));
    }
    if (filterTo) {
      const toDate = new Date(filterTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(activityLogTable.createdAt, toDate));
    }

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
      .where(and(...conditions))
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
