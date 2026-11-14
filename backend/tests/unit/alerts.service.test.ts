import type { PrismaClient } from "@prisma/client";
import { ALERT_DEDUPE_WINDOW_MS, createAlertsService } from "../../src/modules/alerts/alerts.service";
import { createPrismaMock, m } from "../helpers/prismaMock";
import { ID_A, makeBus } from "../helpers/testApp";

let prisma: PrismaClient;
let bus: ReturnType<typeof makeBus>;
let service: ReturnType<typeof createAlertsService>;

beforeEach(() => {
  prisma = createPrismaMock();
  bus = makeBus();
  service = createAlertsService(prisma, bus);
});

describe("raise", () => {
  const draft = { type: "LOW_FUEL", severity: "WARNING" as const, message: "Fuel level is low: 15%" };

  it("stores the alert and emits it on the bus", async () => {
    m(prisma.alert.findFirst).mockResolvedValue(null);
    m(prisma.alert.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "alert-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      ...data
    }));

    const created = await service.raise(ID_A, "ABC-1234", [draft]);

    expect(created).toHaveLength(1);
    expect(bus.emitAlert).toHaveBeenCalledWith({
      id: "alert-1",
      vehicleId: ID_A,
      plate: "ABC-1234",
      type: "LOW_FUEL",
      severity: "WARNING",
      message: draft.message,
      createdAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("skips duplicates of unacknowledged alerts inside the window", async () => {
    m(prisma.alert.findFirst).mockResolvedValue({ id: "existing" });

    const created = await service.raise(ID_A, "ABC-1234", [draft]);

    expect(created).toEqual([]);
    expect(m(prisma.alert.create)).not.toHaveBeenCalled();
    expect(bus.emitAlert).not.toHaveBeenCalled();

    const where = m(prisma.alert.findFirst).mock.calls[0][0].where;
    expect(where).toMatchObject({ vehicleId: ID_A, type: "LOW_FUEL", acknowledged: false });
    const age = Date.now() - where.createdAt.gte.getTime();
    expect(Math.abs(age - ALERT_DEDUPE_WINDOW_MS)).toBeLessThan(2000);
  });

  it("does nothing for an empty list", async () => {
    await expect(service.raise(ID_A, "ABC-1234", [])).resolves.toEqual([]);
    expect(m(prisma.alert.findFirst)).not.toHaveBeenCalled();
  });
});

describe("list", () => {
  it("applies filters and pagination", async () => {
    m(prisma.alert.findMany).mockResolvedValue([{ id: "a" }]);
    m(prisma.alert.count).mockResolvedValue(41);

    const page = await service.list({ page: 3, pageSize: 10, severity: "CRITICAL", acknowledged: false });

    expect(page).toEqual({ items: [{ id: "a" }], total: 41, page: 3, pageSize: 10 });
    const args = m(prisma.alert.findMany).mock.calls[0][0];
    expect(args.where).toEqual({ severity: "CRITICAL", acknowledged: false });
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });
});

describe("acknowledge", () => {
  it("returns 404 for an unknown alert", async () => {
    m(prisma.alert.findUnique).mockResolvedValue(null);
    await expect(service.acknowledge(ID_A)).rejects.toMatchObject({ status: 404 });
  });

  it("marks the alert acknowledged", async () => {
    m(prisma.alert.findUnique).mockResolvedValue({ id: ID_A });
    m(prisma.alert.update).mockResolvedValue({ id: ID_A, acknowledged: true });
    await expect(service.acknowledge(ID_A)).resolves.toMatchObject({ acknowledged: true });
    expect(m(prisma.alert.update).mock.calls[0][0].data).toEqual({ acknowledged: true });
  });
});
