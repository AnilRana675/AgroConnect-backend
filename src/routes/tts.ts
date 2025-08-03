import express from 'express';
import { generateSpeech, getTTSStatus } from '../services/ttsService';

const router = express.Router();

// Status endpoint to check TTS processing state
router.get('/status', (req, res) => {
  const status = getTTSStatus();
  res.json(status);
});

router.post('/', async (req, res) => {
  const { text, voice } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const status = getTTSStatus();

  // If already processing, inform user to wait
  if (status.isProcessing) {
    return res.status(202).json({
      message: 'Please wait, TTS is currently processing another request',
      queuePosition: status.queueLength + 1,
      estimatedWait: status.queueLength * 5, // Rough estimate: 5 seconds per request
    });
  }

  try {
    const audioBuffer = await generateSpeech({ text, voice });
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'TTS API error' });
  }
});

export default router;
