# AgroConnect Backend

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

**AgroConnect Nepal** is a personalized agriculture support platform designed to empower Nepali farmers with smart, localized agricultural information and AI-powered insights.

## 🌾 Project Vision

AgroConnect Nepal aims to bridge the gap between traditional farming practices and modern agricultural technology by providing:

- **Personalized weekly agricultural updates** based on farmer type and location
- **Multi-step onboarding** to identify farmer categories and needs
- **Future AI integration** for crop disease detection and yield prediction
- **Localized content** in Nepali language with regional support

## 🚀 Features

### ✅ **Current Features (Phase 1 & 2)**

- 🔐 **Multi-step Farmer Registration** - 6-step onboarding process
- 👥 **Farmer Classification** - Identifies farmer types (subsistence, commercial, etc.)
- 📍 **Location-based Services** - State, district, and municipality mapping
- 💾 **Temporary Session Management** - Progress saving during registration
- 🔒 **Security Features** - Rate limiting, CORS, Helmet security headers
- 📊 **Comprehensive Testing** - 38 test cases with 100% pass rate
- 📝 **API Documentation** - Complete REST API documentation

### 🤖 **AI-Powered Features (NEW!)**

- 🌾 **AI Farming Assistant** - Personalized agricultural advice using GitHub Models API
- 🔍 **Crop Disease Diagnosis** - AI-powered disease identification and treatment recommendations
- 📅 **Weekly Farming Tips** - Personalized weekly tips based on farmer profile and season
- 🎯 **Context-Aware Responses** - Advice tailored to farmer type, location, and farming scale
- 📊 **Risk Assessment** - Automated risk level calculation for crop diseases
- 🌍 **Nepal-Specific Expertise** - Specialized knowledge for Nepali farming conditions
- 🆓 **Free AI Service** - No cost limits using GitHub Models with Llama-3.2-11B-Vision-Instruct

### 🔐 **Authentication & Security**

- 🔑 **JWT Authentication** - Secure user authentication and authorization
- 🛡️ **Password Hashing** - Bcrypt with salt rounds for secure password storage
- 🔒 **Protected Routes** - Authentication middleware for secured endpoints
- 📊 **Request Tracking** - Unique request IDs and response time monitoring
- 🔐 **GitHub Token Authentication** - Secure API access using GitHub personal access tokens

### 🔮 **Future Features (Phase 3)**

- 📸 **Image Recognition** - Crop disease identification from photos
- 📈 **Yield Prediction** - Smart planning based on soil and crop data
- 🌤️ **Weather Integration** - Real-time weather forecasts
- 📱 **Mobile App** - Cross-platform mobile application

## 🏗️ Architecture

```
src/
├── middleware/          # Custom middleware
│   ├── auth.ts         # JWT authentication middleware
│   └── httpLogger.ts   # HTTP request logging
├── models/              # Database models
│   ├── User.ts         # Main user model
│   └── TempRegistration.ts # Temporary registration data
├── routes/              # API routes
│   ├── ai-assistant.ts # AI-powered farming assistant
│   ├── auth.ts         # Authentication endpoints
│   ├── registration.ts # Multi-step registration
│   └── users.ts        # User CRUD operations
├── services/            # External service integrations
│   └── githubModelsAI.ts # GitHub Models AI service
├── tests/              # Test suites
│   ├── ai-assistant.test.ts # AI assistant tests
│   ├── registration.test.ts # Registration API tests
│   ├── setup.ts        # Test environment setup
│   └── users.test.ts   # User API tests
├── utils/              # Utility functions
│   ├── auth.ts         # Authentication utilities
│   └── logger.ts       # Winston logger configuration
└── index.ts            # Application entry point
```

## 🛠️ Tech Stack

### **Backend**

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1.0
- **Language**: TypeScript 5.8.3
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (planned)

### **Development Tools**

- **Testing**: Jest with Supertest (38 test cases)
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier
- **Git Hooks**: Husky for pre-commit checks
- **Build**: TypeScript compiler
- **AI Integration**: GitHub Models API with Llama-3.2-11B-Vision-Instruct

### **Security & Monitoring**

- **Security**: Helmet.js, CORS, Rate Limiting
- **Logging**: Winston with file and console transports
- **Monitoring**: HTTP request logging middleware

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- MongoDB instance (local or cloud)
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/AnilRana675/AgroConnect-backend.git
   cd AgroConnect-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Environment Variables**

   ```bash
   # .env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/agroconnect
   GITHUB_TOKEN=your_github_token_here
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRES_IN=7d
   NODE_ENV=development
   ```

5. **Start development server**

   ```bash
   npm run dev
   ```

6. **Run tests**
   ```bash
   npm test
   ```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start           # Start production server

# Testing
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Code Quality
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
npm run clean       # Clean build directory
```

## 🌐 API Endpoints

### **Registration API**

```
GET    /api/registration/options     # Get registration options
POST   /api/registration/step1       # Step 1: Name
POST   /api/registration/step2       # Step 2: Location
POST   /api/registration/step3       # Step 3: Agriculture Type
POST   /api/registration/step4       # Step 4: Economic Scale
POST   /api/registration/step5       # Step 5: Email
POST   /api/registration/complete    # Step 6: Complete Registration
GET    /api/registration/progress/:sessionId # Get progress
```

### **AI Assistant API (NEW!)**

```
GET    /api/ai/status              # Check AI service status
POST   /api/ai/ask                 # Get personalized farming advice
POST   /api/ai/ask-anonymous       # Get general farming advice
POST   /api/ai/diagnose            # Diagnose crop diseases
GET    /api/ai/weekly-tips/:userId # Get weekly farming tips
GET    /api/ai/weekly-tips         # Get weekly tips (authenticated)
```

### **Authentication API**

```
POST   /api/auth/login             # User login
POST   /api/auth/logout            # User logout
GET    /api/auth/me                # Get current user profile
PUT    /api/auth/change-password   # Change user password
POST   /api/auth/verify-token      # Verify JWT token
```

### **User Management API**

```
GET    /api/users           # Get all users
GET    /api/users/:id       # Get user by ID
POST   /api/users           # Create new user
PUT    /api/users/:id       # Update user
DELETE /api/users/:id       # Delete user
```

### **Health Check**

```
GET    /                    # Health check endpoint
```

## 📋 Registration Flow

AgroConnect uses a **6-step registration process** to create personalized farmer profiles:

1. **Step 1**: Personal Information (Name)
2. **Step 2**: Location (State, District, Municipality)
3. **Step 3**: Agriculture Type (Organic, Commercial, etc.)
4. **Step 4**: Economic Scale (Small, Medium, Large, Commercial)
5. **Step 5**: Email Address
6. **Step 6**: Password & Account Creation

### **Data Storage Strategy**

- **Steps 1-5**: Temporary storage with 24-hour expiration
- **Step 6**: Data migration to permanent storage
- **Session Recovery**: Users can continue from any step
- **Auto-cleanup**: Expired sessions automatically removed

## 🧪 Testing

The project maintains **100% test coverage** with comprehensive test suites:

- **25+ Test Cases** covering all API endpoints
- **Unit Tests** for individual components
- **Integration Tests** for complete workflows
- **Error Handling Tests** for edge cases

```bash
# Run specific test suites
npm test -- --testPathPattern=registration
npm test -- --testPathPattern=users

# Generate coverage report
npm run test:coverage
```

## 📊 Farmer Categories

The platform supports various farmer types across Nepal:

### **Agriculture Types**

- Organic Farming
- Conventional Farming
- Sustainable Agriculture
- Permaculture
- Hydroponics
- Livestock Farming
- Dairy Farming
- Poultry Farming
- Aquaculture
- Mixed Farming

### **Economic Scales**

- Small Scale (Less than 2 hectares)
- Medium Scale (2-10 hectares)
- Large Scale (10-50 hectares)
- Commercial Scale (50+ hectares)
- Subsistence Farming
- Semi-Commercial

### **Supported Provinces**

- Province 1
- Province 2
- Bagmati Province
- Gandaki Province
- Lumbini Province
- Karnali Province
- Sudurpashchim Province

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configured for cross-origin requests
- **Helmet.js**: Security headers for common vulnerabilities
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses
- **Session Management**: Temporary data with automatic cleanup

## 📚 API Documentation

Comprehensive API documentation is available in [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) with:

- **Complete endpoint reference**
- **Request/response examples**
- **Error handling guides**
- **Usage examples with cURL**
- **Authentication flow (planned)**

## 🔄 Development Workflow

### **Code Quality**

- **Pre-commit hooks** run linting and formatting
- **TypeScript strict mode** for type safety
- **ESLint** with TypeScript rules
- **Prettier** for consistent formatting

### **Git Workflow**

- **Branch**: `dev` for development
- **Commits**: Conventional commit format required
- **CI/CD**: Pre-commit hooks ensure code quality

### **Example Commit Messages**

```bash
feat(registration): add multi-step registration flow
fix(auth): resolve JWT token validation issue
docs(api): update registration endpoint documentation
test(users): add comprehensive user API tests
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests and ensure they pass**
   ```bash
   npm test
   ```
5. **Commit your changes**
   ```bash
   git commit -m "feat(feature): add amazing feature"
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

## 🗓️ Project Roadmap

### **Phase 1: Foundation** ✅

- [x] Multi-step registration system
- [x] Farmer classification
- [x] Location-based services
- [x] Comprehensive testing
- [x] API documentation

### **Phase 2: AI Integration** ✅

- [x] AI-powered farming assistant with GitHub Models
- [x] Crop disease diagnosis system
- [x] Weekly farming tips generation
- [x] Context-aware agricultural advice
- [ ] AI-powered chatbot in Nepali
- [ ] Crop disease detection via image recognition
- [ ] Yield prediction algorithms
- [ ] Weather integration
- [ ] Mobile app development

### **Phase 3: Advanced Features** 📅

- [ ] Real-time notifications
- [ ] Farmer community platform
- [ ] Marketplace integration
- [ ] Government scheme alerts
- [ ] Multi-language support

## 🐛 Known Issues

- [x] ~~JWT authentication not yet implemented~~ **COMPLETED**
- [x] ~~AI integration pending~~ **COMPLETED with GitHub Models**
- [ ] File upload for profile pictures pending
- [ ] Password reset functionality in development
- [ ] Email verification system planned

## 📈 Performance

- **Response Time**: < 100ms for most endpoints
- **Database**: Optimized queries with proper indexing
- **Memory Usage**: Efficient with automatic cleanup
- **Concurrent Users**: Tested for 100+ simultaneous users

## 🔧 Environment Configuration

### **Development**

```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agroconnect_dev
LOG_LEVEL=debug
```

### **Production**

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-cloud-db-url
LOG_LEVEL=info
```

## 📞 Support

For support, feature requests, or bug reports:

- **GitHub Issues**: [Create an issue](https://github.com/AnilRana675/AgroConnect-backend/issues)
- **Email**: [Contact the team](mailto:support@agroconnect.com)
- **Documentation**: [API Docs](./API_DOCUMENTATION.md)

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Nepali Agricultural Community** for inspiration and requirements
- **Open Source Community** for excellent tools and libraries
- **Hackathon Organizers** for providing the platform
- **Team Members** for their dedication and hard work

---

**Made with ❤️ for Nepali Farmers**

_AgroConnect Nepal - Empowering Agriculture Through Technology_
