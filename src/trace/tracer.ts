import type { TraceEntry } from '../core/types.js';

export class Tracer {
  private enabled: boolean;
  private readonly entries: TraceEntry[] = [];

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  record(entry: TraceEntry): void {
    if (!this.enabled) return;
    this.entries.push(entry);
  }

  wrap<T>(entry: Omit<TraceEntry, 'result'>, fn: () => T): T {
    const result = fn();
    if (this.enabled) {
      this.entries.push({ ...entry, result });
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
