import { Router, Request } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable, inventoryLogsTable, farmMembersTable, activityLogTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

function computeStatus(item: typeof inventoryItemsTable.$inferSelect): "ok" | "low" | "expired" {
  const today = new Date().toISOString().split("T")[0]!;
  if (item.expirationDate && item.expirationDate < today) return "expired";
  if (item.lowStockThreshold && parseFloat(item.quantity) <= parseFloat(item.lowStockThreshold)) return "low";
  return "ok";
}

router.get("/farms/:farmId/inventory", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const { category, search } = req.query as Record<string, string>;

    const items = await db.select().from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.farmId, farmId))
      .orderBy(desc(inventoryItemsTable.createdAt));

    const filtered = items.filter(item => {
      if (category && category !== "all" && item.category !== category) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    return res.json(filtered.map(item => ({ ...item, status: computeStatus(item) })));
  } catch (err) {
    req.log.error({ err }, "List inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/inventory", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const userId = (req as AuthedReq).userId;
    const { category, name, quantity, unit, lowStockThreshold, costPerUnitCop, supplierName, supplierContact, expirationDate, notes } = req.body;

    const item = await db.insert(inventoryItemsTable).values({
      farmId,
      category,
      name,
      quantity: String(quantity),
      unit,
      lowStockThreshold: lowStockThreshold ? String(lowStockThreshold) : undefined,
      costPerUnitCop: costPerUnitCop ? String(costPerUnitCop) : undefined,
      supplierName,
      supplierContact,
      expirationDate,
      notes,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: "inventory_added",
      entityType: "inventory",
      entityId: item[0]!.id,
      description: `Added inventory: ${name}`,
    });

    return res.status(201).json({ ...item[0], status: computeStatus(item[0]!) });
  } catch (err) {
    req.log.error({ err }, "Create inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/inventory/:itemId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, itemId } = req.params as { farmId: string; itemId: string };

    const item = await db.select().from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.farmId, farmId)))
      .limit(1);

    if (!item[0]) return res.status(404).json({ error: "not_found" });

    const logs = await db.select().from(inventoryLogsTable)
      .where(eq(inventoryLogsTable.itemId, itemId))
      .orderBy(desc(inventoryLogsTable.createdAt));

    return res.json({ ...item[0], status: computeStatus(item[0]), logs });
  } catch (err) {
    req.log.error({ err }, "Get inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/inventory/:itemId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, itemId } = req.params as { farmId: string; itemId: string };
    const userId = (req as AuthedReq).userId;
    const { category, name, quantity, unit, lowStockThreshold, costPerUnitCop, supplierName, supplierContact, expirationDate, notes } = req.body;

    const updated = await db.update(inventoryItemsTable)
      .set({
        category, name,
        quantity: quantity !== undefined ? String(quantity) : undefined,
        unit,
        lowStockThreshold: lowStockThreshold !== undefined ? String(lowStockThreshold) : undefined,
        costPerUnitCop: costPerUnitCop !== undefined ? String(costPerUnitCop) : undefined,
        supplierName, supplierContact, expirationDate, notes,
        updatedAt: new Date(),
      })
      .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.farmId, farmId)))
      .returning();

    if (updated[0]) {
      await db.insert(activityLogTable).values({
        farmId, userId,
        actionType: "updated",
        entityType: "inventory",
        entityId: itemId,
        description: `Updated inventory: ${updated[0].name}`,
      });
    }

    return res.json({ ...updated[0], status: computeStatus(updated[0]!) });
  } catch (err) {
    req.log.error({ err }, "Update inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/inventory/:itemId/log", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, itemId } = req.params as { farmId: string; itemId: string };
    const userId = (req as AuthedReq).userId;
    const { action, quantityChange, animalId, notes } = req.body;

    const log = await db.insert(inventoryLogsTable).values({
      itemId,
      action,
      quantityChange: String(quantityChange),
      animalId: animalId ?? undefined,
      notes,
      createdBy: userId,
    }).returning();

    const item = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, itemId)).limit(1);
    if (item[0]) {
      const newQty = parseFloat(item[0].quantity) + parseFloat(String(quantityChange));
      await db.update(inventoryItemsTable)
        .set({ quantity: String(Math.max(0, newQty)), updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, itemId));
    }

    await db.insert(activityLogTable).values({
      farmId,
      userId,
      actionType: `inventory_${action}`,
      entityType: "inventory",
      entityId: itemId,
      description: `Inventory ${action}: ${Math.abs(parseFloat(String(quantityChange)))} units`,
    });

    return res.status(201).json(log[0]);
  } catch (err) {
    req.log.error({ err }, "Log inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/inventory/:itemId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, itemId } = req.params as { farmId: string; itemId: string };
    const userId = (req as AuthedReq).userId;

    const [item] = await db.select().from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.farmId, farmId)))
      .limit(1);

    await db.delete(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.farmId, farmId)));

    if (item) {
      await db.insert(activityLogTable).values({
        farmId, userId,
        actionType: "deleted",
        entityType: "inventory",
        entityId: itemId,
        description: `Removed inventory: ${item.name}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete inventory error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
