import { Router } from 'express';
import { adminSignIn, adminSignUp, adminDashboard, createAdminBySuperAdmin, bootstrapSuperAdmin, getAdminMetrics, listUsers, listGuestVisits, getAdminOverviewAnalytics, listTripsAdmin, getTripDetailAdmin, getGuestVisitsTimeSeries, getPermissionsStats, getTripPointsHeatmap } from '../controllers/adminController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { validateRequest } from '../utils/validation';
import Joi from 'joi';

const router = Router();

const adminAuthSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

router.post('/signup', authRateLimiter, validateRequest(adminAuthSchema), adminSignUp);
router.post('/signin', authRateLimiter, validateRequest(adminAuthSchema), adminSignIn);

router.post('/create', authenticateToken, authorizeRoles('SUPER_ADMIN'), validateRequest(adminAuthSchema), createAdminBySuperAdmin);

router.get('/dashboard', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), adminDashboard);

// Metrics and listings
router.get('/metrics', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminMetrics);
router.get('/users', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), listUsers);
router.get('/guests', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), listGuestVisits);
router.get('/analytics/overview', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminOverviewAnalytics);
router.get('/analytics/trips', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), listTripsAdmin);
router.get('/analytics/trips/:tripId', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getTripDetailAdmin);
router.get('/analytics/guests/timeseries', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getGuestVisitsTimeSeries);
router.get('/analytics/permissions', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPermissionsStats);
router.get('/analytics/heatmap', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getTripPointsHeatmap);

// One-time secure bootstrap route to create first SUPER_ADMIN
const bootstrapSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  secret: Joi.string().min(8).required(),
});
router.post('/bootstrap-super-admin', authRateLimiter, validateRequest(bootstrapSchema), bootstrapSuperAdmin);

export default router;


