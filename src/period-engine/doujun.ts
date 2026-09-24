import type { BranchId } from '../core/types.js';
import { branchAt, branchIndex } from '../core/constants.js';
import { resolveEffectiveLunarMonth } from './period-target.js';

/**
 * 斗君計算（spec 3rd §P0-4 / §1. 斗君建議實作）。
 *
 * 《紫微斗數全書》安子斗訣：
 * 「流年歲建起正月，逆數生月；由該宮起子時，順數到生時。所得為當年斗君，即流年正月之命宮。」
 *
 * 流月命宮即以此斗君宮為正月，順數至目標農曆月（經 leapMonthPolicy 處理）。
 */
export interface DouJunInput {
  /** 流年歲建地支（流年干支之地支，如丙午年為 'wu'） */
  yearBranch: BranchId;
  /** 出生資訊 */
  birth: {
    lunarMonth: number;
    lunarDay: number;
    isLeapMonth: boolean;
    hourBranch: BranchId;
  };
  /** 閏月處理政策（影響出生閏月落月） */
  leapMonthPolicy: string;
}

export function resolveDouJun(input: DouJunInput): BranchId {
  const { yearBranch, birth, leapMonthPolicy } = input;

  // 出生若為閏月，依 profile.leapMonthPolicy 決定有效生月（spec 3rd §531）
  const effectiveBirthMonth = resolveEffectiveLunarMonth(
    birth.lunarMonth,
    birth.lunarDay,
    birth.isLeapMonth,
    leapMonthPolicy
  );

  // 1. 流年歲建起正月，逆數出生月
  // 歲建為正月 (offset 0)，二月為 -1 ... effectiveBirthMonth 為 -(effectiveBirthMonth - 1)
  const baseIdx = branchIndex(yearBranch);
  const monthStep = - (effectiveBirthMonth - 1);
  const monthPos = baseIdx + monthStep;

  // 2. 由該宮起子時，順數到出生時
  // 子時 offset 0，生時為 branchIndex(birthHourBranch)
  const hourStep = branchIndex(birth.hourBranch);
  const douJunIdx = monthPos + hourStep;

  return branchAt(douJunIdx);
}

/**
 * 流月命宮：自當年斗君（正月命宮）起，順數至目標有效農曆月。
 */
export function monthLifeBranchFromDouJun(douJun: BranchId, targetEffectiveLunarMonth: number): BranchId {
  return branchAt(branchIndex(douJun) + (targetEffectiveLunarMonth - 1));
}
