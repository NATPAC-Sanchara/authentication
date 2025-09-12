import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid"; // Import UUID library

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  await prisma.tripEvent.deleteMany();
  await prisma.tripPoint.deleteMany();
  await prisma.sOSEvent.deleteMany();
  await prisma.companionContact.deleteMany();
  await prisma.permissionLog.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();

  console.log("Creating admin...");
  await prisma.admin.create({
    data: {
      email: "superadmin@sanchara.com",
      password: await argon2.hash("sadmin@sanchara"),
      isVerified: true,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Creating users with unique trips, points, and events...");
  for (let i = 0; i < 50; i++) {
    const user = await prisma.user.create({
      data: {
        email: `user${i}@example.com`,
        username: `user${i}`,
        password: await argon2.hash("password123"),
        isVerified: true,
      },
    });

    const trip = await prisma.trip.create({
      data: {
        userid: user.id,
        deviceid: `device-${user.id}`,
        startedAt: new Date(),
        endedAt: new Date(Date.now() + 3600000),
        startLat: 12.9716 + Math.random() * 0.01,
        startLng: 77.5946 + Math.random() * 0.01,
        endLat: 12.9716 + Math.random() * 0.01,
        endLng: 77.5946 + Math.random() * 0.01,
        modes: ["walk", "bike"],
        distanceMeters: Math.floor(Math.random() * 10000),
        durationSeconds: Math.floor(Math.random() * 3600),
      },
    });

    await prisma.tripPoint.create({
      data: {
        tripId: trip.id,
        timestamp: new Date(),
        lat: 12.9716 + Math.random() * 0.01,
        lng: 77.5946 + Math.random() * 0.01,
        speed: Math.random() * 10,
        accuracy: Math.random() * 5,
        heading: Math.random() * 360,
        mode: "walk",
        clientId: uuidv4(),
      },
    });

    await prisma.tripEvent.create({
      data: {
        tripId: trip.id,
        type: "event_type",
        data: { info: "sample event data" },
      },
    });

    await prisma.permissionLog.create({
      data: {
        userid: user.id,
        deviceid: `device-${user.id}`,
        permission: "LOCATION",
        status: "granted",
      },
    });

    await prisma.companionContact.create({
      data: {
        userid: user.id,
        name: `Companion ${user.username}`,
        email: `companion${user.id}@example.com`,
        phone: `+9112345678${Math.floor(Math.random() * 90 + 10)}`,
      },
    });

    await prisma.sOSEvent.create({
      data: {
        userid: user.id,
        lat: 12.9716 + Math.random() * 0.01,
        lng: 77.5946 + Math.random() * 0.01,
        handled: Math.random() > 0.5,
      },
    });
  }

  console.log("Database seeded with unique relationships successfully!");
}

main()
  .catch((e) => {
    console.error("Error in seeding", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
