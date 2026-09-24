import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe, fingerprint } from '../../../src/index.js';
import type { ZiWeiBirthInput } from '../../../src/index.js';

/**
 * Fuzz（spec Post-Stability Phase H / M8）
 *
 * 以固定種子的偽隨機輸入（可重現，非隨機失敗）餵入引擎，驗證：
 *   - 不丟出未預期例外：一律回傳命盤或具名錯誤碼
 *   - 命盤結構鐵律在任意輸入下成立（12 宮、十四主星各一、星曜歸宮一致、四化 ≤1/干）
 *   - 小限／方向缺失語意正確（未知時辰、未知性別、無目標日期）
 *   - 完全決定性（同輸入同輸出、指紋穩定）
 * 種子固定，任何失敗皆可重跑重現。
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIMEZONES = ['Asia/Taipei', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'Europe/London'];
const MAJOR_STAR_IDS = [
  'ZW.STAR.MAJOR.ZIWEI', 'ZW.STAR.MAJOR.TIANJI', 'ZW.STAR.MAJOR.TAIYANG', 'ZW.STAR.MAJOR.WUQU',
  'ZW.STAR.MAJOR.TIANTONG', 'ZW.STAR.MAJOR.LIANZHEN', 'ZW.STAR.MAJOR.TIANFU', 'ZW.STAR.MAJOR.TAIYIN',
  'ZW.STAR.MAJOR.TANLANG', 'ZW.STAR.MAJOR.JUMEN', 'ZW.STAR.MAJOR.TIANXIANG', 'ZW.STAR.MAJOR.TIANLIANG',
  'ZW.STAR.MAJOR.QISHA', 'ZW.STAR.MAJOR.POJUN'
];

function randomInput(rnd: () => number): ZiWeiBirthInput {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const year = 1900 + Math.floor(rnd() * 201);
  const month = 1 + Math.floor(rnd() * 12);
  const day = 1 + Math.floor(rnd() * 28) + (rnd() < 0.1 ? 3 : 0);
  const hourRoll = rnd();
  const time = hourRoll < 0.12 ? undefined : { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) };
  const sexRoll = rnd();
  const sexForCalculation: 'male' | 'female' | 'unknown' = sexRoll < 0.05 ? 'unknown' : pick(['male', 'female'] as const);
  const lunar = rnd() < 0.2;
  return {
    calendarType: lunar ? 'lunar' : 'solar',
    date: { year, month, day, isLeapMonth: lunar ? rnd() < 0.3 : false },
    time,
    timezone: pick(TIMEZONES),
    sexForCalculation,
    name: rnd() < 0.1 ? 'Fuzz' : undefined
  };
}

const SEED = 20260924;
const N = 250;

describe(`fuzz: ${N} 個隨機輸入（seed ${SEED}）`, () => {
  const rnd = mulberry32(SEED);
  const inputs = Array.from({ length: N }, () => randomInput(rnd));
  const results = inputs.map(input => ({ input, res: calculateSafe(input, { targetDate: { year: 2026, month: 9, day: 24, hour: 12 } }) }));

  it('一律回傳命盤或具名錯誤碼，不丟未預期例外', () => {
    for (const { input, res } of results) {
      const label = JSON.stringify(input);
      if (res.ok) {
        expect(res.chart, label).toBeTruthy();
      } else {
        expect(typeof res.error.code, label).toBe('string');
        expect(res.error.code.length, label).toBeGreaterThan(0);
        expect(res.error.message, label).toBeTruthy();
      }
    }
  });

  it('成功案例：12 宮唯一、命身宮各一、十四主星各一', () => {
    for (const { input, res } of results) {
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      const chart = res.chart;
      expect(chart.chart.palaces, label).toHaveLength(12);
      expect(new Set(chart.chart.palaces.map(p => p.branch)).size, label).toBe(12);
      expect(new Set(chart.chart.palaces.map(p => p.id)).size, label).toBe(12);
      expect(chart.chart.palaces.filter(p => p.isLifePalace).length, label).toBe(1);
      expect(chart.chart.palaces.filter(p => p.isBodyPalace).length, label).toBe(1);
      for (const id of MAJOR_STAR_IDS) {
        const count = Object.values(chart.chart.stars).filter(s => s.starId === id).length;
        expect(count, `${label} ${id}`).toBe(1);
      }
    }
  });

  it('成功案例：星曜落宮一致、四化目標存在且每型 ≤1', () => {
    for (const { input, res } of results) {
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      const chart = res.chart;
      const palaceBranch = new Map(chart.chart.palaces.map(p => [p.id, p.branch]));
      for (const s of Object.values(chart.chart.stars)) {
        expect(palaceBranch.has(s.palaceId), `${label} ${s.starId}`).toBe(true);
        expect(s.branch, `${label} ${s.starId}`).toBe(palaceBranch.get(s.palaceId));
      }
      const natal = chart.chart.transformations.filter(t => t.sourceScope === 'natal');
      for (const tr of natal) {
        expect(chart.chart.stars[tr.targetStarId], `${label} ${tr.targetStarId}`).toBeTruthy();
      }
      for (const type of ['lu', 'quan', 'ke', 'ji'] as const) {
        expect(natal.filter(t => t.type === type).length, `${label} ${type}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('小限與方向語意：性別未知則方向未定且不落小限', () => {
    for (const { input, res } of results) {
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      const chart = res.chart;
      if (chart.periods.xiaoxian) {
        expect(['certain', 'high', 'medium', 'low'], label).toContain(chart.certainty.xiaoxian);
        expect(chart.periods.xiaoxian.branch, label).toBeTruthy();
        expect(Number.isFinite(chart.periods.xiaoxian.age), label).toBe(true);
      }
      if (input.sexForCalculation === 'unknown') {
        expect(chart.birthContext.direction, label).toBe('undetermined');
        expect(chart.periods.xiaoxian, label).toBeUndefined();
        expect(chart.certainty.xiaoxian, label).toBe('unknown');
      }
    }
  });

  it('無目標日期：不下限運、小限不存在且 certainty 標示 unavailable', () => {
    for (const { input } of results.slice(0, 60)) {
      const res = calculateSafe(input);
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      expect(res.chart.periods.year, label).toBeUndefined();
      expect(res.chart.periods.xiaoxian, label).toBeUndefined();
      expect(['unavailable', 'unknown'], label).toContain(res.chart.certainty.xiaoxian);
    }
  });

  it('大限範圍單調且不重疊', () => {
    for (const { input, res } of results) {
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      const ranges = res.chart.periods.major.map(p => [p.fromAge, p.toAge] as const);
      for (const [from, to] of ranges) {
        expect(Number.isFinite(from) && Number.isFinite(to), label).toBe(true);
        expect(to, label).toBeGreaterThanOrEqual(from);
      }
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i][0], label).toBeGreaterThanOrEqual(ranges[i - 1][1] + 1);
      }
    }
  });

  it('完全決定性（重算相同、指紋穩定）', () => {
    for (const { input, res } of results.slice(0, 40)) {
      if (!res.ok) continue;
      const label = JSON.stringify(input);
      const again = calculate(input, { targetDate: { year: 2026, month: 9, day: 24, hour: 12 } });
      expect(JSON.stringify(again), label).toBe(JSON.stringify(res.chart));
      expect(fingerprint(res.chart), label).toBe(fingerprint(again));
    }
  });
});
