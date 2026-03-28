import { Router } from "express";
import { db } from "@workspace/db";
import { animalsTable, inventoryItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  try {
    const { farmId, q } = req.query as Record<string, string>;
    if (!farmId || !q) {
      return res.status(400).json({ error: "validation", message: "farmId and q are required" });
    }

    const search = q.toLowerCase();

    const allAnimals = await db.select().from(animalsTable).where(eq(animalsTable.farmId, farmId));
    const animals = allAnimals.filter(a =>
      (a.name ?? "").toLowerCase().includes(search) ||
      (a.customTag ?? "").toLowerCase().includes(search) ||
      (a.breed ?? "").toLowerCase().includes(search) ||
      a.species.toLowerCase().includes(search)
    ).slice(0, 10);

    const allInventory = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.farmId, farmId));
    const inventory = allInventory.filter(i =>
      i.name.toLowerCase().includes(search) ||
      (i.supplierName ?? "").toLowerCase().includes(search)
    ).slice(0, 10);

    return res.json({ animals, inventory });
  } catch (err) {
    req.log.error({ err }, "Search error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
