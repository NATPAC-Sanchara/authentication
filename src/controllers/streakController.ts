import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const getUserStreak = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) throw new CustomError('Unauthorized', 401);

  // Days with trips in the last 60 days
  const rows = await prisma.$queryRawUnsafe<Array<{ day: string }>>(
    `SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day
     FROM trips WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '60 days'
     GROUP BY 1 ORDER BY 1 DESC`,
    user.id,
  );
  const days = new Set(rows.map(r => r.day));

  // Current streak: consecutive days including today
  let streak = 0;
  let cmp = new Date();
  for (;;) {
    const key = cmp.toISOString().slice(0,10);
    if (days.has(key)) { streak += 1; cmp = new Date(cmp.getTime() - 86400000); } else { break; }
  }

  res.status(200).json({ success: true, message: 'User streak', data: { currentStreakDays: streak, activeDaysLast60: days.size } });
});

export const getWeeklyLeaderboard = asyncHandler(async (_req: any, res: Response): Promise<void> => {
  // Last 7 days leaderboard by total distance; if companions exist, include their count per user
  const rows = await prisma.$queryRawUnsafe<Array<{ user_id: string; distance: number; companions: number; email: string; username: string }>>(
    `WITH d AS (
       SELECT t.user_id, COALESCE(SUM(t.distance_meters),0)::int AS distance
       FROM trips t WHERE t.started_at >= NOW() - INTERVAL '7 days' GROUP BY t.user_id
     ), c AS (
       SELECT user_id, COUNT(*)::int AS companions FROM companion_contacts GROUP BY user_id
     )
     SELECT u.id AS user_id, COALESCE(d.distance,0) AS distance, COALESCE(c.companions,0) AS companions, u.email, u.username
     FROM users u
     LEFT JOIN d ON d.user_id = u.id
     LEFT JOIN c ON c.user_id = u.id
     ORDER BY distance DESC, companions DESC
     LIMIT 100`
  );

  res.status(200).json({ success: true, message: 'Weekly leaderboard', data: { items: rows } });
});


