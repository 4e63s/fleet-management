import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { FleetSocketProvider, useFleet } from "../hooks/FleetSocketContext";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/live", label: "Live map" },
  { to: "/health", label: "Vehicle health" },
  { to: "/vehicles", label: "Vehicles" }
];

function ConnectionIndicator() {
  const { connected } = useFleet();
  return (
    <p className="flex items-center gap-2 text-sm text-petrol-300" role="status">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${connected ? "live-dot bg-ok" : "bg-petrol-500"}`} />
      {connected ? "Receiving live data" : "Reconnecting…"}
    </p>
  );
}

function Shell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-petrol px-5 py-4 text-white md:w-60 md:py-6">
        <div>
          <p className="font-display text-2xl font-semibold leading-none tracking-wide">Fleet Control</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-white text-petrol" : "text-petrol-300 hover:bg-petrol-700 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <ConnectionIndicator />
          <div className="border-t border-petrol-700 pt-3">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-petrol-300">{user?.role.toLowerCase()}</p>
            <button type="button" onClick={() => void logout()} className="mt-2 text-sm text-petrol-300 underline hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function Layout() {
  return (
    <FleetSocketProvider>
      <Shell />
    </FleetSocketProvider>
  );
}
