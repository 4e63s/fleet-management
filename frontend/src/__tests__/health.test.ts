import { formatRelative, healthTone, isStale, metricTone, severityTone, STALE_AFTER_MS } from "../lib/health";

describe("healthTone", () => {
  it.each([
    [100, "ok"],
    [80, "ok"],
    [79, "warn"],
    [50, "warn"],
    [49, "crit"],
    [0, "crit"],
    [null, "none"],
    [undefined, "none"]
  ])("maps %p to %s", (score, tone) => {
    expect(healthTone(score as number | null | undefined)).toBe(tone);
  });
});

describe("metricTone mirrors the backend thresholds", () => {
  it.each([
    ["engineTempC", 100, "ok"],
    ["engineTempC", 101, "warn"],
    ["engineTempC", 111, "crit"],
    ["fuelLevelPct", 20, "ok"],
    ["fuelLevelPct", 19, "warn"],
    ["fuelLevelPct", 9, "crit"],
    ["batteryVoltage", 12.2, "ok"],
    ["batteryVoltage", 12.1, "warn"],
    ["batteryVoltage", 11.7, "crit"],
    ["tirePressureKpa", 200, "ok"],
    ["tirePressureKpa", 199, "warn"],
    ["tirePressureKpa", 179, "crit"],
    ["oilLifePct", 25, "ok"],
    ["oilLifePct", 24, "warn"],
    ["oilLifePct", 9, "crit"]
  ] as const)("%s = %s is %s", (key, value, tone) => {
    expect(metricTone(key, value)).toBe(tone);
  });
});

describe("severityTone", () => {
  it("maps severities", () => {
    expect(severityTone("CRITICAL")).toBe("crit");
    expect(severityTone("WARNING")).toBe("warn");
    expect(severityTone("INFO")).toBe("none");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-01-01T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [3_000, "just now"],
    [30_000, "30s ago"],
    [5 * 60_000, "5 min ago"],
    [3 * 3_600_000, "3 h ago"],
    [2 * 86_400_000, "2 d ago"]
  ])("formats %i ms", (ms, label) => {
    expect(formatRelative(ago(ms), now)).toBe(label);
  });

  it("never returns negative values for future timestamps", () => {
    expect(formatRelative(new Date(now + 5000).toISOString(), now)).toBe("just now");
  });
});

describe("isStale", () => {
  const now = Date.now();
  it("flags positions older than the threshold", () => {
    expect(isStale(new Date(now - STALE_AFTER_MS - 1000).toISOString(), now)).toBe(true);
    expect(isStale(new Date(now - 1000).toISOString(), now)).toBe(false);
  });
});
