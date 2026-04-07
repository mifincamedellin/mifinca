import { Router } from "express";
import * as oidcClient from "openid-client";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { profilesTable, farmsTable, farmMembersTable, farmInvitationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] || "finca-secret-key";
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";

const pendingStates = new Map<string, { createdAt: number }>();

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}, 60_000);

let oidcConfig: oidcClient.Configuration | null = null;
async function getConfig() {
  if (!oidcConfig) {
    oidcConfig = await oidcClient.discovery(
      new URL("https://accounts.google.com"),
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    );
  }
  return oidcConfig;
}

function getCallbackBase(req: any): string {
  const host =
    (Array.isArray(req.headers["x-forwarded-host"])
      ? req.headers["x-forwarded-host"][0]
      : req.headers["x-forwarded-host"]) ||
    req.headers["host"] ||
    "localhost:8080";
  const proto =
    (Array.isArray(req.headers["x-forwarded-proto"])
      ? req.headers["x-forwarded-proto"][0]
      : req.headers["x-forwarded-proto"]) || "https";
  return `${proto}://${host}`;
}

router.get("/auth/google/start", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect("/app/login?error=google_not_configured");
  }
  try {
    const config = await getConfig();
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, { createdAt: Date.now() });

    const base = getCallbackBase(req);
    const callbackUrl = `${base}/api/auth/google/callback`;

    const authUrl = new URL(config.serverMetadata().authorization_endpoint!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline");

    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    return res.redirect(authUrl.toString());
  } catch (err: any) {
    console.error("Google start error:", err);
    return res.redirect("/app/login?error=oauth_start_failed");
  }
});

router.get("/auth/google/callback", async (req, res) => {
  try {
    const query = req.query as Record<string, string>;
    const { code, state, error } = query;

    if (error) {
      return res.redirect(`/app/login?error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect("/app/login?error=missing_params");
    }

    const cookieState = (req as any).cookies?.oauth_state;
    if (!cookieState || state !== cookieState) {
      return res.redirect("/app/login?error=state_mismatch");
    }

    const pending = pendingStates.get(state);
    if (!pending) {
      return res.redirect("/app/login?error=state_expired");
    }
    pendingStates.delete(state);
    res.clearCookie("oauth_state");

    const config = await getConfig();
    const base = getCallbackBase(req);
    const callbackUrl = `${base}/api/auth/google/callback`;

    const fullCallbackUrl = new URL(callbackUrl);
    for (const [k, v] of Object.entries(query)) {
      fullCallbackUrl.searchParams.set(k, v);
    }

    const tokens = await oidcClient.authorizationCodeGrant(
      config,
      fullCallbackUrl,
      { expectedState: state },
    );

    const claims = tokens.claims();
    if (!claims) throw new Error("No claims in token");

    const googleId = String(claims.sub);
    const email = String(claims.email ?? "");
    const firstName = String(claims.given_name ?? "");
    const lastName = String(claims.family_name ?? "");
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      String(claims.name ?? "") ||
      email;

    let profile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, `google:${googleId}`))
      .limit(1);

    if (profile.length === 0 && email) {
      profile = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.email, email))
        .limit(1);
    }

    if (profile.length === 0) {
      const id = crypto.randomUUID();
      await db.insert(profilesTable).values({
        id,
        clerkId: `google:${googleId}`,
        email,
        fullName,
        role: "owner",
        preferredLanguage: "es",
      });
      profile = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id))
        .limit(1);
    } else if (profile[0]!.clerkId !== `google:${googleId}`) {
      await db
        .update(profilesTable)
        .set({ clerkId: `google:${googleId}`, updatedAt: new Date() })
        .where(eq(profilesTable.id, profile[0]!.id));
    }

    const profileId = profile[0]!.id;

    let farm = await db
      .select({ id: farmsTable.id })
      .from(farmMembersTable)
      .innerJoin(farmsTable, eq(farmMembersTable.farmId, farmsTable.id))
      .where(eq(farmMembersTable.userId, profileId))
      .limit(1);

    if (farm.length === 0) {
      const invitation = await db
        .select()
        .from(farmInvitationsTable)
        .where(
          and(
            eq(farmInvitationsTable.invitedEmail, email.toLowerCase()),
            eq(farmInvitationsTable.status, "pending"),
          ),
        )
        .limit(1);

      if (invitation.length > 0) {
        await db.insert(farmMembersTable).values({
          farmId: invitation[0]!.farmId,
          userId: profileId,
          role: invitation[0]!.role ?? "worker",
          permissions: { can_edit: false, can_add_animals: true, can_log_inventory: true },
        });
        await db
          .update(farmInvitationsTable)
          .set({ status: "accepted" })
          .where(eq(farmInvitationsTable.id, invitation[0]!.id));
        farm = [{ id: invitation[0]!.farmId }];
      } else {
        const [newFarm] = await db
          .insert(farmsTable)
          .values({ ownerId: profileId, name: `Finca de ${fullName.split(" ")[0]}` })
          .returning();
        await db.insert(farmMembersTable).values({
          farmId: newFarm!.id,
          userId: profileId,
          role: "owner",
          permissions: { can_edit: true, can_add_animals: true, can_log_inventory: true },
        });
        farm = [{ id: newFarm!.id }];
      }
    }

    const token = jwt.sign({ userId: profileId }, JWT_SECRET, { expiresIn: "7d" });

    return res.redirect(
      `/app/dashboard?_auth_token=${encodeURIComponent(token)}&_farm_id=${encodeURIComponent(farm[0]!.id)}`,
    );
  } catch (err: any) {
    console.error("Google callback error:", err);
    return res.redirect(`/app/login?error=${encodeURIComponent("auth_failed")}`);
  }
});

export default router;
