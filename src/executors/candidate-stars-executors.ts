/**
 * 補充安星 executors（spec Post-Stability Phase B/C）。
 *
 * - `calcAuxTaiFuFengGao` / `calcAuxJieShen`：canonical（Owner 於 2026-09-24 批准），
 *   由 `stage: "natal"` 規則呼叫，安置台輔／封誥／解神於本命盤。
 * - `calcCandidateXiaoXian`：仍為 candidate（`stage: "on-demand"`），
 *   以目標日期之農曆年計算虛歲後定位；性別未知或無目標日期時 skip。
 */
import type { EngineContext } from './context.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import type { BranchId } from '../core/types.js';
import { placeStar } from './star-executors.js';
import {
  TAIFU_FENGGAO_RULE_ID,
  JIESHEN_RULE_ID,
  XIAOXIAN_RULE_ID,
  candidateAuxStars,
  xiaoXianForTarget
} from '../candidate-stars/candidate-stars.js';

/** 台輔 / 封誥（生時系） */
export function calcAuxTaiFuFengGao(ctx: EngineContext): ExecutorOutcome {
  const hourBranch = ctx.normalized.hourBranch as BranchId;
  const yearBranch = ctx.normalized.ganzhi.year.branch as BranchId;
  const placed: string[] = [];
  for (const p of candidateAuxStars({ hourBranch, yearBranch })) {
    if (p.basis !== 'hour-branch') continue;
    if (p.ruleId !== TAIFU_FENGGAO_RULE_ID) continue;
    placeStar(ctx, p.starId, p.branch, p.ruleId);
    placed.push(`${p.starId}@${p.branch}`);
  }
  return {
    inputs: { hourBranch },
    result: placed
  };
}

/** 解神（年支系） */
export function calcAuxJieShen(ctx: EngineContext): ExecutorOutcome {
  const hourBranch = ctx.normalized.hourBranch as BranchId;
  const yearBranch = ctx.normalized.ganzhi.year.branch as BranchId;
  const placed: string[] = [];
  for (const p of candidateAuxStars({ hourBranch, yearBranch })) {
    if (p.ruleId !== JIESHEN_RULE_ID) continue;
    placeStar(ctx, p.starId, p.branch, p.ruleId);
    placed.push(`${p.starId}@${p.branch}`);
  }
  return {
    inputs: { yearBranch },
    result: placed
  };
}

/** 小限（candidate；以目標日期之農曆年計算虛歲後定位，不猜方向） */
export function calcCandidateXiaoXian(ctx: EngineContext): ExecutorOutcome {
  const yearBranch = ctx.normalized.ganzhi.year.branch as BranchId;
  const sex = ctx.sexForCalculation;
  const birthLunarYear = ctx.normalized.lunar.year;
  if (sex === 'unknown') {
    return {
      inputs: { yearBranch, sexForCalculation: sex },
      result: null,
      status: 'skipped',
      reason: 'SEX_UNKNOWN'
    };
  }
  const targetLunarYear = ctx.periodTarget?.lunar.year;
  if (!ctx.targetDate || targetLunarYear === undefined) {
    return {
      inputs: { yearBranch, sexForCalculation: sex, targetDate: ctx.targetDate ?? null },
      result: null,
      status: 'skipped',
      reason: 'NO_TARGET_DATE'
    };
  }
  const resolution = xiaoXianForTarget({ birthLunarYear, targetLunarYear, yearBranch, sex });
  return {
    inputs: { yearBranch, sexForCalculation: sex, birthLunarYear, targetLunarYear },
    result: resolution,
    status: 'candidate',
    note: `candidate 小限（${XIAOXIAN_RULE_ID}）：虛歲 ${resolution.age} → ${resolution.branch}（男順女逆），待 Owner 批准`
  };
}
