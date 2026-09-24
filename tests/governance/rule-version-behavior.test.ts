import { describe, it, expect } from 'vitest';
import { listRules, getRule } from '../../src/index.js';

/**
 * spec 3rd §4 Rule Version Gate V2 / §P0-11 / §10-9
 *
 * 「同一個 Rule Version 必須代表同一個可重現行為。」
 *   - changeLog[0].version === ruleVersion
 *   - changeLog 版本嚴格遞減
 *   - 最新一筆 behavior-change 的版本必須等於 ruleVersion（行為改了不得沿用舊版號）
 */

interface ChangeLogEntry {
  version: string;
  type: string;
  date?: string;
  note?: string;
}

function cmp(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function changeLogOf(ruleId: string): ChangeLogEntry[] {
  const r = getRule(ruleId) as unknown as { changeLog?: ChangeLogEntry[] };
  return r.changeLog ?? [];
}

const rules = listRules();

describe('§4 Rule Version Gate', () => {
  it('每條規則都有 changeLog', () => {
    const missing = rules.filter(r => ((r as unknown as { changeLog?: unknown[] }).changeLog ?? []).length === 0);
    expect(missing.map(r => r.ruleId)).toEqual([]);
  });

  it('changeLog[0].version === ruleVersion', () => {
    const bad: string[] = [];
    for (const r of rules) {
      const log = changeLogOf(r.ruleId);
      if (log[0]?.version !== r.ruleVersion) bad.push(`${r.ruleId}: ${r.ruleVersion} vs ${log[0]?.version}`);
    }
    expect(bad).toEqual([]);
  });

  it('changeLog 版本嚴格遞減（新 → 舊）', () => {
    const bad: string[] = [];
    for (const r of rules) {
      const log = changeLogOf(r.ruleId);
      for (let i = 1; i < log.length; i++) {
        if (cmp(log[i - 1].version, log[i].version) <= 0) {
          bad.push(`${r.ruleId}: ${log.map(l => l.version).join(' > ')}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('最新 behavior-change 版本 === ruleVersion', () => {
    const bad: string[] = [];
    for (const r of rules) {
      const log = changeLogOf(r.ruleId);
      const behavior = log.filter(l => l.type === 'behavior-change');
      if (behavior.length > 0 && behavior[0].version !== r.ruleVersion) {
        bad.push(`${r.ruleId}: ruleVersion ${r.ruleVersion}, latest behavior-change ${behavior[0].version}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('§P0-11 本輪 behavior-change 已升版', () => {
  const expected: Array<[string, string]> = [
    ['ZW.CALC.PERIOD.LIUYUE.001', '2.1'],
    ['ZW.CALC.PERIOD.LIUNIAN.001', '1.1'],
    ['ZW.CALC.PERIOD.LIURI.001', '1.1'],
    ['ZW.CALC.PERIOD.LIUSHI.001', '1.1']
  ];

  for (const [ruleId, version] of expected) {
    it(`${ruleId} = ${version} 且為 behavior-change`, () => {
      const r = getRule(ruleId);
      expect(r.ruleVersion).toBe(version);
      const log = changeLogOf(ruleId);
      expect(log[0].type).toBe('behavior-change');
      expect(log[0].version).toBe(version);
    });
  }
});
