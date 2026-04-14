import mongoose from 'mongoose';
import { settingsSchema } from './Settings';

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  username:  { type: String },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
  },
  password: { type: String, required: true, minlength: 8 },
  birthday:  { type: Date, required: true },
  isActive:  { type: Boolean, default: true },
  settings: {
    type: settingsSchema,
    default: {
      clothingStyle:      'Casual',
      location:           '',
      temperatureScale:   'Imperial',
      hiTempThreshold:    85,
      lowTempThreshold:   50,
      humidityPreference: 70,
    },
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
