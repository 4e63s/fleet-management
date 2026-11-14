import { z } from "zod";
import { paginationSchema } from "../../lib/pagination";

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  licenseNumber: z.string().trim().min(3).max(40).transform((v) => v.toUpperCase()),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone number").nullable().optional()
});

export const updateDriverSchema = createDriverSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "At least one field is required"
});

export const listDriversQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(60).optional()
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;
