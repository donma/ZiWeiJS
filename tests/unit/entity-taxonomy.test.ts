import { describe, it, expect } from 'vitest';
import {
  ASTRO_ENTITY_KINDS, entityKindForCategory, entityKindOfStar,
  listStarRegistry, getStarRegistryEntry, groupStarsByEntityKind, ZiWei
} from '../../src/index.js';

/**
 * Entity Taxonomy（spec Post-Stability §20）
 *
 * 外部資料集常把 stage / cycle-deity / year-deity 當成星；taxonomy 用來避免誤判。
 */
describe('AstroEntityKind taxonomy', () => {
  it('六種 kind', () => {
    expect([...ASTRO_ENTITY_KINDS].sort()).toEqual(
      ['cycle-deity', 'period-dynamic', 'stage', 'star', 'transformation-marker', 'year-deity'].sort()
    );
  });

  it('category → kind：period / interim 為 year-deity，其餘 star', () => {
    expect(entityKindForCategory('period')).toBe('year-deity');
    expect(entityKindForCategory('interim')).toBe('year-deity');
    expect(entityKindForCategory('major')).toBe('star');
    expect(entityKindForCategory('minor')).toBe('star');
  });

  it('沐浴（MUYU）為 stage（明確覆寫），歲建為 year-deity，紫微為 star', () => {
    expect(entityKindOfStar('ZW.STAR.AUX.MUYU')).toBe('stage');
    expect(entityKindOfStar('ZW.STAR.PERIOD.SUIJIAN')).toBe('year-deity');
    expect(entityKindOfStar('ZW.STAR.INTERIM.JIANGXING')).toBe('year-deity');
    expect(entityKindOfStar('ZW.STAR.MAJOR.ZIWEI')).toBe('star');
    expect(entityKindOfStar('ZW.NOT.EXIST')).toBeUndefined();
  });

  it('groupStarsByEntityKind 不把 year-deity 混進 star', () => {
    const groups = groupStarsByEntityKind();
    expect(groups['year-deity'].length).toBeGreaterThanOrEqual(24);
    expect(groups.stage.map(s => s.id)).toContain('ZW.STAR.AUX.MUYU');
    expect(groups.star.some(s => s.category === 'period')).toBe(false);
  });

  it('公開 API：ZiWei.StarRegistry / Taxonomy', () => {
    expect(ZiWei.StarRegistry.list().length).toBe(listStarRegistry().length);
    expect(ZiWei.StarRegistry.entityKind('ZW.STAR.MAJOR.ZIWEI')).toBe('star');
    expect(getStarRegistryEntry('ZW.STAR.MAJOR.ZIWEI')?.name['zh-TW']).toBe('紫微');
    expect(ZiWei.Taxonomy.kinds).toEqual(ASTRO_ENTITY_KINDS);
  });
});
