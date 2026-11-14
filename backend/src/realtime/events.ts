export interface PositionEvent {
  vehicleId: string;
  plate: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading: number;
  recordedAt: string;
}

export interface HealthEvent {
  vehicleId: string;
  plate: string;
  engineTempC: number;
  fuelLevelPct: number;
  batteryVoltage: number;
  tirePressureKpa: number;
  oilLifePct: number;
  healthScore: number;
  recordedAt: string;
}

export interface AlertEvent {
  id: string;
  vehicleId: string;
  plate: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
}

/** Abstraction over the WebSocket layer so services can be tested without sockets. */
export interface RealtimeBus {
  emitPosition(event: PositionEvent): void;
  emitHealth(event: HealthEvent): void;
  emitAlert(event: AlertEvent): void;
}

export const noopBus: RealtimeBus = {
  emitPosition: () => undefined,
  emitHealth: () => undefined,
  emitAlert: () => undefined
};
