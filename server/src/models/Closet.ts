import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IArticle extends Document {
  _id: Types.ObjectId;
  clothingType: string;
  name?: string;
  topOrBottom?: string;
  clothingCategory?: string;
  clothingCategories?: string[];
  fabricType?: string;
  color?: string;
  gender?: string;
  isAccessory?: boolean;
  isWristWear?: boolean;
  isAnkleWear?: boolean;
  merchant?: string;
  purchasePrice?: number;
  imageUrl?: string;
  createdAt?: Date;
  /** The classifier's original guess, preserved alongside the (possibly
   *  user-corrected) clothingType — without this, "the user fixed a
   *  misdetection" is indistinguishable from "the AI happened to be right,"
   *  and the training-data flywheel this enables has nothing to read.
   *  Already whitelisted in routes/closets.ts; was silently dropped here. */
  detectedGarmentType?: string;
  identificationConfidence?: number;
}

export interface ICloset extends Document {
  name: string;
  userId: Types.ObjectId;
  articles: Types.DocumentArray<IArticle>;
  isPreferred: boolean;
  createdAt?: Date;
}

const articleSchema = new Schema<IArticle>({
  clothingType:     { type: String, required: true },
  name:             { type: String },
  topOrBottom:      { type: String },
  clothingCategory:   { type: String },
  clothingCategories: { type: [String], default: undefined },
  fabricType:       { type: String },
  color:            { type: String },
  gender:           { type: String, enum: ["Men's", "Women's", 'Unisex'], default: 'Unisex' },
  isAccessory:      { type: Boolean, default: false },
  isWristWear:      { type: Boolean, default: false },
  isAnkleWear:      { type: Boolean, default: false },
  merchant:         { type: String },
  purchasePrice:    { type: Number },
  imageUrl:         { type: String },
  detectedGarmentType:      { type: String },
  identificationConfidence: { type: Number },
}, { timestamps: true });

const closetSchema = new Schema<ICloset>({
  name:        { type: String, required: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  articles:    { type: [articleSchema], default: [] },
  isPreferred: { type: Boolean, default: false },
}, { timestamps: true });

closetSchema.index({ userId: 1 });

export default mongoose.model<ICloset>('Closet', closetSchema);
