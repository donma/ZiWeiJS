import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePeriodGate,
  varianceRegistryMatch,
  HARD_FAIL,
  KNOWN_VARIANCE,
  type VarianceEntry
} from '../../tools/differential-runner/period-gate.js';
import type { PeriodDiffRow } from '../../tools/differential-runner/iztro-period-compare.js';
import type { DiffClassification } from '../../tools/differential-runner/iztro-compare.js';

/**
 * spec 3rd §P0-5 / §3：Period Differential Gate
 *
 *   bug / unclassified          → 一律 fail
 *   known variance 但未登錄      → fail（UNTRACKED）
 *   known variance 且已登錄      → pass
 */

const root = fileURLToPath(new URL('../../', import.meta.url));
const registry: VarianceEntry[] = (
  JSON.parse(readFileSync(join(root, 'variants/differential.json'), 'utf8')) as { variances: VarianceEntry[] }
).variances;

function row(
  scope: PeriodDiffRow['scope'],
  field: PeriodDiffRow['field'],
  classification?: DiffClassification
): PeriodDiffRow {
  return { scope, field, bible: 'a', external: 'b', status: 'needs-review', classification };
}

describe('P0-5 evaluatePeriodGate', () => {
  it('match 不進 gate', () => {
    const m: PeriodDiffRow = { scope: 'yearly', field: 'stem', bible: 'a', external: 'a', status: 'match' };
    const { hardFails, untracked } = evaluatePeriodGate([m], registry);
    expect(hardFails).toEqual([]);
    expect(untracked).toEqual([]);
  });

  it('bug 一律 hard fail', () => {
    const { hardFails } = evaluatePeriodGate([row('decadal', 'stem', 'bug')], registry);
    expect(hardFails).toHaveLength(1);
  });

  it('未分類（undefined）一律 hard fail', () => {
    const { hardFails } = evaluatePeriodGate([row('monthly', 'branch')], registry);
    expect(hardFails).toHaveLength(1);
  });

  it('unclassified 一律 hard fail', () => {
    const { hardFails } = evaluatePeriodGate([row('monthly', 'branch', 'unclassified')], registry);
    expect(hardFails).toHaveLength(1);
  });

  it('已知分類但未登錄 → untracked（fail）', () => {
    const { hardFails, untracked } = evaluatePeriodGate([row('monthly', 'stem', 'school-variance')], registry);
    expect(hardFails).toEqual([]);
    expect(untracked).toHaveLength(1);
  });

  it('晚子時流日差異已登錄 → pass', () => {
    const { hardFails, untracked } = evaluatePeriodGate([row('daily', 'sihua.lu', 'day-boundary-variance')], registry);
    expect(hardFails).toEqual([]);
    expect(untracked).toEqual([]);
  });

  it('晚子時流時差異已登錄（hourly.*）→ pass', () => {
    const { untracked } = evaluatePeriodGate([row('hourly', 'branch', 'day-boundary-variance')], registry);
    expect(untracked).toEqual([]);
  });

  it('分類集合定義正確', () => {
    expect([...HARD_FAIL].sort()).toEqual(['bug', 'unclassified']);
    expect(KNOWN_VARIANCE.has('school-variance')).toBe(true);
    expect(KNOWN_VARIANCE.has('bug')).toBe(false);
  });
});

describe('P0-5 varianceRegistryMatch', () => {
  it('scope 為 * 時不限制 scope', () => {
    const v = registry.find(x => x.varianceId === 'VAR.PERIOD.SCHOOL.SIHUA')!;
    expect(varianceRegistryMatch(row('monthly', 'sihua.ke', 'school-variance'), [v])).toBeTruthy();
    expect(varianceRegistryMatch(row('hourly', 'sihua.ji', 'school-variance'), [v])).toBeTruthy();
  });

  it('scope 不符時不匹配', () => {
    const v = registry.find(x => x.varianceId === 'VAR.PERIOD.DAY_BOUNDARY.LATE_ZI')!;
    expect(varianceRegistryMatch(row('monthly', 'branch', 'day-boundary-variance'), [v])).toBeFalsy();
    expect(varianceRegistryMatch(row('daily', 'branch', 'day-boundary-variance'), [v])).toBeTruthy();
  });

  it('classification 不符時不匹配', () => {
    const v = registry.find(x => x.varianceId === 'VAR.PERIOD.DAY_BOUNDARY.LATE_ZI')!;
    expect(varianceRegistryMatch(row('daily', 'branch', 'school-variance'), [v])).toBeFalsy();
  });
});

describe('P0-5 Variance Registry 治理', () => {
  it('AI 不得自行核可：所有 acceptedByOwner 為 false', () => {
    expect(registry.length).toBeGreaterThan(0);
    for (const v of registry) {
      expect(v.acceptedByOwner, `${v.varianceId} 不應被 AI 標記為已核可`).toBe(false);
    }
  });

  it('每筆 variance 皆有唯一 ID 與 rationale', () => {
    const ids = registry.map(v => v.varianceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of registry) {
      expect(v.rationale, `${v.varianceId} 缺 rationale`).toBeTruthy();
      expect(KNOWN_VARIANCE.has(v.classification), `${v.varianceId} 分類 ${v.classification} 非 known variance`).toBe(true);
    }
  });
});
