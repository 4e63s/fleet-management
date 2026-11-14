import { z } from "zod";

export const positionIngestSchema = z.object({
  vehicleId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKph: z.number().min(0).max(400).default(0),
  heading: z.number().min(0).max(360).default(0),
  recordedAt: z.coerce.date().optional()
});

export const healthIngestSchema = z.object({
  vehicleId: z.string().uuid(),
  engineTempC: z.number().min(-40).max(200),
  fuelLevelPct: z.number().min(0).max(100),
  batteryVoltage: z.number().min(0).max(30),
  tirePressureKpa: z.number().min(0).max(600),
  oilLifePct: z.number().min(0).max(100),
  recordedAt: z.coerce.date().optional()
});

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500)
});

export type PositionIngest = z.infer<typeof positionIngestSchema>;
export type HealthIngest = z.infer<typeof healthIngestSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
