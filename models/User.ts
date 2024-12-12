import mongoose from "mongoose";
import Settings from "./Settings";

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true, // Makes this field mandatory
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email address'], // Regex for email validation
    },
    password: {
        type: String,
        required: true,
        minlength: 8, // Minimum length validation
    },
    birthday: {
        type: Date,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    Settings: {
        type: Settings,
        default: {clothingStyle: 'Business Casual',
            location: 'New York',
            temperatureScale: 'F',
            hiTempThreshold: 83,
            lowTempThreshold: 54,
            humidityPreference: 50}
    },
}, {
    timestamps: true,
});

// Create the model
const User = mongoose.model('User', userSchema);

// Export the model
export default User;