import { Solar } from 'lunar-typescript';
import type { BranchId, GanzhiPair, Profile, StemId, TargetDate } from '../core/types.js';
import { BRANCHES, STEMS, branchAt, branchIndex } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';
import { hourBranchFromHour, resolveYearGanzhi } from '../calendar/calendar-engine.js';

/**
 * 限運目標日期之單一正規化來源（spec 2nd §P0-1 / 3rd §P0-2 / §P0-3）。
 *
 * 所有限運 executor（流年 / 流月 / 流日 / 流時）一律讀 ctx.periodTarget，
 * 不得各自把 Gregorian month / day 當作農曆語意使用。
 *
 * 流程：
 *   targetDate → normalizePeriodTarget() → resolveMajorPeriod() → PERIOD_EXECUTION_PLAN
 */
export interface NormalizedPeriodTarget {
  /** 目標之國曆成分（可能含 representative-date 語意，見 spec §targetDate 契約） */
  solar: {
    year: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
  };
  /** 目標之農曆成分 */
  lunar: {
    year: number;
    month?: number;
    day?: number;
    isLeapMonth?: boolean;
  };
  /**
   * 經 leapMonthPolicy 處理後、供限運定位使用之有效農曆月序。
   * 僅當有 month/day 時存在。
   */
  effectiveLunarMonth?: number;
  /**
   * 當 target 未含 day 但有 month 時，流月以該月 15 日作代表日（spec §targetDate 契約）。
   */
  isRepresentativeDate: boolean;
  /** 目標日期各層真實干支（年柱依 profile.yearBoundaryPolicy 解析，spec §P1-3） */
  ganzhi: {
    year: GanzhiPair;
    month?: GanzhiPair;
    day?: GanzhiPair;
    hour?: GanzhiPair;
  };
  /** 目標時辰地支（僅當 target 提供 hour） */
  hourBranch?: BranchId;
  /** 提供之精度（year-only | month | day | hour） */
  granularity: 'year' | 'month' | 'day' | 'hour';
  /**
   * 年柱所屬年度（spec 3rd §P1-4）：
   * lunar-new-year 制 = 農曆年；lichun 制在農曆年後、立春前會落在前一年度。
   */
  resolvedYear: number;
  /** 年柱換年分界策略（spec 3rd §P0-2） */
  yearBoundaryPolicy: 'lunar-new-year' | 'lichun';
}

const STEMS_ZH = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES_ZH = '子丑寅卯辰巳午未申酉戌亥';

function gzToPair(gz: string): GanzhiPair {
  return {
    stem: STEMS[STEMS_ZH.indexOf(gz[0])],
    branch: BRANCHES[BRANCHES_ZH.indexOf(gz[1])]
  };
}

/**
 * 流月干支：農曆月五虎遁（年上起月）。
 *
 * 甲己之年丙作首、乙庚之歲戊為頭、丙辛必定尋庚起、丁壬壬位順行流、戊癸甲寅之上求。
 * 以「流年天干 + 有效農曆月序」定流月干；月支自寅宮起順數（正月 = 寅）。
 *
 * owner 於 2026-09-24 裁定：流月天干採農曆月五虎遁（不再採四柱節氣月柱），
 * 與斗君流月定位一致，並與外部實作對齊（spec 3rd §P0-4 補述 / RSH.PERIOD.MONTH_STEM）。
 */
const MONTH_STEM_SEED: Record<StemId, number> = {
  jia: 2, ji: 2,
  yi: 4, geng: 4,
  bing: 6, xin: 6,
  ding: 8, ren: 8,
  wu: 0, gui: 0
};

export function monthlyGanzhiFromLunar(yearStem: StemId, effectiveLunarMonth: number): GanzhiPair {
  const seed = MONTH_STEM_SEED[yearStem];
  const stemIdx = (((seed + (effectiveLunarMonth - 1)) % 10) + 10) % 10;
  const branchIdx = (((2 + (effectiveLunarMonth - 1)) % 12) + 12) % 12;
  return { stem: STEMS[stemIdx], branch: BRANCHES[branchIdx] };
}

/**
 * 真實日期驗證（spec §P0-5）：不得靠 JS Date rollover 默默接受 2025-02-31。
 */
export function validateSolarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return false;
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= dim;
}

/**
 * 依 profile.leapMonthPolicy 求限運定位之有效農曆月序（spec §P0-7）。
 */
export function resolveEffectiveLunarMonth(
  lunarMonth: number,
  lunarDay: number,
  isLeapMonth: boolean,
  leapMonthPolicy: string
): number {
  if (!isLeapMonth) return lunarMonth;
  switch (leapMonthPolicy) {
    case 'same-as-normal':
      // 閏五月視同五月
      return lunarMonth;
    case 'next-month':
      // 閏五月視同六月（次月）
      return ((lunarMonth) % 12) + 1;
    case 'mid-month':
      // 閏月初一~十五 → 本月；十六~月底 → 次月
      return lunarDay <= 15 ? lunarMonth : ((lunarMonth) % 12) + 1;
    case 'split':
      // 現行 Period model 無法表達 13/14 個流月，明確報錯而非假裝支援
      throw new ZiWeiError(
        'UNSUPPORTED_PROFILE',
        'leapMonthPolicy "split" is not supported by the current period model',
        { leapMonthPolicy }
      );
    default:
      throw new ZiWeiError(
        'UNSUPPORTED_PROFILE',
        `Unknown leapMonthPolicy: ${leapMonthPolicy}`,
        { leapMonthPolicy }
      );
  }
}

/**
 * 單獨解析年度目標（spec 3rd §P0-3）：
 * 當 targetDate 只有 year 時，不得偷偷捏造 1 月 15 日，
 * 應以該年年中（6 月 1 日，避開立春與新年前後交界）由 yearBoundaryPolicy 解析該年之真實年柱干支。
 */
export function normalizeAnnualTarget(year: number, profile: Profile): {
  lunarYear: number;
  ganzhiYear: GanzhiPair;
} {
  const midSolar = Solar.fromYmd(year, 6, 1);
  const midLunar = midSolar.getLunar();
  const policy = profile.yearBoundaryPolicy ?? 'lunar-new-year';
  const ganzhiYear = resolveYearGanzhi(midLunar, policy);
  return {
    lunarYear: midLunar.getYear(),
    ganzhiYear
  };
}

/**
 * 將 TargetDate 正規化為限運可用之單一來源。
 * 擲回：INVALID_TARGET_DATE（缺欄位順序錯或日期不存在）、UNSUPPORTED_PROFILE。
 */
export function normalizePeriodTarget(target: TargetDate, profile: Profile): NormalizedPeriodTarget {
  const yearPolicy = profile.yearBoundaryPolicy ?? 'lunar-new-year';

  // 1. 純年度目標（year-only）：不得捏造 1 月 15 日（spec 3rd §P0-3）
  if (target.month === undefined) {
    const annual = normalizeAnnualTarget(target.year, profile);
    return {
      solar: { year: target.year },
      lunar: { year: annual.lunarYear },
      isRepresentativeDate: false,
      ganzhi: { year: annual.ganzhiYear },
      granularity: 'year',
      resolvedYear: annual.lunarYear,
      yearBoundaryPolicy: yearPolicy
    };
  }

  // 2. 有月份：驗證真實日期
  const month = target.month;
  const isRepresentativeDate = target.day === undefined;
  const day = target.day ?? 15;
  const hour = target.hour;
  const minute = target.minute;

  if (!validateSolarDate(target.year, month, day)) {
    throw new ZiWeiError(
      'INVALID_TARGET_DATE',
      `targetDate is not a real solar date: ${target.year}-${month}-${day}`,
      { target }
    );
  }

  const solar = Solar.fromYmd(target.year, month, day);
  const lunar = solar.getLunar();
  const isLeap = lunar.getMonth() < 0;
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();

  const effectiveLunarMonth = resolveEffectiveLunarMonth(
    lunarMonth, lunarDay, isLeap, profile.leapMonthPolicy
  );

  const ganzhiYear = resolveYearGanzhi(lunar, yearPolicy);

  // 年柱所屬年度（spec 3rd §P1-4）：
  // lunar-new-year → 即農曆年
  // lichun → 若農曆年後、立春前，年柱仍屬前一年度
  const lunarYearOfDate = lunar.getYear();
  let resolvedYear = lunarYearOfDate;
  if (yearPolicy === 'lichun' && lunar.getYearInGanZhiExact() !== lunar.getYearInGanZhi()) {
    resolvedYear = lunarYearOfDate - 1;
  }

  const ganzhi: NormalizedPeriodTarget['ganzhi'] = {
    year: ganzhiYear,
    // 流月干支：農曆月五虎遁（owner 決策，spec 3rd §P0-4 補述）
    month: monthlyGanzhiFromLunar(ganzhiYear.stem, effectiveLunarMonth),
    day: isRepresentativeDate ? undefined : gzToPair(lunar.getDayInGanZhi())
  };

  let hourBranch: BranchId | undefined;
  if (hour !== undefined && !isRepresentativeDate) {
    const lunarH = Solar.fromYmdHms(target.year, month, day, hour, minute ?? 0, 0).getLunar();
    ganzhi.hour = gzToPair(lunarH.getTimeInGanZhi());
    hourBranch = hourBranchFromHour(hour);
  }

  const granularity: NormalizedPeriodTarget['granularity'] =
    hour !== undefined ? 'hour' : target.day !== undefined ? 'day' : 'month';

  return {
    solar: { year: target.year, month, day: target.day, hour, minute },
    lunar: { year: lunar.getYear(), month: lunarMonth, day: target.day ? lunarDay : undefined, isLeapMonth: isLeap },
    effectiveLunarMonth,
    isRepresentativeDate,
    ganzhi,
    hourBranch,
    granularity,
    resolvedYear,
    yearBoundaryPolicy: yearPolicy
  };
}

/** 取得某層級之「命宮地支」：自 yearPeriod.branch 起順數（正月起） */
export function monthLifeBranch(yearLifeBranch: BranchId, effectiveLunarMonth: number): BranchId {
  return branchAt(branchIndex(yearLifeBranch) + (effectiveLunarMonth - 1));
}

/** 流日命宮地支：自流月命宮起初一順數至當日（農曆日） */
export function dayLifeBranch(monthLifeBranch: BranchId, lunarDay: number): BranchId {
  return branchAt(branchIndex(monthLifeBranch) + (lunarDay - 1));
}
