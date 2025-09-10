import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const logPermission = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user || null;
  const { deviceid, permission, status, error } = req.body as { deviceid?: string; permission: string; status: string; error?: string };
  const row = await prisma.permissionLog.create({ data: { userid: user?.id || null, deviceid: deviceid || null, permission, status, error: error || null } });
  res.status(201).json({ success: true, message: 'Permission logged', data: { id: row.id } });
});

export const getPermissionStatus = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user || null;
  const deviceid = (req.query.deviceid as string) || null;
  const permission = (req.query.permission as string) || null;

  const where: any = {};
  if (user?.id) where.userid = user.id;
  if (deviceid) where.deviceid = deviceid;
  if (permission) where.permission = permission;

  const latest = await prisma.permissionLog.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { permission: true, status: true, error: true, createdAt: true } });
  res.status(200).json({ success: true, message: 'Permission status', data: latest || null });
});


