import mongoose from "mongoose";

const clothSchema = new mongoose.Schema({
    clothingType:{
        type: String,
        required: true,
    },
    topOrBottom:{
        type: String,
    },
    clothingCategory:{
        type: String,
    },
    fabricType:{
        type: String,
    },
    color:{
        type: String,
    },
    isAccessory:{
        type:Boolean
    },
    isWristWear:{type:Boolean},
    isAnkleWear:{type:Boolean},
    merchant:{
        type: String,
    }
},{
    timestamps: true,
})

const ClothingArticle = mongoose.model('ClothingArticle',clothSchema)

export default ClothingArticle