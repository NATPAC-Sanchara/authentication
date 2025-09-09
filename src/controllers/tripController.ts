import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { encryptToBase64 } from '../utils/crypto';

export const startTrip = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);

  const { timestamp, lat, lng, deviceId, modes, companions, destLat, destLng, destAddress } = req.body as {
    timestamp?: string | number;
    lat?: number;
    lng?: number;
    deviceId?: string;
    modes?: string[];
    companions?: any;
    destLat?: number;
    destLng?: number;
    destAddress?: string;
  };

  const startedAt = timestamp ? new Date(timestamp) : new Date();

  // End any active trip for this user from before, safety guard
  await prisma.trip.updateMany({
    where: { userId: user.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      deviceId: deviceId || null,
      startedAt,
      startLat: typeof lat === 'number' ? lat : null,
      startLng: typeof lng === 'number' ? lng : null,
      modes: Array.isArray(modes) ? modes : [],
      companions: companions ?? null,
      destLat: typeof destLat === 'number' ? destLat : null,
      destLng: typeof destLng === 'number' ? destLng : null,
      destAddressEncrypted: destAddress ? encryptToBase64(destAddress) : null,
    },
    select: { id: true, userId: true, deviceId: true, startedAt: true, startLat: true, startLng: true, modes: true, companions: true, destLat: true, destLng: true },
  });

  res.status(201).json({ success: true, message: 'Trip started', data: { trip } });
});

export const ingestLocation = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);

  const { tripId, timestamp, lat, lng, speed, accuracy, heading, clientId, mode } = req.body as {
    tripId: string;
    timestamp?: string | number;
    lat: number;
    lng: number;
    speed?: number;
    accuracy?: number;
    heading?: number;
    clientId?: string;
    mode?: string;
  };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);
  if (trip.endedAt) throw new CustomError('Trip already ended', 400);

  const when = timestamp ? new Date(timestamp) : new Date();
  await prisma.tripPoint.create({
    data: {
      tripId: trip.id,
      timestamp: when,
      lat,
      lng,
      speed: typeof speed === 'number' ? speed : null,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      heading: typeof heading === 'number' ? heading : null,
      mode: mode || null,
      clientId: clientId || null,
    },
  });

  res.status(201).json({ success: true, message: 'Location ingested' });
});

export const stopTrip = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);

  const { tripId, timestamp, lat, lng } = req.body as {
    tripId: string;
    timestamp?: string | number;
    lat?: number;
    lng?: number;
  };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);
  if (trip.endedAt) throw new CustomError('Trip already ended', 400);

  const endedAt = timestamp ? new Date(timestamp) : new Date();
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      endedAt,
      endLat: typeof lat === 'number' ? lat : null,
      endLng: typeof lng === 'number' ? lng : null,
    },
    select: { id: true, userId: true, startedAt: true, endedAt: true, startLat: true, startLng: true, endLat: true, endLng: true, modes: true },
  });

  res.status(200).json({ success: true, message: 'Trip stopped', data: { trip: updated } });
});


