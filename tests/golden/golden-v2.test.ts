import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculate } from '../../src/index.js';
import type { ZiWeiBirthInput, CalculateOptions } from '../../src/index.js';

/**
 * Golden V2（spec §P1-4）
 *
 * 每張 fixture 保存「完整 Oracle」：calendar / life / body / bureau /
 * 12 palaces / 14 major stars / core aux / sihua / 大限 / patterns。
 *
 * 禁止 `_computed_`：期望值必須是外部核對過的固定值。
 */

interface GoldenV2 {
  name: string;
  tags: string[];
  input: ZiWeiBirthInput;
  profile: string;
  verified: {
    status: 'verified' | 'engine-only';
    verifiedAt: string;
    verifiedBy: string;
    against: Array<{ sourceId: string; version: string }>;
    note: string;
  };
  oracle: {
    schemaVersion: string;
    calendar: Record<string, unknown>;
    birthContext: { yinYang: string; direction: string; bureau: string };
    natal: Record<string, unknown>;
    palaces: Array<Record<string, unknown>>;
    majorStars: Record<string, { branch: string; palaceId: string; dignity?: string }>;
    coreAuxStars: Record<string, { branch: string; palaceId: string; dignity?: string }>;
    sihua: Record<string, string>;
    majorPeriods: Array<{ fromAge: number; toAge: number; branch: string; stem: string }>;
    patterns: Array<{ patternId: string; status: string }>;
  };
}

const dir = join(process.cwd(), 'fixtures', 'golden');
const files = readdirSync(dir).filter(f => f.startsWith('golden-') && f.endsWith('.json'));
const fixtures: Array<{ file: string; data: GoldenV2 }> = files.map(f => ({
  file: f,
  data: JSON.parse(readFileSync(join(dir, f), 'utf8')) as GoldenV2
}));

function run(data: GoldenV2) {
  const options: CalculateOptions = { profile: data.profile };
  return calculate(data.input, options);
}

describe('Golden V2 — 結構要求', () => {
  it('至少 30 張 fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
  });

  it('每張皆有 input / profile / oracle / verified，且不得出現 _computed_', () => {
    for (const { file, data } of fixtures) {
      expect(data.input, file).toBeDefined();
      expect(data.profile, file).toBeTruthy();
      expect(data.oracle, file).toBeDefined();
      expect(data.verified?.status, file).toBeTruthy();
      expect(JSON.stringify(data), file).not.toContain('_computed_');
    }
  });

  it('verified 區塊需載明依據', () => {
    for (const { file, data } of fixtures) {
      expect(data.verified.verifiedBy, file).toBeTruthy();
      expect(data.verified.verifiedAt, file).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (data.verified.status === 'verified') {
        expect(data.verified.against.length, file).toBeGreaterThan(0);
        for (const a of data.verified.against) {
          expect(a.sourceId, file).toMatch(/^SRC\./);
          expect(a.version, file).toBeTruthy();
        }
      }
    }
  });

  it('覆蓋：天干 / 地支 / 五行局 / 方向 / 時辰邊界 / 時區 / 真太陽時 / 換日', () => {
    const tags = new Set(fixtures.flatMap(f => f.data.tags ?? []));
    const need = (t: string) => expect([...tags].some(x => x === t || x.startsWith(t)), `missing tag group ${t}`).toBe(true);
    need('stem:');
    need('branch:');
    need('bureau');
    need('direction:');
    need('timezone');
    need('dst');
    need('true-solar');
    need('leap');
    need('boundary:23');
    need('boundary:00');
  });
});

describe('Golden V2 — 逐張重算比對', () => {
  for (const { file, data } of fixtures) {
    it(`${data.name} (${file})`, () => {
      const c = run(data);
      const o = data.oracle;

      expect(`${c.schemaVersion}`).toBe(o.schemaVersion);

      expect(c.calendar.solar).toEqual(o.calendar.solar);
      expect(c.calendar.lunar).toEqual(o.calendar.lunar);
      expect(c.calendar.ganzhi).toEqual(o.calendar.ganzhi);
      expect(c.calendar.hourBranch).toBe(o.calendar.hourBranch);
      expect(c.calendar.timezone).toBe(o.calendar.timezone);
      expect(c.calendar.utcOffsetMinutes).toBe(o.calendar.utcOffsetMinutes);
      expect(c.calendar.timeConvention).toBe(o.calendar.timeConvention);
      expect(c.calendar.dayBoundary).toBe(o.calendar.dayBoundary);

      expect(c.birthContext.yinYang).toBe(o.birthContext.yinYang);
      expect(c.birthContext.direction).toBe(o.birthContext.direction);
      expect(c.birthContext.bureau).toBe(o.birthContext.bureau);

      expect(c.chart.natal.lifePalaceBranch).toBe(o.natal.lifePalaceBranch);
      expect(c.chart.natal.bodyPalaceBranch).toBe(o.natal.bodyPalaceBranch);
      expect(c.chart.natal.lifePalace).toBe(o.natal.lifePalace);
      expect(c.chart.natal.bodyPalace).toBe(o.natal.bodyPalace);

      // 12 宮
      expect(c.chart.palaces.length).toBe(o.palaces.length);
      for (const ep of o.palaces) {
        const p = c.chart.palaces.find(x => x.id === ep.id)!;
        expect(p, `${file}: palace ${ep.id}`).toBeDefined();
        expect(p.branch).toBe(ep.branch);
        expect(p.stem).toBe(ep.stem);
        expect(p.isLifePalace).toBe(ep.isLifePalace);
        expect(p.isBodyPalace).toBe(ep.isBodyPalace);
        expect(p.changsheng).toBe(ep.changsheng);
        expect(p.boshi).toBe(ep.boshi);
        expect(p.majorPeriod ?? null).toEqual(ep.majorPeriod ?? null);
      }

      // 十四主星 + 廟旺
      expect(Object.keys(o.majorStars).length).toBe(14);
      for (const [id, exp] of Object.entries(o.majorStars)) {
        const p = c.chart.stars[id];
        expect(p, `${file}: ${id}`).toBeDefined();
        expect(p.branch).toBe(exp.branch);
        expect(p.palaceId).toBe(exp.palaceId);
        expect(p.dignity).toBe(exp.dignity);
      }

      // 核心輔煞
      expect(Object.keys(o.coreAuxStars).length).toBeGreaterThan(10);
      for (const [id, exp] of Object.entries(o.coreAuxStars)) {
        const p = c.chart.stars[id];
        expect(p, `${file}: ${id}`).toBeDefined();
        expect(p.branch).toBe(exp.branch);
        expect(p.palaceId).toBe(exp.palaceId);
        expect(p.dignity).toBe(exp.dignity);
      }

      // 四化
      const sihua = Object.fromEntries(
        c.chart.transformations.filter(t => t.sourceScope === 'natal').map(t => [t.type, t.targetStarId])
      );
      expect(sihua).toEqual(o.sihua);

      // 大限
      expect(c.periods.major.map(p => ({ fromAge: p.fromAge, toAge: p.toAge, branch: p.branch, stem: p.stem })))
        .toEqual(o.majorPeriods);

      // 格局
      expect(c.chart.patterns.map(p => ({ patternId: p.patternId, status: p.status }))).toEqual(o.patterns);
    });
  }
});
