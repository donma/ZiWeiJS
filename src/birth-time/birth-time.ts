/**
 * Birth Time Uncertainty Engine（spec 0.71 §1–§14）。
 *
 * 支援四種出生時間精度模式：
 *   - exact        → 單一精確時間（等同舊版 time.hour + minute）
 *   - hour-branch  → 只知道時辰（12 時辰卡），產生 1 個代表候選
 *   - range        → 大概時段，產生該範圍內所有可能時辰
 *   - unknown      → 完全不知道，產生 12 時辰候選
 *
 * 完全不知道出生時間時，不回傳單一命盤，
 * 而是回傳 BirthTimeUncertaintyResult 含 12 候選比較。
 */
import { calculate, calculateSafe } from '../reference-engine/engine.js';
import { getProfile } from '../rule-engine/registry.js';
import { ZiWeiError } from '../core/errors.js';
import type {
  ZiWeiBirthInput,
  ZiWeiChart,
  CalculateOptions,
  BranchId,
  PalaceId,
  BureauId,
  BirthTimePrecision,
  BirthTimeInput
} from '../core/types.js';

const HOUR_BRANCHES: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const HOUR_CENTERS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const HOUR_RANGES: Record<BranchId, { start: string; end: string }> = {
  zi:  { start: '23:00', end: '00:59' },
  chou:{ start: '01:00', end: '02:59' },
  yin: { start: '03:00', end: '04:59' },
  mao: { start: '05:00', end: '06:59' },
  chen:{ start: '07:00', end: '08:59' },
  si:  { start: '09:00', end: '10:59' },
  wu:  { start: '11:00', end: '12:59' },
  wei: { start: '13:00', end: '14:59' },
  shen:{ start: '15:00', end: '16:59' },
  you: { start: '17:00', end: '18:59' },
  xu:  { start: '19:00', end: '20:59' },
  hai: { start: '21:00', end: '22:59' }
};

// ── Candidate Signature（spec 0.71 §9）─────────────────────────────────

export interface CandidateSignature {
  lifePalace: PalaceId;
  lifePalaceBranch: BranchId;
  bodyPalace: PalaceId;
  bodyPalaceBranch: BranchId;
  bureau: BureauId;
  masterStar?: string;
  bodyStar?: string;
  /** 十四主星 → 落宮地支 */
  majorStars: Record<string, BranchId>;
  /** 生年四化（natal scope） */
  transformations: string[];
  /** 命中格局 IDs */
  patterns: string[];
  /** 命中 Interpretation Rule IDs */
  interpretationRuleIds: string[];
}

// ── Candidate（spec 0.71 §8）─────────────────────────────────────────

export interface BirthTimeCandidate {
  candidateId: string;
  hourBranch: BranchId;
  timeRange: { start: string; end: string };
  representativeTime: { hour: number; minute: number };
  chart?: ZiWeiChart;
  error?: { code: string; message: string };
  signature: CandidateSignature;
}

// ── FactDiff / Sensitivity / Grouping（spec 0.71 §10–§11）─────────────

export interface FactDiff {
  factId: string;
  label: string;
  status: 'stable' | 'variable' | 'unavailable';
  values: Record<string, BranchId[]>;
}

export interface CandidateGroup {
  groupId: string;
  hourBranches: BranchId[];
  commonSignature: Partial<CandidateSignature>;
  differences: FactDiff[];
}

export interface SensitivitySummary {
  boundarySensitive: boolean;
  boundaryNotes: string[];
}

export interface BirthTimeUncertaintyResult {
  inputPrecision: BirthTimePrecision;
  candidates: BirthTimeCandidate[];
  stableFacts: FactDiff[];
  variableFacts: FactDiff[];
  uniqueFacts: FactDiff[];
  groups: CandidateGroup[];
  sensitivity: SensitivitySummary;
  recommendation?: {
    narrowedTo?: BranchId[];
    reasonCodes: string[];
  };
  provenance: {
    profile: string;
    engineVersion: string;
    schemaVersion: string;
  };
}

// ── Candidate generation helpers ────────────────────────────────────

function buildSignature(chart: ZiWeiChart): CandidateSignature {
  const natal = chart.chart.natal;
  const majors: Record<string, BranchId> = {};
  for (const [id, p] of Object.entries(chart.chart.stars)) {
    if (p.star?.category === 'major') {
      majors[id] = p.branch;
    }
  }
  const trs = chart.chart.transformations
    .filter(t => t.sourceScope === 'natal')
    .map(t => `${t.targetStarId}@${t.sourceStem}:${t.type}`);
  const pats = chart.chart.patterns.map(p => p.patternId);
  const hits = chart.interpretation.hits.map(h => h.ruleId);
  return {
    lifePalace: natal.lifePalace,
    lifePalaceBranch: natal.lifePalaceBranch,
    bodyPalace: natal.bodyPalace,
    bodyPalaceBranch: natal.bodyPalaceBranch,
    bureau: chart.birthContext.bureau,
    masterStar: natal.masterStar,
    bodyStar: natal.bodyStar,
    majorStars: majors,
    transformations: trs,
    patterns: pats,
    interpretationRuleIds: hits
  };
}

function makeCandidate(
  branch: BranchId,
  baseInput: Omit<ZiWeiBirthInput, 'time'>,
  options: CalculateOptions
): BirthTimeCandidate {
  const repHour = HOUR_CENTERS[HOUR_BRANCHES.indexOf(branch)];
  const input: ZiWeiBirthInput = {
    ...baseInput,
    time: { hour: repHour, minute: 0, second: 0 }
  };
  const res = calculateSafe(input, options);
  const sig: CandidateSignature = res.ok
    ? buildSignature(res.chart)
    : {
        lifePalace: 'life', lifePalaceBranch: branch,
        bodyPalace: 'life', bodyPalaceBranch: branch,
        bureau: 'shui2', majorStars: {},
        transformations: [], patterns: [], interpretationRuleIds: []
      };
  return {
    candidateId: `cand-${branch}`,
    hourBranch: branch,
    timeRange: HOUR_RANGES[branch],
    representativeTime: { hour: repHour, minute: 0 },
    chart: res.ok ? res.chart : undefined,
    error: res.ok ? undefined : { code: res.error.code, message: res.error.message },
    signature: sig
  };
}

/** 依 birthTimePrecision 產生候選時辰列表 */
export function generateCandidates(
  precision: BirthTimePrecision,
  input: Omit<ZiWeiBirthInput, 'time'>,
  options: CalculateOptions = {},
  hourBranch?: BranchId,
  range?: { fromHour: number; toHour: number }
): BranchId[] {
  switch (precision) {
    case 'exact':
      return [];
    case 'hour-branch':
      return hourBranch ? [hourBranch] : [];
    case 'range': {
      if (!range) return HOUR_BRANCHES;
      const fromIdx = Math.floor(range.fromHour / 2);
      const toIdx = Math.floor(range.toHour / 2);
      return HOUR_BRANCHES.slice(fromIdx, toIdx + 1);
    }
    case 'unknown':
    default:
      return [...HOUR_BRANCHES];
  }
}

// ── Diff Analysis（spec 0.71 §10）────────────────────────────────────

function diffFacts(candidates: BirthTimeCandidate[]): {
  stableFacts: FactDiff[];
  variableFacts: FactDiff[];
  uniqueFacts: FactDiff[];
} {
  const valid = candidates.filter(c => c.chart);
  const stableFacts: FactDiff[] = [];
  const variableFacts: FactDiff[] = [];
  const uniqueFacts: FactDiff[] = [];

  if (valid.length === 0) return { stableFacts, variableFacts, uniqueFacts };

  // Helper: group candidates by a value extracted from chart
  const groupBy = (extract: (c: ZiWeiChart) => string): Record<string, BranchId[]> => {
    const map: Record<string, BranchId[]> = {};
    for (const c of valid) {
      const v = extract(c.chart!);
      (map[v] ??= []).push(c.hourBranch);
    }
    return map;
  };

  const classify = (map: Record<string, BranchId[]>): 'stable' | 'variable' | 'unavailable' => {
    const keys = Object.keys(map);
    if (keys.length === 0) return 'unavailable';
    return keys.length === 1 ? 'stable' : 'variable';
  };

  // ── facts to compare ────────────────────────────────────────────────
  const checks: Array<{ factId: string; label: string; extract: (c: ZiWeiChart) => string }> = [
    { factId: 'lifePalace', label: '命宮', extract: c => c.chart.natal.lifePalaceBranch },
    { factId: 'bodyPalace', label: '身宮', extract: c => c.chart.natal.bodyPalaceBranch },
    { factId: 'bureau', label: '五行局', extract: c => c.birthContext.bureau },
    { factId: 'masterStar', label: '命主', extract: c => c.chart.natal.masterStar ?? 'none' },
    { factId: 'bodyStar', label: '身主', extract: c => c.chart.natal.bodyStar ?? 'none' },
    { factId: 'majorStars', label: '十四主星', extract: c => Object.values(c.chart.stars).filter(p => p.star?.category === 'major').map(p => p.starId).sort().join(',') },
    { factId: 'transformations', label: '生年四化', extract: c => c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => `${t.targetStarId}:${t.type}`).sort().join(',') },
    { factId: 'patterns', label: '格局', extract: c => c.chart.patterns.map(p => p.patternId).sort().join(',') },
    { factId: 'interpretation', label: 'Interpretation Hits', extract: c => c.interpretation.hits.map(h => h.ruleId).sort().join(',') },
    { factId: 'sanfangSiZheng', label: '三方四正', extract: c => c.chart.natal.lifePalace }
  ];

  for (const { factId, label, extract } of checks) {
    const map = groupBy(extract);
    const status = classify(map);
    const fd: FactDiff = { factId, label, status, values: map };
    if (status === 'stable') stableFacts.push(fd);
    else if (status === 'variable') variableFacts.push(fd);
  }

  // ── unique facts: stars or patterns unique to a single candidate ─────
  const allPatterns = new Map<string, BranchId[]>();
  const allStars = new Map<string, BranchId[]>();
  for (const c of valid) {
    for (const p of c.chart!.chart.patterns) {
      const arr = allPatterns.get(p.patternId) ?? [];
      arr.push(c.hourBranch);
      allPatterns.set(p.patternId, arr);
    }
    for (const [id, pl] of Object.entries(c.chart!.chart.stars)) {
      const key = `${id}@${pl.branch}`;
      const arr = allStars.get(key) ?? [];
      arr.push(c.hourBranch);
      allStars.set(key, arr);
    }
  }
  for (const [patId, branches] of allPatterns) {
    if (branches.length === 1) {
      uniqueFacts.push({
        factId: `unique-pattern-${patId}`,
        label: `格局：${patId}`,
        status: 'unavailable',
        values: { [patId]: branches }
      });
    }
  }

  return { stableFacts, variableFacts, uniqueFacts };
}

// ── Grouping（spec 0.71 §11）─────────────────────────────────────────

function groupCandidates(candidates: BirthTimeCandidate[]): CandidateGroup[] {
  const groups = new Map<string, BirthTimeCandidate[]>();
  for (const c of candidates) {
    const key = [
      c.signature.lifePalaceBranch,
      c.signature.bureau,
      Object.values(c.signature.majorStars).sort().join(',')
    ].join('|');
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([groupId, members], i) => ({
    groupId: `group-${i + 1}`,
    hourBranches: members.map(m => m.hourBranch),
    commonSignature: members[0]?.signature ?? {},
    differences: []
  }));
}

// ── Birth Time API ──────────────────────────────────────────────────

export function analyzeBirthTime(
  input: Omit<ZiWeiBirthInput, 'time'> & { time?: BirthTimeInput },
  options: CalculateOptions = {}
): BirthTimeUncertaintyResult {
  const profileId = options.profile ?? 'canonical';
  const precision: BirthTimePrecision = input.time?.precision ?? 'unknown';
  const hourBranch = input.time?.hourBranch;
  const range = input.time?.range;

  const candidateBranches = generateCandidates(precision, input, options, hourBranch, range);
  const candidates = candidateBranches.map(b => makeCandidate(b, input, options));

  const { stableFacts, variableFacts, uniqueFacts } = diffFacts(candidates);
  const groups = groupCandidates(candidates);

  // Sensitivity: check if any candidate's timeRange is boundary-sensitive
  // （真太陽時 / DST / 子初換日 可能導致跨時辰）
  const boundarySensitive = precision !== 'exact' && (
    options.profile !== undefined ||
    input.timeConvention === 'true-solar' ||
    input.timeConvention === 'local-mean-solar'
  );

  const sensitivity: SensitivitySummary = {
    boundarySensitive,
    boundaryNotes: boundarySensitive
      ? ['本候選可能受真太陽時/DST/子初換日影響，建議提供出生地或更精確時間。']
      : []
  };

  return {
    inputPrecision: precision,
    candidates,
    stableFacts,
    variableFacts,
    uniqueFacts,
    groups,
    sensitivity,
    recommendation: {
      narrowedTo: groups.length <= 3 ? groups.flatMap(g => g.hourBranches) : undefined,
      reasonCodes: groups.length <= 3 ? ['STRUCTURAL_SIMILARITY'] : []
    },
    provenance: {
      profile: profileId,
      engineVersion: '0.1.0',
      schemaVersion: '2.0'
    }
  };
}

// ── Candidate Selection（spec 0.71 §14 / §46）─────────────────────────

export function selectCandidate(
  result: BirthTimeUncertaintyResult,
  hourBranch: BranchId,
  options: CalculateOptions = {}
): ZiWeiChart {
  const candidate = result.candidates.find(c => c.hourBranch === hourBranch);
  if (!candidate) {
    throw new ZiWeiError('INVALID_INPUT', `Candidate not found for hour branch: ${hourBranch}`);
  }
  if (!candidate.chart) {
    throw new ZiWeiError('INVALID_INPUT', `Candidate has no chart (error: ${candidate.error?.message ?? 'unknown'})`);
  }
  // 標記為 user-selected-candidate，不是 verified birth time（spec 0.71 §14）
  const chart = { ...candidate.chart };
  const input = { ...chart.input, birthTimeSource: 'user-selected-candidate' as const };
  chart.input = input;
  return chart;
}
