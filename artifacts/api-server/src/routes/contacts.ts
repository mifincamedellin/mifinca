import { Router, Request } from "express";
import { db } from "@workspace/db";
import { contactsTable, farmMembersTable, activityLogTable, profilesTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { getPlanLimits } from "../lib/plans.js";
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
    const userId = (req as AuthedReq).userId;
    const { name, phone, email, category, notes } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const [profile] = await db.select({ plan: profilesTable.plan, clerkId: profilesTable.clerkId }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    const isDemo = profile?.clerkId?.startsWith("demo:");
    const limits = getPlanLimits(profile?.plan);
    if (!isDemo && limits.contacts !== null) {
      const [{ count: contactCount }] = await db.select({ count: count() }).from(contactsTable).where(eq(contactsTable.farmId, farmId));
      if (contactCount >= limits.contacts) {
        return res.status(403).json({ error: "plan_limit", resource: "contacts", limit: limits.contacts });
      }
    }

    const [row] = await db.insert(contactsTable).values({
      farmId,
      name,
      phone: phone || null,
      email: email || null,
      category: category || "other",
      notes: notes || null,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId, userId,
      actionType: "created",
      entityType: "contact",
      entityId: row!.id,
      description: `Added contact: ${name}`,
    });

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
    const userId = (req as AuthedReq).userId;
    const { name, phone, email, category, notes } = req.body;

    const [row] = await db.update(contactsTable)
      .set({ name, phone: phone || null, email: email || null, category, notes: notes || null, updatedAt: new Date() })
      .where(and(eq(contactsTable.id, id), eq(contactsTable.farmId, farmId!)))
      .returning();

    if (!row) return res.status(404).json({ error: "Not found" });

    await db.insert(activityLogTable).values({
      farmId: farmId!, userId,
      actionType: "updated",
      entityType: "contact",
      entityId: id,
      description: `Updated contact: ${name}`,
    });

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
    const userId = (req as AuthedReq).userId;

    const [contact] = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.farmId, farmId!)))
      .limit(1);

    await db.delete(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.farmId, farmId!)));

    if (contact) {
      await db.insert(activityLogTable).values({
        farmId: farmId!, userId,
        actionType: "deleted",
        entityType: "contact",
        entityId: id,
        description: `Removed contact: ${contact.name}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete contact error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
