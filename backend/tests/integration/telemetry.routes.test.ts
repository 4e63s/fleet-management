import request from "supertest";
import { m } from "../helpers/prismaMock";
import { bearer, buildTestApp, ID_A } from "../helpers/testApp";

let ctx: ReturnType<typeof buildTestApp>;
const deviceKey = { "x-device-key": "device-key-1234" };

beforeEach(() => {
  ctx = buildTestApp();
  m(ctx.prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A, plate: "ABC-1234" });
  m(ctx.prisma.positionLog.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "p1", ...data }));
  m(ctx.prisma.healthReading.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "h1", ...data }));
  m(ctx.prisma.alert.findFirst).mockResolvedValue(null);
  m(ctx.prisma.alert.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "a1",
    createdAt: new Date("2026-04-04T00:00:00Z"),
    ...data
  }));
});

describe("POST /api/telemetry/position", () => {
  const body = { vehicleId: ID_A, lat: 24.4672, lng: 39.6111, speedKph: 72, heading: 180 };

  it("requires the device key", async () => {
    expect((await request(ctx.app).post("/api/telemetry/position").send(body)).status).toBe(401);
    expect((await request(ctx.app).post("/api/telemetry/position").set("x-device-key", "wrong-key-12345").send(body)).status).toBe(401);
  });

  it("does not accept a user JWT in place of the device key", async () => {
    const res = await request(ctx.app).post("/api/telemetry/position").set(bearer("ADMIN")).send(body);
    expect(res.status).toBe(401);
  });

  it("stores the position and broadcasts it", async () => {
    const res = await request(ctx.app).post("/api/telemetry/position").set(deviceKey).send(body);
    expect(res.status).toBe(201);
    expect(ctx.bus.emitPosition).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: ID_A, plate: "ABC-1234", lat: 24.4672 }));
    expect(ctx.bus.emitAlert).not.toHaveBeenCalled();
  });

  it("raises and broadcasts a speeding alert", async () => {
    const res = await request(ctx.app).post("/api/telemetry/position").set(deviceKey).send({ ...body, speedKph: 160 });
    expect(res.status).toBe(201);
    expect(ctx.bus.emitAlert).toHaveBeenCalledWith(expect.objectContaining({ type: "SPEEDING", severity: "WARNING", plate: "ABC-1234" }));
  });

  it("validates coordinates", async () => {
    const res = await request(ctx.app).post("/api/telemetry/position").set(deviceKey).send({ ...body, lat: 123 });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown vehicle", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue(null);
    expect((await request(ctx.app).post("/api/telemetry/position").set(deviceKey).send(body)).status).toBe(404);
  });
});

describe("POST /api/telemetry/health", () => {
  const body = { vehicleId: ID_A, engineTempC: 112, fuelLevelPct: 8, batteryVoltage: 12.5, tirePressureKpa: 230, oilLifePct: 60 };

  it("stores the reading, computes the score and broadcasts alerts", async () => {
    const res = await request(ctx.app).post("/api/telemetry/health").set(deviceKey).send(body);

    expect(res.status).toBe(201);
    expect(res.body.healthScore).toBe(60);
    expect(ctx.bus.emitHealth).toHaveBeenCalledWith(expect.objectContaining({ healthScore: 60 }));
    const types = ctx.bus.emitAlert.mock.calls.map((c) => c[0].type).sort();
    expect(types).toEqual(["ENGINE_OVERHEAT", "LOW_FUEL"]);
  });

  it("rejects out-of-range values", async () => {
    const res = await request(ctx.app).post("/api/telemetry/health").set(deviceKey).send({ ...body, fuelLevelPct: 140 });
    expect(res.status).toBe(400);
  });
});

describe("dashboard reads", () => {
  it("requires a JWT for live positions", async () => {
    expect((await request(ctx.app).get("/api/telemetry/live")).status).toBe(401);
    expect((await request(ctx.app).get("/api/telemetry/live").set(deviceKey)).status).toBe(401);
  });

  it("returns live positions", async () => {
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([
      {
        id: ID_A,
        plate: "ABC-1234",
        make: "Toyota",
        model: "Hilux",
        status: "ACTIVE",
        positions: [{ lat: 1, lng: 2, speedKph: 3, heading: 4, recordedAt: new Date("2026-05-05T00:00:00Z") }]
      }
    ]);
    const res = await request(ctx.app).get("/api/telemetry/live").set(bearer("DRIVER"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        vehicleId: ID_A,
        plate: "ABC-1234",
        make: "Toyota",
        model: "Hilux",
        status: "ACTIVE",
        lat: 1,
        lng: 2,
        speedKph: 3,
        heading: 4,
        recordedAt: "2026-05-05T00:00:00.000Z"
      }
    ]);
  });

  it("returns the health overview", async () => {
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([{ id: ID_A, plate: "ABC-1234", make: "T", model: "H", status: "IDLE", healthLogs: [] }]);
    const res = await request(ctx.app).get("/api/telemetry/health/overview").set(bearer("DRIVER"));
    expect(res.status).toBe(200);
    expect(res.body[0].latest).toBeNull();
  });

  it("returns position history with a validated window", async () => {
    m(ctx.prisma.positionLog.findMany).mockResolvedValue([]);
    const ok = await request(ctx.app)
      .get(`/api/telemetry/vehicles/${ID_A}/positions?from=2026-01-01T00:00:00Z&limit=10`)
      .set(bearer("DRIVER"));
    expect(ok.status).toBe(200);
    expect(m(ctx.prisma.positionLog.findMany).mock.calls[0][0].take).toBe(10);

    const bad = await request(ctx.app).get(`/api/telemetry/vehicles/${ID_A}/positions?limit=999999`).set(bearer("DRIVER"));
    expect(bad.status).toBe(400);
  });

  it("returns 404 when no health reading exists", async () => {
    m(ctx.prisma.healthReading.findFirst).mockResolvedValue(null);
    const res = await request(ctx.app).get(`/api/telemetry/vehicles/${ID_A}/health/latest`).set(bearer("DRIVER"));
    expect(res.status).toBe(404);
  });
});
