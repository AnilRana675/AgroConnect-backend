import dotenv from 'dotenv';
dotenv.config();

import express from 'express';

console.log('Express imported successfully');

const app = express();

console.log('Basic app created');

// Try importing routes one by one to find the problematic one
try {
  console.log('Importing userRoutes...');
  const userRoutes = require('./routes/users');
  console.log('userRoutes imported successfully');
  
  console.log('Importing registrationRoutes...');
  const registrationRoutes = require('./routes/registration');
  console.log('registrationRoutes imported successfully');
  
  console.log('Importing aiAssistantRoutes...');
  const aiAssistantRoutes = require('./routes/ai-assistant');
  console.log('aiAssistantRoutes imported successfully');
  
  console.log('Importing authRoutes...');
  const authRoutes = require('./routes/auth');
  console.log('authRoutes imported successfully');
  
  console.log('Importing cacheRoutes...');
  const cacheRoutes = require('./routes/cache');
  console.log('cacheRoutes imported successfully');
  
  console.log('Importing plantRoutes...');
  const plantRoutes = require('./routes/plant');
  console.log('plantRoutes imported successfully');
  
  console.log('All routes imported successfully!');
  
} catch (error) {
  console.error('ERROR importing routes:', error);
}
