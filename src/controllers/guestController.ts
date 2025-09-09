import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { generateRandomGuestUsername } from '../utils/username';

// Creates the guest_visits table if it does not exist, then logs a visit
export const createGuestVisit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { deviceId, platform, appVersion } = req.body as {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
  };

  // Minimal validation for payload size/type
  if (deviceId && typeof deviceId !== 'string') throw new CustomError('deviceId must be a string', 400);
  if (platform && typeof platform !== 'string') throw new CustomError('platform must be a string', 400);
  if (appVersion && typeof appVersion !== 'string') throw new CustomError('appVersion must be a string', 400);

  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
  const userAgent = (req.headers['user-agent'] as string) || null;

  // Create table if missing (portable schema without requiring extensions)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS guest_visits (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      device_id TEXT,
      platform TEXT,
      app_version TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Ensure a unique index on device_id (when provided) to prevent duplicates
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS guest_visits_device_id_uidx
    ON guest_visits (device_id)
    WHERE device_id IS NOT NULL;
  `);

  // Ensure a unique index on ip_address (when provided) to prevent duplicates by IP
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS guest_visits_ip_address_uidx
    ON guest_visits (ip_address)
    WHERE ip_address IS NOT NULL;
  `);

  // Try to find an existing visit by deviceId or ipAddress
  let existingVisit: { id: number } | undefined;

  if (deviceId) {
    const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM guest_visits WHERE device_id = $1 LIMIT 1;`,
      deviceId,
    );
    if (existing?.[0]) existingVisit = existing[0];
  }

  // If not found by deviceId, try by ipAddress
  if (!existingVisit && ipAddress) {
    const existingByIp = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM guest_visits WHERE ip_address = $1 LIMIT 1;`,
      ipAddress,
    );
    if (existingByIp?.[0]) existingVisit = existingByIp[0];
  }

  if (existingVisit) {
    res.status(201).json({
      success: true,
      message: 'Guest visit recorded',
      data: { visitId: existingVisit.id },
    });
    return;
  }

  const guestUsername = await generateRandomGuestUsername();
  const inserted = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `INSERT INTO guest_visits (username, device_id, platform, app_version, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
    guestUsername,
    deviceId || null,
    platform || null,
    appVersion || null,
    ipAddress,
    userAgent,
  );

  const visitId = inserted?.[0]?.id;

  res.status(201).json({
    success: true,
    message: 'Guest visit recorded',
    data: {
      visitId,
      username: guestUsername,
    },
  });
});


