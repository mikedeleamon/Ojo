import mongoose, { Document, Schema, Types } from 'mongoose';

// ML-ranker instrumentation (2026-07). All optional: entries logged by older
// clients (and Trip Mode logs) simply lack them. `swap_rejected` negatives are
// reserved for the future "Try This Instead" feature.
export interface IWearContext {
  feelsLikeF:      number;
  bucket:          string;
  precipIntensity: string;
  humidity:        number;
  windMph:         number;
  isSnowing:       boolean;
  hourOfDay:       number;
  occasion?:       string;
  styles?:         string[];
}

export interface IWearEngineMeta {
  score:         number;
  breakdown:     { fabric: number; color: number; style: number; simplicity: number; preference: number };
  rank:          number;
  engineVersion: number;
}

export interface IWearNegative {
  articleIds: string[];
  score:      number;
  source:     'shown_not_worn' | 'swap_rejected';
}

export interface IOutfitHistory extends Document {
  userId:         Types.ObjectId;
  clientId:       string;   // client-generated id — used for deduplication
  wornAt:         Date;
  closetId:       string;
  closetName:     string;
  articleIds:     string[];
  articleSummary: string;
  context?:       IWearContext;
  engine?:        IWearEngineMeta;
  negatives?:     IWearNegative[];
}

const wearContextSchema = new Schema<IWearContext>({
  feelsLikeF:      { type: Number,   required: true },
  bucket:          { type: String,   required: true },
  precipIntensity: { type: String,   required: true },
  humidity:        { type: Number,   required: true },
  windMph:         { type: Number,   required: true },
  isSnowing:       { type: Boolean,  required: true },
  hourOfDay:       { type: Number,   required: true },
  occasion:        { type: String },
  styles:          { type: [String] },
}, { _id: false });

const wearEngineMetaSchema = new Schema<IWearEngineMeta>({
  score:         { type: Number, required: true },
  breakdown:     {
    fabric:     { type: Number, required: true },
    color:      { type: Number, required: true },
    style:      { type: Number, required: true },
    simplicity: { type: Number, required: true },
    preference: { type: Number, required: true },
  },
  rank:          { type: Number, required: true },
  engineVersion: { type: Number, required: true },
}, { _id: false });

const wearNegativeSchema = new Schema<IWearNegative>({
  articleIds: { type: [String], required: true },
  score:      { type: Number, required: true },
  source:     { type: String, enum: ['shown_not_worn', 'swap_rejected'], required: true },
}, { _id: false });

const outfitHistorySchema = new Schema<IOutfitHistory>({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId:       { type: String, required: true },
  wornAt:         { type: Date, required: true },
  closetId:       { type: String, required: true },
  closetName:     { type: String, required: true },
  articleIds:     { type: [String], default: [] },
  articleSummary: { type: String, default: '' },
  context:        { type: wearContextSchema,    required: false },
  engine:         { type: wearEngineMetaSchema, required: false },
  negatives:      { type: [wearNegativeSchema], required: false },
});

// Fast timeline queries and uniqueness guard
outfitHistorySchema.index({ userId: 1, wornAt: -1 });
outfitHistorySchema.index({ userId: 1, clientId: 1 }, { unique: true });
// Auto-expire entries older than 3 years so storage cost stays bounded at scale
outfitHistorySchema.index({ wornAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 3 });

export default mongoose.model<IOutfitHistory>('OutfitHistory', outfitHistorySchema);
