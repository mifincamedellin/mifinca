import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable, farmMembersTable, activityLogTable, milkRecordsTable, profilesTable, farmEventsTable,
} from "@workspace/db";
import { eq, and, desc, asc, ilike, or, count, sql, isNull } from "drizzle-orm";
import { getPlanLimits } from "../lib/plans.js";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

async function syncMedicalCalendarEvent(
  farmId: string,
  animalId: string,
  recordId: string,
  title: string,
  nextDueDate: string | null | undefined,
) {
  if (nextDueDate) {
    const existing = await db.select({ id: farmEventsTable.id })
      .from(farmEventsTable)
      .where(and(eq(farmEventsTable.medicalRecordId, recordId), eq(farmEventsTable.farmId, farmId)))
      .limit(1);
    if (existing[0]) {
      await db.update(farmEventsTable)
        .set({ title, startDate: nextDueDate, animalId, category: "health" })
        .where(and(eq(farmEventsTable.id, existing[0].id), eq(farmEventsTable.farmId, farmId)));
    } else {
      await db.insert(farmEventsTable).values({
        farmId,
        animalId,
        medicalRecordId: recordId,
        title,
        startDate: nextDueDate,
        category: "health",
        allDay: true,
      });
    }
  } else {
    await db.delete(farmEventsTable)
      .where(and(eq(farmEventsTable.medicalRecordId, recordId), eq(farmEventsTable.farmId, farmId)));
  }
}

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

function getLatestWeight(weights: typeof weightRecordsTable.$inferSelect[]) {
  if (!weights.length) return undefined;
  return weights.reduce((a, b) => a.recordedAt > b.recordedAt ? a : b);
}

router.get("/farms/:farmId/animals", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const { species, status, breed, search } = req.query as Record<string, string>;

    let query = db.select().from(animalsTable).where(eq(animalsTable.farmId, farmId));

    const animals = await db.select().from(animalsTable).where(eq(animalsTable.farmId, farmId)).orderBy(desc(animalsTable.createdAt), asc(animalsTable.id));

    const filtered = animals.filter(a => {
      if (species && a.species !== species) return false;
      if (status && a.status !== status) return false;
      if (breed && !a.breed?.toLowerCase().includes(breed.toLowerCase())) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!((a.name ?? "").toLowerCase().includes(s) ||
          (a.customTag ?? "").toLowerCase().includes(s) ||
          (a.breed ?? "").toLowerCase().includes(s))) return false;
      }
      return true;
    });

    const withWeights = await Promise.all(filtered.map(async (a) => {
      const weights = await db.select().from(weightRecordsTable)
        .where(eq(weightRecordsTable.animalId, a.id))
        .orderBy(desc(weightRecordsTable.recordedAt))
        .limit(1);
      return { ...a, currentWeight: weights[0] ? parseFloat(weights[0].weightKg) : undefined };
    }));

    return res.json(withWeights);
  } catch (err) {
    req.log.error({ err }, "List animals error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/animals", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const userId = (req as AuthedReq).userId;

    const [profile] = await db.select({ plan: profilesTable.plan, clerkId: profilesTable.clerkId }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    const isDemo = profile?.clerkId?.startsWith("demo:");
    const limits = getPlanLimits(profile?.plan);
    if (!isDemo && limits.animals !== null) {
      const [{ count: animalCount }] = await db.select({ count: count() }).from(animalsTable).where(eq(animalsTable.farmId, farmId));
      if (animalCount >= limits.animals) {
        return res.status(403).json({ error: "plan_limit", resource: "animals", limit: limits.animals });
      }
    }

    const animal = await db.insert(animalsTable).values({
      farmId,
      ...req.body,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "created",
      entityType: "animal",
      entityId: animal[0]!.id,
      description: `Added animal: ${animal[0]!.name ?? animal[0]!.customTag ?? animal[0]!.species}`,
    });

    return res.status(201).json(animal[0]);
  } catch (err) {
    req.log.error({ err }, "Create animal error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/animals/:animalId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };

    const animal = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)))
      .limit(1);

    if (!animal[0]) {
      return res.status(404).json({ error: "not_found" });
    }

    const [weights, medical, offspring, linkedEvents] = await Promise.all([
      db.select().from(weightRecordsTable)
        .where(eq(weightRecordsTable.animalId, animalId))
        .orderBy(desc(weightRecordsTable.recordedAt)),
      db.select().from(medicalRecordsTable)
        .where(eq(medicalRecordsTable.animalId, animalId))
        .orderBy(desc(medicalRecordsTable.recordDate)),
      db.select().from(animalsTable)
        .where(and(eq(animalsTable.farmId, farmId))),
      db.select().from(farmEventsTable)
        .where(and(
          eq(farmEventsTable.farmId, farmId),
          eq(farmEventsTable.animalId, animalId),
          isNull(farmEventsTable.medicalRecordId),
        ))
        .orderBy(asc(farmEventsTable.startDate)),
    ]);

    const offspringList = offspring.filter(a =>
      a.motherId === animalId || a.fatherId === animalId
    );

    let mother = null;
    let father = null;
    if (animal[0].motherId) {
      const m = await db.select().from(animalsTable).where(eq(animalsTable.id, animal[0].motherId)).limit(1);
      mother = m[0] ?? null;
    }
    if (animal[0].fatherId) {
      const f = await db.select().from(animalsTable).where(eq(animalsTable.id, animal[0].fatherId)).limit(1);
      father = f[0] ?? null;
    }

    const currentWeight = weights[0] ? parseFloat(weights[0].weightKg) : undefined;

    return res.json({
      ...animal[0],
      currentWeight,
      weightRecords: weights.map(w => ({ ...w, weightKg: parseFloat(w.weightKg) })),
      medicalRecords: medical,
      offspring: offspringList,
      mother,
      father,
      linkedCalendarEvents: linkedEvents,
    });
  } catch (err) {
    req.log.error({ err }, "Get animal error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/animals/:animalId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;

    const { photoUrl, customTag, species, breed, name, sex, dateOfBirth, status, motherId, fatherId, currentZoneId, animalType, notes, purchaseDate, purchasePrice } = req.body;

    const updated = await db.update(animalsTable)
      .set({ photoUrl, customTag, species, breed, name, sex, dateOfBirth, status, motherId, fatherId, currentZoneId, animalType, notes, purchaseDate: purchaseDate || null, purchasePrice: purchasePrice != null ? String(purchasePrice) : null, updatedAt: new Date() })
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)))
      .returning();

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "updated",
      entityType: "animal",
      entityId: animalId,
      description: `Updated animal: ${updated[0]?.name ?? updated[0]?.customTag}`,
    });

    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update animal error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/pregnancy", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { isPregnant, pregnancyStartDate, pregnancyDueDate } = req.body as {
      isPregnant: boolean;
      pregnancyStartDate?: string | null;
      pregnancyDueDate?: string | null;
    };

    const [updated] = await db.update(animalsTable)
      .set({
        isPregnant,
        pregnancyStartDate: pregnancyStartDate || null,
        pregnancyDueDate: pregnancyDueDate || null,
        updatedAt: new Date(),
      })
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found" });

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "updated",
      entityType: "animal",
      entityId: animalId,
      description: isPregnant
        ? `Marked ${updated.name ?? updated.customTag} as pregnant (due: ${pregnancyDueDate ?? "TBD"})`
        : `Cleared pregnancy status for ${updated.name ?? updated.customTag}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update pregnancy error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/death", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { deathDate, deathCause } = req.body as { deathDate: string; deathCause?: string };

    const [updated] = await db.update(animalsTable)
      .set({
        status: "deceased",
        deathDate: deathDate || null,
        deathCause: deathCause || null,
        isPregnant: false,
        pregnancyStartDate: null,
        pregnancyDueDate: null,
        updatedAt: new Date(),
      })
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found" });

    const label = updated.name ?? updated.customTag ?? animalId;
    const causeLabel = deathCause ? ` (${deathCause})` : "";
    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "updated",
      entityType: "animal",
      entityId: animalId,
      description: `Recorded death of ${label}${causeLabel} on ${deathDate}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Record death error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lineage", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const { action, parentId, childId, role } = req.body as {
      action: "setMother" | "setFather" | "addChild" | "removeChild";
      parentId?: string | null;
      childId?: string;
      role?: "mother" | "father";
    };

    if (action === "setMother") {
      await db.update(animalsTable)
        .set({ motherId: parentId ?? null, updatedAt: new Date() })
        .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)));
    } else if (action === "setFather") {
      await db.update(animalsTable)
        .set({ fatherId: parentId ?? null, updatedAt: new Date() })
        .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)));
    } else if (action === "addChild" && childId) {
      const field = role === "father" ? { fatherId: animalId, updatedAt: new Date() } : { motherId: animalId, updatedAt: new Date() };
      await db.update(animalsTable)
        .set(field)
        .where(and(eq(animalsTable.id, childId), eq(animalsTable.farmId, farmId)));
    } else if (action === "removeChild" && childId) {
      const child = await db.select().from(animalsTable).where(eq(animalsTable.id, childId)).limit(1);
      if (child[0]) {
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (child[0].motherId === animalId) update["motherId"] = null;
        if (child[0].fatherId === animalId) update["fatherId"] = null;
        await db.update(animalsTable).set(update).where(eq(animalsTable.id, childId));
      }
    } else {
      return res.status(400).json({ error: "invalid_action" });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Lineage update error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/animals/:animalId/weights", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId } = req.params as { animalId: string };
    const weights = await db.select().from(weightRecordsTable)
      .where(eq(weightRecordsTable.animalId, animalId))
      .orderBy(desc(weightRecordsTable.recordedAt));
    return res.json(weights.map(w => ({ ...w, weightKg: parseFloat(w.weightKg) })));
  } catch (err) {
    req.log.error({ err }, "List weights error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/animals/:animalId/weights", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { weightKg, recordedAt, notes } = req.body;

    const record = await db.insert(weightRecordsTable).values({
      animalId,
      weightKg: String(weightKg),
      recordedAt: recordedAt ?? new Date().toISOString().split("T")[0],
      notes,
      createdBy: userId,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "weight_added",
      entityType: "animal",
      entityId: animalId,
      description: `Weight recorded: ${weightKg} kg`,
    });

    return res.status(201).json({ ...record[0], weightKg: parseFloat(record[0]!.weightKg) });
  } catch (err) {
    req.log.error({ err }, "Add weight error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/animals/:animalId/medical", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId } = req.params as { animalId: string };
    const records = await db.select().from(medicalRecordsTable)
      .where(eq(medicalRecordsTable.animalId, animalId))
      .orderBy(desc(medicalRecordsTable.recordDate));
    return res.json(records);
  } catch (err) {
    req.log.error({ err }, "List medical error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/animals/:animalId/medical", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { recordType, title, description, vetName, costCop, recordDate, nextDueDate } = req.body;

    const record = await db.insert(medicalRecordsTable).values({
      animalId,
      recordType,
      title,
      description,
      vetName,
      costCop: costCop ? String(costCop) : undefined,
      recordDate: recordDate ?? new Date().toISOString().split("T")[0],
      nextDueDate,
      createdBy: userId,
    }).returning();

    if (record[0]) {
      await syncMedicalCalendarEvent(farmId, animalId, record[0].id, title, nextDueDate || null);
    }

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "medical_added",
      entityType: "animal",
      entityId: animalId,
      description: `Medical record added: ${title}`,
    });

    return res.status(201).json(record[0]);
  } catch (err) {
    req.log.error({ err }, "Add medical error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/animals/:animalId/milk", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId } = req.params as { farmId: string; animalId: string };
    const records = await db.select().from(milkRecordsTable)
      .where(eq(milkRecordsTable.animalId, animalId))
      .orderBy(desc(milkRecordsTable.recordedAt));
    return res.json(records);
  } catch (err) {
    req.log.error({ err }, "List milk error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/animals/:animalId/milk", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId } = req.params as { farmId: string; animalId: string };
    const { amountLiters, recordedAt, session, notes } = req.body;
    const record = await db.insert(milkRecordsTable).values({
      animalId,
      amountLiters: String(amountLiters),
      recordedAt: recordedAt ?? new Date().toISOString().split("T")[0],
      session: session || null,
      notes: notes || null,
    }).returning();
    return res.status(201).json(record[0]);
  } catch (err) {
    req.log.error({ err }, "Create milk error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/animals/:animalId/milk/:recordId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId, recordId } = req.params as { farmId: string; animalId: string; recordId: string };
    const { amountLiters, recordedAt, session, notes } = req.body;
    const updated = await db.update(milkRecordsTable)
      .set({ amountLiters: String(amountLiters), recordedAt, session: session || null, notes: notes || null })
      .where(and(eq(milkRecordsTable.id, recordId), eq(milkRecordsTable.animalId, animalId)))
      .returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update milk error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/animals/:animalId/medical/:recordId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId, recordId } = req.params as { farmId: string; animalId: string; recordId: string };
    const { recordType, title, description, vetName, costCop, recordDate, nextDueDate } = req.body;

    const updated = await db.update(medicalRecordsTable)
      .set({ recordType, title, description, vetName, costCop: costCop != null ? String(costCop) : null, recordDate, nextDueDate: nextDueDate || null })
      .where(and(eq(medicalRecordsTable.id, recordId), eq(medicalRecordsTable.animalId, animalId)))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: "not_found" });

    await syncMedicalCalendarEvent(farmId, animalId, recordId, title, nextDueDate || null);

    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update medical error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/animals/:animalId/medical/:recordId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId, recordId } = req.params as { farmId: string; animalId: string; recordId: string };
    await db.delete(farmEventsTable).where(
      and(eq(farmEventsTable.medicalRecordId, recordId), eq(farmEventsTable.farmId, farmId))
    );
    await db.delete(medicalRecordsTable)
      .where(and(eq(medicalRecordsTable.id, recordId), eq(medicalRecordsTable.animalId, animalId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete medical error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/animals/:animalId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)))
      .limit(1);

    await db.delete(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId)));

    if (animal) {
      await db.insert(activityLogTable).values({
        farmId, userId,
        actionType: "deleted",
        entityType: "animal",
        entityId: animalId,
        description: `Removed animal: ${animal.name ?? animal.customTag ?? animal.species}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete animal error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
