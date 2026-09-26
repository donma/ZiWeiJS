/**
 * 補充安星計算模組（spec Post-Stability Phase B/C）。
 *
 * 現況（0.5.0）：
 *   - 台輔 / 封誥 / 解神（年解）：**canonical**，經 Owner 於 2026-09-24 批准，
 *     由 `ZW.CALC.STAR.TAIFU_FENGGAO.001` / `ZW.CALC.STAR.JIESHEN.001` 於 natal 階段安置。
 *   - 小限：仍為 **candidate**（`ZW.CALC.PERIOD.XIAOXIAN.001`，stage=on-demand），
 *     未併入 canonical 限運輸出；須待 Owner 批准。
 *
 * 護欄：
 *   - AI 不得將 candidate 升為 canonical（`canPromoteStatus()`）。
 *   - 安星依據：《紫微斗數全書》卷二「安星訣」原文，並以**兩份互相獨立**之電子文本
 *     （SRC.QUANSHU.WIKISOURCE、SRC.QUANSHU.DIANCANG）逐字核對相符。
 */
import { branchAt, branchIndex } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';
import type { BranchId } from '../core/types.js';
import { virtualAge } from '../period-engine/major-period-resolver.js';
import supplementaryTables from '../../tables/stars/aux-supplementary-tables.json' with { type: 'json' };

export const TAIFU_FENGGAO_RULE_ID = 'ZW.CALC.STAR.TAIFU_FENGGAO.001';
export const JIESHEN_RULE_ID = 'ZW.CALC.STAR.JIESHEN.001';
export const TIANWU_RULE_ID = 'ZW.CALC.STAR.TIANWU.001';
export const TIANCAI_TIANSHOU_RULE_ID = 'ZW.CALC.STAR.TIANCAI_TIANSHOU.001';
export const XIAOXIAN_RULE_ID = 'ZW.CALC.PERIOD.XIAOXIAN.001';

export type SupplementaryBasis = 'hour-branch' | 'year-branch' | 'lunar-month' | 'year-branch-life' | 'year-branch-body';

export interface SupplementaryStarPlacement {
  starId: string;
  branch: BranchId;
  ruleId: string;
  basis: SupplementaryBasis;
  /** 安星口訣（原文照錄，便於溯源） */
  formula: string;
}

const BY_HOUR = supplementaryTables.byHourBranch as unknown as Record<
  string,
  { startBranch: string; direction: number } | string
>;
const BY_YEAR_BRANCH = supplementaryTables.byYearBranch as unknown as Record<
  string,
  { startBranch: string; direction: number } | string
>;

const XIAOXIAN_START = supplementaryTables.xiaoXian.startByGroup as unknown as Record<string, string>;

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

const TIANWU_CYCLE: BranchId[] = ['si', 'shen', 'yin', 'hai'];

/** 天巫：生月系，正五九在巳、二六十在申、三七十一在寅、四八十二在亥 */
export function placeTianWu(lunarMonth: number): BranchId {
  if (lunarMonth < 1 || lunarMonth > 12) {
    throw new ZiWeiError('INVALID_INPUT', `lunarMonth must be 1..12, got ${lunarMonth}`, { lunarMonth });
  }
  return TIANWU_CYCLE[(lunarMonth - 1) % 4];
}

/** 天才：由命宮起子，順行至本生年支 */
export function placeTianCai(lifePalaceBranch: BranchId, yearBranch: BranchId): BranchId {
  return branchAt(branchIndex(lifePalaceBranch) + branchIndex(yearBranch));
}

/** 天壽：由身宮起子，順行至本生年支 */
export function placeTianShou(bodyPalaceBranch: BranchId, yearBranch: BranchId): BranchId {
  return branchAt(branchIndex(bodyPalaceBranch) + branchIndex(yearBranch));
}

const FORMULA = {
  taifu: '由午宮起子順數至本生時安之',
  fenggao: '由寅起宮子順數至本生時安之',
  jieshen: '解神從戌上起子，逆數至當生年太歲是也',
  tianwu: '巳申寅亥天巫位，分輪十二月星君',
  tiancai: '命宮起子天才順，順至生年支安之',
  tianshou: '身宮起子天壽堂，順至生年支安之'
} as const;

/** 補充輔星（台輔／封誥／解神／天巫／天才／天壽）之安星結果 */
export function supplementaryAuxStars(input: {
  hourBranch: BranchId;
  yearBranch: BranchId;
  lunarMonth?: number;
  lifePalaceBranch?: BranchId;
  bodyPalaceBranch?: BranchId;
}): SupplementaryStarPlacement[] {
  const list: SupplementaryStarPlacement[] = [
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

  if (input.lunarMonth !== undefined) {
    list.push({
      starId: 'ZW.STAR.AUX.TIANWU',
      branch: placeTianWu(input.lunarMonth),
      ruleId: TIANWU_RULE_ID,
      basis: 'lunar-month',
      formula: FORMULA.tianwu
    });
  }

  if (input.lifePalaceBranch !== undefined) {
    list.push({
      starId: 'ZW.STAR.AUX.TIANCAI',
      branch: placeTianCai(input.lifePalaceBranch, input.yearBranch),
      ruleId: TIANCAI_TIANSHOU_RULE_ID,
      basis: 'year-branch-life',
      formula: FORMULA.tiancai
    });
  }

  if (input.bodyPalaceBranch !== undefined) {
    list.push({
      starId: 'ZW.STAR.AUX.TIANSHOU',
      branch: placeTianShou(input.bodyPalaceBranch, input.yearBranch),
      ruleId: TIANCAI_TIANSHOU_RULE_ID,
      basis: 'year-branch-body',
      formula: FORMULA.tianshou
    });
  }

  return list;
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
    throw new ZiWeiError('INVALID_INPUT', `xiaoXian age must be a positive integer, got ${age}`, { age });
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
  if (age < 1) {
    // 目標日期尚未進入一歲小限（含目標早於出生之負虛歲）：不猜、不落宮（M8 corpus 發現）
    return { ruleId: XIAOXIAN_RULE_ID, age, reason: 'TARGET_BEFORE_FIRST_XIAOXIAN' };
  }
  return {
    ruleId: XIAOXIAN_RULE_ID,
    age,
    branch: xiaoXianBranchAtAge(input.yearBranch, input.sex, age)
  };
}
