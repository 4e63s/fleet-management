import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { HealthOverviewRow, HealthSnapshot } from "../api/types";
import { HealthRing } from "../components/HealthRing";
import { Sparkline } from "../components/Sparkline";
import { StatusBadge } from "../components/StatusBadge";
import { useFleet } from "../hooks/FleetSocketContext";
import { useNow } from "../hooks/useNow";
import { formatRelative, healthTone, metricTone, toneClasses, type MetricKey } from "../lib/health";

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  digits: number;
  max: number;
  /** When true a higher value is worse (temperature). */
  inverse?: boolean;
}

const metrics: MetricDef[] = [
  { key: "engineTempC", label: "Engine temperature", unit: "°C", digits: 0, max: 130, inverse: true },
  { key: "fuelLevelPct", label: "Fuel", unit: "%", digits: 0, max: 100 },
  { key: "batteryVoltage", label: "Battery", unit: "V", digits: 1, max: 15 },
  { key: "tirePressureKpa", label: "Tire pressure", unit: "kPa", digits: 0, max: 300 },
  { key: "oilLifePct", label: "Oil life", unit: "%", digits: 0, max: 100 }
];

export function VehicleHealth() {
  const { health } = useFleet();
  const now = useNow();
  const [overview, setOverview] = useState<HealthOverviewRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HealthSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .healthOverview()
      .then(setOverview)
      .catch(() => setError("We couldn't load vehicle health. Check your connection and refresh the page."));
  }, []);

  // Live readings replace the REST snapshot for that vehicle.
  const rows = useMemo(() => {
    if (!overview) return [];
    return overview
      .map((r) => (health[r.vehicleId] ? { ...r, latest: health[r.vehicleId] } : r))
      .sort((a, b) => (a.latest?.healthScore ?? 1000) - (b.latest?.healthScore ?? 1000));
  }, [overview, health]);

  useEffect(() => {
    if (!selectedId && rows.length > 0) setSelectedId(rows[0].vehicleId);
  }, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setHistory([]);
    api
      .healthHistory(selectedId, 60)
      .then((h) => !cancelled && setHistory([...h].reverse()))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = rows.find((r) => r.vehicleId === selectedId) ?? null;
  const liveForSelected = selectedId ? health[selectedId] : undefined;

  const trend = useMemo(() => {
    const scores = history.map((h) => h.healthScore);
    if (liveForSelected && history.length > 0 && liveForSelected.recordedAt > history[history.length - 1].recordedAt) {
      scores.push(liveForSelected.healthScore);
    }
    return scores;
  }, [history, liveForSelected]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-8">
      <h1 className="font-display text-4xl font-semibold">Vehicle health</h1>

      {error && (
        <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-sm text-crit">
          {error}
        </p>
      )}

      {overview && rows.length === 0 && <p className="panel p-6 text-sm text-petrol-500">There are no vehicles yet. Add one on the Vehicles page to start tracking its health.</p>}

      {rows.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="panel lg:col-span-2" aria-label="Vehicles, lowest health first">
            <p className="border-b border-fog px-4 py-3 text-sm text-petrol-500">Lowest health first</p>
            <ul className="divide-y divide-fog">
              {rows.map((r) => (
                <li key={r.vehicleId}>
                  <button
                    type="button"
                    aria-pressed={r.vehicleId === selectedId}
                    onClick={() => setSelectedId(r.vehicleId)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fog ${r.vehicleId === selectedId ? "bg-road-soft" : ""}`}
                  >
                    <HealthRing score={r.latest?.healthScore ?? null} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.plate}</span>
                      <span className="block truncate text-xs text-petrol-500">
                        {r.make} {r.model}
                      </span>
                    </span>
                    <span className="text-xs text-petrol-500">{r.latest ? formatRelative(r.latest.recordedAt, now) : "No data"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected && (
            <section className="panel flex flex-col gap-5 p-5 lg:col-span-3" aria-label={`Health details for ${selected.plate}`}>
              <div className="flex items-center gap-4">
                <HealthRing score={selected.latest?.healthScore ?? null} size={96} />
                <div>
                  <h2 className="font-display text-3xl font-semibold leading-tight">{selected.plate}</h2>
                  <p className="text-sm text-petrol-500">
                    {selected.make} {selected.model}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
              </div>

              {!selected.latest ? (
                <p className="rounded bg-fog p-4 text-sm text-petrol-700">This vehicle hasn't sent a health reading yet. Its device reports to the telemetry endpoint.</p>
              ) : (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {metrics.map((m) => {
                      const value = selected.latest![m.key];
                      const tone = toneClasses[metricTone(m.key, value)];
                      const fraction = Math.min(1, Math.max(0, value / m.max));
                      return (
                        <div key={m.key}>
                          <dt className="text-sm text-petrol-500">{m.label}</dt>
                          <dd className="flex items-baseline gap-1">
                            <span className={`font-display text-3xl font-semibold ${tone.text}`}>{value.toFixed(m.digits)}</span>
                            <span className="text-sm text-petrol-500">{m.unit}</span>
                          </dd>
                          <div className="mt-1 h-1.5 w-full bg-fog" role="presentation">
                            <div className={`h-full ${tone.bg}`} style={{ width: `${fraction * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </dl>

                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Health score, last {trend.length} readings</h3>
                    <Sparkline values={trend} label={`Health score trend for ${selected.plate}`} stroke={toneClasses[healthTone(selected.latest.healthScore)].hex} />
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
