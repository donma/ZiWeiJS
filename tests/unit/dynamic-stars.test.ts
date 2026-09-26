import { describe, it, expect } from 'vitest';
import { calculate, getRule } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';
import { DynamicStarPlacement } from '../../src/core/types.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('Dynamic Period Stars (spec 0.6 §15–§19)', () => {
  const targetDate = { year: 2026, month: 9, day: 24 };
  const chart = calculate(INPUT, { targetDate });
  const dynamicStars = chart.periods.dynamicStars ?? [];

  const expectedBaseStars = [
    'ZW.STAR.AUX.TIANKUI', 'ZW.STAR.AUX.TIANYUE',
    'ZW.STAR.AUX.WENCHANG', 'ZW.STAR.AUX.WENQU',
    'ZW.STAR.AUX.LUCUN',
    'ZW.STAR.MALEFIC.QINGYANG', 'ZW.STAR.MALEFIC.TUOLUO',
    'ZW.STAR.AUX.TIANMA',
    'ZW.STAR.AUX.HONGLUAN', 'ZW.STAR.AUX.TIANXI'
  ];

  it('產生 10 顆動態星曜（流魁、流鉞、流昌、流曲、流祿、流羊、流陀、流馬、流鸞、流喜）', () => {
    const baseStarIds = dynamicStars.map(d => d.baseStarId);
    expect(baseStarIds).toHaveLength(10);
    for (const bs of expectedBaseStars) {
      expect(baseStarIds).toContain(bs);
    }
  });

  it('所有動態星曜 scope 皆為 year', () => {
    for (const d of dynamicStars) {
      expect(d.scope).toBe('year');
    }
  });

  it('動態星曜包含對應限運干支（ganzhi）與宮位地支（branch）', () => {
    for (const d of dynamicStars) {
      expect(d.ganzhi).toBeDefined();
      expect(d.branch).toBeDefined();
      expect(d.branch).toMatch(/^(zi|chou|yin|mao|chen|si|wu|wei|shen|you|xu|hai)$/);
    }
  });

  it('動態星曜由對應 ruleId 產生（可追溯）', () => {
    const ruleIds = new Set(dynamicStars.map(d => d.provenance?.ruleId));
    expect(ruleIds.size).toBe(6); // KUIYUE, CHANGQU, LUCUN, QINGYANG_TUOLUO, TIANMA, HONGLUAN_TIANXI
  });

  it('無 targetDate 時不產生動態星曜', () => {
    const natal = calculate(INPUT);
    expect(natal.periods.dynamicStars).toBeUndefined();
  });
});
