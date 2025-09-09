import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

export const listCompanions = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const items = await prisma.companionContact.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  res.status(200).json({ success: true, message: 'Companions list', data: { items } });
});

export const upsertCompanion = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { id, name, email, phone } = req.body as { id?: string; name: string; email?: string; phone?: string };
  const data = { userId: user.id, name, email: email || null, phone: phone || null } as any;
  const item = id
    ? await prisma.companionContact.update({ where: { id }, data, })
    : await prisma.companionContact.create({ data });
  res.status(200).json({ success: true, message: 'Companion saved', data: { item } });
});

export const deleteCompanion = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { id } = req.params as { id: string };
  const existing = await prisma.companionContact.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new CustomError('Not found', 404);
  await prisma.companionContact.delete({ where: { id } });
  res.status(200).json({ success: true, message: 'Companion deleted' });
});


