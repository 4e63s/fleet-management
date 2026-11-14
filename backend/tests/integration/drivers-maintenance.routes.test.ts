import request from "supertest";
import { m } from "../helpers/prismaMock";
import { bearer, buildTestApp, ID_A, ID_B } from "../helpers/testApp";

let ctx: ReturnType<typeof buildTestApp>;
beforeEach(() => {
  ctx = buildTestApp();
});

describe("drivers", () => {
  const payload = { name: "Omar Al-Harbi", licenseNumber: "lic-1001", phone: "+966 500 000 001" };

  it("creates a driver with an uppercased licence number", async () => {
    m(ctx.prisma.driver.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID_A, ...data }));
    const res = await request(ctx.app).post("/api/drivers").set(bearer("MANAGER")).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.licenseNumber).toBe("LIC-1001");
  });

  it("rejects an invalid phone number", async () => {
    const res = await request(ctx.app).post("/api/drivers").set(bearer("MANAGER")).send({ ...payload, phone: "abc" });
    expect(res.status).toBe(400);
  });

  it("forbids drivers from creating drivers", async () => {
    expect((await request(ctx.app).post("/api/drivers").set(bearer("DRIVER")).send(payload)).status).toBe(403);
  });

  it("lists with a search filter", async () => {
    m(ctx.prisma.driver.findMany).mockResolvedValue([]);
    m(ctx.prisma.driver.count).mockResolvedValue(0);
    const res = await request(ctx.app).get("/api/drivers?search=omar").set(bearer("DRIVER"));
    expect(res.status).toBe(200);
    expect(m(ctx.prisma.driver.findMany).mock.calls[0][0].where.OR).toHaveLength(2);
  });

  it("returns 404 when a driver does not exist", async () => {
    m(ctx.prisma.driver.findUnique).mockResolvedValue(null);
    expect((await request(ctx.app).get(`/api/drivers/${ID_A}`).set(bearer("DRIVER"))).status).toBe(404);
  });

  it("deletes as admin only", async () => {
    m(ctx.prisma.driver.findUnique).mockResolvedValue({ id: ID_A });
    m(ctx.prisma.driver.delete).mockResolvedValue({});
    expect((await request(ctx.app).delete(`/api/drivers/${ID_A}`).set(bearer("MANAGER"))).status).toBe(403);
    expect((await request(ctx.app).delete(`/api/drivers/${ID_A}`).set(bearer("ADMIN"))).status).toBe(204);
  });
});

describe("maintenance", () => {
  const payload = { vehicleId: ID_B, type: "Oil change", scheduledAt: "2026-12-01T09:00:00.000Z" };

  it("schedules maintenance for an existing vehicle", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue({ id: ID_B });
    m(ctx.prisma.maintenanceRecord.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID_A, ...data }));
    const res = await request(ctx.app).post("/api/maintenance").set(bearer("MANAGER")).send(payload);
    expect(res.status).toBe(201);
    expect(m(ctx.prisma.maintenanceRecord.create).mock.calls[0][0].data.scheduledAt).toBeInstanceOf(Date);
  });

  it("returns 404 when the vehicle does not exist", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue(null);
    expect((await request(ctx.app).post("/api/maintenance").set(bearer("MANAGER")).send(payload)).status).toBe(404);
  });

  it("rejects an invalid date", async () => {
    const res = await request(ctx.app).post("/api/maintenance").set(bearer("MANAGER")).send({ ...payload, scheduledAt: "tomorrow-ish" });
    expect(res.status).toBe(400);
  });

  it("completes a record", async () => {
    m(ctx.prisma.maintenanceRecord.findUnique).mockResolvedValue({ id: ID_A, vehicleId: ID_B, status: "IN_PROGRESS" });
    m(ctx.prisma.maintenanceRecord.update).mockResolvedValue({ id: ID_A, status: "COMPLETED" });
    m(ctx.prisma.maintenanceRecord.count).mockResolvedValue(0);
    const res = await request(ctx.app).post(`/api/maintenance/${ID_A}/complete`).set(bearer("MANAGER")).send({ costCents: 12000 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
  });

  it("returns 409 when completing twice", async () => {
    m(ctx.prisma.maintenanceRecord.findUnique).mockResolvedValue({ id: ID_A, vehicleId: ID_B, status: "COMPLETED" });
    const res = await request(ctx.app).post(`/api/maintenance/${ID_A}/complete`).set(bearer("MANAGER")).send({});
    expect(res.status).toBe(409);
  });
});
