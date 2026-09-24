import { describe, it, expect } from 'vitest';
import { calculate, QueryApi as Q } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * Query Facade（spec Post-Stability §8）
 *
 * 只查既有結果；不新增演算法。
 */

const input: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const chart = calculate(input, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });

describe('Query.palace / star', () => {
  it('palace 取得命宮', () => {
    const life = Q.palace(chart, 'life');
    expect(life).toBeTruthy();
    expect(life!.isLifePalace).toBe(true);
  });

  it('star 取得紫微落宮', () => {
    const s = Q.star(chart, 'ZW.STAR.MAJOR.ZIWEI');
    expect(s).toBeTruthy();
    expect(s!.starId).toBe('ZW.STAR.MAJOR.ZIWEI');
  });

  it('hasStars / hasAnyStar 以該宮實際星曜判定', () => {
    const life = Q.palace(chart, 'life')!;
    const ids = life.stars.map(s => s.starId);
    if (ids.length > 0) {
      expect(Q.hasStars(chart, { palace: 'life', all: [ids[0]] })).toBe(true);
      expect(Q.hasAnyStar(chart, { palace: 'life', any: [ids[0], 'ZW.NOT.A.STAR'] })).toBe(true);
    }
    expect(Q.hasStars(chart, { palace: 'life', all: ['ZW.NOT.A.STAR'] })).toBe(false);
  });
});

describe('Query.relations', () => {
  it('三合四正 4 宮、對宮不同支', () => {
    const rel = Q.relations(chart, 'life');
    expect(rel.sanFangSiZheng).toHaveLength(4);
    expect(rel.opposite).toBeTruthy();
    expect(rel.opposite!.branch).not.toBe(rel.self!.branch);
    expect(rel.trine).toHaveLength(2);
    expect(rel.adjacent).toHaveLength(2);
  });

  it('sanFangSiZheng / opposite 與 relations 一致', () => {
    expect(Q.sanFangSiZheng(chart, 'career').map(p => p.id)).toEqual(
      Q.relations(chart, 'career').sanFangSiZheng.map(p => p.id)
    );
    expect(Q.opposite(chart, 'career')!.id).toBe(Q.relations(chart, 'career').opposite!.id);
  });

  it('oppositeBranch 為對宮', () => {
    expect(Q.oppositeBranch('zi')).toBe('wu');
    expect(Q.oppositeBranch('wu')).toBe('zi');
  });
});

describe('Query.transformations / period', () => {
  it('natal 四化 4 筆', () => {
    expect(Q.transformations(chart, { scope: 'natal' })).toHaveLength(4);
  });

  it('period 查流年 / 流月', () => {
    expect(Q.period(chart, 'year')?.scope).toBe('year');
    expect(Q.period(chart, 'month')?.scope).toBe('month');
  });

  it('isEmptyPalace 與 majorStars 一致', () => {
    for (const p of chart.chart.palaces) {
      expect(Q.isEmptyPalace(chart, p.id)).toBe(p.majorStars.length === 0);
    }
  });

  it('selfTransformations 回傳陣列', () => {
    expect(Array.isArray(Q.selfTransformations(chart, 'life'))).toBe(true);
  });
});
