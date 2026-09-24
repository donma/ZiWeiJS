import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

/**
 * Property / invariant tests（spec Post-Stability §29）
 *
 * 每條「鐵律」都以多組輸入驗證；任何破壞都會被擋下。
 */

const INPUTS: ZiWeiBirthInput[] = [
  { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 2000, month: 8, day: 16 }, time: { hour: 23 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' },
  { calendarType: 'solar', date: { year: 1985, month: 11, day: 20 }, time: { hour: 0 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 1978, month: 12, day: 25 }, time: { hour: 6 }, timezone: 'America/New_York', sexForCalculation: 'female' },
  { calendarType: 'lunar', date: { year: 2020, month: 4, day: 10, isLeapMonth: true }, time: { hour: 10 }, timezone: 'Asia/Taipei', sexForCalculation: 'male' },
  { calendarType: 'solar', date: { year: 2020, month: 2, day: 29 }, time: { hour: 23 }, timezone: 'Asia/Taipei', sexForCalculation: 'female' }
];

const MAJOR_STAR_IDS = [
  'ZW.STAR.MAJOR.ZIWEI', 'ZW.STAR.MAJOR.TIANJI', 'ZW.STAR.MAJOR.TAIYANG', 'ZW.STAR.MAJOR.WUQU',
  'ZW.STAR.MAJOR.TIANTONG', 'ZW.STAR.MAJOR.LIANZHEN', 'ZW.STAR.MAJOR.TIANFU', 'ZW.STAR.MAJOR.TAIYIN',
  'ZW.STAR.MAJOR.TANLANG', 'ZW.STAR.MAJOR.JUMEN', 'ZW.STAR.MAJOR.TIANXIANG', 'ZW.STAR.MAJOR.TIANLIANG',
  'ZW.STAR.MAJOR.QISHA', 'ZW.STAR.MAJOR.POJUN'
];

describe('property: 命盤結構鐵律', () => {
  for (const input of INPUTS) {
    const label = `${input.calendarType} ${input.date.year}-${input.date.month}-${input.date.day} ${input.time?.hour}h`;
    const chart = calculate(input);

    it(`${label}: 恰好 12 宮、地支與宮名唯一`, () => {
      expect(chart.chart.palaces).toHaveLength(12);
      expect(new Set(chart.chart.palaces.map(p => p.branch)).size).toBe(12);
      expect(new Set(chart.chart.palaces.map(p => p.id)).size).toBe(12);
    });

    it(`${label}: 命宮 / 身宮各唯一`, () => {
      expect(chart.chart.palaces.filter(p => p.isLifePalace)).toHaveLength(1);
      expect(chart.chart.palaces.filter(p => p.isBodyPalace)).toHaveLength(1);
    });

    it(`${label}: 十四主星各恰好一次`, () => {
      for (const id of MAJOR_STAR_IDS) {
        const count = Object.values(chart.chart.stars)
          .filter(s => s.star.category === 'major' && s.starId === id).length;
        expect(count, id).toBe(1);
      }
    });

    it(`${label}: 紫微系與天府系相對位置固定`, () => {
      const b = (id: string) => {
        const s = chart.chart.stars[id];
        return s ? s.branch : undefined;
      };
      // 紫微系（逆）：紫微→天機 為 -1
      const zi = b('ZW.STAR.MAJOR.ZIWEI');
      const ji = b('ZW.STAR.MAJOR.TIANJI');
      expect(zi).toBeTruthy();
      expect(ji).toBeTruthy();
      // 天府系（順）：天府→太陰 為 +1
      const fu = b('ZW.STAR.MAJOR.TIANFU');
      const yin = b('ZW.STAR.MAJOR.TAIYIN');
      expect(fu).toBeTruthy();
      expect(yin).toBeTruthy();

      const idx: Record<string, number> = {
        zi: 0, chou: 1, yin: 2, mao: 3, chen: 4, si: 5, wu: 6, wei: 7, shen: 8, you: 9, xu: 10, hai: 11
      };
      expect(((idx[ji!] - idx[zi!]) % 12 + 12) % 12).toBe(11); // -1
      expect(((idx[yin!] - idx[fu!]) % 12 + 12) % 12).toBe(1);  // +1
    });
  }
});

describe('property: 四化與決定性', () => {
  it('一干四化之星各四化唯一', () => {
    for (const input of INPUTS) {
      const chart = calculate(input);
      const natal = chart.chart.transformations.filter(t => t.sourceScope === 'natal');
      for (const type of ['lu', 'quan', 'ke', 'ji'] as const) {
        expect(natal.filter(t => t.type === type).length, `${type}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('同一輸入完全決定性（含 periods）', () => {
    for (const input of INPUTS) {
      const a = calculate(input, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });
      const b = calculate(input, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('period overlay 不污染 natal', () => {
    for (const input of INPUTS) {
      const natal = calculate(input);
      const timed = calculate(input, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });
      const natalSlice = (c: typeof natal) =>
        JSON.stringify({ natal: c.chart.natal, palaces: c.chart.palaces.map(p => ({ id: p.id, branch: p.branch, stars: p.stars.map(s => s.starId) })), stars: Object.keys(c.chart.stars).sort() });
      expect(natalSlice(timed)).toBe(natalSlice(natal));
    }
  });
});
