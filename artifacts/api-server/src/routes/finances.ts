import { Router, Request } from "express";
import { db } from "@workspace/db";
import { financeTransactionsTable, farmMembersTable, activityLogTable } from "@workspace/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

// List transactions with optional filters
router.get("/farms/:farmId/finances", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const { type, category, from, to } = req.query as Record<string, string>;

    let rows = await db.select().from(financeTransactionsTable)
      .where(eq(financeTransactionsTable.farmId, farmId))
      .orderBy(desc(financeTransactionsTable.date));

    if (type && type !== "all") rows = rows.filter(r => r.type === type);
    if (category && category !== "all") rows = rows.filter(r => r.category === category);
    if (from) rows = rows.filter(r => r.date >= from);
    if (to) rows = rows.filter(r => r.date <= to);

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List finances error");
    return res.status(500).json({ error: "internal" });
  }
});

// Create a transaction
router.post("/farms/:farmId/finances", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const userId = (req as AuthedReq).userId;
    const { type, category, amount, description, date, notes } = req.body;

    if (!type || !category || !amount || !description || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [row] = await db.insert(financeTransactionsTable).values({
      farmId,
      type,
      category,
      amount: String(amount),
      description,
      date,
      notes: notes || null,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId, userId,
      actionType: "created",
      entityType: "finance",
      entityId: row!.id,
      description: `Added ${type === "income" ? "income" : "expense"}: ${description}`,
    });

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create finance error");
    return res.status(500).json({ error: "internal" });
  }
});

// Update a transaction
router.put("/farms/:farmId/finances/:id", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { id, farmId } = req.params as Record<string, string>;
    const userId = (req as AuthedReq).userId;
    const { type, category, amount, description, date, notes } = req.body;

    const [row] = await db.update(financeTransactionsTable)
      .set({ type, category, amount: String(amount), description, date, notes: notes || null, updatedAt: new Date() })
      .where(and(eq(financeTransactionsTable.id, id), eq(financeTransactionsTable.farmId, farmId!)))
      .returning();

    if (!row) return res.status(404).json({ error: "Not found" });

    await db.insert(activityLogTable).values({
      farmId: farmId!, userId,
      actionType: "updated",
      entityType: "finance",
      entityId: id,
      description: `Updated ${type === "income" ? "income" : "expense"}: ${description}`,
    });

    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update finance error");
    return res.status(500).json({ error: "internal" });
  }
});

// Delete a transaction
router.delete("/farms/:farmId/finances/:id", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { id, farmId } = req.params as Record<string, string>;
    const userId = (req as AuthedReq).userId;

    const [txn] = await db.select().from(financeTransactionsTable)
      .where(and(eq(financeTransactionsTable.id, id), eq(financeTransactionsTable.farmId, farmId!)))
      .limit(1);

    await db.delete(financeTransactionsTable)
      .where(and(eq(financeTransactionsTable.id, id), eq(financeTransactionsTable.farmId, farmId!)));

    if (txn) {
      await db.insert(activityLogTable).values({
        farmId: farmId!, userId,
        actionType: "deleted",
        entityType: "finance",
        entityId: id,
        description: `Removed ${txn.type === "income" ? "income" : "expense"}: ${txn.description}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete finance error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
