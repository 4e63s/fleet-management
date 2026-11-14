export interface HealthInput {
  engineTempC: number;
  fuelLevelPct: number;
  batteryVoltage: number;
  tirePressureKpa: number;
  oilLifePct: number;
}

export interface AlertDraft {
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export const MAX_SPEED_KPH = 120;

/** 0-100 score. Starts at 100 and subtracts penalties per subsystem. */
export function computeHealthScore(r: HealthInput): number {
  let score = 100;

  if (r.engineTempC > 110) score -= 30;
  else if (r.engineTempC > 100) score -= 15;

  if (r.fuelLevelPct < 10) score -= 10;
  else if (r.fuelLevelPct < 20) score -= 5;

  if (r.batteryVoltage < 11.8) score -= 25;
  else if (r.batteryVoltage < 12.2) score -= 10;

  if (r.tirePressureKpa < 180) score -= 15;
  else if (r.tirePressureKpa < 200) score -= 5;

  if (r.oilLifePct < 10) score -= 20;
  else if (r.oilLifePct < 25) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export function evaluateHealthAlerts(r: HealthInput): AlertDraft[] {
  const alerts: AlertDraft[] = [];

  if (r.engineTempC > 110) {
    alerts.push({ type: "ENGINE_OVERHEAT", severity: "CRITICAL", message: `Engine temperature is ${r.engineTempC.toFixed(0)} °C` });
  } else if (r.engineTempC > 100) {
    alerts.push({ type: "ENGINE_OVERHEAT", severity: "WARNING", message: `Engine temperature is high: ${r.engineTempC.toFixed(0)} °C` });
  }

  if (r.fuelLevelPct < 10) {
    alerts.push({ type: "LOW_FUEL", severity: "CRITICAL", message: `Fuel level is ${r.fuelLevelPct.toFixed(0)}%` });
  } else if (r.fuelLevelPct < 20) {
    alerts.push({ type: "LOW_FUEL", severity: "WARNING", message: `Fuel level is low: ${r.fuelLevelPct.toFixed(0)}%` });
  }

  if (r.batteryVoltage < 11.8) {
    alerts.push({ type: "LOW_BATTERY", severity: "CRITICAL", message: `Battery voltage is ${r.batteryVoltage.toFixed(1)} V` });
  } else if (r.batteryVoltage < 12.2) {
    alerts.push({ type: "LOW_BATTERY", severity: "WARNING", message: `Battery voltage is low: ${r.batteryVoltage.toFixed(1)} V` });
  }

  if (r.tirePressureKpa < 180) {
    alerts.push({ type: "LOW_TIRE_PRESSURE", severity: "CRITICAL", message: `Tire pressure is ${r.tirePressureKpa.toFixed(0)} kPa` });
  } else if (r.tirePressureKpa < 200) {
    alerts.push({ type: "LOW_TIRE_PRESSURE", severity: "WARNING", message: `Tire pressure is low: ${r.tirePressureKpa.toFixed(0)} kPa` });
  }

  if (r.oilLifePct < 10) {
    alerts.push({ type: "OIL_CHANGE_DUE", severity: "CRITICAL", message: `Oil life is ${r.oilLifePct.toFixed(0)}%` });
  } else if (r.oilLifePct < 25) {
    alerts.push({ type: "OIL_CHANGE_DUE", severity: "WARNING", message: `Oil change due soon: ${r.oilLifePct.toFixed(0)}% oil life left` });
  }

  return alerts;
}

export function evaluateSpeedAlert(speedKph: number): AlertDraft | null {
  if (speedKph <= MAX_SPEED_KPH) return null;
  return { type: "SPEEDING", severity: "WARNING", message: `Vehicle speed ${speedKph.toFixed(0)} km/h exceeds ${MAX_SPEED_KPH} km/h` };
}
