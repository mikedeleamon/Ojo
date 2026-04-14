import mongoose, { Document, Schema } from 'mongoose';

export interface IClothingArticle extends Document {
  clothingType:     string;
  topOrBottom?:     string;
  clothingCategory?:string;
  fabricType?:      string;
  color?:           string;
  isAccessory?:     boolean;
  isWristWear?:     boolean;
  isAnkleWear?:     boolean;
  merchant?:        string;
  imageUrl?:        string;
  name?:            string;
}

export const clothingArticleSchema = new Schema<IClothingArticle>({
  clothingType:     { type: String, required: true },
  topOrBottom:      { type: String },
  clothingCategory: { type: String },
  fabricType:       { type: String },
  color:            { type: String },
  isAccessory:      { type: Boolean, default: false },
  isWristWear:      { type: Boolean, default: false },
  isAnkleWear:      { type: Boolean, default: false },
  merchant:         { type: String },
  imageUrl:         { type: String },
  name:             { type: String },
}, { timestamps: true });

const ClothingArticle = mongoose.model<IClothingArticle>('ClothingArticle', clothingArticleSchema);
export default ClothingArticle;
