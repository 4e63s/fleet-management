import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type { RealtimeBus } from "../../realtime/events";
import type { AlertsService } from "../alerts/alerts.service";
import { computeHealthScore, evaluateHealthAlerts, evaluateSpeedAlert } from "./health";
import type { HealthIngest, HistoryQuery, PositionIngest } from "./telemetry.schemas";

export function createTelemetryService(prisma: PrismaClient, bus: RealtimeBus, alerts: AlertsService) {
  async function requireVehicle(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, plate: true } });
    if (!vehicle) throw AppError.notFound("Vehicle not found");
    return vehicle;
  }

  return {
    async ingestPosition(input: PositionIngest) {
      const vehicle = await requireVehicle(input.vehicleId);
      const row = await prisma.positionLog.create({
        data: {
          vehicleId: vehicle.id,
          lat: input.lat,
          lng: input.lng,
          speedKph: input.speedKph,
          heading: input.heading,
          recordedAt: input.recordedAt ?? new Date()
        }
      });

      bus.emitPosition({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        lat: row.lat,
        lng: row.lng,
        speedKph: row.speedKph,
        heading: row.heading,
        recordedAt: row.recordedAt.toISOString()
      });

      const speeding = evaluateSpeedAlert(row.speedKph);
      if (speeding) await alerts.raise(vehicle.id, vehicle.plate, [speeding]);

      return row;
    },

    async ingestHealth(input: HealthIngest) {
      const vehicle = await requireVehicle(input.vehicleId);
      const healthScore = computeHealthScore(input);
      const row = await prisma.healthReading.create({
        data: {
          vehicleId: vehicle.id,
          engineTempC: input.engineTempC,
          fuelLevelPct: input.fuelLevelPct,
          batteryVoltage: input.batteryVoltage,
          tirePressureKpa: input.tirePressureKpa,
          oilLifePct: input.oilLifePct,
          healthScore,
          recordedAt: input.recordedAt ?? new Date()
        }
      });

      bus.emitHealth({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        engineTempC: row.engineTempC,
        fuelLevelPct: row.fuelLevelPct,
        batteryVoltage: row.batteryVoltage,
        tirePressureKpa: row.tirePressureKpa,
        oilLifePct: row.oilLifePct,
        healthScore: row.healthScore,
        recordedAt: row.recordedAt.toISOString()
      });

      await alerts.raise(vehicle.id, vehicle.plate, evaluateHealthAlerts(input));
      return row;
    },

    /** Latest known position for every non-retired vehicle (initial map load). */
    async livePositions() {
      const vehicles = await prisma.vehicle.findMany({
        where: { status: { not: "RETIRED" } },
        select: {
          id: true,
          plate: true,
          make: true,
          model: true,
          status: true,
          positions: { orderBy: { recordedAt: "desc" }, take: 1 }
        }
      });
      return vehicles
        .filter((v) => v.positions.length > 0)
        .map((v) => {
          const p = v.positions[0];
          return {
            vehicleId: v.id,
            plate: v.plate,
            make: v.make,
            model: v.model,
            status: v.status,
            lat: p.lat,
            lng: p.lng,
            speedKph: p.speedKph,
            heading: p.heading,
            recordedAt: p.recordedAt.toISOString()
          };
        });
    },

    async positionHistory(vehicleId: string, q: HistoryQuery) {
      await requireVehicle(vehicleId);
      const recordedAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {})
      };
      return prisma.positionLog.findMany({
        where: { vehicleId, ...(q.from || q.to ? { recordedAt } : {}) },
        orderBy: { recordedAt: "desc" },
        take: q.limit
      });
    },

    async healthHistory(vehicleId: string, q: HistoryQuery) {
      await requireVehicle(vehicleId);
      const recordedAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {})
      };
      return prisma.healthReading.findMany({
        where: { vehicleId, ...(q.from || q.to ? { recordedAt } : {}) },
        orderBy: { recordedAt: "desc" },
        take: q.limit
      });
    },

    async latestHealth(vehicleId: string) {
      await requireVehicle(vehicleId);
      const row = await prisma.healthReading.findFirst({ where: { vehicleId }, orderBy: { recordedAt: "desc" } });
      if (!row) throw AppError.notFound("No health readings for this vehicle yet");
      return row;
    },

    /** Latest health reading per vehicle, used by the Vehicle Health screen. */
    async healthOverview() {
      const vehicles = await prisma.vehicle.findMany({
        where: { status: { not: "RETIRED" } },
        orderBy: { plate: "asc" },
        select: {
          id: true,
          plate: true,
          make: true,
          model: true,
          status: true,
          healthLogs: { orderBy: { recordedAt: "desc" }, take: 1 }
        }
      });
      return vehicles.map((v) => ({
        vehicleId: v.id,
        plate: v.plate,
        make: v.make,
        model: v.model,
        status: v.status,
        latest: v.healthLogs[0]
          ? { ...v.healthLogs[0], recordedAt: v.healthLogs[0].recordedAt.toISOString() }
          : null
      }));
    }
  };
}

export type TelemetryService = ReturnType<typeof createTelemetryService>;
