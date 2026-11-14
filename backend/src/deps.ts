import type { PrismaClient } from "@prisma/client";
import type { Env } from "./config/env";
import type { RealtimeBus } from "./realtime/events";

export interface AppDeps {
  prisma: PrismaClient;
  bus: RealtimeBus;
  env: Env;
  /** Disable the login rate limiter (used by tests). Defaults to enabled. */
  rateLimit?: boolean;
}
