import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { LiveMap } from "./pages/LiveMap";
import { Login } from "./pages/Login";
import { VehicleHealth } from "./pages/VehicleHealth";
import { Vehicles } from "./pages/Vehicles";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="live" element={<LiveMap />} />
          <Route path="health" element={<VehicleHealth />} />
          <Route path="vehicles" element={<Vehicles />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-petrol-500">This page doesn't exist. Use the menu to get back to the fleet.</p>
          </div>
        }
      />
    </Routes>
  );
}
