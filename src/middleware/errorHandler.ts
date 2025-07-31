import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Custom error class for application-specific errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types for better categorization
export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

// Create winston logger for errors
const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Request context interface
interface RequestContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Centralized error handling middleware
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestContext: RequestContext = {
    requestId: (req as Request & { requestId?: string }).requestId,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
  };

  // Determine error details
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = ErrorCodes.INTERNAL_SERVER_ERROR;
  let details: Record<string, unknown> | undefined = undefined;

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = (error.code as ErrorCodes) || ErrorCodes.INTERNAL_SERVER_ERROR;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = ErrorCodes.VALIDATION_ERROR;
    details = (error as Error & { errors?: Record<string, unknown> }).errors;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = ErrorCodes.VALIDATION_ERROR;
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Database Error';
    code = ErrorCodes.DATABASE_ERROR;

    // Handle duplicate key error
    if ((error as Error & { code?: number }).code === 11000) {
      statusCode = 409;
      message = 'Duplicate resource';
      code = ErrorCodes.DUPLICATE_RESOURCE;
      details = {
        duplicateField: Object.keys(
          (error as Error & { keyValue?: Record<string, unknown> }).keyValue || {},
        )[0],
      };
    }
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = ErrorCodes.AUTHENTICATION_ERROR;
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = ErrorCodes.AUTHENTICATION_ERROR;
  } else if (error.message.includes('Rate limit')) {
    statusCode = 429;
    message = error.message;
    code = ErrorCodes.RATE_LIMIT_ERROR;
  }

  // Log error with context
  errorLogger.error('Application Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode,
    },
    context: requestContext,
    timestamp: new Date().toISOString(),
  });

  // Create error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: requestContext.requestId,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    },
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, ErrorCodes.NOT_FOUND);
  next(error);
};

/**
 * Validation error helper
 */
export const createValidationError = (
  message: string,
  details?: Record<string, unknown>,
): AppError => {
  const error = new AppError(message, 400, ErrorCodes.VALIDATION_ERROR);
  (error as AppError & { details?: Record<string, unknown> }).details = details;
  return error;
};

/**
 * Authentication error helper
 */
export const createAuthError = (message: string = 'Authentication required'): AppError => {
  return new AppError(message, 401, ErrorCodes.AUTHENTICATION_ERROR);
};

/**
 * Authorization error helper
 */
export const createAuthorizationError = (
  message: string = 'Insufficient permissions',
): AppError => {
  return new AppError(message, 403, ErrorCodes.AUTHORIZATION_ERROR);
};

/**
 * External API error helper
 */
export const createExternalAPIError = (message: string, service?: string): AppError => {
  const error = new AppError(`External API Error: ${message}`, 502, ErrorCodes.EXTERNAL_API_ERROR);
  (error as AppError & { service?: string }).service = service;
  return error;
};

/**
 * Database error helper
 */
export const createDatabaseError = (message: string): AppError => {
  return new AppError(message, 500, ErrorCodes.DATABASE_ERROR);
};

export default {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
  ErrorCodes,
  createValidationError,
  createAuthError,
  createAuthorizationError,
  createExternalAPIError,
  createDatabaseError,
};
