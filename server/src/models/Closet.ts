import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IArticle extends Document {
  _id: Types.ObjectId;
  clothingType: string;
  name?: string;
  topOrBottom?: string;
  clothingCategory?: string;
  fabricType?: string;
  color?: string;
  isAccessory?: boolean;
  isWristWear?: boolean;
  isAnkleWear?: boolean;
  merchant?: string;
  imageUrl?: string;
  createdAt?: Date;
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
  clothingCategory: { type: String },
  fabricType:       { type: String },
  color:            { type: String },
  isAccessory:      { type: Boolean, default: false },
  isWristWear:      { type: Boolean, default: false },
  isAnkleWear:      { type: Boolean, default: false },
  merchant:         { type: String },
  imageUrl:         { type: String },
}, { timestamps: true });

const closetSchema = new Schema<ICloset>({
  name:        { type: String, required: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  articles:    { type: [articleSchema], default: [] },
  isPreferred: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<ICloset>('Closet', closetSchema);
