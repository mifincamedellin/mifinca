import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable, farmMembersTable, activityLogTable,
} from "@workspace/db";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

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

    const animals = await db.select().from(animalsTable).where(eq(animalsTable.farmId, farmId)).orderBy(desc(animalsTable.createdAt));

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

    const [weights, medical, offspring] = await Promise.all([
      db.select().from(weightRecordsTable)
        .where(eq(weightRecordsTable.animalId, animalId))
        .orderBy(desc(weightRecordsTable.recordedAt)),
      db.select().from(medicalRecordsTable)
        .where(eq(medicalRecordsTable.animalId, animalId))
        .orderBy(desc(medicalRecordsTable.recordDate)),
      db.select().from(animalsTable)
        .where(and(eq(animalsTable.farmId, farmId))),
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

    const { photoUrl, customTag, species, breed, name, sex, dateOfBirth, status, motherId, fatherId, currentZoneId, animalType, notes } = req.body;

    const updated = await db.update(animalsTable)
      .set({ photoUrl, customTag, species, breed, name, sex, dateOfBirth, status, motherId, fatherId, currentZoneId, animalType, notes, updatedAt: new Date() })
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

export default router;
