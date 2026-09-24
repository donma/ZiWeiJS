/**
 * Variant Research Catalog checks（spec Post-Stability Phase F；供 CLI 與測試共用）
 *
 * 驗證：
 *   - schema 合法、dimensionId 唯一
 *   - 參照可解析（profiles / rules / variants / researchIds）
 *   - mechanism 與內容一致（profile-field → 必須有 profileFields；rule-variant → 必須有 variants）
 *   - variant 規則必須存在、status=variant、且 variantOf 對應之 canonical 規則存在
 *   - profileFields 必須是真實存在的 profile 欄位（對照 schemas/profile.schema.json）
 *   - 未建模（not-modeled / research）或 partially-modeled 且有 gap 者，必須有 researchIds
 *   - spec §26 之 14 個維度全數涵蓋
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { listRules, listProfiles, listResearch } from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const CATALOG_REL = 'research/variants/variant-catalog.json';

/** spec §26 明列之維度（必須全數出現在 catalog） */
export const SPEC_DIMENSIONS = [
  'VAR.YEAR_BOUNDARY',
  'VAR.MONTH_BOUNDARY',
  'VAR.LATE_ZI',
  'VAR.LEAP_MONTH',
  'VAR.BRIGHTNESS',
  'VAR.SIHUA_TABLE',
  'VAR.TIANMA',
  'VAR.TIANKONG',
  'VAR.VOID_STAR',
  'VAR.KUIYUE',
  'VAR.TIANSHI_TIANSHANG',
  'VAR.CHANGSHENG',
  'VAR.MINOR_PERIOD',
  'VAR.YEAR_DEITY_SCOPE'
] as const;

export interface VariantDimension {
  dimensionId: string;
  name?: Record<string, string>;
  status: 'modeled' | 'partially-modeled' | 'not-modeled' | 'research' | 'rejected';
  mechanism: 'profile-field' | 'rule-variant' | 'both' | 'none';
  profileFields?: string[];
  profiles?: string[];
  rules?: string[];
  variants?: string[];
  coveredBy?: string[];
  researchIds?: string[];
  externalObservation?: string;
  gap?: string | null;
  nextAction?: string | null;
  ownerReviewRequired?: boolean;
}

export interface VariantCatalog {
  catalogVersion: string;
  dimensions: VariantDimension[];
  existingVariantsNotInSpecList?: Array<{ variantRuleId: string; variantOf: string; note: string }>;
}

export interface VariantCatalogResult {
  failures: string[];
  stats: {
    dimensions: number;
    modeled: number;
    partiallyModeled: number;
    notModeled: number;
    variantsReferenced: number;
  };
}

export function readVariantCatalog(): VariantCatalog {
  return JSON.parse(readFileSync(join(root, CATALOG_REL), 'utf8')) as VariantCatalog;
}

export function runVariantCatalogChecks(): VariantCatalogResult {
  const failures: string[] = [];
  const catalog = readVariantCatalog();

  /* ---------- 1. schema ---------- */
  const schema = JSON.parse(readFileSync(join(root, 'schemas/variant-catalog.schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(catalog)) {
    for (const e of validate.errors ?? []) {
      failures.push(`${CATALOG_REL}: ${e.instancePath || '/'} ${e.message}`);
    }
  }

  /* ---------- 2. 參照可解析 ---------- */
  const ruleById = new Map(listRules().map(r => [r.ruleId, r]));
  const profileIds = new Set(listProfiles().map(p => p.profileId));
  const researchIds = new Set(listResearch().map(r => r.researchId));
  const profileSchema = JSON.parse(readFileSync(join(root, 'schemas/profile.schema.json'), 'utf8')) as {
    properties?: Record<string, unknown>;
  };
  const knownProfileFields = new Set(Object.keys(profileSchema.properties ?? {}));

  const seen = new Set<string>();
  const referencedVariants = new Set<string>();

  for (const d of catalog.dimensions) {
    const id = d.dimensionId;
    if (seen.has(id)) failures.push(`duplicate dimensionId: ${id}`);
    seen.add(id);

    for (const r of d.rules ?? []) {
      if (!ruleById.has(r)) failures.push(`${id}: rule not found ${r}`);
    }
    for (const p of d.profiles ?? []) {
      if (!profileIds.has(p)) failures.push(`${id}: profile not found ${p}`);
    }
    for (const rid of d.researchIds ?? []) {
      if (!researchIds.has(rid)) failures.push(`${id}: researchId not found ${rid}`);
    }
    for (const pf of d.profileFields ?? []) {
      if (!knownProfileFields.has(pf)) failures.push(`${id}: profileField not found in profile.schema.json: ${pf}`);
    }

    for (const v of d.variants ?? []) {
      referencedVariants.add(v);
      const rule = ruleById.get(v);
      if (!rule) {
        failures.push(`${id}: variant rule not found ${v}`);
        continue;
      }
      if (rule.status !== 'variant') failures.push(`${id}: ${v} status=${rule.status}（應為 variant）`);
      if (!rule.variantOf || !ruleById.has(rule.variantOf)) {
        failures.push(`${id}: ${v} variantOf 無法解析（${rule.variantOf ?? 'none'}）`);
      }
    }

    /* ---------- 3. mechanism 與內容一致性 ---------- */
    const usesProfileField = d.mechanism === 'profile-field' || d.mechanism === 'both';
    const usesVariant = d.mechanism === 'rule-variant' || d.mechanism === 'both';
    if (usesProfileField && (d.profileFields ?? []).length === 0) {
      failures.push(`${id}: mechanism=${d.mechanism} 但未列 profileFields`);
    }
    if (usesVariant && (d.variants ?? []).length === 0) {
      failures.push(`${id}: mechanism=${d.mechanism} 但未列 variants`);
    }
    if (d.status === 'modeled' && d.mechanism === 'none') {
      failures.push(`${id}: status=modeled 但 mechanism=none`);
    }

    /* ---------- 4. 未建模 / 有 gap 者必須有研究項 ---------- */
    const needsResearch = d.status !== 'modeled' || !!d.gap;
    if (needsResearch && (d.researchIds ?? []).length === 0 && d.ownerReviewRequired !== true) {
      failures.push(`${id}: status=${d.status}（含 gap）但無 researchIds 亦未標 ownerReviewRequired`);
    }
    if (d.status !== 'modeled' && !d.nextAction) {
      failures.push(`${id}: 非 modeled 必須提供 nextAction`);
    }
  }

  /* ---------- 5. spec 維度涵蓋 ---------- */
  for (const spec of SPEC_DIMENSIONS) {
    if (!seen.has(spec)) failures.push(`spec §26 維度未涵蓋: ${spec}`);
  }

  /* ---------- 6. 額外 variant（不在 spec 清單者）須存在 ---------- */
  for (const extra of catalog.existingVariantsNotInSpecList ?? []) {
    const rule = ruleById.get(extra.variantRuleId);
    if (!rule) failures.push(`existingVariantsNotInSpecList: not found ${extra.variantRuleId}`);
    else if (!ruleById.has(extra.variantOf)) {
      failures.push(`existingVariantsNotInSpecList: variantOf not found ${extra.variantOf}`);
    }
  }

  const count = (s: VariantDimension['status']) => catalog.dimensions.filter(d => d.status === s).length;
  return {
    failures,
    stats: {
      dimensions: catalog.dimensions.length,
      modeled: count('modeled'),
      partiallyModeled: count('partially-modeled'),
      notModeled: count('not-modeled') + count('research'),
      variantsReferenced: referencedVariants.size
    }
  };
}
