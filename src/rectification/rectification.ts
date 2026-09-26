import type { ZiWeiBirthInput, ZiWeiChart, BranchId } from '../core/types.js';
import { calculateSafe } from '../reference-engine/engine.js';
import { ZiWeiError } from '../core/errors.js';
import type { CalculateOptions } from '../core/types.js';
import {
  analyzeBirthTime,
  type BirthTimeUncertaintyResult,
  type BirthTimeCandidate,
  type CandidateSignature
} from '../birth-time/birth-time.js';

const HOUR_BRANCHES: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const HOUR_CENTERS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

export type UnknownTimeClass = 'stable' | 'variable' | 'unavailable';

export interface UnknownTimeResult {
  candidates: Array<{
    hourBranch: string;
    representativeHour: number;
    chart?: ZiWeiChart;
    error?: string;
  }>;
  comparison: {
    lifePalaceBranch: { status: UnknownTimeClass; values: Record<string, string[]> };
    bureau: { status: UnknownTimeClass; values: Record<string, string[]> };
    majorStars: { status: UnknownTimeClass; detail: Record<string, string[]> };
  };
  summary: {
    stable: string[];
    variable: string[];
    unavailable: string[];
  };
}

export function analyzeUnknownTime(
  input: Omit<ZiWeiBirthInput, 'time'>,
  options: CalculateOptions = {}
): UnknownTimeResult {
  const candidates: UnknownTimeResult['candidates'] = [];

  for (let i = 0; i < 12; i++) {
    const withTime: ZiWeiBirthInput = {
      ...input,
      time: { hour: HOUR_CENTERS[i], minute: 0, second: 0 }
    };
    const res = calculateSafe(withTime, options);
    if (res.ok) {
      candidates.push({ hourBranch: HOUR_BRANCHES[i], representativeHour: HOUR_CENTERS[i], chart: res.chart });
    } else {
      candidates.push({ hourBranch: HOUR_BRANCHES[i], representativeHour: HOUR_CENTERS[i], error: res.error.message });
    }
  }

  const group = (pick: (c: ZiWeiChart) => string) => {
    const map: Record<string, string[]> = {};
    for (const c of candidates) {
      if (!c.chart) continue;
      const v = pick(c.chart);
      (map[v] ??= []).push(c.hourBranch);
    }
    return map;
  };

  const classify = (values: Record<string, string[]>): UnknownTimeClass => {
    const keys = Object.keys(values);
    if (keys.length === 0) return 'unavailable';
    return keys.length === 1 ? 'stable' : 'variable';
  };

  const lifeValues = group(c => c.chart.natal.lifePalaceBranch);
  const bureauValues = group(c => c.birthContext.bureau);
  const majorDetail: Record<string, string[]> = {};
  for (const c of candidates) {
    if (!c.chart) continue;
    for (const [starId, p] of Object.entries(c.chart.chart.stars)) {
      const placement = p as { star?: { category?: string }; branch?: string };
      if (placement.star?.category !== 'major') continue;
      const key = `${starId}@${placement.branch}`;
      (majorDetail[key] ??= []).push(c.hourBranch);
    }
  }

  const stable: string[] = [];
  const variable: string[] = [];
  const unavailable: string[] = [];

  const lifeStatus = classify(lifeValues);
  const bureauStatus = classify(bureauValues);
  const majorStatus: UnknownTimeClass = Object.keys(majorDetail).length === 0
    ? 'unavailable'
    : Object.values(majorDetail).some(v => v.length === 12) && Object.keys(majorDetail).length > 14
      ? 'variable'
      : 'variable';

  (lifeStatus === 'stable' ? stable : lifeStatus === 'variable' ? variable : unavailable).push('lifePalace');
  (bureauStatus === 'stable' ? stable : bureauStatus === 'variable' ? variable : unavailable).push('bureau');
  variable.push('majorStars');

  return {
    candidates,
    comparison: {
      lifePalaceBranch: { status: lifeStatus, values: lifeValues },
      bureau: { status: bureauStatus, values: bureauValues },
      majorStars: { status: majorStatus, detail: majorDetail }
    },
    summary: { stable, variable, unavailable }
  };
}

// ── Rectification V2（spec 0.71 §12–§13）──────────────────────────────
// 不再輸出假 probability；以 matched / conflicted / unresolved 線索 + supportLevel 表達。

export type RectificationClueType =
  | 'life-event'
  | 'relationship-event'
  | 'career-event'
  | 'health-event'
  | 'family-event'
  | 'migration-event'
  | 'personality'
  | 'appearance'
  | 'known-rule'
  | 'known-pattern';

export interface RectificationClue {
  type: RectificationClueType;
  /** ISO date or description */
  date?: string;
  description: string;
  /** 對應規則 ID（若有） */
  ruleId?: string;
  /** 對應格局 ID（若有） */
  patternId?: string;
}

export interface RectificationMatch {
  clue: RectificationClue;
  match: 'matched' | 'conflicted' | 'unresolved';
  detail: string;
}

export interface RectificationCandidateResult {
  hourBranch: BranchId;
  representativeHour: number;
  matchedClues: RectificationMatch[];
  conflictedClues: RectificationMatch[];
  unresolvedClues: RectificationMatch[];
  supportLevel: 'strong' | 'moderate' | 'weak' | 'insufficient';
  evidenceCount: number;
  notes: string[];
}

export interface RectificationResult {
  candidates: RectificationCandidateResult[];
  note: string;
}

export function rectifyAnalyze(
  input: Omit<ZiWeiBirthInput, 'time'>,
  clues: RectificationClue[] = [],
  options: CalculateOptions = {}
): RectificationResult {
  const base = analyzeBirthTime({ ...input, time: { precision: 'unknown' } }, { ...options, interpretation: true, patterns: true });
  const results: RectificationCandidateResult[] = [];

  const ruleClues = clues.filter(c => c.ruleId || c.patternId);

  for (const cand of base.candidates) {
    const matched: RectificationMatch[] = [];
    const conflicted: RectificationMatch[] = [];
    const unresolved: RectificationMatch[] = [];

    if (!cand.chart) {
      unresolved.push(...ruleClues.map(clue => ({ clue, match: 'unresolved' as const, detail: 'calculation failed' })));
      results.push({ hourBranch: cand.hourBranch, representativeHour: cand.representativeTime.hour, matchedClues: [], conflictedClues: [], unresolvedClues: unresolved, supportLevel: 'insufficient', evidenceCount: 0, notes: [`Chart calculation failed for ${cand.hourBranch}`] });
      continue;
    }

    const hitRuleIds = new Set<string>([
      ...cand.chart.interpretation.hits.map(h => h.ruleId),
      ...cand.chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').map(p => p.patternId)
    ]);

    for (const clue of clues) {
      const rid = clue.ruleId ?? clue.patternId;
      if (rid && hitRuleIds.has(rid)) {
        matched.push({ clue, match: 'matched', detail: `hit ${rid}` });
      } else if (rid) {
        conflicted.push({ clue, match: 'conflicted', detail: `missed ${rid}` });
      } else {
        // 事件型線索尚無對應 canonical rule — 誠實標 unresolved（spec §13）
        unresolved.push({ clue, match: 'unresolved', detail: 'no ruleId/patternId supplied (framework-only)' });
      }
    }

    const matchedCount = matched.length;
    const conflictedCount = conflicted.length;
    let supportLevel: RectificationCandidateResult['supportLevel'] = 'insufficient';
    if (matchedCount >= 3 && conflictedCount === 0) supportLevel = 'strong';
    else if (matchedCount >= 2) supportLevel = 'moderate';
    else if (matchedCount >= 1) supportLevel = 'weak';

    const notes: string[] = [];
    if (matchedCount > 0) notes.push(`${matchedCount} clue(s) matched`);
    if (conflictedCount > 0) notes.push(`${conflictedCount} clue(s) conflicted`);
    if (unresolved.length > 0) notes.push(`${unresolved.length} clue(s) unresolved (no rule/pattern ID)`);

    results.push({
      hourBranch: cand.hourBranch,
      representativeHour: cand.representativeTime.hour,
      matchedClues: matched,
      conflictedClues: conflicted,
      unresolvedClues: unresolved,
      supportLevel,
      evidenceCount: matchedCount + conflictedCount,
      notes
    });
  }

  // 依 support 排序：strong > moderate > weak > insufficient；同級依 matched 數
  const levelOrder = { strong: 0, moderate: 1, weak: 2, insufficient: 3 };
  results.sort((a, b) => levelOrder[a.supportLevel] - levelOrder[b.supportLevel] || b.matchedClues.length - a.matchedClues.length);

  return {
    candidates: results,
    note: 'Rectification is inference, not birth-time fact. 推論 ≠ 出生時間事實。'
  };
}
