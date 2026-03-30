import { Router, Request } from "express";
import { db } from "@workspace/db";
import { employeesTable, farmMembersTable, farmsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

router.get("/farms/:farmId/employees", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const employees = await db.select().from(employeesTable)
      .where(eq(employeesTable.farmId, farmId))
      .orderBy(employeesTable.name);
    return res.json(employees);
  } catch (err) {
    req.log.error({ err }, "List employees error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/employees", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { name, phone, email, startDate, monthlySalary, bankName, bankAccount, notes } = req.body;
    const employee = await db.insert(employeesTable).values({
      farmId,
      name,
      phone: phone || null,
      email: email || null,
      startDate: startDate || null,
      monthlySalary: monthlySalary ? String(monthlySalary) : "0",
      bankName: bankName || "Bancolombia",
      bankAccount: bankAccount || null,
      notes: notes || null,
    }).returning();
    return res.status(201).json(employee[0]);
  } catch (err) {
    req.log.error({ err }, "Create employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/employees/:employeeId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    const { name, phone, email, startDate, monthlySalary, bankName, bankAccount, notes } = req.body;
    const updated = await db.update(employeesTable).set({
      name,
      phone: phone || null,
      email: email || null,
      startDate: startDate || null,
      monthlySalary: monthlySalary ? String(monthlySalary) : "0",
      bankName: bankName || "Bancolombia",
      bankAccount: bankAccount || null,
      notes: notes || null,
      updatedAt: new Date(),
    }).where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId))).returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });
    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/employees/:employeeId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    await db.delete(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/pay-day", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { payDay } = req.body as { payDay: number };
    if (!payDay || payDay < 1 || payDay > 31) return res.status(400).json({ error: "invalid_day" });
    await db.update(farmsTable).set({ payDay, updatedAt: new Date() }).where(eq(farmsTable.id, farmId));
    return res.json({ ok: true, payDay });
  } catch (err) {
    req.log.error({ err }, "Update pay day error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
