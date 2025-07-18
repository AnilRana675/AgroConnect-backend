# AgroConnect Backend API Documentation

## Multi-Step Registration API

The registration API allows users to complete their registration in 6 steps, corresponding to the onboarding questions.

### 🔄 **Data Storage Flow**

**NEW: Temporary Storage System**

- **Steps 1-5**: Data is stored in **temporary database** (`TempRegistration` collection)
- **Step 6**: Data is moved from temporary to **permanent database** (`User` collection)
- **After completion**: Temporary data is automatically deleted
- **Auto-cleanup**: Temporary data expires after 24 hours

**Benefits:**

- ✅ **Session Recovery**: Users can refresh page without losing progress
- ✅ **Data Persistence**: Each step saves data to database immediately
- ✅ **Progress Tracking**: Can retrieve current progress at any time
- ✅ **Automatic Cleanup**: No manual cleanup needed

### Base URL

```
http://localhost:5000/api/registration
```

---

## Step 1: Name Registration

**Question:** "What is your Name?"

### Endpoint

```
POST /api/registration/step1
```

### Request Body

```json
{
  "firstName": "John",
  "middleName": "Michael", // Optional
  "lastName": "Doe",
  "sessionId": "unique_session_id" // Optional, will be generated if not provided
}
```

### Response

```json
{
  "message": "Name saved successfully",
  "step": 1,
  "data": {
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "sessionId": "temp_1640995200000"
  },
  "nextStep": 2
}
```

---

## Step 2: Location Registration

**Question:** "Which area are you located in? [state, district, municipality]"

### Endpoint

```
POST /api/registration/step2
```

### Request Body

```json
{
  "state": "Bagmati Province",
  "district": "Kathmandu",
  "municipality": "Kathmandu Metropolitan City",
  "sessionId": "temp_1640995200000"
}
```

### Response

```json
{
  "message": "Location saved successfully",
  "step": 2,
  "data": {
    "state": "Bagmati Province",
    "district": "Kathmandu",
    "municipality": "Kathmandu Metropolitan City",
    "sessionId": "temp_1640995200000"
  },
  "nextStep": 3
}
```

---

## Step 3: Agriculture Type Registration

**Question:** "What type of agriculture are you primarily involved in?"

### Endpoint

```
POST /api/registration/step3
```

### Request Body

```json
{
  "farmerType": "Organic Farming",
  "sessionId": "temp_1640995200000"
}
```

### Response

```json
{
  "message": "Agriculture type saved successfully",
  "step": 3,
  "data": {
    "farmerType": "Organic Farming",
    "sessionId": "temp_1640995200000"
  },
  "nextStep": 4
}
```

---

## Step 4: Economic Scale Registration

**Question:** "What is the economic scale of your agriculture?"

### Endpoint

```
POST /api/registration/step4
```

### Request Body

```json
{
  "farmingScale": "Small Scale (Less than 2 hectares)",
  "sessionId": "temp_1640995200000"
}
```

### Response

```json
{
  "message": "Economic scale saved successfully",
  "step": 4,
  "data": {
    "farmingScale": "Small Scale (Less than 2 hectares)",
    "sessionId": "temp_1640995200000"
  },
  "nextStep": 5
}
```

---

## Step 5: Email Registration

**Question:** "What is your Email Address?"

### Endpoint

```
POST /api/registration/step5
```

### Request Body

```json
{
  "email": "john.doe@example.com",
  "sessionId": "temp_1640995200000"
}
```

### Response

```json
{
  "message": "Email saved successfully",
  "step": 5,
  "data": {
    "email": "john.doe@example.com",
    "sessionId": "temp_1640995200000"
  },
  "nextStep": 6
}
```

### Error Response (Email already exists)

```json
{
  "message": "Email already registered",
  "step": 5
}
```

---

## Step 6: Complete Registration

**Question:** "Create a Password for your account."

### Endpoint

```
POST /api/registration/complete
```

### Request Body (NEW: Simplified)

```json
{
  "password": "securePassword123",
  "sessionId": "temp_1640995200000"
}
```

**Note:** All previous step data is automatically retrieved from temporary storage using the sessionId.

### Response

```json
{
  "message": "Registration completed successfully",
  "step": 6,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "personalInfo": {
      "firstName": "John",
      "middleName": "Michael",
      "lastName": "Doe"
    },
    "locationInfo": {
      "state": "Bagmati Province",
      "district": "Kathmandu",
      "municipality": "Kathmandu Metropolitan City"
    },
    "farmInfo": {
      "farmerType": "Organic Farming",
      "farmingScale": "Small Scale (Less than 2 hectares)"
    },
    "loginCredentials": {
      "email": "john.doe@example.com"
    },
    "createdAt": "2023-12-31T12:00:00.000Z",
    "updatedAt": "2023-12-31T12:00:00.000Z"
  },
  "sessionId": "temp_1640995200000",
  "registrationComplete": true
}
```

---

## Get Registration Progress

### Endpoint

```
GET /api/registration/progress/:sessionId
```

### Response

```json
{
  "message": "Registration progress retrieved",
  "currentStep": 3,
  "data": {
    "personalInfo": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "locationInfo": {
      "state": "Bagmati Province",
      "district": "Kathmandu",
      "municipality": "Kathmandu Metropolitan City"
    },
    "farmInfo": {
      "farmerType": "Organic Farming"
    },
    "loginCredentials": {
      "email": "john.doe@example.com"
    }
  }
}
```

---

## Get Registration Options

### Endpoint

```
GET /api/registration/options
```

### Response

```json
{
  "message": "Registration options retrieved successfully",
  "options": {
    "agricultureTypes": [
      "Organic Farming",
      "Conventional Farming",
      "Sustainable Agriculture",
      "Permaculture",
      "Hydroponics",
      "Livestock Farming",
      "Dairy Farming",
      "Poultry Farming",
      "Aquaculture",
      "Mixed Farming"
    ],
    "economicScales": [
      "Small Scale (Less than 2 hectares)",
      "Medium Scale (2-10 hectares)",
      "Large Scale (10-50 hectares)",
      "Commercial Scale (50+ hectares)",
      "Subsistence Farming",
      "Semi-Commercial"
    ],
    "states": [
      "Province 1",
      "Province 2",
      "Bagmati Province",
      "Gandaki Province",
      "Lumbini Province",
      "Karnali Province",
      "Sudurpashchim Province"
    ]
  }
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created (for completion)
- `400` - Bad Request (missing required fields, validation errors)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "message": "Error description",
  "step": 1, // Current step number
  "error": "Detailed error information" // Only in development
}
```

---

## Usage Example

Here's how to use the API step by step:

### 1. Get Available Options

```bash
curl -X GET http://localhost:5000/api/registration/options
```

### 2. Step 1 - Name

```bash
curl -X POST http://localhost:5000/api/registration/step1 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 3. Step 2 - Location

```bash
curl -X POST http://localhost:5000/api/registration/step2 \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Bagmati Province",
    "district": "Kathmandu",
    "municipality": "Kathmandu Metropolitan City",
    "sessionId": "temp_1640995200000"
  }'
```

### 4. Continue with Steps 3-5, then Complete (NEW: Simplified)

```bash
# Step 3
curl -X POST http://localhost:5000/api/registration/step3 \
  -H "Content-Type: application/json" \
  -d '{
    "farmerType": "Organic Farming",
    "sessionId": "temp_1640995200000"
  }'

# Step 4
curl -X POST http://localhost:5000/api/registration/step4 \
  -H "Content-Type: application/json" \
  -d '{
    "farmingScale": "Small Scale (Less than 2 hectares)",
    "sessionId": "temp_1640995200000"
  }'

# Step 5
curl -X POST http://localhost:5000/api/registration/step5 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "sessionId": "temp_1640995200000"
  }'

# Step 6 - Complete (only need password!)
curl -X POST http://localhost:5000/api/registration/complete \
  -H "Content-Type: application/json" \
  -d '{
    "password": "securePassword123",
    "sessionId": "temp_1640995200000"
  }'
```

---

## Additional User Management APIs

### Get All Users

```
GET /api/users
```

### Get User by ID

```
GET /api/users/:id
```

### Update User

```
PUT /api/users/:id
```

### Delete User

```
DELETE /api/users/:id
```

For detailed documentation of these endpoints, refer to the existing user management API documentation.

---

## AI Assistant API (NEW!)

The AI Assistant API provides intelligent farming advice using GitHub Models API with Llama-3.2-11B-Vision-Instruct model.

### Base URL

```
http://localhost:5000/api/ai
```

### Authentication

- **GitHub Token**: Required in environment variables (`GITHUB_TOKEN`)
- **Model**: Llama-3.2-11B-Vision-Instruct
- **Cost**: Free for developers

---

## Check AI Service Status

### Endpoint

```
GET /api/ai/status
```

### Response

```json
{
  "success": true,
  "configured": true,
  "message": "AI service is ready",
  "service": {
    "name": "GitHub Models AI Service",
    "provider": "GitHub Models",
    "model": "Llama-3.2-11B-Vision-Instruct",
    "features": [
      "Farming advice",
      "Weekly tips generation",
      "Crop disease diagnosis",
      "Personalized recommendations"
    ]
  },
  "timestamp": "2023-12-31T12:00:00.000Z",
  "environment": "development"
}
```

---

## Get Personalized Farming Advice

### Endpoint

```
POST /api/ai/ask
```

### Request Body

```json
{
  "question": "What are the best practices for rice farming in Nepal?",
  "userId": "507f1f77bcf86cd799439011" // Optional - for personalized advice
}
```

### Response

```json
{
  "success": true,
  "data": {
    "answer": "For rice farming in Nepal, focus on proper seedbed preparation, maintain optimal water levels, and consider using improved varieties suitable for your region. Plant during the monsoon season (June-July) and ensure proper spacing between plants.",
    "question": "What are the best practices for rice farming in Nepal?",
    "personalized": true,
    "userProfile": {
      "farmerType": "Rice Farming",
      "location": "Kathmandu, Bagmati Province",
      "farmingScale": "Small Scale"
    },
    "userDetails": {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "district": "Kathmandu",
      "state": "Bagmati Province",
      "farmerType": "Rice Farming",
      "farmingScale": "Small Scale"
    }
  },
  "metadata": {
    "requestId": "req_1640995200000_abc123",
    "responseTime": "245ms",
    "service": "GitHub Models AI",
    "model": "Llama-3.2-11B-Vision-Instruct",
    "personalizationApplied": true,
    "contextType": "user_profile",
    "timestamp": "2023-12-31T12:00:00.000Z",
    "apiVersion": "1.0"
  },
  "analytics": {
    "questionLength": 54,
    "answerLength": 187,
    "processingTime": 245,
    "cached": false,
    "confidenceScore": 0.85
  }
}
```

---

## Get Anonymous Farming Advice

### Endpoint

```
POST /api/ai/ask-anonymous
```

### Request Body

```json
{
  "question": "What is organic farming?",
  "location": "Nepal", // Optional
  "farmerType": "Organic Farming", // Optional
  "farmingScale": "Small Scale" // Optional
}
```

### Response

```json
{
  "success": true,
  "data": {
    "answer": "Organic farming is a method of agriculture that relies on natural processes and avoids synthetic chemicals. It focuses on soil health, biodiversity, and sustainable practices.",
    "question": "What is organic farming?",
    "contextUsed": "general Nepal farming",
    "personalized": false,
    "locationBased": false,
    "generalAdvice": true
  },
  "metadata": {
    "requestId": "anon_1640995200000_xyz789",
    "responseTime": "156ms",
    "service": "GitHub Models AI",
    "model": "Llama-3.2-11B-Vision-Instruct",
    "userType": "anonymous",
    "contextType": "general",
    "timestamp": "2023-12-31T12:00:00.000Z",
    "apiVersion": "1.0"
  },
  "analytics": {
    "questionLength": 23,
    "answerLength": 143,
    "processingTime": 156,
    "personalizationLevel": "none",
    "cached": false,
    "confidenceScore": 0.65
  }
}
```

---

## Diagnose Crop Diseases

### Endpoint

```
POST /api/ai/diagnose
```

### Request Body

```json
{
  "description": "Yellow leaves with brown spots and wilting",
  "cropType": "rice", // Optional
  "location": "Kathmandu", // Optional
  "severity": "moderate" // Optional: mild, moderate, severe
}
```

### Response

```json
{
  "success": true,
  "data": {
    "diagnosis": "Based on the symptoms described, this appears to be rice blast disease. Apply fungicide treatment immediately and remove affected leaves. Ensure proper field drainage and avoid over-fertilization with nitrogen.",
    "symptoms": {
      "description": "Yellow leaves with brown spots and wilting",
      "severity": "moderate",
      "riskLevel": "high",
      "urgency": "medium"
    },
    "cropInfo": {
      "type": "rice",
      "affectedArea": "Kathmandu",
      "commonDiseases": ["Rice blast", "Brown spot", "Bacterial leaf blight"]
    },
    "recommendations": {
      "immediateActions": ["Apply fungicide treatment", "Remove affected plants/leaves"],
      "preventiveMeasures": [
        "Ensure proper crop rotation",
        "Maintain field hygiene",
        "Use resistant varieties",
        "Monitor weather conditions",
        "Regular field inspection"
      ],
      "followUpRequired": true
    }
  },
  "metadata": {
    "requestId": "diag_1640995200000_def456",
    "responseTime": "312ms",
    "service": "GitHub Models AI",
    "model": "Llama-3.2-11B-Vision-Instruct",
    "analyzedAt": "2023-12-31T12:00:00.000Z",
    "apiVersion": "1.0",
    "contentType": "crop_disease_diagnosis"
  },
  "analytics": {
    "descriptionLength": 42,
    "diagnosisLength": 198,
    "processingTime": 312,
    "riskAssessment": "high",
    "cached": false
  }
}
```

---

## Get Weekly Farming Tips

### Endpoint

```
GET /api/ai/weekly-tips/:userId
```

### Response

```json
{
  "success": true,
  "data": {
    "tips": "This week focus on preparing your fields for the upcoming planting season. Check soil moisture levels, apply organic compost, and inspect irrigation systems. Monitor weather forecasts for optimal planting timing.",
    "userProfile": {
      "farmerType": "Rice Farming",
      "location": "Kathmandu, Bagmati Province",
      "farmingScale": "Small Scale"
    },
    "userDetails": {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "farmerType": "Rice Farming",
      "farmingScale": "Small Scale",
      "municipality": "Kathmandu Metropolitan City"
    },
    "seasonalContext": {
      "currentSeason": "Spring",
      "weekOfYear": 12,
      "month": "March",
      "applicableRegion": "Bagmati Province"
    }
  },
  "metadata": {
    "requestId": "tips_1640995200000_ghi789",
    "responseTime": "278ms",
    "service": "GitHub Models AI",
    "model": "Llama-3.2-11B-Vision-Instruct",
    "generatedAt": "2023-12-31T12:00:00.000Z",
    "apiVersion": "1.0",
    "contentType": "weekly_farming_tips"
  },
  "analytics": {
    "tipsLength": 189,
    "processingTime": 278,
    "personalizationLevel": "full",
    "cached": false
  }
}
```

---

## Error Handling

### AI Service Not Configured

```json
{
  "success": false,
  "error": "AI service is not configured. Please check your GitHub token.",
  "requestId": "req_1640995200000_error",
  "timestamp": "2023-12-31T12:00:00.000Z"
}
```

### Invalid Request

```json
{
  "success": false,
  "error": "Question is required",
  "requestId": "req_1640995200000_error",
  "timestamp": "2023-12-31T12:00:00.000Z"
}
```

### API Request Failed

```json
{
  "success": false,
  "error": "Failed to get farming advice. Please try again.",
  "requestId": "req_1640995200000_error",
  "metadata": {
    "responseTime": "1500ms",
    "timestamp": "2023-12-31T12:00:00.000Z",
    "service": "GitHub Models AI",
    "errorType": "internal_server_error"
  }
}
```

---

## Caching System

The API implements Redis-based caching for improved performance:

### Cache Features

- **Redis Cloud**: Primary caching with Redis Cloud service
- **In-Memory Fallback**: Automatic fallback when Redis is unavailable
- **TTL Management**: Configurable cache expiration times
- **Cache Statistics**: Real-time cache hit/miss tracking
- **Cache Invalidation**: Manual cache clearing capabilities

### Cache Management Endpoints

#### Get Cache Statistics

```
GET /api/cache/stats
```

#### Clear All Cache

```
DELETE /api/cache/clear
```

#### Clear Specific Cache Pattern

```
DELETE /api/cache/clear/:pattern
```

#### Warm Up Cache

```
POST /api/cache/warmup
```

---

## Usage Examples

### 1. Check AI Service Status

```bash
curl -X GET http://localhost:5000/api/ai/status
```

### 2. Get Personalized Farming Advice

```bash
curl -X POST http://localhost:5000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "When should I plant tomatoes in Nepal?",
    "userId": "507f1f77bcf86cd799439011"
  }'
```

### 3. Get Anonymous Farming Advice

```bash
curl -X POST http://localhost:5000/api/ai/ask-anonymous \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the benefits of organic farming?",
    "location": "Nepal",
    "farmerType": "Organic Farming"
  }'
```

### 4. Diagnose Crop Disease

```bash
curl -X POST http://localhost:5000/api/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Leaves are turning yellow and have brown spots",
    "cropType": "rice",
    "severity": "moderate"
  }'
```

### 5. Get Weekly Farming Tips

```bash
curl -X GET http://localhost:5000/api/ai/weekly-tips/507f1f77bcf86cd799439011
```

---

## AI Service Configuration

### Environment Variables

```bash
# Required for AI functionality
GITHUB_TOKEN=your_github_personal_access_token

# Optional (defaults shown)
NODE_ENV=development
LOG_LEVEL=info
```

### GitHub Token Setup

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token with `read:packages` scope
3. Add token to your `.env` file
4. Restart the server

### Model Information

- **Model**: Llama-3.2-11B-Vision-Instruct
- **Provider**: GitHub Models (Microsoft Azure)
- **Cost**: Free for developers
- **Rate Limits**: Generous (exact limits depend on GitHub's current policy)
- **Features**: Text generation, agricultural expertise, context-aware responses

---

## Features

### ✅ **Implemented**

- **Personalized Advice**: Context-aware responses based on user profile
- **Anonymous Support**: General farming advice without user account
- **Disease Diagnosis**: AI-powered crop disease identification
- **Weekly Tips**: Seasonal and location-based farming recommendations
- **Risk Assessment**: Automated severity and urgency calculation
- **Error Handling**: Comprehensive error responses with request tracking
- **Analytics**: Performance metrics and response analysis
- **Nepal-Specific**: Specialized knowledge for Nepali farming conditions

### 🔄 **In Progress**

- **Image Recognition**: Crop disease identification from photos
- **Weather Integration**: Real-time weather-based recommendations
- **Yield Prediction**: ML-based crop yield forecasting

### 📅 **Planned**

- **Multilingual Support**: Nepali language responses
- **Voice Input**: Speech-to-text for farmers
- **Offline Mode**: Cached responses for areas with poor connectivity
- **Community Features**: Farmer-to-farmer knowledge sharing
