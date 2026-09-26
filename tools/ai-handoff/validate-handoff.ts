#!/usr/bin/env tsx
/**
 * AI Handoff Schema Validator（spec 0.71 §69）
 *
 * 驗證 schemas/ai-handoff.schema.json 對 fixtures/ai-handoff/*.json 的合法性。
 * 用法：npm run validate:ai-handoff
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';

const root = process.cwd();
const schema = JSON.parse(readFileSync(join(root, 'schemas/ai-handoff.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const fixtureDir = join(root, 'fixtures/ai-handoff');
const files = readdirSync(fixtureDir).filter(f => f.endsWith('.json'));

let failures = 0;
for (const file of files) {
  const content = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8'));
  const valid = validate(content);
  if (!valid) {
    console.error(`FAIL fixtures/ai-handoff/${file}:`);
    for (const err of validate.errors ?? []) {
      console.error(`  ${err.instancePath || '/'} ${err.message}`);
    }
    failures++;
  }
}

if (failures > 0) {
  console.error(`\nai-handoff FAILED — ${failures} fixture(s) invalid`);
  process.exit(1);
}

console.log(`ai-handoff OK — ${files.length} fixtures validated against schemas/ai-handoff.schema.json`);
process.exit(0);
