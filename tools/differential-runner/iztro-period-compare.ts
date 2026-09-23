/**
 * iztro 限運對照核心（供 CLI 與 vitest 共用，spec 2nd §P0-9）
 *
 * 比對五層限運（大限 / 流年 / 流月 / 流日 / 流時）：
 *   - stem / branch（干支）
 *   - palace branch（限運命宮位置）
 *   - sihua / mutagen（四化）
 *
 * 差異一律分類（禁止 unclassified 進入通過狀態）：
 *   school-variance | calendar-variance | time-basis-variance |
 *   day-boundary-variance | leap-month-variance | bug | external-error
 */
import type { ZiWeiChart, BranchId, StemId } from '../../src/index.js';
import { BRANCH_ZH, BRANCH_ID, toStarId, type DiffClassification } from './iztro-compare.js';

export interface IztroHoroscopeLikeScope {
  heavenlyStem: string;
  earthlyBranch: string;
  index: number;
  mutagen?: string[];
}

export interface IztroHoroscopeLike {
  decadal: IztroHoroscopeLikeScope;
  yearly: IztroHoroscopeLikeScope;
  monthly: IztroHoroscopeLikeScope;
  daily: IztroHoroscopeLikeScope;
  hourly: IztroHoroscopeLikeScope;
  astrolabe: {
    palaces: Array<{ earthlyBranch: string }>;
  };
}

export interface PeriodDiffRow {
  scope: 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
  field: 'stem' | 'branch' | 'lifePalaceBranch' | 'sihua';
  bible: string | undefined;
  external: string | undefined;
  status: 'match' | 'needs-review';
  classification?: DiffClassification;
}

const STEM_ZH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STEM_ID: StemId[] = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];

function toStemId(zh: string): StemId {
  return STEM_ID[STEM_ZH.indexOf(zh)];
}

function toBranchId(zh: string): BranchId {
  return BRANCH_ID[BRANCH_ZH.indexOf(zh)];
}

/** 取得 iztro scope 指定宮位 index 的地支（命宮位置） */
function iztroLifeBranch(scope: IztroHoroscopeLikeScope, astrolabe: IztroHoroscopeLike['astrolabe']): BranchId {
  const p = astrolabe.palaces[scope.index];
  return p ? toBranchId(p.earthlyBranch) : toBranchId(scope.earthlyBranch);
}

export function comparePeriodWithIztro(
  chart: ZiWeiChart,
  iztroH: IztroHoroscopeLike
): PeriodDiffRow[] {
  const rows: PeriodDiffRow[] = [];

  const push = (
    scope: PeriodDiffRow['scope'],
    field: PeriodDiffRow['field'],
    bible: string | undefined,
    external: string | undefined,
    defaultClass: DiffClassification = 'school-variance'
  ) => {
    const match = bible !== undefined && external !== undefined && bible === external;
    rows.push({
      scope,
      field,
      bible,
      external,
      status: match ? 'match' : 'needs-review',
      classification: match ? undefined : defaultClass
    });
  };

  // 1. 大限
  const decadalMajor = chart.periods.active?.major;
  if (decadalMajor) {
    push('decadal', 'stem', decadalMajor.ganzhi?.stem, toStemId(iztroH.decadal.heavenlyStem), 'bug');
    push('decadal', 'branch', decadalMajor.ganzhi?.branch, toBranchId(iztroH.decadal.earthlyBranch), 'bug');
    push('decadal', 'lifePalaceBranch', decadalMajor.branch, iztroLifeBranch(iztroH.decadal, iztroH.astrolabe), 'bug');
  }

  // 2. 流年
  const y = chart.periods.year;
  if (y) {
    push('yearly', 'stem', y.ganzhi?.stem, toStemId(iztroH.yearly.heavenlyStem), 'calendar-variance');
    push('yearly', 'branch', y.ganzhi?.branch, toBranchId(iztroH.yearly.earthlyBranch), 'calendar-variance');
    push('yearly', 'lifePalaceBranch', y.branch, iztroLifeBranch(iztroH.yearly, iztroH.astrolabe), 'school-variance');
  }

  // 3. 流月
  const m = chart.periods.month;
  if (m) {
    push('monthly', 'stem', m.ganzhi?.stem, toStemId(iztroH.monthly.heavenlyStem), 'calendar-variance');
    push('monthly', 'branch', m.ganzhi?.branch, toBranchId(iztroH.monthly.earthlyBranch), 'calendar-variance');
    push('monthly', 'lifePalaceBranch', m.branch, iztroLifeBranch(iztroH.monthly, iztroH.astrolabe), 'school-variance');
  }

  // 4. 流日
  const d = chart.periods.day;
  if (d) {
    push('daily', 'stem', d.ganzhi?.stem, toStemId(iztroH.daily.heavenlyStem), 'calendar-variance');
    push('daily', 'branch', d.ganzhi?.branch, toBranchId(iztroH.daily.earthlyBranch), 'calendar-variance');
    push('daily', 'lifePalaceBranch', d.branch, iztroLifeBranch(iztroH.daily, iztroH.astrolabe), 'school-variance');
  }

  // 5. 流時
  const h = chart.periods.hour;
  if (h) {
    push('hourly', 'stem', h.ganzhi?.stem, toStemId(iztroH.hourly.heavenlyStem), 'time-basis-variance');
    push('hourly', 'branch', h.ganzhi?.branch, toBranchId(iztroH.hourly.earthlyBranch), 'time-basis-variance');
    push('hourly', 'lifePalaceBranch', h.branch, iztroLifeBranch(iztroH.hourly, iztroH.astrolabe), 'school-variance');
  }

  return rows;
}
