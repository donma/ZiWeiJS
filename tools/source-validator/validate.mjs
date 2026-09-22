import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ajv = new Ajv({ allErrors: true, strict: false });

const schema = JSON.parse(readFileSync(join(root, 'schemas/source.schema.json'), 'utf8'));
const validate = ajv.compile(schema);

const data = JSON.parse(readFileSync(join(root, 'sources/registry.json'), 'utf8'));
let failed = 0;
for (const s of data.sources) {
  if (!validate(s)) {
    console.error(`FAIL ${s.sourceId}:`, ajv.errorsText(validate.errors));
    failed++;
  }
  const t = (s.title + ' ' + (s.author ?? '')).toLowerCase();
  if (/chatgpt|openai|claude|gemini|ai\b/.test(t)) {
    console.error(`FAIL ${s.sourceId}: AI cannot be an evidence source`);
    failed++;
  }
}
console.log(`validated ${data.sources.length} sources, ${failed} failed`);
process.exit(failed ? 1 : 0);
