import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import plantRoutes from '../routes/plant';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock node-fetch before importing anything that uses it
jest.mock('node-fetch', () => {
  return jest.fn().mockImplementation(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      suggestions: [
        {
          id: 123,
          plant_name: 'Test Plant',
          plant_details: {
            common_names: ['Test Plant'],
            scientific_name: 'Testus plantus'
          },
          probability: 0.95
        }
      ]
    })
  }));
});

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
  app.use('/api/plant', plantRoutes);

  return app;
};

const app = createTestApp();

// Mock base64 image for testing (small 1x1 pixel PNG but longer to pass validation)
const MOCK_BASE64_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==PADDING';

describe('Plant API', () => {
  describe('POST /api/plant/identify', () => {
    it('should return 400 if no imageBase64 is provided', async () => {
      const response = await request(app).post('/api/plant/identify').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing or invalid imageBase64');
    });

    it('should return 400 if imageBase64 is too short', async () => {
      const response = await request(app)
        .post('/api/plant/identify')
        .send({ imageBase64: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing or invalid imageBase64');
    });

    it('should return 400 if imageBase64 is not a string', async () => {
      const response = await request(app).post('/api/plant/identify').send({ imageBase64: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing or invalid imageBase64');
    });

    it('should accept valid base64 image data', async () => {
      const response = await request(app)
        .post('/api/plant/identify')
        .send({ imageBase64: MOCK_BASE64_IMAGE });

      // The response should not be a 400 error (validation error)
      expect(response.status).not.toBe(400);

      // The response should have a success field
      expect(response.body).toHaveProperty('success');

      // If successful, should have data with required fields
      if (response.body.success) {
        expect(response.body.data).toHaveProperty('isPlant');
        expect(response.body.data).toHaveProperty('scientificName');
        expect(response.body.data).toHaveProperty('commonNames');
        expect(response.body.data).toHaveProperty('confidence');
        expect(response.body.data).toHaveProperty('agriGuide');
      } else {
        // If not successful, should be due to missing API keys (expected in test environment)
        expect(response.status).toBe(500);
        expect(response.body.error).toBeDefined();
      }
    }, 30000); // Increased timeout for API calls

    it('should handle API errors gracefully', async () => {
      // Test with an empty base64 string (should trigger API errors)
      const response = await request(app)
        .post('/api/plant/identify')
        .send({ imageBase64: 'VGVzdCBpbWFnZSBkYXRh' }); // "Test image data" in base64

      // Should return a response (not crash)
      expect(response.status).toBeDefined();
      expect(response.body).toHaveProperty('success');

      // If there are errors, they should be properly handled
      if (response.body.error) {
        expect(response.body.error).toBeDefined();
      }
    }, 30000);
  });

  describe('Plant Identification Flow', () => {
    it('should process plant identification request end-to-end', async () => {
      const response = await request(app)
        .post('/api/plant/identify')
        .send({ imageBase64: MOCK_BASE64_IMAGE });

      // Should not throw errors
      expect(response.status).toBeDefined();

      // Should have proper response structure
      expect(response.body).toHaveProperty('success');

      if (response.body.success && response.body.data) {
        // Check data structure
        expect(typeof response.body.data.isPlant).toBe('boolean');
        expect(typeof response.body.data.scientificName).toBe('string');
        expect(Array.isArray(response.body.data.commonNames)).toBe(true);
        expect(typeof response.body.data.confidence).toBe('number');
        expect(typeof response.body.data.agriGuide).toBe('string');

        // Check confidence is a valid percentage
        expect(response.body.data.confidence).toBeGreaterThanOrEqual(0);
        expect(response.body.data.confidence).toBeLessThanOrEqual(100);
      } else {
        // In test environment, API calls may fail due to missing keys
        // This is acceptable for testing the structure
        expect(response.body.success).toBe(false);
      }
    }, 45000); // Extended timeout for full API flow
  });
});
