import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { config } from '../config/env';

export const adminSignUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('Admin with this email already exists', 409);
  }

  const hashed = await PasswordUtils.hash(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'ADMIN',
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });

  const token = JWTUtils.generateToken(user as any);
  res.status(201).json({ success: true, message: 'Admin created', data: { user, token } });
});

export const adminSignIn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    throw new CustomError('Invalid credentials', 401);
  }
  const valid = await PasswordUtils.verify(user.password, password);
  if (!valid) {
    throw new CustomError('Invalid credentials', 401);
  }

  const token = JWTUtils.generateToken({
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    role: user.role as any,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as any);

  res.status(200).json({
    success: true,
    message: 'Admin signed in',
    data: {
      user: { id: user.id, email: user.email, isVerified: user.isVerified, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt },
      token,
    },
  });
});

export const createAdminBySuperAdmin = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('User with this email already exists', 409);
  }
  const hashed = await PasswordUtils.hash(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'ADMIN',
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json({ success: true, message: 'New admin created', data: { user } });
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

  const existingSuper = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' as any } });
  if (existingSuper) {
    throw new CustomError('SUPER_ADMIN already exists', 409);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new CustomError('User with this email already exists', 409);
  }

  const hashed = await PasswordUtils.hash(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      isVerified: true,
      role: 'SUPER_ADMIN' as any,
    },
    select: { id: true, email: true, isVerified: true, role: true, createdAt: true, updatedAt: true },
  });

  const token = JWTUtils.generateToken(user as any);
  res.status(201).json({ success: true, message: 'SUPER_ADMIN bootstrapped', data: { user, token } });
});


