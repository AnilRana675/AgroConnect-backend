import mongoose, { Document, Schema } from 'mongoose';

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

export const User = mongoose.model<IUser>('User', UserSchema);
