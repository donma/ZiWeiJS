import type { EngineContext } from '../executors/context.js';
import type { Transformation, TransformationScope, StemId } from '../core/types.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import { sihuaForStem } from '../executors/star-executors.js';
import { effectiveRuleId, variantPatchFor } from '../executors/context.js';

type SihuaPatch = Record<string, Partial<Record<'lu' | 'quan' | 'ke' | 'ji', string>>>;

export function applySihua(
  ctx: EngineContext,
  stem: StemId,
  scope: TransformationScope,
  sourcePalaceId?: string,
  ruleId = 'ZW.CALC.SIHUA.NATAL.001',
  patch?: SihuaPatch
): Transformation[] {
  const results: Transformation[] = [];
  for (const { type, starId } of sihuaForStem(stem, patch)) {
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
  const CANON = 'ZW.CALC.SIHUA.NATAL.001';
  const stem = ctx.normalized.ganzhi.year.stem;
  const patch = variantPatchFor(ctx, CANON) as SihuaPatch | undefined;
  const ruleId = effectiveRuleId(ctx, CANON);
  const trs = applySihua(ctx, stem, 'natal', undefined, ruleId, patch);
  return {
    inputs: { yearStem: stem, variantOf: CANON, variantPatched: patch ? Object.keys(patch) : [] },
    result: trs.map(t => `${t.type}->${t.targetStarId}@${t.targetPalaceId}`),
    status: patch ? 'variant' : 'executed',
    note: patch ? `依 profile 覆寫變體（variant of ${CANON}）` : undefined
  };
}

export function calcPalaceSihua(ctx: EngineContext): ExecutorOutcome {
  const all: Transformation[] = [];
  for (const palace of ctx.palaces) {
    const trs = applySihua(ctx, palace.stem, 'palace', palace.id, 'ZW.CALC.SIHUA.PALACE.001');
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
  for (const [name, period, scope] of scopes) {
    if (!period) continue;
    used[name] = period.stem;
    const trs = applySihua(ctx, period.stem, scope, undefined, 'ZW.CALC.SIHUA.PERIOD.001');
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
