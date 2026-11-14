import type { MaintenanceStatus, Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { toSkipTake } from "../../lib/pagination";
import type {
  CompleteMaintenanceInput,
  CreateMaintenanceInput,
  ListMaintenanceQuery,
  UpdateMaintenanceInput
} from "./maintenance.schemas";

type Tx = Prisma.TransactionClient;

/** A vehicle in the workshop is MAINTENANCE; when the work ends it returns to IDLE. */
async function syncVehicleStatus(tx: Tx, vehicleId: string, status: MaintenanceStatus) {
  if (status === "IN_PROGRESS") {
    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
    return;
  }
  if (status === "COMPLETED" || status === "CANCELLED") {
    const stillOpen = await tx.maintenanceRecord.count({ where: { vehicleId, status: "IN_PROGRESS" } });
    if (stillOpen === 0) {
      await tx.vehicle.updateMany({ where: { id: vehicleId, status: "MAINTENANCE" }, data: { status: "IDLE" } });
    }
  }
}

export function createMaintenanceService(prisma: PrismaClient) {
  return {
    async list(q: ListMaintenanceQuery) {
      const where = {
        ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
        ...(q.status ? { status: q.status } : {})
      };
      const [items, total] = await Promise.all([
        prisma.maintenanceRecord.findMany({
          where,
          orderBy: { scheduledAt: "asc" },
          include: { vehicle: { select: { plate: true } } },
          ...toSkipTake(q)
        }),
        prisma.maintenanceRecord.count({ where })
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    },

    async get(id: string) {
      const record = await prisma.maintenanceRecord.findUnique({ where: { id }, include: { vehicle: true } });
      if (!record) throw AppError.notFound("Maintenance record not found");
      return record;
    },

    async create(input: CreateMaintenanceInput) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId }, select: { id: true } });
      if (!vehicle) throw AppError.notFound("Vehicle not found");
      return prisma.maintenanceRecord.create({ data: input });
    },

    async update(id: string, input: UpdateMaintenanceInput) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.maintenanceRecord.findUnique({ where: { id } });
        if (!existing) throw AppError.notFound("Maintenance record not found");

        const data: Prisma.MaintenanceRecordUpdateInput = { ...input };
        if (input.status === "COMPLETED" && !existing.completedAt) data.completedAt = new Date();

        const updated = await tx.maintenanceRecord.update({ where: { id }, data });
        if (input.status) await syncVehicleStatus(tx, existing.vehicleId, input.status);
        return updated;
      });
    },

    async complete(id: string, input: CompleteMaintenanceInput) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.maintenanceRecord.findUnique({ where: { id } });
        if (!existing) throw AppError.notFound("Maintenance record not found");
        if (existing.status === "COMPLETED") throw AppError.conflict("Maintenance record is already completed");
        if (existing.status === "CANCELLED") throw AppError.conflict("A cancelled record cannot be completed");

        const updated = await tx.maintenanceRecord.update({
          where: { id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            ...(input.costCents !== undefined ? { costCents: input.costCents } : {})
          }
        });
        await syncVehicleStatus(tx, existing.vehicleId, "COMPLETED");
        return updated;
      });
    },

    async remove(id: string) {
      const existing = await prisma.maintenanceRecord.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Maintenance record not found");
      await prisma.maintenanceRecord.delete({ where: { id } });
    }
  };
}

export type MaintenanceService = ReturnType<typeof createMaintenanceService>;
