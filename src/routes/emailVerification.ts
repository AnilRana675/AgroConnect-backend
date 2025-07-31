import express from 'express';
import { User } from '../models/User';
import emailService from '../services/emailService';
import _authUtils from '../utils/auth';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = express.Router();

/**
 * POST /api/email/send-verification
 * Send verification email to user
 */
router.post('/send-verification', async (req, res) => {
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
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email address',
      });
    }

    // Check if already verified
    if (user.emailVerification?.isVerified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This email address is already verified',
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    if (!user.emailVerification) {
      user.emailVerification = {
        isVerified: false,
      };
    }
    user.emailVerification.verificationToken = verificationToken;
    user.emailVerification.verificationTokenExpires = tokenExpires;
    await user.save();

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(
      email,
      user.personalInfo.firstName,
      verificationToken,
    );

    if (!emailSent) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: 'Email service is not configured. Please contact support.',
      });
    }

    logger.info(`Verification email sent to: ${email}`);

    res.json({
      message: 'Verification email sent successfully',
      email,
      expiresIn: '24 hours',
    });
  } catch (error) {
    logger.error('Send verification email error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to send verification email',
    });
  }
});

/**
 * POST /api/email/verify
 * Verify email with token
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and verification token are required',
      });
    }

    // Find user by email and token
    const user = await User.findOne({
      'loginCredentials.email': email,
      'emailVerification.verificationToken': token,
      'emailVerification.verificationTokenExpires': { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The verification link is invalid or has expired. Please request a new one.',
      });
    }

    // Check if already verified
    if (user.emailVerification?.isVerified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This email address is already verified',
      });
    }

    // Mark as verified
    if (!user.emailVerification) {
      user.emailVerification = {
        isVerified: false,
      };
    }
    user.emailVerification.isVerified = true;
    user.emailVerification.verifiedAt = new Date();
    user.emailVerification.verificationToken = undefined;
    user.emailVerification.verificationTokenExpires = undefined;
    await user.save();

    logger.info(`Email verified for user: ${email}`);

    res.json({
      message: 'Email verified successfully',
      email,
      verifiedAt: user.emailVerification.verifiedAt,
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to verify email',
    });
  }
});

/**
 * POST /api/email/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
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
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email address',
      });
    }

    // Check if already verified
    if (user.emailVerification?.isVerified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This email address is already verified',
      });
    }

    // Check rate limiting (prevent spam)
    const lastTokenGenerated = user.emailVerification?.verificationTokenExpires;
    if (
      lastTokenGenerated &&
      new Date(lastTokenGenerated.getTime() - 24 * 60 * 60 * 1000) >
        new Date(Date.now() - 5 * 60 * 1000)
    ) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Please wait 5 minutes before requesting another verification email',
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    if (!user.emailVerification) {
      user.emailVerification = {
        isVerified: false,
      };
    }
    user.emailVerification.verificationToken = verificationToken;
    user.emailVerification.verificationTokenExpires = tokenExpires;
    await user.save();

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(
      email,
      user.personalInfo.firstName,
      verificationToken,
    );

    if (!emailSent) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: 'Email service is not configured. Please contact support.',
      });
    }

    logger.info(`Verification email resent to: ${email}`);

    res.json({
      message: 'Verification email sent successfully',
      email,
      expiresIn: '24 hours',
    });
  } catch (error) {
    logger.error('Resend verification email error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to resend verification email',
    });
  }
});

/**
 * GET /api/email/verification-status/:email
 * Check email verification status
 */
router.get('/verification-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Find user by email
    const user = await User.findOne(
      { 'loginCredentials.email': email },
      {
        'emailVerification.isVerified': 1,
        'emailVerification.verifiedAt': 1,
        'personalInfo.firstName': 1,
      },
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email address',
      });
    }

    res.json({
      email,
      isVerified: user.emailVerification?.isVerified || false,
      verifiedAt: user.emailVerification?.verifiedAt,
      firstName: user.personalInfo.firstName,
    });
  } catch (error) {
    logger.error('Get verification status error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get verification status',
    });
  }
});

export default router;
