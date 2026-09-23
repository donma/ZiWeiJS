import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

describe('boundary – leap month & edge', () => {
  it('lunar leap month day out of range errors', () => {
    const r = calculateSafe({
      calendarType: 'lunar',
      date: { year: 1990, month: 5, day: 31, isLeapMonth: true },
      time: { hour: 8 },
      sexForCalculation: 'male'
    });
    expect(r.ok).toBe(false);
  });

  it('overseas timezone shifts hour branch', () => {
    const input: ZiWeiBirthInput = {
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10, minute: 30 },
      sexForCalculation: 'male'
    };
    const a = calculate({ ...input, timezone: 'Asia/Taipei' });
    const b = calculate({ ...input, timezone: 'America/New_York' });
    expect(a.calendar.utcOffsetMinutes).not.toBe(b.calendar.utcOffsetMinutes);
    // same civil time, different timezone → same hour branch (civil convention) but different UTC instant
    expect(a.calendar.hourBranch).toBe(b.calendar.hourBranch);
  });

  it('unknown sex does NOT guess direction (undetermined) but natal still computed', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      sexForCalculation: 'unknown'
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // spec §27：不得 unknown → forward
    expect(r.chart.birthContext.direction).toBe('undetermined');
    expect(r.chart.certainty.direction).toBe('unknown');
    expect(r.chart.certainty.majorPeriods).toBe('unknown');
    // 不依賴性別的 natal 資料仍可計算
    expect(r.chart.chart.natal.lifePalaceBranch).toBe('zi');
    // 依賴性別的結果不得產出
    expect(r.chart.periods.major).toEqual([]);
    expect(r.chart.chart.palaces.every(p => p.changsheng === undefined)).toBe(true);
  });

  it('unknown sex → trace marks dependent rules as unavailable', () => {
    const c = calculate({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      sexForCalculation: 'unknown'
    }, { trace: true });
    const skipped = c.trace!.entries.filter(e => e.status === 'unavailable');
    expect(skipped.map(e => e.ruleId).sort()).toEqual([
      'ZW.CALC.BIRTH.SEX_DIRECTION.001',
      'ZW.CALC.PERIOD.DAXIAN.001',
      'ZW.CALC.STAR.CHANGSHENG12.001'
    ]);
    expect(skipped.every(e => e.reason === 'UNKNOWN_SEX_FOR_CALCULATION')).toBe(true);
  });

  it('year 1900 lower bound works', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1900, month: 1, day: 1 },
      time: { hour: 8 },
      sexForCalculation: 'male'
    });
    expect(r.ok).toBe(true);
  });

  it('year 2100 upper bound works', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 2100, month: 12, day: 31 },
      time: { hour: 23 },
      sexForCalculation: 'female'
    });
    expect(r.ok).toBe(true);
  });
});
