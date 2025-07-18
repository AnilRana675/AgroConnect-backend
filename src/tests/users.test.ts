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
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'farmer',
      });
      const user2 = new User({
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'buyer',
      });

      await user1.save();
      await user2.save();

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('John Doe');
      expect(response.body[1].name).toBe('Jane Smith');
      // Password should not be returned
      expect(response.body[0].password).toBeUndefined();
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'farmer',
      };

      const response = await request(app).post('/api/users').send(userData).expect(201);

      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body.role).toBe(userData.role);
      expect(response.body.password).toBeUndefined();

      // Verify user was saved to database
      const savedUser = await User.findOne({ email: userData.email });
      expect(savedUser).toBeTruthy();
    });

    it('should return 400 if user already exists', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'farmer',
      };

      // Create user first
      const existingUser = new User(userData);
      await existingUser.save();

      const response = await request(app).post('/api/users').send(userData).expect(400);

      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'farmer',
      });
      await user.save();

      const response = await request(app).get(`/api/users/${user._id}`).expect(200);

      expect(response.body.name).toBe(user.name);
      expect(response.body.email).toBe(user.email);
      expect(response.body.password).toBeUndefined();
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app).get(`/api/users/${nonExistentId}`).expect(404);

      expect(response.body.message).toBe('User not found');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'farmer',
      });
      await user.save();

      const updateData = {
        name: 'Updated User',
        email: 'updated@example.com',
        role: 'buyer',
      };

      const response = await request(app)
        .put(`/api/users/${user._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.email).toBe(updateData.email);
      expect(response.body.role).toBe(updateData.role);
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/users/${nonExistentId}`)
        .send({ name: 'Updated User' })
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'farmer',
      });
      await user.save();

      const response = await request(app).delete(`/api/users/${user._id}`).expect(200);

      expect(response.body.message).toBe('User deleted successfully');

      // Verify user was deleted from database
      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });

    it('should return 404 if user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app).delete(`/api/users/${nonExistentId}`).expect(404);

      expect(response.body.message).toBe('User not found');
    });
  });
});
