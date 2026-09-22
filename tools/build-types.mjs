import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, renameSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

execSync('npx tsc -p tsconfig.lib.json', {
  cwd: root, stdio: 'inherit'
});

const entry = join(root, 'dist/types/index.d.ts');
const target = join(root, 'dist/ziwei-bible.d.ts');
if (existsSync(entry)) {
  let content = readFileSync(entry, 'utf8');
  content = content.replace(/from '\.\/([^']+)\.js'/g, "from './types/$1.js'")
                 .replace(/from '\.\.\/([^']+)\.js'/g, "from '../$1.js'");
  writeFileSync(target, content);
  console.log('wrote dist/ziwei-bible.d.ts (+ dist/types/)');
} else {
  console.warn('no dist/types/index.d.ts generated');
}
