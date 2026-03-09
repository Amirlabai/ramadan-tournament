import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
    isCaptain: boolean;
    head_photo?: string;
    pending_head_photo?: string;
    bio?: string;
    personalId?: string;
    birthYear?: number;
}

export interface ITeam extends Document {
    id: number;
    name: string;
    players: IPlayer[];
    logoUrl?: string;
    logoPosition?: 'left' | 'right' | 'none';
    createdAt: Date;
}

const playerSchema = new Schema<IPlayer>({
    memberId: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' },  // Optional - many players have single names
    nickname: { type: String, default: '' },
    number: { type: Number, required: true },
    position: { type: String, default: '' },
    isCaptain: { type: Boolean, default: false },
    head_photo: { type: String, default: '' },
    pending_head_photo: { type: String, default: '' },
    bio: { type: String, default: '' },
    personalId: { type: String, select: false }, // Protected field
    birthYear: { type: Number },
}, { _id: false });

const teamSchema = new Schema<ITeam>({
    id: {
        type: Number,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    players: [playerSchema],
    logoUrl: { type: String, default: '' },
    logoPosition: { type: String, enum: ['left', 'right', 'none'], default: 'right' },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Team = mongoose.model<ITeam>('Team', teamSchema);
