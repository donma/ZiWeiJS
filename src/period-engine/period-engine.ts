import type { EngineContext } from '../executors/context.js';
import type {
  MajorPeriod, PeriodInfo, BranchId, StemId,
  PeriodOverlay, PeriodPalace, PeriodStarPlacement, PalaceId
} from '../core/types.js';
import { branchIndex, branchAt, STEMS, BRANCHES, stemAt, PALACE_IDS } from '../core/constants.js';
import { getStar } from '../executors/star-executors.js';
import { resolvePeriodTransformations } from '../transformation-engine/transformation-engine.js';
import type { ExecutorOutcome } from '../rule-engine/executor-registry.js';
import { Solar } from 'lunar-typescript';
import { monthLifeBranch, dayLifeBranch } from './period-target.js';
import { resolveDouJun, monthLifeBranchFromDouJun } from './doujun.js';

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
 * - 歲建十二神與將前十二神：僅掛於 yearly scope（spec 3rd §P0-10；month/day/hour 不無條件灑星）
 * - 疊上該限運天干之四化：由 resolvePeriodTransformations 與 global period sihua 共用（spec 3rd §P1-8）
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

  // 歲前十二神 / 將前十二神：目前文獻依據均為「流年歲前/將前神煞」，
  // 僅在 year scope 安放，不再無條件灑入 month / day / hour（spec 3rd §P0-10）。
  if (scope === 'year') {
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
  }

  // 四化轉換：與 calcPeriodSihua 共用單一出口 resolvePeriodTransformations（spec 3rd §P1-8），
  // 確保流派 variant（如 school-zhongzhou 庚干天府化權天相化科）在 overlay 與 global 一致生效。
  const transformations = resolvePeriodTransformations(ctx, scope, stem);

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

export function calcMajorPeriods(ctx: EngineContext): ExecutorOutcome {
  // 性別未知 → 順逆行無從判定，不得猜測（spec §27）
  if (ctx.direction === 'undetermined') {
    ctx.majorPeriods = [];
    return {
      inputs: { bureau: ctx.bureau, lifePalaceBranch: ctx.lifePalaceBranch },
      result: null,
      status: 'unavailable',
      reason: 'UNKNOWN_SEX_FOR_CALCULATION'
    };
  }

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
      ganzhi: { stem: palace.stem, branch },
      label: { 'zh-TW': `大限 ${fromAge}-${toAge} 歲`, en: `Major ${fromAge}-${toAge}` }
    });
  }
  ctx.majorPeriods = periods;
  return {
    inputs: { bureau: ctx.bureau, direction: ctx.direction, lifePalaceBranch: ctx.lifePalaceBranch },
    result: periods.map(p => `${p.branch}:${p.fromAge}-${p.toAge}`)
  };
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

export function calcYearPeriod(ctx: EngineContext, year: number): ExecutorOutcome {
  const pt = ctx.periodTarget;
  // 流年干支：由正規化目標之農曆年干支（非 Gregorian），統一自 periodTarget 取
  const gz = pt ? pt.ganzhi.year : ganzhiOfSolarYear(year);
  const palace = ctx.palaces.find(p => p.branch === gz.branch)!;
  const overlay = buildPeriodOverlay(
    ctx, 'year', gz.stem, gz.branch,
    (_pi, branch) => periodPalaceStem(gz.stem, 0, branch)
  );
  const yearPolicy = ctx.profile.yearBoundaryPolicy ?? 'lunar-new-year';
  const targetLunarYear = pt?.lunar.year;
  const resolvedYear = pt?.resolvedYear ?? year;
  ctx.yearPeriod = {
    scope: 'year',
    stem: gz.stem,
    branch: gz.branch,
    palaceId: palace.id,
    year,
    lunarYear: targetLunarYear,
    resolvedYear,
    yearBoundaryPolicy: yearPolicy,
    resolution: pt?.granularity === 'year' ? 'year-only' : pt?.isRepresentativeDate ? 'representative-date' : 'exact-date',
    ganzhi: { stem: gz.stem, branch: gz.branch },
    label: yearPolicy === 'lichun' && resolvedYear !== year
      ? { 'zh-TW': `流年 ${year}（年柱屬 ${resolvedYear} 立春制）`, en: `Year ${year} (pillar year ${resolvedYear}, lichun)` }
      : { 'zh-TW': `流年 ${year}`, en: `Year ${year}` },
    overlay
  };
  return {
    inputs: {
      year,
      lunarYear: pt?.lunar.year,
      resolvedYear,
      yearBoundaryPolicy: yearPolicy,
      resolution: ctx.yearPeriod.resolution
    },
    result: `${gz.stem}-${gz.branch} @ ${palace.id}`
  };
}

/**
 * 以 lunar-typescript 取得目標時刻的真實四柱干支。
 * 限運 executor 一律經 periodTarget 提供，此函式僅供外部 / 測試使用。
 */
function ganzhiAt(year: number, month: number, day: number, hour: number, minute = 0): {
  year: { stem: StemId; branch: BranchId };
  month: { stem: StemId; branch: BranchId };
  day: { stem: StemId; branch: BranchId };
  hour: { stem: StemId; branch: BranchId };
} {
  const lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();
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

export function calcMonthPeriod(ctx: EngineContext): ExecutorOutcome | void {
  if (!ctx.yearPeriod || !ctx.periodTarget) return;
  const pt = ctx.periodTarget;
  if (pt.effectiveLunarMonth === undefined || !pt.ganzhi.month) return;
  // 流月命宮：自當年「斗君」起農曆正月順數（spec 3rd §P0-4）。
  // 斗君 = 流年歲建起正月、逆數生月，再由該宮起子時順數至生時。
  const douJun = resolveDouJun({
    yearBranch: ctx.yearPeriod.branch,
    birth: {
      lunarMonth: ctx.normalized.lunar.month,
      lunarDay: ctx.normalized.lunar.day,
      isLeapMonth: ctx.normalized.lunar.isLeapMonth,
      hourBranch: ctx.normalized.hourBranch
    },
    leapMonthPolicy: ctx.profile.leapMonthPolicy
  });
  ctx.douJunBranch = douJun;
  const branch = monthLifeBranchFromDouJun(douJun, pt.effectiveLunarMonth);
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  // 流月干支：目標代表日之真實月柱
  const gz = pt.ganzhi.month;
  const overlay = buildPeriodOverlay(ctx, 'month', gz.stem, gz.branch,
    (_pi, b) => periodPalaceStem(gz.stem, 0, b));
  ctx.monthPeriod = {
    scope: 'month',
    stem: gz.stem,
    branch,
    palaceId: palace.id,
    ganzhi: { stem: gz.stem, branch: gz.branch },
    label: {
      'zh-TW': `流月 ${pt.lunar.month}月${pt.lunar.isLeapMonth ? '（閏）' : ''}`,
      en: `Month ${pt.effectiveLunarMonth}`
    },
    overlay
  };
  return {
    inputs: {
      lunarMonth: pt.lunar.month, isLeapMonth: pt.lunar.isLeapMonth,
      effectiveLunarMonth: pt.effectiveLunarMonth,
      douJun,
      representativeDate: pt.isRepresentativeDate,
      monthGanzhi: `${gz.stem}-${gz.branch}`
    },
    result: `${gz.stem}-${branch} @ ${palace.id}`
  };
}

export function calcDayPeriod(ctx: EngineContext): ExecutorOutcome | void {
  if (!ctx.monthPeriod || !ctx.periodTarget) return;
  const pt = ctx.periodTarget;
  if (pt.lunar.day === undefined || !pt.ganzhi.day) return;
  // 流日命宮：自流月命宮起「農曆初一」順數至當日（spec 2nd §P0-2），
  // 用 lunar day 而非 Gregorian day。
  const branch = dayLifeBranch(ctx.monthPeriod.branch, pt.lunar.day);
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  // 流日干支：目標日期之真實日柱（不再 new Date fallback）
  const gz = pt.ganzhi.day;
  const overlay = buildPeriodOverlay(ctx, 'day', gz.stem, gz.branch,
    (_pi, b) => periodPalaceStem(gz.stem, 0, b));
  ctx.dayPeriod = {
    scope: 'day',
    stem: gz.stem,
    branch,
    palaceId: palace.id,
    ganzhi: { stem: gz.stem, branch: gz.branch },
    label: { 'zh-TW': `流日 ${pt.lunar.day}日`, en: `Day ${pt.lunar.day}` },
    overlay
  };
  return {
    inputs: { lunarDay: pt.lunar.day, dayGanzhi: `${gz.stem}-${gz.branch}` },
    result: `${gz.stem}-${branch} @ ${palace.id}`
  };
}

export function calcHourPeriod(
  ctx: EngineContext
): ExecutorOutcome | void {
  const pt = ctx.periodTarget;
  if (!ctx.dayPeriod || !pt || !pt.hourBranch || !pt.ganzhi.hour) return;
  const hourBranch = pt.hourBranch;
  const hourGanzhi = pt.ganzhi.hour;
  const baseIdx = branchIndex(ctx.dayPeriod.branch);
  const branch = branchAt(baseIdx + branchIndex(hourBranch));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  // 流時干支：目標時之真實時柱（由 periodTarget.ganzhi.hour 提供，含 minute 精細度）
  const stem = hourGanzhi.stem;
  const gzBranch = hourGanzhi.branch;
  const overlay = buildPeriodOverlay(ctx, 'hour', stem, gzBranch,
    (_pi, b) => periodPalaceStem(stem, 0, b));
  ctx.hourPeriod = {
    scope: 'hour',
    stem,
    branch,
    palaceId: palace.id,
    ganzhi: { stem, branch: gzBranch },
    label: { 'zh-TW': `流時 ${hourBranch}`, en: `Hour ${hourBranch}` },
    overlay
  };
  return {
    inputs: { hourBranch, hourGanzhi: `${stem}-${gzBranch}` },
    result: `${stem}-${branch} @ ${palace.id}`
  };
}

export { ganzhiAt };
