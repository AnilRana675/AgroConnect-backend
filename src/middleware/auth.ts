import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import authUtils from '../utils/auth';
import logger from '../utils/logger';

// Extend Request interface to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      email: string;
    };
  }
}

/**
 * Authentication middleware - protects routes requiring authentication
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = authUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        message: 'Authorization header with Bearer token is required',
      });
    }

    // Verify token
    const decoded = authUtils.verifyToken(token);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Access denied. User not found.',
        message: 'The user associated with this token no longer exists',
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Please provide a valid authentication token',
    });
  }
};

/**
 * Optional authentication middleware - doesn't block if no token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = authUtils.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = authUtils.verifyToken(token);

      // Check if user exists
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      }
    }

    next();
  } catch (error) {
    // Log error but don't block request
    logger.warn('Optional authentication failed:', error);
    next();
  }
};
