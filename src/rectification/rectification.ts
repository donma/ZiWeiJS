import type { ZiWeiBirthInput, ZiWeiChart, Certainty } from '../core/types.js';
import { calculate, calculateSafe } from '../reference-engine/engine.js';
import { ZiWeiError } from '../core/errors.js';
import type { CalculateOptions } from '../core/types.js';

const HOUR_BRANCHES = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'] as const;
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

export interface RectificationClue {
  type: 'event' | 'trait' | 'pattern' | 'interpretation-rule';
  description: string;
  ruleId?: string;
  weight?: number;
}

export interface RectificationResult {
  candidates: Array<{
    hourBranch: string;
    representativeHour: number;
    support: number;
    matchedRules: string[];
    conflicts: string[];
  }>;
  note: string;
}

export function rectifyAnalyze(
  input: Omit<ZiWeiBirthInput, 'time'>,
  clues: RectificationClue[] = [],
  options: CalculateOptions = {}
): RectificationResult {
  const base = analyzeUnknownTime(input, { ...options, interpretation: true, patterns: true });
  const results: RectificationResult['candidates'] = [];

  const ruleClues = clues.filter(c => c.ruleId);

  for (const c of base.candidates) {
    if (!c.chart) {
      results.push({ hourBranch: c.hourBranch, representativeHour: c.representativeHour, support: 0, matchedRules: [], conflicts: ['calculation-failed'] });
      continue;
    }
    const hitRuleIds = new Set<string>([
      ...c.chart.interpretation.hits.map(h => h.ruleId),
      ...c.chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').map(p => p.patternId)
    ]);
    const matched: string[] = [];
    const conflicts: string[] = [];
    let score = 0.5;
    for (const clue of ruleClues) {
      const w = clue.weight ?? 1;
      if (hitRuleIds.has(clue.ruleId!)) {
        matched.push(clue.ruleId!);
        score += 0.1 * w;
      } else {
        conflicts.push(clue.ruleId!);
        score -= 0.05 * w;
      }
    }
    results.push({
      hourBranch: c.hourBranch,
      representativeHour: c.representativeHour,
      support: Math.max(0, Math.min(1, score)),
      matchedRules: matched,
      conflicts
    });
  }

  results.sort((a, b) => b.support - a.support);

  return {
    candidates: results,
    note: 'Rectification is inference, not birth-time fact. 推論 ≠ 出生時間事實。'
  };
}
