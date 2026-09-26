/**
 * Executor 註冊表。
 *
 * 規則 JSON 的 `logic.executor` 指向此處註冊的名稱；
 * Rule Registry 為唯一真實來源，Engine 不得直接呼叫 executor 函式（spec §P0-1）。
 */
import type { EngineContext } from '../executors/context.js';
import type { ExecutorOutcome } from './executor-registry.js';
import { registerExecutor, listExecutorNames } from './executor-registry.js';
import type { BranchId } from '../core/types.js';

import {
  calcLifePalace, calcBodyPalace, calcTwelvePalaces, calcPalaceStems,
  calcMasterStars, calcZiweiPosition
} from '../executors/palace-executors.js';
import {
  calcBureau, calcZiweiSeries, calcTianfuSeries, calcAuxByMonth, calcAuxByHour, calcAuxByYearStem,
  calcAuxByYearBranch, calcAuxByMonth2, calcAuxByYearStem2, calcAuxByDay,
  calcAuxByDayHour, calcAuxSpecial, calcPeriodStars, calcFixedStars,
  calcChangSheng, calcBoshi
} from '../executors/star-executors.js';
import { calcDirection, requireSex } from '../executors/birth-executors.js';
import {
  calcAuxTaiFuFengGao, calcAuxJieShen, calcAuxTianWu, calcAuxTianCaiTianShou, calcXiaoXian
} from '../executors/aux-supplementary-executors.js';
import {
  calcPeriodKuiYue, calcPeriodChangQu, calcPeriodLucun, calcPeriodQingYangTuoLuo,
  calcPeriodTianMa, calcPeriodHongLuanTianXi
} from '../executors/dynamic-star-executors.js';
import { verifySolarLunar, verifyGanzhi, verifyTrueSolar } from './calendar-executors.js';
import { calcNatalSihua, calcPalaceSihua, calcPeriodSihua } from '../transformation-engine/transformation-engine.js';
import { calcDignities } from '../dignity-engine/dignity-engine.js';
import {
calcMajorPeriods, calcYearPeriod, calcMonthPeriod, calcDayPeriod, calcHourPeriod
} from '../period-engine/period-engine.js';
import {
  sanFangSiZhengBranches, trineBranches, adjacentBranches, oppositeBranchOf
} from '../relation-engine/relation-engine.js';

/* ---------- 限運：由 targetDate 自我判斷是否執行（缺少對應欄位則 skipped） ---------- */

function calcYearPeriodFromTarget(ctx: EngineContext): ExecutorOutcome | void {
  const t = ctx.targetDate;
  if (!t) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  return calcYearPeriod(ctx, t.year);
}

function calcMonthPeriodFromTarget(ctx: EngineContext): ExecutorOutcome | void {
  const t = ctx.targetDate;
  if (!t || t.month === undefined) {
    return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_MONTH' };
  }
  return calcMonthPeriod(ctx);
}

function calcDayPeriodFromTarget(ctx: EngineContext): ExecutorOutcome | void {
  const t = ctx.targetDate;
  if (!t || t.month === undefined || t.day === undefined) {
    return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DAY' };
  }
  return calcDayPeriod(ctx);
}

function calcHourPeriodFromTarget(ctx: EngineContext): ExecutorOutcome | void {
  const t = ctx.targetDate;
  if (!t || t.month === undefined || t.day === undefined || t.hour === undefined) {
    return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_HOUR' };
  }
  return calcHourPeriod(ctx);
}

function calcSihuaPeriodFromTarget(ctx: EngineContext): ExecutorOutcome | void {
  if (!ctx.targetDate) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  return calcPeriodSihua(ctx);
}

/* ---------- 關係：宣告式規則，執行時回報實際關係結果 ---------- */

const REL_BUILDERS: Record<string, (branch: BranchId) => BranchId[]> = {
  relSanFangSiZheng: b => sanFangSiZhengBranches(b),
  relOpposite: b => [oppositeBranchOf(b)],
  relSamePalace: b => [b],
  relJia: b => adjacentBranches(b),
  relGong: b => trineBranches(b)
};

function makeRelExecutor(relName: string) {
  return (ctx: EngineContext): ExecutorOutcome => {
    const branch = ctx.lifePalaceBranch;
    const related = REL_BUILDERS[relName](branch);
    return {
      inputs: { palaceBranch: branch, relation: relName },
      result: related
    };
  };
}

/* ---------- 矯正：框架規則，實際分析由 Rectification API 執行 ---------- */

function rectifyFramework(ctx: EngineContext): ExecutorOutcome {
  return {
    inputs: { sexForCalculation: ctx.input.sexForCalculation },
    result: 'rectification framework available via ZiWei.Rectification.analyze',
    status: 'skipped',
    reason: 'ON_DEMAND_API'
  };
}

let registered = false;

export function registerAllExecutors(): void {
  if (registered) return;
  registered = true;

  registerExecutor('requireSex', requireSex);
  registerExecutor('calcDirection', calcDirection);

  registerExecutor('convertCalendar', verifySolarLunar);
  registerExecutor('calcGanzhi', verifyGanzhi);
  registerExecutor('calcTrueSolar', verifyTrueSolar);

  registerExecutor('calcLifePalace', calcLifePalace);
  registerExecutor('calcBodyPalace', calcBodyPalace);
  registerExecutor('calcTwelvePalaces', calcTwelvePalaces);
  registerExecutor('calcPalaceStems', calcPalaceStems);
  registerExecutor('calcMasterStars', calcMasterStars);
  registerExecutor('calcBureau', calcBureau);

  registerExecutor('calcZiweiPosition', calcZiweiPosition);
  registerExecutor('calcZiweiSeries', calcZiweiSeries);
  registerExecutor('calcTianfuSeries', calcTianfuSeries);

  registerExecutor('calcAuxByMonth', calcAuxByMonth);
  registerExecutor('calcAuxByHour', calcAuxByHour);
  registerExecutor('calcAuxByYearStem', calcAuxByYearStem);
  registerExecutor('calcAuxByYearBranch', calcAuxByYearBranch);
  registerExecutor('calcAuxByMonth2', calcAuxByMonth2);
  registerExecutor('calcAuxByYearStem2', calcAuxByYearStem2);
  registerExecutor('calcAuxByDay', calcAuxByDay);
  registerExecutor('calcAuxByDayHour', calcAuxByDayHour);
  registerExecutor('calcAuxSpecial', calcAuxSpecial);
  registerExecutor('calcPeriodStars', calcPeriodStars);
  registerExecutor('calcFixedStars', calcFixedStars);
  registerExecutor('calcChangSheng', calcChangSheng);
  registerExecutor('calcBoshi', calcBoshi);

  registerExecutor('calcSihua', calcNatalSihua);
  registerExecutor('calcSihuaPalace', calcPalaceSihua);
  registerExecutor('calcSihuaPeriod', calcSihuaPeriodFromTarget);
  registerExecutor('calcDignity', calcDignities);

  registerExecutor('calcMajorPeriods', calcMajorPeriods);
  registerExecutor('calcYearPeriod', calcYearPeriodFromTarget);
  registerExecutor('calcMonthPeriod', calcMonthPeriodFromTarget);
  registerExecutor('calcDayPeriod', calcDayPeriodFromTarget);
  registerExecutor('calcHourPeriod', calcHourPeriodFromTarget);

  for (const rel of Object.keys(REL_BUILDERS)) {
    registerExecutor(rel, makeRelExecutor(rel));
  }

  /* 補充安星：台輔／封誥／解神／天巫／天才／天壽為 canonical（natal）；小限為 canonical（period） */
  registerExecutor('calcAuxTaiFuFengGao', calcAuxTaiFuFengGao);
  registerExecutor('calcAuxJieShen', calcAuxJieShen);
  registerExecutor('calcAuxTianWu', calcAuxTianWu);
  registerExecutor('calcAuxTianCaiTianShou', calcAuxTianCaiTianShou);
  registerExecutor('calcXiaoXian', calcXiaoXian);

  /* 動態限運星曜（spec 0.6 §15–§19） */
  registerExecutor('calcPeriodKuiYue', calcPeriodKuiYue);
  registerExecutor('calcPeriodChangQu', calcPeriodChangQu);
  registerExecutor('calcPeriodLucun', calcPeriodLucun);
  registerExecutor('calcPeriodQingYangTuoLuo', calcPeriodQingYangTuoLuo);
  registerExecutor('calcPeriodTianMa', calcPeriodTianMa);
  registerExecutor('calcPeriodHongLuanTianXi', calcPeriodHongLuanTianXi);

  registerExecutor('rectifyAnalyze', rectifyFramework);
}

export { listExecutorNames };
