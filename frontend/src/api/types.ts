export type Role = "ADMIN" | "MANAGER" | "DRIVER";
export type VehicleStatus = "ACTIVE" | "IDLE" | "MAINTENANCE" | "RETIRED";
export type Severity = "INFO" | "WARNING" | "CRITICAL";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string | null;
}

export interface Vehicle {
  id: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatus;
  odometerKm: number;
  driverId: string | null;
  driver?: { id: string; name: string } | null;
}

export interface VehicleInput {
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  status?: VehicleStatus;
  odometerKm?: number;
  driverId?: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LivePosition {
  vehicleId: string;
  plate: string;
  make?: string;
  model?: string;
  status?: VehicleStatus;
  lat: number;
  lng: number;
  speedKph: number;
  heading: number;
  recordedAt: string;
}

export interface HealthSnapshot {
  engineTempC: number;
  fuelLevelPct: number;
  batteryVoltage: number;
  tirePressureKpa: number;
  oilLifePct: number;
  healthScore: number;
  recordedAt: string;
}

export interface HealthOverviewRow {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  status: VehicleStatus;
  latest: HealthSnapshot | null;
}

export interface HealthEvent extends HealthSnapshot {
  vehicleId: string;
  plate: string;
}

export interface AlertItem {
  id: string;
  vehicleId: string;
  plate?: string;
  vehicle?: { plate: string };
  type: string;
  severity: Severity;
  message: string;
  acknowledged?: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  totalVehicles: number;
  statusCounts: Record<VehicleStatus, number>;
  openAlerts: number;
  criticalAlerts: number;
  upcomingMaintenance: number;
  averageHealth: number | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}
