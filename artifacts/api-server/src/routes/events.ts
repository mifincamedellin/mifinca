import { Router } from "express";
import { db } from "@workspace/db";
import { farmEventsTable, animalsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireFarmAccess, requirePerm } from "../middleware/auth.js";
import type { AuthedReq } from "../middleware/auth.js";

const router = Router();

router.get("/farms/:farmId/events", requireAuth, requireFarmAccess, requirePerm("can_view_calendar"), async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { from, to } = req.query as { from?: string; to?: string };
    const events = await db.select().from(farmEventsTable)
      .where(eq(farmEventsTable.farmId, farmId))
      .orderBy(farmEventsTable.startDate);
    let filtered = events;
    if (from) filtered = filtered.filter(e => e.startDate >= from!);
    if (to) filtered = filtered.filter(e => e.startDate <= to!);
    return res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "List events error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/events", requireAuth, requireFarmAccess, requirePerm("can_add_calendar"), async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const userId = (req as AuthedReq).userId;
    const { title, description, startDate, endDate, allDay, category, assignedTo, color, animalId } = req.body;
    if (!title || !startDate) return res.status(400).json({ error: "title and startDate required" });
    if (animalId) {
      const animal = await db.select({ id: animalsTable.id }).from(animalsTable)
        .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
      if (!animal[0]) return res.status(400).json({ error: "animal_not_in_farm" });
    }
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
      animalId: animalId || null,
      createdBy: userId || null,
    }).returning();
    return res.status(201).json(record[0]);
  } catch (err) {
    req.log.error({ err }, "Create event error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/events/:eventId", requireAuth, requireFarmAccess, requirePerm("can_edit_calendar"), async (req, res) => {
  try {
    const { farmId, eventId } = req.params as { farmId: string; eventId: string };
    const { title, description, startDate, endDate, allDay, category, assignedTo, color, animalId } = req.body;

    const existing = await db.select({ medicalRecordId: farmEventsTable.medicalRecordId })
      .from(farmEventsTable)
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)))
      .limit(1);

    if (existing[0]?.medicalRecordId) {
      return res.status(403).json({ error: "cannot_edit_auto_event", message: "This event was auto-created from a medical record. Edit it from the animal's profile." });
    }

    if (animalId) {
      const animal = await db.select({ id: animalsTable.id }).from(animalsTable)
        .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
      if (!animal[0]) return res.status(400).json({ error: "animal_not_in_farm" });
    }

    const updated = await db.update(farmEventsTable)
      .set({
        title,
        description: description || null,
        startDate,
        endDate: endDate || null,
        allDay: allDay !== false,
        category,
        assignedTo: assignedTo || null,
        color: color || null,
        animalId: animalId || null,
      })
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)))
      .returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update event error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/events/:eventId", requireAuth, requireFarmAccess, requirePerm("can_remove_calendar"), async (req, res) => {
  try {
    const { farmId, eventId } = req.params as { farmId: string; eventId: string };

    const existing = await db.select({ medicalRecordId: farmEventsTable.medicalRecordId })
      .from(farmEventsTable)
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)))
      .limit(1);

    if (existing[0]?.medicalRecordId) {
      return res.status(403).json({ error: "cannot_delete_auto_event", message: "This event was auto-created from a medical record. Remove the next-due date from the animal's profile to delete it." });
    }

    await db.delete(farmEventsTable)
      .where(and(eq(farmEventsTable.id, eventId), eq(farmEventsTable.farmId, farmId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete event error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
