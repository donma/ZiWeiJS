import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { calculate, listInterpretationRules, listPatterns } from '../../src/index.js';
import { evalDsl, DSL_ALLOWED_OPERATORS } from '../../src/rule-engine/dsl.js';
import { buildTestContext } from '../helpers/context.js';

const ctx = buildTestContext();

describe('P0-5 DSL 必須 fail-close', () => {
  it('打錯的 operator 直接拋 UNKNOWN_DSL_OPERATOR（不得視為 false）', () => {
    const typo = { type: 'star-in-palce', star: 'ZW.STAR.MAJOR.ZIWEI', palace: 'life' };
    expect(() => evalDsl(typo, ctx)).toThrowError(/UNKNOWN_DSL_OPERATOR|Unknown DSL operator/);
  });

  it('未知 operator 不得被當成 true', () => {
    expect(() => evalDsl({ type: 'totally-made-up' }, ctx)).toThrow();
  });

  it('缺少必要參數拋 INVALID_DSL', () => {
    expect(() => evalDsl({ type: 'star-in-palace' }, ctx)).toThrowError(/INVALID_DSL|requires/);
    expect(() => evalDsl({ type: 'dignity', star: 'ZW.STAR.MAJOR.ZIWEI' }, ctx)).toThrow();
    expect(() => evalDsl({ type: 'exists' }, ctx)).toThrow();
  });

  it('未知 compare op / period scope 拋錯', () => {
    expect(() => evalDsl({ type: 'compare', left: 'bureau', op: 'approximately', right: 1 }, ctx)).toThrow();
    expect(() => evalDsl({ type: 'period-scope', scope: 'eon' }, ctx)).toThrow();
  });

  it('空陣列的 all/any 視為無效 DSL', () => {
    expect(() => evalDsl({ all: [] }, ctx)).toThrow();
  });

  it('合法 operator 正常運作', () => {
    expect(evalDsl({ type: 'star-in-palace', star: 'ZW.STAR.MAJOR.POJUN', palace: 'life' }, ctx)).toBe(true);
    expect(evalDsl({ all: [{ type: 'star-in-palace', star: 'ZW.STAR.MAJOR.POJUN', palace: 'life' }] }, ctx)).toBe(true);
    expect(evalDsl({ none: [{ type: 'star-in-palace', star: 'ZW.STAR.MAJOR.ZIWEI', palace: 'life' }] }, ctx)).toBe(true);
    expect(evalDsl({ not: { type: 'star-in-palace', star: 'ZW.STAR.MAJOR.ZIWEI', palace: 'life' } }, ctx)).toBe(true);
  });
});

describe('P0-5 pattern operator 讀取真實 Pattern 結果', () => {
  const chart = calculate(
    { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, sexForCalculation: 'male' },
    { trace: false }
  );
  const results = chart.chart.patterns;
  const complete = results.find(r => r.status === 'complete' || r.status === 'enhanced');
  const insufficient = results.find(r => r.status === 'insufficient');

  it('命中格局回傳 true', () => {
    if (!complete) return;
    const node = { type: 'pattern', patternId: complete.patternId, statusIn: ['complete', 'enhanced'] };
    expect(evalDsl(node, { engine: { ...ctx.engine, patternResults: results } as never })).toBe(true);
  });

  it('未命中的格局回傳 false', () => {
    if (!insufficient) return;
    const node = { type: 'pattern', patternId: insufficient.patternId, statusIn: ['complete', 'enhanced'] };
    expect(evalDsl(node, { engine: { ...ctx.engine, patternResults: results } as never })).toBe(false);
  });

  it('不存在的 patternId 回傳 false（而非拋錯）', () => {
    const node = { type: 'pattern', patternId: 'ZW.PAT.NOT_EXIST.001' };
    expect(evalDsl(node, { engine: { ...ctx.engine, patternResults: results } as never })).toBe(false);
  });

  it('缺 patternId 拋 INVALID_DSL', () => {
    expect(() => evalDsl({ type: 'pattern' }, ctx)).toThrow();
  });

  it('格局結果可供 engine 的 patternResults 使用', () => {
    const c = calculate(
      { calendarType: 'solar', date: { year: 1990, month: 5, day: 15 }, time: { hour: 10 }, sexForCalculation: 'male' },
      { trace: true }
    );
    expect(c.chart.patterns.length).toBeGreaterThan(0);
    // 無 DSL 錯誤才不會出現 status=error
    expect(c.trace!.entries.filter(e => e.status === 'error')).toEqual([]);
  });
});

describe('P0-5 規則資料的 DSL 必須符合 dsl.schema.json', () => {
  const schema = JSON.parse(
    readFileSync(join(process.cwd(), 'schemas', 'dsl.schema.json'), 'utf8')
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it('dsl.schema.json 可編譯，且與 DSL_ALLOWED_OPERATORS 一致', () => {
    const usedOperators = new Set<string>();
    const collect = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(collect);
      if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        if (typeof o.type === 'string') usedOperators.add(o.type);
        for (const v of Object.values(o)) collect(v);
      }
    };
    for (const r of listInterpretationRules()) collect((r as unknown as { conditions?: unknown }).conditions);
    for (const p of listPatterns()) {
      const pp = p as unknown as { required?: unknown; enhancers?: unknown; breakers?: unknown };
      collect(pp.required);
      collect(pp.enhancers);
      collect(pp.breakers);
    }
    const unknown = [...usedOperators].filter(o => !(DSL_ALLOWED_OPERATORS as readonly string[]).includes(o));
    expect(unknown).toEqual([]);
  });

  it('所有解讀規則的 conditions 通過 schema 驗證', () => {
    const bad: string[] = [];
    for (const r of listInterpretationRules()) {
      const cond = (r as unknown as { conditions?: unknown }).conditions;
      if (cond === undefined) continue;
      if (!validate(cond)) bad.push(`${r.ruleId}: ${ajv.errorsText(validate.errors)}`);
    }
    expect(bad).toEqual([]);
  });

  it('所有格局的 required / enhancers / breakers 通過 schema 驗證', () => {
    const bad: string[] = [];
    for (const p of listPatterns()) {
      const pp = p as unknown as { required?: unknown[]; enhancers?: unknown[]; breakers?: unknown[] };
      for (const key of ['required', 'enhancers', 'breakers'] as const) {
        for (const node of pp[key] ?? []) {
          if (!validate(node)) bad.push(`${p.ruleId}.${key}: ${ajv.errorsText(validate.errors)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
