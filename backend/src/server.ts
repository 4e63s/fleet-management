import http from "http";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { getPrisma } from "./lib/prisma";
import { createGateway } from "./realtime/gateway";

async function main() {
  const env = loadEnv();
  const prisma = getPrisma();

  const httpServer = http.createServer();
  const gateway = createGateway(httpServer, { jwtSecret: env.JWT_ACCESS_SECRET, corsOrigin: env.CORS_ORIGIN });
  const app = createApp({ prisma, bus: gateway.bus, env });
  httpServer.on("request", app);

  await prisma.$connect();
  httpServer.listen(env.PORT, () => {
    console.log(`Fleet API listening on :${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down`);
    await gateway.close();
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
