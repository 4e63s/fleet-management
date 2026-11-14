import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { idParamSchema } from "../../lib/pagination";
import { authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  updateVehicleSchema,
  type CreateVehicleInput,
  type ListVehiclesQuery,
  type UpdateVehicleInput
} from "./vehicles.schemas";
import type { VehiclesService } from "./vehicles.service";

export function createVehiclesRouter(service: VehiclesService) {
  const router = Router();

  router.get(
    "/",
    validate({ query: listVehiclesQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.list(req.query as unknown as ListVehiclesQuery));
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
    validate({ body: createVehicleSchema }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.create(req.body as CreateVehicleInput));
    })
  );

  router.patch(
    "/:id",
    authorize("ADMIN", "MANAGER"),
    validate({ params: idParamSchema, body: updateVehicleSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.update(req.params.id, req.body as UpdateVehicleInput));
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
