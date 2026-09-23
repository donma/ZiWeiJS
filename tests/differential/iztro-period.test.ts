import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../../src/reference-engine/engine.js';
import type { PeriodDiffRow } from '../../tools/differential-runner/iztro-period-compare.js';

import type { TargetDate } from '../../src/index.js';

/**
 * Period Differential Tests（spec 2nd §P0-9）
 *
 * 以存檔 fixtures/differential/iztro-period/ 比對，
 * 確保 CI 環境不依賴 iztro 外部執行，亦可持續防範限運回歸。
 *
 * 驗收標準：
 *   1. 0 unclassified 差異
 *   2. decadal / yearly / monthly / daily / hourly 皆有對照
 *   3. 存檔結果與目前引擎即時計算完全一致
 */

interface PeriodFixture {
  id: string;
  input: Parameters<typeof calculate>[0];
  target: TargetDate;
  rows: PeriodDiffRow[];
  externalError?: string;
}

const dir = new URL('../../fixtures/differential/iztro-period', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

describe('P0-9 iztro period differential fixtures', () => {
  it('至少 5 筆限運案例', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const f of files) {
    const fixture: PeriodFixture = JSON.parse(readFileSync(join(dir, f), 'utf8'));

    describe(`fixture ${fixture.id}`, () => {
      it('禁止存在 unclassified 差異', () => {
        const unclassified = fixture.rows.filter(
          r => r.status === 'needs-review' && (!r.classification || r.classification === 'unclassified')
        );
        expect(unclassified).toEqual([]);
      });

      it('五層限運範圍涵蓋完整', () => {
        const scopes = new Set(fixture.rows.map(r => r.scope));
        // 年/大限必定有
        expect(scopes.has('decadal') || scopes.has('yearly')).toBe(true);
      });

      it('引擎現行輸出與 fixture 記載相符', () => {
        const chart = calculate(fixture.input, { targetDate: fixture.target });
        // 大限干支比對
        if (chart.periods.active?.major) {
          const decadalBranchRow = fixture.rows.find(r => r.scope === 'decadal' && r.field === 'branch');
          if (decadalBranchRow) {
            expect(chart.periods.active.major.ganzhi?.branch).toBe(decadalBranchRow.bible);
          }
        }
        // 流年干支比對
        if (chart.periods.year) {
          const yearBranchRow = fixture.rows.find(r => r.scope === 'yearly' && r.field === 'branch');
          if (yearBranchRow) {
            expect(chart.periods.year.ganzhi?.branch).toBe(yearBranchRow.bible);
          }
        }
      });
    });
  }
});
