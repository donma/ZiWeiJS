import type {
  ZiWeiBirthInput, ZiWeiChart, CalculateOptions, Profile,
  Certainty
} from '../core/types.js';
import { SCHEMA_VERSION, BIBLE_VERSION, ENGINE_VERSION, BUREAU_NAME, STEM_YINYANG } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';
import { getProfile, getRule } from '../rule-engine/registry.js';
import type { Rule } from '../core/types.js';
import { normalizeBirth, buildCalendarInfo } from '../calendar/calendar-engine.js';
import { Tracer } from '../trace/tracer.js';
import type { EngineContext } from '../executors/context.js';
import { registerAllExecutors } from '../rule-engine/register-executors.js';
import { executePlan } from '../rule-engine/execute-rule.js';
import { NATAL_EXECUTION_PLAN, PERIOD_EXECUTION_PLAN } from '../rule-engine/execution-plan.js';
import { ageAt, resolveMajorPeriod } from '../period-engine/major-period-resolver.js';
import { runInterpretation, groupByDomain, runPatterns } from '../interpretation-engine/interpretation-engine.js';
import type { TargetDate } from '../core/types.js';

/**
 * targetDate 契約（spec §P0-3D）：
 * - year 必填
 * - month 有值但 year 沒值 → INVALID_TARGET_DATE（year 已是必填）
 * - day 有值但 month 沒值 → INVALID_TARGET_DATE
 * - hour 有值但 day 沒值 → INVALID_TARGET_DATE
 * - 數值範圍檢查
 */
function validateTargetDate(target: TargetDate): void {
  if (!Number.isInteger(target.year)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.year is required and must be an integer', { target });
  }
  if (target.month !== undefined && !Number.isInteger(target.month)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.month must be an integer', { target });
  }
  if (target.day !== undefined && !Number.isInteger(target.day)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.day must be an integer', { target });
  }
  if (target.hour !== undefined && !Number.isInteger(target.hour)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.hour must be an integer', { target });
  }
  if (target.day !== undefined && target.month === undefined) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.day requires targetDate.month', { target });
  }
  if (target.hour !== undefined && target.day === undefined) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.hour requires targetDate.day', { target });
  }
  if (target.month !== undefined && (target.month < 1 || target.month > 12)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.month out of range 1-12', { target });
  }
  if (target.day !== undefined && (target.day < 1 || target.day > 31)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.day out of range 1-31', { target });
  }
  if (target.hour !== undefined && (target.hour < 0 || target.hour > 23)) {
    throw new ZiWeiError('INVALID_TARGET_DATE', 'targetDate.hour out of range 0-23', { target });
  }
}

export function calculate(input: ZiWeiBirthInput, options: CalculateOptions = {}): ZiWeiChart {
  const profile = getProfile(options.profile ?? 'canonical');
  const tracer = new Tracer(options.trace === true);

  if (!input.sexForCalculation) {
    throw new ZiWeiError(
      'UNKNOWN_SEX_FOR_CALCULATION',
      'sexForCalculation is required for deterministic calculation (male | female | unknown with unknown-time analysis)'
    );
  }

  const target = options.targetDate;
  if (target) validateTargetDate(target);

  const normalized = normalizeBirth(input, profile);

  const activeRules = new Map<string, Rule>();
  for (const [canonicalId, variantId] of Object.entries(profile.ruleOverrides ?? {})) {
    try {
      activeRules.set(canonicalId, getRule(variantId));
    } catch {
      // 覆寫目標不存在時保留 canonical 行為（由 rule-validator 另行檢查）
    }
  }

  const ctx: EngineContext = {
    input,
    normalized,
    profile,
    tracer,
    targetDate: target,
    sexForCalculation: input.sexForCalculation,
    yinYang: STEM_YINYANG[normalized.ganzhi.year.stem],
    direction: 'undetermined',
    lifePalaceBranch: 'zi',
    bodyPalaceBranch: 'zi',
    palaces: [],
    bureau: 'shui2',
    bureauNumber: 2,
    placements: new Map(),
    transformations: [],
    majorPeriods: [],
    activeRules
  };

  // 順逆行由 ZW.CALC.BIRTH.SEX_DIRECTION.001 規則決定（見 natal execution plan）
  // 性別未知時該規則回報 unavailable，direction 保持 undetermined（spec §27）

  // 規則驅動執行：順序來自 Rule Registry 的 logic.stage / logic.order（spec §P0-1）
  registerAllExecutors();
  executePlan(NATAL_EXECUTION_PLAN, ctx);

  // 限運：只有在提供 targetDate 時才計算；沒有 targetDate 時絕不隱含 now（spec §P0-3E）
  let activePeriods: ZiWeiChart['periods']['active'];
  if (target) {
    // 先解出目標年齡所在之大限，限運四化才能依正確的大限（spec §P0-3A）
    const ageMethod = profile.periodRules?.ageMethod ?? 'virtual-age';
    const age = ageAt(normalized.lunar.year, target, ageMethod);
    const resolution = resolveMajorPeriod(ctx.majorPeriods, age, ctx.direction);
    ctx.activeMajorPeriod = resolution.period;
    activePeriods = {
      age,
      asOf: target,
      major: resolution.period,
      majorSkippedReason: resolution.reason
    };

    executePlan(PERIOD_EXECUTION_PLAN, ctx);
  }

  const patterns = options.patterns !== false ? runPatterns(ctx) : [];
  const hits = options.interpretation !== false ? runInterpretation(ctx) : [];
  const byDomain = groupByDomain(hits);

  const lifePalace = ctx.palaces.find(p => p.isLifePalace)!;
  const bodyPalace = ctx.palaces.find(p => p.isBodyPalace)!;

  const directionDetermined = ctx.direction !== 'undetermined';
  const certainty: Record<string, Certainty> = {
    calendar: 'certain',
    lifePalace: 'certain',
    bodyPalace: 'certain',
    bureau: 'certain',
    majors: 'high',
    auxStars: 'high',
    minorStars: 'medium',
    dignity: 'variant-dependent',
    sihua: 'variant-dependent',
    interpretation: 'variant-dependent',
    direction: directionDetermined ? 'certain' : 'unknown',
    changsheng: directionDetermined ? 'high' : 'unknown',
    majorPeriods: directionDetermined ? 'high' : 'unknown',
    periods: target ? 'high' : 'unavailable'
  };

  const stars: Record<string, ReturnType<typeof Object>> = {};
  for (const [id, p] of ctx.placements) {
    stars[id] = p;
  }

  const chart: ZiWeiChart = {
    schemaVersion: SCHEMA_VERSION,
    generatedWith: {
      bibleVersion: BIBLE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      profile: profile.profileId,
      engineVersion: ENGINE_VERSION
    },
    input,
    calendar: buildCalendarInfo(input, profile, normalized),
    birthContext: {
      sexForCalculation: input.sexForCalculation,
      yinYang: ctx.yinYang,
      direction: ctx.direction,
      bureau: ctx.bureau,
      bureauName: BUREAU_NAME[ctx.bureau]
    },
    chart: {
      natal: {
        lifePalace: lifePalace.id,
        bodyPalace: bodyPalace.id,
        lifePalaceBranch: ctx.lifePalaceBranch,
        bodyPalaceBranch: ctx.bodyPalaceBranch,
        masterStar: ctx.masterStar,
        bodyStar: ctx.bodyStar
      },
      palaces: ctx.palaces,
      stars: stars as ZiWeiChart['chart']['stars'],
      transformations: ctx.transformations,
      patterns
    },
    periods: {
      major: ctx.majorPeriods,
      active: activePeriods,
      year: ctx.yearPeriod,
      month: ctx.monthPeriod,
      day: ctx.dayPeriod,
      hour: ctx.hourPeriod
    },
    interpretation: { hits, byDomain },
    certainty
  };

  if (options.trace) {
    chart.trace = tracer.toJSON();
  }

  return chart;
}

export function calculateSafe(
  input: ZiWeiBirthInput,
  options: CalculateOptions = {}
): { ok: true; chart: ZiWeiChart } | { ok: false; error: ZiWeiError } {
  try {
    return { ok: true, chart: calculate(input, options) };
  } catch (e) {
    if (e instanceof ZiWeiError) return { ok: false, error: e };
    return {
      ok: false,
      error: new ZiWeiError('INVALID_INPUT', e instanceof Error ? e.message : String(e))
    };
  }
}
