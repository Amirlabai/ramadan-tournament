import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { PlayoffService } from './src/services/PlayoffService';
import { Match } from './src/models/Match';

dotenv.config();

async function verify() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected.');

        console.log('Running playoff sync...');
        await PlayoffService.syncPlayoffs();
        console.log('Sync complete.');

        const knockoutMatches = await Match.find({ id: { $gte: 1000 } }).sort({ id: 1 });
        console.log(`Found ${knockoutMatches.length} playoff matches.`);
        
        knockoutMatches.forEach(m => {
            console.log(`Match ${m.id}: Rank teams ${m.team1Id} vs ${m.team2Id} at ${m.date} in ${m.location}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
