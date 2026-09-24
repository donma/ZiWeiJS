import { describe, it, expect } from 'vitest';
import { calculate, listRules } from '../../src/index.js';
import type { ZiWeiBirthInput, Provenance } from '../../src/index.js';

/**
 * spec 3rd §P1-7：Output Provenance 不得只存在 Trace
 *
 * 每個輸出實體（星曜 / 四化 / 格局 / 解讀 / 限運）都必須帶 provenance，
 * 且 ruleVersion 一律由 Rule Registry 注入，executor 不得硬寫。
 */

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

const chart = calculate(base, { targetDate: { year: 2026, month: 9, day: 23, hour: 14 } });
const ruleVersion = new Map(listRules().map(r => [r.ruleId, r.ruleVersion]));

function expectProvenance(p: Provenance | undefined, label: string) {
  expect(p, `${label} 缺 provenance`).toBeTruthy();
  expect(p!.ruleId, `${label} provenance.ruleId`).toBeTruthy();
  expect(p!.ruleVersion, `${label} provenance.ruleVersion`).toBeTruthy();
  expect(p!.profile).toBe(chart.generatedWith.profile);
  expect(Array.isArray(p!.sourceRefs)).toBe(true);
  expect(Array.isArray(p!.evidenceRefs)).toBe(true);
}

describe('P1-7 星曜 provenance', () => {
  it('每個 StarPlacement 皆有 provenance', () => {
    const placements = Object.values(chart.chart.stars);
    expect(placements.length).toBeGreaterThan(0);
    for (const p of placements) expectProvenance(p.provenance, p.starId);
  });

  it('provenance.ruleVersion 與 Registry 當前版本一致（非硬寫 1.0）', () => {
    for (const p of Object.values(chart.chart.stars)) {
      const v = ruleVersion.get(p.provenance!.ruleId);
      if (v) expect(p.provenance!.ruleVersion).toBe(v);
      expect(p.ruleVersion).toBe(p.provenance!.ruleVersion);
    }
  });

  it('provenance 並非硬寫：整體存在 ruleVersion ≠ 1.0 的實體（流月 2.1）', () => {
    const versions = [
      ...Object.values(chart.chart.stars).map(p => p.provenance!.ruleVersion),
      ...chart.chart.transformations.map(t => t.provenance!.ruleVersion),
      ...chart.chart.patterns.map(p => p.provenance!.ruleVersion),
      chart.periods.month!.provenance!.ruleVersion
    ];
    expect(versions.some(v => v !== '1.0')).toBe(true);
  });
});

describe('P1-7 四化 / 格局 / 解讀 / 限運 provenance', () => {
  it('本命四化帶 provenance', () => {
    expect(chart.chart.transformations.length).toBeGreaterThan(0);
    for (const t of chart.chart.transformations) expectProvenance(t.provenance, `transformation ${t.type}`);
  });

  it('格局帶 provenance', () => {
    expect(chart.chart.patterns.length).toBeGreaterThan(0);
    for (const p of chart.chart.patterns) expectProvenance(p.provenance, p.patternId);
  });

  it('解讀命中帶 provenance', () => {
    expect(chart.interpretation.hits.length).toBeGreaterThan(0);
    for (const h of chart.interpretation.hits) expectProvenance(h.provenance, h.ruleId);
  });

  it('限運 PeriodInfo 帶 provenance（含流月 2.1）', () => {
    for (const info of [chart.periods.year, chart.periods.month, chart.periods.day, chart.periods.hour]) {
      expectProvenance(info?.provenance, `period ${info?.scope}`);
    }
    expect(chart.periods.month!.provenance!.ruleId).toBe('ZW.CALC.PERIOD.LIUYUE.001');
    expect(chart.periods.month!.provenance!.ruleVersion).toBe('2.1');
    expectProvenance(chart.periods.active?.major?.provenance, 'active major');
  });
});
