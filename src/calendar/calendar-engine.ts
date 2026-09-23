import { Solar, Lunar, LunarMonth } from 'lunar-typescript';
import type {
  ZiWeiBirthInput,
  CalendarInfo,
  GanzhiPair,
  StemId,
  BranchId,
  Profile
} from '../core/types.js';
import {
  STEMS,
  BRANCHES,
  stemAt,
  branchAt,
  branchIndex
} from '../core/constants.js';
import { ZiWeiError } from '../core/errors.js';

const GAN_ZHI_CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

function gzCharToIds(gz: string): GanzhiPair {
  if (!gz || gz.length < 2) {
    throw new ZiWeiError('CALENDAR_CONVERSION_FAILED', `Cannot parse ganzhi: ${gz}`);
  }
  const stemChar = gz[0];
  const branchChar = gz[1];
  const stemIdx = '甲乙丙丁戊己庚辛壬癸'.indexOf(stemChar);
  const branchIdx = '子丑寅卯辰巳午未申酉戌亥'.indexOf(branchChar);
  if (stemIdx < 0 || branchIdx < 0) {
    throw new ZiWeiError('CALENDAR_CONVERSION_FAILED', `Cannot parse ganzhi: ${gz}`);
  }
  return { stem: STEMS[stemIdx], branch: BRANCHES[branchIdx] };
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function utcOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  }
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function hourBranchFromHour(hour: number): BranchId {
  const h = ((hour % 24) + 24) % 24;
  return branchAt(Math.floor(((h + 1) % 24) / 2));
}

export interface NormalizedBirth {
  solar: { year: number; month: number; day: number };
  lunar: { year: number; month: number; day: number; isLeapMonth: boolean };
  hour: number;
  minute: number;
  second: number;
  hourBranch: BranchId;
  ganzhi: {
    year: GanzhiPair;
    month: GanzhiPair;
    day: GanzhiPair;
    hour: GanzhiPair;
  };
  utcOffsetMinutes: number;
  trueSolarOffsetMinutes?: number;
  solarTerm?: string;
}

export function normalizeBirth(
  input: ZiWeiBirthInput,
  profile: Profile
): NormalizedBirth {
  const timezone = input.timezone ?? 'Asia/Taipei';
  if (!isValidTimezone(timezone)) {
    throw new ZiWeiError('INVALID_TIMEZONE', `Unknown IANA timezone: ${timezone}`, { timezone });
  }

  // 未知時辰不得偷偷預設（spec §P0-2）。唯一例外：analyzeUnknownTime 會逐一帶入代表時辰。
  if (input.time?.hour === undefined) {
    throw new ZiWeiError(
      'UNKNOWN_BIRTH_TIME',
      'input.time.hour is required; use ZiWei.analyzeUnknownTime() to enumerate 12 candidate hours'
    );
  }
  const hour = input.time.hour;
  const minute = input.time.minute ?? 0;
  const second = input.time.second ?? 0;

  const timeConvention = input.timeConvention ?? profile.timeConvention;
  const dayBoundary = input.dayBoundary ?? profile.dayBoundary;

  let solarY: number, solarM: number, solarD: number;
  let lunarY: number, lunarM: number, lunarD: number;
  let isLeap = false;
  let lunar: Lunar;

  if (input.calendarType === 'solar') {
    solarY = input.date.year;
    solarM = input.date.month;
    solarD = input.date.day;
    if (solarM < 1 || solarM > 12 || solarD < 1 || solarD > 31) {
      throw new ZiWeiError('INVALID_DATE', `Invalid solar date: ${solarY}-${solarM}-${solarD}`);
    }
    let solar: Solar;
    try {
      solar = Solar.fromYmdHms(solarY, solarM, solarD, hour, minute, second);
    } catch (e) {
      throw new ZiWeiError('INVALID_DATE', `Invalid solar date: ${solarY}-${solarM}-${solarD}`, { cause: String(e) });
    }
    lunar = solar.getLunar();
    lunarY = lunar.getYear();
    lunarM = lunar.getMonth();
    isLeap = lunarM < 0;
    lunarM = Math.abs(lunarM);
    lunarD = lunar.getDay();
  } else {
    lunarY = input.date.year;
    lunarM = input.date.month;
    lunarD = input.date.day;
    isLeap = input.date.isLeapMonth === true;
    if (lunarM < 1 || lunarM > 12 || lunarD < 1 || lunarD > 30) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Invalid lunar date: ${lunarY}-${lunarM}-${lunarD}`);
    }
    if (isLeap) {
      const month = LunarMonth.fromYm(lunarY, -lunarM);
      if (!month || !month.isLeap()) {
        throw new ZiWeiError('INVALID_LEAP_MONTH', `Year ${lunarY} has no leap month ${lunarM}`);
      }
      if (lunarD > month.getDayCount()) {
        throw new ZiWeiError('INVALID_LUNAR_DATE', `Leap month ${lunarM} of ${lunarY} has only ${month.getDayCount()} days`);
      }
    }
    try {
      lunar = Lunar.fromYmdHms(lunarY, isLeap ? -lunarM : lunarM, lunarD, hour, minute, second);
    } catch (e) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Invalid lunar date: ${lunarY}-${isLeap ? 'leap-' : ''}${lunarM}-${lunarD}`, { cause: String(e) });
    }
    const solar = lunar.getSolar();
    solarY = solar.getYear();
    solarM = solar.getMonth();
    solarD = solar.getDay();
  }

  let effHour = hour;
  let effMinute = minute;
  let trueSolarOffset: number | undefined;

  if (timeConvention === 'true-solar' || timeConvention === 'local-mean-solar') {
    const lon = input.location?.longitude;
    if (lon === undefined) {
      throw new ZiWeiError(
        'MISSING_LOCATION_FOR_SOLAR_TIME',
        'true-solar / local-mean-solar timeConvention requires location.longitude'
      );
    }
    const offsetMin = utcOffsetMinutes(
      new Date(Date.UTC(solarY, solarM - 1, solarD, hour, minute)),
      timezone
    );
    const standardMeridian = offsetMin / 60 * 15;
    let delta = (lon - standardMeridian) * 4;
    if (timeConvention === 'true-solar') {
      delta += equationOfTime(solarY, solarM, solarD);
    }
    trueSolarOffset = Math.round(delta * 10) / 10;
    const total = effHour * 60 + effMinute + delta;
    effHour = Math.floor((((total % 1440) + 1440) % 1440) / 60);
    effMinute = Math.round((((total % 1440) + 1440) % 1440) % 60);
  }

  let ganzhiYear: GanzhiPair;
  let ganzhiMonth: GanzhiPair;
  let ganzhiDay: GanzhiPair;
  let ganzhiHour: GanzhiPair;

  const solar = Solar.fromYmdHms(solarY, solarM, solarD, effHour, effMinute, second);
  const lunarForGz = solar.getLunar();
  ganzhiYear = gzCharToIds(lunarForGz.getYearInGanZhi());
  ganzhiMonth = gzCharToIds(lunarForGz.getMonthInGanZhi());
  ganzhiDay = gzCharToIds(lunarForGz.getDayInGanZhi());
  ganzhiHour = gzCharToIds(lunarForGz.getTimeInGanZhi());

  if (dayBoundary === 'zi-hour' && hour === 23) {
    const nextSolar = solar.next(1);
    const nextLunar = nextSolar.getLunar();
    ganzhiDay = gzCharToIds(nextLunar.getDayInGanZhi());
    lunarY = nextLunar.getYear();
    lunarM = Math.abs(nextLunar.getMonth());
    lunarD = nextLunar.getDay();
    isLeap = nextLunar.getMonth() < 0;
    ganzhiYear = gzCharToIds(nextLunar.getYearInGanZhi());
    ganzhiMonth = gzCharToIds(nextLunar.getMonthInGanZhi());
    const hb = hourBranchFromHour(effHour);
    ganzhiHour = { stem: stemAt(STEMS.indexOf(ganzhiDay.stem) % 5 * 2), branch: hb };
  }

  const hourBranch = hourBranchFromHour(effHour);
  const offsetMin = utcOffsetMinutes(
    new Date(Date.UTC(solarY, solarM - 1, solarD, hour, minute)),
    timezone
  );

  return {
    solar: { year: solarY, month: solarM, day: solarD },
    lunar: { year: lunarY, month: lunarM, day: lunarD, isLeapMonth: isLeap },
    hour: effHour,
    minute: effMinute,
    second,
    hourBranch,
    ganzhi: {
      year: ganzhiYear,
      month: ganzhiMonth,
      day: ganzhiDay,
      hour: ganzhiHour
    },
    utcOffsetMinutes: offsetMin,
    trueSolarOffsetMinutes: trueSolarOffset,
    solarTerm: lunarForGz.getJieQi() || undefined
  };
}

function equationOfTime(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const d = Math.floor((Date.UTC(year, month - 1, day) - start) / 86400000);
  const b = (2 * Math.PI * (d - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function buildCalendarInfo(
  input: ZiWeiBirthInput,
  profile: Profile,
  normalized: NormalizedBirth
): CalendarInfo {
  return {
    solar: normalized.solar,
    lunar: normalized.lunar,
    ganzhi: normalized.ganzhi,
    hourBranch: normalized.hourBranch,
    solarTerm: normalized.solarTerm,
    timezone: input.timezone ?? 'Asia/Taipei',
    utcOffsetMinutes: normalized.utcOffsetMinutes,
    timeConvention: input.timeConvention ?? profile.timeConvention,
    trueSolarOffsetMinutes: normalized.trueSolarOffsetMinutes,
    dayBoundary: input.dayBoundary ?? profile.dayBoundary
  };
}
