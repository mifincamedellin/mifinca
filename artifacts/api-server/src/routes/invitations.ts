import { Router } from "express";
import { db } from "@workspace/db";
import { farmInvitationsTable, profilesTable, farmMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";
import type { AuthedReq } from "../middleware/auth.js";
import { z } from "zod";

const permissionsSchema = z.object({
  can_view_animals: z.boolean(), can_add_animals: z.boolean(), can_edit_animals: z.boolean(), can_remove_animals: z.boolean(),
  can_view_inventory: z.boolean(), can_add_inventory: z.boolean(), can_edit_inventory: z.boolean(), can_remove_inventory: z.boolean(),
  can_view_finances: z.boolean(), can_add_finances: z.boolean(), can_edit_finances: z.boolean(), can_remove_finances: z.boolean(),
  can_view_contacts: z.boolean(), can_add_contacts: z.boolean(), can_edit_contacts: z.boolean(), can_remove_contacts: z.boolean(),
  can_view_employees: z.boolean(), can_add_employees: z.boolean(), can_edit_employees: z.boolean(), can_remove_employees: z.boolean(),
  can_view_calendar: z.boolean(), can_add_calendar: z.boolean(), can_edit_calendar: z.boolean(), can_remove_calendar: z.boolean(),
});

const router = Router();

// List invitations for a farm (owner only)
router.get("/farms/:farmId/invitations", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const authedMember = (req as AuthedReq).farmMember;
    if (authedMember?.role !== "owner") {
      return res.status(403).json({ error: "forbidden", message: "Only farm owners can view invitations" });
    }
    const { farmId } = req.params as { farmId: string };
    const invitations = await db.select().from(farmInvitationsTable)
      .where(eq(farmInvitationsTable.farmId, farmId))
      .orderBy(farmInvitationsTable.createdAt);
    return res.json(invitations);
  } catch (err) {
    return res.status(500).json({ error: "internal" });
  }
});

// Create an invitation (owner only)
router.post("/farms/:farmId/invitations", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const authedMember = (req as AuthedReq).farmMember;
    if (authedMember?.role !== "owner") {
      return res.status(403).json({ error: "forbidden", message: "Only farm owners can create invitations" });
    }
    const { farmId } = req.params as { farmId: string };
    const userId = (req as AuthedReq).userId;
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["owner", "worker"]).default("worker"),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user is already a member
    const profile = await db.select({ id: profilesTable.id }).from(profilesTable)
      .where(eq(profilesTable.email, normalizedEmail)).limit(1);
    if (profile[0]) {
      const existing = await db.select().from(farmMembersTable)
        .where(and(eq(farmMembersTable.farmId, farmId), eq(farmMembersTable.userId, profile[0].id)))
        .limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "conflict", message: "User is already a member of this farm" });
      }
    }

    const [invitation] = await db.insert(farmInvitationsTable).values({
      farmId,
      invitedEmail: normalizedEmail,
      invitedByUserId: userId,
      role,
    }).onConflictDoUpdate({
      target: [farmInvitationsTable.farmId, farmInvitationsTable.invitedEmail],
      set: { role, status: "pending" },
    }).returning();

    return res.status(201).json(invitation);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "validation", message: err.message });
    }
    return res.status(500).json({ error: "internal", message: String(err) });
  }
});

// Update permissions on a pending invitation (owner only)
router.put("/farms/:farmId/invitations/:invitationId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const authedMember = (req as AuthedReq).farmMember;
    if (authedMember?.role !== "owner") {
      return res.status(403).json({ error: "forbidden", message: "Only farm owners can update invitations" });
    }
    const { farmId, invitationId } = req.params as { farmId: string; invitationId: string };
    const { permissions } = z.object({ permissions: permissionsSchema }).parse(req.body);

    const [updated] = await db.update(farmInvitationsTable)
      .set({ permissions })
      .where(and(
        eq(farmInvitationsTable.id, invitationId),
        eq(farmInvitationsTable.farmId, farmId),
        eq(farmInvitationsTable.status, "pending")
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "Pending invitation not found" });
    }
    return res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "validation", message: err.message });
    }
    return res.status(500).json({ error: "internal" });
  }
});

// Delete / revoke an invitation (owner only)
router.delete("/farms/:farmId/invitations/:invitationId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const authedMember = (req as AuthedReq).farmMember;
    if (authedMember?.role !== "owner") {
      return res.status(403).json({ error: "forbidden", message: "Only farm owners can revoke invitations" });
    }
    const { farmId, invitationId } = req.params as { farmId: string; invitationId: string };
    await db.delete(farmInvitationsTable)
      .where(and(
        eq(farmInvitationsTable.id, invitationId),
        eq(farmInvitationsTable.farmId, farmId)
      ));
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
