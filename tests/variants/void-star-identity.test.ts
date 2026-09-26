import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { listRules, getStarRegistryEntry, getEvidence, getSource, listResearch } from '../../src/index.js';

/**
 * Void Star Identity Matrix（spec 0.6 §13）。
 *
 * 驗證：schema 合法、entityId / placementRule / sourceRefs / evidenceRefs 可解析，
 * 且未判定之空亡星（截路/旬中/空亡）一律維持 research（禁止自動合併）。
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const matrix = JSON.parse(readFileSync(join(root, 'research/variants/void-star-identity.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(root, 'schemas/void-star-identity.schema.json'), 'utf8'));

describe('void star identity matrix', () => {
  it('schema 合法', () => {
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
    const ok = validate(matrix);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('entityId / placementRule / sourceRefs / evidenceRefs 皆可解析', () => {
    const ruleIds = new Set(listRules().map(r => r.ruleId));
    const researchIds = new Set(listResearch().map(r => r.researchId));
    for (const e of matrix.entries) {
      if (e.entityId) expect(getStarRegistryEntry(e.entityId), `${e.name} -> ${e.entityId}`).toBeDefined();
      if (e.placementRule) expect(ruleIds.has(e.placementRule), `${e.name} -> ${e.placementRule}`).toBe(true);
      for (const s of e.sourceRefs ?? []) expect(() => getSource(s), `${e.name} -> ${s}`).not.toThrow();
      for (const ev of e.evidenceRefs ?? []) expect(getEvidence(ev), `${e.name} -> ${ev}`).toBeDefined();
    }
  });

  it('未判定之空亡星維持 research（不得自動合併）', () => {
    const unresolved = ['截路', '旬中', '空亡'];
    for (const name of unresolved) {
      const entry = matrix.entries.find((e: { name: string }) => e.name === name);
      expect(entry, name).toBeDefined();
      expect(entry.status, name).toBe('research');
      expect(entry.equivalentTo, name).toEqual([]);
    }
  });
});
