import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

execSync('npx vite build --config vite.standalone.config.ts', { cwd: root, stdio: 'inherit' });

const dir = join(root, 'dist/standalone');
const jsFile = readdirSync(dir).find(f => f.endsWith('.js'));
const cssFile = readdirSync(dir).find(f => f.endsWith('.css'));

const js = jsFile ? readFileSync(join(dir, jsFile), 'utf8') : '';
const css = cssFile ? readFileSync(join(dir, cssFile), 'utf8') : '';

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>ZiWeiJS — 紫微斗數 Reference Engine</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body>
</html>`;

writeFileSync(join(root, 'dist/ziwei-bible-demo.html'), html, 'utf8');
console.log('wrote dist/ziwei-bible-demo.html (double-click to open, works offline)');

// 同步複製一份至 dist/app/，確保 GitHub Pages 部署 dist/app 時兩種 URL 都能開啟：
// 1. https://donma.github.io/ZiWeiJS/ (SPA index.html)
// 2. https://donma.github.io/ZiWeiJS/ziwei-bible-demo.html (單一獨立離線 HTML)
writeFileSync(join(root, 'dist/app/ziwei-bible-demo.html'), html, 'utf8');
