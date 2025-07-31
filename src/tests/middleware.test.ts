import request from 'supertest';
import express from 'express';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { requestIdMiddleware } from '../middleware/requestId';

const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Add request ID middleware for testing
  app.use(requestIdMiddleware);

  // Test routes
  app.get('/test/success', (req, res) => {
    res.json({ message: 'Success' });
  });

  app.get('/test/error', (req, res, next) => {
    const error = new AppError('Test error message', 400, 'TEST_ERROR');
    next(error);
  });

  app.get('/test/async-error', async (req, res, next) => {
    try {
      throw new Error('Async error');
    } catch (error) {
      next(error);
    }
  });

  app.get('/test/validation-error', (req, res, next) => {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    next(error);
  });

  app.get('/test/cast-error', (req, res, next) => {
    const error = new Error('Cast failed') as any;
    error.name = 'CastError';
    error.path = 'userId';
    error.value = 'invalid-id';
    next(error);
  });

  // Use error handler
  app.use(errorHandler);

  return app;
};

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should handle successful requests normally', async () => {
    const response = await request(app).get('/test/success').expect(200);

    expect(response.body.message).toBe('Success');
  });

  it('should handle AppError correctly', async () => {
    const response = await request(app).get('/test/error').expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Test error message',
        statusCode: 400,
        code: 'TEST_ERROR',
      },
    });
    expect(response.body.error.timestamp).toBeDefined();
    expect(response.body.error.requestId).toBeDefined();
  });

  it('should handle generic errors', async () => {
    const response = await request(app).get('/test/async-error').expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Internal Server Error',
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  });

  it('should handle ValidationError', async () => {
    const response = await request(app).get('/test/validation-error').expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Validation Error',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('should handle CastError', async () => {
    const response = await request(app).get('/test/cast-error').expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Invalid ID format',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('should include request ID in all error responses', async () => {
    const response = await request(app).get('/test/error').expect(400);

    expect(response.body.error.requestId).toBeDefined();
    expect(typeof response.body.error.requestId).toBe('string');
  });

  it('should not expose stack trace in production', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app).get('/test/async-error').expect(500);

    expect(response.body.error.stack).toBeUndefined();

    process.env.NODE_ENV = 'test';
  });
});

describe('AppError Class', () => {
  it('should create AppError with all properties', () => {
    const error = new AppError('Test message', 400, 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_CODE');
    expect(error.isOperational).toBe(true);
  });

  it('should create AppError with default values', () => {
    const error = new AppError('Test message');

    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBeUndefined();
    expect(error.isOperational).toBe(true);
  });
});
