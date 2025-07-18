import mongoose, { Document, Schema } from 'mongoose';

export interface ITempRegistration extends Document {
  sessionId: string;
  personalInfo?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  locationInfo?: {
    state?: string;
    district?: string;
    municipality?: string;
  };
  farmInfo?: {
    farmerType?: string;
    farmingScale?: string;
  };
  loginCredentials?: {
    email?: string;
    password?: string;
  };
  currentStep: number;
  createdAt: Date;
  expiresAt: Date;
}

const TempRegistrationSchema: Schema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    personalInfo: {
      firstName: { type: String, trim: true },
      middleName: { type: String, trim: true },
      lastName: { type: String, trim: true },
    },
    locationInfo: {
      state: { type: String, trim: true },
      district: { type: String, trim: true },
      municipality: { type: String, trim: true },
    },
    farmInfo: {
      farmerType: { type: String, trim: true },
      farmingScale: { type: String, trim: true },
    },
    loginCredentials: {
      email: { type: String, lowercase: true, trim: true },
      password: { type: String },
    },
    currentStep: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      expires: 0, // MongoDB TTL - automatically delete after expiry
    },
  },
  {
    timestamps: true,
  },
);

export const TempRegistration = mongoose.model<ITempRegistration>(
  'TempRegistration',
  TempRegistrationSchema,
);
