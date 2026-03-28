import { Router, Request } from "express";
import { db } from "@workspace/db";
import { contactsTable, farmMembersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

// List contacts
router.get("/farms/:farmId/contacts", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const { search, category } = req.query as Record<string, string>;

    let rows = await db.select().from(contactsTable)
      .where(eq(contactsTable.farmId, farmId))
      .orderBy(contactsTable.name);

    if (category && category !== "all") rows = rows.filter(r => r.category === category);
    if (search) rows = rows.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone && r.phone.includes(search)) ||
      (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
    );

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List contacts error");
    return res.status(500).json({ error: "internal" });
  }
});

// Create a contact
router.post("/farms/:farmId/contacts", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const farmId = req.params["farmId"]!;
    const { name, phone, email, category, notes } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const [row] = await db.insert(contactsTable).values({
      farmId,
      name,
      phone: phone || null,
      email: email || null,
      category: category || "other",
      notes: notes || null,
    }).returning();

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create contact error");
    return res.status(500).json({ error: "internal" });
  }
});

// Update a contact
router.put("/farms/:farmId/contacts/:id", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { id, farmId } = req.params as Record<string, string>;
    const { name, phone, email, category, notes } = req.body;

    const [row] = await db.update(contactsTable)
      .set({ name, phone: phone || null, email: email || null, category, notes: notes || null, updatedAt: new Date() })
      .where(and(eq(contactsTable.id, id), eq(contactsTable.farmId, farmId!)))
      .returning();

    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update contact error");
    return res.status(500).json({ error: "internal" });
  }
});

// Delete a contact
router.delete("/farms/:farmId/contacts/:id", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { id, farmId } = req.params as Record<string, string>;
    await db.delete(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.farmId, farmId!)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete contact error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
