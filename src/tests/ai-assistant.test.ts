import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import aiAssistantRoutes from '../routes/ai-assistant';
import { User } from '../models/User';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

// Mock the OpenRouter AI service
jest.mock('../services/openRouterAI', () => ({
  __esModule: true,
  default: {
    isConfigured: () => true,
    getFarmingAdvice: async () => 'Mocked farming advice response',
    getWeeklyTips: async () => 'Mocked weekly tips response',
    identifyCropDisease: async () => 'Mocked disease diagnosis response',
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
  app.use('/api/ai', aiAssistantRoutes);

  return app;
};

const app = createTestApp();

describe('AI Assistant API', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await User.deleteMany({});
  });

  describe('GET /api/ai/status', () => {
    it('should return AI service status', async () => {
      const response = await request(app).get('/api/ai/status').expect(200);

      expect(response.body).toHaveProperty('configured');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.configured).toBe('boolean');
    });
  });

  describe('POST /api/ai/ask-anonymous', () => {
    it('should provide farming advice for anonymous users', async () => {
      const question = {
        question: 'What is the best time to plant rice in Nepal?',
        location: 'Kathmandu, Nepal',
        farmerType: 'Rice Farmer',
        farmingScale: 'Small Scale',
      };

      const response = await request(app).post('/api/ai/ask-anonymous').send(question).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data).toHaveProperty('contextUsed');
      expect(typeof response.body.data.answer).toBe('string');
    });

    it('should require question field', async () => {
      const response = await request(app).post('/api/ai/ask-anonymous').send({}).expect(400);

      expect(response.body.error).toBe('Question is required');
    });

    it('should handle questions without context', async () => {
      const question = {
        question: 'What is organic farming?',
      };

      const response = await request(app).post('/api/ai/ask-anonymous').send(question).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data.contextUsed).toBe('general Nepal farming');
    });
  });

  describe('POST /api/ai/ask', () => {
    it('should provide farming advice without user profile', async () => {
      const question = {
        question: 'How do I prevent pest attacks on my crops?',
      };

      const response = await request(app).post('/api/ai/ask').send(question).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data).toHaveProperty('personalized');
      expect(response.body.data.personalized).toBe(false);
      expect(response.body.data.userProfile).toBe(null);
    });

    it('should require question field', async () => {
      const response = await request(app).post('/api/ai/ask').send({}).expect(400);

      expect(response.body.error).toBe('Question is required');
    });

    it('should handle invalid userId gracefully', async () => {
      const question = {
        question: 'What crops grow well in monsoon?',
        userId: 'invalid-user-id',
      };

      const response = await request(app).post('/api/ai/ask').send(question).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data.personalized).toBe(false);
      expect(response.body.data.userProfile).toBe(null);
    });
  });

  describe('POST /api/ai/diagnose', () => {
    it('should provide crop disease diagnosis', async () => {
      const symptoms = {
        description: 'Yellow leaves with brown spots and wilting',
        cropType: 'rice',
      };

      const response = await request(app).post('/api/ai/diagnose').send(symptoms).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('diagnosis');
      expect(response.body.data.cropInfo).toHaveProperty('type');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('analyzedAt');
      expect(response.body.data.cropInfo.type).toBe('rice');
      expect(typeof response.body.data.diagnosis).toBe('string');
    });

    it('should require description field', async () => {
      const response = await request(app).post('/api/ai/diagnose').send({}).expect(400);

      expect(response.body.error).toBe('Disease description is required');
    });

    it('should handle diagnosis without crop type', async () => {
      const symptoms = {
        description: 'Leaves are turning yellow and falling off',
      };

      const response = await request(app).post('/api/ai/diagnose').send(symptoms).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('diagnosis');
      expect(response.body.data.cropInfo.type).toBe('unspecified');
    });
  });

  describe('GET /api/ai/weekly-tips/:userId', () => {
    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/ai/weekly-tips/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/ai/ask with user profile', () => {
    it('should provide personalized advice when user exists', async () => {
      // Create a test user
      const testUser = new User({
        personalInfo: { firstName: 'Test', lastName: 'Farmer' },
        locationInfo: { state: 'Bagmati Province', district: 'Kathmandu', municipality: 'KMC' },
        farmInfo: { farmerType: 'Organic Farming', farmingScale: 'Small Scale' },
        loginCredentials: { email: 'test@example.com', password: 'password123' },
      });
      await testUser.save();

      const question = {
        question: 'What should I do this week for my crops?',
        userId: testUser._id?.toString(),
      };

      const response = await request(app).post('/api/ai/ask').send(question).expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data.personalized).toBe(true);
      expect(response.body.data.userProfile).toBeTruthy();
      expect(response.body.data.userProfile.farmerType).toBe('Organic Farming');
    });
  });

  describe('GET /api/ai/weekly-tips/:userId with valid user', () => {
    it('should provide weekly tips for registered user', async () => {
      // Create a test user
      const testUser = new User({
        personalInfo: { firstName: 'Weekly', lastName: 'Tips' },
        locationInfo: { state: 'Gandaki Province', district: 'Pokhara', municipality: 'PMC' },
        farmInfo: { farmerType: 'Rice Farming', farmingScale: 'Medium Scale' },
        loginCredentials: { email: 'weekly@example.com', password: 'password123' },
      });
      await testUser.save();

      const response = await request(app)
        .get(`/api/ai/weekly-tips/${testUser._id?.toString()}`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('tips');
      expect(response.body.data).toHaveProperty('userProfile');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('generatedAt');
      expect(response.body.data.userProfile.farmerType).toBe('Rice Farming');
      expect(response.body.data.userProfile.location).toBe('Pokhara, Gandaki Province');
    });
  });
});
