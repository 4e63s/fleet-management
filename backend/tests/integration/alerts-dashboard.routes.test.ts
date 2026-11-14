import request from "supertest";
import { m } from "../helpers/prismaMock";
import { bearer, buildTestApp, ID_A } from "../helpers/testApp";

let ctx: ReturnType<typeof buildTestApp>;
beforeEach(() => {
  ctx = buildTestApp();
});

describe("alerts", () => {
  it("lists alerts filtered by acknowledged flag", async () => {
    m(ctx.prisma.alert.findMany).mockResolvedValue([]);
    m(ctx.prisma.alert.count).mockResolvedValue(0);
    const res = await request(ctx.app).get("/api/alerts?acknowledged=false&severity=CRITICAL").set(bearer("DRIVER"));
    expect(res.status).toBe(200);
    expect(m(ctx.prisma.alert.findMany).mock.calls[0][0].where).toEqual({ severity: "CRITICAL", acknowledged: false });
  });

  it("forbids drivers from acknowledging", async () => {
    expect((await request(ctx.app).patch(`/api/alerts/${ID_A}/acknowledge`).set(bearer("DRIVER"))).status).toBe(403);
  });

  it("acknowledges as a manager", async () => {
    m(ctx.prisma.alert.findUnique).mockResolvedValue({ id: ID_A });
    m(ctx.prisma.alert.update).mockResolvedValue({ id: ID_A, acknowledged: true });
    const res = await request(ctx.app).patch(`/api/alerts/${ID_A}/acknowledge`).set(bearer("MANAGER"));
    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
  });

  it("returns 404 for an unknown alert", async () => {
    m(ctx.prisma.alert.findUnique).mockResolvedValue(null);
    expect((await request(ctx.app).patch(`/api/alerts/${ID_A}/acknowledge`).set(bearer("MANAGER"))).status).toBe(404);
  });
});

describe("GET /api/dashboard/summary", () => {
  it("requires authentication", async () => {
    expect((await request(ctx.app).get("/api/dashboard/summary")).status).toBe(401);
  });

  it("aggregates counts and average health", async () => {
    m(ctx.prisma.vehicle.groupBy).mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 2 } },
      { status: "MAINTENANCE", _count: { _all: 1 } }
    ]);
    m(ctx.prisma.alert.count).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    m(ctx.prisma.maintenanceRecord.count).mockResolvedValue(3);
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([
      { healthLogs: [{ healthScore: 80 }] },
      { healthLogs: [{ healthScore: 60 }] },
      { healthLogs: [] }
    ]);

    const res = await request(ctx.app).get("/api/dashboard/summary").set(bearer("DRIVER"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalVehicles: 3,
      statusCounts: { ACTIVE: 2, IDLE: 0, MAINTENANCE: 1, RETIRED: 0 },
      openAlerts: 5,
      criticalAlerts: 1,
      upcomingMaintenance: 3,
      averageHealth: 70
    });
  });

  it("reports null average health when there are no readings", async () => {
    m(ctx.prisma.vehicle.groupBy).mockResolvedValue([]);
    m(ctx.prisma.alert.count).mockResolvedValue(0);
    m(ctx.prisma.maintenanceRecord.count).mockResolvedValue(0);
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([]);
    const res = await request(ctx.app).get("/api/dashboard/summary").set(bearer("ADMIN"));
    expect(res.body.averageHealth).toBeNull();
    expect(res.body.totalVehicles).toBe(0);
  });
});
