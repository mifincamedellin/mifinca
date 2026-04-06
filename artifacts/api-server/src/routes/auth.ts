import { Router } from "express";
import { db, pool } from "@workspace/db";
import { profilesTable, farmsTable, farmMembersTable, farmInvitationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getAuth, clerkClient } from "@clerk/express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] || "finca-secret-key";

async function ensureAuthTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

// ── Demo login (kept for demo mode only) ────────────────────────────────────
router.post("/auth/demo", async (req, res) => {
  try {
    await ensureAuthTable();
    const result = await pool.query(
      "SELECT id FROM auth_users WHERE email = $1",
      ["demo@fincacolombia.com"]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "not_found", message: "Demo user not found" });
    }
    const user = result.rows[0] as { id: string };
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const farms = await db.select({ id: farmsTable.id }).from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, user.id))
      .limit(1);
    return res.json({ token, defaultFarmId: farms[0]?.id ?? null });
  } catch (err) {
    req.log.error({ err }, "Demo login error");
    return res.status(500).json({ error: "internal" });
  }
});

// ── Legacy email/password login (only for demo fallback) ─────────────────────
router.post("/auth/login", async (req, res) => {
  try {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    await ensureAuthTable();
    const result = await pool.query(
      "SELECT id, email, password_hash FROM auth_users WHERE email = $1",
      [parsed.email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    }
    const user = result.rows[0] as { id: string; email: string; password_hash: string };
    const valid = await bcrypt.compare(parsed.password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });

    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, user.id)).limit(1);
    const farms = await db.select({ id: farmsTable.id }).from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, user.id)).limit(1);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      token,
      user: { id: user.id, email: user.email, fullName: profile[0]?.fullName, role: profile[0]?.role },
      defaultFarmId: farms[0]?.id ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "internal" });
  }
});

// ── Clerk sync — call once after Google sign-in ──────────────────────────────
// Creates a profile for new Clerk users, checks invitations, returns farmId
router.post("/auth/clerk-sync", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "unauthorized", message: "No Clerk session" });
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;

    // Check if profile already exists
    let profile = await db.select().from(profilesTable)
      .where(eq(profilesTable.clerkId, auth.userId))
      .limit(1);

    if (profile.length === 0) {
      // New user — create profile
      const id = crypto.randomUUID();
      await db.insert(profilesTable).values({
        id,
        clerkId: auth.userId,
        email,
        fullName,
        role: "owner",
        preferredLanguage: "es",
      });
      profile = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, auth.userId)).limit(1);
    }

    const profileId = profile[0]!.id;

    // Check existing farm membership
    const existingFarm = await db.select({ id: farmsTable.id }).from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, profileId))
      .limit(1);

    if (existingFarm.length > 0) {
      return res.json({ defaultFarmId: existingFarm[0]!.id, profile: profile[0] });
    }

    // Check for pending invitation by email
    const invitation = await db.select().from(farmInvitationsTable)
      .where(and(
        eq(farmInvitationsTable.invitedEmail, email.toLowerCase()),
        eq(farmInvitationsTable.status, "pending")
      ))
      .limit(1);

    if (invitation.length > 0) {
      // Accept the invitation — add to the farm
      await db.insert(farmMembersTable).values({
        farmId: invitation[0]!.farmId,
        userId: profileId,
        role: invitation[0]!.role ?? "worker",
        permissions: { can_edit: false, can_add_animals: true, can_log_inventory: true },
      });
      await db.update(farmInvitationsTable)
        .set({ status: "accepted" })
        .where(eq(farmInvitationsTable.id, invitation[0]!.id));
      return res.json({ defaultFarmId: invitation[0]!.farmId, profile: profile[0] });
    }

    // No invitation — create a new farm for this user
    const [newFarm] = await db.insert(farmsTable).values({
      ownerId: profileId,
      name: `Finca de ${fullName.split(" ")[0]}`,
    }).returning();

    await db.insert(farmMembersTable).values({
      farmId: newFarm!.id,
      userId: profileId,
      role: "owner",
      permissions: { can_edit: true, can_add_animals: true, can_log_inventory: true },
    });

    return res.json({ defaultFarmId: newFarm!.id, profile: profile[0] });
  } catch (err) {
    req.log.error({ err }, "Clerk sync error");
    return res.status(500).json({ error: "internal", message: String(err) });
  }
});

// ── Current user profile ─────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    if (!profile[0]) return res.status(404).json({ error: "not_found" });

    let email = profile[0].email;
    // Fallback to auth_users table for legacy/demo users
    if (!email) {
      try {
        const authUser = await pool.query<{ email: string }>(
          "SELECT email FROM auth_users WHERE id = $1", [userId]
        );
        email = authUser.rows[0]?.email ?? null;
      } catch { /* table may not exist */ }
    }

    return res.json({ ...profile[0], email });
  } catch (err) {
    req.log.error({ err }, "Auth me error");
    return res.status(401).json({ error: "unauthorized" });
  }
});

router.patch("/auth/email", requireAuth, async (req, res) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "bad_request" });
    }
    await db.update(profilesTable).set({ email, updatedAt: new Date() }).where(eq(profilesTable.id, userId));
    return res.json({ email });
  } catch (err) {
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/auth/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { fullName, preferredLanguage } = req.body;
    const updated = await db.update(profilesTable)
      .set({ fullName, preferredLanguage, updatedAt: new Date() })
      .where(eq(profilesTable.id, userId))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
