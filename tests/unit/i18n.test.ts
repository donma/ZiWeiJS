import { describe, it, expect } from 'vitest';
import { calculate, t, setLocale, getLocale, renderChartSvg, listStars, PALACE_NAME, BUREAU_NAME, dignityLabel } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const INPUT: ZiWeiBirthInput = {
  calendarType: 'solar', date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 }, sexForCalculation: 'male'
};

describe('i18n', () => {
  it('switches locale', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    setLocale('zh-TW');
    expect(getLocale()).toBe('zh-TW');
  });

  it('every star has zh-TW / zh-CN / en names', () => {
    for (const s of listStars()) {
      expect(s.name['zh-TW'], `${s.id} zh-TW`).toBeTruthy();
      expect(s.name['zh-CN'], `${s.id} zh-CN`).toBeTruthy();
      expect(s.name['en'], `${s.id} en`).toBeTruthy();
    }
  });

  it('palace + bureau names have all three locales', () => {
    for (const [id, name] of Object.entries(PALACE_NAME)) {
      expect(name['zh-TW'], id).toBeTruthy();
      expect(name['zh-CN'], id).toBeTruthy();
      expect(name['en'], id).toBeTruthy();
    }
    for (const [id, name] of Object.entries(BUREAU_NAME)) {
      expect(name['en'], id).toBeTruthy();
    }
  });

  it('t() falls back gracefully', () => {
    expect(t({ 'zh-TW': '紫微' }, 'en')).toBe('紫微');
    expect(t({ en: 'Zi Wei' }, 'zh-CN')).toBe('Zi Wei');
    expect(t(undefined)).toBe('');
  });

  it('dignityLabel is locale-aware', () => {
    expect(dignityLabel('miao', 'zh-TW')).toBe('廟');
    expect(dignityLabel('miao', 'zh-CN')).toBe('庙');
    expect(dignityLabel('miao', 'en')).toBe('Exalted');
  });

  it('SVG renders in different locales', () => {
    const chart = calculate(INPUT);
    const zh = renderChartSvg(chart, { locale: 'zh-TW' });
    const cn = renderChartSvg(chart, { locale: 'zh-CN' });
    const en = renderChartSvg(chart, { locale: 'en' });
    expect(zh).toContain('命宮');
    expect(cn).toContain('命宫');
    expect(en).toContain('Life');
    expect(zh).not.toBe(en);
  });

  it('rule ids are locale-independent', () => {
    const chart = calculate(INPUT);
    const ids = chart.trace?.entries.map(e => e.ruleId) ?? [];
    expect(ids.every(id => /^ZW\.[A-Z0-9._-]+$/.test(id))).toBe(true);
  });
});
