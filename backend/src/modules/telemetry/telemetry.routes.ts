import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { idParamSchema } from "../../lib/pagination";
import { authenticate, deviceAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  healthIngestSchema,
  historyQuerySchema,
  positionIngestSchema,
  type HealthIngest,
  type HistoryQuery,
  type PositionIngest
} from "./telemetry.schemas";
import type { TelemetryService } from "./telemetry.service";

interface Options {
  jwtSecret: string;
  deviceKey: string;
}

export function createTelemetryRouter(service: TelemetryService, { jwtSecret, deviceKey }: Options) {
  const router = Router();
  const user = authenticate(jwtSecret);

  // --- device ingest (x-device-key) ---
  router.post(
    "/position",
    deviceAuth(deviceKey),
    validate({ body: positionIngestSchema }),
    asyncHandler(async (req, res) => {
      const row = await service.ingestPosition(req.body as PositionIngest);
      res.status(201).json(row);
    })
  );

  router.post(
    "/health",
    deviceAuth(deviceKey),
    validate({ body: healthIngestSchema }),
    asyncHandler(async (req, res) => {
      const row = await service.ingestHealth(req.body as HealthIngest);
      res.status(201).json(row);
    })
  );

  // --- dashboard reads (JWT) ---
  router.get(
    "/live",
    user,
    asyncHandler(async (_req, res) => {
      res.json(await service.livePositions());
    })
  );

  router.get(
    "/health/overview",
    user,
    asyncHandler(async (_req, res) => {
      res.json(await service.healthOverview());
    })
  );

  router.get(
    "/vehicles/:id/positions",
    user,
    validate({ params: idParamSchema, query: historyQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.positionHistory(req.params.id, req.query as unknown as HistoryQuery));
    })
  );

  router.get(
    "/vehicles/:id/health",
    user,
    validate({ params: idParamSchema, query: historyQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.healthHistory(req.params.id, req.query as unknown as HistoryQuery));
    })
  );

  router.get(
    "/vehicles/:id/health/latest",
    user,
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.latestHealth(req.params.id));
    })
  );

  return router;
}
