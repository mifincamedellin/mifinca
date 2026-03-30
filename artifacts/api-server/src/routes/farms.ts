import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  farmsTable, farmMembersTable, profilesTable,
  animalsTable, inventoryItemsTable, medicalRecordsTable, activityLogTable,
} from "@workspace/db";
import { eq, and, count, lt, lte } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();

type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

router.get("/farms", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthedReq).userId;
    const memberships = await db.select({
      farmId: farmMembersTable.farmId,
      role: farmMembersTable.role,
    }).from(farmMembersTable).where(eq(farmMembersTable.userId, userId));

    const farmIds = memberships.map(m => m.farmId);
    if (farmIds.length === 0) return res.json([]);

    const farms = await Promise.all(farmIds.map(async (farmId) => {
      const farm = await db.select().from(farmsTable).where(eq(farmsTable.id, farmId)).limit(1);
      const m = memberships.find(m => m.farmId === farmId);
      return farm[0] ? { ...farm[0], userRole: m?.role } : null;
    }));

    return res.json(farms.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "List farms error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthedReq).userId;
    const { name, location, totalHectares } = req.body;

    const farm = await db.insert(farmsTable).values({
      ownerId: userId,
      name,
      location,
      totalHectares,
    }).returning();

    await db.insert(farmMembersTable).values({
      farmId: farm[0]!.id,
      userId,
      role: "owner",
      permissions: { can_edit: true, can_add_animals: true, can_log_inventory: true },
    });

    return res.status(201).json(farm[0]);
  } catch (err) {
    req.log.error({ err }, "Create farm error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farm = await db.select().from(farmsTable).where(eq(farmsTable.id, req.params["farmId"]!)).limit(1);
    const member = (req as AuthedReq).farmMember;
    return res.json({ ...farm[0], userRole: member?.role });
  } catch (err) {
    req.log.error({ err }, "Get farm error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { name, location, totalHectares } = req.body;
    const updated = await db.update(farmsTable)
      .set({ name, location, totalHectares, updatedAt: new Date() })
      .where(eq(farmsTable.id, req.params["farmId"]!))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update farm error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/members", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const members = await db.select({
      id: farmMembersTable.id,
      farmId: farmMembersTable.farmId,
      userId: farmMembersTable.userId,
      role: farmMembersTable.role,
      permissions: farmMembersTable.permissions,
      createdAt: farmMembersTable.createdAt,
      profile: {
        id: profilesTable.id,
        fullName: profilesTable.fullName,
        role: profilesTable.role,
        preferredLanguage: profilesTable.preferredLanguage,
      },
    }).from(farmMembersTable)
      .innerJoin(profilesTable, eq(farmMembersTable.userId, profilesTable.id))
      .where(eq(farmMembersTable.farmId, req.params["farmId"]!));
    return res.json(members);
  } catch (err) {
    req.log.error({ err }, "List members error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/members", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { email, role = "worker" } = req.body;

    const userResult = await db.execute({
      sql: "SELECT id FROM auth_users WHERE email = $1",
      params: [email],
    });

    const rows = (userResult as { rows: { id: string }[] }).rows;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", message: "User not found" });
    }

    const inviteeId = rows[0]!.id;
    const member = await db.insert(farmMembersTable).values({
      farmId: req.params["farmId"]!,
      userId: inviteeId,
      role,
    }).returning();

    return res.status(201).json(member[0]);
  } catch (err) {
    req.log.error({ err }, "Invite member error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/members/:userId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    await db.delete(farmMembersTable)
      .where(and(
        eq(farmMembersTable.farmId, req.params["farmId"]!),
        eq(farmMembersTable.userId, req.params["userId"]!)
      ));
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Remove member error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/map-location", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { mapLat, mapLng, mapZoom } = req.body;
    const updated = await db.update(farmsTable)
      .set({
        ...(mapLat !== undefined && { mapLat: String(mapLat) }),
        ...(mapLng !== undefined && { mapLng: String(mapLng) }),
        ...(mapZoom !== undefined && { mapZoom }),
        updatedAt: new Date(),
      })
      .where(eq(farmsTable.id, req.params["farmId"]!))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update map location error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/stats", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const today = new Date().toISOString().split("T")[0];

    const [animalCountResult] = await db.select({ count: count() }).from(animalsTable)
      .where(and(eq(animalsTable.farmId, farmId), eq(animalsTable.status, "active")));

    const animalsForSpecies = await db.select({
      species: animalsTable.species,
    }).from(animalsTable).where(and(eq(animalsTable.farmId, farmId), eq(animalsTable.status, "active")));

    const ALL_SPECIES = ["cattle", "pig", "horse", "goat", "sheep", "chicken", "other"];
    const speciesCounts = animalsForSpecies.reduce((acc: Record<string, number>, a) => {
      acc[a.species] = (acc[a.species] ?? 0) + 1;
      return acc;
    }, Object.fromEntries(ALL_SPECIES.map(s => [s, 0])));

    const animalsBySpecies = ALL_SPECIES.map(species => ({ species, count: speciesCounts[species] ?? 0 }));

    const inventoryItems = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.farmId, farmId));

    const lowStockItems = inventoryItems.filter(item => {
      if (!item.lowStockThreshold) return false;
      return parseFloat(item.quantity) <= parseFloat(item.lowStockThreshold);
    });

    const expiredItems = inventoryItems.filter(item => {
      if (!item.expirationDate) return false;
      return item.expirationDate < today!;
    });

    const upcomingMedical = await db.select().from(medicalRecordsTable)
      .innerJoin(animalsTable, eq(medicalRecordsTable.animalId, animalsTable.id))
      .where(eq(animalsTable.farmId, farmId))
      .limit(10);

    const recentActivity = await db.select({ count: count() }).from(activityLogTable)
      .where(eq(activityLogTable.farmId, farmId));

    return res.json({
      totalAnimals: animalCountResult?.count ?? 0,
      animalsBySpecies,
      lowStockCount: lowStockItems.length + expiredItems.length,
      upcomingMedicalCount: upcomingMedical.length,
      recentActivityCount: recentActivity[0]?.count ?? 0,
      upcomingMedical: upcomingMedical.slice(0, 5).map(r => ({
        ...r.medical_records,
        animalName: r.animals.name,
        animalTag: r.animals.customTag,
      })),
      lowStockItems: lowStockItems.slice(0, 5).map(item => ({
        ...item,
        status: (item.expirationDate && item.expirationDate < today!) ? "expired" :
          (item.lowStockThreshold && parseFloat(item.quantity) <= parseFloat(item.lowStockThreshold)) ? "low" : "ok",
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Farm stats error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
