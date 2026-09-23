import type { Rule, RuleStatus, Source, Evidence, Profile } from '../core/types.js';
import { ZiWeiError } from '../core/errors.js';

import palacesData from '../../rules/calculation/palace/palaces.json' with { type: 'json' };
import bureauData from '../../rules/calculation/bureau/bureau.json' with { type: 'json' };
import majorStarsData from '../../rules/calculation/stars/major.json' with { type: 'json' };
import auxStarsData from '../../rules/calculation/stars/aux-stars.json' with { type: 'json' };
import auxGroupsData from '../../rules/calculation/stars/aux-groups.json' with { type: 'json' };
import auxVariantsData from '../../rules/calculation/stars/aux-variants.json' with { type: 'json' };
import sihuaData from '../../rules/calculation/transformations/sihua.json' with { type: 'json' };
import periodsData from '../../rules/calculation/periods/periods.json' with { type: 'json' };
import relationsData from '../../rules/calculation/relations/relations.json' with { type: 'json' };
import dignityData from '../../rules/calculation/dignity/dignity.json' with { type: 'json' };
import calendarData from '../../rules/calculation/calendar/calendar.json' with { type: 'json' };
import birthData from '../../rules/calculation/birth/birth.json' with { type: 'json' };
import patternsData from '../../rules/patterns/geju.json' with { type: 'json' };
import rectificationData from '../../rules/rectification/rectification.json' with { type: 'json' };
import intPersonality from '../../rules/interpretation/personality.json' with { type: 'json' };
import intCareer from '../../rules/interpretation/career.json' with { type: 'json' };
import intDomains from '../../rules/interpretation/domains.json' with { type: 'json' };
import intSihuaPalaces from '../../rules/interpretation/sihua-palaces.json' with { type: 'json' };
import intMajorPalaces from '../../rules/interpretation/major-stars-palaces.json' with { type: 'json' };
import intAuxPalaces from '../../rules/interpretation/aux-stars-palaces.json' with { type: 'json' };

import sourcesData from '../../sources/registry.json' with { type: 'json' };
import evidenceData from '../../evidence/registry.json' with { type: 'json' };
import profilesCanonical from '../../profiles/canonical.json' with { type: 'json' };
import profilesTraditionalZi from '../../profiles/traditional-zi.json' with { type: 'json' };
import profilesTrueSolar from '../../profiles/true-solar.json' with { type: 'json' };
import profilesZhongzhou from '../../profiles/school-zhongzhou.json' with { type: 'json' };
import profilesMaHu from '../../profiles/school-ma-hu.json' with { type: 'json' };

interface RuleFile { rules?: Rule[]; patterns?: Rule[] }

const ruleFiles: RuleFile[] = [
  palacesData, bureauData, majorStarsData, auxStarsData, auxGroupsData, auxVariantsData, sihuaData,
  periodsData, relationsData, dignityData, calendarData, birthData,
  patternsData, rectificationData
] as unknown as RuleFile[];

const interpretationFiles = [intPersonality, intCareer, intDomains, intSihuaPalaces, intMajorPalaces, intAuxPalaces] as unknown as { rules: Rule[] }[];

const allRules: Rule[] = [];
const allPatterns: Rule[] = [];
const allInterpretations: Rule[] = [];

for (const f of ruleFiles) {
  for (const r of f.rules ?? []) allRules.push(r);
  for (const p of f.patterns ?? []) allPatterns.push(p as Rule);
}
for (const f of interpretationFiles) {
  for (const r of f.rules ?? []) allInterpretations.push(r);
}

const ruleIndex = new Map<string, Rule>();
for (const r of [...allRules, ...allPatterns, ...allInterpretations]) {
  ruleIndex.set(r.ruleId, r);
}

const sourceIndex = new Map<string, Source>();
for (const s of (sourcesData as { sources: Source[] }).sources) {
  sourceIndex.set(s.sourceId, s);
}

const evidenceIndex = new Map<string, Evidence>();
for (const e of (evidenceData as { evidence: Evidence[] }).evidence) {
  evidenceIndex.set(e.evidenceId, e);
}

const profileIndex = new Map<string, Profile>();
for (const p of [profilesCanonical, profilesTraditionalZi, profilesTrueSolar, profilesZhongzhou, profilesMaHu] as Profile[]) {
  profileIndex.set(p.profileId, p);
}

export function getRule(ruleId: string): Rule {
  const r = ruleIndex.get(ruleId);
  if (!r) throw new ZiWeiError('RULE_NOT_FOUND', `Rule not found: ${ruleId}`, { ruleId });
  return r;
}

export function hasRule(ruleId: string): boolean {
  return ruleIndex.has(ruleId);
}

export function listRules(filter?: {
  status?: RuleStatus;
  category?: string;
  scopePrefix?: string;
  query?: string;
}): Rule[] {
  let out = [...allRules, ...allPatterns, ...allInterpretations];
  if (filter?.status) out = out.filter(r => r.status === filter.status);
  if (filter?.category) out = out.filter(r => r.category === filter.category);
  if (filter?.scopePrefix) out = out.filter(r => r.scope.startsWith(filter.scopePrefix!));
  if (filter?.query) {
    const q = filter.query.toLowerCase();
    out = out.filter(r =>
      r.ruleId.toLowerCase().includes(q) ||
      Object.values(r.name ?? {}).some(v => v.toLowerCase().includes(q))
    );
  }
  return out;
}

export function listPatterns(): Rule[] {
  return allPatterns;
}

export function listInterpretationRules(): Rule[] {
  return allInterpretations;
}

export function getSource(sourceId: string): Source {
  const s = sourceIndex.get(sourceId);
  if (!s) throw new ZiWeiError('SOURCE_NOT_FOUND', `Source not found: ${sourceId}`, { sourceId });
  return s;
}

export function listSources(): Source[] {
  return [...sourceIndex.values()];
}

export function getEvidence(evidenceId: string): Evidence | undefined {
  return evidenceIndex.get(evidenceId);
}

export function listEvidence(): Evidence[] {
  return [...evidenceIndex.values()];
}

export function evidenceForRule(ruleId: string): Evidence[] {
  const rule = ruleIndex.get(ruleId);
  const refs = rule?.evidenceRefs ?? [];
  return refs.map(id => evidenceIndex.get(id)).filter((e): e is Evidence => !!e);
}

export function getProfile(profileId: string): Profile {
  const p = profileIndex.get(profileId);
  if (!p) throw new ZiWeiError('UNSUPPORTED_PROFILE', `Profile not found: ${profileId}`, { profileId });
  return p;
}

export function listProfiles(): Profile[] {
  return [...profileIndex.values()];
}

export function resolveRuleForProfile(ruleId: string, profile: Profile): Rule {
  const override = profile.ruleOverrides?.[ruleId];
  if (override && ruleIndex.has(override)) {
    return ruleIndex.get(override)!;
  }
  return getRule(ruleId);
}
