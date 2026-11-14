import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { refreshSession, tokenStore } from "../api/client";
import type { AlertItem, HealthEvent, LivePosition } from "../api/types";
import { API_URL } from "../config";

export interface AlertEventPayload {
  id: string;
  vehicleId: string;
  plate: string;
  type: string;
  severity: AlertItem["severity"];
  message: string;
  createdAt: string;
}

export interface FleetSocketState {
  connected: boolean;
  positions: Record<string, LivePosition>;
  health: Record<string, HealthEvent>;
  alerts: AlertEventPayload[];
  seedPositions(list: LivePosition[]): void;
}

const MAX_LIVE_ALERTS = 50;

/**
 * Subscribes to the fleet room. The token is read through a callback so a
 * reconnect after a refresh uses the new access token.
 */
export function useFleetSocket(): FleetSocketState {
  const [connected, setConnected] = useState(false);
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [health, setHealth] = useState<Record<string, HealthEvent>>({});
  const [alerts, setAlerts] = useState<AlertEventPayload[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ["websocket"],
      auth: (cb) => cb({ token: tokenStore.access() ?? "" })
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", async (err) => {
      setConnected(false);
      if (err.message === "UNAUTHORIZED" && (await refreshSession())) socket.connect();
    });

    socket.on("position:update", (e: LivePosition) => setPositions((prev) => ({ ...prev, [e.vehicleId]: e })));
    socket.on("health:update", (e: HealthEvent) => setHealth((prev) => ({ ...prev, [e.vehicleId]: e })));
    socket.on("alert:new", (e: AlertEventPayload) => setAlerts((prev) => [e, ...prev].slice(0, MAX_LIVE_ALERTS)));

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const seedPositions = useCallback((list: LivePosition[]) => {
    setPositions((prev) => {
      const next: Record<string, LivePosition> = {};
      for (const p of list) next[p.vehicleId] = p;
      // Anything that arrived over the socket while the REST call was in flight is newer.
      return { ...next, ...prev };
    });
  }, []);

  return { connected, positions, health, alerts, seedPositions };
}
