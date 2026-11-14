import type { Role } from "@prisma/client";
import type { Env } from "../../src/config/env";
import { createApp } from "../../src/app";
import { signAccessToken } from "../../src/lib/tokens";
import type { RealtimeBus } from "../../src/realtime/events";
import { createPrismaMock } from "./prismaMock";

export const ID_A = "11111111-1111-4111-8111-111111111111";
export const ID_B = "22222222-2222-4222-8222-222222222222";

export const testEnv: Env = {
  NODE_ENV: "test",
  PORT: 0,
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret-1234",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 7,
  DEVICE_API_KEY: "device-key-1234",
  CORS_ORIGIN: "http://localhost:5173"
};

export function tokenFor(role: Role, userId: string = ID_A): string {
  return signAccessToken({ sub: userId, role }, testEnv.JWT_ACCESS_SECRET, "15m");
}

export const bearer = (role: Role) => ({ Authorization: `Bearer ${tokenFor(role)}` });

export function makeBus(): jest.Mocked<RealtimeBus> {
  return { emitPosition: jest.fn(), emitHealth: jest.fn(), emitAlert: jest.fn() };
}

export function buildTestApp() {
  const prisma = createPrismaMock();
  const bus = makeBus();
  const app = createApp({ prisma, bus, env: testEnv, rateLimit: false });
  return { app, prisma, bus };
}
