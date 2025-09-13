import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

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

  console.log("Creating users with diverse and unique data...");

  const modesOptions = [["walk"], ["bike"], ["car"], ["walk", "bike"], ["bike", "car"]];
  const eventTypes = ["start", "stop", "pause", "error"];
  const permissions = ["LOCATION", "CAMERA", "STORAGE"];
  const statusOptions = ["granted", "denied"];
  const companionNames = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Chris", "Pat", "Lee"];

  for (let i = 0; i < 50; i++) {
    const email = `user${i}@example.com`;
    const username = `user${i}`;
    const isVerified = Math.random() > 0.5;
    const createdAt = randomDate(new Date(2023, 0, 1), new Date(2023, 11, 31)); // Random month & date in 2023

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: await argon2.hash("password123"),
        isVerified,
        createdAt,
      },
    });

    const startLat = 12.9716 + (Math.random() - 0.5) * 0.05;
    const startLng = 77.5946 + (Math.random() - 0.5) * 0.05;
    const endLat = startLat + (Math.random() - 0.5) * 0.02;
    const endLng = startLng + (Math.random() - 0.5) * 0.02;
    const distance = Math.floor(Math.random() * 15000) + 500;
    const duration = Math.floor(Math.random() * 7200) + 300;
    const modes = getRandomElement(modesOptions);
    const startedAt = randomDate(new Date(2023, 0, 1), new Date(2023, 11, 31));
    const endedAt = new Date(startedAt.getTime() + duration * 1000);

    const trip = await prisma.trip.create({
      data: {
        userid: user.id,
        deviceid: `device-${user.id}`,
        startedAt,
        endedAt,
        startLat,
        startLng,
        endLat,
        endLng,
        modes,
        distanceMeters: distance,
        durationSeconds: duration,
      },
    });

    // Create trip point with random values
    await prisma.tripPoint.create({
      data: {
        tripId: trip.id,
        timestamp: randomDate(startedAt, endedAt),
        lat: startLat + (Math.random() - 0.5) * 0.01,
        lng: startLng + (Math.random() - 0.5) * 0.01,
        speed: parseFloat((Math.random() * 10).toFixed(2)),
        accuracy: parseFloat((Math.random() * 5).toFixed(2)),
        heading: parseFloat((Math.random() * 360).toFixed(2)),
        mode: getRandomElement(["walk", "bike", "car"]),
        clientId: uuidv4(),
      },
    });

    // Create trip event with random type
    await prisma.tripEvent.create({
      data: {
        tripId: trip.id,
        type: getRandomElement(eventTypes),
        data: { info: `Event for ${username}` },
      },
    });

    // Create permission log with random status
    await prisma.permissionLog.create({
      data: {
        userid: user.id,
        deviceid: `device-${user.id}`,
        permission: getRandomElement(permissions),
        status: getRandomElement(statusOptions),
      },
    });

    // Create companion contact with random details
    const companionName = getRandomElement(companionNames);
    await prisma.companionContact.create({
      data: {
        userid: user.id,
        name: `${companionName} Companion`,
        email: `companion${user.id}@example.com`,
        phone: `+91123${Math.floor(Math.random() * 10000000).toString().padStart(8, "0")}`,
      },
    });

    // Create SOS event with random location and handled status
    await prisma.sOSEvent.create({
      data: {
        userid: user.id,
        lat: startLat + (Math.random() - 0.5) * 0.05,
        lng: startLng + (Math.random() - 0.5) * 0.05,
        handled: Math.random() > 0.5,
      },
    });
  }

  console.log("Database seeded with diverse and unique data across the entire year!");
}

main()
  .catch((e) => {
    console.error("Error in seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
