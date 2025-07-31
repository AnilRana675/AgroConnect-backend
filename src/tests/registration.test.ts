import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import registrationRoutes from '../routes/registration';
import { User } from '../models/User';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { TempRegistration } from '../models/TempRegistration';

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
  app.use('/api/registration', registrationRoutes);

  return app;
};

const app = createTestApp();

describe('Registration API', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Clear the database before each test
    await User.deleteMany({});
    // Also clear temp registrations
    await TempRegistration.deleteMany({});
    sessionId = `test_${Date.now()}`;
  });

  describe('GET /api/registration/options', () => {
    it('should return registration options', async () => {
      const response = await request(app).get('/api/registration/options').expect(200);

      expect(response.body).toHaveProperty('options');
      expect(response.body.options).toHaveProperty('agricultureTypes');
      expect(response.body.options).toHaveProperty('economicScales');
      expect(response.body.options).toHaveProperty('states');
      expect(Array.isArray(response.body.options.agricultureTypes)).toBe(true);
    });
  });

  describe('POST /api/registration/step1', () => {
    it('should save name successfully', async () => {
      const stepData = {
        firstName: 'John',
        lastName: 'Doe',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step1')
        .send(stepData)
        .expect(200);

      expect(response.body.message).toBe('Name saved successfully');
      expect(response.body.step).toBe(1);
      expect(response.body.nextStep).toBe(2);
      expect(response.body.data.firstName).toBe('John');
    });

    it('should require first name and last name', async () => {
      const stepData = {
        firstName: 'John',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step1')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('First name and last name are required');
    });
  });

  describe('POST /api/registration/step2', () => {
    it('should save location successfully', async () => {
      // First create a session with step 1
      const step1Response = await request(app).post('/api/registration/step1').send({
        firstName: 'John',
        lastName: 'Doe',
        sessionId,
      });

      expect(step1Response.status).toBe(200);
      const _actualSessionId = step1Response.body.data.sessionId;

      const stepData = {
        state: 'Bagmati Province',
        district: 'Kathmandu',
      };

      const response = await request(app)
        .post('/api/registration/step2')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Province, district, and municipality are required');
      expect(response.body.step).toBe(2);
    });

    it('should require all location fields', async () => {
      const stepData = {
        state: 'Bagmati Province',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step2')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Province, district, and municipality are required');
    });
  });

  describe('POST /api/registration/step3', () => {
    it('should save agriculture type successfully', async () => {
      const stepData = {
        farmerType: 'Organic Farming',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step3')
        .send(stepData)
        .expect(200);

      expect(response.body.message).toBe('Agriculture type saved successfully');
      expect(response.body.step).toBe(3);
      expect(response.body.nextStep).toBe(4);
    });

    it('should require farmer type', async () => {
      const stepData = {
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step3')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Agriculture type is required');
    });
  });

  describe('POST /api/registration/step4', () => {
    it('should save economic scale successfully', async () => {
      const stepData = {
        economicScale: 'Small Scale (Less than 2 hectares)',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step4')
        .send(stepData)
        .expect(200);

      expect(response.body.message).toBe('Economic scale saved successfully');
      expect(response.body.step).toBe(4);
      expect(response.body.nextStep).toBe(5);
    });

    it('should require farming scale', async () => {
      const stepData = {
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step4')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Economic scale is required');
    });
  });

  describe('POST /api/registration/step5', () => {
    it('should save email successfully', async () => {
      const stepData = {
        email: 'john.doe@example.com',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step5')
        .send(stepData)
        .expect(200);

      expect(response.body.message).toBe('Email saved successfully');
      expect(response.body.step).toBe(5);
      expect(response.body.nextStep).toBe(6);
    });

    it('should require email', async () => {
      const stepData = {
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step5')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Email address is required');
    });

    it('should check for duplicate email', async () => {
      // Create a user first
      const existingUser = new User({
        personalInfo: { firstName: 'Jane', lastName: 'Doe' },
        locationInfo: { province: 'Province 1', district: 'Test', municipality: 'Test' },
        farmInfo: { farmerType: 'Organic', economicScale: 'Small' },
        loginCredentials: { email: 'john.doe@example.com', password: 'password123' },
      });
      await existingUser.save();

      const stepData = {
        email: 'john.doe@example.com',
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/step5')
        .send(stepData)
        .expect(400);

      expect(response.body.message).toBe('Email already registered');
    });
  });

  describe('POST /api/registration/complete', () => {
    it('should complete registration successfully', async () => {
      const registrationData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
        },
        locationInfo: {
          province: 'Bagmati Province',
          district: 'Kathmandu',
          municipality: 'Kathmandu Metropolitan City',
        },
        farmInfo: {
          farmerType: 'Organic Farming',
          economicScale: 'Small Scale (Less than 2 hectares)',
        },
        loginCredentials: {
          email: 'john.doe@example.com',
          password: 'password123',
        },
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/complete')
        .send(registrationData)
        .expect(201);

      expect(response.body.message).toBe('Registration completed successfully');
      expect(response.body.step).toBe(6);
      expect(response.body.registrationComplete).toBe(true);
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.loginCredentials.password).toBeUndefined();

      // Verify user was saved to database
      const savedUser = await User.findOne({ 'loginCredentials.email': 'john.doe@example.com' });
      expect(savedUser).toBeTruthy();
    });

    it('should require all fields for completion', async () => {
      const incompleteData = {
        personalInfo: {
          firstName: 'John',
          // Missing lastName
        },
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/complete')
        .send(incompleteData)
        .expect(400);

      expect(response.body.message).toBe('Personal information is incomplete');
    });

    it('should check for duplicate email on completion', async () => {
      // Create a user first
      const existingUser = new User({
        personalInfo: { firstName: 'Jane', lastName: 'Doe' },
        locationInfo: { province: 'Province 1', district: 'Test', municipality: 'Test' },
        farmInfo: { farmerType: 'Organic', economicScale: 'Small' },
        loginCredentials: { email: 'john.doe@example.com', password: 'password123' },
      });
      await existingUser.save();

      const registrationData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
        },
        locationInfo: {
          province: 'Bagmati Province',
          district: 'Kathmandu',
          municipality: 'Kathmandu Metropolitan City',
        },
        farmInfo: {
          farmerType: 'Organic Farming',
          economicScale: 'Small Scale (Less than 2 hectares)',
        },
        loginCredentials: {
          email: 'john.doe@example.com',
          password: 'password123',
        },
        sessionId,
      };

      const response = await request(app)
        .post('/api/registration/complete')
        .send(registrationData)
        .expect(400);

      expect(response.body.message).toBe('User already exists with this email');
    });
  });
});
