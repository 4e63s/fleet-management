import type { PrismaClient } from "@prisma/client";
import { createMaintenanceService } from "../../src/modules/maintenance/maintenance.service";
import { createPrismaMock, m } from "../helpers/prismaMock";
import { ID_A, ID_B } from "../helpers/testApp";

let prisma: PrismaClient;
let service: ReturnType<typeof createMaintenanceService>;

beforeEach(() => {
  prisma = createPrismaMock();
  service = createMaintenanceService(prisma);
});

const record = (over: Record<string, unknown> = {}) => ({
  id: ID_A,
  vehicleId: ID_B,
  status: "SCHEDULED",
  completedAt: null,
  ...over
});

describe("create", () => {
  it("requires the vehicle to exist", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(
      service.create({ vehicleId: ID_B, type: "Oil change", scheduledAt: new Date() })
    ).rejects.toMatchObject({ status: 404 });
    expect(m(prisma.maintenanceRecord.create)).not.toHaveBeenCalled();
  });

  it("creates the record", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue({ id: ID_B });
    m(prisma.maintenanceRecord.create).mockResolvedValue({ id: ID_A });
    await expect(service.create({ vehicleId: ID_B, type: "Brake check", scheduledAt: new Date() })).resolves.toEqual({ id: ID_A });
  });
});

describe("update", () => {
  it("returns 404 when the record is missing", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(null);
    await expect(service.update(ID_A, { type: "x-check" })).rejects.toMatchObject({ status: 404 });
  });

  it("moves the vehicle into MAINTENANCE when work starts", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record());
    m(prisma.maintenanceRecord.update).mockResolvedValue(record({ status: "IN_PROGRESS" }));

    await service.update(ID_A, { status: "IN_PROGRESS" });

    expect(m(prisma.vehicle.update).mock.calls[0][0]).toEqual({ where: { id: ID_B }, data: { status: "MAINTENANCE" } });
  });

  it("returns the vehicle to IDLE when the last open job is completed", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record({ status: "IN_PROGRESS" }));
    m(prisma.maintenanceRecord.update).mockResolvedValue(record({ status: "COMPLETED" }));
    m(prisma.maintenanceRecord.count).mockResolvedValue(0);

    await service.update(ID_A, { status: "COMPLETED" });

    expect(m(prisma.maintenanceRecord.update).mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    expect(m(prisma.vehicle.updateMany).mock.calls[0][0]).toEqual({
      where: { id: ID_B, status: "MAINTENANCE" },
      data: { status: "IDLE" }
    });
  });

  it("keeps the vehicle in MAINTENANCE while other jobs are still running", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record({ status: "IN_PROGRESS" }));
    m(prisma.maintenanceRecord.update).mockResolvedValue(record({ status: "CANCELLED" }));
    m(prisma.maintenanceRecord.count).mockResolvedValue(1);

    await service.update(ID_A, { status: "CANCELLED" });

    expect(m(prisma.vehicle.updateMany)).not.toHaveBeenCalled();
  });
});

describe("complete", () => {
  it("completes a scheduled record with a cost", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record());
    m(prisma.maintenanceRecord.update).mockResolvedValue(record({ status: "COMPLETED" }));
    m(prisma.maintenanceRecord.count).mockResolvedValue(0);

    await service.complete(ID_A, { costCents: 25000 });

    const data = m(prisma.maintenanceRecord.update).mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "COMPLETED", costCents: 25000 });
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it("refuses to complete twice", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record({ status: "COMPLETED" }));
    await expect(service.complete(ID_A, {})).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to complete a cancelled record", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(record({ status: "CANCELLED" }));
    await expect(service.complete(ID_A, {})).rejects.toMatchObject({ status: 409 });
  });

  it("returns 404 for an unknown record", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(null);
    await expect(service.complete(ID_A, {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("list and remove", () => {
  it("filters by vehicle and status", async () => {
    m(prisma.maintenanceRecord.findMany).mockResolvedValue([]);
    m(prisma.maintenanceRecord.count).mockResolvedValue(0);
    await service.list({ page: 1, pageSize: 20, vehicleId: ID_B, status: "SCHEDULED" });
    expect(m(prisma.maintenanceRecord.findMany).mock.calls[0][0].where).toEqual({ vehicleId: ID_B, status: "SCHEDULED" });
  });

  it("remove returns 404 for a missing record", async () => {
    m(prisma.maintenanceRecord.findUnique).mockResolvedValue(null);
    await expect(service.remove(ID_A)).rejects.toMatchObject({ status: 404 });
  });
});
