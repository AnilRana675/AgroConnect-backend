import express from 'express';
import translationService, { TranslationRequest } from '../services/translationService';
import logger from '../utils/logger';
import { optionalAuth } from '../middleware/auth';

const router = express.Router();

// Check translation service status
router.get('/status', (req, res) => {
  const isAvailable = translationService.isAvailable();
  res.json({
    success: true,
    available: isAvailable,
    message: isAvailable
      ? 'Translation service is ready'
      : 'Translation service not available - AI service not configured',
    supportedLanguages: ['en', 'ne'],
    features: [
      'English to Nepali translation',
      'Nepali to English translation',
      'Language detection',
      'AI response translation',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Translate text
router.post('/translate', optionalAuth, async (req, res) => {
  try {
    const { text, fromLanguage, toLanguage } = req.body as TranslationRequest;

    // Validate input
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for translation',
        timestamp: new Date().toISOString(),
      });
    }

    if (!fromLanguage || !toLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Source and target languages are required',
        timestamp: new Date().toISOString(),
      });
    }

    if (!['en', 'ne'].includes(fromLanguage) || !['en', 'ne'].includes(toLanguage)) {
      return res.status(400).json({
        success: false,
        error: 'Only English (en) and Nepali (ne) languages are supported',
        timestamp: new Date().toISOString(),
      });
    }

    // Perform translation
    const translationResult = await translationService.translateText({
      text,
      fromLanguage: fromLanguage as 'en' | 'ne',
      toLanguage: toLanguage as 'en' | 'ne',
    });

    logger.info(
      `Translation completed: ${fromLanguage} -> ${toLanguage}, confidence: ${translationResult.confidence}`,
    );

    res.json({
      success: true,
      data: translationResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Translation route error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Detect language
router.post('/detect-language', optionalAuth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for language detection',
        timestamp: new Date().toISOString(),
      });
    }

    const detectedLanguage = await translationService.detectLanguage(text);

    res.json({
      success: true,
      data: {
        text,
        detectedLanguage,
        confidence: detectedLanguage !== 'unknown' ? 0.8 : 0.1,
        supportedLanguages: ['en', 'ne'],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Language detection route error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Language detection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Translate AI response (for chat interface)
router.post('/translate-ai-response', optionalAuth, async (req, res) => {
  try {
    const { aiResponse, userLanguage = 'en' } = req.body;

    if (!aiResponse) {
      return res.status(400).json({
        success: false,
        error: 'AI response text is required',
        timestamp: new Date().toISOString(),
      });
    }

    if (!['en', 'ne'].includes(userLanguage)) {
      return res.status(400).json({
        success: false,
        error: 'User language must be either "en" or "ne"',
        timestamp: new Date().toISOString(),
      });
    }

    const translationResult = await translationService.translateAIResponse(
      aiResponse,
      userLanguage as 'en' | 'ne',
    );

    res.json({
      success: true,
      data: translationResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI response translation route error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI response translation failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
