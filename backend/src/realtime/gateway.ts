import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/tokens";
import type { AlertEvent, HealthEvent, PositionEvent, RealtimeBus } from "./events";

export const FLEET_ROOM = "fleet";

export interface GatewayOptions {
  jwtSecret: string;
  corsOrigin: string;
}

export interface Gateway {
  io: Server;
  bus: RealtimeBus;
  close(): Promise<void>;
}

/**
 * Socket.IO gateway. Clients must present a valid access token in the
 * handshake (`io(url, { auth: { token } })`). Every authenticated client is
 * placed in the shared "fleet" room and receives:
 *   - position:update  (PositionEvent)
 *   - health:update    (HealthEvent)
 *   - alert:new        (AlertEvent)
 */
export function createGateway(httpServer: HttpServer, options: GatewayOptions): Gateway {
  const io = new Server(httpServer, {
    cors: { origin: options.corsOrigin.split(",").map((o) => o.trim()), credentials: true }
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      const claims = verifyAccessToken(token, options.jwtSecret);
      socket.data.user = { id: claims.sub, role: claims.role as Role };
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(FLEET_ROOM);
  });

  const bus: RealtimeBus = {
    emitPosition: (e: PositionEvent) => void io.to(FLEET_ROOM).emit("position:update", e),
    emitHealth: (e: HealthEvent) => void io.to(FLEET_ROOM).emit("health:update", e),
    emitAlert: (e: AlertEvent) => void io.to(FLEET_ROOM).emit("alert:new", e)
  };

  return {
    io,
    bus,
    close: () => new Promise<void>((resolve) => io.close(() => resolve()))
  };
}
