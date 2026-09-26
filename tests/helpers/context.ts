import { calculate, getProfile, Tracer } from '../../src/index.js';
import type { ZiWeiBirthInput, StarPlacement, BranchId, TargetDate } from '../../src/index.js';
import type { DslContext } from '../../src/rule-engine/dsl.js';
import type { EngineContext } from '../../src/executors/context.js';

export const TEST_INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const BUREAU_NUMBER: Record<string, number> = { shui2: 2, mu3: 3, jin4: 4, tu5: 5, huo6: 6 };

/**
 * 由已計算的 chart 反推一個可用的 EngineContext，供 DSL / executor 單元測試使用。
 * 僅供測試，不屬於公開 API。
 */
export function buildTestContext(
  input: ZiWeiBirthInput = TEST_INPUT,
  options: { targetDate?: TargetDate } = {}
): DslContext {
  const chart = calculate(input, { targetDate: options.targetDate });
  const placements = new Map<string, StarPlacement>(
    Object.entries(chart.chart.stars) as Array<[string, StarPlacement]>
  );

  const engine: EngineContext = {
    input: chart.input,
    normalized: {} as never,
    profile: getProfile(chart.generatedWith.profile),
    tracer: new Tracer(false),
    targetDate: options.targetDate,
    sexForCalculation: (chart.input.sexForCalculation ?? 'male') as 'male' | 'female' | 'unknown',
    yinYang: chart.birthContext.yinYang,
    direction: chart.birthContext.direction,
    lifePalaceBranch: chart.chart.natal.lifePalaceBranch,
    bodyPalaceBranch: chart.chart.natal.bodyPalaceBranch,
    palaces: chart.chart.palaces,
    bureau: chart.birthContext.bureau,
    bureauNumber: BUREAU_NUMBER[chart.birthContext.bureau] ?? 0,
    placements,
    transformations: chart.chart.transformations,
    majorPeriods: chart.periods.major,
    dynamicStars: chart.periods.dynamicStars ?? [],
    yearPeriod: chart.periods.year,
    monthPeriod: chart.periods.month,
    dayPeriod: chart.periods.day,
    hourPeriod: chart.periods.hour,
    masterStar: chart.chart.natal.masterStar,
    bodyStar: chart.chart.natal.bodyStar,
    lucunBranch: placements.get('ZW.STAR.AUX.LUCUN')?.branch as BranchId | undefined,
    activeRules: new Map(),
    patternResults: chart.chart.patterns
  };

  return { engine };
}
