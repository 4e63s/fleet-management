import type { AlertSeverity, PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { toSkipTake, type Page, type Pagination } from "../../lib/pagination";
import type { RealtimeBus } from "../../realtime/events";
import type { AlertDraft } from "../telemetry/health";

export const ALERT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export interface AlertListQuery extends Pagination {
  vehicleId?: string;
  severity?: AlertSeverity;
  acknowledged?: boolean;
}

export function createAlertsService(prisma: PrismaClient, bus: RealtimeBus) {
  return {
    async list(query: AlertListQuery): Promise<Page<unknown>> {
      const where = {
        ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.acknowledged !== undefined ? { acknowledged: query.acknowledged } : {})
      };
      const [items, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { vehicle: { select: { plate: true } } },
          ...toSkipTake(query)
        }),
        prisma.alert.count({ where })
      ]);
      return { items, total, page: query.page, pageSize: query.pageSize };
    },

    async acknowledge(id: string) {
      const existing = await prisma.alert.findUnique({ where: { id } });
      if (!existing) throw AppError.notFound("Alert not found");
      return prisma.alert.update({ where: { id }, data: { acknowledged: true } });
    },

    /**
     * Persists alerts and pushes them to connected clients. An alert of the same
     * type for the same vehicle is skipped while an unacknowledged one younger
     * than ALERT_DEDUPE_WINDOW_MS exists, so noisy sensors do not flood the UI.
     */
    async raise(vehicleId: string, plate: string, drafts: AlertDraft[]) {
      const created = [];
      for (const draft of drafts) {
        const duplicate = await prisma.alert.findFirst({
          where: {
            vehicleId,
            type: draft.type,
            acknowledged: false,
            createdAt: { gte: new Date(Date.now() - ALERT_DEDUPE_WINDOW_MS) }
          }
        });
        if (duplicate) continue;

        const alert = await prisma.alert.create({
          data: { vehicleId, type: draft.type, severity: draft.severity, message: draft.message }
        });
        bus.emitAlert({
          id: alert.id,
          vehicleId,
          plate,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          createdAt: alert.createdAt.toISOString()
        });
        created.push(alert);
      }
      return created;
    }
  };
}

export type AlertsService = ReturnType<typeof createAlertsService>;
