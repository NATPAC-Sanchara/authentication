import { Router } from 'express';
import authRoutes from './auth';
import adminRoutes from './admin';

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

export default router;
