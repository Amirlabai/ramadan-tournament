import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const migrate = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) throw new Error('MONGODB_URI not found in environment');

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        // Update all users who don't have isVerified field or have it as false
        // and who aren't Google users (though updating Google users doesn't hurt)
        const result = await User.updateMany(
            { isVerified: { $exists: false } },
            { $set: { isVerified: true } }
        );

        console.log(`Migration complete. Updated ${result.modifiedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
