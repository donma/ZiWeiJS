/**
 * Candidate 星曜 / 小限 計算模組（研究階段，spec Post-Stability Phase B/C）。
 *
 * 護欄：
 *   - 本模組輸出**不併入** canonical 盤面（未列入 natal / period 執行計畫）。
 *   - 僅在 Owner 批准升 canonical 後，才可將對應規則改為 stage=natal/period。
 *   - 安星依據：SRC.QUANSHU.WIKISOURCE《紫微斗數全書》卷二「安星訣」原文
 *     （另與 SRC.IZTRO 實作觀點交叉比對，實作僅作比對、不作權威）。
 */
import { branchAt, branchIndex } from '../core/constants.js';
import type { BranchId } from '../core/types.js';
import { virtualAge } from '../period-engine/major-period-resolver.js';
import candidateTables from '../../tables/stars/candidate-aux-tables.json' with { type: 'json' };

export const TAIFU_FENGGAO_RULE_ID = 'ZW.CALC.STAR.TAIFU_FENGGAO.001';
export const JIESHEN_RULE_ID = 'ZW.CALC.STAR.JIESHEN.001';
export const XIAOXIAN_RULE_ID = 'ZW.CALC.PERIOD.XIAOXIAN.001';

export type CandidateBasis = 'hour-branch' | 'year-branch';

export interface CandidateStarPlacement {
  starId: string;
  branch: BranchId;
  ruleId: string;
  basis: CandidateBasis;
  /** 安星口訣（原文照錄，便於溯源） */
  formula: string;
}

const BY_HOUR = candidateTables.byHourBranch as unknown as Record<
  string,
  { startBranch: string; direction: number } | string
>;
const BY_YEAR_BRANCH = candidateTables.byYearBranch as unknown as Record<
  string,
  { startBranch: string; direction: number } | string
>;

const XIAOXIAN_START = candidateTables.xiaoXian.startByGroup as unknown as Record<string, string>;

const GROUP_BRANCHES: Record<string, BranchId[]> = {
  'yin-wu-xu': ['yin', 'wu', 'xu'],
  'shen-zi-chen': ['shen', 'zi', 'chen'],
  'si-you-chou': ['si', 'you', 'chou'],
  'hai-mao-wei': ['hai', 'mao', 'wei']
};

function startAndDirection(
  table: Record<string, { startBranch: string; direction: number } | string>,
  starId: string
): { startBranch: BranchId; direction: number } {
  const cfg = table[starId];
  if (!cfg || typeof cfg === 'string') {
    throw new Error(`candidate star table missing entry: ${starId}`);
  }
  return { startBranch: cfg.startBranch as BranchId, direction: cfg.direction };
}

/** 自 `startBranch`（起子時／起子）依方向位移 offset 位 */
export function placeByOffset(startBranch: BranchId, direction: number, offset: number): BranchId {
  return branchAt(branchIndex(startBranch) + direction * offset);
}

/** 台輔：由午宮起子，順數至本生時 */
export function placeTaiFu(hourBranch: BranchId): BranchId {
  const cfg = startAndDirection(BY_HOUR, 'ZW.STAR.AUX.TAIFU');
  return placeByOffset(cfg.startBranch, cfg.direction, branchIndex(hourBranch));
}

/** 封誥：由寅宮起子，順數至本生時 */
export function placeFengGao(hourBranch: BranchId): BranchId {
  const cfg = startAndDirection(BY_HOUR, 'ZW.STAR.AUX.FENGGAO');
  return placeByOffset(cfg.startBranch, cfg.direction, branchIndex(hourBranch));
}

/** 解神（年解）：由戌宮起子，逆數至生年太歲 */
export function placeJieShen(yearBranch: BranchId): BranchId {
  const cfg = startAndDirection(BY_YEAR_BRANCH, 'ZW.STAR.AUX.JIESHEN');
  return placeByOffset(cfg.startBranch, cfg.direction, branchIndex(yearBranch));
}

const FORMULA = {
  taifu: '由午宮起子順數至本生時安之',
  fenggao: '由寅起宮子順數至本生時安之',
  jieshen: '解神從戌上起子，逆數至當生年太歲是也'
} as const;

/** 三顆 candidate 輔星之安星結果（不含 canonical 盤面） */
export function candidateAuxStars(input: { hourBranch: BranchId; yearBranch: BranchId }): CandidateStarPlacement[] {
  return [
    {
      starId: 'ZW.STAR.AUX.TAIFU',
      branch: placeTaiFu(input.hourBranch),
      ruleId: TAIFU_FENGGAO_RULE_ID,
      basis: 'hour-branch',
      formula: FORMULA.taifu
    },
    {
      starId: 'ZW.STAR.AUX.FENGGAO',
      branch: placeFengGao(input.hourBranch),
      ruleId: TAIFU_FENGGAO_RULE_ID,
      basis: 'hour-branch',
      formula: FORMULA.fenggao
    },
    {
      starId: 'ZW.STAR.AUX.JIESHEN',
      branch: placeJieShen(input.yearBranch),
      ruleId: JIESHEN_RULE_ID,
      basis: 'year-branch',
      formula: FORMULA.jieshen
    }
  ];
}

/** 年支所屬三合局名稱 */
export function yearBranchGroup(yearBranch: BranchId): string {
  for (const [name, branches] of Object.entries(GROUP_BRANCHES)) {
    if (branches.includes(yearBranch)) return name;
  }
  throw new Error(`unknown year branch: ${yearBranch}`);
}

/** 小限一歲起宮：寅午戌起辰、申子辰起戌、巳酉丑起未、亥卯未起丑 */
export function xiaoXianStartBranch(yearBranch: BranchId): BranchId {
  const group = yearBranchGroup(yearBranch);
  const start = XIAOXIAN_START[group];
  if (!start) throw new Error(`xiaoXian start missing for group: ${group}`);
  return start as BranchId;
}

/** 小限方向：男順女逆（不論陰陽） */
export function xiaoXianDirection(sex: 'male' | 'female'): number {
  return sex === 'male' ? 1 : -1;
}

/** 虛歲 `age` 之小限宮位（age 自 1 起） */
export function xiaoXianBranchAtAge(
  yearBranch: BranchId,
  sex: 'male' | 'female',
  age: number
): BranchId {
  if (!Number.isInteger(age) || age < 1) {
    throw new Error(`xiaoXian age must be a positive integer, got ${age}`);
  }
  const start = branchIndex(xiaoXianStartBranch(yearBranch));
  return branchAt(start + xiaoXianDirection(sex) * (age - 1));
}

/** 一輪十二宮小限序列（預設虛歲 1..12） */
export function xiaoXianSequence(
  yearBranch: BranchId,
  sex: 'male' | 'female',
  from = 1,
  to = 12
): Array<{ age: number; branch: BranchId }> {
  const out: Array<{ age: number; branch: BranchId }> = [];
  for (let age = from; age <= to; age++) {
    out.push({ age, branch: xiaoXianBranchAtAge(yearBranch, sex, age) });
  }
  return out;
}

export interface XiaoXianTargetResolution {
  age?: number;
  branch?: BranchId;
  ruleId: string;
  reason?: string;
}

/**
 * 目標日期所落之小限：以「農曆年」計算虛歲後定位。
 *
 * 護欄（與大限相同的年齡慣例）：
 *   - 必須傳入**農曆年**（目標年的農曆年），否則農曆新年前會提早換限。
 *   - 性別未知 → 不猜方向，回傳 reason。
 */
export function xiaoXianForTarget(input: {
  birthLunarYear: number;
  targetLunarYear: number;
  yearBranch: BranchId;
  sex: 'male' | 'female' | 'unknown';
}): XiaoXianTargetResolution {
  if (input.sex === 'unknown') {
    return { ruleId: XIAOXIAN_RULE_ID, reason: 'UNKNOWN_SEX_FOR_CALCULATION' };
  }
  const age = virtualAge(input.birthLunarYear, input.targetLunarYear);
  return {
    ruleId: XIAOXIAN_RULE_ID,
    age,
    branch: xiaoXianBranchAtAge(input.yearBranch, input.sex, age)
  };
}
