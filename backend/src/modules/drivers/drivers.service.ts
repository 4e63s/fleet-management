import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { toSkipTake } from "../../lib/pagination";
import type { CreateDriverInput, ListDriversQuery, UpdateDriverInput } from "./drivers.schemas";

export function createDriversService(prisma: PrismaClient) {
  return {
    async list(q: ListDriversQuery) {
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { licenseNumber: { contains: q.search, mode: "insensitive" as const } }
            ]
          }
        : {};
      const [items, total] = await Promise.all([
        prisma.driver.findMany({
          where,
          orderBy: { name: "asc" },
          include: { vehicles: { select: { id: true, plate: true } } },
          ...toSkipTake(q)
        }),
        prisma.driver.count({ where })
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    },

    async get(id: string) {
      const driver = await prisma.driver.findUnique({ where: { id }, include: { vehicles: true } });
      if (!driver) throw AppError.notFound("Driver not found");
      return driver;
    },

    create(input: CreateDriverInput) {
      return prisma.driver.create({ data: input });
    },

    async update(id: string, input: UpdateDriverInput) {
      const existing = await prisma.driver.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Driver not found");
      return prisma.driver.update({ where: { id }, data: input });
    },

    async remove(id: string) {
      const existing = await prisma.driver.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Driver not found");
      await prisma.driver.delete({ where: { id } });
    }
  };
}

export type DriversService = ReturnType<typeof createDriversService>;
