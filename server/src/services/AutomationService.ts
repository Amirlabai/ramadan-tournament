import { GoogleGenerativeAI } from '@google/generative-ai';
import { StatsService, StandingsEntry, TopScorer } from './StatsService';
import { Snapshot } from '../models/Snapshot';
import { News } from '../models/News';

export interface AutomationResult {
    status: 'no_changes' | 'posted' | 'error';
    message: string;
    newsId?: number;
}

export class AutomationService {
    // ── Snapshot persistence ──────────────────────────────────────────────

    static async loadLastSnapshot(): Promise<{ standings: StandingsEntry[]; topScorers: TopScorer[] } | null> {
        const doc = await Snapshot.findOne().sort({ savedAt: -1 });
        if (!doc) return null;
        return { standings: doc.standings as StandingsEntry[], topScorers: doc.topScorers as TopScorer[] };
    }

    static async saveSnapshot(standings: StandingsEntry[], topScorers: TopScorer[]): Promise<void> {
        await Snapshot.create({ standings, topScorers, savedAt: new Date() });
    }

    // ── Change detection ──────────────────────────────────────────────────

    static detectChanges(
        old: { standings: StandingsEntry[]; topScorers: TopScorer[] } | null,
        standings: StandingsEntry[],
        topScorers: TopScorer[]
    ): string[] {
        if (!old) {
            return ['נתוני הטורניר נשמרו לראשונה. סטטיסטיקות עדכניות זמינות.'];
        }

        const changes: string[] = [];

        // Standings changes
        const oldStandings: { [key: number]: StandingsEntry & { rank: number } } = {};
        old.standings.forEach((s, i) => { oldStandings[s.teamId] = { ...s, rank: i + 1 }; });

        standings.forEach((entry, i) => {
            const rank = i + 1;
            const oldEntry = oldStandings[entry.teamId];
            if (!oldEntry) return;

            if (entry.points !== oldEntry.points) {
                const diff = entry.points - oldEntry.points;
                changes.push(
                    `קבוצת ${entry.teamName} הוסיפה ${diff} נקודות ועומדת על ${entry.points} נקודות (מקום #${rank})`
                );
            }
            if (rank !== oldEntry.rank) {
                changes.push(`קבוצת ${entry.teamName} זזה למקום #${rank} בטבלה`);
            }
        });

        // Top scorer changes
        const oldScorers: { [key: number]: TopScorer } = {};
        old.topScorers.forEach(s => { oldScorers[s.memberId] = s; });

        topScorers.forEach(scorer => {
            const oldScorer = oldScorers[scorer.memberId];
            if (!oldScorer) return;
            if (scorer.goals !== oldScorer.goals) {
                const newGoals = scorer.goals - oldScorer.goals;
                const suffix = newGoals > 1 ? 'ים' : '';
                changes.push(
                    `${scorer.playerName} מ${scorer.teamName} כבש ${newGoals} שער${suffix} ועומד על ${scorer.goals} שערים`
                );
            }
        });

        return changes;
    }

    // ── Gemini summary ────────────────────────────────────────────────────

    static async generateSummary(changes: string[]): Promise<string> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const bullets = changes.map(c => `- ${c}`).join('\n');
        const prompt =
            'אתה כתב ספורט בטורניר כדורגל. ' +
            'תאר את השינויים הבאים בעברית קצרה וישירה — 2 עד 3 משפטים בלבד. ' +
            'כתוב בסגנון ניוז-פלאש, ללא הקדמות. ודא שהמשפטים מופרדים בנקודה.\n\n' +
            `שינויים:\n${bullets}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (!text) throw new Error('Gemini returned an empty response');

        const parts = text.split('.').map(s => s.trim()).filter(Boolean);
        return parts.join('.\n') + '.';
    }

    // ── News write ────────────────────────────────────────────────────────

    static async postNews(summary: string): Promise<number> {
        const last = await News.findOne().sort({ id: -1 });
        const nextId = (last?.id ?? 0) + 1;

        const now = new Date();
        await News.create({
            id: nextId,
            title: 'עדכון טורניר',
            message: summary,
            date: now,
            priority: 'normal',
            createdAt: now,
        });

        return nextId;
    }

    // ── Main entry ────────────────────────────────────────────────────────

    static async run(): Promise<AutomationResult> {
        console.log('[AutomationService] Starting stats automation run…');

        try {
            const standings = await StatsService.calculateStandings();
            const topScorers = (await StatsService.calculateTopScorers()).slice(0, 5);

            const lastSnapshot = await AutomationService.loadLastSnapshot();
            const changes = AutomationService.detectChanges(lastSnapshot, standings, topScorers);

            if (changes.length === 0) {
                console.log('[AutomationService] No changes detected. Saving snapshot.');
                await AutomationService.saveSnapshot(standings, topScorers);
                return { status: 'no_changes', message: 'אין שינויים חדשים בסטטיסטיקות.' };
            }

            console.log(`[AutomationService] ${changes.length} change(s) detected.`);

            const summary = await AutomationService.generateSummary(changes);
            console.log('[AutomationService] Summary generated:', summary);

            const newsId = await AutomationService.postNews(summary);
            await AutomationService.saveSnapshot(standings, topScorers);

            console.log(`[AutomationService] News posted with id=${newsId}`);
            return { status: 'posted', message: summary, newsId };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[AutomationService] Error:', msg);
            return { status: 'error', message: msg };
        }
    }
}
