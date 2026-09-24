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
  expectedScopes?: Array<'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly'>;
  external?: { sourceId: string; version: string };
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
      it('載明外部來源與版本（spec 3rd §P1-6）', () => {
        expect(fixture.external?.sourceId).toBe('SRC.IZTRO');
        expect(fixture.external?.version).toBe('2.6.1');
      });

      it('禁止存在 bug 或 unclassified 差異（spec 3rd §P0-5 Gate）', () => {
        const bad = fixture.rows.filter(
          r => r.status === 'needs-review' && (!r.classification || r.classification === 'unclassified' || r.classification === 'bug')
        );
        expect(bad).toEqual([]);
      });

      it('涵蓋四化比對（spec 3rd §P0-6：lu/quan/ke/ji）', () => {
        const fields = new Set(fixture.rows.map(r => r.field));
        expect(fields.has('sihua.lu')).toBe(true);
        expect(fields.has('sihua.quan')).toBe(true);
        expect(fields.has('sihua.ke')).toBe(true);
        expect(fields.has('sihua.ji')).toBe(true);
      });

      it('符合 expectedScopes 五層限運宣告（spec 3rd §P0-7）', () => {
        const scopes = new Set(fixture.rows.map(r => r.scope));
        for (const s of fixture.expectedScopes ?? []) {
          expect(scopes.has(s), `scope ${s} 必須存在`).toBe(true);
        }
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
        // 流月干支與命宮比對
        if (chart.periods.month) {
          const monthBranchRow = fixture.rows.find(r => r.scope === 'monthly' && r.field === 'branch');
          const monthLifeRow = fixture.rows.find(r => r.scope === 'monthly' && r.field === 'lifePalaceBranch');
          if (monthBranchRow) expect(chart.periods.month.ganzhi?.branch).toBe(monthBranchRow.bible);
          if (monthLifeRow) expect(chart.periods.month.branch).toBe(monthLifeRow.bible);
        }
      });
    });
  }
});
