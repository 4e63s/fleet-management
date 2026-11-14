import { PrismaClient, Role, VehicleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("Admin#12345", 12);
  await prisma.user.upsert({
    where: { email: "admin@fleet.local" },
    update: {},
    create: { email: "admin@fleet.local", name: "Fleet Admin", role: Role.ADMIN, passwordHash: adminHash }
  });

  const driverData = [
    { name: "Omar Al-Harbi", licenseNumber: "LIC-1001", phone: "+966500000001" },
    { name: "Sara Al-Qahtani", licenseNumber: "LIC-1002", phone: "+966500000002" },
    { name: "Khalid Nasser", licenseNumber: "LIC-1003", phone: "+966500000003" }
  ];
  const drivers = [];
  for (const d of driverData) {
    drivers.push(await prisma.driver.upsert({ where: { licenseNumber: d.licenseNumber }, update: {}, create: d }));
  }

  const vehicles = [
    { plate: "ABC-1234", vin: "1HGCM82633A000001", make: "Toyota", model: "Hilux", year: 2022 },
    { plate: "DEF-5678", vin: "1HGCM82633A000002", make: "Isuzu", model: "NPR", year: 2021 },
    { plate: "GHI-9012", vin: "1HGCM82633A000003", make: "Ford", model: "Transit", year: 2023 }
  ];

  for (let i = 0; i < vehicles.length; i++) {
    await prisma.vehicle.upsert({
      where: { plate: vehicles[i].plate },
      update: {},
      create: { ...vehicles[i], status: VehicleStatus.ACTIVE, odometerKm: 12000 + i * 8000, driverId: drivers[i].id }
    });
  }
  console.log("Seed complete. Admin: admin@fleet.local / Admin#12345 (change it immediately).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
