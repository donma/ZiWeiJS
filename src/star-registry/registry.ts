import starRegistry from '../../tables/stars/registry.json' with { type: 'json' };
import { entityKindOfStarEntry, type AstroEntityKind } from '../core/entity-kinds.js';
import type { Star } from '../core/types.js';

/**
 * Star Registry 查詢（spec Post-Stability §20 / §36）。
 *
 * 引擎內部安星仍走 Rule → executor；本模組只提供 taxonomy 查詢，
 * 供 gap audit、Query Facade 與 API 使用。
 */
const stars = (starRegistry as { stars: Star[] }).stars;
const byId = new Map(stars.map(s => [s.id, s]));

export function listStarRegistry(): Star[] {
  return stars;
}

export function getStarRegistryEntry(starId: string): Star | undefined {
  return byId.get(starId);
}

export function entityKindOfStar(starId: string): AstroEntityKind | undefined {
  const star = byId.get(starId);
  return star ? entityKindOfStarEntry(star) : undefined;
}

/** 依 entityKind 分組列出 registry 星曜（供 gap audit / 報表使用） */
export function groupStarsByEntityKind(): Record<AstroEntityKind, Star[]> {
  const out = {
    star: [], stage: [], 'cycle-deity': [], 'year-deity': [],
    'period-dynamic': [], 'transformation-marker': []
  } as Record<AstroEntityKind, Star[]>;
  for (const s of stars) out[entityKindOfStarEntry(s)].push(s);
  return out;
}
