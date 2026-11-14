import { API_URL } from "../config";
import type {
  AlertItem,
  AuthResult,
  DashboardSummary,
  HealthOverviewRow,
  HealthSnapshot,
  LivePosition,
  Page,
  Severity,
  User,
  Vehicle,
  VehicleInput,
  VehicleStatus
} from "./types";

const ACCESS_KEY = "fleet.accessToken";
const REFRESH_KEY = "fleet.refreshToken";

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh so parallel 401s trigger only one rotation. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return Promise.resolve(false);

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResult;
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? `Request failed (${res.status})`, body.error?.details);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

export async function request<T>(path: string, { method = "GET", body, query, auth = true }: RequestOptions = {}): Promise<T> {
  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = tokenStore.access();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}${qs === "?" ? "" : qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  };

  let res = await send();

  if (res.status === 401 && auth && tokenStore.refresh()) {
    if (await refreshSession()) {
      res = await send();
    } else {
      tokenStore.clear();
      onSessionLost?.();
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  async login(email: string, password: string): Promise<AuthResult> {
    const result = await request<AuthResult>("/api/auth/login", { method: "POST", body: { email, password }, auth: false });
    tokenStore.set(result.accessToken, result.refreshToken);
    return result;
  },

  async logout(): Promise<void> {
    const refreshToken = tokenStore.refresh();
    tokenStore.clear();
    if (refreshToken) {
      try {
        await request<void>("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
      } catch {
        /* the local session is already gone */
      }
    }
  },

  me: () => request<User>("/api/auth/me"),

  dashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),

  listVehicles: (query: { page?: number; pageSize?: number; search?: string; status?: VehicleStatus | "" }) =>
    request<Page<Vehicle>>("/api/vehicles", { query }),
  createVehicle: (input: VehicleInput) => request<Vehicle>("/api/vehicles", { method: "POST", body: input }),
  updateVehicle: (id: string, input: Partial<VehicleInput>) => request<Vehicle>(`/api/vehicles/${id}`, { method: "PATCH", body: input }),
  deleteVehicle: (id: string) => request<void>(`/api/vehicles/${id}`, { method: "DELETE" }),

  livePositions: () => request<LivePosition[]>("/api/telemetry/live"),
  healthOverview: () => request<HealthOverviewRow[]>("/api/telemetry/health/overview"),
  healthHistory: (vehicleId: string, limit = 60) =>
    request<HealthSnapshot[]>(`/api/telemetry/vehicles/${vehicleId}/health`, { query: { limit } }),

  listAlerts: (query: { acknowledged?: boolean; severity?: Severity; pageSize?: number }) =>
    request<Page<AlertItem>>("/api/alerts", {
      query: { ...query, acknowledged: query.acknowledged === undefined ? undefined : String(query.acknowledged) }
    }),
  acknowledgeAlert: (id: string) => request<AlertItem>(`/api/alerts/${id}/acknowledge`, { method: "PATCH" })
};
