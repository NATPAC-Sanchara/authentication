import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

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

  // If a deviceId is provided and already recorded, return success without inserting
  if (deviceId) {
    const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM guest_visits WHERE device_id = $1 LIMIT 1;`,
      deviceId,
    );
    const existingId = existing?.[0]?.id;
    if (existingId) {
      res.status(201).json({
        success: true,
        message: 'Guest visit recorded',
        data: { visitId: existingId },
      });
      return;
    }
  }

  const inserted = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `INSERT INTO guest_visits (device_id, platform, app_version, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
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
    },
  });
});


