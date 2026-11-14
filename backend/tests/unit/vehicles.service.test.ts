import type { PrismaClient } from "@prisma/client";
import { createVehiclesService } from "../../src/modules/vehicles/vehicles.service";
import { createPrismaMock, m } from "../helpers/prismaMock";
import { ID_A } from "../helpers/testApp";

let prisma: PrismaClient;
let service: ReturnType<typeof createVehiclesService>;

beforeEach(() => {
  prisma = createPrismaMock();
  service = createVehiclesService(prisma);
});

describe("list", () => {
  it("builds a case-insensitive search across plate, make, model and vin", async () => {
    m(prisma.vehicle.findMany).mockResolvedValue([]);
    m(prisma.vehicle.count).mockResolvedValue(0);

    await service.list({ page: 2, pageSize: 5, search: "hilux", status: "ACTIVE" });

    const args = m(prisma.vehicle.findMany).mock.calls[0][0];
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(args.where.status).toBe("ACTIVE");
    expect(args.where.OR).toHaveLength(4);
    expect(args.where.OR[0]).toEqual({ plate: { contains: "hilux", mode: "insensitive" } });
  });

  it("returns the pagination envelope", async () => {
    m(prisma.vehicle.findMany).mockResolvedValue([{ id: ID_A }]);
    m(prisma.vehicle.count).mockResolvedValue(1);
    await expect(service.list({ page: 1, pageSize: 20 })).resolves.toEqual({ items: [{ id: ID_A }], total: 1, page: 1, pageSize: 20 });
  });
});

describe("get / update / remove", () => {
  it("get returns 404 when missing", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(service.get(ID_A)).rejects.toMatchObject({ status: 404 });
  });

  it("update returns 404 when missing and never writes", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(service.update(ID_A, { make: "Kia" })).rejects.toMatchObject({ status: 404 });
    expect(m(prisma.vehicle.update)).not.toHaveBeenCalled();
  });

  it("update writes the patch", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A });
    m(prisma.vehicle.update).mockResolvedValue({ id: ID_A, make: "Kia" });
    await service.update(ID_A, { make: "Kia" });
    expect(m(prisma.vehicle.update).mock.calls[0][0]).toEqual({ where: { id: ID_A }, data: { make: "Kia" } });
  });

  it("remove deletes an existing vehicle", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue({ id: ID_A });
    m(prisma.vehicle.delete).mockResolvedValue({});
    await service.remove(ID_A);
    expect(m(prisma.vehicle.delete)).toHaveBeenCalledWith({ where: { id: ID_A } });
  });

  it("remove returns 404 when missing", async () => {
    m(prisma.vehicle.findUnique).mockResolvedValue(null);
    await expect(service.remove(ID_A)).rejects.toMatchObject({ status: 404 });
  });
});
