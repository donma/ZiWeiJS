import { describe, it, expect } from 'vitest';
import {
  analyzeBirthTime, selectCandidate, generateCandidates,
  ZiWei, calculate
} from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const BASE: Omit<ZiWeiBirthInput, 'time'> = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('Birth Time Engine（spec 0.71 §1–§14）', () => {
  it('unknown → 12 candidates（spec §6）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    expect(r.inputPrecision).toBe('unknown');
    expect(r.candidates).toHaveLength(12);
    expect(r.candidates.every(c => c.chart !== undefined)).toBe(true);
  });

  it('hour-branch → 1 representative candidate（spec §6）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'hour-branch', hourBranch: 'wu' } });
    expect(r.inputPrecision).toBe('hour-branch');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].hourBranch).toBe('wu');
    expect(r.candidates[0].representativeTime.hour).toBe(12);
    expect(r.candidates[0].representativeTime.minute).toBe(0);
  });

  it('range → correct subset（spec §6，不逐分鐘 brute force）', () => {
    const r = analyzeBirthTime({
      ...BASE,
      time: { precision: 'range', range: { fromHour: 10, toHour: 15 } }
    });
    expect(r.candidates.map(c => c.hourBranch)).toEqual(['si', 'wu', 'wei']);
  });

  it('exact → 0 candidates + calculate() 產生 exact chart', () => {
    const branches = generateCandidates('exact', BASE);
    expect(branches).toEqual([]);
    const c = calculate({ ...BASE, time: { hour: 12, minute: 0 } });
    expect(c.inputResolution?.birthTimePrecision).toBe('exact');
    expect(c.certainty.birthTime).toBe('certain');
  });

  it('hour-branch 代表時間寫入 inputResolution，不裝成精確分鐘（spec §4 / §45）', () => {
    const c = calculate({
      ...BASE,
      timePrecision: 'hour-branch',
      hourBranch: 'wu'
    });
    expect(c.inputResolution?.birthTimePrecision).toBe('hour-branch');
    expect(c.inputResolution?.representativeTimeUsed).toBe(true);
    expect(c.inputResolution?.selectedCandidate).toBe('wu');
    expect(c.input.time?.hour).toBe(12);
    expect(c.certainty.birthTime).toBe('high');
  });

  it('每個 candidate 有完整 signature（spec §9）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    for (const c of r.candidates) {
      expect(c.signature.lifePalaceBranch).toBeTruthy();
      expect(c.signature.bureau).toMatch(/^(shui2|mu3|jin4|tu5|huo6)$/);
      expect(c.timeRange).toBeDefined(); // 時辰區間在 candidate.timeRange
      expect(Object.keys(c.signature.majorStars).length).toBe(14);
    }
  });

  it('stable / variable facts 完整分類（spec §10）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    const ids = [...r.stableFacts, ...r.variableFacts].map(f => f.factId);
    expect(ids).toContain('lifePalace');
    expect(ids).toContain('bureau');
    expect(ids).toContain('majorStars');
    expect(ids).toContain('transformations');
    // stable facts 應在只有一種值的分類
    for (const f of r.stableFacts) {
      expect(f.status).toBe('stable');
      expect(Object.keys(f.values)).toHaveLength(1);
    }
    for (const f of r.variableFacts) {
      expect(f.status).toBe('variable');
      expect(Object.keys(f.values).length).toBeGreaterThan(1);
    }
  });

  it('候選自動 grouping（spec §11）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    expect(r.groups.length).toBeGreaterThan(0);
    const total = r.groups.reduce((n, g) => n + g.hourBranches.length, 0);
    expect(total).toBe(12);
    // 不得輸出假機率（spec §11）
    expect(JSON.stringify(r.groups)).not.toContain('%');
  });

  it('selectCandidate 回 chart 且標記為 user-selected-candidate（spec §14）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    const chart = selectCandidate(r, 'wu');
    expect(chart.input.birthTimeSource).toBe('user-selected-candidate');
    expect(chart.chart.natal.lifePalaceBranch).toBeTruthy();
  });

  it('selectCandidate 未知時辰拋 INVALID_INPUT', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    expect(() => selectCandidate(r, 'bogus' as any)).toThrow();
  });

  it('provenance 帶 profile / versions（spec §7）', () => {
    const r = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    expect(r.provenance.profile).toBe('canonical');
    expect(r.provenance.schemaVersion).toBeTruthy();
    expect(r.provenance.engineVersion).toBeTruthy();
  });
});
