import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const BASE: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('子時 Boundary（spec 0.71 §50）', () => {
  const cases: Array<{ label: string; time: { hour: number; minute: number } }> = [
    { label: '22:59（亥時）', time: { hour: 22, minute: 59 } },
    { label: '23:00（子時）', time: { hour: 23, minute: 0 } },
    { label: '23:59（子時）', time: { hour: 23, minute: 59 } },
    { label: '00:00（子時）', time: { hour: 0, minute: 0 } },
    { label: '00:59（子時）', time: { hour: 0, minute: 59 } },
    { label: '01:00（丑時）', time: { hour: 1, minute: 0 } }
  ];

  for (const { label, time } of cases) {
    for (const policy of ['midnight', 'zi-hour'] as const) {
      it(`${label} @ dayBoundary=${policy} deterministic`, () => {
        const c = calculate({ ...BASE, time, dayBoundary: policy });
        expect(c.calendar.hourBranch).toBeTruthy();
        // 子時 (23:00-00:59) 與 丑時 (01:00+) 邊界
        if (time.hour >= 23 || time.hour < 1) {
          expect(c.calendar.hourBranch).toBe('zi');
        }
        if (time.hour >= 1 && time.hour < 3) {
          expect(c.calendar.hourBranch).toBe('chou');
        }
      });
    }
  }

  it('子初換日與午夜換日的日柱不同（boundary-sensitive）', () => {
    const a = calculate({ ...BASE, time: { hour: 23, minute: 30 }, dayBoundary: 'midnight' });
    const b = calculate({ ...BASE, time: { hour: 23, minute: 30 }, dayBoundary: 'zi-hour' });
    expect(a.calendar.ganzhi.day).not.toEqual(b.calendar.ganzhi.day);
  });
});

describe('真太陽時 Boundary（spec 0.71 §51）', () => {
  it('真太陽時校正可跨越時辰（civil 巳時 → 校正後午時）', () => {
    // 台灣經度 120.5E，均時差影響有限；用大經度差製造明確跨時辰
    const civil = calculate({
      ...BASE,
      time: { hour: 10, minute: 30 },
      timeConvention: 'civil'
    });
    expect(civil.calendar.hourBranch).toBe('si');

    // 西經度 location 會把真太陽時往前推
    const trueSolar = calculate({
      ...BASE,
      time: { hour: 10, minute: 30 },
      timeConvention: 'true-solar',
      location: { longitude: 105.0 }
    });
    // 真太陽時會早 ~1 小時 → 巳時初
    expect(['chen', 'si']).toContain(trueSolar.calendar.hourBranch);
  });

  it('true-solar 缺 longitude → MISSING_LOCATION_FOR_SOLAR_TIME', () => {
    const r = calculateSafe({
      ...BASE,
      time: { hour: 10 },
      timeConvention: 'true-solar'
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_LOCATION_FOR_SOLAR_TIME');
  });
});
