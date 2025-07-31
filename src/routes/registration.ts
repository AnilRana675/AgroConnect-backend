import express from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { TempRegistration } from '../models/TempRegistration';
import authUtils from '../utils/auth';
import logger from '../utils/logger';
import redisService from '../services/redisService';
import { cacheMiddleware } from '../middleware/cache';
import emailService from '../services/emailService';

const router = express.Router();

// Debug route to test if registration routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Registration routes are working', timestamp: new Date() });
});

// Helper function to find or create temp registration
async function findOrCreateTempRegistration(sessionId: string) {
  let tempRegistration = await TempRegistration.findOne({ sessionId });

  if (!tempRegistration) {
    tempRegistration = new TempRegistration({
      sessionId,
      currentStep: 0,
    });
  }

  return tempRegistration;
}

// Step 1: Save Name
router.post('/step1', async (req, res) => {
  try {
    logger.info('Step1 route hit', { body: req.body, headers: req.headers });
    const { firstName, middleName, lastName, sessionId } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        message: 'First name and last name are required',
        step: 1,
      });
    }

    const actualSessionId =
      sessionId || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Store in temporary database
    const tempRegistration = await findOrCreateTempRegistration(actualSessionId);

    tempRegistration.personalInfo = {
      firstName,
      middleName,
      lastName,
    };
    tempRegistration.currentStep = 1;

    await tempRegistration.save();
    logger.info(
      `Step 1 completed for user: ${firstName} ${lastName}, sessionId: ${actualSessionId}`,
    );

    res.status(200).json({
      message: 'Name saved successfully',
      step: 1,
      data: {
        firstName,
        middleName,
        lastName,
        sessionId: actualSessionId,
      },
      nextStep: 2,
    });
  } catch (error) {
    logger.error('Error in registration step 1:', error);
    res.status(500).json({ message: 'Server error in step 1', error });
  }
});

// Step 2: Save Location
router.post('/step2', async (req, res) => {
  try {
    // Accept sessionId from body or header
    const sessionId = req.body.sessionId || req.headers['x-session-id'];
    const { province, district, municipality } = req.body;

    if (!province || !district || !municipality) {
      return res.status(400).json({
        message: 'Province, district, and municipality are required',
        step: 2,
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        step: 2,
      });
    }

    // Find existing temp registration
    const tempRegistration = await TempRegistration.findOne({ sessionId });
    if (!tempRegistration) {
      return res.status(400).json({
        message: 'Invalid session. Please start registration from step 1',
        step: 2,
      });
    }

    // Update location info
    tempRegistration.locationInfo = {
      province,
      district,
      municipality,
    };
    tempRegistration.currentStep = 2;

    await tempRegistration.save();
    logger.info(`Step 2 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Location saved successfully',
      step: 2,
      data: {
        province,
        district,
        municipality,
        sessionId,
      },
      nextStep: 3,
    });
  } catch (error) {
    logger.error('Error in registration step 2:', error);
    res.status(500).json({ message: 'Server error in step 2', error });
  }
});

// Step 3: Save Agriculture Type
router.post('/step3', async (req, res) => {
  try {
    const { farmerType, sessionId } = req.body;

    if (!farmerType) {
      return res.status(400).json({
        message: 'Agriculture type is required',
        step: 3,
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        step: 3,
      });
    }

    // Find existing temp registration or create new one if it doesn't exist
    let tempRegistration = await TempRegistration.findOne({ sessionId });
    if (!tempRegistration) {
      tempRegistration = new TempRegistration({
        sessionId,
        currentStep: 0,
      });
    }

    // Update farm info
    if (!tempRegistration.farmInfo) {
      tempRegistration.farmInfo = {};
    }
    tempRegistration.farmInfo.farmerType = farmerType;
    tempRegistration.currentStep = 3;

    await tempRegistration.save();
    logger.info(`Step 3 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Agriculture type saved successfully',
      step: 3,
      data: {
        farmerType,
        sessionId,
      },
      nextStep: 4,
    });
  } catch (error) {
    logger.error('Error in registration step 3:', error);
    res.status(500).json({ message: 'Server error in step 3', error });
  }
});

// Step 4: Save Economic Scale
router.post('/step4', async (req, res) => {
  try {
    const { economicScale, sessionId } = req.body;

    if (!economicScale) {
      return res.status(400).json({
        message: 'Economic scale is required',
        step: 4,
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        step: 4,
      });
    }

    // Find existing temp registration or create new one if it doesn't exist
    let tempRegistration = await TempRegistration.findOne({ sessionId });
    if (!tempRegistration) {
      tempRegistration = new TempRegistration({
        sessionId,
        currentStep: 0,
      });
    }

    // Update farm info
    if (!tempRegistration.farmInfo) {
      tempRegistration.farmInfo = {};
    }
    tempRegistration.farmInfo.economicScale = economicScale;
    tempRegistration.currentStep = 4;

    await tempRegistration.save();
    logger.info(`Step 4 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Economic scale saved successfully',
      step: 4,
      data: {
        economicScale,
        sessionId,
      },
      nextStep: 5,
    });
  } catch (error) {
    logger.error('Error in registration step 4:', error);
    res.status(500).json({ message: 'Server error in step 4', error });
  }
});

// Step 5: Save Email
router.post('/step5', async (req, res) => {
  try {
    const { email, sessionId } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email address is required',
        step: 5,
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        step: 5,
      });
    }

    // Check if email already exists in permanent users
    const existingUser = await User.findOne({ 'loginCredentials.email': email });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already registered',
        step: 5,
      });
    }

    // Find existing temp registration or create new one if it doesn't exist
    let tempRegistration = await TempRegistration.findOne({ sessionId });
    if (!tempRegistration) {
      tempRegistration = new TempRegistration({
        sessionId,
        currentStep: 0,
      });
    }

    // Update email
    if (!tempRegistration.loginCredentials) {
      tempRegistration.loginCredentials = {};
    }
    tempRegistration.loginCredentials.email = email;
    tempRegistration.currentStep = 5;

    await tempRegistration.save();
    logger.info(`Step 5 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Email saved successfully',
      step: 5,
      data: {
        email,
        sessionId,
      },
      nextStep: 6,
    });
  } catch (error) {
    logger.error('Error in registration step 5:', error);
    res.status(500).json({ message: 'Server error in step 5', error });
  }
});

// Step 6: Complete Registration (Save Password and Create User)
router.post('/complete', async (req, res) => {
  try {
    const { password, sessionId, personalInfo, locationInfo, farmInfo, loginCredentials } =
      req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        step: 6,
      });
    }

    // Handle both direct submission and session-based submission
    let userData;
    if (personalInfo || locationInfo || farmInfo || loginCredentials) {
      // Direct submission with data (even if incomplete)
      userData = {
        personalInfo,
        locationInfo,
        farmInfo,
        loginCredentials,
      };
    } else {
      // Session-based submission
      if (!password) {
        return res.status(400).json({
          message: 'Password is required',
          step: 6,
        });
      }

      const tempRegistration = await TempRegistration.findOne({ sessionId });
      if (!tempRegistration) {
        return res.status(400).json({
          message: 'Invalid session. Please start registration from step 1',
          step: 6,
        });
      }

      // Validate all data is complete
      if (!tempRegistration.personalInfo?.firstName || !tempRegistration.personalInfo?.lastName) {
        return res.status(400).json({
          message: 'Personal information is incomplete. Please complete all previous steps.',
          step: 6,
        });
      }

      if (
        !tempRegistration.locationInfo?.province ||
        !tempRegistration.locationInfo?.district ||
        !tempRegistration.locationInfo?.municipality
      ) {
        return res.status(400).json({
          message: 'Location information is incomplete. Please complete all previous steps.',
          step: 6,
        });
      }

      if (!tempRegistration.farmInfo?.farmerType || !tempRegistration.farmInfo?.economicScale) {
        return res.status(400).json({
          message: 'Farm information is incomplete. Please complete all previous steps.',
          step: 6,
        });
      }

      if (!tempRegistration.loginCredentials?.email) {
        return res.status(400).json({
          message: 'Email is missing. Please complete all previous steps.',
          step: 6,
        });
      }

      userData = {
        personalInfo: tempRegistration.personalInfo,
        locationInfo: tempRegistration.locationInfo,
        farmInfo: tempRegistration.farmInfo,
        loginCredentials: {
          email: tempRegistration.loginCredentials.email,
          password: password,
        },
      };
    }

    // Validate required fields - check fields in order of priority
    if (!userData.personalInfo?.firstName || !userData.personalInfo?.lastName) {
      return res.status(400).json({
        message: 'Personal information is incomplete',
        step: 6,
      });
    }

    if (
      !userData.locationInfo?.province ||
      !userData.locationInfo?.district ||
      !userData.locationInfo?.municipality
    ) {
      return res.status(400).json({
        message: 'Location information is incomplete',
        step: 6,
      });
    }

    if (!userData.farmInfo?.farmerType || !userData.farmInfo?.economicScale) {
      return res.status(400).json({
        message: 'Farm information is incomplete',
        step: 6,
      });
    }

    if (!userData.loginCredentials?.email) {
      return res.status(400).json({
        message: 'Email is missing',
        step: 6,
      });
    }

    if (!userData.loginCredentials?.password) {
      return res.status(400).json({
        message: 'Password is required',
        step: 6,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      'loginCredentials.email': userData.loginCredentials.email,
    });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email',
        step: 6,
      });
    }

    // Create new user
    const newUser = new User(userData);
    
    // Set up email verification
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    newUser.emailVerification = {
      isVerified: false,
      verificationToken,
      verificationTokenExpires: verificationExpires,
    };
    
    await newUser.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        userData.loginCredentials.email,
        userData.personalInfo.firstName,
        verificationToken
      );
      logger.info(`Verification email sent to: ${userData.loginCredentials.email}`);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, just log it
    }

    // Delete temporary registration if it exists
    await TempRegistration.deleteOne({ sessionId });

    // Generate JWT token for the new user
    const token = authUtils.generateToken(newUser);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.loginCredentials.password;

    logger.info(`Registration completed for user: ${userData.loginCredentials.email}`);

    res.status(201).json({
      message: 'Registration completed successfully. Please check your email to verify your account.',
      step: 6,
      user: userResponse,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      sessionId,
      registrationComplete: true,
      emailVerificationRequired: true,
    });
  } catch (error) {
    logger.error('Error completing registration:', error);
    res.status(500).json({ message: 'Server error completing registration', error });
  }
});

// Get current registration progress
router.get('/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const tempRegistration = await TempRegistration.findOne({ sessionId });
    if (!tempRegistration) {
      return res.status(404).json({
        message: 'Session not found',
        currentStep: 0,
      });
    }

    res.status(200).json({
      message: 'Registration progress retrieved',
      currentStep: tempRegistration.currentStep,
      data: {
        personalInfo: tempRegistration.personalInfo,
        locationInfo: tempRegistration.locationInfo,
        farmInfo: tempRegistration.farmInfo,
        loginCredentials: tempRegistration.loginCredentials
          ? {
              email: tempRegistration.loginCredentials.email,
            }
          : undefined,
      },
    });
  } catch (error) {
    logger.error('Error getting registration progress:', error);
    res.status(500).json({ message: 'Server error getting progress', error });
  }
});

// Get registration options/metadata
router.get(
  '/options',
  cacheMiddleware({
    ttl: redisService.getRegistrationOptionsTTL(),
    keyGenerator: () => redisService.generateRegistrationOptionsKey(),
  }),
  async (req, res) => {
    try {
      const options = {
        agricultureTypes: [
          'Organic Farming',
          'Conventional Farming',
          'Sustainable Agriculture',
          'Permaculture',
          'Hydroponics',
          'Livestock Farming',
          'Dairy Farming',
          'Poultry Farming',
          'Aquaculture',
          'Mixed Farming',
        ],
        economicScales: [
          'Small Scale (Less than 2 hectares)',
          'Medium Scale (2-10 hectares)',
          'Large Scale (10-50 hectares)',
          'Commercial Scale (50+ hectares)',
          'Subsistence Farming',
          'Semi-Commercial',
        ],
        states: [
          'Province 1',
          'Province 2',
          'Bagmati Province',
          'Gandaki Province',
          'Lumbini Province',
          'Karnali Province',
          'Sudurpashchim Province',
        ],
      };

      res.status(200).json({
        message: 'Registration options retrieved successfully',
        options,
      });
    } catch (error) {
      logger.error('Error getting registration options:', error);
      res.status(500).json({ message: 'Server error getting options', error });
    }
  },
);

export default router;
