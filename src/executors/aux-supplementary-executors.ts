/**
 * 補充安星 executors（spec Post-Stability Phase B/C）。
 *
 * 三條規則皆為 canonical（Owner 於 2026-09-24 批准）：
 * - `calcAuxTaiFuFengGao` / `calcAuxJieShen`：`stage: "natal"`，安置台輔／封誥／解神於本命盤。
 * - `calcXiaoXian`：`stage: "period"`，以目標日期之農曆年計算虛歲後定位，
 *   寫入 `chart.periods.xiaoxian`；性別未知或無目標日期時 skip（不猜方向）。
 */
import type { EngineContext } from './context.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import type { BranchId } from '../core/types.js';
import { provenanceFor } from '../rule-engine/execute-rule.js';
import { placeStar } from './star-executors.js';
import {
  TAIFU_FENGGAO_RULE_ID,
  JIESHEN_RULE_ID,
  XIAOXIAN_RULE_ID,
  supplementaryAuxStars,
  xiaoXianForTarget
} from '../aux-supplementary/aux-supplementary.js';

/** 台輔 / 封誥（生時系） */
export function calcAuxTaiFuFengGao(ctx: EngineContext): ExecutorOutcome {
  const hourBranch = ctx.normalized.hourBranch as BranchId;
  const yearBranch = ctx.normalized.ganzhi.year.branch as BranchId;
  const placed: string[] = [];
  for (const p of supplementaryAuxStars({ hourBranch, yearBranch })) {
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
  for (const p of supplementaryAuxStars({ hourBranch, yearBranch })) {
    if (p.ruleId !== JIESHEN_RULE_ID) continue;
    placeStar(ctx, p.starId, p.branch, p.ruleId);
    placed.push(`${p.starId}@${p.branch}`);
  }
  return {
    inputs: { yearBranch },
    result: placed
  };
}

/** 小限（canonical；以目標日期之農曆年計算虛歲後定位，性別未知或無目標日期時 skip） */
export function calcXiaoXian(ctx: EngineContext): ExecutorOutcome {
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
  const branch = resolution.branch;
  const palace = branch ? ctx.palaces.find(p => p.branch === branch) : undefined;
  if (!branch || !palace) {
    return {
      inputs: { yearBranch, sexForCalculation: sex, targetLunarYear },
      result: null,
      status: 'skipped',
      reason: 'NO_PALACE_FOR_BRANCH'
    };
  }
  ctx.xiaoXian = {
    scope: 'xiaoxian',
    age: resolution.age as number,
    branch,
    palaceId: palace.id,
    lunarYear: targetLunarYear,
    label: {
      'zh-TW': `小限 ${resolution.age} 歲（${palace.name?.['zh-TW'] ?? branch}）`,
      en: `Xiao Xian age ${resolution.age}`
    },
    provenance: provenanceFor(XIAOXIAN_RULE_ID, ctx.profile.profileId, ctx.profile.ruleOverrides)
  };
  return {
    inputs: { yearBranch, sexForCalculation: sex, birthLunarYear, targetLunarYear },
    result: { ...resolution, palaceId: palace.id }
  };
}
