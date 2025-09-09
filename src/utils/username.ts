import { prisma } from '../config/database';

const sanitizeBase = (base: string): string => {
  const lower = base.toLowerCase();
  const alnum = lower.replace(/[^a-z0-9]+/g, '');
  const trimmed = alnum.replace(/^[_\.\-]+|[_\.\-]+$/g, '');
  return trimmed || 'user';
};

export const generateBaseFromEmail = (email: string): string => {
  const local = email.split('@')[0] || 'user';
  return sanitizeBase(local);
};

export const generateUniqueUsername = async (email: string): Promise<string> => {
  const base = generateBaseFromEmail(email);
  // Try base, then base + number
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } }).catch(() => null);
    if (!existing) return candidate;
  }
  // Fallback with random suffix
  // Keep it short to stay user-friendly
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}${random}`;
};

export const generateRandomGuestUsername = async (): Promise<string> => {
  // guest-xxxxxx pattern
  const prefix = 'guest';
  for (let i = 0; i < 10; i++) {
    const candidate = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    // Check uniqueness against guest_visits.username (raw table). Use query to see if exists.
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM guest_visits WHERE username = $1) AS exists`,
      candidate,
    ).catch(() => [{ exists: false }]);
    const exists = rows?.[0]?.exists;
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now().toString(36).slice(-6)}`;
};


