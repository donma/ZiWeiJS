import type { EngineContext } from './context.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import type { DynamicStarPlacement, BranchId, GanzhiPair, StemId } from '../core/types.js';
import { provenanceFor } from '../rule-engine/execute-rule.js';
import { branchAt, branchIndex } from '../core/constants.js';
import auxTables from '../../tables/stars/aux-tables.json' with { type: 'json' };

/**
 * 動態限運星曜 Executors（spec 0.6 §15–§19）
 *
 * 本位按《紫微斗數全書》卷二安星訣之本命安法，推廣至各種限運：
 * 流魁/流鉞依限運天干同天魁/天鉞；流昌/流曲依限運天干同文昌/文曲；
 * 流祿依限運天干同祿存；流羊/流陀依限運天干同擎羊/陀羅；
 * 流馬依限運地支同天馬；流鸞/流喜依限運地支同紅鸞/天喜。
 *
 * 資料層以 (baseStarId, scope) 表示動態星，不另建大量假星 ID（spec §16）。
 */

/**
 * 流昌／流曲依限運天干（甲巳乙午、丙戊申、丁己酉、庚亥、辛子、壬寅、癸卯；
 * 曲則對宮），與 iztro horoscope() 實作一致（differential 100%）。
 */
const WENCHANG_BY_STEM: Record<string, number> = {
  jia: 5, yi: 6, bing: 8, ding: 9, wu: 8, ji: 9, geng: 11, xin: 0, ren: 2, gui: 3
};
const WENQU_BY_STEM: Record<string, number> = {
  jia: 9, yi: 8, bing: 6, ding: 5, wu: 6, ji: 5, geng: 3, xin: 2, ren: 0, gui: 11
};

const YEAR_STEM_TABLE = (auxTables as unknown as {
  byYearStem: Record<string, Record<string, number>>;
}).byYearStem;
const YEAR_BRANCH_TABLE = (auxTables as unknown as {
  byYearBranch: Record<string, Record<string, number>>;
}).byYearBranch;

function addDynamicStar(
  ctx: EngineContext,
  baseStarId: string,
  scope: DynamicStarPlacement['scope'],
  ganzhi: GanzhiPair,
  branch: BranchId,
  ruleId: string
): void {
  const prov = provenanceFor(ruleId, ctx.profile.profileId, ctx.profile.ruleOverrides);
  ctx.dynamicStars.push({
    baseStarId,
    scope,
    branch,
    palaceId: ctx.palaces.find(p => p.branch === branch)?.id ?? 'life',
    ganzhi,
    provenance: prov
  });
}

function yearGanzhi(ctx: EngineContext): GanzhiPair {
  return ctx.periodTarget!.ganzhi.year;
}

export function calcPeriodKuiYue(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const stemMap = YEAR_STEM_TABLE['ZW.STAR.AUX.TIANKUI'];
  const yueMap = YEAR_STEM_TABLE['ZW.STAR.AUX.TIANYUE'];
  const kuiBranch = branchAt(stemMap[gz.stem]);
  const yueBranch = branchAt(yueMap[gz.stem]);
  addDynamicStar(ctx, 'ZW.STAR.AUX.TIANKUI', 'year', gz, kuiBranch, 'ZW.CALC.PERIOD.STAR.KUIYUE.001');
  addDynamicStar(ctx, 'ZW.STAR.AUX.TIANYUE', 'year', gz, yueBranch, 'ZW.CALC.PERIOD.STAR.KUIYUE.001');
  return { inputs: { periodStem: gz.stem }, result: { kuiBranch, yueBranch } };
}

export function calcPeriodChangQu(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const wcBranch = branchAt(WENCHANG_BY_STEM[gz.stem]);
  const wqBranch = branchAt(WENQU_BY_STEM[gz.stem]);
  addDynamicStar(ctx, 'ZW.STAR.AUX.WENCHANG', 'year', gz, wcBranch, 'ZW.CALC.PERIOD.STAR.CHANGQU.001');
  addDynamicStar(ctx, 'ZW.STAR.AUX.WENQU', 'year', gz, wqBranch, 'ZW.CALC.PERIOD.STAR.CHANGQU.001');
  return { inputs: { periodStem: gz.stem }, result: { wcBranch, wqBranch } };
}

export function calcPeriodLucun(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const lucunMap = YEAR_STEM_TABLE['ZW.STAR.AUX.LUCUN'];
  const branch = branchAt(lucunMap[gz.stem]);
  addDynamicStar(ctx, 'ZW.STAR.AUX.LUCUN', 'year', gz, branch, 'ZW.CALC.PERIOD.STAR.LUCUN.001');
  return { inputs: { periodStem: gz.stem }, result: { lucunBranch: branch } };
}

export function calcPeriodQingYangTuoLuo(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const qyMap = YEAR_STEM_TABLE['ZW.STAR.MALEFIC.QINGYANG'];
  const tlMap = YEAR_STEM_TABLE['ZW.STAR.MALEFIC.TUOLUO'];
  const qyBranch = branchAt(qyMap[gz.stem]);
  const tlBranch = branchAt(tlMap[gz.stem]);
  addDynamicStar(ctx, 'ZW.STAR.MALEFIC.QINGYANG', 'year', gz, qyBranch, 'ZW.CALC.PERIOD.STAR.QINGYANG_TUOLUO.001');
  addDynamicStar(ctx, 'ZW.STAR.MALEFIC.TUOLUO', 'year', gz, tlBranch, 'ZW.CALC.PERIOD.STAR.QINGYANG_TUOLUO.001');
  return { inputs: { periodStem: gz.stem }, result: { qyBranch, tlBranch } };
}

export function calcPeriodTianMa(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const bIdx = branchIndex(gz.branch);
  let group = 'yin-wu-xu';
  if ([8, 0, 4].includes(bIdx)) group = 'shen-zi-chen';
  else if ([5, 9, 1].includes(bIdx)) group = 'si-you-chou';
  else if ([11, 3, 7].includes(bIdx)) group = 'hai-mao-wei';
  const tmMap = YEAR_BRANCH_TABLE['ZW.STAR.AUX.TIANMA'];
  const branch = branchAt(tmMap[group]);
  addDynamicStar(ctx, 'ZW.STAR.AUX.TIANMA', 'year', gz, branch, 'ZW.CALC.PERIOD.STAR.TIANMA.001');
  return { inputs: { periodBranch: gz.branch, group }, result: { tmBranch: branch } };
}

export function calcPeriodHongLuanTianXi(ctx: EngineContext): ExecutorOutcome {
  if (!ctx.periodTarget) return { inputs: {}, result: null, status: 'skipped', reason: 'NO_TARGET_DATE' };
  const gz = yearGanzhi(ctx);
  const bIdx = branchIndex(gz.branch);
  const hlBranch = branchAt((3 - bIdx + 12) % 12);
  const txBranch = branchAt(((3 - bIdx + 12) % 12 + 6) % 12);
  addDynamicStar(ctx, 'ZW.STAR.AUX.HONGLUAN', 'year', gz, hlBranch, 'ZW.CALC.PERIOD.STAR.HONGLUAN_TIANXI.001');
  addDynamicStar(ctx, 'ZW.STAR.AUX.TIANXI', 'year', gz, txBranch, 'ZW.CALC.PERIOD.STAR.HONGLUAN_TIANXI.001');
  return { inputs: { periodBranch: gz.branch }, result: { hlBranch, txBranch } };
}
