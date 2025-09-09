import { Router } from 'express';
import authRoutes from './auth';
import adminRoutes from './admin';
import tripRoutes from './trips';
import { createGuestVisit } from '../controllers/guestController';
import { listCompanions, upsertCompanion, deleteCompanion } from '../controllers/companionController';
import { triggerSOS } from '../controllers/sosController';
import { getUserStreak, getWeeklyLeaderboard } from '../controllers/streakController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { logPermission, getPermissionStatus } from '../controllers/permissionsController';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/trips', tripRoutes);

// Public guest endpoint (no auth)
router.post('/guest', createGuestVisit);

// Permissions logging and status
router.post('/permissions/log', logPermission);
router.get('/permissions/status', getPermissionStatus);

// Companions CRUD
router.get('/companions', authenticateToken, listCompanions);
router.post('/companions', authenticateToken, upsertCompanion);
router.delete('/companions/:id', authenticateToken, deleteCompanion);

// SOS trigger
router.post('/sos', authRateLimiter, authenticateToken, triggerSOS);

// Streaks & Leaderboard
router.get('/streak', authenticateToken, getUserStreak);
router.get('/leaderboard/weekly', authenticateToken, getWeeklyLeaderboard);

export default router;
