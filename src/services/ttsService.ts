import { spawn } from 'child_process';
import path from 'path';

// Queue system for TTS requests
let isProcessing = false;
let requestQueue: Array<{
  text: string;
  voice: string;
  resolve: (value: Buffer) => void;
  reject: (reason: Error) => void;
}> = [];

export async function generateSpeech({
  text,
  voice = 'alloy',
}: {
  text: string;
  voice?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Add request to queue
    requestQueue.push({ text, voice, resolve, reject });

    // Process queue if not already processing
    if (!isProcessing) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const request = requestQueue.shift();

  if (!request) {
    isProcessing = false;
    return;
  }

  try {
    const audioBuffer = await processTTSRequest(request.text, request.voice);
    request.resolve(audioBuffer);
  } catch (error) {
    request.reject(error instanceof Error ? error : new Error(String(error)));
  } finally {
    isProcessing = false;
    // Process next request in queue
    processQueue();
  }
}

async function processTTSRequest(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../utils/tts.py');
    const input = JSON.stringify({ text, voice });
    const py = spawn('python', [scriptPath, input]);

    let output = '';
    let error = '';

    py.stdout.on('data', (data) => {
      output += data.toString();
    });
    py.stderr.on('data', (data) => {
      error += data.toString();
    });
    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('TTS Python error: ' + error));
      }
      try {
        const result = JSON.parse(output);
        if (!result.success) {
          return reject(new Error(result.error || 'TTS failed'));
        }
        const audioBuffer = Buffer.from(result.audio, 'base64');
        resolve(audioBuffer);
      } catch (e) {
        reject(new Error('TTS parse error: ' + e + '\nOutput: ' + output));
      }
    });
  });
}

// Get current queue status
export function getTTSStatus() {
  return {
    isProcessing,
    queueLength: requestQueue.length,
  };
}
