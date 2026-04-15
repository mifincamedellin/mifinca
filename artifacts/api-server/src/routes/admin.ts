import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "@workspace/db";
import {
  profilesTable,
  farmsTable,
  farmMembersTable,
  animalsTable,
  financeTransactionsTable,
} from "@workspace/db";
import { eq, desc, ilike, or, sql, count, sum, and } from "drizzle-orm";

const router = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"] || "mifinca-admin-2025";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid admin secret" });
  }
  return next();
}

router.post("/admin/verify", (req: Request, res: Response) => {
  const { secret } = req.body as { secret?: string };
  if (!secret || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.json({ ok: true });
});

router.get("/admin/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [userCount] = await db
      .select({ count: count() })
      .from(profilesTable)
      .where(sql`${profilesTable.clerkId} NOT LIKE 'demo:%'`);

    const [farmCount] = await db
      .select({ count: count() })
      .from(farmsTable);

    const [animalCount] = await db
      .select({ count: count() })
      .from(animalsTable)
      .where(eq(animalsTable.status, "active"));

    const planBreakdown = await db
      .select({ plan: profilesTable.plan, count: count() })
      .from(profilesTable)
      .where(sql`${profilesTable.clerkId} NOT LIKE 'demo:%'`)
      .groupBy(profilesTable.plan);

    const signupsByDay = await pool.query<{ day: string; count: string }>(`
      SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS count
      FROM profiles
      WHERE clerk_id NOT LIKE 'demo:%'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    return res.json({
      users: Number(userCount?.count ?? 0),
      farms: Number(farmCount?.count ?? 0),
      animals: Number(animalCount?.count ?? 0),
      planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: Number(p.count) })),
      signupsByDay: signupsByDay.rows.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
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
    const limit = 25;
    const offset = (page - 1) * limit;

    const farmCountSq = db
      .select({ userId: farmMembersTable.userId, cnt: count().as("cnt") })
      .from(farmMembersTable)
      .groupBy(farmMembersTable.userId)
      .as("farm_counts");

    const query = db
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
      .where(
        search
          ? or(
              ilike(profilesTable.fullName, `%${search}%`),
              ilike(profilesTable.email, `%${search}%`),
            )
          : sql`${profilesTable.clerkId} NOT LIKE 'demo:%'`,
      )
      .orderBy(desc(profilesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const users = await query;

    const [total] = await db
      .select({ count: count() })
      .from(profilesTable)
      .where(
        search
          ? or(
              ilike(profilesTable.fullName, `%${search}%`),
              ilike(profilesTable.email, `%${search}%`),
            )
          : sql`${profilesTable.clerkId} NOT LIKE 'demo:%'`,
      );

    return res.json({
      users: users.map((u) => ({ ...u, farmCount: Number(u.farmCount ?? 0) })),
      total: Number(total?.count ?? 0),
      page,
      pages: Math.ceil(Number(total?.count ?? 0) / limit),
    });
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
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at, p.full_name as user_name
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
        summary: financeSummary.map((f) => ({
          type: f.type,
          total: Number(f.total ?? 0),
        })),
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
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/admin/farms/:farmId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { farmId } = req.params as { farmId: string };
    await db.delete(farmsTable).where(eq(farmsTable.id, farmId));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "internal" });
  }
});

router.delete(
  "/admin/farms/:farmId/members/:userId",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { farmId, userId } = req.params as { farmId: string; userId: string };
      await db
        .delete(farmMembersTable)
        .where(
          and(eq(farmMembersTable.farmId, farmId), eq(farmMembersTable.userId, userId)),
        );
      return res.json({ ok: true });
    } catch (err) {
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
      whereClause += ` AND al.action ILIKE $${paramIdx}`;
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
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at,
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

export default router;
