import sys
import json
import base64
import os
from typing import Dict, Any

# Valid voice options
VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

def validate_input(text: str, voice: str) -> Dict[str, Any]:
    """Validate input parameters"""
    if not text or not text.strip():
        return {"success": False, "error": "Text is required"}
    
    if len(text) > 4000:
        return {"success": False, "error": "Text must be less than 4000 characters"}
    
    if voice not in VALID_VOICES:
        return {"success": False, "error": f"Invalid voice option. Must be one of: {', '.join(VALID_VOICES)}"}
    
    return {"success": True}

def text_to_speech(text: str, voice: str = "alloy") -> Dict[str, Any]:
    """Convert text to speech using A4F service"""
    # Validate input
    validation = validate_input(text, voice)
    if not validation["success"]:
        return validation
    
    try:
        # Import A4F here to handle import errors gracefully
        from a4f_local import A4F
        
        client = A4F()
        audio_bytes = client.audio.speech.create(
            model="tts-1",
            input=text.strip(),
            voice=voice
        )
        
        # Convert bytes to base64 for JSON serialization
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        return {"success": True, "audio": audio_base64}
        
    except ImportError:
        return {"success": False, "error": "A4F library not found. Please install required dependencies."}
    except Exception as e:
        error_msg = str(e)
        if "rate limit" in error_msg.lower():
            return {"success": False, "error": "Rate limit exceeded. Please try again later."}
        elif "quota" in error_msg.lower():
            return {"success": False, "error": "Service quota exceeded. Please try again later."}
        else:
            return {"success": False, "error": f"TTS service error: {error_msg}"}

if __name__ == "__main__":
    try:
        # Read input from command line arguments
        if len(sys.argv) > 1:
            input_data = json.loads(sys.argv[1])
            text = input_data.get("text", "")
            voice = input_data.get("voice", "alloy")
            
            result = text_to_speech(text, voice)
            print(json.dumps(result))
        else:
            print(json.dumps({"success": False, "error": "No input provided"}))
    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Invalid JSON input"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Unexpected error: {str(e)}"})) 