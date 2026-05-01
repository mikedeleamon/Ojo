import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings {
  clothingStyle: string;
  location: string;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
}

export interface INotificationSettings {
  morningBriefEnabled:    boolean;
  morningBriefHourUTC:    number;
  weatherChangeEnabled:   boolean;
  tempSwingEnabled:       boolean;
  tempSwingThresholdF:    number;
  closetGapEnabled:       boolean;
  weeklyRecapEnabled:     boolean;
  weeklyRecapDay:         number;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  birthday: string;
  settings: ISettings;
  pushToken?: string;
  notificationSettings: INotificationSettings;
}

const settingsSchema = new Schema<ISettings>({
  clothingStyle:      { type: String, default: '' },
  location:           { type: String, default: '' },
  temperatureScale:   { type: String, default: 'Imperial' },
  hiTempThreshold:    { type: Number, default: 85 },
  lowTempThreshold:   { type: Number, default: 50 },
  humidityPreference: { type: Number, default: 60 },
}, { _id: false });

const notificationSettingsSchema = new Schema<INotificationSettings>({
  morningBriefEnabled:  { type: Boolean, default: false },
  morningBriefHourUTC:  { type: Number,  default: 12 },
  weatherChangeEnabled: { type: Boolean, default: false },
  tempSwingEnabled:     { type: Boolean, default: false },
  tempSwingThresholdF:  { type: Number,  default: 20 },
  closetGapEnabled:     { type: Boolean, default: false },
  weeklyRecapEnabled:   { type: Boolean, default: false },
  weeklyRecapDay:       { type: Number,  default: 0 },
}, { _id: false });

const userSchema = new Schema<IUser>({
  firstName:            { type: String, required: true },
  lastName:             { type: String, required: true },
  username:             { type: String, required: true, unique: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String, required: true },
  birthday:             { type: String, default: '' },
  settings:             { type: settingsSchema, default: () => ({}) },
  pushToken:            { type: String },
  notificationSettings: { type: notificationSettingsSchema, default: () => ({}) },
}, { timestamps: true });

export default mongoose.model<IUser>('User', userSchema);
