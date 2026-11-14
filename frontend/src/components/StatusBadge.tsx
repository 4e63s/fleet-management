import type { VehicleStatus } from "../api/types";
import { statusLabels } from "../lib/health";

const dot: Record<VehicleStatus, string> = {
  ACTIVE: "bg-ok",
  IDLE: "bg-petrol-300",
  MAINTENANCE: "bg-warn",
  RETIRED: "bg-petrol-500"
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-petrol-700">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot[status]}`} />
      {statusLabels[status]}
    </span>
  );
}
