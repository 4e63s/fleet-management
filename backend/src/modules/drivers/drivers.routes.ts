import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { idParamSchema } from "../../lib/pagination";
import { authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createDriverSchema,
  listDriversQuerySchema,
  updateDriverSchema,
  type CreateDriverInput,
  type ListDriversQuery,
  type UpdateDriverInput
} from "./drivers.schemas";
import type { DriversService } from "./drivers.service";

export function createDriversRouter(service: DriversService) {
  const router = Router();

  router.get(
    "/",
    validate({ query: listDriversQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.list(req.query as unknown as ListDriversQuery));
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
    validate({ body: createDriverSchema }),
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.create(req.body as CreateDriverInput));
    })
  );

  router.patch(
    "/:id",
    authorize("ADMIN", "MANAGER"),
    validate({ params: idParamSchema, body: updateDriverSchema }),
    asyncHandler(async (req, res) => {
      res.json(await service.update(req.params.id, req.body as UpdateDriverInput));
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
