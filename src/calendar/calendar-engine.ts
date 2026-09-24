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

export function gzCharToIds(gz: string): GanzhiPair {
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

/**
 * 年柱干支解析（spec 3rd §P0-2 / §P1-3）：
 * 統一由 yearBoundaryPolicy 決定，讓 natal 與 period target 共同使用。
 * - 'lunar-new-year'（預設 / canonical）：農曆正月初一換年
 * - 'lichun'：二十四節氣立春換年（lunar-typescript getYearInGanZhiExact）
 */
export function resolveYearGanzhi(
  lunar: Lunar,
  policy: 'lunar-new-year' | 'lichun' = 'lunar-new-year'
): GanzhiPair {
  const gz = policy === 'lichun'
    ? lunar.getYearInGanZhiExact()
    : lunar.getYearInGanZhi();
  return gzCharToIds(gz);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** 該 UTC 瞬間在指定時區的 UTC 偏移（分鐘） */
function offsetAtInstant(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  // formatToParts 可能給 "24" 表示午夜
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUTC - instant.getTime()) / 60000);
}

export type TimezoneDisambiguation = 'reject' | 'earlier' | 'later';

export interface LocalTimeResolution {
  /** 解析後之 UTC 瞬間 */
  instant: Date;
  /** 該瞬間之 UTC 偏移（分鐘） */
  offsetMinutes: number;
  /** 是否落在 DST 缺洞（spring forward） */
  nonexistent: boolean;
  /** 是否落在 DST 重複時段（fall back） */
  ambiguous: boolean;
}

/**
 * 將「本地牆鐘時間」解析為真實 UTC 瞬間（spec 3rd §P1-2）。
 *
 * - 不存在的本地時間（spring forward 缺洞，如 2024-03-10 02:30 America/New_York）
 * - 重複的本地時間（fall back 歧義，如 2024-11-03 01:30 America/New_York）
 *
 * disambiguation：
 *   reject（預設）→ 丟 NONEXISTENT_LOCAL_TIME / AMBIGUOUS_LOCAL_TIME
 *   earlier       → 取較早的瞬間（缺洞時往後推至洞後）
 *   later         → 取較晚的瞬間
 */
export function resolveLocalWallTime(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  tz: string,
  disambiguation: TimezoneDisambiguation = 'reject'
): LocalTimeResolution {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);

  // 以候選偏移反推瞬間，驗證是否真的落在該本地時間
  const candidates: Array<{ instant: number; offset: number }> = [];
  // 先取兩個常見偏移（前後各一天取樣）作為候選
  const probeOffsets = new Set<number>();
  for (const deltaDays of [-1, 0, 1]) {
    probeOffsets.add(offsetAtInstant(new Date(naive + deltaDays * 86_400_000), tz));
  }
  for (const off of probeOffsets) {
    const instant = naive - off * 60_000;
    const actualOffset = offsetAtInstant(new Date(instant), tz);
    if (actualOffset === off) {
      candidates.push({ instant, offset: off });
    }
  }

  const unique = [...new Map(candidates.map(c => [c.instant, c])).values()]
    .sort((a, b) => a.instant - b.instant);

  if (unique.length === 1) {
    return { instant: new Date(unique[0].instant), offsetMinutes: unique[0].offset, nonexistent: false, ambiguous: false };
  }

  if (unique.length > 1) {
    // 重複（fall back）
    if (disambiguation === 'reject') {
      throw new ZiWeiError(
        'AMBIGUOUS_LOCAL_TIME',
        `Local time ${year}-${month}-${day} ${hour}:${minute} is ambiguous in ${tz} (DST fall back)`,
        { timezone: tz, local: { year, month, day, hour, minute }, candidates: unique.map(c => new Date(c.instant).toISOString()) }
      );
    }
    const pick = disambiguation === 'earlier' ? unique[0] : unique[unique.length - 1];
    return { instant: new Date(pick.instant), offsetMinutes: pick.offset, nonexistent: false, ambiguous: true };
  }

  // 不存在（spring forward 缺洞）：用「洞前偏移」與「洞後偏移」皆無法還原
  const before = offsetAtInstant(new Date(naive - 86_400_000), tz);
  const after = offsetAtInstant(new Date(naive + 86_400_000), tz);
  if (disambiguation === 'reject') {
    throw new ZiWeiError(
      'NONEXISTENT_LOCAL_TIME',
      `Local time ${year}-${month}-${day} ${hour}:${minute} does not exist in ${tz} (DST spring forward)`,
      { timezone: tz, local: { year, month, day, hour, minute } }
    );
  }
  // earlier：往後推到洞後；later：也取洞後（缺洞時唯一可行）
  const off = disambiguation === 'earlier' ? before : after;
  const instant = naive - off * 60_000;
  return { instant: new Date(instant), offsetMinutes: offsetAtInstant(new Date(instant), tz), nonexistent: true, ambiguous: false };
}

/** 取得某「本地牆鐘時間」的 UTC 偏移（分鐘）；DST 邊界以 disambiguation 決定 */
export function localOffsetMinutes(
  year: number, month: number, day: number,
  hour: number, minute: number, tz: string,
  disambiguation: TimezoneDisambiguation = 'reject'
): number {
  return resolveLocalWallTime(year, month, day, hour, minute, 0, tz, disambiguation).offsetMinutes;
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

  // 時間嚴格驗證（spec 3rd §P1-1）
  const hour = input.time.hour;
  const minute = input.time.minute ?? 0;
  const second = input.time.second ?? 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ZiWeiError('INVALID_INPUT', `input.time.hour must be integer 0..23, got ${hour}`, { hour });
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new ZiWeiError('INVALID_INPUT', `input.time.minute must be integer 0..59, got ${minute}`, { minute });
  }
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    throw new ZiWeiError('INVALID_INPUT', `input.time.second must be integer 0..59, got ${second}`, { second });
  }

  // Location 嚴格驗證（spec 3rd §P1-1）
  if (input.location) {
    const { longitude: lon, latitude: lat } = input.location;
    if (lon !== undefined) {
      if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw new ZiWeiError('INVALID_INPUT', `location.longitude must be finite number in -180..180, got ${lon}`, { location: input.location });
      }
    }
    if (lat !== undefined) {
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new ZiWeiError('INVALID_INPUT', `location.latitude must be finite number in -90..90, got ${lat}`, { location: input.location });
      }
    }
  }

  const timeConvention = input.timeConvention ?? profile.timeConvention;
  const dayBoundary = input.dayBoundary ?? profile.dayBoundary;
  const disambiguation: TimezoneDisambiguation = input.timezoneDisambiguation ?? 'reject';

  let solarY: number, solarM: number, solarD: number;
  let lunarY: number, lunarM: number, lunarD: number;
  let isLeap = false;
  let lunar: Lunar;

  if (input.calendarType === 'solar') {
    solarY = input.date.year;
    solarM = input.date.month;
    solarD = input.date.day;
    // 嚴格國曆真實日期驗證（spec 3rd §P1-1）：平年 2/29 / 4/31 必拋 INVALID_DATE
    if (!Number.isInteger(solarY) || !Number.isInteger(solarM) || !Number.isInteger(solarD)) {
      throw new ZiWeiError('INVALID_DATE', `Invalid solar date integers: ${solarY}-${solarM}-${solarD}`);
    }
    const dim = new Date(Date.UTC(solarY, solarM, 0)).getUTCDate();
    if (solarM < 1 || solarM > 12 || solarD < 1 || solarD > dim) {
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
    if (!Number.isInteger(lunarY) || !Number.isInteger(lunarM) || !Number.isInteger(lunarD)) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Invalid lunar date integers: ${lunarY}-${lunarM}-${lunarD}`);
    }
    if (lunarM < 1 || lunarM > 12 || lunarD < 1 || lunarD > 30) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Invalid lunar date: ${lunarY}-${lunarM}-${lunarD}`);
    }
    // 農曆大小月天數嚴格檢驗（spec 3rd §P1-1）
    const regularMonth = LunarMonth.fromYm(lunarY, lunarM);
    if (!regularMonth) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Lunar month ${lunarM} does not exist in year ${lunarY}`);
    }
    let lm = regularMonth;
    if (isLeap) {
      const leapMonth = LunarMonth.fromYm(lunarY, -lunarM);
      if (!leapMonth || !leapMonth.isLeap()) {
        throw new ZiWeiError('INVALID_LEAP_MONTH', `Year ${lunarY} has no leap month ${lunarM}`);
      }
      lm = leapMonth;
    }
    if (lunarD > lm.getDayCount()) {
      throw new ZiWeiError('INVALID_LUNAR_DATE', `Lunar month ${lunarM} of year ${lunarY} has only ${lm.getDayCount()} days`);
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

  // 民曆（未校正）日期，用於時區 offset 查詢
  const civilY = solarY;
  const civilM = solarM;
  const civilD = solarD;

  let effHour = hour;
  let effMinute = minute;
  let trueSolarOffset: number | undefined;
  let effectiveDayOffset = 0;

  if (timeConvention === 'true-solar' || timeConvention === 'local-mean-solar') {
    const lon = input.location?.longitude;
    if (lon === undefined) {
      throw new ZiWeiError(
        'MISSING_LOCATION_FOR_SOLAR_TIME',
        'true-solar / local-mean-solar timeConvention requires location.longitude'
      );
    }
    // 本地牆鐘時間 → 真實 UTC 偏移（spec 3rd §P1-2：DST 缺洞/重複由 disambiguation 決定）
    const offsetMin = localOffsetMinutes(civilY, civilM, civilD, hour, minute, timezone, disambiguation);
    const standardMeridian = offsetMin / 60 * 15;
    let delta = (lon - standardMeridian) * 4;
    if (timeConvention === 'true-solar') {
      delta += equationOfTime(civilY, civilM, civilD);
    }
    trueSolarOffset = Math.round(delta * 10) / 10;

    // 真太陽時可能跨越午夜 → 日期必須同步調整（spec §P1-6）
    const total = hour * 60 + minute + delta;
    effectiveDayOffset = Math.floor(total / 1440);
    const withinDay = ((total % 1440) + 1440) % 1440;
    effHour = Math.floor(withinDay / 60);
    effMinute = Math.round(withinDay % 60);
  }

  // 套用跨日位移（真太陽時校正）
  if (effectiveDayOffset !== 0) {
    const shifted = Solar.fromYmd(civilY, civilM, civilD).next(effectiveDayOffset);
    solarY = shifted.getYear();
    solarM = shifted.getMonth();
    solarD = shifted.getDay();
  }

  let ganzhiYear: GanzhiPair;
  let ganzhiMonth: GanzhiPair;
  let ganzhiDay: GanzhiPair;
  let ganzhiHour: GanzhiPair;

  const solar = Solar.fromYmdHms(solarY, solarM, solarD, effHour, effMinute, second);
  const lunarForGz = solar.getLunar();
  lunar = lunarForGz;
  // 農曆日期以 effective 日期為準（與國曆同步）
  lunarY = lunarForGz.getYear();
  lunarM = Math.abs(lunarForGz.getMonth());
  lunarD = lunarForGz.getDay();
  isLeap = lunarForGz.getMonth() < 0;

  const yearPolicy = profile.yearBoundaryPolicy ?? 'lunar-new-year';
  ganzhiYear = resolveYearGanzhi(lunarForGz, yearPolicy);
  ganzhiMonth = gzCharToIds(lunarForGz.getMonthInGanZhi());
  ganzhiDay = gzCharToIds(lunarForGz.getDayInGanZhi());
  ganzhiHour = gzCharToIds(lunarForGz.getTimeInGanZhi());

  // 子時換日：以 effective time 判定（非原始輸入時辰）
  if (dayBoundary === 'zi-hour' && effHour === 23) {
    const nextSolar = solar.next(1);
    const nextLunar = nextSolar.getLunar();
    ganzhiDay = gzCharToIds(nextLunar.getDayInGanZhi());
    lunarY = nextLunar.getYear();
    lunarM = Math.abs(nextLunar.getMonth());
    lunarD = nextLunar.getDay();
    isLeap = nextLunar.getMonth() < 0;
    solarY = nextSolar.getYear();
    solarM = nextSolar.getMonth();
    solarD = nextSolar.getDay();
    ganzhiYear = resolveYearGanzhi(nextLunar, yearPolicy);
    ganzhiMonth = gzCharToIds(nextLunar.getMonthInGanZhi());
    const hb = hourBranchFromHour(effHour);
    ganzhiHour = { stem: stemAt(STEMS.indexOf(ganzhiDay.stem) % 5 * 2), branch: hb };
  }

  const hourBranch = hourBranchFromHour(effHour);
  // P1-2：DST 邊界以 disambiguation 解析（預設 reject）
  const offsetMin = localOffsetMinutes(civilY, civilM, civilD, hour, minute, timezone, disambiguation);

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
