import { FormPreregAdminMissing } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { encryptPersonalId, storedPersonalIdLookupKey } from '../utils/personalIdCrypto';
import { validateFormIdentity, validatePersonalIdOnly } from '../utils/parseFormIdentityField';

export type PreregRole = 'captain' | 'goalkeeper' | 'player';

export type PreregEntry = {
  name: string;
  email?: string;
  personalId: string;
  birthYear: number;
  teamName: string;
  role: PreregRole;
};

export type PartialPreregEntry = {
  name: string;
  email?: string;
  personalId?: string;
  birthYear?: number;
  adminMissing: 'personal_id' | 'birth_year';
  teamName: string;
  role: PreregRole;
};

export type PreregAlertField = 'personal_id' | 'birth_year';

export type PreregEvaluation =
  | { kind: 'full_match'; entry: PreregEntry }
  | { kind: 'no_match' }
  | { kind: 'admin_missing'; field: PreregAlertField }
  | { kind: 'field_mismatch'; field: PreregAlertField };

type SeasonCache = {
  fullMap: Map<string, PreregEntry>;
  fullByPersonalId: Map<string, PreregEntry>;
  partialById: Map<string, PartialPreregEntry>;
  partialByBirthYear: Map<number, PartialPreregEntry[]>;
};

type SeasonCacheEntry = {
  cache: SeasonCache;
  maxImportedAt: Date | null;
};

function personalIdLookupKey(plain: string): string {
  return encryptPersonalId(plain);
}

function mapDbRole(role: string): PreregRole {
  if (role === 'captain' || role === 'goalkeeper' || role === 'player') return role;
  return 'player';
}

class PreregistrationLookupServiceImpl {
  private caches = new Map<string, SeasonCacheEntry>();
  private loading = new Map<string, Promise<void>>();
  private testSeasonIds = new Set<string>();

  private emptyCache(): SeasonCache {
    return {
      fullMap: new Map(),
      fullByPersonalId: new Map(),
      partialById: new Map(),
      partialByBirthYear: new Map(),
    };
  }

  private async latestImportAt(seasonId: string): Promise<Date | null> {
    const agg = await prisma.formPreregEntry.aggregate({
      where: { seasonId },
      _max: { importedAt: true },
    });
    return agg._max.importedAt;
  }

  private isStale(entry: SeasonCacheEntry, latestAt: Date | null): boolean {
    const cached = entry.maxImportedAt?.getTime() ?? null;
    const latest = latestAt?.getTime() ?? null;
    return cached !== latest;
  }

  private async ensureLoaded(seasonId: string): Promise<SeasonCache> {
    if (this.testSeasonIds.has(seasonId)) {
      return this.caches.get(seasonId)?.cache ?? this.emptyCache();
    }

    const existing = this.caches.get(seasonId);
    if (existing) {
      try {
        const latestAt = await this.latestImportAt(seasonId);
        if (!this.isStale(existing, latestAt)) {
          return existing.cache;
        }
        this.caches.delete(seasonId);
      } catch (err) {
        console.warn(`[prereg] stale check failed for season ${seasonId}:`, err);
        return existing.cache;
      }
    }

    const pending = this.loading.get(seasonId);
    if (pending) {
      await pending;
      return this.caches.get(seasonId)?.cache ?? this.emptyCache();
    }

    const loadPromise = this.loadFromDb(seasonId);
    this.loading.set(seasonId, loadPromise);
    try {
      await loadPromise;
    } finally {
      this.loading.delete(seasonId);
    }

    return this.caches.get(seasonId)?.cache ?? this.emptyCache();
  }

  private async loadFromDb(seasonId: string): Promise<void> {
    const cache = this.emptyCache();

    try {
      const rows = await prisma.formPreregEntry.findMany({ where: { seasonId } });
      let maxImportedAt: Date | null = null;

      for (const row of rows) {
        if (!maxImportedAt || row.importedAt > maxImportedAt) {
          maxImportedAt = row.importedAt;
        }

        const role = mapDbRole(row.role);
        const email = row.captainEmail ?? undefined;

        if (!row.adminMissing && row.personalIdEnc && row.birthYear != null) {
          const idKey = storedPersonalIdLookupKey(row.personalIdEnc);
          const entry: PreregEntry = {
            name: row.name,
            ...(email ? { email } : {}),
            personalId: idKey,
            birthYear: row.birthYear,
            teamName: row.teamName,
            role,
          };
          cache.fullMap.set(`${idKey}:${row.birthYear}`, entry);
          cache.fullByPersonalId.set(idKey, entry);
          continue;
        }

        if (row.adminMissing === FormPreregAdminMissing.birth_year && row.personalIdEnc) {
          const idKey = storedPersonalIdLookupKey(row.personalIdEnc);
          cache.partialById.set(idKey, {
            name: row.name,
            ...(email ? { email } : {}),
            personalId: idKey,
            adminMissing: 'birth_year',
            teamName: row.teamName,
            role,
          });
        } else if (row.adminMissing === FormPreregAdminMissing.personal_id && row.birthYear != null) {
          const list = cache.partialByBirthYear.get(row.birthYear) ?? [];
          list.push({
            name: row.name,
            ...(email ? { email } : {}),
            birthYear: row.birthYear,
            adminMissing: 'personal_id',
            teamName: row.teamName,
            role,
          });
          cache.partialByBirthYear.set(row.birthYear, list);
        }
      }

      this.caches.set(seasonId, { cache, maxImportedAt });
      console.log(
        `[prereg] loaded ${cache.fullMap.size} complete, ${cache.partialById.size} partial-by-id, ${cache.partialByBirthYear.size} partial-by-year for season ${seasonId}`
      );
    } catch (err) {
      console.warn(`[prereg] failed to load season ${seasonId}:`, err);
    }
  }

  async findFull(seasonId: string, personalId: string, birthYear: number): Promise<PreregEntry | null> {
    const evaluation = await this.evaluate(seasonId, personalId, birthYear);
    return evaluation.kind === 'full_match' ? evaluation.entry : null;
  }

  async findPartialByPersonalId(
    seasonId: string,
    personalId: string
  ): Promise<PartialPreregEntry | null> {
    try {
      const cache = await this.ensureLoaded(seasonId);
      const v = validatePersonalIdOnly(personalId);
      if (!v.ok) return null;
      const key = personalIdLookupKey(v.personalId);
      return cache.partialById.get(key) ?? null;
    } catch {
      return null;
    }
  }

  /** Match on personalId + birthYear only; detect admin gaps and single-field mismatches. */
  async evaluate(
    seasonId: string,
    personalId: string,
    birthYear: number
  ): Promise<PreregEvaluation> {
    try {
      const cache = await this.ensureLoaded(seasonId);
      const v = validateFormIdentity(personalId, birthYear);
      if (!v.ok) return { kind: 'no_match' };

      const idKey = personalIdLookupKey(v.personalId);
      const full = cache.fullMap.get(`${idKey}:${v.birthYear}`);
      if (full) {
        return {
          kind: 'full_match',
          entry: { ...full, personalId: v.personalId },
        };
      }

      const byId = cache.fullByPersonalId.get(idKey);
      if (byId && byId.birthYear !== v.birthYear) {
        return { kind: 'field_mismatch', field: 'birth_year' };
      }

      const partialId = cache.partialById.get(idKey);
      if (partialId?.adminMissing === 'birth_year') {
        return { kind: 'admin_missing', field: 'birth_year' };
      }

      const fullSameYear = [...cache.fullMap.values()].filter((e) => e.birthYear === v.birthYear);
      if (fullSameYear.length === 1 && fullSameYear[0]!.personalId !== idKey) {
        return { kind: 'field_mismatch', field: 'personal_id' };
      }

      const partialYear = cache.partialByBirthYear.get(v.birthYear) ?? [];
      if (partialYear.length === 1 && partialYear[0]!.adminMissing === 'personal_id') {
        return { kind: 'admin_missing', field: 'personal_id' };
      }

      return { kind: 'no_match' };
    } catch {
      return { kind: 'no_match' };
    }
  }

  _resetForTests(): void {
    this.caches.clear();
    this.loading.clear();
    this.testSeasonIds.clear();
  }

  _loadForTests(seasonId: string, full: PreregEntry[], partial: PartialPreregEntry[]): void {
    this.testSeasonIds.add(seasonId);
    const cache = this.emptyCache();
    for (const row of full) {
      const v = validateFormIdentity(row.personalId, row.birthYear);
      if (v.ok) {
        const idKey = personalIdLookupKey(v.personalId);
        const entry: PreregEntry = { ...row, personalId: idKey, birthYear: v.birthYear };
        cache.fullMap.set(`${idKey}:${v.birthYear}`, entry);
        cache.fullByPersonalId.set(idKey, entry);
      }
    }
    for (const row of partial) {
      if (row.adminMissing === 'birth_year' && row.personalId) {
        const v = validatePersonalIdOnly(row.personalId);
        if (v.ok) {
          const idKey = personalIdLookupKey(v.personalId);
          cache.partialById.set(idKey, { ...row, personalId: idKey });
        }
      } else if (row.adminMissing === 'personal_id' && row.birthYear != null) {
        const list = cache.partialByBirthYear.get(row.birthYear) ?? [];
        list.push(row);
        cache.partialByBirthYear.set(row.birthYear, list);
      }
    }
    this.caches.set(seasonId, { cache, maxImportedAt: new Date() });
  }
}

export const PreregistrationLookupService = new PreregistrationLookupServiceImpl();
