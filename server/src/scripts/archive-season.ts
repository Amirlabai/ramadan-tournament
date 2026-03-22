/**
 * archive-season.ts
 *
 * PURPOSE: 
 *   1. Full Stats Calculation (Winner, Standings, Top Scorers)
 *   2. Save "Public Exhibit" to SeasonArchive collection (for History page)
 *   3. Create timestamped backups (e.g. teams_2026_03)
 *   4. Anonymize active data for showcase
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StatsService } from '../services/StatsService';
import { SeasonArchive } from '../models/SeasonArchive';
import { Vote } from '../models/Vote';
import { Match } from '../models/Match';
import { Team } from '../models/Team';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI!;
const now = new Date();
const suffix = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
const displayName = `טורניר רמדאן ${now.getFullYear()}`;

async function archiveCollection(db: mongoose.mongo.Db, collectionName: string): Promise<void> {
    const archiveName = `${collectionName}_${suffix}`;
    const existing = await db.listCollections({ name: archiveName }).toArray();
    if (existing.length > 0) {
        console.log(`⚠️  Collection '${archiveName}' already exists — skipping backup.`);
        return;
    }
    const docs = await db.collection(collectionName).find({}).toArray();
    if (docs.length === 0) {
        console.log(`ℹ️  No data in '${collectionName}' to backup.`);
        return;
    }
    await db.collection(archiveName).insertMany(docs);
    console.log(`✅ Archived ${docs.length} docs → '${archiveName}'`);
}

async function createPublicArchive() {
    console.log('📊 Calculating final statistics for Public Archive...');
    const standings = await StatsService.calculateStandings();
    const topScorers = await StatsService.calculateTopScorers();
    
    // Fetch Playoff matches
    const playoffs = await Match.find({ phase: 'knockout' });
    console.log(`🏆 Found ${playoffs.length} playoff matches.`);

    // Calculate MVP from Votes
    console.log('🗳️  Calculating MVP from votes...');
    const mvpVotes = await Vote.aggregate([
        { $match: { category: 'mvp' } },
        { $group: { _id: '$playerMemberId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);

    let mvpData = undefined;
    if (mvpVotes.length > 0) {
        const mvpId = mvpVotes[0]._id;
        const teams = await Team.find({ 'players.memberId': mvpId });
        if (teams.length > 0) {
            const player = teams[0].players.find((p: any) => p.memberId === mvpId);
            if (player) {
                mvpData = {
                    memberId: mvpId,
                    name: `${player.firstName} ${player.lastName}`.trim() || player.nickname,
                    teamName: teams[0].name
                };
                console.log(`⭐ MVP identified: ${mvpData.name} (${mvpData.teamName})`);
            }
        }
    }

    if (standings.length === 0 && playoffs.length === 0) {
        console.log('⚠️  No data found. Skipping Public Archive creation.');
        return;
    }

    const winner = standings.find(s => s.played > 0) || standings[0];
    const topScorer = topScorers[0];

    await SeasonArchive.findOneAndUpdate(
        { yearMonth: suffix.replace('_', '-') },
        {
            yearMonth: suffix.replace('_', '-'),
            displayName,
            winner: winner ? {
                teamId: winner.teamId,
                name: winner.teamName,
                logoUrl: winner.logoUrl
            } : undefined,
            topScorer: topScorer ? {
                memberId: topScorer.memberId,
                name: topScorer.playerName,
                teamName: topScorer.teamName,
                goals: topScorer.goals
            } : undefined,
            mvp: mvpData,
            standings,
            topScorers,
            playoffs,
            createdAt: new Date()
        },
        { upsert: true, new: true }
    );
    console.log(`✅ Public SeasonArchive created/updated for ${suffix}.`);
}

async function anonymizeTeams(db: mongoose.mongo.Db): Promise<void> {
    const collections = await db.listCollections({ name: 'teams' }).toArray();
    if (collections.length === 0) {
        console.log('⚠️  Active "teams" collection not found. Skipping anonymization.');
        return;
    }

    const teams = await db.collection('teams').find({}).toArray();
    let playerCounter = 101;

    for (let ti = 0; ti < teams.length; ti++) {
        const team = teams[ti];
        const teamLabel = `Team ${ti + 1}`;
        const anonymizedPlayers = (team.players ?? []).map((player: any) => ({
            ...player,
            firstName: `Player ${playerCounter++}`,
            lastName: '',
            nickname: '',
            head_photo: '',
            bio: '',
            personalId: undefined,
        }));

        await db.collection('teams').updateOne(
            { _id: team._id },
            { $set: { name: teamLabel, players: anonymizedPlayers, logoUrl: '' } }
        );
    }
    console.log(`✅ Active Teams anonymized.`);
}

async function main() {
    console.log(`🚀 Starting Full Season Archiver [Season: ${suffix}]...`);
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db!;

    // Case: User manually renamed collections already
    const collections = await db.listCollections().toArray();
    const hasRenamedTeams = collections.some(c => c.name === `teams_${suffix}`);
    const hasActiveTeams = collections.some(c => c.name === 'teams');

    if (hasRenamedTeams && !hasActiveTeams) {
        console.log(`💡 Detected manual rename (teams_${suffix}). Restoring temporarily to calculate stats...`);
        await db.collection(`teams_${suffix}`).rename('teams');
    }
    
    const hasRenamedComments = collections.some(c => c.name === `comments_${suffix}`);
    const hasActiveComments = collections.some(c => c.name === 'comments');
    if (hasRenamedComments && !hasActiveComments) {
        await db.collection(`comments_${suffix}`).rename('comments');
    }

    // 1. Create the high-level summary for the History page
    // CRITICAL: We do this FIRST while the data is still REAL (not anonymized)
    await createPublicArchive();

    // 2. Create technical backups
    await archiveCollection(db, 'teams');
    await archiveCollection(db, 'comments');
    await archiveCollection(db, 'matches');

    // 3. Anonymize active teams for showcase
    console.log('🕵️  Anonymizing active data for showcase...');
    await anonymizeTeams(db);

    console.log('\n🎉 Archiving complete. Real names preserved in technical backups.');
    console.log(`   Public summary available in 'SeasonArchives' collection.`);
    await mongoose.disconnect();
}

main().catch(console.error);



