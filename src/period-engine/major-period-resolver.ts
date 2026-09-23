import type { MajorPeriod, TargetDate } from '../core/types.js';
import { ZiWeiError } from '../core/errors.js';

/**
 * 虛歲：以農曆生年與目標年份計算（紫微斗數大限慣例）。
 * 虛歲 = targetYear − birthLunarYear + 1
 */
export function virtualAge(birthLunarYear: number, targetYear: number): number {
  return targetYear - birthLunarYear + 1;
}

/** 依 profile.periodRules.ageMethod 計算年齡（預設 virtual-age） */
export function ageAt(
  birthLunarYear: number,
  target: Pick<TargetDate, 'year'>,
  ageMethod: string = 'virtual-age'
): number {
  switch (ageMethod) {
    case 'virtual-age':
      return virtualAge(birthLunarYear, target.year);
    default:
      throw new ZiWeiError(
        'UNSUPPORTED_PROFILE',
        `Unsupported periodRules.ageMethod: ${ageMethod}`,
        { ageMethod }
      );
  }
}

export interface MajorPeriodResolution {
  age: number;
  period?: MajorPeriod;
  /** 無法判定時的原因（例如性別未知，或年齡超出大限範圍） */
  reason?: string;
}

/**
 * 求出目標年齡所在之大限。
 *
 * - 方向未定（性別未知）→ 不猜，回傳 reason
 * - 小於起運歲 → 童限（未上運），回傳 reason
 * - 超出 12 個大限範圍 → 回傳 reason
 */
export function resolveMajorPeriod(
  majorPeriods: MajorPeriod[],
  age: number,
  direction: 'forward' | 'backward' | 'undetermined'
): MajorPeriodResolution {
  if (direction === 'undetermined') {
    return { age, reason: 'UNKNOWN_SEX_FOR_CALCULATION' };
  }
  if (majorPeriods.length === 0) {
    return { age, reason: 'NO_MAJOR_PERIODS' };
  }
  const first = majorPeriods[0].fromAge;
  if (age < first) {
    return { age, reason: 'BELOW_FIRST_MAJOR_PERIOD' };
  }
  const hit = majorPeriods.find(p => age >= p.fromAge && age <= p.toAge);
  if (!hit) {
    return { age, reason: 'ABOVE_LAST_MAJOR_PERIOD' };
  }
  return { age, period: hit };
}
