import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { toSkipTake } from "../../lib/pagination";
import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from "./vehicles.schemas";

export function createVehiclesService(prisma: PrismaClient) {
  return {
    async list(q: ListVehiclesQuery) {
      const where = {
        ...(q.status ? { status: q.status } : {}),
        ...(q.driverId ? { driverId: q.driverId } : {}),
        ...(q.search
          ? {
              OR: [
                { plate: { contains: q.search, mode: "insensitive" as const } },
                { make: { contains: q.search, mode: "insensitive" as const } },
                { model: { contains: q.search, mode: "insensitive" as const } },
                { vin: { contains: q.search, mode: "insensitive" as const } }
              ]
            }
          : {})
      };
      const [items, total] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { driver: { select: { id: true, name: true } } },
          ...toSkipTake(q)
        }),
        prisma.vehicle.count({ where })
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    },

    async get(id: string) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: { driver: true }
      });
      if (!vehicle) throw AppError.notFound("Vehicle not found");
      return vehicle;
    },

    create(input: CreateVehicleInput) {
      return prisma.vehicle.create({ data: input });
    },

    async update(id: string, input: UpdateVehicleInput) {
      const existing = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Vehicle not found");
      return prisma.vehicle.update({ where: { id }, data: input });
    },

    async remove(id: string) {
      const existing = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Vehicle not found");
      await prisma.vehicle.delete({ where: { id } });
    }
  };
}

export type VehiclesService = ReturnType<typeof createVehiclesService>;
