import { Router } from "express";
import { db } from "@workspace/db";
import { zonesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";
import { z } from "zod";

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

const createZoneSchema = z.object({
  name: z.string().min(1).max(100),
  zoneType: z.string().max(50).optional(),
  color: z.string().max(30).optional(),
  capacity: z.number().int().nonnegative().optional().nullable(),
  areaHectares: z.string().optional().nullable(),
  geometry: geoJsonPolygonSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateZoneSchema = createZoneSchema.partial();

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
    const parsed = createZoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const { name, zoneType, color, capacity, areaHectares, geometry, notes } = parsed.data;
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
    const parsed = updateZoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const { name, zoneType, color, capacity, areaHectares, geometry, notes } = parsed.data;
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
      .where(and(
        eq(zonesTable.id, req.params["zoneId"]!),
        eq(zonesTable.farmId, req.params["farmId"]!),
      ))
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
    const deleted = await db.delete(zonesTable)
      .where(and(
        eq(zonesTable.id, req.params["zoneId"]!),
        eq(zonesTable.farmId, req.params["farmId"]!),
      ))
      .returning();
    if (!deleted[0]) return res.status(404).json({ error: "not_found" });
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete zone error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
