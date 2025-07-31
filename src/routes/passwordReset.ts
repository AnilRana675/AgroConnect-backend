import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User';
import emailService from '../services/emailService';
import authUtils from '../utils/auth';
import logger from '../utils/logger';

const router = express.Router();

// Rate limiting for password reset requests (stricter than general auth)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 password reset requests per 15 minutes per IP
  message: {
    error: 'Too many password reset requests',
    message: 'Please wait 15 minutes before requesting another password reset',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        message: 'Please provide an email address',
      });
    }

    // Find user by email
    const user = await User.findOne({ 'loginCredentials.email': email });
    if (!user) {
      // For security, don't reveal if email exists or not
      return res.json({
        message: 'If an account with this email exists, a password reset link has been sent',
        email,
      });
    }

    // Check if there's already a recent reset request (prevent spam)
    const recentResetRequest = user.passwordReset?.resetTokenExpires;
    if (recentResetRequest && new Date(recentResetRequest.getTime() - 60 * 60 * 1000) > new Date(Date.now() - 5 * 60 * 1000)) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Please wait 5 minutes before requesting another password reset',
      });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    if (!user.passwordReset) {
      user.passwordReset = {};
    }
    user.passwordReset.resetToken = resetToken;
    user.passwordReset.resetTokenExpires = tokenExpires;
    await user.save();

    // Send password reset email
    const emailSent = await emailService.sendPasswordResetEmail(
      email,
      user.personalInfo.firstName,
      resetToken
    );

    if (!emailSent) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: 'Email service is not configured. Please contact support.',
      });
    }

    logger.info(`Password reset email sent to: ${email}`);

    res.json({
      message: 'If an account with this email exists, a password reset link has been sent',
      email,
      expiresIn: '1 hour',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to process password reset request',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, reset token, and new password are required',
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password must be at least 6 characters long',
      });
    }

    // Find user by email and valid reset token
    const user = await User.findOne({
      'loginCredentials.email': email,
      'passwordReset.resetToken': token,
      'passwordReset.resetTokenExpires': { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.loginCredentials.password = newPassword;

    // Clear reset token
    if (user.passwordReset) {
      user.passwordReset.resetToken = undefined;
      user.passwordReset.resetTokenExpires = undefined;
      user.passwordReset.resetAt = new Date();
    }

    await user.save();

    logger.info(`Password reset completed for user: ${email}`);

    res.json({
      message: 'Password reset successfully',
      email,
      resetAt: user.passwordReset?.resetAt,
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to reset password',
    });
  }
});

/**
 * POST /api/auth/validate-reset-token
 * Validate if reset token is still valid (for frontend validation)
 */
router.post('/validate-reset-token', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and reset token are required',
      });
    }

    // Find user by email and valid reset token
    const user = await User.findOne({
      'loginCredentials.email': email,
      'passwordReset.resetToken': token,
      'passwordReset.resetTokenExpires': { $gt: new Date() },
    }, {
      'personalInfo.firstName': 1,
      'passwordReset.resetTokenExpires': 1,
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset link is invalid or has expired',
        isValid: false,
      });
    }

    res.json({
      message: 'Reset token is valid',
      isValid: true,
      firstName: user.personalInfo.firstName,
      expiresAt: user.passwordReset?.resetTokenExpires,
    });
  } catch (error) {
    logger.error('Validate reset token error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to validate reset token',
      isValid: false,
    });
  }
});

export default router;
