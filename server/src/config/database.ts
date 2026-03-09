import mongoose from 'mongoose';
import { config } from './env';

export const connectDatabase = async (): Promise<void> => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('✅ MongoDB connected successfully');

        // Drop the legacy non-sparse username index so Mongoose recreates it as sparse.
        // This fixes E11000 duplicate key { username: null } for Google OAuth users.
        try {
            await mongoose.connection.collection('users').dropIndex('username_1');
            console.log('ℹ️ Dropped legacy username_1 index — will be recreated as sparse.');
        } catch (e: any) {
            // Index already dropped or doesn't exist — that's fine
            if (e.codeName !== 'IndexNotFound') {
                console.warn('⚠️ Index drop warning:', e.message);
            }
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});
