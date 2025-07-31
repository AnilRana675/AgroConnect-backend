import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import userRoutes from './routes/users';
import registrationRoutes from './routes/registration';
import aiAssistantRoutes from './routes/ai-assistant';
import authRoutes from './routes/auth';
import cacheRoutes from './routes/cache';
import plantRoutes from './routes/plant';
import translationRoutes from './routes/translation';
import monitoringRoutes from './routes/monitoring';
import emailVerificationRoutes from './routes/emailVerification';
import passwordResetRoutes from './routes/passwordReset';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import httpLogger from './middleware/httpLogger';
import winston from 'winston';
import redisService from './services/redisService';
import { errorHandler, notFoundHandler, AppError } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { 
  compressionMiddleware, 
  cacheControlMiddleware, 
  performanceMiddleware,
  requestSizeLimiter,
  optimizedHealthCheck
} from './middleware/performance';
import { analyticsMiddleware } from './middleware/analytics';

const app = express();

// Winston logger with colorized console output and custom format
import { v4 as uuidv4 } from 'uuid';
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${meta.requestId ? `(reqId: ${meta.requestId})` : ''} ${meta.method ? `[${meta.method} ${meta.url}]` : ''} ${meta.status ? `[status: ${meta.status}]` : ''} ${meta.durationMs ? `[${meta.durationMs}ms]` : ''}`;
        }),
      ),
    }),
  ],
});

// Request logging with requestId, status, and duration
app.use((req, res, next) => {
  const requestId = uuidv4();
  (req as express.Request & { requestId: string }).requestId = requestId;
  const startHrTime = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startHrTime);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
    winstonLogger.info({
      message: 'HTTP Request',
      method: req.method,
      url: req.url,
      ip: req.ip,
      status: res.statusCode,
      durationMs,
      requestId,
      body: req.body,
      query: req.query,
    });
  });
  next();
});
// Trust the first proxy (needed for rate limiting and X-Forwarded-For)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Environment-based CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://agroconnect-frontend.onrender.com',
        'https://agroconnect-frontend-iup3.onrender.com', 
        'https://agro-connect-frontend-mu.vercel.app',
        process.env.FRONTEND_URL || '',
      ].filter((url) => url !== '') // Remove empty values
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL || '',
      ].filter((url) => url !== ''),
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  preflightContinue: false,
};

app.use(cors(corsOptions));

// Request ID middleware (should be early in the chain)
app.use(requestIdMiddleware);

// Analytics middleware (track all requests)
app.use(analyticsMiddleware);

// Performance and compression middleware
app.use(compressionMiddleware);
app.use(cacheControlMiddleware);
app.use(performanceMiddleware);
app.use(requestSizeLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet());

// Advanced Rate Limiting Configuration
const createRateLimiter = (windowMs: number, max: number, skipPaths: string[] = []) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: `${Math.ceil(windowMs / 60000)} minutes`,
      limit: max,
      window: `${Math.ceil(windowMs / 60000)} minutes`,
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
      // Skip rate limiting for health checks and specified paths
      return skipPaths.some(path => req.path.startsWith(path));
    },
    keyGenerator: (req) => {
      // Use IPv6-compatible key generator for proper IP handling
      return ipKeyGenerator(req.ip || req.connection.remoteAddress || 'unknown');
    },
    handler: (req, res) => {
      // Custom handler when rate limit is exceeded
      winstonLogger.warn(`Rate limit exceeded for IP: ${req.ip} on path: ${req.path}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      res.status(429).json({
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: `${Math.ceil(windowMs / 60000)} minutes`,
        limit: max,
        window: `${Math.ceil(windowMs / 60000)} minutes`,
      });
    },
  });
};

// General API rate limiter
const generalLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per window
  ['/health', '/'] // Skip health checks and root endpoint
);

// Strict rate limiter for AI endpoints (more restrictive)
const aiLimiter = createRateLimiter(
  parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  parseInt(process.env.AI_RATE_LIMIT_MAX || '10'), // 10 AI requests per minute
  []
);

// Auth rate limiter (for login attempts - strict)
const authLimiter = createRateLimiter(
  parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // 5 auth attempts per 15 minutes
  []
);

// Registration rate limiter (more lenient for multi-step process)
const registrationLimiter = createRateLimiter(
  parseInt(process.env.REGISTRATION_RATE_LIMIT_WINDOW_MS || '600000'), // 10 minutes
  parseInt(process.env.REGISTRATION_RATE_LIMIT_MAX || '20'), // 20 registration attempts per 10 minutes
  []
);

// Email verification rate limiter (lenient for development)
const emailVerificationLimiter = createRateLimiter(
  parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
  parseInt(process.env.EMAIL_VERIFICATION_RATE_LIMIT_MAX || '10'), // 10 email requests per 5 minutes
  []
);

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Use HTTP request logger
app.use(httpLogger);

// Optimized health check endpoint for Render
app.get('/health', optimizedHealthCheck);

app.get('/', (req, res) => {
  winstonLogger.info({
    message: 'Root endpoint accessed',
    requestId: (req as express.Request & { requestId: string }).requestId,
  });
  res.send('AgroConnect Backend Running');
});

// API Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes); // Strict rate limiting for auth
app.use('/api/auth', authLimiter, passwordResetRoutes); // Password reset with strict limits
app.use('/api/registration', registrationLimiter, registrationRoutes); // More lenient for multi-step registration
app.use('/api/email-verification', emailVerificationLimiter, emailVerificationRoutes); // More lenient email verification
app.use('/api/ai', aiLimiter, aiAssistantRoutes); // Strict rate limiting for AI endpoints
app.use('/api/plant', aiLimiter, plantRoutes); // Plant ID also uses AI, so restrict it
app.use('/api/users', userRoutes); // Uses general rate limiting
app.use('/api/cache', cacheRoutes); // Uses general rate limiting
app.use('/api/translation', translationRoutes); // Uses general rate limiting
app.use('/api/monitoring', generalLimiter, monitoringRoutes); // System monitoring endpoints

// Enhanced MongoDB connection with pooling and error handling
const connectDB = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // MongoDB connection options with pooling and timeouts
    const mongooseOptions = {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10'), // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '5000'), // Keep trying to send operations for 5 seconds
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '45000'), // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'), // Give up initial connection after 10 seconds
      heartbeatFrequencyMS: 10000, // Frequency of heartbeat checks
    };

    const conn = await mongoose.connect(MONGODB_URI, mongooseOptions);
    winstonLogger.info(`MongoDB connected successfully: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      winstonLogger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      winstonLogger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      winstonLogger.info('MongoDB reconnected successfully');
    });

    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        winstonLogger.info('MongoDB connection closed due to app termination');
        process.exit(0);
      } catch (error) {
        winstonLogger.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    winstonLogger.error('MongoDB connection error:', error);
    winstonLogger.error('Failed to connect to MongoDB. Retrying in 5 seconds...');
    
    // Retry connection after specified delay
    const retryDelay = parseInt(process.env.DB_RETRY_DELAY || '5000');
    setTimeout(connectDB, retryDelay);
  }
};

// Redis connection
const connectRedis = async () => {
  try {
    await redisService.connect();
    winstonLogger.info('Redis connected successfully');
  } catch (error) {
    winstonLogger.warn('Redis connection failed, continuing without cache:', error);
  }
};

// Comprehensive Error Handling Middleware (must be last)
app.use(notFoundHandler); // Handle 404 routes
app.use(errorHandler); // Handle all other errors

// Start server after connecting to database and Redis
const startServer = async () => {
  await connectDB();
  await connectRedis();

  const server = app.listen(PORT, () => {
    winstonLogger.info(`Server running on port ${PORT}`);
    winstonLogger.info(`Health check available at /health`);
  });

  // Set server timeout for production
  server.timeout = 30000; // 30 seconds

  return server;
};

// Memory monitoring for production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsed = Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100;
    if (memUsed > 400) {
      // Warning if memory usage exceeds 400MB
      winstonLogger.warn(`High memory usage: ${memUsed}MB`);
    }
  }, 60000); // Check every minute

  // Force garbage collection every 5 minutes if available
  if (global.gc) {
    setInterval(() => {
      if (global.gc) {
        global.gc();
        winstonLogger.info('Garbage collection triggered');
      }
    }, 300000);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  winstonLogger.info('SIGTERM received, shutting down gracefully');
  await redisService.disconnect();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  winstonLogger.info('SIGINT received, shutting down gracefully');
  await redisService.disconnect();
  await mongoose.connection.close();
  process.exit(0);
});

startServer();

// Export app for testing
export { app };
