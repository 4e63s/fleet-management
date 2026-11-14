import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { idParamSchema, paginationSchema } from "../../lib/pagination";
import { authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import type { AlertListQuery, AlertsService } from "./alerts.service";

const listQuery = paginationSchema.extend({
  vehicleId: z.string().uuid().optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  acknowledged: z.enum(["true", "false"]).transform((v) => v === "true").optional()
});

export function createAlertsRouter(service: AlertsService) {
  const router = Router();

  router.get(
    "/",
    validate({ query: listQuery }),
    asyncHandler(async (req, res) => {
      res.json(await service.list(req.query as unknown as AlertListQuery));
    })
  );

  router.patch(
    "/:id/acknowledge",
    authorize("ADMIN", "MANAGER"),
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.acknowledge(req.params.id));
    })
  );

  return router;
}
