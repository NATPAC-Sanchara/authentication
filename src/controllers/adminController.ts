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

export const adminDashboard = asyncHandler(async (req: any, res: Response): Promise<void> => {
  res.status(200).json({ success: true, message: 'Admin dashboard data', data: { metrics: {} } });
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
  // Aggregate counts
  const [
    totalUsers,
    verifiedUsers,
    totalAdmins,
    superAdmins,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.admin.count(),
    prisma.admin.count({ where: { role: 'SUPER_ADMIN' as any } }),
  ]);

  // Guest visits via raw SQL (table created dynamically in guestController)
  const guestCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS count FROM guest_visits'
  ).catch(() => [{ count: '0' }]);
  const totalGuestVisits = parseInt(guestCountRows?.[0]?.count || '0', 10);

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, isVerified: true, createdAt: true },
  });

  const recentAdmins = await prisma.admin.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, role: true, createdAt: true },
  });

  // Latest 5 guest visits if table exists
  const recentGuestVisits = await prisma.$queryRawUnsafe<Array<{
    id: number;
    device_id: string | null;
    platform: string | null;
    app_version: string | null;
    created_at: Date;
  }>>(
    'SELECT id, device_id, platform, app_version, created_at FROM guest_visits ORDER BY created_at DESC LIMIT 5'
  ).catch(() => []);

  res.status(200).json({
    success: true,
    message: 'Admin metrics',
    data: {
      totals: {
        users: totalUsers,
        verifiedUsers,
        admins: totalAdmins,
        superAdmins,
        guestVisits: totalGuestVisits,
      },
      recent: {
        users: recentUsers,
        admins: recentAdmins,
        guestVisits: recentGuestVisits,
      },
    },
  });
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
      select: { id: true, email: true, isVerified: true, createdAt: true, updatedAt: true },
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

