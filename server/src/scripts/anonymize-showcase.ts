/**
 * anonymize-showcase.ts
 *
 * PURPOSE: Prepare the live MongoDB database for public showcase by:
 *   1. Archiving real data into *_archive collections (safe, preserved, untouched)
 *   2. Replacing PII in the active collections with sequential labels:
 *      - Teams  → "Team 1", "Team 2" ...
 *      - Players → "Player 101", "Player 102" ... (unique across all teams)
 *      - Users  → "User 1", "User 2" ...
 *      - Comments authors → "User N" matching their index
 *
 * IDs (numeric id / memberId) are NEVER changed, so all match stats,
 * goals, and votes remain intact and fully functional.
 *
 * RUN: npx tsx src/scripts/anonymize-showcase.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Aborting.');
    process.exit(1);
}

// ─── Archive Helper ───────────────────────────────────────────────────────────

async function archiveCollection(db: mongoose.mongo.Db, collectionName: string): Promise<void> {
    const archiveName = `${collectionName}_archive`;
    const existing = await db.listCollections({ name: archiveName }).toArray();
    if (existing.length > 0) {
        console.log(`⚠️  Archive '${archiveName}' already exists — skipping to protect prior backup.`);
        return;
    }
    const docs = await db.collection(collectionName).find({}).toArray();
    if (docs.length === 0) {
        console.log(`ℹ️  '${collectionName}' is empty — no archive needed.`);
        return;
    }
    await db.collection(archiveName).insertMany(docs);
    console.log(`✅ Archived ${docs.length} docs → '${archiveName}'`);
}

// ─── Anonymizers ──────────────────────────────────────────────────────────────

async function anonymizeTeams(db: mongoose.mongo.Db): Promise<void> {
    const teams = await db.collection('teams').find({}).toArray();
    console.log(`\n🔄 Anonymizing ${teams.length} teams...`);

    // Global player counter so each player gets a unique label (101, 102 ...)
    let playerCounter = 101;

    for (let ti = 0; ti < teams.length; ti++) {
        const team = teams[ti];
        const teamLabel = `Team ${ti + 1}`;

        const anonymizedPlayers = (team.players ?? []).map((player: any) => {
            const label = `Player ${playerCounter++}`;
            return {
                ...player,
                firstName: label,
                lastName: '',
                nickname: label,
                head_photo: '',
                pending_head_photo: '',
                bio: '',
                personalId: undefined,
                birthYear: undefined,
            };
        });

        await db.collection('teams').updateOne(
            { _id: team._id },
            {
                $set: {
                    name: teamLabel,
                    players: anonymizedPlayers,
                    logoUrl: '',
                },
            }
        );
    }

    console.log(`✅ Teams anonymized.`);
}

async function anonymizeUsers(db: mongoose.mongo.Db): Promise<void> {
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n🔄 Anonymizing ${users.length} users...`);

    for (let ui = 0; ui < users.length; ui++) {
        const user = users[ui];
        const label = `User ${ui + 1}`;
        const placeholderEmail = `user${ui + 1}@showcase.local`;

        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    displayName: label,
                    email: placeholderEmail,
                    avatarUrl: '',
                    googlePictureUrl: '',
                },
                $unset: {
                    username: '',
                    googleId: '',
                    password: '',
                    verificationToken: '',
                    verificationTokenExpires: '',
                },
            }
        );
    }

    console.log(`✅ Users anonymized.`);
}

async function anonymizeComments(db: mongoose.mongo.Db): Promise<void> {
    const comments = await db.collection('comments').find({}).toArray();
    console.log(`\n🔄 Anonymizing ${comments.length} comments...`);

    for (let ci = 0; ci < comments.length; ci++) {
        await db.collection('comments').updateOne(
            { _id: comments[ci]._id },
            { $set: { author: `User ${(ci % 50) + 1}` } }  // recycle labels for large sets
        );
    }

    console.log(`✅ Comments anonymized.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db!;
    console.log('✅ Connected.\n');

    console.log('📦 Archiving real data into *_archive collections...');
    await archiveCollection(db, 'teams');
    await archiveCollection(db, 'users');
    await archiveCollection(db, 'comments');

    console.log('\n🕵️  Replacing PII with sequential labels...');
    await anonymizeTeams(db);
    await anonymizeUsers(db);
    await anonymizeComments(db);

    console.log('\n🎉 Showcase database ready.');
    console.log('   Real data preserved in: teams_archive, users_archive, comments_archive');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

