import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import type { DashboardService } from "./dashboard.service";

export function createDashboardRouter(service: DashboardService) {
  const router = Router();
  router.get(
    "/summary",
    asyncHandler(async (_req, res) => {
      res.json(await service.summary());
    })
  );
  return router;
}
