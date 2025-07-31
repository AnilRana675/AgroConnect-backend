import express, { Request, Response } from 'express';
import { User } from '../models/User';
import authUtils from '../utils/auth';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess, sendValidationError, sendAuthError, sendError } from '../utils/response';

const router = express.Router();

/**
 * POST /api/auth/login - User login
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  // Find user by email
  const user = await User.findOne({ 'loginCredentials.email': email.toLowerCase() });
  if (!user) {
    throw new AppError('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user has a password (in case of incomplete registration)
  if (!user.loginCredentials.password) {
    throw new AppError('Please complete your registration process', 400, 'INCOMPLETE_REGISTRATION');
  }

  // Verify password
  const isPasswordValid = await authUtils.comparePassword(
    password,
    user.loginCredentials.password,
  );
  if (!isPasswordValid) {
    throw new AppError('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT token (user is guaranteed to exist here due to previous checks)
  const token = authUtils.generateToken(user!);

  // Remove password from response
  const userResponse = user!.toObject();
  delete userResponse.loginCredentials.password;

  logger.info(`User logged in successfully: ${email}`, { requestId: req.requestId });

  return sendSuccess(res, {
    user: userResponse,
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  }, 'Login successful');
}));

/**
 * POST /api/auth/logout - User logout (client-side token removal)
 */
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // In a JWT-based system, logout is typically handled client-side
  // by removing the token from storage
  logger.info(`User logged out: ${req.user?.email}`, { requestId: req.requestId });

  return sendSuccess(res, {
    instruction: 'Remove the authentication token from your client storage',
  }, 'Logout successful');
}));

/**
 * GET /api/auth/me - Get current user profile
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.userId).select('-loginCredentials.password');

  if (!user) {
    throw new AppError('Your account may have been deleted', 404, 'USER_NOT_FOUND');
  }

  return sendSuccess(res, { user }, 'User profile retrieved successfully');
}));

/**
 * PUT /api/auth/change-password - Change user password
 */
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
        message: 'Please provide both current and new passwords',
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'New password must be at least 6 characters long',
      });
    }

    // Find user
    const user = await User.findById(req.user?.userId);
    if (!user || !user.loginCredentials.password) {
      return res.status(404).json({
        error: 'User not found or password not set',
        message: 'Please contact support',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await authUtils.comparePassword(
      currentPassword,
      user.loginCredentials.password,
    );
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        message: 'Please provide your correct current password',
      });
    }

    // Hash new password
    const hashedNewPassword = await authUtils.hashPassword(newPassword);

    // Update password
    user.loginCredentials.password = hashedNewPassword;
    await user.save();

    logger.info(`Password changed for user: ${req.user?.email}`);

    res.json({
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      error: 'Server error changing password',
      message: 'Please try again later',
    });
  }
});

/**
 * POST /api/auth/verify-token - Verify if token is valid
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
        message: 'Please provide a token to verify',
      });
    }

    // Verify token
    const decoded = authUtils.verifyToken(token);

    // Check if user exists
    const user = await User.findById(decoded.userId).select('-loginCredentials.password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists',
      });
    }

    res.json({
      message: 'Token is valid',
      user,
      tokenData: {
        userId: decoded.userId,
        email: decoded.email,
      },
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid or expired',
    });
  }
});

/**
 * GET /api/auth/status - Check authentication status
 */
router.get('/status', (req, res) => {
  res.json({
    message: 'Authentication service is running',
    jwtConfigured: authUtils.isJWTConfigured(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
