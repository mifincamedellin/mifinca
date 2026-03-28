import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { farmMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env["SESSION_SECRET"] || "finca-secret-key";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as Request & { userId: string }).userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
}

export async function requireFarmAccess(req: Request & { userId?: string }, res: Response, next: NextFunction) {
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

  (req as Request & { farmMember: typeof member[0] }).farmMember = member[0];
  return next();
}
