import mongoose, { Document, Schema } from 'mongoose';
import { clothingArticleSchema, IClothingArticle } from './ClothingArticle';

export interface ICloset extends Document {
  name:        string;
  userId:      mongoose.Types.ObjectId;
  articles:    IClothingArticle[];
  isPreferred: boolean;
}

const closetSchema = new Schema<ICloset>({
  name:        { type: String, required: true, trim: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  articles:    { type: [clothingArticleSchema], default: [] },
  isPreferred: { type: Boolean, default: false },
}, { timestamps: true });

const Closet = mongoose.model<ICloset>('Closet', closetSchema);
export default Closet;
