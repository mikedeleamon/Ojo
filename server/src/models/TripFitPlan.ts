import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A saved TripFit outfit plan. Distinct from the `Trip` model, which stores
 * Gmail-imported airline confirmations. A TripFitPlan is the user's packing /
 * day-by-day outfit plan for a destination + date range, built from their
 * closet. Outfits are stored as article IDs plus a compact forecast snapshot
 * so documents stay small and rehydrate from the live closet on open.
 *
 * `days` is empty while a trip is `pending` — i.e. it was saved while still
 * beyond the 10-day forecast window and has no outfits generated yet.
 */

export interface ITripFitDay {
  date:             string;   // ISO yyyy-mm-dd
  minTempF:         number;
  maxTempF:         number;
  dayPhrase:        string;   // WeatherKit conditionCode
  hasPrecipitation: boolean;
  articleIds:       string[]; // chosen outfit's article IDs for this day
}

export interface ITripFitPlan extends Document {
  userId:               Types.ObjectId;
  clientId:             string;   // client-generated id — used for dedup/sync
  name?:                string;   // optional nickname e.g. "Honeymoon in Rome"
  destination:          string;
  lat:                  number;
  lon:                  number;
  startDate:            string;   // ISO yyyy-mm-dd
  endDate:              string;   // ISO yyyy-mm-dd
  occasion:             string;
  closetId:             string;   // closet the plan was built from
  days:                 ITripFitDay[];
  checkedIds:           string[]; // packed article IDs
  forecastFetchedAt?:   string;   // ISO timestamp of the forecast snapshot
  sourceAirlineTripId?: string;   // links back to a Gmail/airline Trip if seeded from one
}

const daySchema = new Schema<ITripFitDay>(
  {
    date:             { type: String, required: true },
    minTempF:         { type: Number, required: true },
    maxTempF:         { type: Number, required: true },
    dayPhrase:        { type: String, default: '' },
    hasPrecipitation: { type: Boolean, default: false },
    articleIds:       { type: [String], default: [] },
  },
  { _id: false },
);

const tripFitPlanSchema = new Schema<ITripFitPlan>(
  {
    userId:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId:            { type: String, required: true },
    name:                { type: String },
    destination:         { type: String, required: true },
    lat:                 { type: Number, required: true },
    lon:                 { type: Number, required: true },
    startDate:           { type: String, required: true },
    endDate:             { type: String, required: true },
    occasion:            { type: String, default: 'everyday' },
    closetId:            { type: String, default: '' },
    days:                { type: [daySchema], default: [] },
    checkedIds:          { type: [String], default: [] },
    forecastFetchedAt:   { type: String },
    sourceAirlineTripId: { type: String },
  },
  { timestamps: true },
);

// Upcoming-first timeline queries
tripFitPlanSchema.index({ userId: 1, startDate: 1 });
// One document per client-generated id (sync dedup / idempotent upsert)
tripFitPlanSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export default mongoose.model<ITripFitPlan>('TripFitPlan', tripFitPlanSchema);
