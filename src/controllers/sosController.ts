import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { emailService } from '../services/emailService';

export const triggerSOS = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);
  const { lat, lng } = req.body as { lat?: number; lng?: number };

  const event = await prisma.sOSEvent.create({ data: { userId: user.id, lat: typeof lat === 'number' ? lat : null, lng: typeof lng === 'number' ? lng : null } });

  const companions = await prisma.companionContact.findMany({ where: { userId: user.id } });
  const toEmails = companions.map(c => c.email).filter(Boolean) as string[];
  if (toEmails.length > 0) {
    await emailService.sendSOSEmail(toEmails, user.email, { lat, lng });
  }

  res.status(201).json({ success: true, message: 'SOS triggered', data: { sosId: event.id, notified: toEmails.length } });
});


