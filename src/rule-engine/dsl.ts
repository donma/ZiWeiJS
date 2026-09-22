import type { EngineContext } from '../executors/context.js';
import type { PalaceId, BranchId } from '../core/types.js';
import {
  buildRelationContext, relatedPalaces, resolveStarGroup, sanFangSiZhengBranches
} from '../relation-engine/relation-engine.js';
import { dignityAtLeast } from '../dignity-engine/dignity-engine.js';
import type { DignityLevel, TransformationType } from '../core/types.js';

export interface DslContext {
  engine: EngineContext;
  focusPalaceId?: PalaceId;
}

type Dsl = Record<string, unknown>;

export function evalDsl(node: Dsl | undefined, ctx: DslContext): boolean {
  if (!node) return true;

  if (node.all) {
    return (node.all as Dsl[]).every(n => evalDsl(n, ctx));
  }
  if (node.any) {
    return (node.any as Dsl[]).some(n => evalDsl(n, ctx));
  }
  if (node.none) {
    return !(node.none as Dsl[]).some(n => evalDsl(n, ctx));
  }
  if (node.not !== undefined) {
    return !evalDsl(node.not as Dsl, ctx);
  }

  const type = node.type as string | undefined;
  switch (type) {
    case 'star-in-palace':
      return starInPalace(node, ctx);
    case 'relation':
      return evalRelation(node, ctx);
    case 'star-group':
      return evalStarGroup(node, ctx);
    case 'transformation':
      return evalTransformation(node, ctx);
    case 'dignity':
      return evalDignity(node, ctx);
    case 'palace':
      return evalPalace(node, ctx);
    case 'compare':
      return evalCompare(node, ctx);
    case 'exists':
      return evalExists(node, ctx);
    case 'period-scope':
      return evalPeriodScope(node, ctx);
    case 'profile':
      return ctx.engine.profile.profileId === node.profile;
    case 'variant':
      return ctx.engine.profile.profileId !== 'canonical';
    case 'pattern':
      return true;
    case 'and':
      return (node.conditions as Dsl[]).every(n => evalDsl(n, ctx));
    case 'or':
      return (node.conditions as Dsl[]).some(n => evalDsl(n, ctx));
    default:
      if (node.conditions) {
        const conds = node.conditions as Dsl[];
        if (type === 'any') return conds.some(n => evalDsl(n, ctx));
        return conds.every(n => evalDsl(n, ctx));
      }
      return true;
  }
}

function resolvePalace(ctx: DslContext, palaceRef: unknown): PalaceId | undefined {
  if (!palaceRef) return ctx.focusPalaceId;
  return palaceRef as PalaceId;
}

function palaceStarIds(ctx: DslContext, palaceId: PalaceId): Set<string> {
  const palace = ctx.engine.palaces.find(p => p.id === palaceId);
  const ids = new Set<string>();
  if (palace) for (const s of palace.stars) ids.add(s.starId);
  return ids;
}

function starInPalace(node: Dsl, ctx: DslContext): boolean {
  const palaceId = resolvePalace(ctx, node.palace);
  if (!palaceId) return false;
  return palaceStarIds(ctx, palaceId).has(node.star as string);
}

function evalRelation(node: Dsl, ctx: DslContext): boolean {
  const relCtx = buildRelationContext(ctx.engine.palaces);
  const palaceId = resolvePalace(ctx, node.palace);
  if (!palaceId) return false;
  const base = ctx.engine.palaces.find(p => p.id === palaceId);
  if (!base) return false;
  const related = relatedPalaces(relCtx, node.relation as never, base);
  const ids = new Set<string>();
  for (const p of related) for (const s of p.stars) ids.add(s.starId);

  const anyList = node.containsAny as string[] | undefined;
  const allList = node.containsAll as string[] | undefined;
  const star = node.star as string | undefined;

  if (star) return ids.has(star);
  if (anyList && anyList.length > 0) {
    return anyList.some(id => ids.has(id));
  }
  if (allList && allList.length > 0) {
    return allList.every(id => ids.has(id));
  }
  return related.length > 0;
}

function evalStarGroup(node: Dsl, ctx: DslContext): boolean {
  const groupIds = resolveStarGroup(node.group as string | string[]);
  const relCtx = buildRelationContext(ctx.engine.palaces);
  const relation = (node.relation as string) ?? 'same-palace';
  const minCount = (node.minCount as number) ?? groupIds.length;
  const palaceId = resolvePalace(ctx, node.palace);

  if (relation === 'same-palace') {
    for (const p of ctx.engine.palaces) {
      const ids = new Set(p.stars.map(s => s.starId));
      const count = groupIds.filter(id => ids.has(id)).length;
      if (count >= minCount) return true;
    }
    return false;
  }

  if (!palaceId) return false;
  const base = ctx.engine.palaces.find(p => p.id === palaceId);
  if (!base) return false;
  const related = relatedPalaces(relCtx, relation as never, base);
  const ids = new Set<string>();
  for (const p of related) for (const s of p.stars) ids.add(s.starId);
  const count = groupIds.filter(id => ids.has(id)).length;
  return count >= minCount;
}

function evalTransformation(node: Dsl, ctx: DslContext): boolean {
  const transformType = node.transform as TransformationType;
  const palaceId = resolvePalace(ctx, node.palace);
  const relation = node.relation as string | undefined;

  let palaces = ctx.engine.palaces;
  if (palaceId && !relation) {
    palaces = palaces.filter(p => p.id === palaceId);
  } else if (palaceId && relation) {
    const relCtx = buildRelationContext(ctx.engine.palaces);
    const base = ctx.engine.palaces.find(p => p.id === palaceId)!;
    palaces = relatedPalaces(relCtx, relation as never, base);
  }

  for (const p of palaces) {
    for (const t of p.transformations) {
      if (t.type === transformType) {
        if (node.star && t.targetStarId !== node.star) continue;
        if (node.scope && t.sourceScope !== node.scope) continue;
        return true;
      }
    }
  }
  return false;
}

function evalDignity(node: Dsl, ctx: DslContext): boolean {
  const starId = node.star as string;
  const minLevel = node.minLevel as DignityLevel;
  const placement = ctx.engine.placements.get(starId);
  if (!placement) return false;
  return dignityAtLeast(placement.dignity, minLevel);
}

function evalPalace(node: Dsl, ctx: DslContext): boolean {
  const palaceId = node.palace as PalaceId;
  const palace = ctx.engine.palaces.find(p => p.id === palaceId);
  if (!palace) return false;
  if (node.isBody !== undefined) return palace.isBodyPalace === node.isBody;
  if (node.isLife !== undefined) return palace.isLifePalace === node.isLife;
  if (node.empty !== undefined) return (palace.majorStars.length === 0) === node.empty;
  return true;
}

function evalCompare(node: Dsl, ctx: DslContext): boolean {
  const left = resolvePath(ctx.engine, node.left as string);
  const right = node.right;
  const op = (node.op as string) ?? 'eq';
  switch (op) {
    case 'eq': return left === right;
    case 'ne': return left !== right;
    case 'gt': return (left as number) > (right as number);
    case 'gte': return (left as number) >= (right as number);
    case 'lt': return (left as number) < (right as number);
    case 'lte': return (left as number) <= (right as number);
    case 'in': return Array.isArray(right) && right.includes(left);
    default: return false;
  }
}

function evalExists(node: Dsl, ctx: DslContext): boolean {
  const path = node.path as string;
  const v = resolvePath(ctx.engine, path);
  return v !== undefined && v !== null;
}

function evalPeriodScope(node: Dsl, ctx: DslContext): boolean {
  const scope = node.scope as string;
  switch (scope) {
    case 'major-period': return ctx.engine.majorPeriods.length > 0;
    case 'year': return !!ctx.engine.yearPeriod;
    case 'month': return !!ctx.engine.monthPeriod;
    case 'day': return !!ctx.engine.dayPeriod;
    case 'hour': return !!ctx.engine.hourPeriod;
    default: return false;
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  let cur = obj as Record<string, unknown>;
  for (const seg of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg] as Record<string, unknown>;
  }
  return cur;
}
