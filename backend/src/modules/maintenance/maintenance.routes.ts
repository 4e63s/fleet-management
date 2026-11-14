import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { idParamSchema } from "../../lib/pagination";
import { authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  completeMaintenanceSchema,
  createMaintenanceSchema,
  listMaintenanceQuerySchema,
  updateMaintenanceSchema,
  type CompleteMaintenanceInput,
  type CreateMaintenanceInput,
  type ListMaintenanceQuery,
  type UpdateMaintenanceInput
} from "./maintenance.schemas";
import type { MaintenanceService } from "./maintenance.service";

export function createMaintenanceRouter(service: MaintenanceService) {
  const router = Router();

  router.get(
    "/",
    validate({ query: listMaintenanceQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.list(req.query as unknown as ListMaintenanceQuery));
    })
  );

  router.get(
    "/:id",
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.get(req.params.id));
    })
  );

  router.post(
    "/",
    authorize("ADMIN", "MANAGER"),
    validate({ body: createMaintenanceSchema }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.create(req.body as CreateMaintenanceInput));
    })
  );

  router.patch(
    "/:id",
    authorize("ADMIN", "MANAGER"),
    validate({ params: idParamSchema, body: updateMaintenanceSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.update(req.params.id, req.body as UpdateMaintenanceInput));
    })
  );

  router.post(
    "/:id/complete",
    authorize("ADMIN", "MANAGER"),
    validate({ params: idParamSchema, body: completeMaintenanceSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.complete(req.params.id, req.body as CompleteMaintenanceInput));
    })
  );

  router.delete(
    "/:id",
    authorize("ADMIN"),
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      await service.remove(req.params.id);
      res.status(204).end();
    })
  );

  return router;
}
