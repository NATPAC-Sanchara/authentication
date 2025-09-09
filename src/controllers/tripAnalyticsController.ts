import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const listTrips = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);

  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || '20', 10), 1), 100);

  const [total, items] = await Promise.all([
    prisma.trip.count({ where: { userId: user.id } }),
    prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, startedAt: true, endedAt: true, modes: true, distanceMeters: true, durationSeconds: true },
    }),
  ]);

  res.status(200).json({ success: true, message: 'Trips list', data: { total, page, pageSize, items } });
});

export const getTripDetail = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { tripId } = req.params as { tripId: string };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);

  const points = await prisma.tripPoint.findMany({ where: { tripId: trip.id }, orderBy: { timestamp: 'asc' }, select: { timestamp: true, lat: true, lng: true, speed: true } });
  const pointsWithMode = await prisma.tripPoint.findMany({ where: { tripId: trip.id }, orderBy: { timestamp: 'asc' }, select: { lat: true, lng: true, mode: true } });
  let distance = 0;
  const byMode: Record<string, number> = {};
  for (let i = 1; i < pointsWithMode.length; i++) {
    const d = haversine(pointsWithMode[i - 1].lat, pointsWithMode[i - 1].lng, pointsWithMode[i].lat, pointsWithMode[i].lng);
    distance += d;
    const m = pointsWithMode[i].mode || 'unknown';
    byMode[m] = (byMode[m] || 0) + d;
  }

  const durationSec = trip.endedAt ? Math.max(0, Math.floor((trip.endedAt.getTime() - trip.startedAt.getTime()) / 1000)) : null;
  const avgSpeed = durationSec && durationSec > 0 ? distance / durationSec : null;

  res.status(200).json({
    success: true,
    message: 'Trip detail',
    data: {
      trip: {
        id: trip.id,
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        modes: (trip as any).modes || [],
        distanceMeters: Math.round(distance),
        durationSeconds: durationSec,
        averageSpeedMps: avgSpeed,
        distanceByMode: Object.fromEntries(Object.entries(byMode).map(([k,v]) => [k, Math.round(v)])),
      },
      points,
    },
  });
});

export const updateTripDetails = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { tripId } = req.params as { tripId: string };
  const { modes, companions, destLat, destLng, destAddress } = req.body as any;

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);
  if (trip.endedAt) throw new CustomError('Trip already ended', 400);

  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      modes: Array.isArray(modes) ? modes : (trip as any).modes,
      companions: companions ?? trip.companions,
      destLat: typeof destLat === 'number' ? destLat : trip.destLat,
      destLng: typeof destLng === 'number' ? destLng : trip.destLng,
      destAddressEncrypted: destAddress ? require('../utils/crypto').encryptToBase64(destAddress) : trip.destAddressEncrypted,
      updatedAt: new Date(),
    },
    select: { id: true, startedAt: true, endedAt: true, modes: true, destLat: true, destLng: true },
  });

  res.status(200).json({ success: true, message: 'Trip updated', data: { trip: updated } });
});

export const batchIngestLocations = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { tripId, points } = req.body as { tripId: string; points: Array<{ clientId?: string; timestamp?: number | string; lat: number; lng: number; mode?: string; speed?: number; accuracy?: number; heading?: number }>; };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);
  if (trip.endedAt) throw new CustomError('Trip already ended', 400);

  const data = (points || []).slice(0, 1000).map((p) => ({
    id: undefined as any,
    tripId: trip.id,
    timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
    lat: p.lat,
    lng: p.lng,
    speed: typeof p.speed === 'number' ? p.speed : null,
    accuracy: typeof p.accuracy === 'number' ? p.accuracy : null,
    heading: typeof p.heading === 'number' ? p.heading : null,
    mode: p.mode || null,
    clientId: p.clientId || null,
    createdAt: undefined as any,
  }));

  // Deduplicate by (tripId, clientId) where clientId provided
  const withClientId = data.filter((d) => d.clientId);
  if (withClientId.length > 0) {
    const values = withClientId.map((d) => `('${d.tripId}','${d.clientId}')`).join(',');
    await prisma.$executeRawUnsafe(`
      DELETE FROM trip_points t
      USING (VALUES ${values}) AS v(tripId, clientId)
      WHERE t.trip_id = v.tripId AND t.client_id = v.clientId;
    `);
  }

  await prisma.tripPoint.createMany({ data, skipDuplicates: true });
  res.status(201).json({ success: true, message: 'Batch locations ingested', data: { inserted: data.length } });
});

export const logTripEvent = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { tripId, type, data } = req.body as { tripId: string; type: string; data?: any };

  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
  if (!trip) throw new CustomError('Trip not found', 404);

  const event = await prisma.tripEvent.create({ data: { tripId: trip.id, type, data: data ?? null }, select: { id: true, type: true, createdAt: true } });
  res.status(201).json({ success: true, message: 'Event logged', data: { event } });
});


