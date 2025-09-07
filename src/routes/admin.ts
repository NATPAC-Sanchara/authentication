import { Router } from 'express';
import { adminSignIn, adminSignUp, adminDashboard, createAdminBySuperAdmin, bootstrapSuperAdmin } from '../controllers/adminController';
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

// One-time secure bootstrap route to create first SUPER_ADMIN
const bootstrapSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  secret: Joi.string().min(8).required(),
});
router.post('/bootstrap-super-admin', authRateLimiter, validateRequest(bootstrapSchema), bootstrapSuperAdmin);

export default router;


