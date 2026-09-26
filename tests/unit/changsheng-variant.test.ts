import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

describe('長生十二神方向 Variant（spec 0.6 §24 / §49 Milestone E）', () => {
  // 陰年生男性：1985-11-20 (乙丑年，陰男)
  // canonical: 陰男 → 逆行
  // quanshu-classical: 男命 → 順行
  const inputYinMale: ZiWeiBirthInput = {
    calendarType: 'solar',
    date: { year: 1985, month: 11, day: 20 },
    time: { hour: 14 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };

  it('陰男：canonical 逆行，quanshu-classical 順行（長生落宮不同）', () => {
    const canon = calculate(inputYinMale, { profile: 'canonical' });
    const qs = calculate(inputYinMale, { profile: 'quanshu-classical' });

    const canonChangsheng = canon.chart.palaces.map(p => `${p.id}:${p.changsheng}`);
    const qsChangsheng = qs.chart.palaces.map(p => `${p.id}:${p.changsheng}`);

    expect(canonChangsheng).not.toEqual(qsChangsheng);
  });

  it('陽男：兩派順逆一致（皆順行）', () => {
    const yangMale: ZiWeiBirthInput = {
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male'
    };
    const canon = calculate(yangMale, { profile: 'canonical' });
    const qs = calculate(yangMale, { profile: 'quanshu-classical' });

    const canonChangsheng = canon.chart.palaces.map(p => `${p.id}:${p.changsheng}`);
    const qsChangsheng = qs.chart.palaces.map(p => `${p.id}:${p.changsheng}`);

    expect(canonChangsheng).toEqual(qsChangsheng);
  });
});
