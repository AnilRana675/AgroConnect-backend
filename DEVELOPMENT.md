# Development Setup and Common Issues

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Development Server

The development server includes:
- ✅ Hot reload with nodemon
- ✅ TypeScript compilation
- ✅ Enhanced logging with colors
- ✅ Request analytics tracking
- ✅ Performance monitoring
- ✅ Real-time error tracking

## Common Issues and Solutions

### 1. Rate Limiter IPv6 Error
**Error**: `Custom keyGenerator appears to use request IP without calling the ipKeyGenerator helper function`

**Solution**: Fixed in latest version by using proper IPv6-compatible key generator.

### 2. MongoDB Buffer Entries Warning
**Error**: `option buffermaxentries is not supported`

**Solution**: Removed deprecated `bufferMaxEntries` option from mongoose configuration.

### 3. Redis Connection Issues
**Error**: `Redis connection failed`

**Solutions**:
- Ensure Redis is running locally or update `REDIS_URL` in `.env`
- For development without Redis, the app will use in-memory fallback
- Check Redis service status: `redis-cli ping`

### 4. MongoDB Connection Issues
**Error**: `MongoDB connection failed`

**Solutions**:
- Verify `MONGODB_URI` in `.env` file
- Check network connectivity
- Ensure MongoDB cluster is running
- Verify credentials and database permissions

## Environment Configuration

### Required Variables
```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GITHUB_TOKEN=your_github_token
```

### Optional Variables
```bash
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:3000
```

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /api/monitoring/status` - Detailed system status
- `GET /api/monitoring/dashboard` - Admin dashboard (requires auth)

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Monitoring (Admin Only)
- `GET /api/monitoring/analytics` - Request analytics
- `GET /api/monitoring/performance` - Performance metrics
- `GET /api/monitoring/alerts` - System alerts
- `POST /api/monitoring/cache/clear` - Clear cache

## Rate Limiting

The API implements multi-tier rate limiting:

- **General API**: 100 requests per 15 minutes
- **AI Endpoints**: 10 requests per minute  
- **Auth Endpoints**: 5 requests per 15 minutes

Rate limits are IP-based with IPv6 compatibility.

## Logging

### Log Levels
- `error` - Critical errors
- `warn` - Warnings and alerts
- `info` - General information
- `http` - HTTP request logs
- `debug` - Detailed debugging

### Log Files
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs
- `logs/access.log` - HTTP access logs

### Structured Logging
All logs include:
- Timestamp
- Request ID (for correlation)
- User ID (when available)
- Contextual metadata

## Performance Monitoring

### Automatic Tracking
- ⏱️ Response times with percentiles
- 📊 Request volume and patterns
- 🚨 Error rates and types
- 💾 Memory usage monitoring
- 🔍 Slow request detection (>2s)

### Analytics Storage
- In-memory circular buffer (10k requests)
- Redis persistence (7 days retention)
- Real-time alert generation

## Development Tools

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run start        # Start production server
npm run clean        # Clean build directory
npm run lint         # Run ESLint (if configured)
npm test             # Run tests (if configured)
```

### Debugging
- Set `LOG_LEVEL=debug` for verbose logging
- Use `DEBUG=*` for additional debug output
- Check logs in `logs/` directory
- Monitor `/api/monitoring/dashboard` for real-time stats

## Database Schema

### User Model
```typescript
{
  personalInfo: {
    firstName: string,
    lastName: string,
    phoneNumber: string,
    location: string
  },
  loginCredentials: {
    email: string,
    password: string (hashed)
  },
  farmerProfile: {
    farmSize: string,
    primaryCrops: string[],
    farmingExperience: string,
    challenges: string[]
  }
}
```

## Security Features

- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Rate limiting with IPv6 support
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ Input validation
- ✅ Request size limiting
- ✅ Security event logging

## Deployment

### Build for Production
```bash
npm run build
npm start
```

### Environment Variables for Production
Ensure all required environment variables are set:
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure proper `MONGODB_URI`
- Set appropriate rate limits
- Configure `FRONTEND_URL` for CORS

### Health Checks
The `/health` endpoint provides:
- Server uptime
- Memory usage
- Database connectivity
- Redis connectivity
- System status

Perfect for container orchestration and load balancer health checks.
