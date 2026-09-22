import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

describe('boundary', () => {
  it('23:00 with midnight boundary keeps same day', () => {
    const a = calculate({
      calendarType: 'solar',
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 0 },
      sexForCalculation: 'male'
    });
    const b = calculate({
      calendarType: 'solar',
      date: { year: 2000, month: 1, day: 1 },
      time: { hour: 23, minute: 0 },
      sexForCalculation: 'male',
      dayBoundary: 'zi-hour'
    });
    expect(a.calendar.hourBranch).toBe('zi');
    expect(b.calendar.dayBoundary).toBe('zi-hour');
    // zi-hour boundary → next day ganzhi
    expect(b.calendar.ganzhi.day).not.toEqual(a.calendar.ganzhi.day);
  });

  it('rejects invalid solar date', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 2020, month: 13, day: 1 },
      time: { hour: 8 },
      sexForCalculation: 'male'
    });
    expect(r.ok).toBe(false);
  });

  it('accepts lunar leap month input', () => {
    const r = calculateSafe({
      calendarType: 'lunar',
      date: { year: 1990, month: 5, day: 10, isLeapMonth: true },
      time: { hour: 6 },
      sexForCalculation: 'female'
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.chart.calendar.lunar.isLeapMonth).toBe(true);
  });

  it('true-solar profile requires longitude', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1990, month: 1, day: 1 },
      time: { hour: 12 },
      sexForCalculation: 'male'
    }, { profile: 'true-solar' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_LOCATION_FOR_SOLAR_TIME');
  });

  it('true-solar works with longitude', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1990, month: 1, day: 1 },
      time: { hour: 12 },
      location: { longitude: 121.56 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male'
    }, { profile: 'true-solar' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.chart.calendar.trueSolarOffsetMinutes).toBeTypeOf('number');
  });

  it('unsupported profile errors', () => {
    const r = calculateSafe({
      calendarType: 'solar',
      date: { year: 1990, month: 1, day: 1 },
      time: { hour: 12 },
      sexForCalculation: 'male'
    }, { profile: 'no-such-profile' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNSUPPORTED_PROFILE');
  });
});
