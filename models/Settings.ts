import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
    clothingStyle:{ type: String},
    location:{ type: String},
    temperatureScale: { type: String},
    hiTempThreshold: { type: Number},
    lowTempThreshold: { type: Number},
    humidityPreference:  { type: Number}
},{
    timestamps: true,
})

const Settings = mongoose.model('Settings',settingsSchema)

export default Settings