import type {
  ZiWeiBirthInput, ZiWeiChart, CalculateOptions, Profile,
  Certainty
} from '../core/types.js';
import { SCHEMA_VERSION, BIBLE_VERSION, ENGINE_VERSION, BUREAU_NAME, isYangStem, STEM_YINYANG } from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';
import { getProfile } from '../rule-engine/registry.js';
import { normalizeBirth, buildCalendarInfo } from '../calendar/calendar-engine.js';
import { Tracer } from '../trace/tracer.js';
import type { EngineContext } from '../executors/context.js';
import {
  calcLifePalace, calcBodyPalace, calcTwelvePalaces, calcPalaceStems, calcMasterStars
} from '../executors/palace-executors.js';
import {
  calcBureau, calcMajors, calcAuxByMonth, calcAuxByHour, calcAuxByYearStem,
  calcAuxByYearBranch, calcFixedStars, calcChangSheng, calcBoshi,
  calcAuxByMonth2, calcAuxByYearStem2, calcAuxByDay, calcAuxByDayHour, calcAuxSpecial,
  calcPeriodStars
} from '../executors/star-executors.js';
import { calcNatalSihua, calcPalaceSihua, calcPeriodSihua } from '../transformation-engine/transformation-engine.js';
import { calcDignities } from '../dignity-engine/dignity-engine.js';
import {
  calcMajorPeriods, calcYearPeriod, calcMonthPeriod, calcDayPeriod, calcHourPeriod
} from '../period-engine/period-engine.js';
import { hourBranchFromHour } from '../calendar/calendar-engine.js';
import { runInterpretation, groupByDomain, runPatterns } from '../interpretation-engine/interpretation-engine.js';

export function calculate(input: ZiWeiBirthInput, options: CalculateOptions = {}): ZiWeiChart {
  const profile = getProfile(options.profile ?? 'canonical');
  const tracer = new Tracer(options.trace === true);

  if (!input.sexForCalculation) {
    throw new ZiWeiError(
      'UNKNOWN_SEX_FOR_CALCULATION',
      'sexForCalculation is required for deterministic calculation (male | female | unknown with unknown-time analysis)'
    );
  }

  const normalized = normalizeBirth(input, profile);

  const ctx: EngineContext = {
    input,
    normalized,
    profile,
    tracer,
    sexForCalculation: input.sexForCalculation,
    yinYang: STEM_YINYANG[normalized.ganzhi.year.stem],
    direction: 'forward',
    lifePalaceBranch: 'zi',
    bodyPalaceBranch: 'zi',
    palaces: [],
    bureau: 'shui2',
    bureauNumber: 2,
    placements: new Map(),
    transformations: [],
    majorPeriods: []
  };

  const yangStem = isYangStem(normalized.ganzhi.year.stem);
  const male = input.sexForCalculation === 'male';
  const female = input.sexForCalculation === 'female';
  ctx.direction = ((yangStem && male) || (!yangStem && female)) ? 'forward' : 'backward';
  if (input.sexForCalculation === 'unknown') ctx.direction = 'forward';

  calcLifePalace(ctx);
  calcBodyPalace(ctx);
  calcTwelvePalaces(ctx);
  calcPalaceStems(ctx);
  calcMasterStars(ctx);
  calcBureau(ctx);
  calcMajors(ctx);
  calcAuxByMonth(ctx);
  calcAuxByHour(ctx);
  calcAuxByYearStem(ctx);
  calcAuxByYearBranch(ctx);
  calcAuxByMonth2(ctx);
  calcAuxByYearStem2(ctx);
  calcAuxByDay(ctx);
  calcAuxByDayHour(ctx);
  calcAuxSpecial(ctx);
  calcPeriodStars(ctx);
  calcFixedStars(ctx);
  calcChangSheng(ctx);
  calcBoshi(ctx);
  calcNatalSihua(ctx);
  calcPalaceSihua(ctx);
  calcDignities(ctx);
  calcMajorPeriods(ctx);

  const target = options.targetDate;
  if (target?.year) {
    calcYearPeriod(ctx, target.year);
    if (target.month) {
      calcMonthPeriod(ctx, target.year, target.month);
      if (target.day) {
        calcDayPeriod(ctx, target.day);
        if (target.hour !== undefined) {
          calcHourPeriod(ctx, hourBranchFromHour(target.hour));
        }
      }
    }
  } else {
    const now = new Date();
    calcYearPeriod(ctx, now.getFullYear());
    calcMonthPeriod(ctx, now.getFullYear(), now.getMonth() + 1);
    calcDayPeriod(ctx, now.getDate());
    calcHourPeriod(ctx, hourBranchFromHour(now.getHours()));
  }
  calcPeriodSihua(ctx);

  const patterns = options.patterns !== false ? runPatterns(ctx) : [];
  const hits = options.interpretation !== false ? runInterpretation(ctx) : [];
  const byDomain = groupByDomain(hits);

  const lifePalace = ctx.palaces.find(p => p.isLifePalace)!;
  const bodyPalace = ctx.palaces.find(p => p.isBodyPalace)!;

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
    interpretation: 'variant-dependent'
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
