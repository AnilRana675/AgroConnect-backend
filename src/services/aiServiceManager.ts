import logger from '../utils/logger';
import githubModelsAI from './githubModelsAI';
import deepSeekAI from './deepSeekAI';

interface UserProfile {
  farmerType: string;
  location: string;
  economicScale: string;
  onboardingStatus?: string;
}

class AIServiceManager {
  /**
   * Get farming advice in the user's preferred language
   */
  async getFarmingAdvice(
    question: string,
    userProfile?: UserProfile,
    language: 'en' | 'ne' = 'en',
  ): Promise<string> {
    try {
      if (language === 'ne') {
        // Use DeepSeek for Nepali advice
        if (!deepSeekAI.isConfigured()) {
          logger.warn('DeepSeek not configured, falling back to GitHub Models');
          return await githubModelsAI.getFarmingAdvice({ question, userProfile });
        }
        return await deepSeekAI.getFarmingAdviceInNepali(question, userProfile);
      } else {
        // Use GPT-4.1 via GitHub Models for English advice
        if (!githubModelsAI.isConfigured()) {
          logger.warn('GitHub Models not configured, cannot provide English advice');
          return 'AI service is not configured. Please check your configuration.';
        }
        return await githubModelsAI.getFarmingAdvice({ question, userProfile });
      }
    } catch (error) {
      logger.error(`Error getting farming advice in ${language}:`, error);

      // Fallback to the other service if available
      try {
        if (language === 'ne' && githubModelsAI.isConfigured()) {
          logger.info('Falling back to GitHub Models for Nepali advice');
          return await githubModelsAI.getFarmingAdvice({ question, userProfile });
        } else if (language === 'en' && deepSeekAI.isConfigured()) {
          logger.info('Falling back to DeepSeek for English advice');
          return await deepSeekAI.getFarmingAdviceInNepali(question, userProfile);
        }
      } catch (fallbackError) {
        logger.error('Fallback service also failed:', fallbackError);
      }

      const errorMessage =
        language === 'ne'
          ? 'कृषि सल्लाह प्राप्त गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।'
          : 'Failed to get farming advice. Please try again.';

      return errorMessage;
    }
  }

  /**
   * Get weekly farming tips in both languages
   */
  async getWeeklyTips(userProfile: UserProfile): Promise<{ en: string; ne: string }> {
    const results = { en: '', ne: '' };

    try {
      // Get English tips from GPT-4.1
      if (githubModelsAI.isConfigured()) {
        try {
          results.en = await githubModelsAI.getWeeklyTipsInEnglish(userProfile);
          logger.info('English weekly tips generated successfully with GPT-4.1');
        } catch (error) {
          logger.error('Error generating English tips with GPT-4.1:', error);
          results.en = 'Failed to generate English tips. Please try again.';
        }
      } else {
        results.en = 'English AI service is not configured.';
      }

      // Get Nepali tips from DeepSeek
      if (deepSeekAI.isConfigured()) {
        try {
          results.ne = await deepSeekAI.getWeeklyTipsInNepali(userProfile);
          logger.info('Nepali weekly tips generated successfully with DeepSeek');
        } catch (error) {
          logger.error('Error generating Nepali tips with DeepSeek:', error);
          results.ne = 'नेपाली सुझावहरू उत्पन्न गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।';
        }
      } else {
        results.ne = 'नेपाली AI सेवा कन्फिगर गरिएको छैन।';
      }
    } catch (error) {
      logger.error('Error in getWeeklyTips:', error);
      results.en = 'Failed to generate weekly tips. Please try again.';
      results.ne = 'साप्ताहिक सुझावहरू उत्पन्न गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।';
    }

    return results;
  }

  /**
   * Get weekly tips formatted for backward compatibility
   */
  async getWeeklyTipsLegacy(
    userProfile: UserProfile,
    preferredLanguage: string = 'en',
  ): Promise<{ en: string; ne: string; displayLanguage: string }> {
    const tips = await this.getWeeklyTips(userProfile);

    return {
      en: tips.en,
      ne: tips.ne,
      displayLanguage: preferredLanguage,
    };
  }

  /**
   * Identify crop diseases in the user's preferred language
   */
  async identifyCropDisease(
    description: string,
    cropType?: string,
    language: 'en' | 'ne' = 'en',
  ): Promise<string> {
    try {
      if (language === 'ne') {
        // Use DeepSeek for Nepali disease identification
        if (!deepSeekAI.isConfigured()) {
          logger.warn('DeepSeek not configured, falling back to GitHub Models');
          return await githubModelsAI.identifyCropDisease(description, cropType);
        }
        return await deepSeekAI.identifyCropDiseaseInNepali(description, cropType);
      } else {
        // Use GPT-4.1 via GitHub Models for English disease identification
        if (!githubModelsAI.isConfigured()) {
          logger.warn('GitHub Models not configured, cannot provide English diagnosis');
          return 'AI service is not configured. Please check your configuration.';
        }
        return await githubModelsAI.identifyCropDisease(description, cropType);
      }
    } catch (error) {
      logger.error(`Error identifying crop disease in ${language}:`, error);

      const errorMessage =
        language === 'ne'
          ? 'बालीको रोग पहिचान गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।'
          : 'Failed to identify crop disease. Please try again.';

      return errorMessage;
    }
  }

  /**
   * Check service availability
   */
  getServiceStatus(): {
    githubModels: { configured: boolean; capabilities: string[] };
    deepSeek: { configured: boolean; capabilities: string[] };
    overall: { status: 'fully_available' | 'partially_available' | 'unavailable' };
  } {
    const githubModelsConfigured = githubModelsAI.isConfigured();
    const deepSeekConfigured = deepSeekAI.isConfigured();

    let overallStatus: 'fully_available' | 'partially_available' | 'unavailable';

    if (githubModelsConfigured && deepSeekConfigured) {
      overallStatus = 'fully_available';
    } else if (githubModelsConfigured || deepSeekConfigured) {
      overallStatus = 'partially_available';
    } else {
      overallStatus = 'unavailable';
    }

    return {
      githubModels: {
        configured: githubModelsConfigured,
        capabilities: githubModelsConfigured
          ? [
              'English farming advice',
              'English weekly tips',
              'English disease diagnosis',
              'GPT-4.1 model',
            ]
          : [],
      },
      deepSeek: {
        configured: deepSeekConfigured,
        capabilities: deepSeekConfigured
          ? [
              'Nepali farming advice',
              'Nepali weekly tips',
              'Nepali disease diagnosis',
              'DeepSeek model',
            ]
          : [],
      },
      overall: {
        status: overallStatus,
      },
    };
  }

  /**
   * Get the appropriate AI service for a given language
   */
  getServiceForLanguage(language: 'en' | 'ne'): 'github' | 'deepseek' | null {
    if (language === 'en' && githubModelsAI.isConfigured()) {
      return 'github';
    } else if (language === 'ne' && deepSeekAI.isConfigured()) {
      return 'deepseek';
    }
    return null;
  }
}

export default new AIServiceManager();
