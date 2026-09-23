import type { EngineContext } from '../executors/context.js';
import type { PalaceId, BranchId, PatternResult } from '../core/types.js';
import {
  buildRelationContext, relatedPalaces, resolveStarGroup, sanFangSiZhengBranches
} from '../relation-engine/relation-engine.js';
import { dignityAtLeast } from '../dignity-engine/dignity-engine.js';
import type { DignityLevel, TransformationType } from '../core/types.js';
import { ZiWeiError } from '../core/errors.js';

export interface DslContext {
  engine: EngineContext;
  focusPalaceId?: PalaceId;
}

type Dsl = Record<string, unknown>;

/**
 * 允許的 DSL operator（spec §P0-5）。
 * 未知 operator 一律 throw UNKNOWN_DSL_OPERATOR —— 不得視為 false，也不得視為 true。
 * 必須與 schemas/dsl.schema.json 保持一致。
 */
export const DSL_ALLOWED_OPERATORS = [
  'star-in-palace', 'relation', 'star-group', 'transformation', 'dignity',
  'palace', 'compare', 'exists', 'period-scope', 'profile', 'variant',
  'pattern', 'and', 'or', 'all', 'any'
] as const;

/** 不使用 `type` 的邏輯結構鍵 */
export const DSL_LOGICAL_KEYS = ['all', 'any', 'none', 'not'] as const;

const COMPARE_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'] as const;

function invalidDsl(message: string, details?: Record<string, unknown>): never {
  throw new ZiWeiError('INVALID_DSL', message, details);
}

export function evalDsl(node: Dsl | undefined, ctx: DslContext): boolean {
  if (node === undefined || node === null) return true;

  // 邏輯結構
  if (node.all !== undefined) return asArray(node.all, 'all').every(n => evalDsl(n, ctx));
  if (node.any !== undefined) return asArray(node.any, 'any').some(n => evalDsl(n, ctx));
  if (node.none !== undefined) return !asArray(node.none, 'none').some(n => evalDsl(n, ctx));
  if (node.not !== undefined) return !evalDsl(node.not as Dsl, ctx);

  const type = node.type as string | undefined;
  if (type === undefined) {
    invalidDsl('DSL node requires a `type` or a logical key (all/any/none/not)', { node });
  }

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
      return evalPattern(node, ctx);
    case 'and':
    case 'all':
      return asArray(node.conditions, 'conditions').every(n => evalDsl(n, ctx));
    case 'or':
    case 'any':
      return asArray(node.conditions, 'conditions').some(n => evalDsl(n, ctx));
    default:
      // Fail-close：未知 operator 直接報錯，不預設成立或不成立
      throw new ZiWeiError(
        'UNKNOWN_DSL_OPERATOR',
        `Unknown DSL operator: ${type}`,
        { operator: type, allowed: DSL_ALLOWED_OPERATORS }
      );
  }
}

function asArray(value: unknown, key: string): Dsl[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalidDsl(`DSL key \`${key}\` requires a non-empty array`, { key });
  }
  return value as Dsl[];
}

function requireString(node: Dsl, key: string, op: string): string {
  const v = node[key];
  if (typeof v !== 'string' || v.length === 0) {
    invalidDsl(`DSL operator \`${op}\` requires string \`${key}\``, { operator: op, key });
  }
  return v;
}

function resolvePalace(ctx: DslContext, palaceRef: unknown): PalaceId | undefined {
  if (palaceRef === undefined || palaceRef === null) return ctx.focusPalaceId;
  if (typeof palaceRef !== 'string') invalidDsl('`palace` must be a string palace id');
  return palaceRef as PalaceId;
}

function palaceStarIds(ctx: DslContext, palaceId: PalaceId): Set<string> {
  const palace = ctx.engine.palaces.find(p => p.id === palaceId);
  const ids = new Set<string>();
  if (palace) for (const s of palace.stars) ids.add(s.starId);
  return ids;
}

function starInPalace(node: Dsl, ctx: DslContext): boolean {
  const star = requireString(node, 'star', 'star-in-palace');
  const palaceId = resolvePalace(ctx, node.palace);
  if (!palaceId) return false;
  return palaceStarIds(ctx, palaceId).has(star);
}

function evalRelation(node: Dsl, ctx: DslContext): boolean {
  const relation = requireString(node, 'relation', 'relation');
  const relCtx = buildRelationContext(ctx.engine.palaces);
  const palaceId = resolvePalace(ctx, node.palace);
  if (!palaceId) return false;
  const base = ctx.engine.palaces.find(p => p.id === palaceId);
  if (!base) return false;
  const related = relatedPalaces(relCtx, relation as never, base);
  const ids = new Set<string>();
  for (const p of related) for (const s of p.stars) ids.add(s.starId);

  const anyList = node.containsAny as string[] | undefined;
  const allList = node.containsAll as string[] | undefined;
  const star = node.star as string | undefined;

  if (star) return ids.has(star);
  if (anyList && anyList.length > 0) return anyList.some(id => ids.has(id));
  if (allList && allList.length > 0) return allList.every(id => ids.has(id));
  return related.length > 0;
}

function evalStarGroup(node: Dsl, ctx: DslContext): boolean {
  if (node.group === undefined) invalidDsl('DSL operator `star-group` requires `group`');
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
  const transformType = requireString(node, 'transform', 'transformation') as TransformationType;
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
  const starId = requireString(node, 'star', 'dignity');
  const minLevel = requireString(node, 'minLevel', 'dignity') as DignityLevel;
  const placement = ctx.engine.placements.get(starId);
  if (!placement) return false;
  return dignityAtLeast(placement.dignity, minLevel);
}

function evalPalace(node: Dsl, ctx: DslContext): boolean {
  const palaceId = node.palace as PalaceId;
  if (!palaceId) invalidDsl('DSL operator `palace` requires `palace`');
  const palace = ctx.engine.palaces.find(p => p.id === palaceId);
  if (!palace) return false;
  if (node.isBody !== undefined) return palace.isBodyPalace === node.isBody;
  if (node.isLife !== undefined) return palace.isLifePalace === node.isLife;
  if (node.empty !== undefined) return (palace.majorStars.length === 0) === node.empty;
  return true;
}

function evalCompare(node: Dsl, ctx: DslContext): boolean {
  const left = resolvePath(ctx.engine, requireString(node, 'left', 'compare'));
  const right = node.right;
  const op = requireString(node, 'op', 'compare');
  if (!(COMPARE_OPS as readonly string[]).includes(op)) {
    invalidDsl(`Unknown compare op: ${op}`, { op, allowed: COMPARE_OPS });
  }
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
  const v = resolvePath(ctx.engine, requireString(node, 'path', 'exists'));
  return v !== undefined && v !== null;
}

function evalPeriodScope(node: Dsl, ctx: DslContext): boolean {
  const scope = requireString(node, 'scope', 'period-scope');
  switch (scope) {
    case 'major-period': return ctx.engine.majorPeriods.length > 0;
    case 'year': return !!ctx.engine.yearPeriod;
    case 'month': return !!ctx.engine.monthPeriod;
    case 'day': return !!ctx.engine.dayPeriod;
    case 'hour': return !!ctx.engine.hourPeriod;
    default:
      invalidDsl(`Unknown period scope: ${scope}`, { scope });
  }
}

/**
 * 讀取真實的 Pattern 結果（spec §P0-5 Pattern Operator）。
 * 必須有 patternId；statusIn 可限定狀態集合。
 */
function evalPattern(node: Dsl, ctx: DslContext): boolean {
  const patternId = requireString(node, 'patternId', 'pattern');
  const results: PatternResult[] = ctx.engine.patternResults ?? [];
  const hit = results.find(r => r.patternId === patternId);
  if (!hit) return false;
  const statusIn = node.statusIn as string[] | undefined;
  if (statusIn && statusIn.length > 0) return statusIn.includes(hit.status);
  return true;
}

function resolvePath(obj: unknown, path: string): unknown {
  let cur = obj as Record<string, unknown>;
  for (const seg of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg] as Record<string, unknown>;
  }
  return cur;
}
