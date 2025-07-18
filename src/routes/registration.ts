import express from 'express';
import { User } from '../models/User';
import logger from '../utils/logger';

const router = express.Router();

// Step 1: Save Name
router.post('/step1', async (req, res) => {
  try {
    const { firstName, middleName, lastName, sessionId } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        message: 'First name and last name are required',
        step: 1,
      });
    }

    // Store in session or temporary storage
    // For now, we'll just validate and return success
    logger.info(`Step 1 completed for user: ${firstName} ${lastName}`);

    res.status(200).json({
      message: 'Name saved successfully',
      step: 1,
      data: {
        firstName,
        middleName,
        lastName,
        sessionId: sessionId || `temp_${Date.now()}`,
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
    const { state, district, municipality, sessionId } = req.body;

    if (!state || !district || !municipality) {
      return res.status(400).json({
        message: 'State, district, and municipality are required',
        step: 2,
      });
    }

    logger.info(`Step 2 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Location saved successfully',
      step: 2,
      data: {
        state,
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
    const { farmingScale, sessionId } = req.body;

    if (!farmingScale) {
      return res.status(400).json({
        message: 'Economic scale is required',
        step: 4,
      });
    }

    logger.info(`Step 4 completed for session: ${sessionId}`);

    res.status(200).json({
      message: 'Economic scale saved successfully',
      step: 4,
      data: {
        farmingScale,
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

    // Check if email already exists
    const existingUser = await User.findOne({ 'loginCredentials.email': email });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already registered',
        step: 5,
      });
    }

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

// Step 6: Complete Registration
router.post('/complete', async (req, res) => {
  try {
    const { personalInfo, locationInfo, farmInfo, loginCredentials, sessionId } = req.body;

    // Validate all required fields
    if (!personalInfo?.firstName || !personalInfo?.lastName) {
      return res.status(400).json({
        message: 'Personal information is incomplete',
        step: 6,
      });
    }

    if (!locationInfo?.state || !locationInfo?.district || !locationInfo?.municipality) {
      return res.status(400).json({
        message: 'Location information is incomplete',
        step: 6,
      });
    }

    if (!farmInfo?.farmerType || !farmInfo?.farmingScale) {
      return res.status(400).json({
        message: 'Farm information is incomplete',
        step: 6,
      });
    }

    if (!loginCredentials?.email || !loginCredentials?.password) {
      return res.status(400).json({
        message: 'Login credentials are incomplete',
        step: 6,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      'loginCredentials.email': loginCredentials.email,
    });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email',
        step: 6,
      });
    }

    // Create new user
    const newUser = new User({
      personalInfo,
      locationInfo,
      farmInfo,
      loginCredentials,
    });

    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.loginCredentials.password;

    logger.info(`Registration completed for user: ${loginCredentials.email}`);

    res.status(201).json({
      message: 'Registration completed successfully',
      step: 6,
      user: userResponse,
      sessionId,
      registrationComplete: true,
    });
  } catch (error) {
    logger.error('Error completing registration:', error);
    res.status(500).json({ message: 'Server error completing registration', error });
  }
});

// Get registration options/metadata
router.get('/options', async (req, res) => {
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
});

export default router;
