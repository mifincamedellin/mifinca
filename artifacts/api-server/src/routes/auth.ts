import { Router } from "express";
import { db, pool } from "@workspace/db";
import { profilesTable, farmsTable, farmMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] || "finca-secret-key";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  farmName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

router.post("/auth/register", async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const { email, password, fullName, farmName } = parsed;

    await ensureAuthTable();

    const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "conflict", message: "Email already registered" });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)",
      [id, email, passwordHash]
    );

    await db.insert(profilesTable).values({
      id,
      fullName,
      role: "owner",
      preferredLanguage: "es",
    });

    const farm = await db.insert(farmsTable).values({
      ownerId: id,
      name: farmName,
    }).returning();

    await db.insert(farmMembersTable).values({
      farmId: farm[0]!.id,
      userId: id,
      role: "owner",
      permissions: { can_edit: true, can_add_animals: true, can_log_inventory: true },
    });

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({
      token,
      user: { id, email, fullName, role: "owner" },
      defaultFarmId: farm[0]!.id,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Register error");
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "validation", message: err.message });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "internal", message });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const { email, password } = parsed;

    await ensureAuthTable();

    const result = await pool.query(
      "SELECT id, email, password_hash FROM auth_users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    }

    const user = result.rows[0] as { id: string; email: string; password_hash: string };
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    }

    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, user.id)).limit(1);

    const farms = await db.select({ id: farmsTable.id }).from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, user.id))
      .limit(1);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      user: { id: user.id, email: user.email, fullName: profile[0]?.fullName, role: profile[0]?.role },
      defaultFarmId: farms[0]?.id ?? null,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Login error");
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "validation", message: err.message });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "internal", message });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "No token" });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, payload.userId)).limit(1);
    if (!profile[0]) {
      return res.status(404).json({ error: "not_found", message: "Profile not found" });
    }

    const authUser = await pool.query<{ email: string }>(
      "SELECT email FROM auth_users WHERE id = $1",
      [payload.userId]
    );

    return res.json({
      id: profile[0].id,
      fullName: profile[0].fullName,
      role: profile[0].role,
      preferredLanguage: profile[0].preferredLanguage,
      createdAt: profile[0].createdAt,
      email: authUser.rows[0]?.email ?? null,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Auth me error");
    return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
});

router.patch("/auth/email", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "No token" });
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "bad_request", message: "Invalid email" });
    }

    const existing = await pool.query("SELECT id FROM auth_users WHERE email = $1 AND id != $2", [email, payload.userId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "conflict", message: "Email already in use" });
    }

    await pool.query("UPDATE auth_users SET email = $1 WHERE id = $2", [email, payload.userId]);
    return res.json({ email });
  } catch (err: unknown) {
    req.log.error({ err }, "Update email error");
    return res.status(500).json({ error: "internal", message: "Update failed" });
  }
});

router.put("/auth/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "No token" });
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const { fullName, preferredLanguage } = req.body;
    const updated = await db.update(profilesTable)
      .set({ fullName, preferredLanguage, updatedAt: new Date() })
      .where(eq(profilesTable.id, payload.userId))
      .returning();

    return res.json(updated[0]);
  } catch (err: unknown) {
    req.log.error({ err }, "Update profile error");
    return res.status(500).json({ error: "internal", message: "Update failed" });
  }
});

export default router;
