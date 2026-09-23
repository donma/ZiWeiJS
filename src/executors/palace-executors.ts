import type { EngineContext } from './context.js';
import {
  BRANCHES, branchAt, branchIndex, stemAt, STEMS,
  PALACE_IDS, PALACE_NAME
} from '../core/constants.js';
import type { BranchId, Palace, StemId } from '../core/types.js';
import ziweiSeries from '../../tables/stars/ziwei-series.json' with { type: 'json' };

export function calcLifePalace(ctx: EngineContext): BranchId {
  const month = ctx.normalized.lunar.month;
  const hourIdx = branchIndex(ctx.normalized.hourBranch);
  const idx = (((2 + (month - 1)) - hourIdx) % 12 + 12) % 12;
  const branch = branchAt(idx);
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PALACE.LIFE.001',
    inputs: { lunarMonth: month, hourBranch: ctx.normalized.hourBranch },
    result: branch,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.ANXING']
  });
  ctx.lifePalaceBranch = branch;
  return branch;
}

export function calcBodyPalace(ctx: EngineContext): BranchId {
  const month = ctx.normalized.lunar.month;
  const hourIdx = branchIndex(ctx.normalized.hourBranch);
  const idx = (((2 + (month - 1)) + hourIdx) % 12 + 12) % 12;
  const branch = branchAt(idx);
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PALACE.BODY.001',
    inputs: { lunarMonth: month, hourBranch: ctx.normalized.hourBranch },
    result: branch,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.ANXING']
  });
  ctx.bodyPalaceBranch = branch;
  return branch;
}

export function calcTwelvePalaces(ctx: EngineContext): Palace[] {
  const lifeIdx = branchIndex(ctx.lifePalaceBranch);
  const palaces: Palace[] = PALACE_IDS.map((id, i) => {
    const branch = branchAt(lifeIdx - i);
    return {
      id,
      index: i,
      name: PALACE_NAME[id],
      stem: 'jia' as StemId,
      branch,
      ganzhi: { stem: 'jia' as StemId, branch },
      isBodyPalace: branch === ctx.bodyPalaceBranch,
      isLifePalace: i === 0,
      stars: [],
      majorStars: [],
      auxStars: [],
      maleficStars: [],
      minorStars: [],
      transformations: [],
      cycles: {}
    };
  });
  ctx.palaces = palaces;
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PALACE.TWELVE.001',
    inputs: { lifePalaceBranch: ctx.lifePalaceBranch },
    result: palaces.map(p => ({ id: p.id, branch: p.branch })),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
  return palaces;
}

const WUHU_DUN: Record<string, StemId> = {
  jia: 'bing', ji: 'bing', yi: 'wu', geng: 'wu',
  bing: 'geng', xin: 'geng', ding: 'ren', ren: 'ren',
  wu: 'jia', gui: 'jia'
};

export function calcPalaceStems(ctx: EngineContext): void {
  const yearStem = ctx.normalized.ganzhi.year.stem;
  const yinStem = WUHU_DUN[yearStem];
  const yinStemIdx = STEMS.indexOf(yinStem);
  for (const palace of ctx.palaces) {
    const bIdx = branchIndex(palace.branch);
    // 五虎遁：自寅宮起年干所遁之干，依宮位在「寅→卯→…→丑」序列中的位置順推天干
    const posFromYin = (((bIdx - 2) % 12) + 12) % 12;
    const stemIdx = (yinStemIdx + posFromYin) % 10;
    palace.stem = stemAt(stemIdx);
    palace.ganzhi = { stem: palace.stem, branch: palace.branch };
  }
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PALACE.STEM.001',
    inputs: { yearStem },
    result: ctx.palaces.map(p => ({ palace: p.id, ganzhi: `${p.stem}-${p.branch}` })),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

const MING_ZHU_BY_LIFE_BRANCH: Record<string, string> = {
  zi: 'ZW.STAR.MAJOR.TANLANG', chou: 'ZW.STAR.MAJOR.JUMEN', yin: 'ZW.STAR.AUX.LUCUN',
  mao: 'ZW.STAR.AUX.WENQU', chen: 'ZW.STAR.MAJOR.LIANZHEN', si: 'ZW.STAR.MAJOR.WUQU',
  wu: 'ZW.STAR.MAJOR.POJUN', wei: 'ZW.STAR.MAJOR.WUQU', shen: 'ZW.STAR.MAJOR.LIANZHEN',
  you: 'ZW.STAR.AUX.WENQU', xu: 'ZW.STAR.AUX.LUCUN', hai: 'ZW.STAR.MAJOR.JUMEN'
};

const SHEN_ZHU_BY_YEAR_BRANCH: Record<string, string> = {
  zi: 'ZW.STAR.AUX.HUOLING', chou: 'ZW.STAR.MAJOR.TIANXIANG', yin: 'ZW.STAR.MAJOR.TIANLIANG',
  mao: 'ZW.STAR.MAJOR.TIANTONG', chen: 'ZW.STAR.AUX.WENCHANG', si: 'ZW.STAR.MAJOR.TIANJI',
  wu: 'ZW.STAR.AUX.HUOLING', wei: 'ZW.STAR.MAJOR.TIANXIANG', shen: 'ZW.STAR.MAJOR.TIANLIANG',
  you: 'ZW.STAR.MAJOR.TIANTONG', xu: 'ZW.STAR.AUX.WENCHANG', hai: 'ZW.STAR.MAJOR.TIANJI'
};

export function calcMasterStars(ctx: EngineContext): void {
  ctx.masterStar = MING_ZHU_BY_LIFE_BRANCH[ctx.lifePalaceBranch];
  ctx.bodyStar = SHEN_ZHU_BY_YEAR_BRANCH[ctx.normalized.ganzhi.year.branch];
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PALACE.MASTER.001',
    inputs: { lifePalaceBranch: ctx.lifePalaceBranch, yearBranch: ctx.normalized.ganzhi.year.branch },
    result: { masterStar: ctx.masterStar, bodyStar: ctx.bodyStar },
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

/**
 * 起紫微星訣（安紫微諸星訣）純函式：回傳紫微所在「宮位序」（以寅為 0）。
 *
 *   局數除日數，商數宮前走；若見數無餘，便要起虎口，日數小於局，還直宮中守。
 *
 *   1. 求最小 offset ≥ 0 使 (day + offset) % bureau === 0
 *   2. quotient = (day + offset) / bureau；再取 % 12
 *   3. palaceIdx = quotient - 1
 *   4. offset 為偶 → palaceIdx += offset；為奇 → palaceIdx -= offset
 *
 * 驗證例（紫微斗數全書）：
 *   木三局 27 日 → 戌；火六局 13 日 → 亥；土五局 6 日 → 未
 */
export function ziweiPalaceIndex(bureauNumber: number, lunarDay: number): number {
  let offset = 0;
  while ((lunarDay + offset) % bureauNumber !== 0) offset++;
  const quotientMod = ((lunarDay + offset) / bureauNumber) % 12;
  let palaceIdx = quotientMod - 1;
  palaceIdx += offset % 2 === 0 ? offset : -offset;
  return ((palaceIdx % 12) + 12) % 12;
}

/** 宮位序（寅=0）→ 地支（子=0） */
export function branchFromPalaceIndex(palaceIdx: number): BranchId {
  return branchAt((palaceIdx + 2) % 12);
}

export function calcZiweiPosition(ctx: EngineContext): BranchId {
  const n = ctx.bureauNumber;
  const day = ctx.normalized.lunar.day;
  const palaceIdx = ziweiPalaceIndex(n, day);
  const branch = branchFromPalaceIndex(palaceIdx);
  ctx.tracer.record({
    ruleId: 'ZW.CALC.STAR.ZIWEI.001',
    inputs: { bureauNumber: n, lunarDay: day, palaceIdx },
    result: branch,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.ZIWEIXI']
  });
  return branch;
}

export function ziweiSeriesOffsets(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(ziweiSeries.series)) {
    out[id] = v.offsetFromZiwei;
  }
  return out;
}

export function tianfuBase(ziweiBranch: BranchId): BranchId {
  const zi = branchIndex(ziweiBranch);
  return branchAt(4 - zi);
}

export function tianfuSeriesOffsets(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(ziweiSeries.tianfuSeries)) {
    out[id] = v.offsetFromTianfu;
  }
  return out;
}
