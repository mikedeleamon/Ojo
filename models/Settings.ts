import mongoose from 'mongoose';

export const settingsSchema = new mongoose.Schema({
  clothingStyle:      { type: String, default: 'Casual' },
  location:           { type: String, default: '' },
  temperatureScale:   { type: String, default: 'Imperial' },
  hiTempThreshold:    { type: Number, default: 85 },
  lowTempThreshold:   { type: Number, default: 50 },
  humidityPreference: { type: Number, default: 70 },
}, { timestamps: true });

// Standalone model kept for potential future use (settings embedded in User are the source of truth)
const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
