/**
 * fix-member-ids.ts
 * 
 * Detects and repairs duplicate memberId values across teams.
 * 
 * Run with:  npx ts-node src/scripts/fix-member-ids.ts
 * 
 * By default runs in DRY-RUN mode (no writes). Pass --apply to commit changes.
 */

import mongoose from 'mongoose';
import { config } from '../config/env';
import { Team } from '../models/Team';
import { Match } from '../models/Match';

const DRY_RUN = !process.argv.includes('--apply');

async function run() {
    await mongoose.connect(config.mongoUri);
    console.log(`Connected. Running in ${DRY_RUN ? 'DRY-RUN' : 'APPLY'} mode.\n`);

    const teams = await Team.find();
    const matches = await Match.find();

    // Build a map: memberId → [{ teamId, teamName, player }]
    const idMap = new Map<number, { teamId: number; teamName: string; playerName: string }[]>();

    for (const team of teams) {
        for (const player of team.players) {
            const entry = { teamId: team.id, teamName: team.name, playerName: `${player.firstName} ${player.lastName}`.trim() || player.nickname };
            if (!idMap.has(player.memberId)) idMap.set(player.memberId, []);
            idMap.get(player.memberId)!.push(entry);
        }
    }

    // Find all duplicates
    const duplicates = [...idMap.entries()].filter(([, owners]) => owners.length > 1);

    if (duplicates.length === 0) {
        console.log('✅ No duplicate memberIds found. All clean!');
        await mongoose.disconnect();
        return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate memberId(s):\n`);
    for (const [id, owners] of duplicates) {
        console.log(`  memberId ${id} is shared by:`);
        for (const o of owners) console.log(`    → Team ${o.teamId} (${o.teamName}): ${o.playerName}`);
    }

    if (DRY_RUN) {
        console.log('\n🔒 DRY-RUN: no changes made. Re-run with --apply to fix.');
        await mongoose.disconnect();
        return;
    }

    // --- APPLY mode: reassign IDs to all but the first owner of each duplicate ---

    // Get current global max so new IDs are truly fresh
    const allIds = teams.flatMap(t => t.players.map(p => p.memberId || 0));
    let nextId = Math.max(...allIds) + 1;

    console.log(`\n🔧 Applying fixes. Starting new ID counter at: ${nextId}\n`);

    for (const [oldId, owners] of duplicates) {
        // Keep the first owner's ID; reassign every subsequent one
        const toFix = owners.slice(1);

        for (const owner of toFix) {
            const newId = nextId++;
            const team = teams.find(t => t.id === owner.teamId)!;
            const player = team.players.find(p => p.memberId === oldId)!;

            console.log(`  Reassigning ${owner.playerName} (Team: ${owner.teamName}): ${oldId} → ${newId}`);

            // Update player in team
            player.memberId = newId;
            team.markModified('players');
            await team.save();

            // Update any goal records in matches
            let goalsFixed = 0;
            for (const match of matches) {
                // Only fix goals that belong to THIS team's matches
                if (match.team1Id !== owner.teamId && match.team2Id !== owner.teamId) continue;

                for (const goal of match.goals) {
                    if (goal.memberId === oldId) {
                        goal.memberId = newId;
                        goalsFixed++;
                    }
                }
                match.markModified('goals');
                await match.save();
            }

            console.log(`    → Fixed ${goalsFixed} goal record(s) in matches.`);
        }
    }

    console.log('\n✅ All duplicates resolved.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
