/**
 * Period Differential Gate（spec 3rd §P0-5 / §3 Differential Gate V2）
 *
 * 從 runner 抽出的可測試純函式：決定哪些差異列必須 fail。
 *
 *   bug / unclassified        → 一律 fail
 *   external-error            → runner 另行處理（report.externalError）
 *   school / calendar / time-basis / day-boundary / leap-month variance
 *                             → 必須登錄於 Variance Registry 才 pass，否則 fail
 *   match                     → pass
 */
import type { PeriodDiffRow } from './iztro-period-compare.js';

export interface VarianceEntry {
  varianceId: string;
  scope: string;
  field: string;
  ruleId: string;
  classification: string;
  condition?: string;
  rationale?: string;
  researchId?: string;
  acceptedByOwner?: boolean;
}

/** 一律 fail 的分類 */
export const HARD_FAIL: ReadonlySet<string> = new Set(['bug', 'unclassified']);

/** 可 pass 但須登錄於 Variance Registry 的分類 */
export const KNOWN_VARIANCE: ReadonlySet<string> = new Set([
  'school-variance',
  'calendar-variance',
  'time-basis-variance',
  'day-boundary-variance',
  'leap-month-variance'
]);

export function varianceRegistryMatch(row: PeriodDiffRow, registry: VarianceEntry[]): VarianceEntry | undefined {
  const fullField = `${row.scope}.${row.field}`;
  return registry.find(v => {
    if (v.classification !== row.classification) return false;
    if (v.scope !== '*' && v.scope !== row.scope) return false;
    if (v.field.endsWith('.*')) {
      const prefix = v.field.slice(0, -2);
      return (
        fullField.startsWith(`${prefix}.`) ||
        fullField === prefix ||
        row.field.startsWith(`${prefix}.`) ||
        row.field === prefix
      );
    }
    return v.field === row.field || v.field === fullField;
  });
}

export interface PeriodGateResult {
  hardFails: PeriodDiffRow[];
  untracked: PeriodDiffRow[];
}

export function evaluatePeriodGate(rows: PeriodDiffRow[], registry: VarianceEntry[]): PeriodGateResult {
  const review = rows.filter(r => r.status === 'needs-review');
  const hardFails = review.filter(r => !r.classification || HARD_FAIL.has(r.classification));
  const untracked = review.filter(r => {
    const cls = r.classification ?? 'unclassified';
    if (!KNOWN_VARIANCE.has(cls)) return false; // 已由 hardFails 處理
    return !varianceRegistryMatch(r, registry);
  });
  return { hardFails, untracked };
}
