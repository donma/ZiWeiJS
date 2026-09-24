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
import { sihuaForStem } from '../../src/executors/star-executors.js';

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
  field: 'stem' | 'branch' | 'lifePalaceBranch' | 'sihua.lu' | 'sihua.quan' | 'sihua.ke' | 'sihua.ji';
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

/** iztro mutagen 固定順序：[祿, 權, 科, 忌] 之星名 */
const IZTRO_MUTAGEN_ORDER: Array<'lu' | 'quan' | 'ke' | 'ji'> = ['lu', 'quan', 'ke', 'ji'];

/** 由 iztro scope 的 mutagen 陣列取得指定四化之星曜 ID */
function iztroSihuaId(scope: IztroHoroscopeLikeScope, type: 'lu' | 'quan' | 'ke' | 'ji'): string | undefined {
  const idx = IZTRO_MUTAGEN_ORDER.indexOf(type);
  const name = scope.mutagen?.[idx];
  if (!name) return undefined;
  return toStarId(name) ?? undefined;
}

export interface CompareOptions {
  /** 目標時辰（0-23）。23:00 之流日差異屬換日慣例（day-boundary-variance） */
  targetHour?: number;
}

export function comparePeriodWithIztro(
  chart: ZiWeiChart,
  iztroH: IztroHoroscopeLike,
  options: CompareOptions = {}
): PeriodDiffRow[] {
  const rows: PeriodDiffRow[] = [];
  // 23:00 子時：本引擎依 profile.dayBoundary 換日，iztro 內部以固定慣例處理，
  // 差異屬換日慣例而非 bug（spec 3rd §P1-5 分類要求）
  const isLateZi = options.targetHour === 23;

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

  /** 推入該層四化（lu/quan/ke/ji 各自一列，spec 3rd §P0-6） */
  const pushSihua = (
    scope: PeriodDiffRow['scope'],
    stem: string | undefined,
    iztroScope: IztroHoroscopeLikeScope,
    defaultClass: DiffClassification
  ) => {
    if (!stem) return;
    const bibleSihua = sihuaForStem(stem as never);
    for (const type of IZTRO_MUTAGEN_ORDER) {
      const bibleStar = bibleSihua.find(s => s.type === type)?.starId;
      push(scope, `sihua.${type}` as PeriodDiffRow['field'], bibleStar, iztroSihuaId(iztroScope, type), defaultClass);
    }
  };

  // 1. 大限
  const decadalMajor = chart.periods.active?.major;
  if (decadalMajor) {
    push('decadal', 'stem', decadalMajor.ganzhi?.stem, toStemId(iztroH.decadal.heavenlyStem), 'bug');
    push('decadal', 'branch', decadalMajor.ganzhi?.branch, toBranchId(iztroH.decadal.earthlyBranch), 'bug');
    push('decadal', 'lifePalaceBranch', decadalMajor.branch, iztroLifeBranch(iztroH.decadal, iztroH.astrolabe), 'bug');
    pushSihua('decadal', decadalMajor.ganzhi?.stem, iztroH.decadal, 'school-variance');
  }

  // 2. 流年
  const y = chart.periods.year;
  if (y) {
    push('yearly', 'stem', y.ganzhi?.stem, toStemId(iztroH.yearly.heavenlyStem), 'calendar-variance');
    push('yearly', 'branch', y.ganzhi?.branch, toBranchId(iztroH.yearly.earthlyBranch), 'calendar-variance');
    push('yearly', 'lifePalaceBranch', y.branch, iztroLifeBranch(iztroH.yearly, iztroH.astrolabe), 'school-variance');
    pushSihua('yearly', y.ganzhi?.stem, iztroH.yearly, 'calendar-variance');
  }

  // 3. 流月
  const m = chart.periods.month;
  if (m) {
    push('monthly', 'stem', m.ganzhi?.stem, toStemId(iztroH.monthly.heavenlyStem), 'calendar-variance');
    push('monthly', 'branch', m.ganzhi?.branch, toBranchId(iztroH.monthly.earthlyBranch), 'calendar-variance');
    push('monthly', 'lifePalaceBranch', m.branch, iztroLifeBranch(iztroH.monthly, iztroH.astrolabe), 'school-variance');
    pushSihua('monthly', m.ganzhi?.stem, iztroH.monthly, 'calendar-variance');
  }

  // 4. 流日
  const d = chart.periods.day;
  if (d) {
    const dailyClass: DiffClassification = isLateZi ? 'day-boundary-variance' : 'calendar-variance';
    push('daily', 'stem', d.ganzhi?.stem, toStemId(iztroH.daily.heavenlyStem), dailyClass);
    push('daily', 'branch', d.ganzhi?.branch, toBranchId(iztroH.daily.earthlyBranch), dailyClass);
    push('daily', 'lifePalaceBranch', d.branch, iztroLifeBranch(iztroH.daily, iztroH.astrolabe), dailyClass);
    pushSihua('daily', d.ganzhi?.stem, iztroH.daily, dailyClass);
  }

  // 5. 流時
  const h = chart.periods.hour;
  if (h) {
    push('hourly', 'stem', h.ganzhi?.stem, toStemId(iztroH.hourly.heavenlyStem), 'time-basis-variance');
    push('hourly', 'branch', h.ganzhi?.branch, toBranchId(iztroH.hourly.earthlyBranch), 'time-basis-variance');
    push('hourly', 'lifePalaceBranch', h.branch, iztroLifeBranch(iztroH.hourly, iztroH.astrolabe), 'school-variance');
    pushSihua('hourly', h.ganzhi?.stem, iztroH.hourly, 'time-basis-variance');
  }

  return rows;
}
