import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { AlertItem, DashboardSummary, HealthOverviewRow, VehicleStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { HealthRing } from "../components/HealthRing";
import { useFleet } from "../hooks/FleetSocketContext";
import { useNow } from "../hooks/useNow";
import { formatRelative, severityTone, statusLabels, toneClasses } from "../lib/health";

const statusOrder: VehicleStatus[] = ["ACTIVE", "IDLE", "MAINTENANCE", "RETIRED"];
const statusColor: Record<VehicleStatus, string> = {
  ACTIVE: "bg-ok",
  IDLE: "bg-petrol-300",
  MAINTENANCE: "bg-warn",
  RETIRED: "bg-petrol-500"
};

function Gauge({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 px-4 py-3">
      <span className="text-sm text-road-soft">{label}</span>
      <span className="font-display text-5xl font-semibold leading-none">{value}</span>
      <span className="min-h-[1.25rem] text-xs text-road-soft">{hint}</span>
    </div>
  );
}

export function Dashboard() {
  const { can } = useAuth();
  const { alerts: liveAlerts, health } = useFleet();
  const now = useNow();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [openAlerts, setOpenAlerts] = useState<AlertItem[]>([]);
  const [overview, setOverview] = useState<HealthOverviewRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a, h] = await Promise.all([
        api.dashboardSummary(),
        api.listAlerts({ acknowledged: false, pageSize: 20 }),
        api.healthOverview()
      ]);
      setSummary(s);
      setOpenAlerts(a.items);
      setOverview(h);
      setError(null);
    } catch {
      setError("We couldn't load the overview. Check your connection and refresh the page.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A new live alert changes the counters, so refresh them.
  useEffect(() => {
    if (liveAlerts.length > 0) void api.dashboardSummary().then(setSummary).catch(() => undefined);
  }, [liveAlerts.length]);

  const alertRows = useMemo<AlertItem[]>(() => {
    const known = new Set(openAlerts.map((a) => a.id));
    const fresh: AlertItem[] = liveAlerts.filter((a) => !known.has(a.id)).map((a) => ({ ...a, acknowledged: false }));
    return [...fresh, ...openAlerts].filter((a) => !dismissed.has(a.id));
  }, [liveAlerts, openAlerts, dismissed]);

  const weakest = useMemo(() => {
    const rows = overview.map((r) => ({ ...r, latest: health[r.vehicleId] ?? r.latest })).filter((r) => r.latest);
    return rows.sort((a, b) => (a.latest!.healthScore ?? 0) - (b.latest!.healthScore ?? 0)).slice(0, 5);
  }, [overview, health]);

  async function acknowledge(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    try {
      await api.acknowledgeAlert(id);
      void api.dashboardSummary().then(setSummary).catch(() => undefined);
    } catch {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError("That alert couldn't be acknowledged. Try again.");
    }
  }

  const total = summary?.totalVehicles ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      <h1 className="font-display text-4xl font-semibold">Fleet overview</h1>

      {error && (
        <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-sm text-crit">
          {error}
        </p>
      )}

      <section aria-label="Fleet summary" className="rounded bg-road p-1.5 text-white">
        <div className="grid grid-cols-2 divide-white/25 rounded border-2 border-white/90 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-white/25 lg:[&>*:nth-child(n+3)]:border-t-0">
          <Gauge label="Vehicles" value={summary ? String(summary.totalVehicles) : "–"} />
          <Gauge label="On the road" value={summary ? String(summary.statusCounts.ACTIVE) : "–"} />
          <Gauge label="In workshop" value={summary ? String(summary.statusCounts.MAINTENANCE) : "–"} />
          <Gauge
            label="Open alerts"
            value={summary ? String(summary.openAlerts) : "–"}
            hint={summary && summary.criticalAlerts > 0 ? `${summary.criticalAlerts} critical` : undefined}
          />
          <Gauge label="Average health" value={summary?.averageHealth != null ? String(summary.averageHealth) : "–"} />
          <Gauge label="Service due in 7 days" value={summary ? String(summary.upcomingMaintenance) : "–"} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="panel lg:col-span-3" aria-labelledby="attention-title">
          <div className="flex items-baseline justify-between border-b border-fog px-4 py-3">
            <h2 id="attention-title" className="font-display text-2xl font-semibold">
              Needs attention
            </h2>
            <span className="text-sm text-petrol-500">{alertRows.length} open</span>
          </div>
          {alertRows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-petrol-500">No open alerts. Anything that needs action will show up here as it happens.</p>
          ) : (
            <ul className="divide-y divide-fog">
              {alertRows.map((a) => {
                const tone = toneClasses[severityTone(a.severity)];
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.bg}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {a.plate ?? a.vehicle?.plate ?? "Vehicle"}
                        <span className={`ml-2 font-normal ${tone.text}`}>{a.severity === "CRITICAL" ? "Critical" : "Warning"}</span>
                      </p>
                      <p className="text-sm text-petrol-700">{a.message}</p>
                      <p className="text-xs text-petrol-500">{formatRelative(a.createdAt, now)}</p>
                    </div>
                    {can("ADMIN", "MANAGER") && (
                      <button type="button" className="btn-quiet shrink-0" onClick={() => void acknowledge(a.id)}>
                        Acknowledge
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="panel p-4" aria-labelledby="status-title">
            <h2 id="status-title" className="font-display text-2xl font-semibold">
              Fleet status
            </h2>
            {summary && total > 0 ? (
              <>
                <div
                  className="mt-3 flex h-4 overflow-hidden rounded-sm bg-fog"
                  role="img"
                  aria-label={statusOrder.map((s) => `${statusLabels[s]}: ${summary.statusCounts[s]}`).join(", ")}
                >
                  {statusOrder.map((s) => (
                    <div key={s} className={statusColor[s]} style={{ width: `${(summary.statusCounts[s] / total) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {statusOrder.map((s) => (
                    <li key={s} className="flex items-center gap-2">
                      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${statusColor[s]}`} />
                      {statusLabels[s]}
                      <span className="ml-auto font-semibold">{summary.statusCounts[s]}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-petrol-500">Add vehicles to see how the fleet is split between driving, parked and in the workshop.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="weakest-title">
            <div className="flex items-baseline justify-between border-b border-fog px-4 py-3">
              <h2 id="weakest-title" className="font-display text-2xl font-semibold">
                Lowest health
              </h2>
              <Link to="/health" className="text-sm text-road underline">
                See all vehicles
              </Link>
            </div>
            {weakest.length === 0 ? (
              <p className="px-4 py-6 text-sm text-petrol-500">Health scores appear after the first device reading arrives.</p>
            ) : (
              <ul className="divide-y divide-fog">
                {weakest.map((r) => (
                  <li key={r.vehicleId} className="flex items-center gap-3 px-4 py-2.5">
                    <HealthRing score={r.latest!.healthScore} size={44} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{r.plate}</p>
                      <p className="truncate text-xs text-petrol-500">
                        {r.make} {r.model}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
