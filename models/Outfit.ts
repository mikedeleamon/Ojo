import mongoose from "mongoose";
import ClothingArticle from "./ClothingArticle";

const outfitSchema = new mongoose.Schema({
    hat:{
        type: ClothingArticle
    },
    top:{
        type: [ClothingArticle]
    },
    bottom: {
        type: ClothingArticle
    },
    shoes:{
        type: ClothingArticle
    },
    accessories:{
        type: [ClothingArticle]
    },
})

const Outfit = mongoose.model('Outfit',outfitSchema)

export default Outfit