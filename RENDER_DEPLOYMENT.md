# AgroConnect Backend - Production Deployment Guide

## Render Deployment Instructions

### 1. Prerequisites
- GitHub repository with your backend code
- Render account (free tier available)
- MongoDB Atlas database (free tier available)
- Required API keys (GitHub Token, Plant.id API key)

### 2. Environment Variables Setup

In your Render dashboard, add these environment variables:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/agroconnect?retryWrites=true&w=majority
GITHUB_TOKEN=your_github_token_here
JWT_SECRET=your_super_secure_jwt_secret_here_at_least_32_characters
PLANT_ID_API_KEY=your_plant_id_api_key_here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

### 3. Render Configuration

#### Automatic Deployment (Recommended)
1. Connect your GitHub repository to Render
2. Use the included `render.yaml` file for automatic configuration
3. Render will automatically detect and use the configuration

#### Manual Deployment
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use these settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Yes

### 4. Memory Optimization Features

✅ **Implemented optimizations:**
- Node.js heap size limited to 512MB (`--max-old-space-size=512`)
- Size optimization enabled (`--optimize-for-size`)
- Garbage collection monitoring in production
- Memory usage alerts (warns at 400MB+)
- Health check endpoint with memory stats
- Graceful shutdown handling

### 5. Production Features

✅ **Security & Performance:**
- Helmet.js for security headers
- Rate limiting (100 requests per 15 minutes)
- CORS configuration
- Request logging with UUID tracking
- Error handling and logging
- Server timeout configuration (30 seconds)

✅ **Monitoring:**
- Health check endpoint: `GET /health`
- Memory usage monitoring
- Request duration tracking
- Comprehensive logging with Winston

### 6. API Endpoints

- **Health Check**: `GET /health`
- **Root**: `GET /`
- **Authentication**: `/api/auth/*`
- **Users**: `/api/users/*`
- **Registration**: `/api/registration/*`
- **AI Assistant**: `/api/ai/*`
- **Plant Identification**: `/api/plant/*`
- **Cache**: `/api/cache/*`

### 7. Enhanced Plant Identification Workflow

The enhanced plant identification now includes:

1. **Step 1**: Gemini AI validates if the image contains a plant
2. **Step 2**: If plant detected, queries Plant.id API for detailed information
3. **Step 3**: Gemini AI creates comprehensive agricultural guide with:
   - Plant Overview
   - Care Instructions
   - Optimal Growing Conditions
   - Common Issues & Solutions
   - Harvesting Information
   - **Current Plant Condition & Diagnosis** (NEW!)

### 8. Deployment Steps

1. **Push to GitHub**: Ensure all code is committed and pushed
2. **Create Render Service**: Connect repository and configure environment variables
3. **Deploy**: Render will automatically build and deploy
4. **Test Health Check**: Visit `https://your-app.onrender.com/health`
5. **Test Plant API**: Use the enhanced plant identification endpoint

### 9. Troubleshooting

#### Memory Issues
- Memory usage is limited to 512MB
- Garbage collection runs every 5 minutes
- Health endpoint shows current memory usage
- Warnings logged when memory exceeds 400MB

#### Build Issues
- Ensure all dependencies are in `package.json`
- Check that TypeScript compilation succeeds locally
- Verify environment variables are set correctly

#### API Issues
- Check environment variables (especially GITHUB_TOKEN and PLANT_ID_API_KEY)
- Verify MongoDB connection string
- Test endpoints individually

### 10. Free Tier Limitations

Render free tier includes:
- 512MB RAM (perfect for our optimization)
- 0.1 CPU
- Service spins down after 15 minutes of inactivity
- 750 hours per month

### 11. Monitoring

Monitor your deployment:
- **Logs**: Available in Render dashboard
- **Health**: `GET /health` endpoint
- **Memory**: Included in health check response
- **Performance**: Request duration logged

## Success Indicators

✅ Health check returns 200 OK
✅ Memory usage stays below 400MB
✅ Plant identification workflow completes all 3 steps
✅ AI analysis includes plant condition diagnosis
✅ No memory heap limit errors
✅ Graceful shutdown on deployment updates

Your backend is now optimized for production deployment on Render with enhanced plant identification and condition diagnosis features!
