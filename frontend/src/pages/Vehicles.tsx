import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { Page, Vehicle, VehicleInput, VehicleStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { statusLabels } from "../lib/health";

const PAGE_SIZE = 10;
const statuses: VehicleStatus[] = ["ACTIVE", "IDLE", "MAINTENANCE", "RETIRED"];

const emptyForm = (): VehicleInput => ({
  plate: "",
  vin: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  status: "IDLE",
  odometerKm: 0
});

function VehicleForm({
  initial,
  onCancel,
  onSaved
}: {
  initial: Vehicle | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VehicleInput>(
    initial
      ? {
          plate: initial.plate,
          vin: initial.vin,
          make: initial.make,
          model: initial.model,
          year: initial.year,
          status: initial.status,
          odometerKm: initial.odometerKm
        }
      : emptyForm()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (initial) await api.updateVehicle(initial.id, form);
      else await api.createVehicle(form);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("A vehicle with that plate or VIN already exists.");
      else if (err instanceof ApiError && err.status === 400) setError("Some details aren't valid. The VIN must be exactly 17 characters and the year realistic.");
      else if (err instanceof ApiError && err.status === 403) setError("Your role can't change vehicles. Ask a manager or admin.");
      else setError("We couldn't save the vehicle. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-petrol/60 p-4" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
      <form onSubmit={submit} className="panel grid w-full max-w-lg gap-4 p-6 sm:grid-cols-2">
        <h2 id="vehicle-form-title" className="font-display text-3xl font-semibold sm:col-span-2">
          {initial ? `Edit ${initial.plate}` : "Add vehicle"}
        </h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Plate
          <input className="field" required value={form.plate} onChange={(e) => set("plate", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          VIN (17 characters)
          <input className="field" required minLength={17} maxLength={17} value={form.vin} onChange={(e) => set("vin", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Make
          <input className="field" required value={form.make} onChange={(e) => set("make", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Model
          <input className="field" required value={form.model} onChange={(e) => set("model", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Year
          <input className="field" type="number" required min={1980} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => set("year", Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Odometer (km)
          <input className="field" type="number" min={0} value={form.odometerKm ?? 0} onChange={(e) => set("odometerKm", Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Status
          <select className="field" value={form.status} onChange={(e) => set("status", e.target.value as VehicleStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-sm text-crit sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add vehicle"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Vehicles() {
  const { can } = useAuth();
  const canWrite = can("ADMIN", "MANAGER");
  const canDelete = can("ADMIN");

  const [data, setData] = useState<Page<Vehicle> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VehicleStatus | "">("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.listVehicles({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined, status }));
      setError(null);
    } catch {
      setError("We couldn't load vehicles. Check your connection and try again.");
    }
  }, [page, search, status]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  async function remove(v: Vehicle) {
    if (!window.confirm(`Delete ${v.plate}? Its position and health history will be deleted too.`)) return;
    try {
      await api.deleteVehicle(v.id);
      await load();
    } catch {
      setError(`${v.plate} couldn't be deleted. Try again.`);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold">Vehicles</h1>
        {canWrite && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            Add vehicle
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="vehicle-search">
          Search vehicles
        </label>
        <input
          id="vehicle-search"
          className="field max-w-xs"
          placeholder="Search by plate, make, model or VIN"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="sr-only" htmlFor="vehicle-status">
          Filter by status
        </label>
        <select
          id="vehicle-status"
          className="field max-w-[12rem]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as VehicleStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-sm text-crit">
          {error}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-fog text-petrol-500">
            <tr>
              <th className="px-4 py-3 font-medium">Plate</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Odometer</th>
              {canWrite && (
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {data?.items.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-semibold">{v.plate}</td>
                <td className="px-4 py-3">
                  {v.make} {v.model} <span className="text-petrol-500">({v.year})</span>
                </td>
                <td className="px-4 py-3">{v.driver?.name ?? <span className="text-petrol-500">Unassigned</span>}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={v.status} />
                </td>
                <td className="px-4 py-3 text-right">{v.odometerKm.toLocaleString()} km</td>
                {canWrite && (
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" className="btn-quiet mr-2" onClick={() => setEditing(v)}>
                      Edit
                    </button>
                    {canDelete && (
                      <button type="button" className="btn-danger" onClick={() => void remove(v)}>
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-10 text-center text-petrol-500">
                  No vehicles match. Clear the search or filter, or add a new vehicle.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-petrol-500">
            Page {data.page} of {totalPages} · {data.total} vehicles
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button type="button" className="btn-quiet" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </span>
        </nav>
      )}

      {(creating || editing) && (
        <VehicleForm
          initial={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
