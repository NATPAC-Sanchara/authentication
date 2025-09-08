import { Router } from 'express';
import { signUp, signIn, getProfile, verifyOTP, resendOTP } from '../controllers/authController';
import { validateRequest } from '../utils/validation';
import { signUpSchema, signInSchema, verifyOTPSchema, resendOTPSchema } from '../utils/validation';
import { authenticateToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';

const router = Router();

// Public routes with rate limiting
router.post('/signup', authRateLimiter, validateRequest(signUpSchema), signUp);
router.post('/verify-otp', authRateLimiter, validateRequest(verifyOTPSchema), verifyOTP);
router.post('/resend-otp', authRateLimiter, validateRequest(resendOTPSchema), resendOTP);
router.post('/signin', authRateLimiter, validateRequest(signInSchema), signIn);
// Google auth removed

// Protected routes
router.get('/profile', authenticateToken, getProfile);

export default router;
