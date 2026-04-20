import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "@workspace/db";
import {
  profilesTable,
  farmsTable,
  farmMembersTable,
  animalsTable,
  financeTransactionsTable,
  licenseKeysTable,
} from "@workspace/db";
import { eq, desc, ilike, or, sql, count, sum, and, asc, isNull } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function getAdminSecret(): string | undefined {
  return process.env["ADMIN_SECRET"];
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return res.status(503).json({ error: "server_misconfigured", message: "ADMIN_SECRET not set" });
  }
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid admin secret" });
  }
  return next();
}

router.post("/admin/verify", (req: Request, res: Response) => {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return res.status(503).json({ error: "server_misconfigured" });
  }
  const { secret } = req.body as { secret?: string };
  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.json({ ok: true });
});

router.get("/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [userCount] = await db
      .select({ count: count() })
      .from(profilesTable)
      .where(sql`(${profilesTable.clerkId} IS NULL OR ${profilesTable.clerkId} NOT LIKE 'demo:%')`);

    const [farmCount] = await db.select({ count: count() }).from(farmsTable);

    const [animalCount] = await db
      .select({ count: count() })
      .from(animalsTable)
      .where(eq(animalsTable.status, "active"));

    const planBreakdown = await db
      .select({ plan: profilesTable.plan, count: count() })
      .from(profilesTable)
      .where(sql`(${profilesTable.clerkId} IS NULL OR ${profilesTable.clerkId} NOT LIKE 'demo:%')`)
      .groupBy(profilesTable.plan);

    const signupsByDay = await pool.query<{ day: string; count: string }>(`
      SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS count
      FROM profiles
      WHERE (clerk_id IS NULL OR clerk_id NOT LIKE 'demo:%')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    return res.json({
      users: Number(userCount?.count ?? 0),
      farms: Number(farmCount?.count ?? 0),
      animals: Number(animalCount?.count ?? 0),
      planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: Number(p.count) })),
      signupsByDay: signupsByDay.rows.map((r) => ({ day: r.day, count: Number(r.count) })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = req.query["search"] as string | undefined;
    const page = Number(req.query["page"] ?? 1);
    const sortBy = (req.query["sortBy"] as string) || "createdAt";
    const sortDir = (req.query["sortDir"] as string) || "desc";
    const limit = 25;
    const offset = (page - 1) * limit;

    const farmCountSq = db
      .select({ userId: farmMembersTable.userId, cnt: count().as("cnt") })
      .from(farmMembersTable)
      .groupBy(farmMembersTable.userId)
      .as("farm_counts");

    const noDemoFilter = sql`(${profilesTable.clerkId} IS NULL OR ${profilesTable.clerkId} NOT LIKE 'demo:%')`;
    const whereCondition = search
      ? and(
          noDemoFilter,
          or(
            ilike(profilesTable.fullName, `%${search}%`),
            ilike(profilesTable.email, `%${search}%`),
          ),
        )
      : noDemoFilter;

    const sortMap: Record<string, Parameters<typeof asc>[0]> = {
      createdAt: profilesTable.createdAt,
      fullName: profilesTable.fullName,
      email: profilesTable.email,
      plan: profilesTable.plan,
    };
    const sortCol = sortMap[sortBy] ?? profilesTable.createdAt;
    const orderFn = sortDir === "asc" ? asc : desc;

    const users = await db
      .select({
        id: profilesTable.id,
        fullName: profilesTable.fullName,
        email: profilesTable.email,
        plan: profilesTable.plan,
        role: profilesTable.role,
        clerkId: profilesTable.clerkId,
        createdAt: profilesTable.createdAt,
        farmCount: farmCountSq.cnt,
      })
      .from(profilesTable)
      .leftJoin(farmCountSq, eq(profilesTable.id, farmCountSq.userId))
      .where(whereCondition)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset);

    const [total] = await db
      .select({ count: count() })
      .from(profilesTable)
      .where(whereCondition);

    const userIds = users.map((u) => u.id);
    let lastActiveMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
      const lastActiveRows = await pool.query<{ user_id: string; last_active: string }>(
        `SELECT user_id, MAX(created_at)::text as last_active
         FROM activity_log
         WHERE user_id IN (${placeholders})
         GROUP BY user_id`,
        userIds,
      );
      lastActiveMap = Object.fromEntries(
        lastActiveRows.rows.map((r) => [r.user_id, r.last_active]),
      );
    }

    return res.json({
      users: users.map((u) => ({
        ...u,
        farmCount: Number(u.farmCount ?? 0),
        lastActive: lastActiveMap[u.id] ?? null,
      })),
      total: Number(total?.count ?? 0),
      page,
      pages: Math.ceil(Number(total?.count ?? 0) / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/admin/users/search", requireAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query["q"] as string | undefined;
    if (!q || q.length < 2) return res.json({ users: [] });

    const results = await db
      .select({
        id: profilesTable.id,
        fullName: profilesTable.fullName,
        email: profilesTable.email,
        plan: profilesTable.plan,
      })
      .from(profilesTable)
      .where(
        and(
          sql`(${profilesTable.clerkId} IS NULL OR ${profilesTable.clerkId} NOT LIKE 'demo:%')`,
          or(
            ilike(profilesTable.fullName, `%${q}%`),
            ilike(profilesTable.email, `%${q}%`),
          ),
        ),
      )
      .limit(10);

    return res.json({ users: results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/admin/users/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const profile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    if (!profile[0]) return res.status(404).json({ error: "not_found" });

    const farms = await db
      .select({
        id: farmsTable.id,
        name: farmsTable.name,
        location: farmsTable.location,
        createdAt: farmsTable.createdAt,
        memberRole: farmMembersTable.role,
      })
      .from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, userId));

    const farmsWithCounts = await Promise.all(
      farms.map(async (f) => {
        const [ac] = await db
          .select({ count: count() })
          .from(animalsTable)
          .where(and(eq(animalsTable.farmId, f.id), eq(animalsTable.status, "active")));
        return { ...f, animalCount: Number(ac?.count ?? 0) };
      }),
    );

    return res.json({ ...profile[0], farms: farmsWithCounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/admin/users/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const { fullName, email, plan } = req.body as {
      fullName?: string;
      email?: string;
      plan?: "seed" | "farm" | "pro";
    };
    const updated = await db
      .update(profilesTable)
      .set({ fullName, email, plan, updatedAt: new Date() })
      .where(eq(profilesTable.id, userId))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/admin/users/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    await pool.query("DELETE FROM activity_log WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM inventory_logs WHERE created_by = $1", [userId]);
    await pool.query("DELETE FROM medical_records WHERE created_by = $1", [userId]);
    await pool.query("DELETE FROM weight_records WHERE created_by = $1", [userId]);
    await db.delete(profilesTable).where(eq(profilesTable.id, userId));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/admin/farms", requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = req.query["search"] as string | undefined;
    const page = Number(req.query["page"] ?? 1);
    const limit = 25;
    const offset = (page - 1) * limit;

    const animalCountSq = db
      .select({ farmId: animalsTable.farmId, cnt: count().as("cnt") })
      .from(animalsTable)
      .where(eq(animalsTable.status, "active"))
      .groupBy(animalsTable.farmId)
      .as("animal_counts");

    const farms = await db
      .select({
        id: farmsTable.id,
        name: farmsTable.name,
        location: farmsTable.location,
        totalHectares: farmsTable.totalHectares,
        createdAt: farmsTable.createdAt,
        ownerName: profilesTable.fullName,
        ownerEmail: profilesTable.email,
        ownerId: profilesTable.id,
        animalCount: animalCountSq.cnt,
      })
      .from(farmsTable)
      .leftJoin(profilesTable, eq(farmsTable.ownerId, profilesTable.id))
      .leftJoin(animalCountSq, eq(farmsTable.id, animalCountSq.farmId))
      .where(search ? ilike(farmsTable.name, `%${search}%`) : undefined)
      .orderBy(desc(farmsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [total] = await db
      .select({ count: count() })
      .from(farmsTable)
      .where(search ? ilike(farmsTable.name, `%${search}%`) : undefined);

    return res.json({
      farms: farms.map((f) => ({ ...f, animalCount: Number(f.animalCount ?? 0) })),
      total: Number(total?.count ?? 0),
      page,
      pages: Math.ceil(Number(total?.count ?? 0) / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/admin/farms/:farmId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { farmId } = req.params as { farmId: string };

    const farm = await db
      .select({
        id: farmsTable.id,
        name: farmsTable.name,
        location: farmsTable.location,
        totalHectares: farmsTable.totalHectares,
        createdAt: farmsTable.createdAt,
        ownerName: profilesTable.fullName,
        ownerEmail: profilesTable.email,
        ownerId: profilesTable.id,
      })
      .from(farmsTable)
      .leftJoin(profilesTable, eq(farmsTable.ownerId, profilesTable.id))
      .where(eq(farmsTable.id, farmId))
      .limit(1);

    if (!farm[0]) return res.status(404).json({ error: "not_found" });

    const members = await db
      .select({
        userId: farmMembersTable.userId,
        role: farmMembersTable.role,
        fullName: profilesTable.fullName,
        email: profilesTable.email,
      })
      .from(farmMembersTable)
      .leftJoin(profilesTable, eq(farmMembersTable.userId, profilesTable.id))
      .where(eq(farmMembersTable.farmId, farmId));

    const animals = await db
      .select({
        id: animalsTable.id,
        customTag: animalsTable.customTag,
        name: animalsTable.name,
        species: animalsTable.species,
        breed: animalsTable.breed,
        sex: animalsTable.sex,
        status: animalsTable.status,
        lifecycleStage: animalsTable.lifecycleStage,
        currentWeightKg: animalsTable.currentWeightKg,
        dateOfBirth: animalsTable.dateOfBirth,
      })
      .from(animalsTable)
      .where(eq(animalsTable.farmId, farmId))
      .orderBy(desc(animalsTable.createdAt))
      .limit(100);

    const financeRows = await db
      .select({
        id: financeTransactionsTable.id,
        type: financeTransactionsTable.type,
        category: financeTransactionsTable.category,
        amount: financeTransactionsTable.amount,
        description: financeTransactionsTable.description,
        date: financeTransactionsTable.date,
      })
      .from(financeTransactionsTable)
      .where(eq(financeTransactionsTable.farmId, farmId))
      .orderBy(desc(financeTransactionsTable.date))
      .limit(10);

    const financeSummary = await db
      .select({
        type: financeTransactionsTable.type,
        total: sum(financeTransactionsTable.amount),
      })
      .from(financeTransactionsTable)
      .where(eq(financeTransactionsTable.farmId, farmId))
      .groupBy(financeTransactionsTable.type);

    const activityRows = await pool.query<{
      id: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      created_at: string;
      user_name: string | null;
    }>(
      `SELECT al.id, al.action_type AS action, al.entity_type, al.entity_id, al.created_at, p.full_name as user_name
       FROM activity_log al
       LEFT JOIN profiles p ON al.user_id = p.id
       WHERE al.farm_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [farmId],
    );

    return res.json({
      farm: farm[0],
      members,
      animals,
      finances: {
        recent: financeRows,
        summary: financeSummary.map((f) => ({ type: f.type, total: Number(f.total ?? 0) })),
      },
      activity: activityRows.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/admin/farms/:farmId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { name, location } = req.body as { name?: string; location?: string };
    const updated = await db
      .update(farmsTable)
      .set({ name, location, updatedAt: new Date() })
      .where(eq(farmsTable.id, farmId))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/admin/farms/:farmId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { farmId } = req.params as { farmId: string };
    await db.delete(farmsTable).where(eq(farmsTable.id, farmId));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.post(
  "/admin/farms/:farmId/members",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { farmId } = req.params as { farmId: string };
      const { userId, role } = req.body as { userId: string; role?: string };

      if (!userId) return res.status(400).json({ error: "userId required" });

      const existing = await db
        .select({ id: farmMembersTable.userId })
        .from(farmMembersTable)
        .where(and(eq(farmMembersTable.farmId, farmId), eq(farmMembersTable.userId, userId)))
        .limit(1);
      if (existing[0]) return res.status(409).json({ error: "already_member" });

      const dbRole: "owner" | "worker" = role === "owner" ? "owner" : "worker";
      await db.insert(farmMembersTable).values({
        farmId,
        userId,
        role: dbRole,
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal" });
    }
  },
);

router.delete(
  "/admin/farms/:farmId/members/:userId",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { farmId, userId } = req.params as { farmId: string; userId: string };
      await db
        .delete(farmMembersTable)
        .where(and(eq(farmMembersTable.farmId, farmId), eq(farmMembersTable.userId, userId)));
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "internal" });
    }
  },
);

router.get("/admin/activity", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query["page"] ?? 1);
    const limit = 50;
    const offset = (page - 1) * limit;
    const filterAction = req.query["action"] as string | undefined;
    const filterUser = req.query["user"] as string | undefined;
    const filterFarm = req.query["farm"] as string | undefined;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filterAction && filterAction !== "all") {
      whereClause += ` AND al.action_type ILIKE $${paramIdx}`;
      params.push(`%${filterAction}%`);
      paramIdx++;
    }
    if (filterUser) {
      whereClause += ` AND (p.full_name ILIKE $${paramIdx} OR p.email ILIKE $${paramIdx})`;
      params.push(`%${filterUser}%`);
      paramIdx++;
    }
    if (filterFarm) {
      whereClause += ` AND f.name ILIKE $${paramIdx}`;
      params.push(`%${filterFarm}%`);
      paramIdx++;
    }

    const rows = await pool.query<{
      id: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      created_at: string;
      user_name: string | null;
      farm_name: string | null;
      farm_id: string | null;
    }>(
      `SELECT al.id, al.action_type AS action, al.entity_type, al.entity_id, al.created_at,
              p.full_name as user_name, f.name as farm_name, al.farm_id
       FROM activity_log al
       LEFT JOIN profiles p ON al.user_id = p.id
       LEFT JOIN farms f ON al.farm_id = f.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity_log al
       LEFT JOIN profiles p ON al.user_id = p.id
       LEFT JOIN farms f ON al.farm_id = f.id
       ${whereClause}`,
      params,
    );

    return res.json({
      activity: rows.rows,
      total: Number(totalResult.rows[0]?.count ?? 0),
      page,
      pages: Math.ceil(Number(totalResult.rows[0]?.count ?? 0) / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

// ── License Key Admin Routes ──────────────────────────────────────────────────

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const group = () => Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join("");
  return `${group()}-${group()}-${group()}-${group()}`;
}

function licenseStatus(row: typeof licenseKeysTable.$inferSelect): "active" | "expired" | "revoked" {
  if (row.revokedAt) return "revoked";
  if (new Date(row.expiresAt) < new Date()) return "expired";
  return "active";
}

router.get("/admin/licenses", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query["page"] ?? 1);
    const statusFilter = req.query["status"] as string | undefined;
    const limit = 30;
    const offset = (page - 1) * limit;

    const allRows = await db
      .select({
        id: licenseKeysTable.id,
        key: licenseKeysTable.key,
        userId: licenseKeysTable.userId,
        expiresAt: licenseKeysTable.expiresAt,
        revokedAt: licenseKeysTable.revokedAt,
        activatedAt: licenseKeysTable.activatedAt,
        notes: licenseKeysTable.notes,
        createdBy: licenseKeysTable.createdBy,
        createdAt: licenseKeysTable.createdAt,
        ownerName: profilesTable.fullName,
        ownerEmail: profilesTable.email,
      })
      .from(licenseKeysTable)
      .leftJoin(profilesTable, eq(licenseKeysTable.userId, profilesTable.id))
      .orderBy(desc(licenseKeysTable.createdAt));

    const withStatus = allRows.map(r => ({ ...r, status: licenseStatus(r as typeof licenseKeysTable.$inferSelect) }));
    const filtered = statusFilter && statusFilter !== "all"
      ? withStatus.filter(r => r.status === statusFilter)
      : withStatus;

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return res.json({ licenses: paginated, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/admin/licenses/generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { quantity = 1, expiresAt, notes, userId } = req.body as {
      quantity?: number;
      expiresAt: string;
      notes?: string;
      userId?: string;
    };
    if (!expiresAt) return res.status(400).json({ error: "expiresAt required" });
    const qty = Math.min(Math.max(1, Number(quantity)), 50);
    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) return res.status(400).json({ error: "invalid date" });

    let resolvedUserId: string | null = null;
    if (userId) {
      const [user] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
      if (!user) return res.status(404).json({ error: "user_not_found" });
      resolvedUserId = user.id;
    }

    const now = new Date();
    // Pre-assign only the first key when multiple are generated (matches UI behaviour)
    const keys = Array.from({ length: qty }, (_, i) => ({
      key: generateLicenseKey(),
      expiresAt: expiry,
      notes: notes ?? null,
      createdBy: "admin",
      userId: i === 0 ? resolvedUserId : null,
      activatedAt: i === 0 && resolvedUserId ? now : null,
    }));

    const created = await db.insert(licenseKeysTable).values(keys).returning();
    return res.status(201).json({ keys: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/admin/licenses/:id/revoke", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(licenseKeysTable)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(licenseKeysTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/admin/licenses/:id/unrevoke", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(licenseKeysTable)
      .set({ revokedAt: null, updatedAt: new Date() })
      .where(eq(licenseKeysTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/admin/licenses/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await db.delete(licenseKeysTable).where(eq(licenseKeysTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
