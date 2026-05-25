import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserPreferences extends Document {
  userId:       Types.ObjectId;
  colors:       Record<string, number>;
  fabrics:      Record<string, number>;
  categories:   Record<string, number>;
  colorPairs:   Record<string, number>;
  totalOutfits: number;
}

const userPreferencesSchema = new Schema<IUserPreferences>({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  colors:       { type: Schema.Types.Mixed, default: {} },
  fabrics:      { type: Schema.Types.Mixed, default: {} },
  categories:   { type: Schema.Types.Mixed, default: {} },
  colorPairs:   { type: Schema.Types.Mixed, default: {} },
  totalOutfits: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);
