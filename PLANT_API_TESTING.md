# Testing the Plant Identification API

## API Endpoint
**POST** `http://localhost:5000/api/plant/identify`

## Required Parameters
- `imageBase64`: Base64 encoded image string (minimum 100 characters)

## Environment Variables Required
Make sure these are set in your `.env` file:
- `PLANT_ID_API_KEY`: Your Plant.id API key
- `PLANTNET_API_KEY`: Your PlantNet API key  
- `GEMINI_API_KEY`: Your Google Gemini API key

## Test Methods

### 1. Using cURL
```bash
curl -X POST http://localhost:5000/api/plant/identify \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }'
```

### 2. Using Postman
1. Set method to POST
2. URL: `http://localhost:5000/api/plant/identify`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "imageBase64": "YOUR_BASE64_IMAGE_STRING_HERE"
}
```

### 3. Using JavaScript/Fetch
```javascript
const testPlantAPI = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/plant/identify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: 'YOUR_BASE64_IMAGE_STRING_HERE'
      })
    });
    
    const result = await response.json();
    console.log('Plant identification result:', result);
  } catch (error) {
    console.error('Error testing plant API:', error);
  }
};

testPlantAPI();
```

## Expected Response Format

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "isPlant": true,
    "scientificName": "Rosa rubiginosa",
    "commonNames": ["Sweet briar", "Eglantine"],
    "confidence": 85,
    "agriGuide": "Cultivation: Plant in well-drained soil with full sun exposure..."
  }
}
```

### Error Response (400/500)
```json
{
  "success": false,
  "error": "Missing or invalid imageBase64",
  "code": 400
}
```

## Testing Tips

1. **Convert image to base64**: Use online tools or scripts to convert your plant images to base64
2. **Check server logs**: Monitor the terminal where the server is running for detailed logs
3. **Start with small images**: Large base64 strings can cause timeouts
4. **Verify API keys**: Make sure all three API keys are valid and have quota remaining

## Quick Test with Sample Data
The API includes validation for minimum image size (100+ characters). You can test the validation with a minimal base64 string, but for actual plant identification, you'll need a real plant image converted to base64.
