import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { makeChain } from "./helpers/makeChain.js";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  financeTransactionsTable: { id: "financeTransactionsTable" },
  farmMembersTable: { id: "farmMembersTable" },
  activityLogTable: { id: "activityLogTable" },
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as Record<string, unknown>)["userId"] = "test-user-id";
    next();
  },
  requireFarmAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as Record<string, unknown>)["farmMember"] = { role: "owner", permissions: null };
    next();
  },
  requirePerm: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hasPerm: () => true,
  extractOptionalUserId: async () => "test-user-id",
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    sql: Object.assign((..._args: unknown[]) => ({}), { raw: () => ({}) }),
    eq: () => ({}),
    and: (..._args: unknown[]) => ({}),
    or: () => ({}),
    desc: () => ({}),
    asc: () => ({}),
    gte: () => ({}),
    lte: () => ({}),
  };
});

async function buildApp() {
  const { default: financesRouter } = await import("../routes/finances.js");
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res, next) => {
    (req as Record<string, unknown>)["log"] = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    };
    next();
  });
  app.use(financesRouter);
  return app;
}

let app: express.Express;

const mockTransaction = {
  id: "txn-1",
  farmId: "farm-1",
  type: "income",
  category: "milk_sales",
  amount: "500.00",
  description: "Monthly milk sale",
  date: "2024-01-15",
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp();
});

describe("GET /farms/:farmId/finances", () => {
  it("returns 200 with transaction list", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockTransaction]));

    const res = await request(app).get("/farms/farm-1/finances");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 200 with an empty array when no transactions exist", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));

    const res = await request(app).get("/farms/farm-1/finances");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filters results by type when query param is provided", async () => {
    const expense = { ...mockTransaction, id: "txn-2", type: "expense" };
    mockDb.select.mockImplementation(() => makeChain([mockTransaction, expense]));

    const res = await request(app).get("/farms/farm-1/finances?type=income");
    expect(res.status).toBe(200);
    const types = (res.body as Array<{ type: string }>).map((t) => t.type);
    expect(types.every((t) => t === "income")).toBe(true);
  });
});

describe("POST /farms/:farmId/finances", () => {
  it("creates an income transaction and returns 201", async () => {
    mockDb.insert.mockImplementation(() => makeChain([mockTransaction]));

    const res = await request(app)
      .post("/farms/farm-1/finances")
      .send({
        type: "income",
        category: "milk_sales",
        amount: 500,
        description: "Monthly milk sale",
        date: "2024-01-15",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "txn-1");
    expect(res.body).toHaveProperty("type", "income");
  });

  it("creates an expense transaction and returns 201", async () => {
    const expense = { ...mockTransaction, id: "txn-3", type: "expense", category: "feed", description: "Feed purchase" };
    mockDb.insert.mockImplementation(() => makeChain([expense]));

    const res = await request(app)
      .post("/farms/farm-1/finances")
      .send({
        type: "expense",
        category: "feed",
        amount: 200,
        description: "Feed purchase",
        date: "2024-01-16",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("type", "expense");
  });

  it("writes an activity log entry on successful creation", async () => {
    mockDb.insert.mockImplementation(() => makeChain([mockTransaction]));

    await request(app)
      .post("/farms/farm-1/finances")
      .send({
        type: "income",
        category: "milk_sales",
        amount: 500,
        description: "Monthly milk sale",
        date: "2024-01-15",
      });

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/farms/farm-1/finances")
      .send({ type: "income" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post("/farms/farm-1/finances")
      .send({ type: "income", category: "milk_sales", amount: 100, date: "2024-01-15" });

    expect(res.status).toBe(400);
  });
});

describe("PUT /farms/:farmId/finances/:id", () => {
  it("updates a transaction and returns 200", async () => {
    const updated = { ...mockTransaction, amount: "750.00", description: "Updated sale" };
    mockDb.update.mockImplementation(() => makeChain([updated]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .put("/farms/farm-1/finances/txn-1")
      .send({
        type: "income",
        category: "milk_sales",
        amount: 750,
        description: "Updated sale",
        date: "2024-01-15",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amount", "750.00");
    expect(res.body).toHaveProperty("description", "Updated sale");
  });

  it("writes an activity log entry on successful update", async () => {
    mockDb.update.mockImplementation(() => makeChain([mockTransaction]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    await request(app)
      .put("/farms/farm-1/finances/txn-1")
      .send({ type: "income", category: "milk_sales", amount: 500, description: "Sale", date: "2024-01-15" });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the transaction to update does not exist", async () => {
    mockDb.update.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .put("/farms/farm-1/finances/nonexistent")
      .send({ type: "income", category: "milk_sales", amount: 100, description: "Sale", date: "2024-01-15" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /farms/:farmId/finances/:id", () => {
  it("deletes a transaction and returns 200 with ok:true", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockTransaction]));
    mockDb.delete.mockImplementation(() => makeChain([]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    const res = await request(app).delete("/farms/farm-1/finances/txn-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("writes an activity log entry when a known transaction is deleted", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockTransaction]));
    mockDb.delete.mockImplementation(() => makeChain([]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    await request(app).delete("/farms/farm-1/finances/txn-1");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 200 ok:true even when transaction is not found (idempotent delete)", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));
    mockDb.delete.mockImplementation(() => makeChain([]));

    const res = await request(app).delete("/farms/farm-1/finances/nonexistent");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });
});
