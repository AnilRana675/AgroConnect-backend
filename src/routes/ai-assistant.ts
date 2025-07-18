import express from 'express';
import githubModelsAI from '../services/githubModelsAI';
import { User, IUser } from '../models/User';
import { authenticate, optionalAuth } from '../middleware/auth';
import logger from '../utils/logger';
import redisService from '../services/redisService';
// import { cacheMiddleware } from '../middleware/cache';

const router = express.Router();

// Check if AI service is configured
router.get('/status', (req, res) => {
  const isConfigured = githubModelsAI.isConfigured();
  res.json({
    success: true,
    configured: isConfigured,
    message: isConfigured
      ? 'AI service is ready'
      : 'AI service not configured - missing GitHub token',
    service: {
      name: 'GitHub Models AI Service',
      provider: 'GitHub Models',
      model: 'Llama-3.2-11B-Vision-Instruct',
      features: [
        'Farming advice',
        'Weekly tips generation',
        'Crop disease diagnosis',
        'Personalized recommendations',
      ],
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Get personalized farming advice
router.post('/ask', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { question, userId } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    let userProfile = null;
    let userDetails = null;

    // Get user profile from authenticated user or provided userId
    const targetUserId = req.user?.userId || userId;
    if (targetUserId) {
      try {
        // Check cache for user profile first
        const userProfileKey = redisService.generateUserProfileKey(targetUserId);
        let user = await redisService.get<IUser>(userProfileKey);

        if (!user) {
          // Fetch from database if not in cache
          user = await User.findById(targetUserId);
          if (user) {
            // Cache user profile
            await redisService.set(userProfileKey, user, redisService.getUserProfileTTL());
          }
        }

        if (user) {
          userProfile = {
            farmerType: user.farmInfo.farmerType,
            location: `${user.locationInfo.district}, ${user.locationInfo.province}`,
            economicScale: user.farmInfo.economicScale,
          };
          userDetails = {
            userId: user._id,
            name: `${user.personalInfo.firstName}${user.personalInfo.middleName ? ' ' + user.personalInfo.middleName : ''} ${user.personalInfo.lastName}`,
            district: user.locationInfo.district,
            province: user.locationInfo.province,
            farmerType: user.farmInfo.farmerType,
            economicScale: user.farmInfo.economicScale,
          };
        }
      } catch (error) {
        logger.warn(`Failed to fetch user profile for ${targetUserId}:`, error);
      }
    }

    // Check cache for AI response
    const aiResponseKey = redisService.generateAIResponseKey(question, userProfile || undefined);
    let answer = await redisService.get<string>(aiResponseKey);
    let cached = false;

    if (!answer) {
      // Generate new AI response if not in cache
      answer = await githubModelsAI.getFarmingAdvice({
        question,
        userProfile: userProfile || undefined,
      });

      // Cache the AI response
      await redisService.set(aiResponseKey, answer, redisService.getAIResponseTTL());
    } else {
      cached = true;
      logger.debug(`AI response cache hit for question: ${question.substring(0, 50)}...`);
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        answer,
        question,
        personalized: !!userProfile,
        userProfile: userProfile || null,
        userDetails: userDetails || null,
      },
      metadata: {
        requestId,
        responseTime: `${responseTime}ms`,
        service: 'GitHub Models AI',
        model: 'Llama-3.2-11B-Vision-Instruct',
        personalizationApplied: !!userProfile,
        contextType: userProfile ? 'user_profile' : 'anonymous',
        timestamp: new Date().toISOString(),
        apiVersion: '1.0',
      },
      analytics: {
        questionLength: question.length,
        answerLength: answer.length,
        processingTime: responseTime,
        cached: cached,
        confidenceScore: 0.85, // This could be enhanced with actual confidence scoring
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error in farming advice endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      metadata: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        service: 'GitHub Models AI',
        errorType: 'internal_server_error',
      },
    });
  }
});

// Get weekly farming tips for a user
router.get('/weekly-tips/:userId', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  const requestId = `tips_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { userId } = req.params;
    const targetUserId = req.user?.userId || userId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    const userProfile = {
      farmerType: user.farmInfo.farmerType,
      location: `${user.locationInfo.district}, ${user.locationInfo.province}`,
      economicScale: user.farmInfo.economicScale,
    };

    const tips = await githubModelsAI.getWeeklyTips(userProfile);
    const responseTime = Date.now() - startTime;

    // Get current date info for seasonal context
    const currentDate = new Date();
    const currentSeason = getCurrentSeason(currentDate);
    const weekOfYear = getWeekOfYear(currentDate);

    res.json({
      success: true,
      data: {
        tips,
        userProfile,
        userDetails: {
          userId: user._id,
          name: `${user.personalInfo.firstName}${user.personalInfo.middleName ? ' ' + user.personalInfo.middleName : ''} ${user.personalInfo.lastName}`,
          farmerType: user.farmInfo.farmerType,
          economicScale: user.farmInfo.economicScale,
          municipality: user.locationInfo.municipality,
        },
        seasonalContext: {
          currentSeason,
          weekOfYear,
          month: currentDate.toLocaleString('default', { month: 'long' }),
          applicableRegion: user.locationInfo.province,
        },
      },
      metadata: {
        requestId,
        responseTime: `${responseTime}ms`,
        service: 'GitHub Models AI',
        model: 'Llama-3.2-11B-Vision-Instruct',
        generatedAt: new Date().toISOString(),
        apiVersion: '1.0',
        contentType: 'weekly_farming_tips',
      },
      analytics: {
        tipsLength: tips.length,
        processingTime: responseTime,
        personalizationLevel: 'full',
        cached: false,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error generating weekly tips:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      metadata: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        service: 'GitHub Models AI',
        errorType: 'internal_server_error',
      },
    });
  }
});

// Helper functions
function getCurrentSeason(date: Date): string {
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Autumn';
  return 'Winter';
}

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}

// Identify crop diseases
router.post('/diagnose', async (req, res) => {
  const startTime = Date.now();
  const requestId = `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { description, cropType, _imageUrl, location, severity } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Disease description is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    const diagnosis = await githubModelsAI.identifyCropDisease(description, cropType);
    const responseTime = Date.now() - startTime;

    // Calculate risk level based on keywords in description
    const riskLevel = calculateRiskLevel(description);
    const urgency = determineUrgency(riskLevel, severity);

    res.json({
      success: true,
      data: {
        diagnosis,
        symptoms: {
          description,
          severity: severity || 'unknown',
          riskLevel,
          urgency,
        },
        cropInfo: {
          type: cropType || 'unspecified',
          affectedArea: location || 'not specified',
          commonDiseases: getCommonDiseases(cropType),
        },
        recommendations: {
          immediateActions: extractImmediateActions(diagnosis),
          preventiveMeasures: extractPreventiveMeasures(diagnosis),
          followUpRequired: urgency === 'high',
        },
      },
      metadata: {
        requestId,
        responseTime: `${responseTime}ms`,
        service: 'GitHub Models AI',
        model: 'Llama-3.2-11B-Vision-Instruct',
        analyzedAt: new Date().toISOString(),
        apiVersion: '1.0',
        contentType: 'crop_disease_diagnosis',
      },
      analytics: {
        descriptionLength: description.length,
        diagnosisLength: diagnosis.length,
        processingTime: responseTime,
        riskAssessment: riskLevel,
        cached: false,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error diagnosing crop disease:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      metadata: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        service: 'GitHub Models AI',
        errorType: 'internal_server_error',
      },
    });
  }
});

// Helper functions for diagnosis
function calculateRiskLevel(description: string): 'low' | 'medium' | 'high' {
  const highRiskKeywords = ['wilting', 'dying', 'spreading', 'yellow', 'brown', 'spots', 'rot'];
  const mediumRiskKeywords = ['discolored', 'stunted', 'weak', 'holes', 'damage'];

  const lowerDescription = description.toLowerCase();

  if (highRiskKeywords.some((keyword) => lowerDescription.includes(keyword))) {
    return 'high';
  }
  if (mediumRiskKeywords.some((keyword) => lowerDescription.includes(keyword))) {
    return 'medium';
  }
  return 'low';
}

function determineUrgency(riskLevel: string, severity?: string): 'low' | 'medium' | 'high' {
  if (riskLevel === 'high' || severity === 'severe') return 'high';
  if (riskLevel === 'medium' || severity === 'moderate') return 'medium';
  return 'low';
}

function getCommonDiseases(cropType?: string): string[] {
  const diseaseMap: { [key: string]: string[] } = {
    rice: ['Rice blast', 'Brown spot', 'Bacterial leaf blight'],
    wheat: ['Rust', 'Smut', 'Blight'],
    corn: ['Corn smut', 'Leaf spot', 'Stalk rot'],
    tomato: ['Blight', 'Mosaic virus', 'Wilt'],
    potato: ['Late blight', 'Scab', 'Blackleg'],
  };

  return (
    diseaseMap[cropType?.toLowerCase() || ''] || [
      'Various fungal infections',
      'Pest damage',
      'Nutrient deficiency',
    ]
  );
}

function extractImmediateActions(diagnosis: string): string[] {
  // Simple extraction - in a real implementation, this could be more sophisticated
  const actions = [];
  if (diagnosis.toLowerCase().includes('fungicide')) actions.push('Apply fungicide treatment');
  if (diagnosis.toLowerCase().includes('remove')) actions.push('Remove affected plants/leaves');
  if (diagnosis.toLowerCase().includes('isolate')) actions.push('Isolate affected area');
  if (diagnosis.toLowerCase().includes('water')) actions.push('Adjust watering schedule');

  return actions.length > 0
    ? actions
    : ['Consult with agricultural expert', 'Monitor plant condition'];
}

function extractPreventiveMeasures(_diagnosis: string): string[] {
  return [
    'Ensure proper crop rotation',
    'Maintain field hygiene',
    'Use resistant varieties',
    'Monitor weather conditions',
    'Regular field inspection',
  ];
}

// Get weekly farming tips for authenticated user
router.get('/weekly-tips', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userProfile = {
      farmerType: user.farmInfo.farmerType,
      location: `${user.locationInfo.district}, ${user.locationInfo.province}`,
      economicScale: user.farmInfo.economicScale,
    };

    const tips = await githubModelsAI.getWeeklyTips(userProfile);

    res.json({
      tips,
      userProfile,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating weekly tips:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get farming advice for anonymous users (without user profile)
router.post('/ask-anonymous', async (req, res) => {
  const startTime = Date.now();
  const requestId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { question, location, farmerType, economicScale } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    const userProfile =
      location || farmerType || economicScale
        ? {
            farmerType: farmerType || 'general',
            location: location || 'Nepal',
            economicScale: economicScale || 'general',
          }
        : null;

    const answer = await githubModelsAI.getFarmingAdvice({
      question,
      userProfile: userProfile || undefined,
    });

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        answer,
        question,
        contextUsed: userProfile || 'general Nepal farming',
        personalized: !!userProfile,
        locationBased: !!location,
        generalAdvice: !userProfile,
      },
      metadata: {
        requestId,
        responseTime: `${responseTime}ms`,
        service: 'GitHub Models AI',
        model: 'Llama-3.2-11B-Vision-Instruct',
        userType: 'anonymous',
        contextType: userProfile ? 'partial_profile' : 'general',
        timestamp: new Date().toISOString(),
        apiVersion: '1.0',
      },
      analytics: {
        questionLength: question.length,
        answerLength: answer.length,
        processingTime: responseTime,
        personalizationLevel: userProfile ? 'partial' : 'none',
        cached: false,
        confidenceScore: userProfile ? 0.75 : 0.65,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error in anonymous farming advice endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      metadata: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        service: 'GitHub Models AI',
        errorType: 'internal_server_error',
      },
    });
  }
});

export default router;
