/**
 * Astro Entity Taxonomy（spec Post-Stability §20 / §19 / §36）
 *
 * 紫微斗數裡「看起來像星曜」的東西其實分屬不同 kind：
 *
 *   紫微   → star
 *   天巫   → star
 *   長生   → stage
 *   博士   → cycle-deity
 *   歲建   → year-deity
 *   流魁   → period-dynamic
 *   化祿   → transformation-marker
 *
 * 這個分類是 gap audit 的基礎：外部資料集的「星曜清單」常把
 * stage / cycle-deity / year-deity 也算成星，若不先分類，
 * 就會誤判 ZiWeiJS「少了 24 顆星」。
 */
import type { StarCategory } from './types.js';

export type AstroEntityKind =
  | 'star'
  | 'stage'
  | 'cycle-deity'
  | 'year-deity'
  | 'period-dynamic'
  | 'transformation-marker';

export const ASTRO_ENTITY_KINDS: readonly AstroEntityKind[] = [
  'star',
  'stage',
  'cycle-deity',
  'year-deity',
  'period-dynamic',
  'transformation-marker'
];

export function isAstroEntityKind(value: string): value is AstroEntityKind {
  return (ASTRO_ENTITY_KINDS as readonly string[]).includes(value);
}

/**
 * 由 Star Registry 的 category 推導 entityKind。
 *
 * `period`（歲建十二神）與 `interim`（將前十二神）皆屬 year-deity；
 * 其餘 category 預設為 star。特例（例如沐浴實為 stage）由 entry 的
 * 明確 `entityKind` 覆寫。
 */
const CATEGORY_ENTITY_KIND: Record<StarCategory, AstroEntityKind> = {
  major: 'star',
  aux: 'star',
  malefic: 'star',
  minor: 'star',
  period: 'year-deity',
  interim: 'year-deity'
};

export function entityKindForCategory(category: StarCategory): AstroEntityKind {
  return CATEGORY_ENTITY_KIND[category] ?? 'star';
}

/** 取得 star entry 的 entityKind（明確欄位優先，否則由 category 推導） */
export function entityKindOfStarEntry(entry: { category: StarCategory; entityKind?: AstroEntityKind }): AstroEntityKind {
  return entry.entityKind ?? entityKindForCategory(entry.category);
}
