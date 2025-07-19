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
import logger from './utils/logger';
import redisService from './services/redisService';

const app = express();
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

app.get('/', (_req, res) => {
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
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Redis connection
const connectRedis = async () => {
  try {
    await redisService.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn('Redis connection failed, continuing without cache:', error);
  }
};

// Start server after connecting to database and Redis
const startServer = async () => {
  await connectDB();
  await connectRedis();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisService.disconnect();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisService.disconnect();
  await mongoose.connection.close();
  process.exit(0);
});

startServer();
