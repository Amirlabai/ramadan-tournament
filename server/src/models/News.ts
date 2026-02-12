import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
    id: number;
    title: string;
    message: string;
    date: Date;
    priority: 'normal' | 'high';
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const newsSchema = new Schema<INews>({
    id: {
        type: Number,
        required: true,
        unique: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    priority: {
        type: String,
        enum: ['normal', 'high'],
        default: 'normal',
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const News = mongoose.model<INews>('News', newsSchema);
