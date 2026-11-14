import type { PrismaClient } from "@prisma/client";

export function createDashboardService(prisma: PrismaClient) {
  return {
    async summary() {
      const now = new Date();
      const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [byStatus, openAlerts, criticalAlerts, upcomingMaintenance, vehiclesWithHealth] = await Promise.all([
        prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.alert.count({ where: { acknowledged: false } }),
        prisma.alert.count({ where: { acknowledged: false, severity: "CRITICAL" } }),
        prisma.maintenanceRecord.count({
          where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: inSevenDays } }
        }),
        prisma.vehicle.findMany({
          where: { status: { not: "RETIRED" } },
          select: { healthLogs: { orderBy: { recordedAt: "desc" }, take: 1, select: { healthScore: true } } }
        })
      ]);

      const statusCounts: Record<string, number> = { ACTIVE: 0, IDLE: 0, MAINTENANCE: 0, RETIRED: 0 };
      for (const row of byStatus) statusCounts[row.status] = row._count._all;

      const scores = vehiclesWithHealth.flatMap((v) => v.healthLogs.map((h) => h.healthScore));
      const averageHealth = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      return {
        totalVehicles: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        statusCounts,
        openAlerts,
        criticalAlerts,
        upcomingMaintenance,
        averageHealth
      };
    }
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
