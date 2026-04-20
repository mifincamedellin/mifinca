import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { farmMembersTable, profilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { FarmPermissions } from "@workspace/db";

export type AuthedReq = Request & {
  userId?: string;
  farmMember?: typeof farmMembersTable.$inferSelect;
};

const JWT_SECRET = process.env["SESSION_SECRET"] || "finca-secret-key";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Try Clerk session (cookie-based, for Google sign-in users)
  const auth = getAuth(req);
  if (auth?.userId) {
    const profile = await db.select().from(profilesTable)
      .where(eq(profilesTable.clerkId, auth.userId))
      .limit(1);
    if (profile[0]) {
      (req as Request & { userId: string }).userId = profile[0].id;
      return next();
    }
    // Clerk user exists but profile not synced yet
    return res.status(401).json({ error: "profile_not_synced", message: "Call /api/auth/clerk-sync first" });
  }

  // 2. Fallback: Bearer JWT (for demo user)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      (req as Request & { userId: string }).userId = payload.userId;
      return next();
    } catch {
      return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
    }
  }

  return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
}

export async function requireFarmAccess(req: AuthedReq, res: Response, next: NextFunction) {
  const farmId = req.params["farmId"];
  const userId = req.userId;
  if (!farmId || !userId) {
    return res.status(401).json({ error: "unauthorized", message: "Farm access denied" });
  }

  const member = await db.select().from(farmMembersTable)
    .where(and(eq(farmMembersTable.farmId, farmId), eq(farmMembersTable.userId, userId)))
    .limit(1);

  if (!member[0]) {
    return res.status(403).json({ error: "forbidden", message: "Not a member of this farm" });
  }

  req.farmMember = member[0];
  return next();
}

export function hasPerm(member: typeof farmMembersTable.$inferSelect | undefined | null, perm: keyof FarmPermissions): boolean {
  if (!member) return false;
  if (member.role === "owner") return true;
  const perms = member.permissions as FarmPermissions | null;
  if (!perms) return false;
  return perms[perm] === true;
}

export function requirePerm(perm: keyof FarmPermissions) {
  return (req: AuthedReq, res: Response, next: NextFunction) => {
    const member = req.farmMember;
    if (!hasPerm(member, perm)) {
      return res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
    }
    return next();
  };
}

// Extracts userId from the request if valid credentials are present; returns null
// if no credentials or invalid token. Does NOT send a 401 response — used to make
// endpoints optionally-authenticated (e.g. POST /licenses/activate).
export async function extractOptionalUserId(req: Request): Promise<string | null> {
  // Try Clerk session (cookie-based)
  const auth = getAuth(req);
  if (auth?.userId) {
    const profile = await db.select().from(profilesTable)
      .where(eq(profilesTable.clerkId, auth.userId))
      .limit(1);
    if (profile[0]) return profile[0].id;
  }
  // Try Bearer JWT (demo user / desktop app)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      return payload.userId;
    } catch {
      // Malformed token — treat as unauthenticated
    }
  }
  return null;
}
