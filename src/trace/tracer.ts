import type { TraceEntry } from '../core/types.js';

export class Tracer {
  private enabled: boolean;
  private readonly entries: TraceEntry[] = [];

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  record(entry: TraceEntry): void {
    if (!this.enabled) return;
    this.entries.push({ status: 'executed', ...entry });
  }

  /** 記錄一筆未執行 / 無法執行的規則（spec §28） */
  recordSkipped(
    entry: Omit<TraceEntry, 'result' | 'status'>,
    status: 'skipped' | 'unavailable',
    reason: string
  ): void {
    this.record({ ...entry, result: null, status, reason });
  }

  wrap<T>(entry: Omit<TraceEntry, 'result'>, fn: () => T): T {
    const result = fn();
    if (this.enabled) {
      this.entries.push({ status: 'executed', ...entry, result });
    }
    return result;
  }

  getEntries(): TraceEntry[] {
    return this.entries;
  }

  toJSON(): { entries: TraceEntry[] } {
    return { entries: this.entries };
  }
}

export function explainTrace(
  trace: { entries: TraceEntry[] } | undefined,
  predicate: { ruleId?: string; contains?: string }
): TraceEntry[] {
  if (!trace) return [];
  return trace.entries.filter(e => {
    if (predicate.ruleId && e.ruleId !== predicate.ruleId) return false;
    if (predicate.contains && !e.ruleId.includes(predicate.contains)) return false;
    return true;
  });
}
