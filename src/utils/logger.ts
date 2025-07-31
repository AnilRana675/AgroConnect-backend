import winston from 'winston';
import path from 'path';

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, requestId, userId, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (requestId) log += ` (reqId: ${requestId})`;
    if (userId) log += ` (userId: ${userId})`;

    // Add metadata if present
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      const metaStr = metaKeys
        .map(
          (key) =>
            `${key}: ${typeof meta[key] === 'object' ? JSON.stringify(meta[key]) : meta[key]}`,
        )
        .join(', ');
      log += ` [${metaStr}]`;
    }

    return log;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, requestId, userId, ...meta }) => {
    const logEntry: any = {
      timestamp,
      level,
      message,
      service: 'agroconnect-backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      ...meta,
    };

    if (requestId) logEntry.requestId = requestId;
    if (userId) logEntry.userId = userId;

    return JSON.stringify(logEntry);
  }),
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
  }),
];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  transports,
});

// Helper methods for structured logging
export const logWithContext = (level: string, message: string, context: any = {}) => {
  logger.log(level, message, context);
};

export const logError = (message: string, error: Error, context: any = {}) => {
  logger.error(message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });
};

export const logPerformance = (message: string, duration: number, context: any = {}) => {
  logger.info(message, {
    performance: {
      duration: `${duration}ms`,
      slow: duration > 1000,
    },
    ...context,
  });
};

export const logSecurity = (message: string, context: any = {}) => {
  logger.warn(message, {
    security: true,
    ...context,
  });
};

export const logUserActivity = (action: string, userId: string, context: any = {}) => {
  logger.info(`User activity: ${action}`, {
    userId,
    userActivity: true,
    action,
    ...context,
  });
};

export const logAPICall = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  context: any = {},
) => {
  logger.http('API call', {
    api: {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
    },
    ...context,
  });
};

export default logger;
