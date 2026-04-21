import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { makeChain } from "./helpers/makeChain.js";

const mockAnimal = {
  id: "animal-1",
  farmId: "farm-1",
  name: "Bessie",
  species: "cattle",
  status: "active",
  breed: "Holstein",
  customTag: "B01",
  currentWeightKg: null,
  motherId: null,
  fatherId: null,
  createdAt: new Date().toISOString(),
};

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockGetPlanLimits = vi.hoisted(() =>
  vi.fn(() => ({ animals: null as number | null, farms: null, employees: null, contacts: null }))
);

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
  getPlanLimits: mockGetPlanLimits,
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
  mockGetPlanLimits.mockReturnValue({ animals: null, farms: null, employees: null, contacts: null });
  app = await buildApp();
});

describe("GET /farms/:farmId/animals", () => {
  it("returns 200 with an empty array when no animals exist", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));

    const res = await request(app).get("/farms/farm-1/animals");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 200 with animals list", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([mockAnimal]);
      return makeChain([]);
    });

    const res = await request(app).get("/farms/farm-1/animals");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /farms/:farmId/animals", () => {
  it("creates an animal and returns 201", async () => {
    mockDb.select.mockImplementation(() =>
      makeChain([{ plan: "pro", clerkId: "clerk-abc" }])
    );
    mockDb.insert.mockImplementation(() => makeChain([mockAnimal]));

    const res = await request(app)
      .post("/farms/farm-1/animals")
      .send({ name: "Bessie", species: "cattle", status: "active" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "animal-1");
  });

  it("writes an activity log entry on successful creation", async () => {
    mockDb.select.mockImplementation(() =>
      makeChain([{ plan: "pro", clerkId: "clerk-abc" }])
    );
    mockDb.insert.mockImplementation(() => makeChain([mockAnimal]));

    await request(app)
      .post("/farms/farm-1/animals")
      .send({ name: "Bessie", species: "cattle", status: "active" });

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("returns 201 for demo users (bypasses plan limit check)", async () => {
    mockGetPlanLimits.mockReturnValue({ animals: 10, farms: null, employees: null, contacts: null });
    mockDb.select.mockImplementation(() =>
      makeChain([{ plan: "seed", clerkId: "demo:user-1" }])
    );
    mockDb.insert.mockImplementation(() => makeChain([mockAnimal]));

    const res = await request(app)
      .post("/farms/farm-1/animals")
      .send({ name: "Daisy", species: "cattle" });

    expect(res.status).toBe(201);
  });

  it("returns 403 when plan animal limit is reached", async () => {
    mockGetPlanLimits.mockReturnValue({ animals: 10, farms: null, employees: null, contacts: null });

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ plan: "seed", clerkId: "clerk-real" }]);
      return makeChain([{ count: 10 }]);
    });

    const res = await request(app)
      .post("/farms/farm-1/animals")
      .send({ name: "Moo", species: "cattle" });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "plan_limit");
  });
});

describe("GET /farms/:farmId/animals/:animalId", () => {
  it("returns 404 when animal does not exist", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));

    const res = await request(app).get("/farms/farm-1/animals/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "not_found");
  });

  it("returns 200 with full animal data when found", async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([mockAnimal]);
      return makeChain([]);
    });

    const res = await request(app).get("/farms/farm-1/animals/animal-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "animal-1");
  });
});

describe("PUT /farms/:farmId/animals/:animalId", () => {
  it("updates an animal and returns 200 with the updated record", async () => {
    const updated = { ...mockAnimal, name: "Bessie Updated" };
    mockDb.update.mockImplementation(() => makeChain([updated]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    const res = await request(app)
      .put("/farms/farm-1/animals/animal-1")
      .send({ name: "Bessie Updated" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Bessie Updated");
  });

  it("writes an activity log entry on successful update", async () => {
    mockDb.update.mockImplementation(() => makeChain([mockAnimal]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    await request(app)
      .put("/farms/farm-1/animals/animal-1")
      .send({ name: "Bessie" });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

describe("DELETE /farms/:farmId/animals/:animalId", () => {
  it("deletes an animal and returns 200 with ok:true", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockAnimal]));
    mockDb.delete.mockImplementation(() => makeChain([]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    const res = await request(app).delete("/farms/farm-1/animals/animal-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("writes an activity log entry when a known animal is deleted", async () => {
    mockDb.select.mockImplementation(() => makeChain([mockAnimal]));
    mockDb.delete.mockImplementation(() => makeChain([]));
    mockDb.insert.mockImplementation(() => makeChain([]));

    await request(app).delete("/farms/farm-1/animals/animal-1");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when animal does not exist (idempotent delete)", async () => {
    mockDb.select.mockImplementation(() => makeChain([]));
    mockDb.delete.mockImplementation(() => makeChain([]));

    const res = await request(app).delete("/farms/farm-1/animals/nonexistent");
    expect(res.status).toBe(200);
  });
});
