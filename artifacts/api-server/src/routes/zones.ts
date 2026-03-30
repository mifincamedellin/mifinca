import { Router } from "express";
import { db } from "@workspace/db";
import { zonesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();

router.get("/farms/:farmId/zones", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const zones = await db.select().from(zonesTable)
      .where(eq(zonesTable.farmId, req.params["farmId"]!))
      .orderBy(desc(zonesTable.createdAt));
    return res.json(zones);
  } catch (err) {
    req.log.error({ err }, "List zones error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/zones", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { name, zoneType, color, capacity, areaHectares, geometry, notes } = req.body;
    const zone = await db.insert(zonesTable).values({
      farmId: req.params["farmId"]!,
      name,
      zoneType,
      color,
      capacity,
      areaHectares,
      geometry,
      notes,
    }).returning();
    return res.status(201).json(zone[0]);
  } catch (err) {
    req.log.error({ err }, "Create zone error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/zones/:zoneId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { name, zoneType, color, capacity, areaHectares, geometry, notes } = req.body;
    const updated = await db.update(zonesTable)
      .set({
        ...(name !== undefined && { name }),
        ...(zoneType !== undefined && { zoneType }),
        ...(color !== undefined && { color }),
        ...(capacity !== undefined && { capacity }),
        ...(areaHectares !== undefined && { areaHectares }),
        ...(geometry !== undefined && { geometry }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      })
      .where(eq(zonesTable.id, req.params["zoneId"]!))
      .returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update zone error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/zones/:zoneId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    await db.delete(zonesTable).where(eq(zonesTable.id, req.params["zoneId"]!));
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete zone error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
