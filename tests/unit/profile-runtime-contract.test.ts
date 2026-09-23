import { describe, it, expect } from 'vitest';
import { listProfiles, getProfile } from '../../src/index.js';
import Ajv from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';

/**
 * spec 2nd §P0-8：Profile 不得存在假控制欄位。
 * starRules / dignityRules / transformationPolicy 已從 Profile 移除；
 * 所有 variant 統一由 ruleOverrides 控制。
 */

const schema = JSON.parse(
  readFileSync(new URL('../../schemas/profile.schema.json', import.meta.url), 'utf8')
);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

describe('P0-8 Profile runtime contract', () => {
  it('所有 profiles 符合 schema（additionalProperties: false）', () => {
    for (const p of listProfiles()) {
      const ok = validate(p);
      expect(ok, ajv.errorsText(validate.errors)).toBe(true);
    }
  });

  it('不存在假控制欄位（starRules / dignityRules / transformationPolicy）', () => {
    for (const p of listProfiles()) {
      const anyP = p as any;
      expect(anyP.starRules, `${p.profileId} 不得含 starRules`).toBeUndefined();
      expect(anyP.dignityRules, `${p.profileId} 不得含 dignityRules`).toBeUndefined();
      expect(anyP.transformationPolicy, `${p.profileId} 不得含 transformationPolicy`).toBeUndefined();
    }
  });

  it('真正控制的欄位均為已實作屬性', () => {
    const canonical = getProfile('canonical');
    expect(canonical.profileId).toBe('canonical');
    expect(canonical.timeConvention).toBe('civil');
    expect(canonical.dayBoundary).toBe('midnight');
    expect(canonical.leapMonthPolicy).toBe('same-as-normal');
  });
});
