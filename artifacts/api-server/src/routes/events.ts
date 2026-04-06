import { Router } from "express";
import { db } from "@workspace/db";
import { farmEventsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();

router.get("/farms/:farmId/events", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { from, to } = req.query as { from?: string; to?: string };
    let q = db.select().from(farmEventsTable).where(eq(farmEventsTable.farmId, farmId));
    const events = await q.orderBy(farmEventsTable.startDate);
    let filtered = events;
    if (from) filtered = filtered.filter(e => e.startDate >= from!);
    if (to) filtered = filtered.filter(e => e.startDate <= to!);
    return res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "List events error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/events", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, allDay, category, assignedTo, color } = req.body;
    if (!title || !startDate) return res.status(400).json({ error: "title and startDate required" });
    const record = await db.insert(farmEventsTable).values({
      farmId,
      title,
      description: description || null,
      startDate,
      endDate: endDate || null,
      allDay: allDay !== false,
      category: category || "other",
      assignedTo: assignedTo || null,
      color: color || null,
      createdBy: userId || null,
    }).returning();
    return res.status(201).json(record[0]);
  } catch (err) {
    req.log.error({ err }, "Create event error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/events/:eventId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, eventId } = req.params as { farmId: string; eventId: string };
    const { title, description, startDate, endDate, allDay, category, assignedTo, color } = req.body;
    const updated = await db.update(farmEventsTable)
      .set({ title, description: description || null, startDate, endDate: endDate || null, allDay: allDay !== false, category, assignedTo: assignedTo || null, color: color || null })
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)))
      .returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update event error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/events/:eventId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, eventId } = req.params as { farmId: string; eventId: string };
    await db.delete(farmEventsTable)
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete event error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
