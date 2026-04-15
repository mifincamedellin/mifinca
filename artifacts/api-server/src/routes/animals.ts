import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable, farmMembersTable, activityLogTable, milkRecordsTable, profilesTable, farmEventsTable, animalLifecycleEventsTable,
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
      const cw = weights[0] ? parseFloat(weights[0].weightKg) : undefined;
      return { ...a, currentWeight: cw, currentWeightKg: cw != null ? String(cw) : a.currentWeightKg };
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

    const [weights, medical, offspring, linkedEvents, pregnancyCountResult] = await Promise.all([
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
          isNull(farmEventsTable.medicalRecordId), // exclude auto-generated medical events to avoid duplication with medical records tab
        ))
        .orderBy(asc(farmEventsTable.startDate)),
      db.select({ cnt: count() }).from(animalLifecycleEventsTable)
        .where(and(
          eq(animalLifecycleEventsTable.animalId, animalId),
          eq(animalLifecycleEventsTable.eventType, 'marked_pregnant'),
        )),
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
      currentWeightKg: currentWeight != null ? String(currentWeight) : animal[0].currentWeightKg,
      weightRecords: weights.map(w => ({ ...w, weightKg: parseFloat(w.weightKg) })),
      medicalRecords: medical,
      offspring: offspringList,
      mother,
      father,
      linkedCalendarEvents: linkedEvents,
      pregnancyCount: Number(pregnancyCountResult[0]?.cnt ?? 0),
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

async function logLifecycleEvent(
  farmId: string, animalId: string, fromStage: string | null, toStage: string | null,
  eventType: string, eventAt: Date, notes?: string | null,
) {
  await db.insert(animalLifecycleEventsTable).values({
    animalId, farmId, fromStage, toStage, eventType,
    eventAt, notes: notes ?? null,
  });
}

const LIFECYCLE_CONFIG: Record<string, { heatDurationDays: number; pregnancyDurationDays: number; pregnancyHealthCheckDays: number; nursingDurationDays: number }> = {
  cattle: { heatDurationDays: 3, pregnancyDurationDays: 283, pregnancyHealthCheckDays: 30, nursingDurationDays: 270 },
  goat: { heatDurationDays: 2, pregnancyDurationDays: 150, pregnancyHealthCheckDays: 30, nursingDurationDays: 90 },
  sheep: { heatDurationDays: 2, pregnancyDurationDays: 147, pregnancyHealthCheckDays: 30, nursingDurationDays: 90 },
  horse: { heatDurationDays: 5, pregnancyDurationDays: 340, pregnancyHealthCheckDays: 30, nursingDurationDays: 180 },
  pig: { heatDurationDays: 3, pregnancyDurationDays: 114, pregnancyHealthCheckDays: 30, nursingDurationDays: 28 },
};

function getCfg(species: string) {
  return LIFECYCLE_CONFIG[species] ?? LIFECYCLE_CONFIG.cattle;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.patch("/farms/:farmId/animals/:animalId/lifecycle/mark-in-heat", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { date } = req.body as { date?: string };

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const cfg = getCfg(animal.species);
    const heatStart = date ? new Date(date + "T12:00:00") : new Date();
    const heatEnd = addDays(heatStart, cfg.heatDurationDays);

    const oldStage = animal.lifecycleStage;
    const [updated] = await db.update(animalsTable).set({
      lifecycleStage: "in_heat",
      lifecycleStageStartedAt: heatStart,
      lifecycleStageEndsAt: heatEnd,
      heatStartedAt: heatStart,
      heatEndsAt: heatEnd,
      lastHeatRecordedAt: heatStart,
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, oldStage, "in_heat", "marked_in_heat", heatStart);
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Marked ${animal.name ?? animal.customTag} in heat`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Mark in heat error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lifecycle/end-heat", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const oldStage = animal.lifecycleStage;
    const [updated] = await db.update(animalsTable).set({
      lifecycleStage: "can_breed",
      lifecycleStageStartedAt: new Date(),
      lifecycleStageEndsAt: null,
      heatStartedAt: null,
      heatEndsAt: null,
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, oldStage, "can_breed", "heat_ended", new Date());
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Ended heat for ${animal.name ?? animal.customTag}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "End heat error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lifecycle/mark-pregnant", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { date, dueDate, conceptionMethod } = req.body as { date?: string; dueDate?: string; conceptionMethod?: string };

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const cfg = getCfg(animal.species);
    const pregStart = date ? new Date(date + "T12:00:00") : new Date();
    const expectedDel = dueDate ? new Date(dueDate + "T12:00:00") : addDays(pregStart, cfg.pregnancyDurationDays);
    const checkDue = addDays(pregStart, cfg.pregnancyHealthCheckDays);

    const oldStage = animal.lifecycleStage;
    const [updated] = await db.update(animalsTable).set({
      lifecycleStage: "pregnant",
      lifecycleStageStartedAt: pregStart,
      lifecycleStageEndsAt: expectedDel,
      isPregnant: true,
      pregnancyStartDate: pregStart.toISOString().split("T")[0],
      pregnancyDueDate: expectedDel.toISOString().split("T")[0],
      pregnancyStartedAt: pregStart,
      expectedDeliveryAt: expectedDel,
      pregnancyConfirmedAt: new Date(),
      pregnancyCheckDueAt: checkDue,
      pregnancyCheckCompletedAt: null,
      heatStartedAt: null,
      heatEndsAt: null,
      ...(conceptionMethod ? { conceptionMethod } : {}),
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, oldStage, "pregnant", "marked_pregnant", pregStart);
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Marked ${animal.name ?? animal.customTag} as pregnant`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Mark pregnant error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lifecycle/record-check", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { notes } = req.body as { notes?: string };

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const [updated] = await db.update(animalsTable).set({
      pregnancyCheckCompletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, animal.lifecycleStage, animal.lifecycleStage, "pregnancy_check", new Date(), notes);
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Recorded pregnancy check for ${animal.name ?? animal.customTag}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Record check error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lifecycle/mark-delivered", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;
    const { date, offspringId } = req.body as { date?: string; offspringId?: string };

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const cfg = getCfg(animal.species);
    const deliveryDate = date ? new Date(date + "T12:00:00") : new Date();
    const nursingEnd = addDays(deliveryDate, cfg.nursingDurationDays);

    const oldStage = animal.lifecycleStage;
    const [updated] = await db.update(animalsTable).set({
      lifecycleStage: "nursing",
      lifecycleStageStartedAt: deliveryDate,
      lifecycleStageEndsAt: nursingEnd,
      isPregnant: false,
      pregnancyStartDate: null,
      pregnancyDueDate: null,
      pregnancyStartedAt: null,
      expectedDeliveryAt: null,
      pregnancyCheckDueAt: null,
      pregnancyCheckCompletedAt: null,
      nursingStartedAt: deliveryDate,
      nursingEndsAt: nursingEnd,
      weaningDueAt: nursingEnd,
      latestOffspringId: offspringId ?? null,
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, oldStage, "nursing", "delivered", deliveryDate);
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Recorded delivery for ${animal.name ?? animal.customTag}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Mark delivered error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/animals/:animalId/lifecycle/wean", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, animalId } = req.params as { farmId: string; animalId: string };
    const userId = (req as AuthedReq).userId;

    const [animal] = await db.select().from(animalsTable)
      .where(and(eq(animalsTable.id, animalId), eq(animalsTable.farmId, farmId))).limit(1);
    if (!animal) return res.status(404).json({ error: "not_found" });

    const newStage = "can_breed";
    const oldStage = animal.lifecycleStage;
    const [updated] = await db.update(animalsTable).set({
      lifecycleStage: newStage,
      lifecycleStageStartedAt: new Date(),
      lifecycleStageEndsAt: null,
      nursingStartedAt: null,
      nursingEndsAt: null,
      weaningDueAt: null,
      updatedAt: new Date(),
    }).where(eq(animalsTable.id, animalId)).returning();

    await logLifecycleEvent(farmId, animalId, oldStage, newStage, "weaned", new Date());
    await db.insert(activityLogTable).values({
      farmId, userId, actionType: "lifecycle", entityType: "animal", entityId: animalId,
      description: `Weaned ${animal.species === "pig" ? "piglet" : animal.species === "horse" ? "foal" : animal.species === "goat" ? "kid" : animal.species === "sheep" ? "lamb" : "calf"} for ${animal.name ?? animal.customTag}`,
    });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Wean error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/animals/:animalId/lifecycle-history", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { animalId } = req.params as { animalId: string };
    const events = await db.select().from(animalLifecycleEventsTable)
      .where(eq(animalLifecycleEventsTable.animalId, animalId))
      .orderBy(desc(animalLifecycleEventsTable.eventAt));
    return res.json(events);
  } catch (err) {
    req.log.error({ err }, "Lifecycle history error");
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
