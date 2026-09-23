import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { calculate } from '../../src/index.js';
import { runIntegrityChecks } from '../../tools/integrity-validator/checks.js';

/**
 * Integrity Tests（spec §25）
 *
 * 與 npm run validate:integrity 共用同一份實作，因此 repo 內任何規則 / 來源 /
 * 證據 / profile / 星曜 registry 的破壞都會同時擋下測試與 CI gate。
 */

const { failures, stats } = runIntegrityChecks();
const violated = new Set(failures.map(f => f.check));

describe('integrity：ID 唯一', () => {
  for (const check of ['ruleId unique', 'starId unique', 'sourceId unique', 'evidenceId unique', 'profileId unique']) {
    it(`${check}`, () => expect(violated.has(check), JSON.stringify(failures.filter(f => f.check === check))).toBe(false));
  }
});

describe('integrity：參照可解析', () => {
  for (const check of [
    'sourceRef resolvable',
    'evidenceRef resolvable',
    'variantOf resolvable',
    'executor resolvable',
    'evidence.sourceId resolvable',
    'star source resolvable',
    'profile override source resolvable',
    'profile override target resolvable',
  ]) {
    it(`${check}`, () => expect(violated.has(check), JSON.stringify(failures.filter(f => f.check === check))).toBe(false));
  }
});

describe('integrity：canonical 溯源要求', () => {
  it('canonical rule 有 sourceRef', () => expect(violated.has('canonical has sourceRef')).toBe(false));
  it('canonical rule 有 evidenceRef', () => expect(violated.has('canonical has evidenceRef')).toBe(false));
  it('canonical star 有 source', () => expect(violated.has('canonical star has source')).toBe(false));
});

describe('integrity：schema 與計畫', () => {
  it('Rule DSL schema valid', () => expect(violated.has('dsl schema valid')).toBe(false));
  it('Star schema valid', () => expect(violated.has('star schema valid')).toBe(false));
  it('executor 皆已註冊', () => expect(violated.has('planned executor registered')).toBe(false));
  it('每條 calculation 規則都有 stage', () => expect(violated.has('calculation rule has stage')).toBe(false));
  it('可分期規則都在執行計畫內', () => expect(violated.has('stagable rule is in a plan')).toBe(false));
  it('每條規則都有 changeLog', () => expect(violated.has('rule has changeLog')).toBe(false));
  it('canonical ruleVersion 與 changeLog 一致', () => expect(violated.has('ruleVersion matches latest changeLog')).toBe(false));
});

describe('integrity：整體', () => {
  it('無任何 integrity failure', () => {
    expect(failures).toEqual([]);
  });

  it('檢查覆蓋規模符合預期', () => {
    expect(stats.rules).toBeGreaterThanOrEqual(200);
    expect(stats.stars).toBeGreaterThanOrEqual(90);
    expect(stats.sources).toBeGreaterThan(0);
    expect(stats.evidence).toBeGreaterThan(0);
    expect(stats.profiles).toBeGreaterThan(0);
    expect(stats.executors).toBeGreaterThan(0);
    expect(stats.natalPlan).toBeGreaterThan(0);
    expect(stats.periodPlan).toBeGreaterThan(0);
  });
});

describe('integrity：Chart output schema valid', () => {
  const chartSchema = JSON.parse(
    readFileSync(new URL('../../schemas/chart.schema.json', import.meta.url), 'utf8'),
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(chartSchema);

  it('canonical 輸入之輸出符合 chart.schema.json', () => {
    const chart = calculate({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10, minute: 30 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'male',
    });
    const ok = validate(chart);
    expect(ok, ajv.errorsText(validate.errors)).toBe(true);
  });

  it('含 targetDate 之輸出符合 chart.schema.json', () => {
    const chart = calculate({
      calendarType: 'solar',
      date: { year: 1990, month: 5, day: 15 },
      time: { hour: 10, minute: 30 },
      timezone: 'Asia/Taipei',
      sexForCalculation: 'female',
    }, { targetDate: { year: 2026, month: 9, day: 23 } });
    const ok = validate(chart);
    expect(ok, ajv.errorsText(validate.errors)).toBe(true);
  });
});
