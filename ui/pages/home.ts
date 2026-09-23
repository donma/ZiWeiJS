import { state } from '../app/state.js';
import { birthFormHtml } from '../components/birth-form.js';
import { renderChartSvg, listRules, listSources } from '../../src/index.js';

export function renderHome(): string {
  const rules = listRules();
  const sources = listSources();
  const canonicalCount = rules.filter(r => r.status === 'canonical').length;
  const variantCount = rules.filter(r => r.status === 'variant').length;

  let sample = '';
  if (state.chart) {
    sample = renderChartSvg(state.chart, { mode: 'standard', theme: state.theme, locale: state.locale });
  }

  return `
  <section class="hero">
    <h1 class="serif">紫微斗數 · 可驗證參考引擎</h1>
    <p class="lede">ZiWeiJS 不是普通的算命網站 — 它是一個 machine-readable、可追溯、可測試的紫微斗數規則庫與 Reference Engine。</p>
    <p class="lede-en">Not merely a fortune-telling app — a machine-readable, traceable and testable Zi Wei Dou Shu reference repository.</p>
  </section>

  <div class="grid" style="grid-template-columns:minmax(300px,420px) 1fr;align-items:start">
    <div>
      <h2 style="margin-top:0">快速排盤</h2>
      ${birthFormHtml(true)}
      ${state.error ? `<div class="card card-pad" style="margin-top:12px;border-color:var(--danger)"><strong>錯誤</strong><p class="small">${state.error}</p></div>` : ''}
      <div class="card card-pad" style="margin-top:14px">
        <div class="kv">
          <dt>Canonical 規則</dt><dd>${canonicalCount} 條</dd>
          <dt>Variant 規則</dt><dd>${variantCount} 條</dd>
          <dt>文獻來源</dt><dd>${sources.length} 筆</dd>
          <dt>排盤方式</dt><dd>本地運算 · 離線可用 · deterministic</dd>
        </div>
      </div>
    </div>
    <div>
      ${sample ? `<div class="chart-wrap card">${sample}</div>` : `
      <div class="card card-pad" style="min-height:300px;display:flex;align-items:center;justify-content:center;color:var(--text-faint)">
        輸入出生資料後顯示 SVG 命盤
      </div>`}
    </div>
  </div>

  <h2>核心能力</h2>
  <div class="grid grid-3">
    ${[
      ['Machine-readable Rules', '所有安星、四化、格局規則皆以 JSON Rule Data 表達，非藏在程式碼中。'],
      ['Traceable', '每顆星為何在此宮，皆可追溯 Rule ID、來源與 Evidence。'],
      ['Canonical + Variant', '流派差異不被抹除：逐條規則標記 canonical / variant / research。'],
      ['SVG 命盤', '專業 SVG 渲染，可縮放、列印、匯出，桌機手機皆適用。'],
      ['Standard / Expert', '同一 UI 兩種模式：一般使用者 vs 規則檢視者。'],
      ['Offline-first', '排盤不依賴 API、資料庫或 AI；可完全離線運作。']
    ].map(([title, desc]) => `
      <div class="card card-pad"><h3 style="margin-top:0">${title}</h3><p class="sub small" style="margin:0">${desc}</p></div>
    `).join('')}
  </div>
  <style>@media(max-width:900px){.grid[style*="minmax(300px,420px)"]{grid-template-columns:1fr !important}}</style>
  `;
}
