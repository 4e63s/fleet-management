import {
  computeHealthScore,
  evaluateHealthAlerts,
  evaluateSpeedAlert,
  MAX_SPEED_KPH,
  type HealthInput
} from "../../src/modules/telemetry/health";

const healthy: HealthInput = {
  engineTempC: 90,
  fuelLevelPct: 70,
  batteryVoltage: 12.6,
  tirePressureKpa: 230,
  oilLifePct: 80
};

describe("computeHealthScore", () => {
  it("returns 100 for a healthy vehicle", () => {
    expect(computeHealthScore(healthy)).toBe(100);
  });

  it.each([
    [{ engineTempC: 105 }, 85],
    [{ engineTempC: 115 }, 70],
    [{ fuelLevelPct: 15 }, 95],
    [{ fuelLevelPct: 5 }, 90],
    [{ batteryVoltage: 12.0 }, 90],
    [{ batteryVoltage: 11.0 }, 75],
    [{ tirePressureKpa: 190 }, 95],
    [{ tirePressureKpa: 150 }, 85],
    [{ oilLifePct: 20 }, 90],
    [{ oilLifePct: 5 }, 80]
  ])("applies the penalty for %j", (override, expected) => {
    expect(computeHealthScore({ ...healthy, ...override })).toBe(expected);
  });

  it("never drops below zero", () => {
    const worst: HealthInput = { engineTempC: 150, fuelLevelPct: 0, batteryVoltage: 9, tirePressureKpa: 50, oilLifePct: 0 };
    expect(computeHealthScore(worst)).toBe(0);
  });
});

describe("evaluateHealthAlerts", () => {
  it("returns no alerts for a healthy vehicle", () => {
    expect(evaluateHealthAlerts(healthy)).toEqual([]);
  });

  it("flags critical engine overheating", () => {
    const alerts = evaluateHealthAlerts({ ...healthy, engineTempC: 118 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "ENGINE_OVERHEAT", severity: "CRITICAL" });
  });

  it("flags a warning for a hot engine", () => {
    const alerts = evaluateHealthAlerts({ ...healthy, engineTempC: 104 });
    expect(alerts[0]).toMatchObject({ type: "ENGINE_OVERHEAT", severity: "WARNING" });
  });

  it("reports several problems at once", () => {
    const alerts = evaluateHealthAlerts({
      engineTempC: 90,
      fuelLevelPct: 5,
      batteryVoltage: 11.5,
      tirePressureKpa: 170,
      oilLifePct: 5
    });
    expect(alerts.map((a) => a.type).sort()).toEqual(
      ["LOW_BATTERY", "LOW_FUEL", "LOW_TIRE_PRESSURE", "OIL_CHANGE_DUE"].sort()
    );
    expect(alerts.every((a) => a.severity === "CRITICAL")).toBe(true);
  });

  it("uses warnings between the warning and critical thresholds", () => {
    const alerts = evaluateHealthAlerts({ ...healthy, fuelLevelPct: 15, oilLifePct: 20 });
    expect(alerts.map((a) => [a.type, a.severity])).toEqual([
      ["LOW_FUEL", "WARNING"],
      ["OIL_CHANGE_DUE", "WARNING"]
    ]);
  });
});

describe("evaluateSpeedAlert", () => {
  it("is null at or below the limit", () => {
    expect(evaluateSpeedAlert(MAX_SPEED_KPH)).toBeNull();
    expect(evaluateSpeedAlert(60)).toBeNull();
  });

  it("raises a warning above the limit", () => {
    expect(evaluateSpeedAlert(MAX_SPEED_KPH + 1)).toMatchObject({ type: "SPEEDING", severity: "WARNING" });
  });
});
