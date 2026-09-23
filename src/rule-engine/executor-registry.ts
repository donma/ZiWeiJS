import type { EngineContext } from '../executors/context.js';
import { ZiWeiError } from '../core/errors.js';

/**
 * Executor 執行結果。
 *
 * Executor **只回** inputs / result / note / status，
 * ruleId / ruleVersion / profile / sourceRefs / evidenceRefs
 * 一律由 Rule Registry 於 executeRule() 自動帶入（spec §P0-1）。
 */
export interface ExecutorOutcome {
  inputs?: Record<string, unknown>;
  result: unknown;
  status?: 'executed' | 'skipped' | 'unavailable' | 'variant' | 'error';
  reason?: string;
  note?: string;
}

export type RuleExecutor = (
  ctx: EngineContext,
  params?: Record<string, unknown>
) => ExecutorOutcome | ExecutorOutcome[] | void;

const executors = new Map<string, RuleExecutor>();

export function registerExecutor(name: string, fn: RuleExecutor): void {
  if (executors.has(name)) {
    throw new ZiWeiError('INVALID_INPUT', `Executor already registered: ${name}`, { name });
  }
  executors.set(name, fn);
}

export function getExecutor(name: string): RuleExecutor {
  const fn = executors.get(name);
  if (!fn) {
    throw new ZiWeiError('RULE_EXECUTOR_NOT_FOUND', `Rule executor not registered: ${name}`, { name });
  }
  return fn;
}

export function hasExecutor(name: string): boolean {
  return executors.has(name);
}

export function listExecutorNames(): string[] {
  return [...executors.keys()].sort();
}

/** 將 executor 回傳值正規化為 outcomes 陣列 */
export function normalizeOutcomes(out: ExecutorOutcome | ExecutorOutcome[] | void): ExecutorOutcome[] {
  if (out === undefined || out === null) return [];
  return Array.isArray(out) ? out : [out];
}
