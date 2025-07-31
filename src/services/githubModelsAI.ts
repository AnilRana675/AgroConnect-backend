import logger from '../utils/logger';
import fetch, { Response } from 'node-fetch';

interface FarmingAdviceRequest {
  question: string;
  userProfile?: {
    farmerType: string;
    location: string;
    economicScale: string;
    onboardingStatus?: string;
  };
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class GitHubModelsAIService {
  private apiKey: string | null;
  private baseURL: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestResetTime: number = 0;

  constructor() {
    this.apiKey = process.env.GITHUB_TOKEN || null;
    this.baseURL = 'https://models.inference.ai.azure.com';

    if (!this.apiKey) {
      logger.warn('GitHub token not found. AI features will be disabled.');
    }
  }

  /**
   * Rate limiting helper - ensures we don't exceed API limits
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const minInterval = 2000; // 2 seconds between requests
    const maxRequestsPerMinute = 10; // Conservative limit
    const oneMinute = 60000;

    // Reset request count if a minute has passed
    if (now - this.requestResetTime > oneMinute) {
      this.requestCount = 0;
      this.requestResetTime = now;
    }

    // If we've hit the request limit, wait until the minute resets
    if (this.requestCount >= maxRequestsPerMinute) {
      const waitTime = oneMinute - (now - this.requestResetTime) + 1000; // Add 1 second buffer
      logger.warn(`Rate limit reached, waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestResetTime = Date.now();
    }

    // Ensure minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Make API request with retry logic and exponential backoff
   */
  private async makeAPIRequest(url: string, options: any, maxRetries: number = 3): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.rateLimitDelay();
        
        const response = await fetch(url, options);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          
          logger.warn(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
          
          if (attempt === maxRetries) {
            throw new Error(`Rate limit exceeded after ${maxRetries} attempts`);
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Handle server errors with exponential backoff
        if (response.status >= 500 && response.status < 600) {
          if (attempt === maxRetries) {
            throw new Error(`Server error ${response.status} after ${maxRetries} attempts`);
          }
          
          const waitTime = Math.pow(2, attempt) * 1000;
          logger.warn(`Server error ${response.status}, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const waitTime = Math.pow(2, attempt) * 1000;
        logger.warn(`Request failed, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  /**
   * Get personalized farming advice based on user profile
   */
  async getFarmingAdvice(request: FarmingAdviceRequest): Promise<string> {
    if (!this.apiKey) {
      return 'AI service is not configured. Please check your GitHub token.';
    }

    try {
      const { question, userProfile } = request;

      // Create context-aware prompt for Nepali farming
      const contextPrompt = this.createContextualPrompt(question, userProfile);

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an expert agricultural advisor specializing in Nepali farming practices. 
                       Provide practical, actionable advice suitable for farmers in Nepal. 
                       Consider local climate, soil conditions, and traditional farming methods. 
                       Keep responses concise but informative.`,
            },
            {
              role: 'user',
              content: contextPrompt,
            },
          ],
          model: 'Llama-3.2-11B-Vision-Instruct',
          temperature: 0.7,
          max_tokens: 600,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ChatResponse;
      const answer = data.choices[0]?.message?.content?.trim() || 'No answer available.';

      logger.info(`AI farming advice provided for question: ${question.substring(0, 50)}...`);
      return answer;
    } catch (error) {
      logger.error('Error getting farming advice:', error);
      throw new Error('Failed to get farming advice. Please try again.');
    }
  }

  /**
   * Get weekly farming tips based on user profile
   */
  async getWeeklyTips(userProfile: {
    farmerType: string;
    location: string;
    economicScale: string;
  }): Promise<string> {
    if (!this.apiKey) {
      return 'AI service is not configured. Please check your GitHub token.';
    }

    try {
      const prompt = `Generate a SHORT summary of weekly farming tips (max 3-4 bullet points) for a ${userProfile.farmerType} farmer in ${userProfile.location}, Nepal with ${userProfile.economicScale} operations. Be concise and practical. Focus on the most important, actionable tips for this week. Avoid long explanations.`;

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an agricultural expert for Nepal. Provide weekly farming tips 
                       that are practical, season-appropriate, and suitable for local conditions. Keep your answer very short and concise, using only 2-4 bullet points.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: 'Llama-3.2-11B-Vision-Instruct',
          temperature: 0.6,
          max_tokens: 400,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ChatResponse;
      const tips = data.choices[0]?.message?.content?.trim() || 'No tips available.';

      logger.info(
        `Weekly farming tips generated for ${userProfile.farmerType} in ${userProfile.location}`,
      );
      return tips;
    } catch (error) {
      logger.error('Error generating weekly tips:', error);
      throw new Error('Failed to generate weekly tips. Please try again.');
    }
  }

  /**
   * Identify crop diseases from description
   */
  async identifyCropDisease(description: string, cropType?: string): Promise<string> {
    if (!this.apiKey) {
      return 'AI service is not configured. Please check your GitHub token.';
    }

    try {
      const prompt = `A farmer in Nepal describes these symptoms on their ${cropType || 'crop'}: "${description}". 
                     What disease or pest problem might this be? Provide identification and treatment recommendations 
                     suitable for Nepali farming conditions.`;

      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a plant pathologist specializing in crop diseases common in Nepal. 
                       Provide disease identification and practical treatment options using locally available resources.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: 'Llama-3.2-11B-Vision-Instruct',
          temperature: 0.5,
          max_tokens: 350,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ChatResponse;
      const diagnosis =
        data.choices[0]?.message?.content?.trim() || 'Unable to identify the problem.';

      logger.info(
        `Crop disease diagnosis provided for symptoms: ${description.substring(0, 50)}...`,
      );
      return diagnosis;
    } catch (error) {
      logger.error('Error identifying crop disease:', error);
      throw new Error('Failed to identify crop disease. Please try again.');
    }
  }

  /**
   * Create contextual prompt based on user profile
   */
  private createContextualPrompt(
    question: string,
    userProfile?: {
      farmerType: string;
      location: string;
      economicScale: string;
      onboardingStatus?: string;
    },
  ): string {
    if (!userProfile) {
      return `${question} (Context: Nepal farming)`;
    }

    return `${question} 
           Context: I am a ${userProfile.farmerType} farmer in ${userProfile.location}, Nepal 
           with ${userProfile.economicScale} farming operations.${userProfile.onboardingStatus ? ` Onboarding status: ${userProfile.onboardingStatus}.` : ''}`;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generic AI response method for translation and other tasks
   */
  async generateResponse(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AI service is not configured. Please check your GitHub token.');
    }

    try {
      const response = await this.makeAPIRequest(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: 'Llama-3.2-11B-Vision-Instruct',
          temperature: 0.3,
          max_tokens: 500,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ChatResponse;
      const content = data.choices[0]?.message?.content?.trim() || '';

      if (!content) {
        throw new Error('Empty response from AI service');
      }

      return content;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  }
}

export default new GitHubModelsAIService();
