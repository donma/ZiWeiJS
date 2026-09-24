import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput, ZiWeiChart } from '../../src/index.js';

/**
 * Large Corpus（spec Post-Stability Phase H / M8）
 *
 * 以固定間隔掃描 1900–2100（每 10 日一盤，共約 7,300 盤），驗證：
 *   - 全部成功、無例外（errors = 0）
 *   - 結構鐵律在整個語料庫成立
 *   - 語料庫確實覆蓋五行局、十二命宮地支（避免抽樣偏差）
 * 語料庫固定 → 可重現；統計報告見 npm run stats:distribution。
 */
const START = Date.UTC(1900, 0, 1);
const END = Date.UTC(2100, 11, 31);
const DAY = 86_400_000;
const STEP_DAYS = 10;

const MAJOR_COUNT = 14;

function inputFor(t: number): ZiWeiBirthInput {
  const d = new Date(t);
  return {
    calendarType: 'solar',
    date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    time: { hour: 10, minute: 0 },
    timezone: 'Asia/Taipei',
    sexForCalculation: 'male'
  };
}

/** 目標日期一律晚於出生：birth +40 年，夾到 2100 上限；2/29 出生者夾到該月最後一日 */
function targetFor(t: number): { year: number; month: number; day: number; hour: number } {
  const d = new Date(t);
  const year = Math.min(d.getUTCFullYear() + 40, 2100);
  const month = d.getUTCMonth() + 1;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return { year, month, day, hour: 10 };
}

describe('large corpus: 1900–2100 每 10 日一盤', () => {
  const charts: Array<{ label: string; chart: ZiWeiChart }> = [];
  const failures: string[] = [];
  let total = 0;

  for (let t = START; t <= END; t += STEP_DAYS * DAY) {
    const input = inputFor(t);
    const label = `${input.date.year}-${input.date.month}-${input.date.day}`;
    total += 1;
    let chart: ZiWeiChart;
    try {
      chart = calculate(input, { targetDate: targetFor(t) });
    } catch (err) {
      failures.push(`throw ${label}: ${(err as Error).message}`);
      continue;
    }

    if (chart.chart.palaces.length !== 12) failures.push(`${label}: palaces=${chart.chart.palaces.length}`);
    if (new Set(chart.chart.palaces.map(p => p.branch)).size !== 12) failures.push(`${label}: branch 不唯一`);
    if (chart.chart.palaces.filter(p => p.isLifePalace).length !== 1) failures.push(`${label}: 命宮數不為 1`);
    if (chart.chart.palaces.filter(p => p.isBodyPalace).length !== 1) failures.push(`${label}: 身宮數不為 1`);

    const majors = Object.values(chart.chart.stars).filter(s => s.star.category === 'major');
    if (majors.length !== MAJOR_COUNT) failures.push(`${label}: 主星數=${majors.length}`);

    const palaceBranch = new Map(chart.chart.palaces.map(p => [p.id, p.branch]));
    for (const s of Object.values(chart.chart.stars)) {
      if (!palaceBranch.has(s.palaceId) || s.branch !== palaceBranch.get(s.palaceId)) {
        failures.push(`${label}: ${s.starId} 落宮不一致`);
        break;
      }
    }

    const ranges = chart.periods.major.map(p => [p.fromAge, p.toAge] as const);
    for (const [from, to] of ranges) {
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) failures.push(`${label}: 大限範圍異常`);
    }

    charts.push({ label, chart });
  }

  it(`語料庫共 ${total} 盤，全部無例外、無結構違規`, () => {
    expect(total).toBeGreaterThan(7000);
    expect(failures.slice(0, 10)).toEqual([]);
    expect(charts.length).toBe(total);
  });

  it('語料庫覆蓋全部五行局與十二命宮地支', () => {
    const bureaus = new Set(charts.map(c => c.chart.birthContext.bureau));
    const branches = new Set(charts.map(c => c.chart.chart.natal.lifePalaceBranch));
    expect(bureaus.size).toBe(5);
    expect(branches.size).toBe(12);
  });

  it('小限語意一致：成年後皆應有值，且 certainty 非 unavailable', () => {
    for (const { label, chart } of charts.slice(0, 400)) {
      expect(chart.periods.xiaoxian, label).toBeTruthy();
      expect(['certain', 'high', 'medium', 'low'], label).toContain(chart.certainty.xiaoxian);
      expect(chart.periods.xiaoxian!.age, label).toBeGreaterThan(0);
    }
  });
});
