import type { PrismaClient } from "@prisma/client";
import type { AlertsService } from "../../src/modules/alerts/alerts.service";
import { createTelemetryService } from "../../src/modules/telemetry/telemetry.service";
import { createPrismaMock, m } from "../helpers/prismaMock";
import { ID_A, makeBus } from "../helpers/testApp";

let prisma: PrismaClient;
let bus: ReturnType<typeof makeBus>;
let alerts: { raise: jest.Mock };
let service: ReturnType<typeof createTelemetryService>;

beforeEach(() => {
  prisma = createPrismaMock();
  bus = makeBus();
  alerts = { raise: jest.fn().mockResolvedValue([]) };
  service = createTelemetryService(prisma, bus, alerts as unknown as AlertsService);
  m(prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A, plate: "ABC-1234" });
});

const echoCreate = () =>
  async ({ data }: { data: Record<string, unknown> }) => ({ id: "row-1", ...data });

describe("ingestPosition", () => {
  it("returns 404 for an unknown vehicle", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(service.ingestPosition({ vehicleId: ID_A, lat: 1, lng: 2, speedKph: 0, heading: 0 })).rejects.toMatchObject({
      status: 404
    });
    expect(m(prisma.positionLog.create)).not.toHaveBeenCalled();
  });

  it("stores the position and broadcasts it", async () => {
    m(prisma.positionLog.create).mockImplementation(echoCreate());
    const when = new Date("2026-02-02T10:00:00Z");

    await service.ingestPosition({ vehicleId: ID_A, lat: 24.47, lng: 39.61, speedKph: 80, heading: 90, recordedAt: when });

    expect(bus.emitPosition).toHaveBeenCalledWith({
      vehicleId: ID_A,
      plate: "ABC-1234",
      lat: 24.47,
      lng: 39.61,
      speedKph: 80,
      heading: 90,
      recordedAt: when.toISOString()
    });
    expect(alerts.raise).not.toHaveBeenCalled();
  });

  it("raises a speeding alert above the limit", async () => {
    m(prisma.positionLog.create).mockImplementation(echoCreate());

    await service.ingestPosition({ vehicleId: ID_A, lat: 24, lng: 39, speedKph: 155, heading: 0 });

    expect(alerts.raise).toHaveBeenCalledTimes(1);
    const [vehicleId, plate, drafts] = alerts.raise.mock.calls[0];
    expect(vehicleId).toBe(ID_A);
    expect(plate).toBe("ABC-1234");
    expect(drafts[0]).toMatchObject({ type: "SPEEDING" });
  });
});

describe("ingestHealth", () => {
  const healthy = { vehicleId: ID_A, engineTempC: 90, fuelLevelPct: 60, batteryVoltage: 12.6, tirePressureKpa: 230, oilLifePct: 70 };

  it("stores a perfect score and raises no alerts for a healthy vehicle", async () => {
    m(prisma.healthReading.create).mockImplementation(echoCreate());

    await service.ingestHealth(healthy);

    expect(m(prisma.healthReading.create).mock.calls[0][0].data.healthScore).toBe(100);
    expect(alerts.raise).toHaveBeenCalledWith(ID_A, "ABC-1234", []);
    expect(bus.emitHealth).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: ID_A, healthScore: 100 }));
  });

  it("scores and alerts when the engine overheats", async () => {
    m(prisma.healthReading.create).mockImplementation(echoCreate());

    await service.ingestHealth({ ...healthy, engineTempC: 118 });

    expect(m(prisma.healthReading.create).mock.calls[0][0].data.healthScore).toBe(70);
    const drafts = alerts.raise.mock.calls[0][2];
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ type: "ENGINE_OVERHEAT", severity: "CRITICAL" });
  });

  it("returns 404 for an unknown vehicle", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(service.ingestHealth(healthy)).rejects.toMatchObject({ status: 404 });
  });
});

describe("livePositions", () => {
  it("maps the latest position per vehicle and skips vehicles with none", async () => {
    m(prisma.vehicle.findMany).mockResolvedValue([
      {
        id: ID_A,
        plate: "ABC-1234",
        make: "Toyota",
        model: "Hilux",
        status: "ACTIVE",
        positions: [{ lat: 1, lng: 2, speedKph: 30, heading: 10, recordedAt: new Date("2026-03-03T00:00:00Z") }]
      },
      { id: "other", plate: "NEW-0001", make: "Ford", model: "Transit", status: "IDLE", positions: [] }
    ]);

    const live = await service.livePositions();

    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ vehicleId: ID_A, lat: 1, lng: 2, recordedAt: "2026-03-03T00:00:00.000Z" });
    expect(m(prisma.vehicle.findMany).mock.calls[0][0].where).toEqual({ status: { not: "RETIRED" } });
  });
});

describe("history and latest", () => {
  it("applies the time window and limit to position history", async () => {
    m(prisma.positionLog.findMany).mockResolvedValue([]);
    const from = new Date("2026-01-01");
    const to = new Date("2026-01-02");

    await service.positionHistory(ID_A, { from, to, limit: 50 });

    const args = m(prisma.positionLog.findMany).mock.calls[0][0];
    expect(args.where).toEqual({ vehicleId: ID_A, recordedAt: { gte: from, lte: to } });
    expect(args.take).toBe(50);
  });

  it("omits the time filter when no window is given", async () => {
    m(prisma.healthReading.findMany).mockResolvedValue([]);
    await service.healthHistory(ID_A, { limit: 10 });
    expect(m(prisma.healthReading.findMany).mock.calls[0][0].where).toEqual({ vehicleId: ID_A });
  });

  it("latestHealth returns 404 when nothing was recorded", async () => {
    m(prisma.healthReading.findFirst).mockResolvedValue(null);
    await expect(service.latestHealth(ID_A)).rejects.toMatchObject({ status: 404 });
  });

  it("healthOverview returns null for vehicles without readings", async () => {
    m(prisma.vehicle.findMany).mockResolvedValue([
      { id: ID_A, plate: "A", make: "m", model: "x", status: "IDLE", healthLogs: [] }
    ]);
    const overview = await service.healthOverview();
    expect(overview[0].latest).toBeNull();
  });
});
