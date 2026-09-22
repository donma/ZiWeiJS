import type { EngineContext } from '../executors/context.js';
import type { MajorPeriod, PeriodInfo, BranchId, StemId } from '../core/types.js';
import { branchIndex, branchAt, STEMS, BRANCHES, stemAt, branchIndex as bi } from '../core/constants.js';
import { Solar } from 'lunar-typescript';

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

export function calcYearPeriod(ctx: EngineContext, year: number): void {
  const gz = ganzhiOfSolarYear(year);
  const palace = ctx.palaces.find(p => p.branch === gz.branch)!;
  ctx.yearPeriod = {
    scope: 'year',
    stem: gz.stem,
    branch: gz.branch,
    palaceId: palace.id,
    year,
    label: { 'zh-TW': `流年 ${year}`, en: `Year ${year}` }
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUNIAN.001',
    inputs: { year },
    result: `${gz.stem}-${gz.branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcMonthPeriod(ctx: EngineContext, year: number, month: number): void {
  if (!ctx.yearPeriod) return;
  const base = ctx.yearPeriod.branch;
  const baseIdx = branchIndex(base);
  const branch = branchAt(baseIdx + (month - 1));
  const monthStem = stemAt(stemIndexFromYearStem(ctx.yearPeriod.stem, month));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  ctx.monthPeriod = {
    scope: 'month',
    stem: monthStem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流月 ${month}`, en: `Month ${month}` }
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUYUE.001',
    inputs: { year, month },
    result: `${monthStem}-${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

function stemIndexFromYearStem(yearStem: StemId, month: number): number {
  const yIdx = STEMS.indexOf(yearStem);
  const firstMonthStem = (yIdx % 5) * 2 + 2;
  return (firstMonthStem + (month - 1)) % 10;
}

export function calcDayPeriod(ctx: EngineContext, day: number): void {
  if (!ctx.monthPeriod) return;
  const baseIdx = branchIndex(ctx.monthPeriod.branch);
  const branch = branchAt(baseIdx + (day - 1));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  ctx.dayPeriod = {
    scope: 'day',
    stem: ctx.monthPeriod.stem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流日 ${day}`, en: `Day ${day}` }
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIURI.001',
    inputs: { day },
    result: `${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}

export function calcHourPeriod(ctx: EngineContext, hourBranch: BranchId): void {
  if (!ctx.dayPeriod) return;
  const baseIdx = branchIndex(ctx.dayPeriod.branch);
  const branch = branchAt(baseIdx + branchIndex(hourBranch));
  const palace = ctx.palaces.find(p => p.branch === branch)!;
  ctx.hourPeriod = {
    scope: 'hour',
    stem: ctx.dayPeriod.stem,
    branch,
    palaceId: palace.id,
    label: { 'zh-TW': `流時`, en: `Hour` }
  };
  ctx.tracer.record({
    ruleId: 'ZW.CALC.PERIOD.LIUSHI.001',
    inputs: { hourBranch },
    result: `${branch} @ ${palace.id}`,
    profile: ctx.profile.profileId,
    sourceRefs: ['SRC.QUANSHU']
  });
}
