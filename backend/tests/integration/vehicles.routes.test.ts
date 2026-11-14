import request from "supertest";
import { m } from "../helpers/prismaMock";
import { bearer, buildTestApp, ID_A } from "../helpers/testApp";

let ctx: ReturnType<typeof buildTestApp>;
beforeEach(() => {
  ctx = buildTestApp();
});

const payload = { plate: "abc-1234", vin: "1hgcm82633a000001", make: "Toyota", model: "Hilux", year: 2022 };

describe("authentication and RBAC", () => {
  it("rejects anonymous requests", async () => {
    expect((await request(ctx.app).get("/api/vehicles")).status).toBe(401);
  });

  it("allows drivers to read but not write", async () => {
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([]);
    m(ctx.prisma.vehicle.count).mockResolvedValue(0);
    expect((await request(ctx.app).get("/api/vehicles").set(bearer("DRIVER"))).status).toBe(200);
    expect((await request(ctx.app).post("/api/vehicles").set(bearer("DRIVER")).send(payload)).status).toBe(403);
  });

  it("allows only admins to delete", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A });
    m(ctx.prisma.vehicle.delete).mockResolvedValue({});
    expect((await request(ctx.app).delete(`/api/vehicles/${ID_A}`).set(bearer("MANAGER"))).status).toBe(403);
    expect((await request(ctx.app).delete(`/api/vehicles/${ID_A}`).set(bearer("ADMIN"))).status).toBe(204);
  });
});

describe("GET /api/vehicles", () => {
  it("paginates with sensible defaults", async () => {
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([{ id: ID_A }]);
    m(ctx.prisma.vehicle.count).mockResolvedValue(1);

    const res = await request(ctx.app).get("/api/vehicles").set(bearer("MANAGER"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [{ id: ID_A }], total: 1, page: 1, pageSize: 20 });
    const args = m(ctx.prisma.vehicle.findMany).mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it("passes filters through", async () => {
    m(ctx.prisma.vehicle.findMany).mockResolvedValue([]);
    m(ctx.prisma.vehicle.count).mockResolvedValue(0);
    await request(ctx.app).get("/api/vehicles?status=ACTIVE&page=2&pageSize=5").set(bearer("MANAGER"));
    const args = m(ctx.prisma.vehicle.findMany).mock.calls[0][0];
    expect(args.where.status).toBe("ACTIVE");
    expect(args.skip).toBe(5);
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(ctx.app).get("/api/vehicles?status=FLYING").set(bearer("MANAGER"));
    expect(res.status).toBe(400);
  });

  it("caps pageSize at 100", async () => {
    const res = await request(ctx.app).get("/api/vehicles?pageSize=1000").set(bearer("MANAGER"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/vehicles", () => {
  it("normalises plate and VIN to uppercase", async () => {
    m(ctx.prisma.vehicle.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID_A, ...data }));

    const res = await request(ctx.app).post("/api/vehicles").set(bearer("MANAGER")).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.plate).toBe("ABC-1234");
    expect(res.body.vin).toBe("1HGCM82633A000001");
  });

  it("validates the VIN length", async () => {
    const res = await request(ctx.app).post("/api/vehicles").set(bearer("MANAGER")).send({ ...payload, vin: "SHORT" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.vin).toBeDefined();
  });

  it("rejects an unrealistic year", async () => {
    const res = await request(ctx.app).post("/api/vehicles").set(bearer("MANAGER")).send({ ...payload, year: 1850 });
    expect(res.status).toBe(400);
  });

  it("maps a unique-constraint violation to 409", async () => {
    m(ctx.prisma.vehicle.create).mockRejectedValue({ code: "P2002" });
    const res = await request(ctx.app).post("/api/vehicles").set(bearer("MANAGER")).send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

describe("GET/PATCH /api/vehicles/:id", () => {
  it("returns 404 for an unknown vehicle", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue(null);
    expect((await request(ctx.app).get(`/api/vehicles/${ID_A}`).set(bearer("DRIVER"))).status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    expect((await request(ctx.app).get("/api/vehicles/not-a-uuid").set(bearer("DRIVER"))).status).toBe(400);
  });

  it("updates a vehicle", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A });
    m(ctx.prisma.vehicle.update).mockResolvedValue({ id: ID_A, status: "MAINTENANCE" });
    const res = await request(ctx.app).patch(`/api/vehicles/${ID_A}`).set(bearer("MANAGER")).send({ status: "MAINTENANCE" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("MAINTENANCE");
  });

  it("rejects an empty patch", async () => {
    const res = await request(ctx.app).patch(`/api/vehicles/${ID_A}`).set(bearer("MANAGER")).send({});
    expect(res.status).toBe(400);
  });

  it("allows unassigning the driver with null", async () => {
    m(ctx.prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A });
    m(ctx.prisma.vehicle.update).mockResolvedValue({ id: ID_A, driverId: null });
    const res = await request(ctx.app).patch(`/api/vehicles/${ID_A}`).set(bearer("MANAGER")).send({ driverId: null });
    expect(res.status).toBe(200);
    expect(m(ctx.prisma.vehicle.update).mock.calls[0][0].data).toEqual({ driverId: null });
  });
});
