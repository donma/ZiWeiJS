import { Solar } from 'lunar-typescript';
import type { BranchId, GanzhiPair, Profile, TargetDate } from '../core/types.js';
import { BRANCHES, STEMS, branchAt, branchIndex } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';
import { hourBranchFromHour } from '../calendar/calendar-engine.js';

/**
 * 限運目標日期之單一正規化來源（spec 2nd-round §P0-1 / §建議重構後流程）。
 *
 * 所有限運 executor（流月 / 流日 / 流時）一律讀 ctx.periodTarget，
 * 不得各自把 Gregorian month / day 當作農曆語意使用。
 *
 * 流程：
 *   targetDate → normalizePeriodTarget() → resolveMajorPeriod() → PERIOD_EXECUTION_PLAN
 */
export interface NormalizedPeriodTarget {
  /** 目標之國曆成分（可能含 representative-date 語意，見 spec §targetDate 契約） */
  solar: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  };
  /** 目標之農曆成分（以「代表日」換算） */
  lunar: {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
  };
  /**
   * 經 leapMonthPolicy 處理後、供限運定位使用之有效農曆月序。
   * - same-as-normal：閏五月 → 五月（保持原月序）
   * - next-month   ：閏五月 → 六月
   * - mid-month    ：閏月初一~十五 → 本月；十六~月底 → 次月
   * - split        ：目前資料模型不支援 → normalize 時即丟 UNSUPPORTED_PROFILE
   */
  effectiveLunarMonth: number;
  /**
   * 當 target 未含 day 時，流月以該月 15 日作代表日（spec §targetDate 契約）。
   * 使用方不得假設整個 Gregorian month 只有唯一流月。
   */
  isRepresentativeDate: boolean;
  /** 目標日期各層真實干支（由 lunar-typescript 以實際日期推算） */
  ganzhi: {
    year: GanzhiPair;
    month: GanzhiPair;
    day: GanzhiPair;
    hour?: GanzhiPair;
  };
  /** 目標時辰地支（僅當 target 提供 hour） */
  hourBranch?: BranchId;
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
 * 將 TargetDate 正規化為限運可用之單一來源。
 * 擲回：INVALID_TARGET_DATE（缺欄位順序錯或日期不存在）、UNSUPPORTED_PROFILE。
 */
export function normalizePeriodTarget(target: TargetDate, profile: Profile): NormalizedPeriodTarget {
  // 代表日：無 day 時以該月 15 日換算農曆（spec §targetDate 契約）
  const isRepresentativeDate = target.day === undefined;
  const month = target.month ?? 1;
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

  const ganzhi: NormalizedPeriodTarget['ganzhi'] = {
    year: gzToPair(lunar.getYearInGanZhi()),
    month: gzToPair(lunar.getMonthInGanZhi()),
    day: gzToPair(lunar.getDayInGanZhi())
  };

  let hourBranch: BranchId | undefined;
  if (hour !== undefined) {
    // 時柱需帶入完整日期（日 + 時），minute 目前用於時柱精細度
    const lunarH = Solar.fromYmdHms(target.year, month, day, hour, minute ?? 0, 0).getLunar();
    ganzhi.hour = gzToPair(lunarH.getTimeInGanZhi());
    hourBranch = hourBranchFromHour(hour);
  }

  return {
    solar: { year: target.year, month, day, hour, minute },
    lunar: { year: lunar.getYear(), month: lunarMonth, day: lunarDay, isLeapMonth: isLeap },
    effectiveLunarMonth,
    isRepresentativeDate,
    ganzhi,
    hourBranch
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
