import sys
import json
import base64
import os
import re
import urllib.request
import urllib.parse
import io
import time
import socket
from typing import Dict, Any, List

def detect_language(text: str) -> str:
    """Detect language from text"""
    try:
        if not text or not isinstance(text, str):
            return 'en'
            
        # Check for Nepali/Devanagari script
        if re.search(r'[\u0900-\u097F]', text):
            return 'hi'  # Use Hindi for Nepali text as it's supported
        # Check for English
        elif re.search(r'[a-zA-Z]', text):
            return 'en'
        else:
            return 'en'
    except Exception as e:
        print(f"Error in language detection: {e}", file=sys.stderr)
        return 'en'  # Default to English on error

def chunk_text(text: str, max_length: int = 200) -> List[str]:
    """Split text into chunks that respect sentence boundaries"""
    try:
        if not text or not isinstance(text, str):
            return []
            
        text = text.strip()
        if not text:
            return []
            
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        # Split by sentences first (support both English and Nepali punctuation)
        sentences = re.split(r'[.!?।]\s*', text)
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # If adding this sentence would exceed limit, save current chunk
            if len(current_chunk) + len(sentence) + 1 > max_length:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    # If single sentence is too long, split by words
                    words = sentence.split()
                    temp_chunk = ""
                    for word in words:
                        if len(temp_chunk) + len(word) + 1 > max_length:
                            if temp_chunk:
                                chunks.append(temp_chunk.strip())
                                temp_chunk = word
                            else:
                                # If single word is too long, truncate it
                                chunks.append(word[:max_length])
                        else:
                            temp_chunk += (" " + word) if temp_chunk else word
                    if temp_chunk:
                        current_chunk = temp_chunk
            else:
                current_chunk += (" " + sentence) if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Filter out empty chunks
        chunks = [chunk for chunk in chunks if chunk.strip()]
        
        # If no chunks were created, return the original text truncated
        if not chunks:
            return [text[:max_length]]
            
        return chunks
        
    except Exception as e:
        print(f"Error in text chunking: {e}", file=sys.stderr)
        # Fallback: return original text truncated
        if text and isinstance(text, str):
            return [text[:max_length]]
        return []

def validate_input(text: str) -> Dict[str, Any]:
    """Validate input parameters"""
    try:
        if not text:
            return {"success": False, "error": "Text is required"}
            
        if not isinstance(text, str):
            return {"success": False, "error": "Text must be a string"}
            
        if not text.strip():
            return {"success": False, "error": "Text cannot be empty or only whitespace"}
        
        if len(text) > 2000:
            return {"success": False, "error": "Text must be less than 2000 characters for free TTS"}
        
        # Check for potentially problematic characters
        if len(text.encode('utf-8')) > 3000:  # UTF-8 byte length check
            return {"success": False, "error": "Text is too long when encoded (max 3000 bytes)"}
        
        return {"success": True}
        
    except Exception as e:
        return {"success": False, "error": f"Input validation error: {str(e)}"}

def make_tts_request(chunk: str, lang: str, retries: int = 3) -> bytes:
    """Make a single TTS request with retry logic"""
    for attempt in range(retries):
        try:
            # Google Translate TTS URL
            tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl={lang}&client=tw-ob&q={urllib.parse.quote(chunk)}"
            
            # Set headers to mimic browser request
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'audio/mpeg, audio/*, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive'
            }
            
            # Make request with timeout
            req = urllib.request.Request(tts_url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                # Check response status
                if response.status != 200:
                    raise urllib.error.HTTPError(response.url, response.status, f"HTTP {response.status}", response.headers, None)
                
                audio_bytes = response.read()
                
                # Validate audio data
                if len(audio_bytes) < 100:  # Too small, likely an error
                    raise ValueError(f"Audio data too small ({len(audio_bytes)} bytes), likely an error response")
                
                # Check if it's actually audio data (MP3 files start with specific bytes)
                if not (audio_bytes.startswith(b'\xff\xfb') or audio_bytes.startswith(b'ID3')):
                    # Try to decode as text to see if it's an error message
                    try:
                        error_text = audio_bytes.decode('utf-8')
                        raise ValueError(f"Received text instead of audio: {error_text[:100]}...")
                    except UnicodeDecodeError:
                        pass  # It's binary data, might be audio
                
                return audio_bytes
                
        except socket.timeout:
            if attempt < retries - 1:
                print(f"Timeout on attempt {attempt + 1}, retrying...", file=sys.stderr)
                time.sleep(1)
                continue
            raise ValueError(f"Request timeout after {retries} attempts")
            
        except urllib.error.HTTPError as e:
            if e.code == 429:  # Rate limiting
                if attempt < retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"Rate limited, waiting {wait_time}s before retry...", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                raise ValueError(f"Rate limited after {retries} attempts")
            elif e.code >= 500:  # Server errors
                if attempt < retries - 1:
                    print(f"Server error {e.code}, retrying...", file=sys.stderr)
                    time.sleep(1)
                    continue
                raise ValueError(f"Server error {e.code}: {e.reason}")
            else:
                raise ValueError(f"HTTP error {e.code}: {e.reason}")
                
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                print(f"Network error on attempt {attempt + 1}, retrying...", file=sys.stderr)
                time.sleep(1)
                continue
            raise ValueError(f"Network error after {retries} attempts: {e.reason}")
            
        except Exception as e:
            if attempt < retries - 1:
                print(f"Unexpected error on attempt {attempt + 1}: {e}, retrying...", file=sys.stderr)
                time.sleep(1)
                continue
            raise ValueError(f"Request failed after {retries} attempts: {str(e)}")
    
    raise ValueError("All retries exhausted")
def text_to_speech(text: str, voice: str = "alloy") -> Dict[str, Any]:
    """Convert text to speech using free Google Translate TTS with comprehensive error handling"""
    try:
        # Validate input
        validation = validate_input(text)
        if not validation["success"]:
            return validation
        
        # Detect language
        lang = detect_language(text.strip())
        if not lang:
            return {"success": False, "error": "Could not detect language"}
        
        # Split text into manageable chunks
        chunks = chunk_text(text.strip(), 190)  # Leave some buffer
        if not chunks:
            return {"success": False, "error": "Could not process text into chunks"}
        
        audio_parts = []
        failed_chunks = []
        
        print(f"Processing {len(chunks)} chunks in language: {lang}", file=sys.stderr)
        
        for i, chunk in enumerate(chunks):
            try:
                print(f"Processing chunk {i+1}/{len(chunks)}: {chunk[:50]}...", file=sys.stderr)
                
                # Make TTS request with retries
                audio_bytes = make_tts_request(chunk, lang)
                audio_parts.append(audio_bytes)
                
                # Add small delay between requests to avoid rate limiting
                if i < len(chunks) - 1:
                    time.sleep(0.5)
                    
            except Exception as e:
                error_msg = f"Failed to process chunk {i+1}: {str(e)}"
                print(error_msg, file=sys.stderr)
                failed_chunks.append({"chunk": i+1, "text": chunk[:50], "error": str(e)})
                
                # If too many chunks fail, abort
                if len(failed_chunks) > len(chunks) // 2:
                    return {
                        "success": False, 
                        "error": f"Too many chunks failed ({len(failed_chunks)}/{len(chunks)})",
                        "failed_chunks": failed_chunks
                    }
        
        # Check if we have any audio parts
        if not audio_parts:
            return {
                "success": False, 
                "error": "No audio was generated successfully",
                "failed_chunks": failed_chunks
            }
        
        # Combine all audio parts
        try:
            combined_audio = b''.join(audio_parts)
            
            # Validate combined audio
            if len(combined_audio) < 100:
                return {"success": False, "error": "Combined audio is too small to be valid"}
            
            # Convert bytes to base64 for JSON serialization
            audio_base64 = base64.b64encode(combined_audio).decode('utf-8')
            
            result = {"success": True, "audio": audio_base64}
            
            # Add warnings if some chunks failed
            if failed_chunks:
                result["warnings"] = f"{len(failed_chunks)} chunks failed but audio was still generated"
                result["failed_chunks"] = failed_chunks
            
            print(f"Successfully generated {len(combined_audio)} bytes of audio", file=sys.stderr)
            return result
            
        except Exception as e:
            return {"success": False, "error": f"Failed to combine audio parts: {str(e)}"}
        
    except KeyboardInterrupt:
        return {"success": False, "error": "Operation was cancelled"}
    except MemoryError:
        return {"success": False, "error": "Not enough memory to process the request"}
    except Exception as e:
        error_msg = f"Unexpected error in TTS service: {str(e)}"
        print(error_msg, file=sys.stderr)
        return {"success": False, "error": error_msg}

if __name__ == "__main__":
    try:
        # Read input from command line arguments
        if len(sys.argv) > 1:
            try:
                input_data = json.loads(sys.argv[1])
            except json.JSONDecodeError as e:
                print(json.dumps({"success": False, "error": f"Invalid JSON input: {str(e)}"}))
                sys.exit(1)
            
            # Extract and validate parameters
            text = input_data.get("text")
            voice = input_data.get("voice", "alloy")
            
            if not text:
                print(json.dumps({"success": False, "error": "Missing 'text' parameter in input"}))
                sys.exit(1)
            
            if not isinstance(voice, str):
                voice = "alloy"  # Default fallback
            
            # Process TTS request
            result = text_to_speech(text, voice)
            
            # Output result
            try:
                print(json.dumps(result))
            except Exception as e:
                # Fallback in case of JSON serialization error
                error_result = {"success": False, "error": f"Failed to serialize result: {str(e)}"}
                print(json.dumps(error_result))
                sys.exit(1)
                
        else:
            print(json.dumps({"success": False, "error": "No input provided. Usage: python tts.py '{\"text\": \"your text\", \"voice\": \"alloy\"}'"}))
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(json.dumps({"success": False, "error": "Operation cancelled by user"}))
        sys.exit(1)
    except MemoryError:
        print(json.dumps({"success": False, "error": "Insufficient memory to complete operation"}))
        sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"Critical error: {error_msg}", file=sys.stderr)
        print(json.dumps({"success": False, "error": error_msg}))
        sys.exit(1) 