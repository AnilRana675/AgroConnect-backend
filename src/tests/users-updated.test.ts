import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import httpLogger from '../middleware/httpLogger';
import userRoutes from '../routes/users';
import { User } from '../models/User';
import { describe, beforeEach, it, expect } from '@jest/globals';

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
  app.use('/api/users', userRoutes);

  return app;
};

const app = createTestApp();

describe('User Routes', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await User.deleteMany({});
  });

  describe('GET /api/users', () => {
    it('should return empty array when no users exist', async () => {
      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all users', async () => {
      // Create test users
      const user1 = new User({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
        },
        locationInfo: {
          province: 'Province 1',
          district: 'Los Angeles',
          municipality: 'LA City',
        },
        farmInfo: {
          farmerType: 'Organic',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'john@example.com',
          password: 'password123',
        },
      });
      const user2 = new User({
        personalInfo: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
        locationInfo: {
          province: 'Province 2',
          district: 'Houston',
          municipality: 'Houston City',
        },
        farmInfo: {
          farmerType: 'Conventional',
          economicScale: 'Medium',
        },
        loginCredentials: {
          email: 'jane@example.com',
          password: 'password123',
        },
      });

      await user1.save();
      await user2.save();

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].personalInfo.firstName).toBe('John');
      expect(response.body[1].personalInfo.firstName).toBe('Jane');
      // Password should not be returned
      expect(response.body[0].loginCredentials.password).toBeUndefined();
      expect(response.body[1].loginCredentials.password).toBeUndefined();
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        personalInfo: {
          firstName: 'Alice',
          lastName: 'Johnson',
        },
        locationInfo: {
          province: 'Province 3',
          district: 'Miami',
          municipality: 'Miami City',
        },
        farmInfo: {
          farmerType: 'Sustainable',
          economicScale: 'Large',
        },
        loginCredentials: {
          email: 'alice@example.com',
          password: 'password123',
        },
      };

      const response = await request(app).post('/api/users').send(userData).expect(201);

      expect(response.body.personalInfo.firstName).toBe(userData.personalInfo.firstName);
      expect(response.body.loginCredentials.email).toBe(userData.loginCredentials.email);
      // Password should not be returned
      expect(response.body.loginCredentials.password).toBeUndefined();

      // Verify user is in database
      const userInDb = await User.findOne({
        'loginCredentials.email': userData.loginCredentials.email,
      });
      expect(userInDb).toBeTruthy();
      expect(userInDb?.personalInfo.firstName).toBe(userData.personalInfo.firstName);
    });

    it('should return 400 if user already exists', async () => {
      const userData = {
        personalInfo: {
          firstName: 'Bob',
          lastName: 'Wilson',
        },
        locationInfo: {
          province: 'Province 4',
          district: 'Chicago',
          municipality: 'Chicago City',
        },
        farmInfo: {
          farmerType: 'Conventional',
          economicScale: 'Medium',
        },
        loginCredentials: {
          email: 'bob@example.com',
          password: 'password123',
        },
      };

      // Create user first
      await request(app).post('/api/users').send(userData).expect(201);

      // Try to create same user again
      const response = await request(app).post('/api/users').send(userData).expect(400);

      expect(response.body.message).toContain('already exists');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      const user = new User({
        personalInfo: {
          firstName: 'Charlie',
          lastName: 'Brown',
        },
        locationInfo: {
          province: 'Province 5',
          district: 'Phoenix',
          municipality: 'Phoenix City',
        },
        farmInfo: {
          farmerType: 'Organic',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'charlie@example.com',
          password: 'password123',
        },
      });

      const savedUser = await user.save();

      const response = await request(app).get(`/api/users/${savedUser._id}`).expect(200);

      expect(response.body.personalInfo.firstName).toBe('Charlie');
      expect(response.body.loginCredentials.email).toBe('charlie@example.com');
      // Password should not be returned
      expect(response.body.loginCredentials.password).toBeUndefined();
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/users/${nonExistentId}`).expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      const user = new User({
        personalInfo: {
          firstName: 'David',
          lastName: 'Lee',
        },
        locationInfo: {
          province: 'Province 6',
          district: 'Seattle',
          municipality: 'Seattle City',
        },
        farmInfo: {
          farmerType: 'Conventional',
          economicScale: 'Medium',
        },
        loginCredentials: {
          email: 'david@example.com',
          password: 'password123',
        },
      });

      const savedUser = await user.save();

      const updateData = {
        personalInfo: {
          firstName: 'David',
          lastName: 'Smith', // Changed last name
        },
        locationInfo: {
          province: 'Province 7', // Changed province
          district: 'Denver',
          municipality: 'Denver City',
        },
        farmInfo: {
          farmerType: 'Organic', // Changed farmer type
          economicScale: 'Large',
        },
      };

      const response = await request(app)
        .put(`/api/users/${savedUser._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.personalInfo.lastName).toBe('Smith');
      expect(response.body.locationInfo.province).toBe('Province 7');
      expect(response.body.farmInfo.farmerType).toBe('Organic');
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        personalInfo: {
          firstName: 'Updated',
          lastName: 'Name',
        },
      };

      const response = await request(app)
        .put(`/api/users/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      const user = new User({
        personalInfo: {
          firstName: 'Eva',
          lastName: 'Martinez',
        },
        locationInfo: {
          province: 'Province 8',
          district: 'Boston',
          municipality: 'Boston City',
        },
        farmInfo: {
          farmerType: 'Sustainable',
          economicScale: 'Small',
        },
        loginCredentials: {
          email: 'eva@example.com',
          password: 'password123',
        },
      });

      const savedUser = await user.save();

      const response = await request(app).delete(`/api/users/${savedUser._id}`).expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify user is deleted from database
      const userInDb = await User.findById(savedUser._id);
      expect(userInDb).toBeNull();
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).delete(`/api/users/${nonExistentId}`).expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});
