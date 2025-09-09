import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { config } from '../config/env';

export const adminSignUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('Admin with this email already exists', 409);
  }

  const hashed = await PasswordUtils.hash(password);
  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'ADMIN',
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });

  const token = JWTUtils.generateToken(admin as any, 'ADMIN');
  res.status(201).json({ success: true, message: 'Admin created', data: { user: admin, token } });
});

export const adminSignIn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin) {
    throw new CustomError('Invalid credentials', 401);
  }
  const valid = await PasswordUtils.verify(admin.password, password);
  if (!valid) {
    throw new CustomError('Invalid credentials', 401);
  }

  const token = JWTUtils.generateToken(admin as any, 'ADMIN');

  res.status(200).json({
    success: true,
    message: 'Admin signed in',
    data: {
      user: { id: admin.id, email: admin.email, isVerified: admin.isVerified, role: admin.role, createdAt: admin.createdAt, updatedAt: admin.updatedAt },
      token,
    },
  });
});

export const createAdminBySuperAdmin = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('User with this email already exists', 409);
  }
  const hashed = await PasswordUtils.hash(password);
  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'ADMIN',
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json({ success: true, message: 'New admin created', data: { user: admin } });
});

// Shared metrics computation for dashboard and metrics endpoint
const computeAdminMetrics = async () => {
  const [
    totalUsers,
    verifiedUsers,
    totalAdmins,
    superAdmins,
    totalTrips,
    activeTrips,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.admin.count(),
    prisma.admin.count({ where: { role: 'SUPER_ADMIN' as any } }),
    prisma.trip.count(),
    prisma.trip.count({ where: { endedAt: null } }),
  ]);

  const guestCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS count FROM guest_visits'
  ).catch(() => [{ count: '0' }]);
  const totalGuestVisits = parseInt(guestCountRows?.[0]?.count || '0', 10);

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, username: true, isVerified: true, createdAt: true },
  });

  const recentAdmins = await prisma.admin.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, role: true, createdAt: true },
  });

  const recentGuestVisits = await prisma.$queryRawUnsafe<Array<{
    id: number;
    username: string | null;
    device_id: string | null;
    platform: string | null;
    app_version: string | null;
    created_at: Date;
  }>>(
    'SELECT id, username, device_id, platform, app_version, created_at FROM guest_visits ORDER BY created_at DESC LIMIT 5'
  ).catch(() => []);

  return {
    totals: {
      users: totalUsers,
      verifiedUsers,
      admins: totalAdmins,
      superAdmins,
      trips: totalTrips,
      activeTrips,
      guestVisits: totalGuestVisits,
    },
    recent: {
      users: recentUsers,
      admins: recentAdmins,
      guestVisits: recentGuestVisits,
    },
  };
};

export const adminDashboard = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const metrics = await computeAdminMetrics();
  res.status(200).json({ success: true, message: 'Admin dashboard data', data: { metrics } });
});

export const bootstrapSuperAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password, secret } = req.body as { email: string; password: string; secret: string };

  if (!config.admin.setupSecret) {
    throw new CustomError('Bootstrap is not configured', 400);
  }
  if (secret !== config.admin.setupSecret) {
    throw new CustomError('Invalid bootstrap secret', 401);
  }

  const existingSuper = await prisma.admin.findFirst({ where: { role: 'SUPER_ADMIN' as any } });
  if (existingSuper) {
    throw new CustomError('SUPER_ADMIN already exists', 409);
  }

  const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('User with this email already exists', 409);
  }

  const hashed = await PasswordUtils.hash(password);
  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'SUPER_ADMIN' as any,
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });

  const token = JWTUtils.generateToken(admin as any, 'ADMIN');
  res.status(201).json({ success: true, message: 'SUPER_ADMIN bootstrapped', data: { user: admin, token} });
});


// Admin metrics: users, admins, guest visits
export const getAdminMetrics = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const metrics = await computeAdminMetrics();
  res.status(200).json({ success: true, message: 'Admin metrics', data: metrics });
});

// List users with pagination and optional email search
export const listUsers = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || '20', 10), 1), 100);
  const search = (req.query.search as string) || '';

  const where = search
    ? { email: { contains: search.toLowerCase() } }
    : {};

  const [total, items] = await Promise.all([
    prisma.user.count({ where: where as any }),
    prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, username: true, isVerified: true, createdAt: true, updatedAt: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Users list',
    data: { total, page, pageSize, items },
  });
});

// List guest visits with pagination
export const listGuestVisits = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;

  const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS count FROM guest_visits'
  ).catch(() => [{ count: '0' }]);
  const total = parseInt(totalRows?.[0]?.count || '0', 10);

  const items = await prisma.$queryRawUnsafe<Array<{
    id: number;
    device_id: string | null;
    platform: string | null;
    app_version: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>>(
    'SELECT id, device_id, platform, app_version, ip_address, user_agent, created_at FROM guest_visits ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    pageSize,
    offset,
  ).catch(() => []);

  res.status(200).json({
    success: true,
    message: 'Guest visits list',
    data: { total, page, pageSize, items },
  });
});

// =============================
// Rich Analytics & Admin Views
// =============================

export const getAdminOverviewAnalytics = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const days = Math.max(parseInt((req.query.days as string) || '30', 10), 1);

  const [metrics, tripAgg, userAgg] = await Promise.all([
    (async () => await (await computeAdminMetrics))?.() || (await computeAdminMetrics()),
    prisma.$queryRawUnsafe<Array<{ day: string; trips: number; distance: number; duration: number }>>(
      `SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS trips,
              COALESCE(SUM(distance_meters),0)::int AS distance,
              COALESCE(SUM(duration_seconds),0)::int AS duration
       FROM trips
       WHERE started_at >= NOW() - INTERVAL '${days} days'
       GROUP BY 1
       ORDER BY 1 ASC`
    ).catch(() => []),
    prisma.$queryRawUnsafe<Array<{ day: string; users: number }>>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT user_id)::int AS users
       FROM (
         SELECT date_trunc('day', started_at) AS day, user_id FROM trips
         WHERE started_at >= NOW() - INTERVAL '${days} days'
       ) t
       GROUP BY 1
       ORDER BY 1 ASC`
    ).catch(() => []),
  ]);

  const avgTripDistance = await prisma.trip.aggregate({ _avg: { distanceMeters: true } });
  const avgTripDuration = await prisma.trip.aggregate({ _avg: { durationSeconds: true } });

  res.status(200).json({
    success: true,
    message: 'Admin overview analytics',
    data: {
      metrics,
      timeseries: { trips: tripAgg, activeUsers: userAgg },
      averages: {
        distanceMeters: Math.round(avgTripDistance._avg.distanceMeters || 0),
        durationSeconds: Math.round(avgTripDuration._avg.durationSeconds || 0),
      },
    },
  });
});

export const listTripsAdmin = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || '20', 10), 1), 100);
  const search = (req.query.search as string) || '';

  const where: any = search
    ? {
        OR: [
          { user: { email: { contains: search.toLowerCase() } } },
          { user: { username: { contains: search.toLowerCase() } } },
          { modes: { has: search.toLowerCase() } },
        ],
      }
    : {};

  const [total, items] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        modes: true,
        distanceMeters: true,
        durationSeconds: true,
        user: { select: { id: true, email: true, username: true } },
      },
    }),
  ]);

  res.status(200).json({ success: true, message: 'Trips list', data: { total, page, pageSize, items } });
});

export const getTripDetailAdmin = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const { tripId } = req.params as { tripId: string };
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      modes: true,
      distanceMeters: true,
      durationSeconds: true,
      startLat: true,
      startLng: true,
      endLat: true,
      endLng: true,
      destLat: true,
      destLng: true,
      user: { select: { id: true, email: true, username: true } },
    },
  });
  if (!trip) throw new CustomError('Trip not found', 404);

  const points = await prisma.tripPoint.findMany({ where: { tripId }, orderBy: { timestamp: 'asc' }, select: { timestamp: true, lat: true, lng: true, speed: true, accuracy: true } });
  res.status(200).json({ success: true, message: 'Trip detail', data: { trip, points } });
});

export const getGuestVisitsTimeSeries = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const days = Math.max(parseInt((req.query.days as string) || '30', 10), 1);
  const rows = await prisma.$queryRawUnsafe<Array<{ day: string; visits: number }>>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS visits
     FROM guest_visits
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY 1
     ORDER BY 1 ASC`
  ).catch(() => []);
  res.status(200).json({ success: true, message: 'Guest visits timeseries', data: rows });
});

export const getPermissionsStats = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const rows = await prisma.$queryRawUnsafe<Array<{ permission: string; status: string; count: number }>>(
    `SELECT permission, status, COUNT(*)::int AS count
     FROM permission_logs
     GROUP BY permission, status
     ORDER BY permission, status`
  ).catch(() => []);
  res.status(200).json({ success: true, message: 'Permissions stats', data: rows });
});

export const getTripPointsHeatmap = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const since = (req.query.since as string) || '';
  const where = since ? `WHERE timestamp >= to_timestamp(${Number(since) / 1000})` : '';
  // Aggregate into ~1km bins (approx 0.01 deg). Adjust for your needs.
  const rows = await prisma.$queryRawUnsafe<Array<{ lat: number; lng: number; count: number }>>(
    `SELECT ROUND(lat::numeric, 2)::double precision AS lat,
            ROUND(lng::numeric, 2)::double precision AS lng,
            COUNT(*)::int AS count
     FROM trip_points
     ${where}
     GROUP BY 1,2
     ORDER BY count DESC
     LIMIT 10000`
  ).catch(() => []);
  res.status(200).json({ success: true, message: 'Trip points heatmap', data: rows });
});

