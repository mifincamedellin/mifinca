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
  animalsTable: { id: "animalsTable" },
  weightRecordsTable: { id: "weightRecordsTable" },
  medicalRecordsTable: { id: "medicalRecordsTable" },
  farmMembersTable: { id: "farmMembersTable" },
  activityLogTable: { id: "activityLogTable" },
  milkRecordsTable: { id: "milkRecordsTable" },
  profilesTable: { id: "profilesTable" },
  farmEventsTable: { id: "farmEventsTable" },
  animalLifecycleEventsTable: { id: "animalLifecycleEventsTable" },
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

vi.mock("../lib/plans.js", () => ({
  getPlanLimits: () => ({ animals: null, farms: null, employees: null, contacts: null }),
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
    ilike: () => ({}),
    gte: () => ({}),
    lte: () => ({}),
    count: () => ({}),
    isNull: () => ({}),
  };
});

async function buildApp() {
  const { default: animalsRouter } = await import("../routes/animals.js");
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
  app.use(animalsRouter);
  return app;
}

let app: express.Express;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp();
});

const mockMilkRecord = {
  id: "milk-1",
  animalId: "animal-1",
  amountLiters: "12.5",
  recordedAt: "2024-01-15",
  session: "morning",
  notes: null,
};

describe("GET /farms/:farmId/animals/:animalId/milk", () => {
  it("returns 200 with milk records list", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockMilkRecord]));

    const res = await request(app).get("/farms/farm-1/animals/animal-1/milk");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 200 with an empty array when no records exist", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));

    const res = await request(app).get("/farms/farm-1/animals/animal-1/milk");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /farms/:farmId/animals/:animalId/milk", () => {
  it("creates a milk record and returns 201", async () => {
    mockDb.insert.mockImplementation(() => makeChain([mockMilkRecord]));

    const res = await request(app)
      .post("/farms/farm-1/animals/animal-1/milk")
      .send({ amountLiters: 12.5, recordedAt: "2024-01-15", session: "morning" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "milk-1");
    expect(res.body).toHaveProperty("amountLiters", "12.5");
  });

  it("persists notes when provided", async () => {
    const withNotes = { ...mockMilkRecord, notes: "First record of the day" };
    mockDb.insert.mockImplementation(() => makeChain([withNotes]));

    const res = await request(app)
      .post("/farms/farm-1/animals/animal-1/milk")
      .send({ amountLiters: 8, recordedAt: "2024-01-16", notes: "First record of the day" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("notes", "First record of the day");
  });

  it("calls db.insert exactly once (no extra side-effect inserts)", async () => {
    mockDb.insert.mockImplementation(() => makeChain([mockMilkRecord]));

    await request(app)
      .post("/farms/farm-1/animals/animal-1/milk")
      .send({ amountLiters: 10, recordedAt: "2024-01-15" });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /farms/:farmId/animals/:animalId/milk/:recordId", () => {
  it("updates a milk record and returns 200", async () => {
    const updated = { ...mockMilkRecord, amountLiters: "15.0" };
    mockDb.update.mockImplementation(() => makeChain([updated]));

    const res = await request(app)
      .put("/farms/farm-1/animals/animal-1/milk/milk-1")
      .send({ amountLiters: 15.0 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amountLiters", "15.0");
  });

  it("returns 404 when the record does not exist", async () => {
    mockDb.update.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .put("/farms/farm-1/animals/animal-1/milk/nonexistent")
      .send({ amountLiters: 5 });

    expect(res.status).toBe(404);
  });
});

describe("GET /farms/:farmId/milk (farm-wide report)", () => {
  it("returns 200 with empty animals list when no cattle on the farm", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));

    const res = await request(app).get("/farms/farm-1/milk");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("animals");
    expect(res.body.animals).toHaveLength(0);
    expect(res.body.summary.totalLiters).toBe(0);
  });

  it("returns 200 with animals and aggregated milk totals when records exist", async () => {
    const cattle = [{ id: "cow-1", name: "Bessie", customTag: "B01", status: "active" }];
    const records = [
      { animalId: "cow-1", amountLiters: "10.0", recordedAt: "2024-01-10" },
      { animalId: "cow-1", amountLiters: "12.0", recordedAt: "2024-01-11" },
    ];

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain(cattle);
      return makeChain(records);
    });

    const res = await request(app).get("/farms/farm-1/milk");
    expect(res.status).toBe(200);
    expect(res.body.animals).toHaveLength(1);
    expect(res.body.animals[0].totalLiters).toBe(22);
    expect(res.body.summary.totalLiters).toBe(22);
    expect(res.body.summary.totalRecords).toBe(2);
  });
});
