import type { EngineContext } from '../executors/context.js';
import type {
  MajorPeriod, PeriodInfo, BranchId, StemId,
  PeriodOverlay, PeriodPalace, PeriodStarPlacement, PalaceId
} from '../core/types.js';
import { branchIndex, branchAt, STEMS, BRANCHES, stemAt, PALACE_IDS } from '../core/constants.js';
import { getStar } from '../executors/star-executors.js';
import { sihuaForStem } from '../executors/star-executors.js';
import { Solar } from 'lunar-typescript';

const SUIJIAN_STARS = [
  'ZW.STAR.PERIOD.SUIJIAN', 'ZW.STAR.PERIOD.HUIQI', 'ZW.STAR.PERIOD.SANGMEN2',
  'ZW.STAR.PERIOD.GUANSUO', 'ZW.STAR.PERIOD.GUANFU2', 'ZW.STAR.PERIOD.XIAOHAO2',
  'ZW.STAR.PERIOD.DAHAO2', 'ZW.STAR.PERIOD.LONDE', 'ZW.STAR.PERIOD.BAIHU2',
  'ZW.STAR.PERIOD.FUDE', 'ZW.STAR.PERIOD.DIAOKE2', 'ZW.STAR.PERIOD.BINGFU2'
];

const JIANGQIAN_STARS = [
  'ZW.STAR.INTERIM.JIANGXING', 'ZW.STAR.INTERIM.PANAN', 'ZW.STAR.INTERIM.SUIYI',
  'ZW.STAR.INTERIM.XISHEN', 'ZW.STAR.INTERIM.HUAGAI2', 'ZW.STAR.INTERIM.JIESHA2',
  'ZW.STAR.INTERIM.ZAISHA', 'ZW.STAR.INTERIM.TIANSHA', 'ZW.STAR.INTERIM.ZHIBEI2',
  'ZW.STAR.INTERIM.XIANCHI2', 'ZW.STAR.INTERIM.YUESHA', 'ZW.STAR.INTERIM.WANGSHEN2'
];

/**
 * 建立限運疊盤（流年/流月/流日/流時）：
 * - 以該限運地支為流年命宮，逆布十二宮
 * - 疊上歲建十二神與將前十二神（依該限運地支）
 * - 疊上該限運天干之四化
 */
export function buildPeriodOverlay(
  ctx: EngineContext,
  scope: PeriodOverlay['scope'],
  stem: StemId,
  branch: BranchId,
  palaceStems: (palace: PalaceId, branch: BranchId) => StemId
): PeriodOverlay {
  const baseIdx = branchIndex(branch);
  const palaces: PeriodPalace[] = PALACE_IDS.map((pid, i) => {
    const b = branchAt(baseIdx - i);
    return { palaceId: pid, branch: b, ganzhi: { stem: palaceStems(pid, b), branch: b }, stars: [] };
  });

  const periodStars: PeriodStarPlacement[] = [];
  for (let i = 0; i < 12; i++) {
    const sid = SUIJIAN_STARS[i];
    const b = branchAt(baseIdx + i);
    periodStars.push({ starId: sid, name: getStar(sid).name, branch: b });
    const p = palaces.find(x => x.branch === b);
    if (p) p.stars.push({ starId: sid, name: getStar(sid).name, branch: b });
  }

  const GROUP_CENTER: Record<string, number> = { 'yin-wu-xu': 6, 'shen-zi-chen': 0, 'si-you-chou': 9, 'hai-mao-wei': 3 };
  const bIdx = branchIndex(branch);
  let group = 'yin-wu-xu';
  if ([8, 0, 4].includes(bIdx)) group = 'shen-zi-chen';
  else if ([5, 9, 1].includes(bIdx)) group = 'si-you-chou';
  else if ([11, 3, 7].includes(bIdx)) group = 'hai-mao-wei';
  const jxBase = GROUP_CENTER[group];
  for (let i = 0; i < 12; i++) {
    const sid = JIANGQIAN_STARS[i];
    const b = branchAt(jxBase + i);
    periodStars.push({ starId: sid, name: getStar(sid).name, branch: b });
    const p = palaces.find(x => x.branch === b);
    if (p) p.stars.push({ starId: sid, name: getStar(sid).name, branch: b });
  }

  const transformations = sihuaForStem(stem).flatMap(({ type, starId }) => {
    const placement = ctx.placements.get(starId);
    if (!placement) return [];
    return [{
      type,
      sourceScope: scope,
      sourceStem: stem,
      targetStarId: starId,
      targetPalaceId: placement.palaceId,
      profile: ctx.profile.profileId,
      ruleId: 'ZW.CALC.SIHUA.PERIOD.001'
    }];
  });

  return {
    scope,
    stem,
    branch,
    lifePalaceBranch: branch,
    palaces,
    periodStars,
    transformations
  };
}

export function calcMajorPeriods(ctx: EngineContext): void {
  const dir = ctx.direction === 'forward' ? 1 : -1;
  const startAge = ctx.bureauNumber;
  const lifeIdx = branchIndex(ctx.lifePalaceBranch);
  const periods: MajorPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const branch = branchAt(lifeIdx + dir * i);
    const palace = ctx.palaces.find(p => p.branch === branch)!;
    const fromAge = startAge + i * 10;
    const toAge = fromAge + 9;
    palace.majorPeriod = { fromAge, toAge };
    periods.push({
      scope: 'major-period',
      stem: palace.stem,
      branch,
      palaceId: palace.id,
      ageRange: [fromAge, toAge],
      fromAge,
      toAge,
      direction: ctx.direction,
      label: { 'zh-TW': `大限 ${fromAge}-${toAge} 歲`, en: `Major ${fromAge}-${toAge}` }
    });
  }
  ctx.majorPeriods = periods;
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.DAXIAN.001',
    inputs: { bureau: ctx.bureau, direction: ctx.direction, lifePalaceBranch: ctx.lifePalaceBranch },
    result: periods.map(p => `${p.branch}:${p.fromAge}-${p.toAge}`),
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU'],
    evidenceRefs: ['EVD.QUANSHU.DAXIAN']
  });
}

function ganzhiOfSolarYear(year: number): { stem: StemId; branch: BranchId } {
  const lunar = Solar.fromYmd(year, 6, 1).getLunar();
  const gz = lunar.getYearInGanZhi();
  const stemIdx = '甲乙丙丁戊己庚辛壬癸'.indexOf(gz[0]);
  const branchIdx = '子丑寅卯辰巳午未申酉戌亥'.indexOf(gz[1]);
  return { stem: STEMS[stemIdx], branch: BRANCHES[branchIdx] };
}

const WUHU_DUN_PERIOD: Record<string, StemId> = {
  jia: 'bing', ji: 'bing', yi: 'wu', geng: 'wu',
  bing: 'geng', xin: 'geng', ding: 'ren', ren: 'ren',
  wu: 'jia', gui: 'jia'
};

function periodPalaceStem(yearStem: StemId, _pi: number, branch: BranchId): StemId {
  const yinStemIdx = STEMS.indexOf(WUHU_DUN_PERIOD[yearStem]);
  const bIdx = branchIndex(branch);
  // 流年宮位天干：以該限運年干起寅宮，依「寅→卯→…→丑」序列順推天干
  const posFromYin = (((bIdx - 2) % 12) + 12) % 12;
  return stemAt((yinStemIdx + posFromYin) % 10);
}

export function calcYearPeriod(ctx: EngineContext, year: number): void {
  const gz = ganzhiOfSolarYear(year);
  const palace = ctx.palaces.find(p => p.branch === gz.branch)!;
  const overlay = buildPeriodOverlay(
    ctx, 'year', gz.stem, gz.branch,
    (_pi, branch) => periodPalaceStem(gz.stem, 0, branch)
  );
  ctx.yearPeriod = {
    scope: 'year',
    stem: gz.stem,
    branch: gz.branch,
    palaceId: palace.id,
    year,
    label: { 'zh-TW': `流年 ${year}`, en: `Year ${year}` },
    overlay
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUNIAN.001',
    inputs: { year },
    result: `${gz.stem}-${gz.branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

/**
 * 以 lunar-typescript 取得目標時刻的真實四柱干支，避免近似誤差。
 * @param dayStemFallback 當無日期時使用的日干
 */
function ganzhiAt(year: number, month: number, day: number, hour: number): {
  year: { stem: StemId; branch: BranchId };
  month: { stem: StemId; branch: BranchId };
  day: { stem: StemId; branch: BranchId };
  hour: { stem: StemId; branch: BranchId };
} {
  const lunar = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  const parse = (gz: string) => ({
    stem: STEMS['甲乙丙丁戊己庚辛壬癸'.indexOf(gz[0])],
    branch: BRANCHES['子丑寅卯辰巳午未申酉戌亥'.indexOf(gz[1])]
  });
  return {
    year: parse(lunar.getYearInGanZhi()),
    month: parse(lunar.getMonthInGanZhi()),
    day: parse(lunar.getDayInGanZhi()),
    hour: parse(lunar.getTimeInGanZhi())
  };
}

export function calcMonthPeriod(ctx: EngineContext, year: number, month: number, day = 15): void {
  if (!ctx.yearPeriod) return;
  // 以當月 15 日取月柱（避開節氣交界爭議）
  const gz = ganzhiAt(year, month, day, 12);
  const baseIdx = branchIndex(ctx.yearPeriod.branch);
  const branch = branchAt(baseIdx + (month - 1));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  const overlay = buildPeriodOverlay(ctx, 'month', gz.month.stem, gz.month.branch,
    (_pi, b) => periodPalaceStem(gz.month.stem, 0, b));
  ctx.monthPeriod = {
    scope: 'month',
    stem: gz.month.stem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流月 ${month}`, en: `Month ${month}` },
    overlay
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUYUE.001',
    inputs: { year, month, day, monthGanzhi: `${gz.month.stem}-${gz.month.branch}` },
    result: `${gz.month.stem}-${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcDayPeriod(ctx: EngineContext, day: number, year?: number, month?: number): void {
  if (!ctx.monthPeriod) return;
  const baseIdx = branchIndex(ctx.monthPeriod.branch);
  const branch = branchAt(baseIdx + (day - 1));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  const now = new Date();
  const gz = ganzhiAt(year ?? now.getFullYear(), month ?? (now.getMonth() + 1), day, 12);
  const overlay = buildPeriodOverlay(ctx, 'day', gz.day.stem, gz.day.branch,
    (_pi, b) => periodPalaceStem(gz.day.stem, 0, b));
  ctx.dayPeriod = {
    scope: 'day',
    stem: gz.day.stem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流日 ${day}`, en: `Day ${day}` },
    overlay
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIURI.001',
    inputs: { day, dayGanzhi: `${gz.day.stem}-${gz.day.branch}` },
    result: `${gz.day.stem}-${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcHourPeriod(
  ctx: EngineContext, hourBranch: BranchId,
  hourStem?: StemId, hourGanzhiBranch?: BranchId
): void {
  if (!ctx.dayPeriod) return;
  const baseIdx = branchIndex(ctx.dayPeriod.branch);
  const branch = branchAt(baseIdx + branchIndex(hourBranch));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  const stem = hourStem ?? ctx.dayPeriod.stem;
  const gzBranch = hourGanzhiBranch ?? hourBranch;
  const overlay = buildPeriodOverlay(ctx, 'hour', stem, gzBranch,
    (_pi, b) => periodPalaceStem(stem, 0, b));
  ctx.hourPeriod = {
    scope: 'hour',
    stem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流時 ${hourBranch}`, en: `Hour ${hourBranch}` },
    overlay
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUSHI.001',
    inputs: { hourBranch, hourGanzhi: `${stem}-${gzBranch}` },
    result: `${stem}-${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export { ganzhiAt };
