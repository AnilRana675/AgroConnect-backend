import { Request, Response } from 'express';
import express from 'express';
import fetch from 'node-fetch';
import logger from '../utils/logger';

// API Response Interfaces
interface PlantIdSuggestion {
  plant_name: string;
  probability: number;
  plant_details?: {
    common_names: string[];
    url?: string;
  };
}

interface PlantIdResponse {
  suggestions: PlantIdSuggestion[];
  is_plant: boolean;
}

interface _PlantNetResult {
  species: {
    scientificNameWithoutAuthor: string;
    genus?: {
      scientificNameWithoutAuthor: string;
    };
    family?: {
      scientificNameWithoutAuthor: string;
    };
  };
  score: number;
}

interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiContentPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
}

interface PlantIdentificationResult {
  success: boolean;
  error?: string;
  data?: {
    scientificName?: string;
    commonNames?: string[];
    confidence?: number;
    isPlant?: boolean;
    agriGuide?: string;
  };
}

// Error handling type
interface APIError extends Error {
  response?: {
    status: number;
    statusText: string;
    data?: unknown;
  };
}

const router = express.Router();

// Helper: Convert base64 to Buffer (currently unused - for PlantNet when re-enabled)
function _base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

// POST /api/plant/identify
router.post('/identify', async (req: Request, res: Response) => {
  const { imageBase64 } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid imageBase64',
      code: 400,
    });
  }

  logger.info('Plant identification request received');

  // --- STEP 1: Gemini validation: check if image contains a valid plant ---
  let isPlant = false;
  let geminiCheckResult: PlantIdentificationResult | null = null;

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error('Missing GEMINI_API_KEY');

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const geminiCheckPrompt = `Analyze this image carefully. Does it contain a real, living plant (trees, flowers, leaves, stems, roots, etc.)?\n\nDo NOT identify as a plant:\n- Human faces or body parts\n- Animals or insects\n- Non-living objects (toys, decorations, artificial plants)\n- Food items (unless clearly showing the whole plant)\n- Buildings, vehicles, or other man-made objects\n\nAnswer ONLY 'yes' if you see actual living plant material (leaves, stems, flowers, bark, roots, etc.). Answer 'no' for everything else.`;

    const geminiCheckPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: geminiCheckPrompt },
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
          ],
        },
      ],
    };

    const geminiCheckRes = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiCheckPayload),
    });

    if (!geminiCheckRes.ok) {
      throw new Error(`Gemini API error: ${geminiCheckRes.status}`);
    }

    const response = (await geminiCheckRes.json()) as GeminiResponse;

    if (
      response.candidates &&
      response.candidates.length > 0 &&
      response.candidates[0].content &&
      response.candidates[0].content.parts &&
      response.candidates[0].content.parts.length > 0
    ) {
      const answer = response.candidates[0].content.parts[0].text.trim().toLowerCase();
      isPlant = answer.includes('yes');
      geminiCheckResult = {
        success: true,
        data: { isPlant },
      };
      logger.info(`Gemini plant validation: ${isPlant ? 'Plant detected' : 'Not a plant'}`);
    } else {
      geminiCheckResult = {
        success: false,
        error: 'No response from Gemini validation',
      };
      // Default to true to proceed with API calls if Gemini fails
      isPlant = true;
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const apiError = err as APIError;

    logger.error('Gemini Check API error:', {
      error: errorMessage,
      status: apiError.response?.status || 'No status',
      data: apiError.response?.data || 'No data',
    });

    geminiCheckResult = {
      success: false,
      error: `Gemini Check API error: ${errorMessage}`,
    };
    // Default to true to proceed with API calls if Gemini fails
    isPlant = true;
  }

  // --- STEP 2: Plant.id API (only if Gemini confirms it's a plant) ---
  let plantIdResult: PlantIdentificationResult | null = null;
  let plantIdScientific = '';
  let plantIdInfo = '';

  if (isPlant) {
    try {
      const plantIdApiKey = process.env.PLANT_ID_API_KEY;
      if (!plantIdApiKey) throw new Error('Missing PLANT_ID_API_KEY');

      const plantIdUrl = 'https://api.plant.id/v2/identify';
      const plantIdPayload = {
        images: [imageBase64],
        modifiers: ['crops_fast', 'similar_images'],
        plant_language: 'en',
        plant_details: ['common_names', 'url'],
      };

      const plantIdRes = await fetch(plantIdUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': plantIdApiKey,
        },
        body: JSON.stringify(plantIdPayload),
      });

      if (!plantIdRes.ok) {
        throw new Error(`Plant.id API error: ${plantIdRes.status}`);
      }

      const response = (await plantIdRes.json()) as PlantIdResponse;

      if (response && response.suggestions && response.suggestions.length > 0) {
        const bestSuggestion = response.suggestions[0];
        plantIdScientific = bestSuggestion.plant_name || '';
        const plantIdName = plantIdScientific || 'Unknown plant';
        plantIdInfo += `Plant.id Name: ${plantIdName}\n`;

        if (bestSuggestion.plant_details) {
          const details = bestSuggestion.plant_details;
          if (details.common_names && details.common_names.length > 0) {
            plantIdInfo += `Common Names: ${details.common_names.join(', ')}\n`;
          }
          if (details.url) {
            plantIdInfo += `More info: ${details.url}\n`;
          }
        }

        plantIdResult = {
          success: true,
          data: {
            scientificName: plantIdScientific,
            commonNames: bestSuggestion.plant_details?.common_names || [],
            confidence: Math.round(bestSuggestion.probability * 100),
          },
        };
        logger.info(`Plant.id identification successful: ${plantIdScientific}`);
      } else {
        plantIdResult = {
          success: false,
          error: 'No plant suggestions found from Plant.id',
        };
      }
    } catch (err: unknown) {
      plantIdResult = {
        success: false,
        error: 'Plant.id API error',
        data: {
          agriGuide: err instanceof Error ? err.message : 'Unknown error',
        },
      };
      logger.error('Plant.id API error:', err);
    }
  } else {
    plantIdResult = {
      success: false,
      error: 'Skipped Plant.id API call - Gemini determined this is not a plant',
    };
    logger.info('Skipping Plant.id API call - not identified as a plant by Gemini');
  }

  // --- STEP 3: PlantNet API (Temporarily Disabled) ---
  const _plantNetResult: PlantIdentificationResult | null = {
    success: false,
    error: 'PlantNet API temporarily disabled',
  };
  const _plantNetScientific = '';
  const _plantNetInfo = '';

  // --- STEP 4: Gemini agricultural guide (enhanced with Plant.id results) ---
  let agriGuide = '';
  let geminiGuideResult: PlantIdentificationResult | null = null;

  if (isPlant && plantIdResult?.success) {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('Missing GEMINI_API_KEY');

      const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      // Enhanced prompt that analyzes both the image and Plant.id results
      const geminiGuidePrompt = `You are an expert agricultural advisor. Analyze this plant image and the Plant.id identification results below to provide comprehensive agricultural guidance.

PLANT IDENTIFICATION RESULTS:
${plantIdInfo}

INSTRUCTIONS:
1. First, carefully examine the image to identify the plant's current growth stage, health condition, and visible characteristics
2. Use the Plant.id identification results as the scientific foundation for your advice
3. Provide practical, actionable agricultural guidance specific to this plant species
4. Consider both commercial farming and home gardening applications
5. IMPORTANT: Analyze the current condition of this specific plant in the image

Format your response using these EXACT section headers with markdown formatting:

## Cultivation
[Provide specific cultivation requirements including soil type, pH, climate conditions, planting methods, spacing, and timing]

## Care & Maintenance
[Include watering schedules, fertilization requirements, pruning techniques, pest management, and seasonal care practices]

## Harvesting
[Detail harvesting indicators, optimal timing, harvesting methods, post-harvest handling, and storage recommendations]

## Growth Info
[Describe growth patterns, maturity timeline, yield expectations, and environmental factors affecting growth]

## Common Issues
[List specific pests, diseases, nutrient deficiencies, and environmental problems common to this species, with prevention and treatment methods]

## Current Plant Condition & Diagnosis
[CRITICAL: Analyze this specific plant in the image. Describe what you observe about its current health, growth stage, any visible issues like diseases, pests, nutrient deficiencies, watering problems, or damage. Provide specific recommendations for immediate care based on what you see in THIS particular plant image. Include observations about leaf color, plant structure, soil condition if visible, any signs of stress, flowering/fruiting stage, and actionable next steps for this individual plant.]

Use bullet points under each section. Keep information practical and specific to the identified plant species. Always include all 6 sections even if some information is general.`;

      const geminiGuidePayload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: geminiGuidePrompt },
              { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            ],
          },
        ],
      };

      const geminiGuideRes = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiGuidePayload),
      });

      if (!geminiGuideRes.ok) {
        throw new Error(`Gemini Guide API error: ${geminiGuideRes.status}`);
      }

      const response = (await geminiGuideRes.json()) as GeminiResponse;

      if (
        response.candidates &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts.length > 0
      ) {
        agriGuide = response.candidates[0].content.parts[0].text;
        geminiGuideResult = {
          success: true,
          data: { agriGuide },
        };
        logger.info('Gemini agricultural guide generated successfully');
      } else {
        agriGuide = 'No agricultural details found.';
        geminiGuideResult = {
          success: false,
          error: 'No agricultural guide response from Gemini',
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const apiError = err as APIError;

      logger.error('Gemini Guide API error:', {
        error: errorMessage,
        status: apiError.response?.status || 'No status',
        data: apiError.response?.data || 'No data',
      });

      agriGuide = 'Agricultural guide temporarily unavailable due to API limitations.';
      geminiGuideResult = {
        success: false,
        error: `Gemini Guide API error: ${errorMessage}`,
        data: {
          agriGuide: errorMessage,
        },
      };
    }
  } else if (!isPlant) {
    // If not a plant, provide a message explaining why no agricultural guide is available
    agriGuide = `## Not a Plant
This image does not appear to contain a living plant that requires agricultural guidance.

## Identification Result
Our AI analysis determined that this image shows something other than a plant (such as a person, animal, object, or artificial item).

## Recommendation
Please upload a clear image of a living plant (showing leaves, stems, flowers, or other plant parts) for accurate plant identification and agricultural guidance.

## What We Look For
- Living plant material (leaves, stems, bark, roots)
- Flowers, fruits, or seeds on plants
- Trees, shrubs, herbs, or crops
- Garden plants or wild vegetation

## What We Don't Identify
- Human faces or body parts
- Animals or insects
- Artificial or toy plants
- Food items (unless showing the whole plant)
- Buildings, vehicles, or other objects

## Current Plant Condition & Diagnosis
No plant detected in the image for condition analysis.`;
    geminiGuideResult = {
      success: false,
      error: 'No agricultural guide generated - not identified as a plant',
    };
  } else {
    // If Plant.id failed but Gemini thinks it's a plant, provide generic guidance
    agriGuide = `## Plant Identification
A plant was detected in the image, but specific species identification was not successful.

## General Plant Care
- Observe the plant's natural habitat and growing conditions
- Provide appropriate sunlight based on leaf characteristics
- Water when soil feels dry, but avoid overwatering
- Use well-draining soil with organic matter
- Monitor for signs of pests or diseases

## Cultivation
- Research similar-looking plants in your region
- Consult local gardening experts or extension services
- Consider the plant's apparent size and growth pattern
- Choose appropriate location based on visible characteristics

## Care & Maintenance
- Regular watering based on soil moisture
- Apply balanced fertilizer during growing season
- Prune dead or damaged parts as needed
- Provide support if plant appears to need it

## Harvesting
- Monitor for signs of maturity if this is a food plant
- Harvest at appropriate times based on plant type
- Handle harvested parts carefully to maintain quality

## Growth Info
- Growth patterns vary significantly between species
- Environmental factors greatly influence development
- Seasonal changes affect most plant growth cycles

## Common Issues
- Overwatering or underwatering
- Inadequate light conditions
- Nutrient deficiencies
- Pest infestations
- Disease problems

## Current Plant Condition & Diagnosis
Without specific species identification, detailed condition analysis is limited. However, examine the plant for:
- Leaf color and texture (yellowing, browning, wilting may indicate problems)
- Overall plant structure and growth pattern
- Signs of pests or diseases
- Soil moisture and drainage conditions
- General health and vigor of the plant

**Recommendation:** For specific care instructions and detailed plant condition analysis, please consult local agricultural extension services or gardening experts with a clear image of the plant.`;
    geminiGuideResult = {
      success: false,
      error: 'Generic agricultural guide provided - Plant.id identification failed',
    };
  }

  // Compose response
  // Success if we have a plant detection (even if Plant.id fails, Gemini can still provide guidance)
  const hasAnySuccess = isPlant && (plantIdResult?.success || geminiGuideResult?.success);

  // Critical error only if Gemini validation fails completely and we can't determine if it's a plant
  const hasCriticalError = !!(geminiCheckResult?.error && !isPlant && !plantIdResult?.success);

  logger.info('Plant identification completed', {
    hasAnySuccess,
    hasCriticalError,
    plantFound: isPlant,
    plantIdSuccess: plantIdResult?.success,
    geminiCheckSuccess: geminiCheckResult?.success,
    geminiGuideSuccess: geminiGuideResult?.success,
  });

  // Return appropriate response based on the new workflow
  if (!isPlant) {
    // Not a plant - return success=false but with explanation
    res.status(200).json({
      success: false,
      data: {
        isPlant: false,
        scientificName: 'Not a plant',
        commonNames: [],
        confidence: 0,
        agriGuide,
      },
      error: 'Image does not contain a plant',
    });
  } else if (hasAnySuccess) {
    // Plant detected and we have some identification or guide
    res.status(200).json({
      success: true,
      data: {
        isPlant: true,
        scientificName: plantIdScientific || 'Unknown plant species',
        commonNames: plantIdResult?.data?.commonNames || [],
        confidence: plantIdResult?.data?.confidence || 0,
        agriGuide,
      },
    });
  } else {
    // Plant detected but all identification methods failed
    res.status(500).json({
      success: false,
      data: {
        isPlant: true,
        scientificName: 'Unknown',
        commonNames: [],
        confidence: 0,
        agriGuide,
      },
      error: {
        plantId: plantIdResult?.error ? plantIdResult : undefined,
        geminiCheck: geminiCheckResult?.error ? geminiCheckResult : undefined,
        geminiGuide: geminiGuideResult?.error ? geminiGuideResult : undefined,
      },
    });
  }
});

export default router;
