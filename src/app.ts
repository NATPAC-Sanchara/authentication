import express from 'express';
import morgan from 'morgan';
import { config } from './config/env';
import { 
  rateLimiter, 
  securityHeaders, 
  corsOptions, 
  requestLogger 
} from './middleware/security';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Trust proxy for accurate IP addresses (important for Vercel)
app.set('trust proxy', 1);

// Initialize database connection for serverless
import { prisma } from './config/database';
import { emailService } from './services/emailService';

// Initialize services on cold start
const initializeServices = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    const emailConnected = await emailService.verifyConnection();
    if (emailConnected) {
      console.log('✅ Email service connected successfully');
    } else {
      console.log('⚠️  Email service connection failed - check your email configuration');
    }
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
};

// Initialize services
initializeServices();

// Security middleware
app.use(securityHeaders);
app.use(corsOptions);

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(requestLogger);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      signup: '/api/auth/signup',
      verifyOtp: '/api/auth/verify-otp',
      resendOtp: '/api/auth/resend-otp',
      signin: '/api/auth/signin',
      profile: '/api/auth/profile',
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
