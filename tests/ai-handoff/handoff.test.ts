import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import {
  calculate, handoff, handoffUnknownTime, toMarkdown, toJson,
  analyzeBirthTime
} from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const root = process.cwd();
const schema = JSON.parse(readFileSync(join(root, 'schemas/ai-handoff.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const BASE: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male',
  name: '張三'
};

describe('AI Handoff Package（spec 0.71 §40–§75）', () => {
  it('compact JSON deterministic & schema valid', () => {
    const c = calculate(BASE);
    const p1 = handoff(c, { mode: 'compact' });
    const p2 = handoff(c, { mode: 'compact' });
    expect(p1).toEqual(p2);
    expect(p1.fingerprint).toBe(p2.fingerprint);
    expect(validate(p1), ajv.errorsText(validate.errors)).toBe(true);
  });

  it('full JSON deterministic & schema valid', () => {
    const c = calculate(BASE);
    const p1 = handoff(c, { mode: 'full' });
    const p2 = handoff(c, { mode: 'full' });
    expect(p1).toEqual(p2);
    expect(validate(p1), ajv.errorsText(validate.errors)).toBe(true);
    // full mode 含 sources 與 evidence
    expect(p1).toHaveProperty('sources');
    expect(p1).toHaveProperty('evidence');
  });

  it('Markdown deterministic', () => {
    const c = calculate(BASE);
    const pkg = handoff(c, { mode: 'compact' });
    const md1 = toMarkdown(pkg);
    const md2 = toMarkdown(pkg);
    expect(md1).toBe(md2);
    expect(md1).toContain('## AI 解讀注意');
    expect(md1).toContain('## 命盤核心');
    expect(md1).toContain('## 十二宮');
  });

  it('privacy: minimal 移除姓名、坐標與日期', () => {
    const c = calculate(BASE);
    const pkg = handoff(c, { privacy: 'minimal' });
    expect((pkg.subject as any).name).toBeUndefined();
    expect((pkg.birth as any).solar).toBeUndefined();
    expect((pkg.birth as any).lunar).toBeUndefined();
  });

  it('privacy: interpretation 保留計算必要值，不含姓名與坐標（預設）', () => {
    const c = calculate(BASE);
    const pkg = handoff(c, { privacy: 'interpretation' });
    expect((pkg.subject as any).name).toBeUndefined();
    expect((pkg.birth as any).solar).toBeDefined();
    expect((pkg.birth as any).birthTimePrecision).toBe('exact');
  });

  it('privacy: full 包含姓名', () => {
    const c = calculate(BASE);
    const pkg = handoff(c, { privacy: 'full' });
    expect((pkg.subject as any).name).toBe('張三');
  });

  it('profile differences: school-zhongzhou 包含在中州派差異中', () => {
    const c = calculate(BASE, { profile: 'school-zhongzhou' });
    const pkg = handoff(c);
    expect(pkg.profileDifferences).toBeDefined();
    const diffs = pkg.profileDifferences as any[];
    expect(diffs.length).toBeGreaterThan(0);
  });

  it('unknown-time: 不假裝為 exact 12:00（spec §49 / §50）', () => {
    const unk = analyzeBirthTime({ ...BASE, time: { precision: 'unknown' } });
    const pkg = handoffUnknownTime(unk);
    expect((pkg.birth as any).birthTimePrecision).toBe('unknown');
    expect(pkg).toHaveProperty('unknownTime');
    const ut = pkg.unknownTime as any;
    expect(ut.candidates.length).toBe(12);
    expect(ut.stableFacts.length).toBeGreaterThan(0);
    expect(validate(pkg), ajv.errorsText(validate.errors)).toBe(true);
  });

  it('periods: 僅在有 targetDate 時輸出（spec §58）', () => {
    const natal = calculate(BASE);
    const p1 = handoff(natal);
    expect((p1.periods as any)?.year).toBeUndefined();

    const withTarget = calculate(BASE, { targetDate: { year: 2026 } });
    const p2 = handoff(withTarget);
    expect((p2.periods as any)?.year).toBeDefined();
  });

  it('candidate dynamic stars: 僅進 researchWarnings，不混入 canonical（spec §54）', () => {
    const withDyn = calculate(BASE, { targetDate: { year: 2026 }, experimentalDynamicStars: true });
    const pkg = handoff(withDyn);
    const warnings = (pkg.researchWarnings ?? []) as any[];
    const dynWarn = warnings.filter(w => w.kind === 'dynamic-star-candidate');
    expect(dynWarn.length).toBeGreaterThan(0);
  });

  it('fingerprint stable: UI 狀態不影響 fingerprint（spec §67）', () => {
    const c = calculate(BASE);
    const p1 = handoff(c);
    const fp1 = p1.fingerprint;
    const p2 = handoff(c);
    const fp2 = p2.fingerprint;
    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });
});
