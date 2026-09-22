import { state } from '../app/state.js';
import { birthFormHtml } from '../components/birth-form.js';
import { renderChartSvg, t, STEM_ZH, BRANCH_ZH, DIGNITY_ZH, renderNarrative, PALACE_NAME } from '../../src/index.js';
import type { StarPlacement } from '../../src/index.js';

const SIHUA_MARK: Record<string, string> = { lu: '祿', quan: '權', ke: '科', ji: '忌' };

export function renderChartPage(forceMode?: 'standard' | 'expert'): string {
  if (!state.chart) {
    return `
      <h1>命盤</h1>
      ${state.error ? `<div class="card card-pad" style="border-color:var(--danger)"><strong>錯誤</strong><p class="small">${state.error}</p></div>` : ''}
      ${birthFormHtml()}
    `;
  }
  const mode = forceMode ?? state.mode;
  const chart = state.chart;
  const svg = renderChartSvg(chart, {
    mode,
    theme: state.theme,
    locale: 'zh-TW',
    cellSize: mode === 'expert' ? 240 : 210
  });

  return `
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    <h1 style="margin:0">命盤</h1>
    <div class="seg" role="tablist">
      <button data-mode="standard" class="${mode === 'standard' ? 'active' : ''}">Standard</button>
      <button data-mode="expert" class="${mode === 'expert' ? 'active' : ''}">Expert</button>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn sm" data-chart-action="export-svg">SVG</button>
      <button class="btn sm" data-chart-action="export-png">PNG</button>
      <button class="btn sm" data-chart-action="export-json">JSON</button>
      <button class="btn sm" data-chart-action="print">列印</button>
    </div>
  </div>

  <div class="chart-page-layout">
    <aside>
      ${birthFormHtml(true)}
      ${mode === 'expert' ? expertMeta(chart) : ''}
    </aside>

    <div class="chart-col">
      <div class="chart-wrap card">${svg}</div>
      ${palaceCardsHtml(chart)}
    </div>

    <aside class="right-col">
      ${interpretationPanel(chart, mode)}
    </aside>
  </div>`;
}

function expertMeta(chart: NonNullable<typeof state.chart>): string {
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">Engine</h3>
    <div class="kv small">
      <dt>version</dt><dd class="mono">${chart.generatedWith.bibleVersion}</dd>
      <dt>schema</dt><dd class="mono">${chart.schemaVersion}</dd>
      <dt>profile</dt><dd class="mono">${chart.generatedWith.profile}</dd>
      <dt>rules hit</dt><dd>${chart.interpretation.hits.length + chart.chart.patterns.length}</dd>
      <dt>trace</dt><dd>${chart.trace?.entries.length ?? 0} entries</dd>
    </div>
  </div>`;
}

function palaceCardsHtml(chart: NonNullable<typeof state.chart>): string {
  const sihuaByStar = new Map<string, string[]>();
  for (const tr of chart.chart.transformations) {
    if (tr.sourceScope !== 'natal') continue;
    const arr = sihuaByStar.get(tr.targetStarId) ?? [];
    arr.push(SIHUA_MARK[tr.type]);
    sihuaByStar.set(tr.targetStarId, arr);
  }
  return `
  <h2>十二宮</h2>
  <div class="palace-cards">
    ${chart.chart.palaces.map(p => `
      <div class="palace-card ${p.isLifePalace ? 'is-life' : ''}">
        <div class="ph">
          <span class="name">${t(p.name)}${p.isBodyPalace ? '·身' : ''}</span>
          <span class="sub small">${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]}${p.majorPeriod ? ` · ${p.majorPeriod.fromAge}-${p.majorPeriod.toAge}` : ''}</span>
        </div>
        <div class="stars">
          ${p.stars.map((s: StarPlacement) => {
            const cls = s.star.category === 'major' ? 'major' : s.star.category === 'malefic' ? 'malefic' : s.star.category === 'minor' ? 'minor' : '';
            const marks = (sihuaByStar.get(s.starId) ?? []).join('');
            const dignity = s.dignity && s.star.category === 'major' ? `<span class="faint small">${DIGNITY_ZH[s.dignity]}</span>` : '';
            return `<span class="s ${cls}">${t(s.star.name)}${marks ? `<span class="faint">${marks}</span>` : ''}${dignity}</span>`;
          }).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

function interpretationPanel(chart: NonNullable<typeof state.chart>, mode: string): string {
  const sections = renderNarrative(chart, { locale: 'zh-TW' });
  const patterns = chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced' || p.status === 'partial');
  return `
  <div class="card card-pad">
    <h3 style="margin-top:0">解讀</h3>
    ${patterns.length ? `<div style="margin-bottom:10px">${patterns.map(p => `<span class="badge ${p.status === 'broken' ? 'deprecated' : 'canonical'}" title="${p.patternId}">${t(p.name)}</span> `).join('')}</div>` : ''}
    ${sections.length === 0 ? '<p class="sub small">此命盤目前無命中解讀規則。</p>' : ''}
    ${sections.map(s => `
      <div style="margin-bottom:14px">
        <h4 style="margin:0 0 4px;font-size:14px">${s.title}</h4>
        ${s.paragraphs.map(p => `<p class="small sub" style="margin:0 0 6px">${p}</p>`).join('')}
        ${mode === 'expert' ? `<div class="mono small faint">${s.hitRuleIds.join(', ')}</div>` : ''}
      </div>`).join('')}
  </div>
  ${mode === 'expert' ? tracePanel(chart) : ''}`;
}

function tracePanel(chart: NonNullable<typeof state.chart>): string {
  if (!chart.trace) return '';
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">Trace (${chart.trace.entries.length})</h3>
    <pre class="json">${JSON.stringify(chart.trace.entries, null, 1).slice(0, 8000)}</pre>
  </div>`;
}
