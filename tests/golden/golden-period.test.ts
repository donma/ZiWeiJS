import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../../src/reference-engine/engine.js';

/**
 * Period Golden Fixture Tests（spec 2nd §P2-3）
 *
 * 驗收 fixtures/golden-period/ 限運 oracle：
 *   - 大限切換前後
 *   - 農曆跨月 / 跨年
 *   - 閏月
 *   - 流日初一 / 月底
 *   - 23:00 子時
 *   - 非亞洲時區
 *   - 真太陽時跨日
 */

const dir = new URL('../../fixtures/golden-period', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

describe('P2-3 Period Golden Fixtures', () => {
  it('至少 10 筆限運黃金案例', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('多數案例具外部（iztro）驗證，且無 failed', () => {
    const all = files.map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')).external);
    expect(all.every(e => e)).toBe(true);
    const externallyChecked = all.filter(e => e.status === 'verified' || e.status === 'variance');
    expect(externallyChecked.length).toBeGreaterThanOrEqual(5);
    expect(all.some(e => e.status === 'verified')).toBe(true);
    expect(all.filter(e => e.status === 'failed')).toEqual([]);
  });

  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    describe(raw.name, () => {
      it('攜帶外部驗證中繼資料（spec 3rd §6）', () => {
        const ext = raw.external as {
          status: string;
          verifiedBy: string;
          against: Array<{ sourceId: string; version: string }>;
        };
        expect(ext, `${f} 缺 external 中繼資料`).toBeTruthy();
        expect(['verified', 'variance', 'engine-only']).toContain(ext.status);
        expect(ext.status).not.toBe('failed');
        if (ext.status !== 'engine-only') {
          expect(ext.verifiedBy).toBe('differential:iztro');
          expect(ext.against.some(a => a.sourceId === 'SRC.IZTRO')).toBe(true);
        }
      });

      it('即時運算完全符合 stored oracle', () => {
        const chart = calculate(raw.input, { targetDate: raw.oracle.targetDate });

        if (raw.oracle.activeMajor) {
          expect(chart.periods.active?.age).toBe(raw.oracle.activeMajor.age);
          if (raw.oracle.activeMajor.major) {
            expect(chart.periods.active?.major?.branch).toBe(raw.oracle.activeMajor.major.branch);
            expect(chart.periods.active?.major?.ganzhi).toEqual(raw.oracle.activeMajor.major.ganzhi);
          }
        }

        if (raw.oracle.year) {
          expect(chart.periods.year?.branch).toBe(raw.oracle.year.branch);
          expect(chart.periods.year?.ganzhi).toEqual(raw.oracle.year.ganzhi);
        }

        if (raw.oracle.month) {
          expect(chart.periods.month?.branch).toBe(raw.oracle.month.branch);
          expect(chart.periods.month?.ganzhi).toEqual(raw.oracle.month.ganzhi);
        }

        if (raw.oracle.day) {
          expect(chart.periods.day?.branch).toBe(raw.oracle.day.branch);
          expect(chart.periods.day?.ganzhi).toEqual(raw.oracle.day.ganzhi);
        }

        if (raw.oracle.hour) {
          expect(chart.periods.hour?.branch).toBe(raw.oracle.hour.branch);
          expect(chart.periods.hour?.ganzhi).toEqual(raw.oracle.hour.ganzhi);
        }
      });
    });
  }
});
