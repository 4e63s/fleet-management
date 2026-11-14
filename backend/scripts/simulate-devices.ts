/**
 * Fake GPS/OBD devices for local demos.
 *
 *   npm run seed       # creates the admin user and three vehicles
 *   npm run simulate   # streams positions every 2 s and health every 10 s
 *
 * Environment: API_URL, SIM_EMAIL, SIM_PASSWORD, DEVICE_API_KEY, SIM_LAT, SIM_LNG
 */
const API = process.env.API_URL ?? "http://localhost:4000";
const EMAIL = process.env.SIM_EMAIL ?? "admin@fleet.local";
const PASSWORD = process.env.SIM_PASSWORD ?? "Admin#12345";
const DEVICE_KEY = process.env.DEVICE_API_KEY ?? "change-me-device-key-1234";
const BASE_LAT = Number(process.env.SIM_LAT ?? 24.7136);
const BASE_LNG = Number(process.env.SIM_LNG ?? 46.6753);

interface SimVehicle {
  id: string;
  plate: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  fuel: number;
  oil: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-key": DEVICE_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) console.error(`POST ${path} failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  if (!login.ok) throw new Error(`Login failed (${login.status}). Did you run "npm run seed"?`);
  const { accessToken } = (await login.json()) as { accessToken: string };

  const list = await fetch(`${API}/api/vehicles?pageSize=100`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const { items } = (await list.json()) as { items: { id: string; plate: string }[] };
  if (items.length === 0) throw new Error("No vehicles found. Run the seed or add vehicles first.");

  const fleet: SimVehicle[] = items.map((v) => ({
    id: v.id,
    plate: v.plate,
    lat: BASE_LAT + rand(-0.08, 0.08),
    lng: BASE_LNG + rand(-0.08, 0.08),
    heading: rand(0, 360),
    speed: rand(30, 90),
    fuel: rand(40, 95),
    oil: rand(30, 90)
  }));
  console.log(`Simulating ${fleet.length} vehicles against ${API}. Press Ctrl+C to stop.`);

  const TICK_S = 2;
  setInterval(() => {
    for (const v of fleet) {
      v.speed = clamp(v.speed + rand(-12, 12), 0, 135);
      v.heading = (v.heading + rand(-15, 15) + 360) % 360;
      const metres = (v.speed / 3.6) * TICK_S;
      const rad = (v.heading * Math.PI) / 180;
      v.lat += (Math.cos(rad) * metres) / 111_000;
      v.lng += (Math.sin(rad) * metres) / (111_000 * Math.cos((v.lat * Math.PI) / 180));
      void post("/api/telemetry/position", { vehicleId: v.id, lat: v.lat, lng: v.lng, speedKph: v.speed, heading: v.heading });
    }
  }, TICK_S * 1000);

  setInterval(() => {
    for (const v of fleet) {
      v.fuel = clamp(v.fuel - rand(0.2, 1.2), 0, 100);
      v.oil = clamp(v.oil - rand(0, 0.4), 0, 100);
      if (v.fuel < 6) v.fuel = rand(70, 100); // refuel
      void post("/api/telemetry/health", {
        vehicleId: v.id,
        engineTempC: rand(84, 114),
        fuelLevelPct: v.fuel,
        batteryVoltage: rand(11.7, 13.2),
        tirePressureKpa: rand(185, 240),
        oilLifePct: v.oil
      });
    }
  }, 10_000);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
