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
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from './middleware/httpLogger';
import winston from 'winston';
import redisService from './services/redisService';

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

app.use(cors());
app.use(express.json());
app.use(helmet());

// Limit repeated requests to public APIs and/or endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
});
app.use(limiter);

// Use HTTP request logger
app.use(httpLogger);

app.get('/', (req, res) => {
  winstonLogger.info({
    message: 'Root endpoint accessed',
    requestId: (req as express.Request & { requestId: string }).requestId,
  });
  res.send('AgroConnect Backend Running');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/ai', aiAssistantRoutes);
app.use('/api/cache', cacheRoutes);

// MongoDB connection
const connectDB = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    await mongoose.connect(MONGODB_URI);
    winstonLogger.info('MongoDB connected successfully');
  } catch (error) {
    winstonLogger.error('MongoDB connection error:', error);
    process.exit(1);
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

// Error logging middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  winstonLogger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    status: res.statusCode,
    requestId: (req as express.Request & { requestId: string }).requestId,
    body: req.body,
    query: req.query,
  });
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start server after connecting to database and Redis
const startServer = async () => {
  await connectDB();
  await connectRedis();

  app.listen(PORT, () => {
    winstonLogger.info(`Server running on port ${PORT}`);
  });
};

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
