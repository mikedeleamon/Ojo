import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings {
  clothingStyle: string;
  location: string;
  // Coordinates of `location`, resolved client-side via expo-location and
  // pushed up so the notification cron jobs can call WeatherKit directly
  // without re-geocoding every tick.
  lat?: number;
  lon?: number;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
  gender?: string;
  // Extra cities the user switches the weather HUD between. Synced so the list
  // follows them across devices; weather payloads themselves stay client-side.
  savedLocations?: ISavedLocation[];
  // Trip Mode — surface a saved trip's logged outfit when the user is there.
  tripModeEnabled?: boolean;
  tripModeRadiusMi?: number;
}

export interface ISavedLocation {
  id: string;
  name: string;
  query: string;
  lat: number;
  lon: number;
  createdAt: string;
  updatedAt: string;
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

export interface IMorningSnapshot {
  hasPrecipitation: boolean;
  tempF: number;
  recordedAt: Date;
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
  tokenVersion: number;
  lastMorningSnapshot?: IMorningSnapshot;
  // Gmail integration (Trip Planner)
  googleRefreshToken?: string;
  googleConnectedAt?: Date;
  // Forgot-password flow — only the SHA-256 hash of the reset token is stored
  resetPasswordTokenHash?: string;
  resetPasswordExpires?: Date;
  // Sign in with Apple — Apple's stable per-app `sub` claim, used to find or
  // link the local account. Indexed sparse so accounts that haven't used SIWA
  // don't collide on a missing value.
  appleSub?: string;
  // Sign in with Google — Google's stable `sub` claim. Same find/link/create
  // strategy as appleSub. Sparse-unique so non-Google accounts don't collide.
  googleSub?: string;
  // Tombstone for cross-device history clears: any local entry worn before this
  // timestamp is dropped during merge so a device that was offline when another
  // device cleared history doesn't re-upload stale entries.
  historyLastClearedAt?: Date;
}

const savedLocationSchema = new Schema<ISavedLocation>({
  id:        { type: String, required: true },
  name:      { type: String, required: true },
  query:     { type: String, required: true },
  lat:       { type: Number, required: true },
  lon:       { type: Number, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { _id: false });

const settingsSchema = new Schema<ISettings>({
  clothingStyle:      { type: String, default: '' },
  location:           { type: String, default: '' },
  lat:                { type: Number },
  lon:                { type: Number },
  temperatureScale:   { type: String, default: 'Imperial' },
  hiTempThreshold:    { type: Number, default: 85 },
  lowTempThreshold:   { type: Number, default: 50 },
  humidityPreference: { type: Number, default: 60 },
  gender:             { type: String, enum: ["Men's", "Women's", "All"], default: 'All' },
  savedLocations:     { type: [savedLocationSchema], default: [] },
  tripModeEnabled:    { type: Boolean, default: true },
  tripModeRadiusMi:   { type: Number,  default: 30 },
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

const morningSnapshotSchema = new Schema<IMorningSnapshot>({
  hasPrecipitation: { type: Boolean, required: true },
  tempF:            { type: Number,  required: true },
  recordedAt:       { type: Date,    required: true },
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
  tokenVersion:         { type: Number, default: 0 },
  lastMorningSnapshot:  { type: morningSnapshotSchema },
  // Gmail integration (Trip Planner)
  googleRefreshToken:   { type: String, select: false }, // excluded from default queries
  googleConnectedAt:    { type: Date },
  // Password reset — token hash never leaves the server
  resetPasswordTokenHash: { type: String, select: false },
  resetPasswordExpires:   { type: Date,   select: false },
  // Sign in with Apple — Apple's per-app `sub`. Unique sparse so users
  // without SIWA don't all collide on a missing field.
  appleSub:               { type: String, unique: true, sparse: true },
  // Sign in with Google — Google's `sub`. Unique sparse, same as appleSub.
  googleSub:              { type: String, unique: true, sparse: true },
  historyLastClearedAt:   { type: Date },
}, { timestamps: true });

export default mongoose.model<IUser>('User', userSchema);
