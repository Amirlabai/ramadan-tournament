import mongoose, { Schema, Document } from 'mongoose';

export interface IVote extends Document {
    userId: mongoose.Types.ObjectId;
    playerMemberId: number;
    category: string;
    createdAt: Date;
}

const voteSchema = new Schema<IVote>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    playerMemberId: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        default: 'mvp',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index ensuring one user can only vote once per category
voteSchema.index({ userId: 1, category: 1 }, { unique: true });

export const Vote = mongoose.model<IVote>('Vote', voteSchema);
