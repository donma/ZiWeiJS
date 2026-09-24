/**
 * 名稱正規化與分類（spec Post-Stability §21）
 *
 * 外部資料集的「星曜清單」常混入 stage / cycle-deity / year-deity / 別名 / 簡繁，
 * 因此比對前必須先：
 *   1. 繁簡 normalize（以 ZiWeiJS registry 自身的 zh-TW ↔ zh-CN 對照）
 *   2. alias normalize（tables/stars/aliases.json）
 *   3. category normalize（entityKind）
 *
 * 禁止只靠字面自動合併；ambiguous 一律回報全部候選。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entityKindOfStarEntry, type AstroEntityKind } from '../../src/core/entity-kinds.js';
import type { Star } from '../../src/core/types.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

export interface NameEntry {
  id: string;
  entityKind: AstroEntityKind;
  names: string[];
  source: 'star-registry' | 'cycle-registry' | 'alias-registry';
}

export interface AliasEntry {
  alias: string;
  type: string;
  starId?: string | null;
  candidates?: string[];
  note?: string;
}

const starRegistry = JSON.parse(
  readFileSync(join(root, 'tables/stars/registry.json'), 'utf8')
) as { stars: Star[] };

const aliasRegistry = JSON.parse(
  readFileSync(join(root, 'tables/stars/aliases.json'), 'utf8')
) as { entries: AliasEntry[] };

const cycleFiles = ['changsheng', 'boshi', 'suiqian', 'jiangqian'];
const cycleRegistry = cycleFiles.map(f =>
  JSON.parse(readFileSync(join(root, `tables/cycles/${f}.json`), 'utf8')) as {
    cycleId: string;
    entityKind: AstroEntityKind;
    entries: Array<{ key: string; name: Record<string, string>; starId?: string | null }>;
  }
);

export interface NameIndex {
  entries: NameEntry[];
  byName: Map<string, NameEntry[]>;
}

/** 建立名稱索引（star + cycle + alias） */
export function buildNameIndex(): NameIndex {
  const entries: NameEntry[] = [];

  for (const s of starRegistry.stars) {
    const names = [s.name['zh-TW'], s.name['zh-CN'], s.name['en'], ...(s.aliases ?? [])]
      .filter((x): x is string => Boolean(x));
    entries.push({ id: s.id, entityKind: entityKindOfStarEntry(s), names, source: 'star-registry' });
  }

  for (const cycle of cycleRegistry) {
    for (const e of cycle.entries) {
      const names = Object.values(e.name).filter(Boolean);
      entries.push({
        id: e.starId ?? `ZW.CYCLE.${cycle.cycleId.toUpperCase()}.${e.key.toUpperCase()}`,
        entityKind: cycle.entityKind,
        names,
        source: 'cycle-registry'
      });
    }
  }

  const byIdDedupe = new Map<string, Map<string, NameEntry>>();
  for (const e of entries) {
    for (const n of e.names) {
      const m = byIdDedupe.get(n) ?? new Map<string, NameEntry>();
      m.set(e.id, e);
      byIdDedupe.set(n, m);
    }
  }
  const byName = new Map<string, NameEntry[]>(
    [...byIdDedupe].map(([k, v]) => [k, [...v.values()]])
  );
  return { entries, byName };
}

export function listAliases(): AliasEntry[] {
  return aliasRegistry.entries;
}

export function lookupAlias(name: string): AliasEntry | undefined {
  return aliasRegistry.entries.find(a => a.alias === name);
}

export type GapStatus =
  | 'existing'
  | 'ambiguous'
  | 'stage'
  | 'cycle-deity'
  | 'year-deity'
  | 'period-dynamic'
  | 'actual-missing-star'
  | 'external-only'
  | 'unknown';

/** 動態運限前綴（流 / 運 / 月 / 日 / 時 / 年 + 星名或簡稱） */
const DYNAMIC_PREFIXES = ['流', '運', '大', '小', '月', '日', '時', '年'];

/** 動態星簡稱 → 基礎星曜 ID（魁鉞昌曲祿羊陀馬鸞喜） */
const DYNAMIC_ABBREV: Record<string, string> = {
  魁: 'ZW.STAR.AUX.TIANKUI',
  鉞: 'ZW.STAR.AUX.TIANYUE',
  昌: 'ZW.STAR.AUX.WENCHANG',
  曲: 'ZW.STAR.AUX.WENQU',
  祿: 'ZW.STAR.AUX.LUCUN',
  羊: 'ZW.STAR.MALEFIC.QINGYANG',
  陀: 'ZW.STAR.MALEFIC.TUOLUO',
  馬: 'ZW.STAR.AUX.TIANMA',
  鸞: 'ZW.STAR.AUX.HONGLUAN',
  喜: 'ZW.STAR.AUX.TIANXI'
};

export interface Classification {
  name: string;
  status: GapStatus;
  matched: NameEntry[];
  alias?: AliasEntry;
  baseStarId?: string;
}

function statusForKind(kind: AstroEntityKind): GapStatus {
  if (kind === 'stage') return 'stage';
  if (kind === 'cycle-deity') return 'cycle-deity';
  if (kind === 'year-deity') return 'year-deity';
  return 'existing';
}

export function classifyExternalName(name: string, index: NameIndex): Classification {
  const exact = index.byName.get(name);
  if (exact && exact.length > 0) {
    const kinds = new Set(exact.map(e => e.entityKind));
    if (kinds.size > 1) {
      return { name, status: 'ambiguous', matched: exact };
    }
    return { name, status: statusForKind(exact[0].entityKind), matched: exact };
  }

  // period-dynamic：前綴 + 已知星名 / 簡稱
  for (const prefix of DYNAMIC_PREFIXES) {
    if (!name.startsWith(prefix) || name.length <= prefix.length) continue;
    const base = name.slice(prefix.length);
    const baseHit = index.byName.get(base);
    if (baseHit && baseHit.length === 1) {
      return { name, status: 'period-dynamic', matched: baseHit, baseStarId: baseHit[0].id };
    }
    const abbrevId = DYNAMIC_ABBREV[base];
    if (abbrevId) {
      const hit = index.entries.find(e => e.id === abbrevId);
      if (hit) return { name, status: 'period-dynamic', matched: [hit], baseStarId: abbrevId };
    }
  }

  const alias = lookupAlias(name);
  if (alias) {
    if (alias.type === 'external-only') return { name, status: 'external-only', matched: [], alias };
    const candidates = index.entries.filter(e =>
      (alias.candidates ?? []).includes(e.id) || (alias.starId && e.id === alias.starId)
    );
    if (alias.type === 'ambiguous' || candidates.length > 1) {
      return { name, status: 'ambiguous', matched: candidates, alias };
    }
    if (candidates.length === 1) {
      return { name, status: statusForKind(candidates[0].entityKind), matched: candidates, alias };
    }
    return { name, status: 'external-only', matched: [], alias };
  }

  return { name, status: 'actual-missing-star', matched: [] };
}

export { starRegistry, cycleRegistry };
