import type {
  ZiWeiChart, Palace, PalaceId, BranchId, StarPlacement, Transformation,
  TransformationType, PeriodScope
} from '../core/types.js';
import {
  buildRelationContext, palaceById, relatedPalaces, adjacentBranches, trineBranches,
  oppositeBranchOf, type RelationContext
} from '../relation-engine/relation-engine.js';

/**
 * Query Facade（spec Post-Stability §8）
 *
 * 只提供既有 Engine 結果的查詢 ergonomics，**不新增第二套演算法**。
 * 底層一律使用 chart 已算好的 palaces / stars / transformations / periods，
 * 以及既有 relation-engine。
 */

function ctxOf(chart: ZiWeiChart): RelationContext {
  return buildRelationContext(chart.chart.palaces);
}

export function palace(chart: ZiWeiChart, palaceId: PalaceId): Palace | undefined {
  return palaceById(ctxOf(chart), palaceId);
}

export function star(chart: ZiWeiChart, starId: string): StarPlacement | undefined {
  const direct = chart.chart.stars[starId];
  if (direct) return direct;
  for (const p of chart.chart.palaces) {
    const hit = p.stars.find(s => s.starId === starId);
    if (hit) return hit;
  }
  return undefined;
}

export function starsOfPalace(chart: ZiWeiChart, palaceId: PalaceId): StarPlacement[] {
  return palace(chart, palaceId)?.stars ?? [];
}

/** 該宮是否同時具有 all 列出的所有星 */
export function hasStars(chart: ZiWeiChart, q: { palace: PalaceId; all: string[] }): boolean {
  const ids = new Set(starsOfPalace(chart, q.palace).map(s => s.starId));
  return q.all.every(id => ids.has(id));
}

/** 該宮是否具有 any 之一 */
export function hasAnyStar(chart: ZiWeiChart, q: { palace: PalaceId; any: string[] }): boolean {
  const ids = new Set(starsOfPalace(chart, q.palace).map(s => s.starId));
  return q.any.some(id => ids.has(id));
}

export interface PalaceRelations {
  self: Palace | undefined;
  opposite: Palace | undefined;
  trine: Palace[];
  adjacent: Palace[];
  sanFangSiZheng: Palace[];
}

export function relations(chart: ZiWeiChart, palaceId: PalaceId): PalaceRelations {
  const ctx = ctxOf(chart);
  const self = palaceById(ctx, palaceId);
  if (!self) return { self: undefined, opposite: undefined, trine: [], adjacent: [], sanFangSiZheng: [] };
  const pick = (branches: readonly BranchId[]) =>
    branches.map(b => ctx.branchToPalace.get(b)).filter((p): p is Palace => !!p);
  return {
    self,
    opposite: relatedPalaces(ctx, 'opposite', self)[0],
    trine: pick(trineBranches(self.branch)),
    adjacent: pick(adjacentBranches(self.branch)),
    sanFangSiZheng: relatedPalaces(ctx, 'san-fang-si-zheng', self)
  };
}

export function sanFangSiZheng(chart: ZiWeiChart, palaceId: PalaceId): Palace[] {
  return relations(chart, palaceId).sanFangSiZheng;
}

export function opposite(chart: ZiWeiChart, palaceId: PalaceId): Palace | undefined {
  return relations(chart, palaceId).opposite;
}

export function oppositeBranch(branch: BranchId): BranchId {
  return oppositeBranchOf(branch);
}

/** 空宮：無十四主星 */
export function isEmptyPalace(chart: ZiWeiChart, palaceId: PalaceId): boolean {
  const p = palace(chart, palaceId);
  return !p || p.majorStars.length === 0;
}

export function transformations(
  chart: ZiWeiChart,
  q: { palace?: PalaceId; scope?: PeriodScope; type?: TransformationType } = {}
): Transformation[] {
  const pool: Transformation[] = [
    ...chart.chart.transformations,
    ...chart.chart.palaces.flatMap(p => p.transformations)
  ];
  const seen = new Set<string>();
  const out: Transformation[] = [];
  for (const t of pool) {
    const key = `${t.sourceScope}|${t.sourceStem}|${t.type}|${t.targetStarId}|${t.sourcePalaceId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (q.scope && t.sourceScope !== q.scope) continue;
    if (q.type && t.type !== q.type) continue;
    if (q.palace && t.sourcePalaceId !== q.palace && t.targetPalaceId !== q.palace) continue;
    out.push(t);
  }
  return out;
}

export function fliesTo(
  chart: ZiWeiChart,
  q: { fromPalace: PalaceId; toPalace: PalaceId; type?: TransformationType }
): Transformation[] {
  return transformations(chart, { type: q.type }).filter(
    t => t.sourcePalaceId === q.fromPalace && t.targetPalaceId === q.toPalace
  );
}

export function selfTransformations(chart: ZiWeiChart, palaceId: PalaceId): Transformation[] {
  return transformations(chart).filter(
    t => t.selfTransformation === true && t.sourcePalaceId === palaceId
  );
}

/** 限運查詢 */
export function period(chart: ZiWeiChart, scope: 'year' | 'month' | 'day' | 'hour') {
  return chart.periods[scope];
}

export const QueryApi = {
  palace,
  star,
  starsOfPalace,
  hasStars,
  hasAnyStar,
  relations,
  sanFangSiZheng,
  opposite,
  oppositeBranch,
  isEmptyPalace,
  transformations,
  fliesTo,
  selfTransformations,
  period
};
