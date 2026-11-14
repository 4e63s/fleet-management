import type { Severity, VehicleStatus } from "../api/types";

export type Tone = "ok" | "warn" | "crit" | "none";

export function healthTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return "none";
  if (score >= 80) return "ok";
  if (score >= 50) return "warn";
  return "crit";
}

export type MetricKey = "engineTempC" | "fuelLevelPct" | "batteryVoltage" | "tirePressureKpa" | "oilLifePct";

/** Mirrors the backend thresholds so the UI colours match the alerts. */
export function metricTone(key: MetricKey, value: number): Tone {
  switch (key) {
    case "engineTempC":
      return value > 110 ? "crit" : value > 100 ? "warn" : "ok";
    case "fuelLevelPct":
      return value < 10 ? "crit" : value < 20 ? "warn" : "ok";
    case "batteryVoltage":
      return value < 11.8 ? "crit" : value < 12.2 ? "warn" : "ok";
    case "tirePressureKpa":
      return value < 180 ? "crit" : value < 200 ? "warn" : "ok";
    case "oilLifePct":
      return value < 10 ? "crit" : value < 25 ? "warn" : "ok";
  }
}

export const toneClasses: Record<Tone, { text: string; bg: string; soft: string; hex: string }> = {
  ok: { text: "text-ok", bg: "bg-ok", soft: "bg-ok-soft", hex: "#0E7C5A" },
  warn: { text: "text-warn", bg: "bg-warn", soft: "bg-warn-soft", hex: "#B86E00" },
  crit: { text: "text-crit", bg: "bg-crit", soft: "bg-crit-soft", hex: "#B3261E" },
  none: { text: "text-petrol-500", bg: "bg-petrol-300", soft: "bg-fog", hex: "#8FA3AB" }
};

export function severityTone(severity: Severity): Tone {
  return severity === "CRITICAL" ? "crit" : severity === "WARNING" ? "warn" : "none";
}

export const statusLabels: Record<VehicleStatus, string> = {
  ACTIVE: "On the road",
  IDLE: "Parked",
  MAINTENANCE: "In workshop",
  RETIRED: "Retired"
};

export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export const STALE_AFTER_MS = 2 * 60 * 1000;

export function isStale(iso: string, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() > STALE_AFTER_MS;
}
