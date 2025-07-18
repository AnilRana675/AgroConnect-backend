import mongoose, { Document, Schema } from 'mongoose';
import authUtils from '../utils/auth';

export interface IUser extends Document {
  personalInfo: {
    firstName: string;
    middleName?: string;
    lastName: string;
  };
  locationInfo: {
    state: string;
    district: string;
    municipality: string;
  };
  farmInfo: {
    farmerType: string;
    farmingScale: string;
  };
  loginCredentials: {
    email: string;
    password?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    personalInfo: {
      firstName: { type: String, required: true, trim: true },
      middleName: { type: String, trim: true },
      lastName: { type: String, required: true, trim: true },
    },
    locationInfo: {
      state: { type: String, required: true, trim: true },
      district: { type: String, required: true, trim: true },
      municipality: { type: String, required: true, trim: true },
    },
    farmInfo: {
      farmerType: { type: String, required: true, trim: true },
      farmingScale: { type: String, required: true, trim: true },
    },
    loginCredentials: {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      password: { type: String, required: true, minlength: 6 },
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('loginCredentials.password')) return next();

  try {
    // Hash password with cost of 12
    const userDoc = this as unknown as IUser;
    const currentPassword = userDoc.loginCredentials.password;
    if (currentPassword) {
      const hashedPassword = await authUtils.hashPassword(currentPassword);
      userDoc.loginCredentials.password = hashedPassword;
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);
