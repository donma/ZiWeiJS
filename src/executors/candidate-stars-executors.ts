/**
 * Candidate 星曜 executors（spec Post-Stability Phase B/C）。
 *
 * 只由 `stage: "on-demand"` 的 candidate 規則引用，**不進入** natal / period 執行計畫，
 * 因此 canonical 盤面輸出完全不變（待 Owner 批准後才可改 stage）。
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
export function calcCandidateByHour(ctx: EngineContext): ExecutorOutcome {
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
    result: placed,
    status: 'candidate',
    note: 'candidate 星曜：未經 Owner 批准，不併入 canonical 盤面'
  };
}

/** 解神（年支系） */
export function calcCandidateByYearBranch(ctx: EngineContext): ExecutorOutcome {
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
    result: placed,
    status: 'candidate',
    note: 'candidate 星曜：未經 Owner 批准，不併入 canonical 盤面'
  };
}

/** 小限（以目標日期之農曆年計算虛歲後定位；性別未知或無目標日期時不猜） */
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
