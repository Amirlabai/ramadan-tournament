import mongoose, { Schema, Document } from 'mongoose';


export interface ISeasonArchive extends Document {
  yearMonth: string; // e.g. "2026-03"
  displayName: string; // e.g. "רמדאן 2026"
  winner: {
    teamId: number;
    name: string;
    logoUrl?: string;
  };
  topScorer: {
    memberId: number;
    name: string;
    teamName: string;
    goals: number;
  };
  mvp?: {
    memberId: number;
    name: string;
    teamName: string;
  };
  standings: any[];
  topScorers: any[];
  playoffs: any[];
  summary?: string;
  createdAt: Date;
}

const seasonArchiveSchema = new Schema<ISeasonArchive>({
  yearMonth: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  winner: {
    teamId: { type: Number, required: true },
    name: { type: String, required: true },
    logoUrl: { type: String }
  },
  topScorer: {
    memberId: { type: Number, required: true },
    name: { type: String, required: true },
    teamName: { type: String, required: true },
    goals: { type: Number, required: true }
  },
  mvp: {
    memberId: { type: Number },
    name: { type: String },
    teamName: { type: String }
  },
  standings: { type: Schema.Types.Mixed, required: true },
  topScorers: { type: Schema.Types.Mixed, required: true },
  playoffs: { type: Schema.Types.Mixed, default: [] },
  summary: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const SeasonArchive = mongoose.model<ISeasonArchive>('SeasonArchive', seasonArchiveSchema);
