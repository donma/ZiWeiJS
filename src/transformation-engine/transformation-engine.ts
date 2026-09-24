import type { EngineContext } from '../executors/context.js';
import type { Transformation, TransformationScope, StemId } from '../core/types.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import { sihuaForStem, type SihuaResult } from '../executors/star-executors.js';
import { effectiveRuleId, variantPatchFor } from '../executors/context.js';

export type SihuaPatch = Record<string, Partial<Record<'lu' | 'quan' | 'ke' | 'ji', string>>>;

const TABLE_CANON = 'ZW.CALC.SIHUA.TABLE.001';
const NATAL_CANON = 'ZW.CALC.SIHUA.NATAL.001';

/**
 * 取得當前 Context 在該 Profile 下生效之四化表 patch（spec 3rd §P0-9）。
 * 優先尋找共用四化表 ZW.CALC.SIHUA.TABLE.001，若無則回退至生年四化 variant。
 */
export function resolveSihuaPatch(ctx: EngineContext): SihuaPatch | undefined {
  return (variantPatchFor(ctx, TABLE_CANON) ?? variantPatchFor(ctx, NATAL_CANON)) as SihuaPatch | undefined;
}

/**
 * 依當前 Context（含 Profile variant）解析某天干之四化結果。
 * 所有 scope（生年 / 宮干 / 大限 / 流年 / 流月 / 流日 / 流時 / overlay）共用此單一出口，
 * 確保流派 variant 跨 scope 一致（spec 3rd §P0-9）。
 */
export function resolveSihuaForStem(ctx: EngineContext, stem: StemId): SihuaResult[] {
  return sihuaForStem(stem, resolveSihuaPatch(ctx));
}

/**
 * 解析某層限運之四化 Transformation 清單（spec 3rd §P1-8）。
 * 供 calcPeriodSihua 與 buildPeriodOverlay 共用，避免兩處各自計算而產生歧異。
 */
export function resolvePeriodTransformations(
  ctx: EngineContext,
  scope: TransformationScope,
  stem: StemId,
  ruleId = 'ZW.CALC.SIHUA.PERIOD.001'
): Transformation[] {
  const results: Transformation[] = [];
  for (const { type, starId } of resolveSihuaForStem(ctx, stem)) {
    const placement = ctx.placements.get(starId);
    if (!placement) continue;
    results.push({
      type,
      sourceScope: scope,
      sourceStem: stem,
      targetStarId: starId,
      targetPalaceId: placement.palaceId,
      profile: ctx.profile.profileId,
      ruleId
    });
  }
  return results;
}

export function applySihua(
  ctx: EngineContext,
  stem: StemId,
  scope: TransformationScope,
  sourcePalaceId?: string,
  ruleId = 'ZW.CALC.SIHUA.NATAL.001'
): Transformation[] {
  const results: Transformation[] = [];
  for (const { type, starId } of resolveSihuaForStem(ctx, stem)) {
    const placement = ctx.placements.get(starId);
    if (!placement) continue;
    const selfTransform = sourcePalaceId !== undefined && sourcePalaceId === placement.palaceId;
    const tr: Transformation = {
      type,
      sourceScope: scope,
      sourceStem: stem,
      sourcePalaceId: sourcePalaceId as Transformation['sourcePalaceId'],
      targetStarId: starId,
      targetPalaceId: placement.palaceId,
      profile: ctx.profile.profileId,
      ruleId,
      selfTransformation: selfTransform || undefined
    };
    results.push(tr);
    placement.transformations = placement.transformations ?? [];
    ctx.transformations.push(tr);
    const palace = ctx.palaces.find(p => p.id === placement.palaceId);
    palace?.transformations.push(tr);
  }
  return results;
}

export function calcNatalSihua(ctx: EngineContext): ExecutorOutcome {
  const stem = ctx.normalized.ganzhi.year.stem;
  const patch = resolveSihuaPatch(ctx);
  const tableRuleId = effectiveRuleId(ctx, TABLE_CANON);
  const ruleId = tableRuleId !== TABLE_CANON ? tableRuleId : effectiveRuleId(ctx, NATAL_CANON);
  const trs = applySihua(ctx, stem, 'natal', undefined, ruleId);
  return {
    inputs: { yearStem: stem, variantPatched: patch ? Object.keys(patch) : [] },
    result: trs.map(t => `${t.type}->${t.targetStarId}@${t.targetPalaceId}`),
    status: patch ? 'variant' : 'executed',
    note: patch ? '依 profile 覆寫四化表變體' : undefined
  };
}

export function calcPalaceSihua(ctx: EngineContext): ExecutorOutcome {
  const all: Transformation[] = [];
  const ruleId = effectiveRuleId(ctx, 'ZW.CALC.SIHUA.PALACE.001');
  for (const palace of ctx.palaces) {
    const trs = applySihua(ctx, palace.stem, 'palace', palace.id, ruleId);
    all.push(...trs);
  }
  return {
    inputs: { palaces: ctx.palaces.length },
    result: `${all.length} palace-stem transformations`
  };
}

export function calcPeriodSihua(ctx: EngineContext): ExecutorOutcome {
  const all: Transformation[] = [];
  // 大限四化必須依「目標年齡實際所在之大限」，不可固定取 majorPeriods[0]（spec §P0-3A）
  const scopes: Array<[string, { stem: StemId } | undefined, TransformationScope]> = [
    ['major-period', ctx.activeMajorPeriod, 'major-period'],
    ['year', ctx.yearPeriod, 'year'],
    ['month', ctx.monthPeriod, 'month'],
    ['day', ctx.dayPeriod, 'day'],
    ['hour', ctx.hourPeriod, 'hour']
  ];
  const used: Record<string, string> = {};
  const ruleId = effectiveRuleId(ctx, 'ZW.CALC.SIHUA.PERIOD.001');
  for (const [name, period, scope] of scopes) {
    if (!period) continue;
    used[name] = period.stem;
    const trs = applySihua(ctx, period.stem, scope, undefined, ruleId);
    all.push(...trs);
  }
  if (all.length === 0) {
    return { inputs: { stems: used }, result: null, status: 'skipped', reason: 'NO_PERIOD_SCOPE' };
  }
  return {
    inputs: {
      stems: used,
      majorPeriod: ctx.activeMajorPeriod ? `${ctx.activeMajorPeriod.fromAge}-${ctx.activeMajorPeriod.toAge}` : undefined
    },
    result: `${all.length} period transformations`
  };
}
