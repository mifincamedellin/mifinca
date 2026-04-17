import { Router, Request } from "express";
import { db } from "@workspace/db";
import { employeesTable, farmMembersTable, farmsTable, employeeAttachmentsTable, activityLogTable, profilesTable } from "@workspace/db";
import { eq, and, lt, sql, count } from "drizzle-orm";
import { getPlanLimits } from "../lib/plans.js";
import { requireAuth, requireFarmAccess, requirePerm } from "../middleware/auth.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();

const router = Router();
type AuthedReq = Request & { userId: string; farmMember?: typeof farmMembersTable.$inferSelect };

router.get("/farms/:farmId/employees", requireAuth, requireFarmAccess, requirePerm("can_view_employees"), async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const employees = await db.select().from(employeesTable)
      .where(eq(employeesTable.farmId, farmId))
      .orderBy(employeesTable.name);
    return res.json(employees);
  } catch (err) {
    req.log.error({ err }, "List employees error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/employees", requireAuth, requireFarmAccess, requirePerm("can_add_employees"), async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { name, phone, email, startDate, monthlySalary, bankName, bankAccount, notes,
            pension, salud, arl, primas, cesantias, photoUrl } = req.body;
    const userId = (req as AuthedReq).userId;

    const [profile] = await db.select({ plan: profilesTable.plan, clerkId: profilesTable.clerkId }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    const isDemo = profile?.clerkId?.startsWith("demo:");
    const limits = getPlanLimits(profile?.plan);
    if (!isDemo && limits.employees !== null) {
      const [{ count: empCount }] = await db.select({ count: count() }).from(employeesTable).where(eq(employeesTable.farmId, farmId));
      if (empCount >= limits.employees) {
        return res.status(403).json({ error: "plan_limit", resource: "employees", limit: limits.employees });
      }
    }

    const employee = await db.insert(employeesTable).values({
      farmId,
      name,
      phone: phone || null,
      email: email || null,
      startDate: startDate || null,
      monthlySalary: monthlySalary ? String(monthlySalary) : "0",
      bankName: bankName || "Bancolombia",
      bankAccount: bankAccount || null,
      notes: notes || null,
      pension: pension ? String(pension) : "0",
      salud: salud ? String(salud) : "0",
      arl: arl ? String(arl) : "0",
      primas: primas ? String(primas) : "0",
      cesantias: cesantias ? String(cesantias) : "0",
      photoUrl: photoUrl || null,
    }).returning();

    await db.insert(activityLogTable).values({
      farmId, userId,
      actionType: "created",
      entityType: "employee",
      entityId: employee[0]!.id,
      description: `Added employee: ${name}`,
    });

    return res.status(201).json(employee[0]);
  } catch (err) {
    req.log.error({ err }, "Create employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.put("/farms/:farmId/employees/:employeeId", requireAuth, requireFarmAccess, requirePerm("can_edit_employees"), async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    const userId = (req as AuthedReq).userId;
    const { name, phone, email, startDate, monthlySalary, bankName, bankAccount, notes,
            pension, salud, arl, primas, cesantias, photoUrl } = req.body;
    const updated = await db.update(employeesTable).set({
      name,
      phone: phone || null,
      email: email || null,
      startDate: startDate || null,
      monthlySalary: monthlySalary ? String(monthlySalary) : "0",
      bankName: bankName || "Bancolombia",
      bankAccount: bankAccount || null,
      notes: notes || null,
      pension: pension ? String(pension) : "0",
      salud: salud ? String(salud) : "0",
      arl: arl ? String(arl) : "0",
      primas: primas ? String(primas) : "0",
      cesantias: cesantias ? String(cesantias) : "0",
      photoUrl: photoUrl !== undefined ? (photoUrl || null) : undefined,
      updatedAt: new Date(),
    }).where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId))).returning();
    if (!updated[0]) return res.status(404).json({ error: "not_found" });

    await db.insert(activityLogTable).values({
      farmId, userId,
      actionType: "updated",
      entityType: "employee",
      entityId: employeeId,
      description: `Updated employee: ${name}`,
    });

    return res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/employees/:employeeId", requireAuth, requireFarmAccess, requirePerm("can_remove_employees"), async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    const userId = (req as AuthedReq).userId;

    const [emp] = await db.select().from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId)))
      .limit(1);

    await db.delete(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId)));

    if (emp) {
      await db.insert(activityLogTable).values({
        farmId, userId,
        actionType: "deleted",
        entityType: "employee",
        entityId: employeeId,
        description: `Removed employee: ${emp.name}`,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete employee error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/pay-day", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId } = req.params as { farmId: string };
    const { payDay } = req.body as { payDay: number };
    if (!payDay || payDay < 1 || payDay > 31) return res.status(400).json({ error: "invalid_day" });
    await db.update(farmsTable).set({ payDay, updatedAt: new Date() }).where(eq(farmsTable.id, farmId));
    return res.json({ ok: true, payDay });
  } catch (err) {
    req.log.error({ err }, "Update pay day error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/employees/:employeeId/attachments/:attachmentId/file", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId, attachmentId } = req.params as { farmId: string; employeeId: string; attachmentId: string };
    const [att] = await db.select().from(employeeAttachmentsTable)
      .where(and(
        eq(employeeAttachmentsTable.id, attachmentId),
        eq(employeeAttachmentsTable.employeeId, employeeId),
        eq(employeeAttachmentsTable.farmId, farmId),
        eq(employeeAttachmentsTable.confirmed, true),
      ));
    if (!att) return res.status(404).json({ error: "attachment_not_found" });
    const objectFile = await objectStorageService.getObjectEntityFile(att.fileKey);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    // Override Content-Type with DB-validated value (prevents GCS header spoofing / XSS)
    const safeName = att.originalName.replace(/[^\w.\-]/g, "_");
    res.setHeader("Content-Type", att.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Forward other headers (Content-Length, ETag, etc.) but skip content-type
    response.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() !== "content-type") res.setHeader(key, value);
    });
    if (response.body) {
      const { Readable } = await import("stream");
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return res.status(404).json({ error: "file_not_found" });
    req.log.error({ err }, "Serve attachment file error");
    return res.status(500).json({ error: "internal" });
  }
});

router.get("/farms/:farmId/employees/:employeeId/attachments", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    const attachments = await db.select().from(employeeAttachmentsTable)
      .where(and(
        eq(employeeAttachmentsTable.farmId, farmId),
        eq(employeeAttachmentsTable.employeeId, employeeId),
        eq(employeeAttachmentsTable.confirmed, true),
      ))
      .orderBy(employeeAttachmentsTable.createdAt);

    // Fire-and-forget: prune unconfirmed rows older than 1 hour (failed/cancelled uploads)
    // Also delete their corresponding storage objects to avoid GCS accumulation
    (async () => {
      try {
        const stale = await db.select({ id: employeeAttachmentsTable.id, fileKey: employeeAttachmentsTable.fileKey })
          .from(employeeAttachmentsTable)
          .where(and(
            eq(employeeAttachmentsTable.confirmed, false),
            lt(employeeAttachmentsTable.createdAt, sql`NOW() - INTERVAL '1 hour'`),
          ));
        if (stale.length === 0) return;
        await db.delete(employeeAttachmentsTable)
          .where(and(
            eq(employeeAttachmentsTable.confirmed, false),
            lt(employeeAttachmentsTable.createdAt, sql`NOW() - INTERVAL '1 hour'`),
          ));
        for (const row of stale) {
          objectStorageService.deleteObjectEntity(row.fileKey).catch(() => {});
        }
      } catch {
        // Best-effort cleanup — do not throw
      }
    })();

    return res.json(attachments);
  } catch (err) {
    req.log.error({ err }, "List employee attachments error");
    return res.status(500).json({ error: "internal" });
  }
});

router.post("/farms/:farmId/employees/:employeeId/attachments", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId } = req.params as { farmId: string; employeeId: string };
    const { originalName, mimeType, sizeBytes } = req.body as {
      originalName: string; mimeType?: string; sizeBytes?: number;
    };
    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    const MAX_SIZE = 20 * 1024 * 1024;
    if (!originalName) return res.status(400).json({ error: "originalName is required" });
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({ error: "unsupported_mime_type" });
    }
    if (sizeBytes && sizeBytes > MAX_SIZE) return res.status(400).json({ error: "file_too_large" });
    const employee = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.farmId, farmId)));
    if (!employee[0]) return res.status(404).json({ error: "employee_not_found" });
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const fileKey = objectStorageService.normalizeObjectEntityPath(uploadURL);
    const [attachment] = await db.insert(employeeAttachmentsTable).values({
      employeeId,
      farmId,
      fileKey,
      originalName,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: sizeBytes || 0,
    }).returning();
    return res.status(201).json({ attachment, uploadURL });
  } catch (err) {
    req.log.error({ err }, "Create employee attachment error");
    return res.status(500).json({ error: "internal" });
  }
});

router.patch("/farms/:farmId/employees/:employeeId/attachments/:attachmentId/confirm", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId, attachmentId } = req.params as { farmId: string; employeeId: string; attachmentId: string };
    const [att] = await db.update(employeeAttachmentsTable)
      .set({ confirmed: true })
      .where(and(
        eq(employeeAttachmentsTable.id, attachmentId),
        eq(employeeAttachmentsTable.employeeId, employeeId),
        eq(employeeAttachmentsTable.farmId, farmId),
      ))
      .returning();
    if (!att) return res.status(404).json({ error: "attachment_not_found" });
    return res.json(att);
  } catch (err) {
    req.log.error({ err }, "Confirm attachment error");
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/farms/:farmId/employees/:employeeId/attachments/:attachmentId", requireAuth, requireFarmAccess, async (req, res) => {
  try {
    const { farmId, employeeId, attachmentId } = req.params as { farmId: string; employeeId: string; attachmentId: string };
    const [att] = await db.select({ fileKey: employeeAttachmentsTable.fileKey })
      .from(employeeAttachmentsTable)
      .where(and(
        eq(employeeAttachmentsTable.id, attachmentId),
        eq(employeeAttachmentsTable.employeeId, employeeId),
        eq(employeeAttachmentsTable.farmId, farmId),
      ));
    if (!att) return res.status(404).json({ error: "attachment_not_found" });
    // DB-first: if DB delete fails we never touch storage (no stale rows);
    // if storage cleanup fails after DB delete we get an orphaned GCS object (harmless, invisible to users)
    await db.delete(employeeAttachmentsTable)
      .where(and(
        eq(employeeAttachmentsTable.id, attachmentId),
        eq(employeeAttachmentsTable.employeeId, employeeId),
        eq(employeeAttachmentsTable.farmId, farmId),
      ));
    objectStorageService.deleteObjectEntity(att.fileKey).catch((err) => {
      req.log.warn({ err, fileKey: att.fileKey }, "Storage object cleanup failed after DB delete");
    });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete employee attachment error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
