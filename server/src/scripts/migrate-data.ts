import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/env';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { Match } from '../models/Match';
import { News } from '../models/News';

const dataDir = path.join(__dirname, '..', '..', '..', 'data');

async function migrateData() {
    try {
        console.log('🔧 Starting data migration...');

        // Connect to MongoDB
        await mongoose.connect(config.mongoUri);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Team.deleteMany({});
        await Match.deleteMany({});
        await News.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create admin user
        const hashedPassword = await bcrypt.hash(config.adminPassword, 10);
        const admin = new User({
            username: config.adminUsername,
            password: hashedPassword,
            role: 'admin',
        });
        await admin.save();
        console.log(`✅ Created admin user: ${config.adminUsername}`);

        // Import teams with player mapping
        const teamsData = JSON.parse(
            fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf-8')
        );
        const teamsWithPlayers = teamsData.map((team: any) => ({
            id: team.id,
            name: team.name,
            players: team.members.map((member: any) => {
                // Split name into first and last (if possible)
                const nameParts = member.name.split(' ');
                const firstName = nameParts[0] || member.nickname || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                return {
                    memberId: member.id,
                    firstName,
                    lastName,
                    nickname: member.nickname || '',
                    number: member.number,
                    position: member.position || '',
                    isCaptain: member.is_captain || false,
                };
            }),
        }));
        await Team.insertMany(teamsWithPlayers);
        console.log(`✅ Imported ${teamsWithPlayers.length} teams with ${teamsWithPlayers.reduce((sum: number, t: any) => sum + t.players.length, 0)} players`);

        // Import matches
        const matchesData = JSON.parse(
            fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf-8')
        );
        const matchesWithDates = matchesData.map((match: any) => ({
            id: match.id,
            date: new Date(match.date),
            location: match.location,
            phase: match.phase,
            team1Id: match.team1_id,  // Map snake_case to camelCase
            team2Id: match.team2_id,  // Map snake_case to camelCase
            score1: match.score1,
            score2: match.score2,
            goals: match.goals || [],
        }));
        await Match.insertMany(matchesWithDates);
        console.log(`✅ Imported ${matchesData.length} matches`);

        // Import news
        const newsData = JSON.parse(
            fs.readFileSync(path.join(dataDir, 'news.json'), 'utf-8')
        );
        const newsWithDates = newsData.map((item: any) => ({
            ...item,
            date: new Date(item.date),
        }));
        await News.insertMany(newsWithDates);
        console.log(`✅ Imported ${newsData.length} news items`);

        console.log('✨ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateData();
