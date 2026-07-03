import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOutfitHistory extends Document {
  userId:         Types.ObjectId;
  clientId:       string;   // client-generated id — used for deduplication
  wornAt:         Date;
  closetId:       string;
  closetName:     string;
  articleIds:     string[];
  articleSummary: string;
}

const outfitHistorySchema = new Schema<IOutfitHistory>({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId:       { type: String, required: true },
  wornAt:         { type: Date, required: true },
  closetId:       { type: String, required: true },
  closetName:     { type: String, required: true },
  articleIds:     { type: [String], default: [] },
  articleSummary: { type: String, default: '' },
});

// Fast timeline queries and uniqueness guard
outfitHistorySchema.index({ userId: 1, wornAt: -1 });
outfitHistorySchema.index({ userId: 1, clientId: 1 }, { unique: true });
// Auto-expire entries older than 3 years so storage cost stays bounded at scale
outfitHistorySchema.index({ wornAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 3 });

export default mongoose.model<IOutfitHistory>('OutfitHistory', outfitHistorySchema);
