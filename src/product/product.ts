/**
 * Product Layer（spec Post-Stability Phase I）。
 *
 * 定位：**唯讀組合層**，不得回頭污染 Bible Core。
 *   - 不新增任何命理規則、不新增安星／四化演算法
 *   - 只組合既有 canonical 輸出（chart / QueryApi）
 *   - 提供 Task Retrieval / Match / Trend / Share 所需的穩定資料形狀
 *
 * 若某功能需要新知識（例如新的格局或星曜判斷），必須回到 Bible 流程：
 * Research → Source/Evidence → Rule → Test → Owner 批准，不得寫在此層。
 */
import { calculate } from '../reference-engine/engine.js';
import { QueryApi } from '../query-engine/query.js';
import type {
  BranchId, PalaceId, ZiWeiChart, TargetDate, StarPlacement, PeriodScope
} from '../core/types.js';

/* ------------------------------------------------------------------ *
 * 穩定序列化 / 指紋
 * ------------------------------------------------------------------ */

/** 產生鍵值排序後之穩定 JSON（物件鍵遞迴排序；不含 undefined） */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const val = (v as Record<string, unknown>)[k];
        if (val !== undefined) out[k] = norm(val);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

/** FNV-1a 32-bit 指紋（用於分享 / 快取鍵；非安全雜湊） */
export function fingerprint(value: unknown): string {
  const s = typeof value === 'string' ? value : canonicalJson(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ *
 * Snapshot（命盤摘要）
 * ------------------------------------------------------------------ */

export interface ProductSnapshot {
  bibleVersion: string;
  schemaVersion: string;
  profile: string;
  lifePalaceBranch: BranchId;
  bodyPalaceBranch: BranchId;
  bureau: string;
  majors: Array<{ starId: string; branch: BranchId; palaceId: PalaceId }>;
  patterns: Array<{ patternId: string; status: string }>;
  natalTransformations: Array<{ type: string; targetStarId: string; targetPalaceId: PalaceId }>;
  fingerprint: string;
}

/** 命盤摘要（決定性；同盤必同輸出） */
export function snapshot(chart: ZiWeiChart): ProductSnapshot {
  const majors = Object.values(chart.chart.stars)
    .filter(p => p.star.category === 'major')
    .map(p => ({ starId: p.starId, branch: p.branch, palaceId: p.palaceId }))
    .sort((a, b) => a.starId.localeCompare(b.starId));

  const patterns = chart.chart.patterns
    .map(p => ({ patternId: p.patternId, status: p.status as string }))
    .sort((a, b) => a.patternId.localeCompare(b.patternId));

  const natalTransformations = chart.chart.transformations
    .filter(t => t.sourceScope === 'natal')
    .map(t => ({ type: t.type as string, targetStarId: t.targetStarId, targetPalaceId: t.targetPalaceId }))
    .sort((a, b) =>
      a.type.localeCompare(b.type) ||
      a.targetStarId.localeCompare(b.targetStarId) ||
      a.targetPalaceId.localeCompare(b.targetPalaceId)
    );

  const core = {
    bibleVersion: chart.generatedWith.bibleVersion,
    schemaVersion: chart.schemaVersion,
    profile: chart.generatedWith.profile,
    lifePalaceBranch: chart.chart.natal.lifePalaceBranch,
    bodyPalaceBranch: chart.chart.natal.bodyPalaceBranch,
    bureau: chart.birthContext.bureau,
    majors,
    patterns,
    natalTransformations
  };
  return { ...core, fingerprint: fingerprint(core) };
}

/* ------------------------------------------------------------------ *
 * Trend（時間軸）
 * ------------------------------------------------------------------ */

export interface TrendPoint {
  year: number;
  age?: number;
  major?: { fromAge: number; toAge: number; branch: BranchId; stem: string };
  yearPeriod?: { branch: BranchId; stem: string; resolvedYear?: number };
  xiaoxian?: { age: number; branch: BranchId; palaceId: PalaceId };
}

/**
 * 逐年的限運時間軸（大限 / 流年 / 小限）。
 *
 * 只組合既有 canonical 輸出；每一年以目標日期重算（成本 O(年數)，屬唯讀）。
 */
export function trend(chart: ZiWeiChart, range: { fromYear: number; toYear: number }): TrendPoint[] {
  if (range.toYear < range.fromYear) throw new Error('toYear must be >= fromYear');
  const span = range.toYear - range.fromYear;
  if (span > 200) throw new Error('trend range too large (max 200 years)');

  const out: TrendPoint[] = [];
  for (let year = range.fromYear; year <= range.toYear; year++) {
    const overlaid = calculate(chart.input, {
      targetDate: { year },
      profile: chart.generatedWith.profile
    });
    const active = overlaid.periods.active;
    const point: TrendPoint = { year };
    if (active) point.age = active.age;
    if (active?.major) {
      point.major = {
        fromAge: active.major.fromAge,
        toAge: active.major.toAge,
        branch: active.major.branch,
        stem: active.major.stem
      };
    }
    if (overlaid.periods.year) {
      point.yearPeriod = {
        branch: overlaid.periods.year.branch,
        stem: overlaid.periods.year.stem,
        resolvedYear: overlaid.periods.year.resolvedYear
      };
    }
    if (overlaid.periods.xiaoxian) {
      point.xiaoxian = {
        age: overlaid.periods.xiaoxian.age,
        branch: overlaid.periods.xiaoxian.branch,
        palaceId: overlaid.periods.xiaoxian.palaceId
      };
    }
    out.push(point);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Retrieval（薄封裝 QueryApi）
 * ------------------------------------------------------------------ */

export type RetrievalQuery =
  | { kind: 'star'; starId: string }
  | { kind: 'palace'; palaceId: PalaceId }
  | { kind: 'starsOfPalace'; palaceId: PalaceId }
  | { kind: 'transformations'; scope?: PeriodScope }
  | { kind: 'sanFangSiZheng'; palaceId: PalaceId };

/** 依查詢取回既有結果（不計算新知識） */
export function retrieve(chart: ZiWeiChart, query: RetrievalQuery): unknown {
  switch (query.kind) {
    case 'star':
      return QueryApi.star(chart, query.starId) as StarPlacement | undefined;
    case 'palace':
      return QueryApi.palace(chart, query.palaceId);
    case 'starsOfPalace':
      return QueryApi.starsOfPalace(chart, query.palaceId);
    case 'transformations':
      return query.scope
        ? QueryApi.transformations(chart, { scope: query.scope })
        : QueryApi.transformations(chart);
    case 'sanFangSiZheng':
      return QueryApi.sanFangSiZheng(chart, query.palaceId);
  }
}

/* ------------------------------------------------------------------ *
 * Share
 * ------------------------------------------------------------------ */

export interface SharePayload {
  formatVersion: string;
  bibleVersion: string;
  schemaVersion: string;
  profile: string;
  fingerprint: string;
  snapshot: Omit<ProductSnapshot, 'fingerprint'>;
  input?: ZiWeiChart['input'];
  period?: { asOf: TargetDate; major?: string; xiaoxian?: string };
}

/**
 * 產生可分享／可快取的穩定 payload。
 *
 * 隱私預設：**不包含出生資料**（input）；需要時明確傳 `{ includeInput: true }`。
 */
export function sharePayload(
  chart: ZiWeiChart,
  options: { includeInput?: boolean } = {}
): SharePayload {
  const snap = snapshot(chart);
  const { fingerprint: fp, ...rest } = snap;
  const payload: SharePayload = {
    formatVersion: '1.0',
    bibleVersion: snap.bibleVersion,
    schemaVersion: snap.schemaVersion,
    profile: snap.profile,
    fingerprint: fp,
    snapshot: rest
  };
  if (options.includeInput) payload.input = chart.input;
  if (chart.periods.active) {
    payload.period = {
      asOf: chart.periods.active.asOf,
      major: chart.periods.active.major
        ? `${chart.periods.active.major.fromAge}-${chart.periods.active.major.toAge}`
        : undefined,
      xiaoxian: chart.periods.xiaoxian ? `${chart.periods.xiaoxian.age}` : undefined
    };
  }
  return payload;
}

/** 兩張盤的結構性比對（只比對已有事實，不做吉凶推論） */
export interface MatchResult {
  sameLifePalaceBranch: boolean;
  sameBureau: boolean;
  sharedMajorStars: string[];
  sharedPatterns: string[];
  sharedNatalSihuaTargets: string[];
  fingerprintA: string;
  fingerprintB: string;
}

/** 結構性比對（Match）：只列舉共同事實，不含任何吉凶評分 */
export function match(a: ZiWeiChart, b: ZiWeiChart): MatchResult {
  const sa = snapshot(a);
  const sb = snapshot(b);
  const set = <T>(xs: T[]) => new Set(xs);
  const inter = (x: Set<string>, y: Set<string>) => [...x].filter(v => y.has(v)).sort();

  const majorA = set(sa.majors.map(m => m.starId));
  const majorB = set(sb.majors.map(m => m.starId));
  const patA = set(sa.patterns.map(p => p.patternId));
  const patB = set(sb.patterns.map(p => p.patternId));
  const sihuaA = set(sa.natalTransformations.map(t => `${t.type}:${t.targetStarId}`));
  const sihuaB = set(sb.natalTransformations.map(t => `${t.type}:${t.targetStarId}`));

  return {
    sameLifePalaceBranch: sa.lifePalaceBranch === sb.lifePalaceBranch,
    sameBureau: sa.bureau === sb.bureau,
    sharedMajorStars: inter(majorA, majorB),
    sharedPatterns: inter(patA, patB),
    sharedNatalSihuaTargets: inter(sihuaA, sihuaB),
    fingerprintA: sa.fingerprint,
    fingerprintB: sb.fingerprint
  };
}
