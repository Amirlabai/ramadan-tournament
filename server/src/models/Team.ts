import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
    isCaptain: boolean;
}

export interface ITeam extends Document {
    id: number;
    name: string;
    players: IPlayer[];
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
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Team = mongoose.model<ITeam>('Team', teamSchema);
