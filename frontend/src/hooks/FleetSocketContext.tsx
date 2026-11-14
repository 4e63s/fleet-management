import { createContext, useContext, type ReactNode } from "react";
import { useFleetSocket, type FleetSocketState } from "./useFleetSocket";

const FleetSocketContext = createContext<FleetSocketState | null>(null);

/** One shared socket for the whole signed-in app, so navigating keeps the stream alive. */
export function FleetSocketProvider({ children }: { children: ReactNode }) {
  const state = useFleetSocket();
  return <FleetSocketContext.Provider value={state}>{children}</FleetSocketContext.Provider>;
}

export function useFleet(): FleetSocketState {
  const ctx = useContext(FleetSocketContext);
  if (!ctx) throw new Error("useFleet must be used inside <FleetSocketProvider>");
  return ctx;
}
