import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { api } from "../api/client";
import type { LivePosition } from "../api/types";
import { useFleet } from "../hooks/FleetSocketContext";
import { useNow } from "../hooks/useNow";
import { formatRelative, isStale } from "../lib/health";

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];

function markerColor(p: LivePosition, now: number): string {
  if (isStale(p.recordedAt, now)) return "#8FA3AB";
  return p.speedKph > 3 ? "#0E7C5A" : "#0B5CAD";
}

function vehicleIcon(heading: number, color: string, selected: boolean) {
  const ring = selected ? "#10242B" : "#FFFFFF";
  const html =
    `<div style="width:30px;height:30px;transform:rotate(${Math.round(heading)}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">` +
    `<svg viewBox="0 0 30 30" width="30" height="30"><path d="M15 2 L26 26 L15 20 L4 26 Z" fill="${color}" stroke="${ring}" stroke-width="${selected ? 3 : 2}" stroke-linejoin="round"/></svg>` +
    `</div>`;
  return L.divIcon({ className: "fleet-marker", html, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function VehicleMarker({ p, selected, now, onSelect }: { p: LivePosition; selected: boolean; now: number; onSelect: () => void }) {
  const color = markerColor(p, now);
  const icon = useMemo(() => vehicleIcon(p.heading, color, selected), [p.heading, color, selected]);
  return (
    <Marker position={[p.lat, p.lng]} icon={icon} eventHandlers={{ click: onSelect }} zIndexOffset={selected ? 1000 : 0}>
      <Tooltip direction="top" offset={[0, -14]}>
        {p.plate} · {Math.round(p.speedKph)} km/h
      </Tooltip>
    </Marker>
  );
}

function FitOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const key = target ? `${target[0]},${target[1]}` : null;
  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",").map(Number);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const zoom = Math.max(map.getZoom(), 14);
    if (reduce) map.setView([lat, lng], zoom);
    else map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [map, key]);
  return null;
}

export function LiveMap() {
  const { positions, seedPositions, connected } = useFleet();
  const now = useNow(15000);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .livePositions()
      .then(seedPositions)
      .catch(() => setError("We couldn't load the latest positions. New updates will still appear as they arrive."))
      .finally(() => setLoaded(true));
  }, [seedPositions]);

  const list = useMemo(() => Object.values(positions).sort((a, b) => a.plate.localeCompare(b.plate)), [positions]);
  const points = useMemo<[number, number][]>(() => list.map((p) => [p.lat, p.lng]), [list]);
  const movingCount = list.filter((p) => p.speedKph > 3 && !isStale(p.recordedAt, now)).length;

  function select(p: LivePosition) {
    setSelected(p.vehicleId);
    setFlyTarget([p.lat, p.lng]);
  }

  return (
    <div className="flex h-full min-h-[32rem] flex-col lg:flex-row">
      <div className="relative min-h-[22rem] flex-1">
        <MapContainer center={DEFAULT_CENTER} zoom={6} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitOnce points={points} />
          <FlyTo target={flyTarget} />
          {list.map((p) => (
            <VehicleMarker key={p.vehicleId} p={p} now={now} selected={selected === p.vehicleId} onSelect={() => select(p)} />
          ))}
        </MapContainer>
        {loaded && list.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
            <p className="max-w-xs rounded bg-paper p-4 text-center text-sm shadow">
              No vehicle has reported a position yet. Once a device sends its location, it will appear here.
            </p>
          </div>
        )}
      </div>

      <aside className="flex max-h-64 w-full shrink-0 flex-col bg-paper lg:max-h-none lg:w-80" aria-label="Vehicles on the map">
        <div className="border-b border-fog px-4 py-3">
          <h1 className="font-display text-2xl font-semibold">Live map</h1>
          <p className="text-sm text-petrol-500" role="status">
            {connected ? `${movingCount} of ${list.length} moving` : "Reconnecting to live updates…"}
          </p>
          {error && <p className="mt-1 text-sm text-crit">{error}</p>}
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-fog overflow-y-auto">
          {list.map((p) => {
            const stale = isStale(p.recordedAt, now);
            return (
              <li key={p.vehicleId}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  aria-pressed={selected === p.vehicleId}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fog ${selected === p.vehicleId ? "bg-road-soft" : ""}`}
                >
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: markerColor(p, now) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{p.plate}</span>
                    <span className="block truncate text-xs text-petrol-500">{stale ? "No signal · " : ""}{formatRelative(p.recordedAt, now)}</span>
                  </span>
                  <span className="font-display text-xl font-semibold">
                    {Math.round(p.speedKph)}
                    <span className="ml-0.5 font-sans text-xs font-normal text-petrol-500">km/h</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
