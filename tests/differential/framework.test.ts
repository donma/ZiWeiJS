import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/index.js';
import { compareChart, EXTERNAL_FIELDS } from '../../tools/differential-runner/compare.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const input: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('differential framework', () => {
  it('external field coverage list is defined', () => {
    expect(EXTERNAL_FIELDS.length).toBeGreaterThan(20);
  });

  it('self-compare produces all match', () => {
    const chart = calculate(input);
    const ext: Record<string, string> = {};
    for (const f of EXTERNAL_FIELDS) ext[f] = String(f);
    // feed bible's own values back as external → all match
    const rows = compareChart(chart, (field, bible) => bible);
    expect(rows.every(r => r.status === 'match')).toBe(true);
  });

  it('mismatch flags needs-review not error', () => {
    const chart = calculate(input);
    const rows = compareChart(chart, (field, bible) => field === '命宮' ? 'WRONG' : bible);
    const bad = rows.find(r => r.field === '命宮');
    expect(bad?.status).toBe('needs-review');
    expect(rows.filter(r => r.status === 'match').length).toBe(rows.length - 1);
  });
});
