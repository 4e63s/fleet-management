import { z } from "zod";
import { paginationSchema } from "../../lib/pagination";

const statusEnum = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().uuid(),
  type: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  scheduledAt: z.coerce.date(),
  costCents: z.number().int().min(0).optional()
});

export const updateMaintenanceSchema = z
  .object({
    type: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000).nullable(),
    scheduledAt: z.coerce.date(),
    status: statusEnum,
    costCents: z.number().int().min(0).nullable()
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const completeMaintenanceSchema = z.object({
  costCents: z.number().int().min(0).optional()
});

export const listMaintenanceQuerySchema = paginationSchema.extend({
  vehicleId: z.string().uuid().optional(),
  status: statusEnum.optional()
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
export type CompleteMaintenanceInput = z.infer<typeof completeMaintenanceSchema>;
export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;
