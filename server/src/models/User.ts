import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'Admin' | 'Captain' | 'Player' | 'User' | 'admin';

export interface IMappedPlayerInfo {
    teamId: number;
    memberId: number;
    status: 'pending' | 'approved' | 'rejected';
}

export interface IPendingTeamRequest {
    teamName: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface IPlayerProfile {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    number?: number;
    position?: string;
    bio?: string;
}

export interface IUser extends Document {
    username?: string; // Kept for backward compatibility with old hardcoded admin
    email?: string;
    password?: string; // Kept as password instead of passwordHash for backward compat
    googleId?: string;
    displayName: string;
    avatarUrl?: string;
    googlePictureUrl?: string;
    role: UserRole;
    mappedPlayerInfo?: IMappedPlayerInfo;
    playerProfile?: IPlayerProfile; // Editable player info (custom or override of claimed slot)
    pendingTeamRequest?: IPendingTeamRequest;
    isVerified: boolean;
    verificationToken?: string;
    verificationTokenExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const mappedPlayerInfoSchema = new Schema<IMappedPlayerInfo>({
    teamId: { type: Number, required: true },
    memberId: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, { _id: false });

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        select: false
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },
    displayName: {
        type: String,
        default: 'Admin' // Default for backward compatibility
    },
    avatarUrl: {
        type: String
    },
    googlePictureUrl: {
        type: String
    },
    role: {
        type: String,
        enum: ['Admin', 'Captain', 'Player', 'User', 'admin'],
        default: 'User'
    },
    mappedPlayerInfo: {
        type: mappedPlayerInfoSchema,
        required: false
    },
    playerProfile: {
        type: new Schema({
            firstName: { type: String, default: '' },
            lastName: { type: String, default: '' },
            nickname: { type: String, default: '' },
            number: { type: Number },
            position: { type: String, default: '' }
        }, { _id: false }),
        required: false
    },
    pendingTeamRequest: {
        type: new Schema({
            teamName: { type: String, required: true },
            description: { type: String, default: '' },
            status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
        }, { _id: false }),
        required: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        required: false
    },
    verificationTokenExpires: {
        type: Date,
        required: false
    }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);
