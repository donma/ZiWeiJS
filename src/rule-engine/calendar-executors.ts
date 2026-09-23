import type { EngineContext } from '../executors/context.js';
import type { ExecutorOutcome } from './executor-registry.js';

/**
 * 曆法層規則的驗證型 executor。
 *
 * 國曆↔農曆轉換 / 四柱干支 / 真太陽時必須在 EngineContext 建立「之前」完成，
 * 因此其實作位於 src/calendar/calendar-engine.ts（normalizeBirth）。
 * 本檔提供受 Rule Registry 驅動的驗證 executor，讓這些規則同樣具備
 * ruleId / ruleVersion / sourceRefs / evidenceRefs 的 Trace 溯源（spec §42）。
 */
export function verifySolarLunar(ctx: EngineContext): ExecutorOutcome {
  const { solar, lunar } = ctx.normalized;
  return {
    inputs: { calendarType: ctx.input.calendarType, input: ctx.input.date },
    result: {
      solar: `${solar.year}-${solar.month}-${solar.day}`,
      lunar: `${lunar.year}-${lunar.month}-${lunar.day}${lunar.isLeapMonth ? '(leap)' : ''}`
    }
  };
}

export function verifyGanzhi(ctx: EngineContext): ExecutorOutcome {
  const g = ctx.normalized.ganzhi;
  return {
    inputs: { hourBranch: ctx.normalized.hourBranch, dayBoundary: ctx.input.dayBoundary ?? ctx.profile.dayBoundary },
    result: {
      year: `${g.year.stem}-${g.year.branch}`,
      month: `${g.month.stem}-${g.month.branch}`,
      day: `${g.day.stem}-${g.day.branch}`,
      hour: `${g.hour.stem}-${g.hour.branch}`
    }
  };
}

export function verifyTrueSolar(ctx: EngineContext): ExecutorOutcome {
  const offset = ctx.normalized.trueSolarOffsetMinutes;
  const convention = ctx.input.timeConvention ?? ctx.profile.timeConvention;
  if (convention !== 'true-solar' && convention !== 'local-mean-solar') {
    return {
      inputs: { timeConvention: convention },
      result: null,
      status: 'skipped',
      reason: 'TIME_CONVENTION_NOT_SOLAR'
    };
  }
  return {
    inputs: {
      timeConvention: convention,
      longitude: ctx.input.location?.longitude,
      inputHour: ctx.input.time?.hour
    },
    result: { trueSolarOffsetMinutes: offset, effectiveHour: ctx.normalized.hour }
  };
}
