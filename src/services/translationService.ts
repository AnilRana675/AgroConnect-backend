import githubModelsAI from './githubModelsAI';
import logger from '../utils/logger';

export interface TranslationRequest {
  text: string;
  fromLanguage: 'en' | 'ne';
  toLanguage: 'en' | 'ne';
}

export interface TranslationResponse {
  success: boolean;
  originalText: string;
  translatedText: string;
  fromLanguage: string;
  toLanguage: string;
  confidence: number;
  model: string;
  timestamp: string;
}

class TranslationService {
  /**
   * Translate text between English and Nepali
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const { text, fromLanguage, toLanguage } = request;

      // If same language, return original text
      if (fromLanguage === toLanguage) {
        return {
          success: true,
          originalText: text,
          translatedText: text,
          fromLanguage,
          toLanguage,
          confidence: 1.0,
          model: 'passthrough',
          timestamp: new Date().toISOString(),
        };
      }

      // Create translation prompt based on direction
      let prompt = '';
      if (fromLanguage === 'en' && toLanguage === 'ne') {
        prompt = `Translate the following English text to Nepali. Provide only the translated text without any explanations or additional content:

English: "${text}"

Nepali:`;
      } else if (fromLanguage === 'ne' && toLanguage === 'en') {
        prompt = `Translate the following Nepali text to English. Provide only the translated text without any explanations or additional content:

Nepali: "${text}"

English:`;
      } else {
        throw new Error(`Unsupported translation direction: ${fromLanguage} to ${toLanguage}`);
      }

      // Get translation from AI service
      const aiResponse = await githubModelsAI.generateResponse(prompt);

      // Clean up the response (remove quotes, extra whitespace)
      const translatedText = aiResponse.trim().replace(/^["']|["']$/g, '');

      // Calculate confidence based on response quality
      const confidence = this.calculateTranslationConfidence(
        text,
        translatedText,
        fromLanguage,
        toLanguage,
      );

      return {
        success: true,
        originalText: text,
        translatedText,
        fromLanguage,
        toLanguage,
        confidence,
        model: 'Llama-3.2-11B-Vision-Instruct',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Translation service error:', error);
      throw new Error(
        `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Detect language of input text (basic detection)
   */
  async detectLanguage(text: string): Promise<'en' | 'ne' | 'unknown'> {
    try {
      // Simple heuristic detection
      const nepaliPattern = /[\u0900-\u097F]/; // Devanagari Unicode range
      const englishPattern = /[A-Za-z]/;

      const hasNepali = nepaliPattern.test(text);
      const hasEnglish = englishPattern.test(text);

      if (hasNepali && !hasEnglish) {
        return 'ne';
      } else if (hasEnglish && !hasNepali) {
        return 'en';
      } else if (hasNepali && hasEnglish) {
        // Mixed text - use AI to detect primary language
        const prompt = `Identify the primary language of this text. Respond with only "English" or "Nepali":

Text: "${text}"

Primary language:`;

        const aiResponse = await githubModelsAI.generateResponse(prompt);
        const detectedLang = aiResponse.trim().toLowerCase();

        if (detectedLang.includes('nepali')) {
          return 'ne';
        } else if (detectedLang.includes('english')) {
          return 'en';
        }
      }

      return 'unknown';
    } catch (error) {
      logger.error('Language detection error:', error);
      return 'unknown';
    }
  }

  /**
   * Calculate translation confidence score
   */
  private calculateTranslationConfidence(
    originalText: string,
    translatedText: string,
    fromLang: string,
    toLang: string,
  ): number {
    // Basic confidence calculation
    let confidence = 0.8; // Base confidence

    // Check if translation is reasonable length
    const lengthRatio = translatedText.length / originalText.length;
    if (lengthRatio > 0.3 && lengthRatio < 3.0) {
      confidence += 0.1;
    }

    // Check if translation is not just the original text
    if (translatedText.toLowerCase() !== originalText.toLowerCase()) {
      confidence += 0.1;
    }

    // Check for proper language characters
    if (toLang === 'ne') {
      const nepaliPattern = /[\u0900-\u097F]/;
      if (nepaliPattern.test(translatedText)) {
        confidence += 0.1;
      }
    } else if (toLang === 'en') {
      const englishPattern = /[A-Za-z]/;
      if (englishPattern.test(translatedText)) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Translate AI response to user's preferred language
   */
  async translateAIResponse(
    aiResponse: string,
    userLanguage: 'en' | 'ne' = 'en',
  ): Promise<{ original: string; translated: string; language: string }> {
    try {
      // AI responses are typically in English, translate to Nepali if needed
      if (userLanguage === 'ne') {
        const translationResult = await this.translateText({
          text: aiResponse,
          fromLanguage: 'en',
          toLanguage: 'ne',
        });

        return {
          original: aiResponse,
          translated: translationResult.translatedText,
          language: 'ne',
        };
      }

      return {
        original: aiResponse,
        translated: aiResponse,
        language: 'en',
      };
    } catch (error) {
      logger.error('AI response translation error:', error);
      // Return original response if translation fails
      return {
        original: aiResponse,
        translated: aiResponse,
        language: 'en',
      };
    }
  }

  /**
   * Check if translation service is available
   */
  isAvailable(): boolean {
    return githubModelsAI.isConfigured();
  }
}

export default new TranslationService();
