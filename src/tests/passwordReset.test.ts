import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import passwordResetRoutes from '../routes/passwordReset';
import { User } from '../models/User';
import { describe, beforeEach, beforeAll, afterAll, it, expect, jest } from '@jest/globals';

// Mock the email service
jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    sendVerificationEmail: jest.fn(() => Promise.resolve(true)),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve(true)),
  },
}));

// Create test app
const createTestApp = () => {
  const app = express();

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

  // API Routes
  app.use('/api/auth', passwordResetRoutes);

  return app;
};

const app = createTestApp();

describe('Password Reset API', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as mongoose.ConnectOptions);
    }
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email for existing user', async () => {
      // Create a test user
      const testUser = new User({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
        },
        locationInfo: {
          province: 'Province 1',
          district: 'District A',
          municipality: 'Municipality X',
        },
        farmInfo: {
          farmerType: 'Subsistence',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'john.doe@test.com',
          password: 'password123',
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/forgot-password').send({
        email: 'john.doe@test.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');
      expect(response.body.email).toBe('john.doe@test.com');

      // Check that user has reset token
      const updatedUser = await User.findOne({ 'loginCredentials.email': 'john.doe@test.com' });
      expect(updatedUser?.passwordReset?.resetToken).toBeDefined();
      expect(updatedUser?.passwordReset?.resetTokenExpires).toBeDefined();
    });

    it('should return success message even for non-existent user (security)', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({
        email: 'nonexistent@test.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should return error for missing email', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Please provide an email address');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Create user with reset token
      const testUser = new User({
        personalInfo: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
        locationInfo: {
          province: 'Province 2',
          district: 'District B',
          municipality: 'Municipality Y',
        },
        farmInfo: {
          farmerType: 'Commercial',
          economicScale: 'Large',
        },
        loginCredentials: {
          email: 'jane.smith@test.com',
          password: 'oldpassword123',
        },
        passwordReset: {
          resetToken: 'valid-reset-token-123',
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'jane.smith@test.com',
        token: 'valid-reset-token-123',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Password reset successfully');

      // Check that user's password was updated and reset token cleared
      const updatedUser = await User.findOne({ 'loginCredentials.email': 'jane.smith@test.com' });
      expect(updatedUser?.passwordReset?.resetToken).toBeUndefined();
      expect(updatedUser?.passwordReset?.resetAt).toBeDefined();

      // Password should be hashed (not equal to plain text)
      expect(updatedUser?.loginCredentials.password).not.toBe('newpassword123');
      expect(updatedUser?.loginCredentials.password?.length).toBeGreaterThan(20); // Hashed password length
    });

    it('should return error for invalid token', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Bob',
          lastName: 'Johnson',
        },
        locationInfo: {
          province: 'Province 3',
          district: 'District C',
          municipality: 'Municipality Z',
        },
        farmInfo: {
          farmerType: 'Mixed',
          economicScale: 'Medium',
        },
        loginCredentials: {
          email: 'bob.johnson@test.com',
          password: 'password123',
        },
        passwordReset: {
          resetToken: 'correct-token-456',
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'bob.johnson@test.com',
        token: 'wrong-token-456',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('invalid or has expired');
    });

    it('should return error for expired token', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Alice',
          lastName: 'Brown',
        },
        locationInfo: {
          province: 'Province 4',
          district: 'District D',
          municipality: 'Municipality W',
        },
        farmInfo: {
          farmerType: 'Organic',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'alice.brown@test.com',
          password: 'password123',
        },
        passwordReset: {
          resetToken: 'expired-token-789',
          resetTokenExpires: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'alice.brown@test.com',
        token: 'expired-token-789',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('invalid or has expired');
    });

    it('should return error for weak password', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Charlie',
          lastName: 'Wilson',
        },
        locationInfo: {
          province: 'Province 5',
          district: 'District E',
          municipality: 'Municipality V',
        },
        farmInfo: {
          farmerType: 'Traditional',
          economicScale: 'Medium',
        },
        loginCredentials: {
          email: 'charlie.wilson@test.com',
          password: 'password123',
        },
        passwordReset: {
          resetToken: 'valid-token-weak-pass',
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'charlie.wilson@test.com',
        token: 'valid-token-weak-pass',
        newPassword: '123', // Too short
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('at least 6 characters');
    });

    it('should return error for missing fields', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        email: 'test@test.com',
        // Missing token and newPassword
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email, reset token, and new password are required');
    });
  });

  describe('POST /api/auth/validate-reset-token', () => {
    it('should validate valid reset token', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'David',
          lastName: 'Miller',
        },
        locationInfo: {
          province: 'Province 6',
          district: 'District F',
          municipality: 'Municipality U',
        },
        farmInfo: {
          farmerType: 'Commercial',
          economicScale: 'Large',
        },
        loginCredentials: {
          email: 'david.miller@test.com',
          password: 'password123',
        },
        passwordReset: {
          resetToken: 'valid-validation-token',
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/validate-reset-token').send({
        email: 'david.miller@test.com',
        token: 'valid-validation-token',
      });

      expect(response.status).toBe(200);
      expect(response.body.isValid).toBe(true);
      expect(response.body.firstName).toBe('David');
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should return invalid for expired token', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Eva',
          lastName: 'Davis',
        },
        locationInfo: {
          province: 'Province 7',
          district: 'District G',
          municipality: 'Municipality T',
        },
        farmInfo: {
          farmerType: 'Mixed',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'eva.davis@test.com',
          password: 'password123',
        },
        passwordReset: {
          resetToken: 'expired-validation-token',
          resetTokenExpires: new Date(Date.now() - 60 * 60 * 1000), // Expired
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/auth/validate-reset-token').send({
        email: 'eva.davis@test.com',
        token: 'expired-validation-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.isValid).toBe(false);
      expect(response.body.message).toContain('invalid or has expired');
    });

    it('should return error for missing fields', async () => {
      const response = await request(app).post('/api/auth/validate-reset-token').send({
        email: 'test@test.com',
        // Missing token
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and reset token are required');
    });
  });
});
