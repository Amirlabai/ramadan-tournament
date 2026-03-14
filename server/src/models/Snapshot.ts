import mongoose, { Schema, Document } from 'mongoose';

export interface ISnapshot extends Document {
    standings: object[];
    topScorers: object[];
    savedAt: Date;
}

const snapshotSchema = new Schema<ISnapshot>({
    standings: { type: [Schema.Types.Mixed], required: true },
    topScorers: { type: [Schema.Types.Mixed], required: true },
    savedAt: { type: Date, default: Date.now },
});

export const Snapshot = mongoose.model<ISnapshot>('stats_snapshot', snapshotSchema);
