import { z } from "zod";
import { paginationSchema } from "../../lib/pagination";

const statusEnum = z.enum(["ACTIVE", "IDLE", "MAINTENANCE", "RETIRED"]);

export const createVehicleSchema = z.object({
  plate: z.string().trim().min(2).max(16).transform((v) => v.toUpperCase()),
  vin: z.string().trim().length(17, "VIN must be exactly 17 characters").transform((v) => v.toUpperCase()),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  status: statusEnum.optional(),
  odometerKm: z.number().int().min(0).optional(),
  driverId: z.string().uuid().nullable().optional()
});

export const updateVehicleSchema = createVehicleSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "At least one field is required"
});

export const listVehiclesQuerySchema = paginationSchema.extend({
  status: statusEnum.optional(),
  driverId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(60).optional()
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
