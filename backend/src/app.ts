import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppDeps } from "./deps";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createAlertsRouter } from "./modules/alerts/alerts.routes";
import { createAlertsService } from "./modules/alerts/alerts.service";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createAuthService } from "./modules/auth/auth.service";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes";
import { createDashboardService } from "./modules/dashboard/dashboard.service";
import { createDriversRouter } from "./modules/drivers/drivers.routes";
import { createDriversService } from "./modules/drivers/drivers.service";
import { createMaintenanceRouter } from "./modules/maintenance/maintenance.routes";
import { createMaintenanceService } from "./modules/maintenance/maintenance.service";
import { createTelemetryRouter } from "./modules/telemetry/telemetry.routes";
import { createTelemetryService } from "./modules/telemetry/telemetry.service";
import { createVehiclesRouter } from "./modules/vehicles/vehicles.routes";
import { createVehiclesService } from "./modules/vehicles/vehicles.service";

export function createApp(deps: AppDeps): Express {
  const { prisma, bus, env } = deps;
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  const loginLimiter =
    deps.rateLimit === false
      ? undefined
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          limit: 20,
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: { code: "RATE_LIMITED", message: "Too many login attempts, try again later" } }
        });

  const requireUser = authenticate(env.JWT_ACCESS_SECRET);

  const alertsService = createAlertsService(prisma, bus);
  const telemetryService = createTelemetryService(prisma, bus, alertsService);

  app.use("/api/auth", createAuthRouter(createAuthService(prisma, env), env.JWT_ACCESS_SECRET, loginLimiter));
  app.use("/api/vehicles", requireUser, createVehiclesRouter(createVehiclesService(prisma)));
  app.use("/api/drivers", requireUser, createDriversRouter(createDriversService(prisma)));
  app.use("/api/maintenance", requireUser, createMaintenanceRouter(createMaintenanceService(prisma)));
  app.use("/api/alerts", requireUser, createAlertsRouter(alertsService));
  app.use("/api/dashboard", requireUser, createDashboardRouter(createDashboardService(prisma)));
  app.use(
    "/api/telemetry",
    createTelemetryRouter(telemetryService, { jwtSecret: env.JWT_ACCESS_SECRET, deviceKey: env.DEVICE_API_KEY })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
