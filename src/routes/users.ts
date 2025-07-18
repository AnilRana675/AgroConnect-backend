import express from 'express';
import { User, IUser } from '../models/User';
import logger from '../utils/logger';

const router = express.Router();

// GET /api/users - Get all users
router.get('/', async (_req, res) => {
  try {
    const users = await User.find().select('-loginCredentials.password');
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-loginCredentials.password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user', error });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { personalInfo, locationInfo, farmInfo, loginCredentials } = req.body.user || req.body;
    if (!personalInfo || !locationInfo || !farmInfo || !loginCredentials) {
      return res.status(400).json({ message: 'Missing required user information' });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ 'loginCredentials.email': loginCredentials.email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const newUser = new User({ personalInfo, locationInfo, farmInfo, loginCredentials });
    await newUser.save();
    const userResponse = newUser.toObject();
    if (
      userResponse.loginCredentials &&
      typeof userResponse.loginCredentials.password !== 'undefined'
    ) {
      delete userResponse.loginCredentials.password;
    }
    res.status(201).json(userResponse);
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(400).json({ message: 'Error creating user', error });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { personalInfo, locationInfo, farmInfo, loginCredentials } = req.body.user || req.body;
    const updateData: Partial<IUser> = {};
    if (personalInfo) updateData.personalInfo = personalInfo;
    if (locationInfo) updateData.locationInfo = locationInfo;
    if (farmInfo) updateData.farmInfo = farmInfo;
    if (loginCredentials) updateData.loginCredentials = loginCredentials;
    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-loginCredentials.password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(400).json({ message: 'Error updating user', error });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

export default router;
