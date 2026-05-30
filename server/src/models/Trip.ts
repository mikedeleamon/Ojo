import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITrip extends Document {
  userId:             Types.ObjectId;
  airline:            string;
  confirmationNumber: string;
  departureDate:      Date;
  returnDate?:        Date;
  originAirport:      string;  // IATA code e.g. "JFK"
  destinationAirport: string;  // IATA code e.g. "LAX"
  destinationCity:    string;
  source:             'gmail' | 'manual';
  gmailMessageId?:    string;  // used for dedup
  lastSyncedAt?:      Date;
}

const tripSchema = new Schema<ITrip>(
  {
    userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    airline:            { type: String, required: true },
    confirmationNumber: { type: String, default: '' },
    departureDate:      { type: Date, required: true },
    returnDate:         { type: Date },
    originAirport:      { type: String, required: true },
    destinationAirport: { type: String, required: true },
    destinationCity:    { type: String, default: '' },
    source:             { type: String, enum: ['gmail', 'manual'], default: 'manual' },
    gmailMessageId:     { type: String },
    lastSyncedAt:       { type: Date },
  },
  { timestamps: true },
);

// Prevent importing the same Gmail message twice
tripSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true, sparse: true });
// Prevent duplicate manual entries with same confirmation code
tripSchema.index({ userId: 1, confirmationNumber: 1 }, { unique: true, sparse: true });

export default mongoose.model<ITrip>('Trip', tripSchema);
