import type { EngineContext } from '../executors/context.js';
import type { Transformation, TransformationScope, StemId } from '../core/types.js';
import { sihuaForStem } from '../executors/star-executors.js';

export function applySihua(
  ctx: EngineContext,
  stem: StemId,
  scope: TransformationScope,
  sourcePalaceId?: string,
  ruleId = 'ZW.CALC.SIHUA.NATAL.001'
): Transformation[] {
  const results: Transformation[] = [];
  for (const { type, starId } of sihuaForStem(stem)) {
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

export function calcNatalSihua(ctx: EngineContext): void {
  const stem = ctx.normalized.ganzhi.year.stem;
  const trs = applySihua(ctx, stem, 'natal', undefined, 'ZW.CALC.SIHUA.NATAL.001');
  ctx.tracer.record({
    ruleId: 'ZW.CALC.SIHUA.NATAL.001',
    inputs: { yearStem: stem },
    result: trs.map(t => `${t.type}->${t.targetStarId}@${t.targetPalaceId}`),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.SIHUA']
  });
}

export function calcPalaceSihua(ctx: EngineContext): void {
  const all: Transformation[] = [];
  for (const palace of ctx.palaces) {
    const trs = applySihua(ctx, palace.stem, 'palace', palace.id, 'ZW.CALC.SIHUA.PALACE.001');
    all.push(...trs);
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.SIHUA.PALACE.001',
    inputs: {},
    result: `${all.length} palace-stem transformations`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.SIHUA-FEIXING']
  });
}

export function calcPeriodSihua(ctx: EngineContext): void {
  const all: Transformation[] = [];
  const scopes: Array<[string, { stem: StemId } | undefined, TransformationScope]> = [
    ['major-period', ctx.majorPeriods[0], 'major-period'],
    ['year', ctx.yearPeriod, 'year'],
    ['month', ctx.monthPeriod, 'month'],
    ['day', ctx.dayPeriod, 'day'],
    ['hour', ctx.hourPeriod, 'hour']
  ];
  for (const [, period, scope] of scopes) {
    if (!period) continue;
    const trs = applySihua(ctx, period.stem, scope, undefined, 'ZW.CALC.SIHUA.PERIOD.001');
    all.push(...trs);
  }
  if (all.length > 0) {
    ctx.tracer.record({
      ruleId: 'ZW.CALC.SIHUA.PERIOD.001',
      inputs: {},
      result: `${all.length} period transformations`,
      profile: ctx.profile.profileId,
      sourceRefs: ['SRC.QUANSHU']
    });
  }
}
