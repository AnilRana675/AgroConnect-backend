import { Request, Response } from 'express';
import express from 'express';
import FormData from 'form-data';
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

interface PlantNetResult {
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

interface PlantNetResponse {
  results: PlantNetResult[];
  remainingIdentificationRequests: number;
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

const router = express.Router();

// Helper: Convert base64 to Buffer
function base64ToBuffer(base64: string): Buffer {
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

  // --- 1. Plant.id API ---
  let plantIdResult: PlantIdentificationResult | null = null;
  let plantIdScientific = '';
  let plantIdInfo = '';

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
  }

  // --- 2. Pl@ntNet API ---
  let plantNetResult: PlantIdentificationResult | null = null;
  let plantNetScientific = '';
  let plantNetInfo = '';

  try {
    const plantNetApiKey = process.env.PLANTNET_API_KEY;
    if (!plantNetApiKey) throw new Error('Missing PLANTNET_API_KEY');

    const plantNetUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${plantNetApiKey}`;
    const imageBuffer = base64ToBuffer(imageBase64);
    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'photo.png',
      contentType: 'image/png',
    });

    const plantNetRes = await fetch(plantNetUrl, {
      method: 'POST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: formData as any,
      headers: formData.getHeaders(),
    });

    if (!plantNetRes.ok) {
      throw new Error(`Pl@ntNet API error: ${plantNetRes.status}`);
    }

    const response = (await plantNetRes.json()) as PlantNetResponse;

    if (response && response.results && response.results.length > 0) {
      const bestNet = response.results[0];
      plantNetScientific = bestNet.species?.scientificNameWithoutAuthor || '';
      const plantNetName = plantNetScientific || 'Unknown';
      plantNetInfo += `Pl@ntNet Name: ${plantNetName}\n`;

      if (bestNet.species?.family?.scientificNameWithoutAuthor) {
        plantNetInfo += `Family: ${bestNet.species.family.scientificNameWithoutAuthor}\n`;
      }
      if (bestNet.species?.genus?.scientificNameWithoutAuthor) {
        plantNetInfo += `Genus: ${bestNet.species.genus.scientificNameWithoutAuthor}\n`;
      }

      plantNetResult = {
        success: true,
        data: {
          scientificName: plantNetScientific,
          confidence: Math.round(bestNet.score * 100),
        },
      };
    } else {
      plantNetResult = {
        success: false,
        error: 'No plant results found from Pl@ntNet',
      };
    }
  } catch (err: unknown) {
    plantNetResult = {
      success: false,
      error: 'Pl@ntNet API error',
      data: {
        agriGuide: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }

  // --- 3. Gemini validation: check if image contains a valid plant ---
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
    } else {
      geminiCheckResult = {
        success: false,
        error: 'No response from Gemini validation',
      };
    }
  } catch (err: unknown) {
    geminiCheckResult = {
      success: false,
      error: 'Gemini API error',
      data: {
        agriGuide: err instanceof Error ? err.message : 'Unknown error',
      },
    };
    // If Gemini check fails, fallback to API results
    isPlant = !!(plantIdScientific || plantNetScientific);
  }

  // --- 4. Gemini agricultural guide ---
  let agriGuide = '';
  let geminiGuideResult: PlantIdentificationResult | null = null;

  if (isPlant) {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('Missing GEMINI_API_KEY');

      const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const geminiGuidePrompt = `Given the following plant identification results from Plant.id and Pl@ntNet, and the attached image, provide a concise, practical agricultural guide for this plant. Use the info below:\n${plantIdInfo}\n${plantNetInfo}\n\nFormat the result in these categories: Cultivation, Care & Maintenance, Harvesting, Growth Info, Common Issues. Use bullet points, keep each point short and practical.`;

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
      } else {
        agriGuide = 'No agricultural details found.';
        geminiGuideResult = {
          success: false,
          error: 'No agricultural guide response from Gemini',
        };
      }
    } catch (err: unknown) {
      agriGuide = 'Error fetching agricultural details from Gemini.';
      geminiGuideResult = {
        success: false,
        error: 'Gemini Guide API error',
        data: {
          agriGuide: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  // Compose response
  const hasError = !!(
    plantIdResult?.error ||
    plantNetResult?.error ||
    geminiCheckResult?.error ||
    geminiGuideResult?.error
  );

  logger.info('Plant identification completed', {
    hasError,
    plantFound: isPlant,
    plantIdSuccess: plantIdResult?.success,
    plantNetSuccess: plantNetResult?.success,
  });

  res.status(hasError ? 500 : 200).json({
    success: !hasError,
    data: {
      isPlant,
      scientificName: plantIdScientific || plantNetScientific || 'Unknown',
      commonNames: plantIdResult?.data?.commonNames || [],
      confidence: Math.max(
        plantIdResult?.data?.confidence || 0,
        plantNetResult?.data?.confidence || 0,
      ),
      agriGuide,
    },
    error: hasError
      ? {
          plantId: plantIdResult?.error ? plantIdResult : undefined,
          plantNet: plantNetResult?.error ? plantNetResult : undefined,
          geminiCheck: geminiCheckResult?.error ? geminiCheckResult : undefined,
          geminiGuide: geminiGuideResult?.error ? geminiGuideResult : undefined,
        }
      : undefined,
  });
});

export default router;
