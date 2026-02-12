import mongoose, { Schema, Document } from 'mongoose';

export interface IGoal {
    memberId: number;
    minute: number;
}

export interface IMatch extends Document {
    id: number;
    date: Date;
    location: string;
    phase: 'group' | 'knockout';
    team1Id: number;
    team2Id: number;
    score1: number;
    score2: number;
    goals: IGoal[];
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const goalSchema = new Schema<IGoal>({
    memberId: { type: Number, required: true },
    minute: { type: Number, required: true },
}, { _id: false });

const matchSchema = new Schema<IMatch>({
    id: {
        type: Number,
        required: true,
        unique: true,
    },
    date: {
        type: Date,
        required: true,
    },
    location: {
        type: String,
        required: true,
        trim: true,
    },
    phase: {
        type: String,
        enum: ['group', 'knockout'],
        default: 'group',
    },
    team1Id: {
        type: Number,
        required: true,
    },
    team2Id: {
        type: Number,
        required: true,
    },
    score1: {
        type: Number,
        default: 0,
    },
    score2: {
        type: Number,
        default: 0,
    },
    goals: [goalSchema],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Match = mongoose.model<IMatch>('Match', matchSchema);
