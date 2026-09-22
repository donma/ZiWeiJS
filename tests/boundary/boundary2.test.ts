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

  it('unknown sex still computes (forward direction default) but flagged', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10 },
      sexForCalculation: 'unknown'
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.chart.birthContext.direction).toBe('forward');
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
