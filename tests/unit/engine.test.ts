import { describe, it, expect } from 'vitest';
import {
  calculate, calculateSafe, hourBranchFromHour,
  getRule, listRules, getSource, getProfile, evalDsl,
  sanFangSiZhengBranches, dignityOf, sihuaForStem,
  analyzeUnknownTime, ZiWeiError
} from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const baseInput: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

describe('calendar engine', () => {
  it('converts solar to lunar correctly', () => {
    const c = calculate(baseInput);
    expect(c.calendar.lunar).toEqual({ year: 1990, month: 4, day: 21, isLeapMonth: false });
  });

  it('produces correct ganzhi', () => {
    const c = calculate(baseInput);
    expect(`${c.calendar.ganzhi.year.stem}-${c.calendar.ganzhi.year.branch}`).toBe('geng-wu');
  });

  it('computes hour branch', () => {
    expect(hourBranchFromHour(23)).toBe('zi');
    expect(hourBranchFromHour(0)).toBe('zi');
    expect(hourBranchFromHour(10)).toBe('si');
    expect(hourBranchFromHour(13)).toBe('wei');
  });
});

describe('palace & bureau', () => {
  it('locates life palace', () => {
    const c = calculate(baseInput);
    expect(c.chart.natal.lifePalaceBranch).toBe('zi');
  });
  it('locates body palace', () => {
    const c = calculate(baseInput);
    expect(c.chart.natal.bodyPalaceBranch).toBe('xu');
  });
  it('determines bureau', () => {
    const c = calculate(baseInput);
    expect(c.birthContext.bureau).toBe('shui2');
  });
  it('assigns palace stems via wu-hu-dun', () => {
    const c = calculate(baseInput);
    const life = c.chart.palaces.find(p => p.isLifePalace)!;
    expect(`${life.stem}-${life.branch}`).toBe('bing-zi');
  });
});

describe('major stars', () => {
  it('places ziwei & series', () => {
    const c = calculate(baseInput);
    const s = c.chart.stars;
    const branch = (id: string) => (s[id] as unknown as { branch: string }).branch;
    expect(branch('ZW.STAR.MAJOR.ZIWEI')).toBe('you');
    expect(branch('ZW.STAR.MAJOR.TIANJI')).toBe('shen');
    expect(branch('ZW.STAR.MAJOR.TIANFU')).toBe('wei');
    expect(branch('ZW.STAR.MAJOR.POJUN')).toBe('si');
    expect(branch('ZW.STAR.MAJOR.TIANLIANG')).toBe('zi');
  });
});

describe('transformations', () => {
  it('computes natal sihua for geng year', () => {
    const c = calculate(baseInput);
    const natal = c.chart.transformations.filter(t => t.sourceScope === 'natal');
    const map = Object.fromEntries(natal.map(t => [t.type, t.targetStarId]));
    expect(map.lu).toBe('ZW.STAR.MAJOR.TAIYANG');
    expect(map.quan).toBe('ZW.STAR.MAJOR.WUQU');
    expect(map.ke).toBe('ZW.STAR.MAJOR.TAIYIN');
    expect(map.ji).toBe('ZW.STAR.MAJOR.TIANTONG');
  });
  it('sihua table covers all stems', () => {
    for (const stem of ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'] as const) {
      expect(sihuaForStem(stem).length).toBe(4);
    }
  });
});

describe('dignity', () => {
  it('looks up dignity table', () => {
    expect(dignityOf('ZW.STAR.MAJOR.ZIWEI', 'wu')).toBe('miao');
    expect(dignityOf('ZW.STAR.MAJOR.TAIYANG', 'hai')).toBe('xian');
  });
});

describe('relation engine', () => {
  it('san-fang-si-zheng returns 4 branches', () => {
    const r = sanFangSiZhengBranches('zi');
    expect(new Set(r).size).toBe(4);
    expect(r).toContain('zi');
    expect(r).toContain('wu');
  });
});

describe('rule registry', () => {
  it('resolves canonical rules', () => {
    const r = getRule('ZW.CALC.PALACE.LIFE.001');
    expect(r.status).toBe('canonical');
    expect(r.logic.executor).toBe('calcLifePalace');
  });
  it('lists variants', () => {
    const v = listRules({ status: 'variant' });
    expect(v.length).toBeGreaterThanOrEqual(2);
  });
  it('searches by query', () => {
    const r = listRules({ query: '命宮' });
    expect(r.length).toBeGreaterThan(0);
  });
  it('throws on missing rule', () => {
    expect(() => getRule('ZW.NONE')).toThrow(ZiWeiError);
  });
  it('sources have no AI as source', () => {
    for (const s of [getSource('SRC.QUANSHU')]) {
      expect(s.tier).toBeLessThanOrEqual(3);
    }
  });
});

describe('dsl', () => {
  it('star-in-palace works', () => {
    const c = calculate(baseInput);
    const ctx = { engine: fakeCtx(c) };
    expect(evalDsl({ type: 'star-in-palace', star: 'ZW.STAR.MAJOR.TIANLIANG', palace: 'life' }, ctx)).toBe(true);
    expect(evalDsl({ type: 'star-in-palace', star: 'ZW.STAR.MAJOR.ZIWEI', palace: 'life' }, ctx)).toBe(false);
  });
});

function fakeCtx(chart: ReturnType<typeof calculate>) {
  const placements = new Map<string, unknown>();
  for (const [id, p] of Object.entries(chart.chart.stars)) placements.set(id, p);
  return {
    input: chart.input,
    profile: getProfile('canonical'),
    palaces: chart.chart.palaces,
    placements,
    transformations: chart.chart.transformations,
    majorPeriods: chart.periods.major
  } as never;
}

describe('errors', () => {
  it('throws UNKNOWN_SEX_FOR_CALCULATION without sex', () => {
    const res = calculateSafe({ ...baseInput, sexForCalculation: undefined });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNKNOWN_SEX_FOR_CALCULATION');
  });
  it('throws INVALID_TIMEZONE', () => {
    const res = calculateSafe({ ...baseInput, timezone: 'Mars/Olympus' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_TIMEZONE');
  });
  it('throws INVALID_LEAP_MONTH for non-leap year/month', () => {
    const res = calculateSafe({
      calendarType: 'lunar',
      date: { year: 1991, month: 5, day: 1, isLeapMonth: true },
      time: { hour: 8 },
      sexForCalculation: 'male'
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_LEAP_MONTH');
  });
});

describe('unknown time', () => {
  it('produces 12 candidates', () => {
    const { time, ...rest } = baseInput;
    const r = analyzeUnknownTime(rest);
    expect(r.candidates.length).toBe(12);
    expect(r.summary.variable).toContain('lifePalace');
  });
});

describe('periods', () => {
  it('generates 12 major periods', () => {
    const c = calculate(baseInput);
    expect(c.periods.major.length).toBe(12);
    expect(c.periods.major[0].fromAge).toBe(2);
    expect(c.periods.major[1].fromAge).toBe(12);
  });
  it('major periods respect direction (yang male = forward)', () => {
    const c = calculate(baseInput);
    expect(c.birthContext.direction).toBe('forward');
    expect(c.periods.major[1].branch).toBe('chou');
  });
});

describe('trace', () => {
  it('records trace entries when enabled', () => {
    const c = calculate(baseInput, { trace: true });
    expect(c.trace!.entries.length).toBeGreaterThan(10);
    const life = c.trace!.entries.find(e => e.ruleId === 'ZW.CALC.PALACE.LIFE.001');
    expect(life).toBeDefined();
    expect(life!.result).toBe('zi');
  });
  it('no trace when disabled', () => {
    const c = calculate(baseInput);
    expect(c.trace).toBeUndefined();
  });
});

describe('determinism', () => {
  it('same input → same output', () => {
    const a = calculate(baseInput);
    const b = calculate(baseInput);
    const strip = (c: typeof a) => {
      const { periods, ...rest } = c;
      const { year, month, day, hour, ...restP } = periods;
      return { ...rest };
    };
    expect(JSON.stringify(strip(a))).toBe(JSON.stringify(strip(b)));
  });
});
