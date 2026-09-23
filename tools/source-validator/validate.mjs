import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ajv = new Ajv({ allErrors: true, strict: false });

const sourceSchema = JSON.parse(readFileSync(join(root, 'schemas/source.schema.json'), 'utf8'));
const evidenceSchema = JSON.parse(readFileSync(join(root, 'schemas/evidence.schema.json'), 'utf8'));
const validateSource = ajv.compile(sourceSchema);
const validateEvidence = ajv.compile(evidenceSchema);

const data = JSON.parse(readFileSync(join(root, 'sources/registry.json'), 'utf8'));
let failed = 0;

const sourceIds = new Set();
for (const s of data.sources) {
  if (!validateSource(s)) {
    console.error(`FAIL ${s.sourceId}:`, ajv.errorsText(validateSource.errors));
    failed++;
  }
  if (sourceIds.has(s.sourceId)) {
    console.error(`FAIL ${s.sourceId}: duplicate sourceId`);
    failed++;
  }
  sourceIds.add(s.sourceId);
  const t = (s.title + ' ' + (s.author ?? '')).toLowerCase();
  if (/chatgpt|openai|claude|gemini|ai\b/.test(t)) {
    console.error(`FAIL ${s.sourceId}: AI cannot be an evidence source`);
    failed++;
  }
}

// Evidence registry：schema 驗證 + ID 唯一 + sourceId 必須可解析
const evData = JSON.parse(readFileSync(join(root, 'evidence/registry.json'), 'utf8'));
const evidenceIds = new Set();
for (const e of evData.evidence) {
  if (!validateEvidence(e)) {
    console.error(`FAIL ${e.evidenceId}:`, ajv.errorsText(validateEvidence.errors));
    failed++;
  }
  if (evidenceIds.has(e.evidenceId)) {
    console.error(`FAIL ${e.evidenceId}: duplicate evidenceId`);
    failed++;
  }
  evidenceIds.add(e.evidenceId);
  if (!sourceIds.has(e.sourceId)) {
    console.error(`FAIL ${e.evidenceId}: unresolved sourceId ${e.sourceId}`);
    failed++;
  }
}

console.log(`validated ${data.sources.length} sources, ${evData.evidence.length} evidence, ${failed} failed`);
process.exit(failed ? 1 : 0);
