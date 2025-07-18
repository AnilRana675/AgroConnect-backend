import logger from '../utils/logger';
import fetch from 'node-fetch';

interface FarmingAdviceRequest {
  question: string;
  userProfile?: {
    farmerType: string;
    location: string;
    economicScale: string;
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

  constructor() {
    this.apiKey = process.env.GITHUB_TOKEN || null;
    this.baseURL = 'https://models.inference.ai.azure.com';

    if (!this.apiKey) {
      logger.warn('GitHub token not found. AI features will be disabled.');
    }
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

      const response = await fetch(`${this.baseURL}/chat/completions`, {
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
          max_tokens: 300,
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
      const prompt = `Generate weekly farming tips for a ${userProfile.farmerType} farmer 
                     in ${userProfile.location}, Nepal with ${userProfile.economicScale} operations. 
                     Focus on current season activities, pest management, and crop care.`;

      const response = await fetch(`${this.baseURL}/chat/completions`, {
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
                       that are practical, season-appropriate, and suitable for local conditions.`,
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

      const response = await fetch(`${this.baseURL}/chat/completions`, {
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
    },
  ): string {
    if (!userProfile) {
      return `${question} (Context: Nepal farming)`;
    }

    return `${question} 
           Context: I am a ${userProfile.farmerType} farmer in ${userProfile.location}, Nepal 
           with ${userProfile.economicScale} farming operations.`;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default new GitHubModelsAIService();
