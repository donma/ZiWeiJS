import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ajv = new Ajv({ allErrors: true, strict: false });

const ruleSchema = JSON.parse(readFileSync(join(root, 'schemas/rule.schema.json'), 'utf8'));
const intSchema = JSON.parse(readFileSync(join(root, 'schemas/interpretation.schema.json'), 'utf8'));
const validateRule = ajv.compile(ruleSchema);
const validateInt = ajv.compile(intSchema);

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (e.endsWith('.json')) yield p;
  }
}

let total = 0, failed = 0;
for (const file of walk(join(root, 'rules'))) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const rules = [...(data.rules ?? []), ...(data.patterns ?? [])];
  for (const r of rules) {
    total++;
    const isPattern = !!data.patterns?.includes(r);
    if (isPattern) {
      if (!r.ruleId || !r.status) {
        console.error(`FAIL ${file}: pattern missing ruleId/status`);
        failed++;
      }
      continue;
    }
    const isInterpretation = r.ruleId?.startsWith('ZW.INT.');
    if (isInterpretation) {
      if (!validateInt(r)) {
        console.error(`FAIL ${file}: ${r.ruleId}`);
        console.error(ajv.errorsText(validateInt.errors));
        failed++;
      }
      continue;
    }
    if (!validateRule(r)) {
      console.error(`FAIL ${file}: ${r.ruleId}`);
      console.error(ajv.errorsText(validateRule.errors));
      failed++;
    }
    if (!r.sourceRefs || r.sourceRefs.length === 0) {
      if (r.status === 'canonical') {
        console.warn(`WARN ${r.ruleId}: canonical rule has no sourceRefs`);
      }
    }
  }
}
console.log(`validated ${total} rules, ${failed} failed`);
process.exit(failed ? 1 : 0);
