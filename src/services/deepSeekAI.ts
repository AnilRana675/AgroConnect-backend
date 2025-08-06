import logger from '../utils/logger';
import fetch, { Response, RequestInit } from 'node-fetch';

interface DeepSeekChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class DeepSeekAIService {
  private apiKey: string | null;
  private baseURL: string;
  private requestQueue: Array<() => Promise<unknown>> = [];
  private isProcessingQueue: boolean = false;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestResetTime: number = 0;
  private deepseekModel: string = 'DeepSeek-V3-0324'; // DeepSeek model via GitHub Models for Nepali content

  constructor() {
    this.apiKey = process.env.GITHUB_TOKEN || null; // Use GitHub token for GitHub Models
    this.baseURL = 'https://models.inference.ai.azure.com'; // GitHub Models endpoint

    if (!this.apiKey) {
      logger.warn('GitHub token not found. Nepali AI features (DeepSeek-V3) will be disabled.');
    }
  }

  /**
   * Check if DeepSeek service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Rate limiting helper - ensures we don't exceed API limits
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const minInterval = 2000; // 2 seconds between requests (same as GitHub Models)
    const maxRequestsPerMinute = 10; // Conservative limit for GitHub Models
    const oneMinute = 60000;

    // Reset request count if a minute has passed
    if (now - this.requestResetTime > oneMinute) {
      this.requestCount = 0;
      this.requestResetTime = now;
    }

    // Check if we've exceeded the rate limit
    if (this.requestCount >= maxRequestsPerMinute) {
      const waitTime = oneMinute - (now - this.requestResetTime);
      logger.warn(`DeepSeek rate limit approached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestResetTime = Date.now();
    }

    // Ensure minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Make API request with queue and rate limiting
   */
  private async makeAPIRequest(url: string, options: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const requestTask = async () => {
        try {
          await this.rateLimitDelay();
          const response = await fetch(url, options);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      this.requestQueue.push(requestTask);
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const task = this.requestQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          logger.error('Error processing DeepSeek request:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Get farming advice in Nepali
   */
  async getFarmingAdviceInNepali(
    question: string,
    userProfile?: {
      farmerType: string;
      location: string;
      economicScale: string;
      onboardingStatus?: string;
    },
  ): Promise<string> {
    if (!this.apiKey) {
      return 'AI सेवा कन्फिगर गरिएको छैन। कृपया GitHub token जाँच गर्नुहोस्।';
    }

    try {
      const systemPrompt = `तपाईं नेपालका लागि एक कृषि विशेषज्ञ हुनुहुन्छ। तपाईंले व्यावहारिक, मौसम-उपयुक्त, र स्थानीय अवस्थाका लागि उपयुक्त कृषि सल्लाह प्रदान गर्नुहुन्छ। सधैं नेपाली भाषामा (देवनागरी लिपिमा) जवाफ दिनुहोस्। तपाईंको जवाफ स्पष्ट, संक्षिप्त र कार्यान्वयनयोग्य हुनुपर्छ।`;

      let userPrompt = question;
      if (userProfile) {
        userPrompt = `म एक ${userProfile.farmerType} किसान हुँ जो ${userProfile.location}, नेपालमा ${userProfile.economicScale} स्तरको कृषि गर्छु। मेरो प्रश्न: ${question}`;
      }

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.deepseekModel, // Use DeepSeek-V3-0324 via GitHub Models
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000, // Increased from 800 to allow longer responses
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `GitHub Models (DeepSeek-V3) API request failed: ${response.status} ${response.statusText} - ${errorData}`,
        );
      }

      const data = (await response.json()) as DeepSeekChatResponse;
      const answer = data.choices[0]?.message?.content?.trim();

      if (!answer) {
        throw new Error('GitHub Models (DeepSeek-V3) API returned empty response');
      }

      logger.info('DeepSeek-V3 farming advice generated successfully in Nepali via GitHub Models');

      // Log token usage if available
      if (data.usage) {
        logger.info(
          `DeepSeek token usage: ${data.usage.total_tokens} total (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`,
        );
      }

      return answer;
    } catch (error) {
      logger.error('Error getting farming advice from DeepSeek:', error);
      throw new Error('नेपाली कृषि सल्लाह प्राप्त गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।');
    }
  }

  /**
   * Generate weekly farming tips in Nepali
   */
  async getWeeklyTipsInNepali(userProfile: {
    farmerType: string;
    location: string;
    economicScale: string;
  }): Promise<string> {
    if (!this.apiKey) {
      return 'AI सेवा कन्फिगर गरिएको छैन। कृपया GitHub token जाँच गर्नुहोस्।';
    }

    try {
      const prompt = `${userProfile.location}, नेपालमा ${userProfile.economicScale} स्तरको कृषि गर्ने ${userProfile.farmerType} किसानका लागि यस हप्ताका छोटो र व्यावहारिक कृषि सुझावहरू (अधिकतम ३-४ बुलेट पोइन्ट) प्रदान गर्नुहोस्। मौसम-उपयुक्त र स्थानीय अवस्थाका लागि उपयुक्त सुझावहरू दिनुहोस्। लामो व्याख्याबाट बच्नुहोस्।`;

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.deepseekModel, // Use DeepSeek-V3-0324 via GitHub Models
          messages: [
            {
              role: 'system',
              content: `तपाईं नेपालका लागि एक कृषि विशेषज्ञ हुनुहुन्छ। साप्ताहिक कृषि सुझावहरू प्रदान गर्नुहोस् जुन व्यावहारिक, मौसम-उपयुक्त, र स्थानीय अवस्थाका लागि उपयुक्त छन्। तपाईंको जवाफ धेरै छोटो र संक्षिप्त हुनुपर्छ, केवल २-४ बुलेट पोइन्ट मात्र प्रयोग गर्नुहोस्। नेपाली भाषामा (देवनागरी लिपिमा) जवाफ दिनुहोस्।`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.6,
          max_tokens: 3000,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `GitHub Models (DeepSeek-V3) API request failed: ${response.status} ${response.statusText} - ${errorData}`,
        );
      }

      const data = (await response.json()) as DeepSeekChatResponse;
      const tips = data.choices[0]?.message?.content?.trim();

      if (!tips) {
        throw new Error('GitHub Models (DeepSeek-V3) API returned empty response');
      }

      logger.info(
        `DeepSeek weekly farming tips generated for ${userProfile.farmerType} in ${userProfile.location}`,
      );

      // Log token usage if available
      if (data.usage) {
        logger.info(
          `DeepSeek token usage: ${data.usage.total_tokens} total (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`,
        );
      }

      return tips;
    } catch (error) {
      logger.error('Error generating weekly tips from DeepSeek:', error);
      throw new Error('साप्ताहिक सुझावहरू उत्पन्न गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।');
    }
  }

  /**
   * Identify crop diseases in Nepali
   */
  async identifyCropDiseaseInNepali(description: string, cropType?: string): Promise<string> {
    if (!this.apiKey) {
      return 'AI सेवा कन्फिगर गरिएको छैन। कृपया GitHub token जाँच गर्नुहोस्।';
    }

    try {
      const prompt = `नेपालमा एक किसानले आफ्नो ${cropType || 'बाली'}मा यी लक्षणहरू वर्णन गरेको छ: "${description}"। यो कस्तो रोग वा कीराको समस्या हुन सक्छ? नेपाली कृषि अवस्थाका लागि उपयुक्त पहिचान र उपचारका सुझावहरू प्रदान गर्नुहोस्।`;

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.deepseekModel, // Use DeepSeek-V3-0324 via GitHub Models
          messages: [
            {
              role: 'system',
              content: `तपाईं नेपालमा सामान्य बालीका रोगहरूमा विशेषज्ञता राख्ने एक बिरुवा रोग विशेषज्ञ हुनुहुन्छ। स्थानीय रूपमा उपलब्ध स्रोतहरू प्रयोग गरेर रोग पहिचान र व्यावहारिक उपचार विकल्पहरू प्रदान गर्नुहोस्। नेपाली भाषामा (देवनागरी लिपिमा) जवाफ दिनुहोस्।`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 3000, // Increased from 600 for detailed disease diagnosis
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `GitHub Models (DeepSeek-V3) API request failed: ${response.status} ${response.statusText} - ${errorData}`,
        );
      }

      const data = (await response.json()) as DeepSeekChatResponse;
      const diagnosis = data.choices[0]?.message?.content?.trim();

      if (!diagnosis) {
        throw new Error('GitHub Models (DeepSeek-V3) API returned empty response');
      }

      logger.info(
        'DeepSeek-V3 crop disease diagnosis generated successfully in Nepali via GitHub Models',
      );

      // Log token usage if available
      if (data.usage) {
        logger.info(
          `DeepSeek token usage: ${data.usage.total_tokens} total (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`,
        );
      }

      return diagnosis;
    } catch (error) {
      logger.error('Error identifying crop disease with DeepSeek:', error);
      throw new Error('बालीको रोग पहिचान गर्न असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।');
    }
  }
}

export default new DeepSeekAIService();
