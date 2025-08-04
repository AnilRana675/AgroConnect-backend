import { User, IUser } from '../models/User';
import logger from '../utils/logger';

/**
 * Ensure user has a preferred language set
 * This is helpful for existing users who don't have this field
 */
export const ensureUserLanguage = async (userId: string): Promise<void> => {
  try {
    const user = await User.findById(userId);
    if (user && !user.preferredLanguage) {
      user.preferredLanguage = 'en';
      await user.save();
      logger.info(`Set default language 'en' for user: ${userId}`);
    }
  } catch (error) {
    logger.error('Error ensuring user language:', error);
  }
};

/**
 * Update user's preferred language
 */
export const updateUserLanguage = async (
  userId: string,
  language: string,
): Promise<IUser | null> => {
  try {
    if (!['en', 'ne'].includes(language)) {
      throw new Error('Invalid language. Must be "en" or "ne"');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.preferredLanguage = language;
    await user.save();

    logger.info(`Updated language preference for user ${userId} to ${language}`);
    return user;
  } catch (error) {
    logger.error('Error updating user language:', error);
    throw error;
  }
};

/**
 * Get user's preferred language
 */
export const getUserLanguage = async (userId: string): Promise<string> => {
  try {
    const user = await User.findById(userId).select('preferredLanguage');
    if (!user) {
      return 'en'; // Default fallback
    }

    return user.preferredLanguage || 'en';
  } catch (error) {
    logger.error('Error getting user language:', error);
    return 'en'; // Default fallback
  }
};

export default {
  ensureUserLanguage,
  updateUserLanguage,
  getUserLanguage,
};
