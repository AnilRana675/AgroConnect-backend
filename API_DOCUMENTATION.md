# AgroConnect Backend API Documentation

## Multi-Step Registration API

The registration API allows users to complete their registration in 6 steps, corresponding to the onboarding questions.

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

### Request Body

```json
{
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
    "email": "john.doe@example.com",
    "password": "securePassword123"
  },
  "sessionId": "temp_1640995200000"
}
```

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

### 4. Continue with Steps 3-5, then Complete

```bash
curl -X POST http://localhost:5000/api/registration/complete \
  -H "Content-Type: application/json" \
  -d '{
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
      "farmerType": "Organic Farming",
      "farmingScale": "Small Scale (Less than 2 hectares)"
    },
    "loginCredentials": {
      "email": "john.doe@example.com",
      "password": "securePassword123"
    },
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
