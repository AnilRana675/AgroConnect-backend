import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import emailVerificationRoutes from '../routes/emailVerification';
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
  app.use('/api/email-verification', emailVerificationRoutes);

  return app;
};

const app = createTestApp();

describe('Email Verification API', () => {
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

  describe('POST /api/email-verification/send-verification', () => {
    it('should send verification email for existing user', async () => {
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
        emailVerification: {
          isVerified: false,
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/email-verification/send-verification').send({
        email: 'john.doe@test.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Verification email sent');
      expect(response.body.email).toBe('john.doe@test.com');

      // Check that user has verification token
      const updatedUser = await User.findOne({ 'loginCredentials.email': 'john.doe@test.com' });
      expect(updatedUser?.emailVerification?.verificationToken).toBeDefined();
      expect(updatedUser?.emailVerification?.verificationTokenExpires).toBeDefined();
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app).post('/api/email-verification/send-verification').send({
        email: 'nonexistent@test.com',
      });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No account found');
    });

    it('should return error for already verified user', async () => {
      // Create a verified user
      const testUser = new User({
        personalInfo: {
          firstName: 'Jane',
          lastName: 'Doe',
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
          email: 'jane.doe@test.com',
          password: 'password123',
        },
        emailVerification: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/email-verification/send-verification').send({
        email: 'jane.doe@test.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already verified');
    });
  });

  describe('POST /api/email-verification/verify', () => {
    it('should verify user with valid token', async () => {
      // Create user with verification token
      const testUser = new User({
        personalInfo: {
          firstName: 'Bob',
          lastName: 'Smith',
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
          email: 'bob.smith@test.com',
          password: 'password123',
        },
        emailVerification: {
          isVerified: false,
          verificationToken: 'valid-token-123',
          verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/email-verification/verify').send({
        email: 'bob.smith@test.com',
        token: 'valid-token-123',
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('verified successfully');

      // Check that user is now verified
      const verifiedUser = await User.findOne({ 'loginCredentials.email': 'bob.smith@test.com' });
      expect(verifiedUser?.emailVerification?.isVerified).toBe(true);
      expect(verifiedUser?.emailVerification?.verifiedAt).toBeDefined();
      expect(verifiedUser?.emailVerification?.verificationToken).toBeUndefined();
    });

    it('should return error for invalid token', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Alice',
          lastName: 'Johnson',
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
          email: 'alice.johnson@test.com',
          password: 'password123',
        },
        emailVerification: {
          isVerified: false,
          verificationToken: 'correct-token-456',
          verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await testUser.save();

      const response = await request(app).post('/api/email-verification/verify').send({
        email: 'alice.johnson@test.com',
        token: 'wrong-token-456',
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('invalid or has expired');
    });
  });

  describe('GET /api/email-verification/verification-status/:email', () => {
    it('should return verification status for existing user', async () => {
      const testUser = new User({
        personalInfo: {
          firstName: 'Charlie',
          lastName: 'Brown',
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
          email: 'charlie.brown@test.com',
          password: 'password123',
        },
        emailVerification: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await testUser.save();

      const response = await request(app).get(
        '/api/email-verification/verification-status/charlie.brown@test.com',
      );

      expect(response.status).toBe(200);
      expect(response.body.isVerified).toBe(true);
      expect(response.body.verifiedAt).toBeDefined();
    });

    it('should return not found for non-existent user', async () => {
      const response = await request(app).get(
        '/api/email-verification/verification-status/nonexistent@test.com',
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No account found');
    });
  });
});
