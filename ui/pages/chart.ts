import { state } from '../app/state.js';
import { birthFormHtml } from '../components/birth-form.js';
import {
  renderChartSvg, t, STEM_ZH, BRANCH_ZH, DIGNITY_ZH, renderNarrative,
  PALACE_NAME, ZiWei, listResearch, handoff, toMarkdown, toJson
} from '../../src/index.js';
import type { StarPlacement, PalaceId, ZiWeiChart } from '../../src/index.js';

const SIHUA_MARK: Record<string, string> = { lu: '祿', quan: '權', ke: '科', ji: '忌' };

let selectedPalaceId: PalaceId | null = null;
let activeLayers: Set<string> = new Set(['natal-stars', 'transformations', 'dignity', 'relations', 'dynamic-stars', 'patterns']);

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
    locale: state.locale,
    cellSize: mode === 'expert' ? 240 : 210
  });

  return `
  <!-- Workspace Header (spec 0.71 §76) -->
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    <h1 style="margin:0">命盤</h1>
    <div class="seg" role="group" aria-label="檢視模式">
      <button data-mode="standard" aria-pressed="${mode === 'standard' ? 'true' : 'false'}" class="${mode === 'standard' ? 'active' : ''}">Standard</button>
      <button data-mode="expert" aria-pressed="${mode === 'expert' ? 'true' : 'false'}" class="${mode === 'expert' ? 'active' : ''}">Expert</button>
    </div>

    <!-- AI Handoff CTA (spec 0.71 §41 / §76) -->
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn sm primary" data-ai-handoff="dialog">複製給 AI</button>

      <!-- 匯出下拉選單 -->
      <details class="dropdown" style="display:inline-block">
        <summary class="btn sm">匯出 ▼</summary>
        <div class="card card-pad menu" style="position:absolute;z-index:20;min-width:160px;margin-top:4px">
          <button class="menu-item" data-chart-action="export-svg">SVG</button>
          <button class="menu-item" data-chart-action="export-png">PNG</button>
          <button class="menu-item" data-chart-action="export-json">命盤 JSON</button>
          <hr style="margin:4px 0" />
          <button class="menu-item" data-ai-handoff="download-md">AI Markdown</button>
          <button class="menu-item" data-ai-handoff="download-json">AI JSON</button>
        </div>
      </details>
      <button class="btn sm" data-chart-action="print">列印</button>
    </div>
  </div>

  <!-- Chart Toolbar / Layer Filters (spec 0.71 §24–§25) -->
  <div class="card card-pad" style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 12px">
    <span class="small faint">圖層：</span>
    <label class="small check-label"><input type="checkbox" data-layer-filter="natal-stars" ${activeLayers.has('natal-stars') ? 'checked' : ''}/> 星曜</label>
    <label class="small check-label"><input type="checkbox" data-layer-filter="transformations" ${activeLayers.has('transformations') ? 'checked' : ''}/> 四化</label>
    <label class="small check-label"><input type="checkbox" data-layer-filter="dignity" ${activeLayers.has('dignity') ? 'checked' : ''}/> 廟旺</label>
    <label class="small check-label"><input type="checkbox" data-layer-filter="relations" ${activeLayers.has('relations') ? 'checked' : ''}/> 三方四正</label>
    <label class="small check-label"><input type="checkbox" data-layer-filter="dynamic-stars" ${activeLayers.has('dynamic-stars') ? 'checked' : ''}/> 流曜</label>
    <label class="small check-label"><input type="checkbox" data-layer-filter="patterns" ${activeLayers.has('patterns') ? 'checked' : ''}/> 格局</label>
  </div>

  <div class="chart-page-layout">
    <aside>
      ${birthFormHtml(true)}
      ${expertMeta(chart, mode)}
    </aside>

    <div class="chart-col">
      <div class="chart-wrap card" id="main-svg-container">${svg}</div>
      ${palaceCardsHtml(chart)}
      ${periodPanel(chart)}
    </div>

    <!-- Bible Inspector (spec 0.71 §27–§30) -->
    <aside class="right-col">
      ${bibleInspector(chart, mode)}
    </aside>
  </div>

  <!-- AI Handoff Dialog Modal (spec 0.71 §61) -->
  <div id="ai-handoff-dialog-container" hidden></div>`;
}

/** Bible Inspector（spec 0.71 §27）：解讀、規則、星曜、來源、Trace、Research */
function bibleInspector(chart: ZiWeiChart, mode: string): string {
  const selectedPalace = selectedPalaceId
    ? chart.chart.palaces.find(p => p.id === selectedPalaceId)
    : null;

  return `
  <div class="card card-pad bible-inspector">
    <h3 style="margin-top:0">Bible Inspector</h3>
    ${selectedPalace ? `
      <div class="callout" style="margin-bottom:12px">
        <strong>${t(selectedPalace.name)}（${BRANCH_ZH[selectedPalace.branch]}）</strong>
        <div class="small faint">選定宮位，點擊下方分頁檢視其歸屬 Rules 與文獻。</div>
      </div>` : ''}

    <div class="inspector-tabs" role="tablist">
      <button class="tab-btn active" data-inspector-tab="interp" role="tab">解讀</button>
      <button class="tab-btn" data-inspector-tab="rules" role="tab">規則</button>
      <button class="tab-btn" data-inspector-tab="stars" role="tab">星曜</button>
      <button class="tab-btn" data-inspector-tab="sources" role="tab">來源</button>
      ${mode === 'expert' ? `<button class="tab-btn" data-inspector-tab="trace" role="tab">Trace</button>` : ''}
    </div>

    <div class="inspector-panel" data-panel="interp">
      ${interpretationPanel(chart, mode)}
    </div>
    <div class="inspector-panel" data-panel="rules" hidden>
      ${ruleInspector(chart)}
    </div>
    <div class="inspector-panel" data-panel="stars" hidden>
      ${starInspector(chart)}
    </div>
    <div class="inspector-panel" data-panel="sources" hidden>
      ${sourceInspector(chart)}
    </div>
    ${mode === 'expert' ? `
    <div class="inspector-panel" data-panel="trace" hidden>
      ${tracePanel(chart)}
    </div>` : ''}
  </div>
  ${sharePanel(chart)}`;
}

/** Rule Inspector（spec 0.71 §28） */
function ruleInspector(chart: ZiWeiChart): string {
  const hitRuleIds = new Set<string>([
    ...chart.interpretation.hits.map(h => h.ruleId),
    ...chart.chart.patterns.map(p => p.ruleId)
  ]);
  const rules = ZiWei.Bible.rules().filter(r => hitRuleIds.has(r.ruleId));

  return `
  <div style="margin-top:10px">
    <div class="small faint" style="margin-bottom:8px">此命盤命中 ${rules.length} 條規則：</div>
    <ul class="clean-list small">
      ${rules.map(r => `
        <li style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:6px">
            <strong>${t(r.name)}</strong>
            <span class="badge ${r.status}">${r.status}</span>
          </div>
          <div class="mono faint">${r.ruleId} (v${r.ruleVersion})</div>
          ${r.description ? `<div class="sub" style="margin:2px 0">${t(r.description)}</div>` : ''}
          <div class="faint">來源：${(r.sourceRefs ?? []).join(', ') || '無'}</div>
        </li>`).join('')}
    </ul>
  </div>`;
}

/** Star Inspector（spec 0.71 §27） */
function starInspector(chart: ZiWeiChart): string {
  const placed = Object.values(chart.chart.stars);
  return `
  <div style="margin-top:10px">
    <div class="small faint" style="margin-bottom:8px">盤上 ${placed.length} 顆星曜明細：</div>
    <div class="table-scroll" style="max-height:360px">
      <table class="data small">
        <thead><tr><th>星曜</th><th>落宮</th><th>狀態</th><th>Rule</th></tr></thead>
        <tbody>
          ${placed.map(p => `
            <tr>
              <td><strong>${t(p.star.name)}</strong></td>
              <td>${BRANCH_ZH[p.branch]}</td>
              <td><span class="badge ${p.star.status}">${p.star.status}</span></td>
              <td class="mono faint">${p.ruleId ?? ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/** Source Inspector（spec 0.71 §29） */
function sourceInspector(chart: ZiWeiChart): string {
  const sources = ZiWei.Bible.sources();
  return `
  <div style="margin-top:10px">
    <div class="small faint" style="margin-bottom:8px">文獻依據庫 (${sources.length} 部)：</div>
    <ul class="clean-list small">
      ${sources.slice(0, 8).map(s => `
        <li style="margin-bottom:8px">
          <div><strong>${s.title}</strong> <span class="badge canonical">Tier ${s.tier}</span></div>
          <div class="faint mono">${s.sourceId}${s.era ? ` · ${s.era}` : ''}</div>
        </li>`).join('')}
    </ul>
  </div>`;
}

/** 限運面板 */
function periodPanel(chart: NonNullable<typeof state.chart>): string {
  const major = chart.periods.active?.major;
  const year = chart.periods.year;
  const xiaoxian = chart.periods.xiaoxian;
  if (!year && !xiaoxian) {
    return `
    <div class="card card-pad" style="margin-top:12px">
      <h3 style="margin-top:0">限運</h3>
      <p class="sub small" style="margin:0">於左側「查流年」填入西元年，即可疊算大限／流年／小限與 12 年時間軸。</p>
    </div>`;
  }
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">限運${state.targetYear ? `（${state.targetYear}）` : ''}</h3>
    <dl class="kv small">
      ${major ? `<dt>大限</dt><dd>${major.fromAge}-${major.toAge} 歲 · ${STEM_ZH[major.stem]}${BRANCH_ZH[major.branch]}</dd>` : '<dt>大限</dt><dd class="faint">未上運或性別未知</dd>'}
      ${year ? `<dt>流年</dt><dd>${STEM_ZH[year.stem]}${BRANCH_ZH[year.branch]}${year.resolvedYear && year.resolvedYear !== year.year ? `（年柱所屬 ${year.resolvedYear}）` : ''}</dd>` : ''}
      ${xiaoxian ? `<dt>小限</dt><dd>${xiaoxian.age} 歲 · ${PALACE_NAME[xiaoxian.palaceId] ? t(PALACE_NAME[xiaoxian.palaceId]) : xiaoxian.palaceId}（${BRANCH_ZH[xiaoxian.branch]}）</dd>` : '<dt>小限</dt><dd class="faint">無（未提供目標日期或性別未知）</dd>'}
    </dl>
    ${dynamicStarsPanel(chart)}
    ${timelineTable(chart)}
  </div>`;
}

function dynamicStarsPanel(chart: NonNullable<typeof state.chart>): string {
  const all = chart.periods.dynamicStars ?? [];
  if (all.length === 0) {
    return `<p class="sub small" style="margin:10px 0 0">動態流曜：需開啟 Experimental 且給定目標年份。</p>`;
  }
  const mode = state.mode;
  const selected = 'year';
  const rows = all.filter(d => d.scope === selected);
  const labelOf = (starId: string) => {
    const star = chart.chart.stars[starId];
    return `流${star ? t(star.star.name) : starId}`;
  };
  return `
  <h4 style="margin:14px 0 6px;font-size:14px">動態流曜 <span class="badge candidate">Candidate</span></h4>
  <div class="table-scroll">
    <table class="data small">
      <thead><tr><th>流曜</th><th>宮位</th>${mode === 'expert' ? '<th>基準星 / scope</th><th>Rule</th>' : ''}</tr></thead>
      <tbody>
        ${rows.map(d => {
          const palace = chart.chart.palaces.find(p => p.id === d.palaceId);
          return `<tr>
            <td>${labelOf(d.baseStarId)}</td>
            <td>${palace ? `${t(palace.name)}（${BRANCH_ZH[d.branch]}）` : BRANCH_ZH[d.branch]}</td>
            ${mode === 'expert' ? `<td class="mono faint">${d.baseStarId} · ${d.scope}</td><td class="mono faint">${d.provenance?.ruleId ?? ''}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  <p class="faint small" style="margin:6px 0 0">資料層為基準星 + scope；動態流曜規則 status=candidate，不混入 canonical facts。</p>`;
}

function timelineTable(chart: NonNullable<typeof state.chart>): string {
  if (!state.targetYear) return '';
  const points = ZiWei.Product.trend(chart, {
    fromYear: state.targetYear,
    toYear: state.targetYear + 11
  });
  return `
  <h4 style="margin:14px 0 6px;font-size:14px">12 年時間軸</h4>
  <div class="table-scroll">
    <table class="data small">
      <thead><tr><th>年</th><th>虛歲</th><th>大限</th><th>流年</th><th>小限</th></tr></thead>
      <tbody>
        ${points.map(p => `<tr>
          <td class="mono">${p.year}</td>
          <td>${p.age ?? ''}</td>
          <td class="mono">${p.major ? `${p.major.fromAge}-${p.major.toAge}` : ''}</td>
          <td>${p.yearPeriod ? `${STEM_ZH[p.yearPeriod.stem]}${BRANCH_ZH[p.yearPeriod.branch]}` : ''}</td>
          <td>${p.xiaoxian ? `${BRANCH_ZH[p.xiaoxian.branch]}` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function sharePanel(chart: NonNullable<typeof state.chart>): string {
  const payload = ZiWei.Product.sharePayload(chart);
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">分享</h3>
    <p class="small sub" style="margin:0 0 6px">指紋 <span class="mono">${payload.fingerprint}</span></p>
    <details>
      <summary class="small">分享資料（不含出生資料）</summary>
      <pre tabindex="0" class="json">${JSON.stringify(payload, null, 1)}</pre>
    </details>
  </div>`;
}

function expertMeta(chart: NonNullable<typeof state.chart>, mode: string): string {
  if (mode !== 'expert') return '';
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">Engine</h3>
    <dl class="kv small">
      <dt>version</dt><dd class="mono">${chart.generatedWith.bibleVersion}</dd>
      <dt>schema</dt><dd class="mono">${chart.schemaVersion}</dd>
      <dt>profile</dt><dd class="mono">${chart.generatedWith.profile}</dd>
      <dt>rules hit</dt><dd>${chart.interpretation.hits.length + chart.chart.patterns.length}</dd>
      <dt>trace</dt><dd>${chart.trace?.entries.length ?? 0} entries</dd>
    </dl>
  </div>
  ${profileDiffPanel(chart)}
  ${researchVisibilityPanel()}`;
}

function profileDiffPanel(chart: NonNullable<typeof state.chart>): string {
  const explanation = ZiWei.Profiles.explain(chart.generatedWith.profile);
  if (explanation.diffs.length === 0) {
    return `
    <div class="card card-pad" style="margin-top:12px">
      <h3 style="margin-top:0">Profile 差異</h3>
      <p class="sub small" style="margin:0">此 profile 與 canonical 無規則差異。</p>
    </div>`;
  }
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">Profile 差異（相對 canonical）</h3>
    ${explanation.diffs.map(d => `
      <div class="small" style="margin-bottom:10px">
        <div><strong>${d.dimension}</strong></div>
        <div class="mono faint">canonical: ${d.canonicalRule}</div>
        <div class="mono faint">variant: ${d.variantRule}</div>
        ${d.description ? `<p class="sub" style="margin:4px 0">${d.description}</p>` : ''}
      </div>`).join('')}
  </div>`;
}

function researchVisibilityPanel(): string {
  const open = listResearch().filter(r => r.status === 'open');
  if (open.length === 0) return '';
  const shown = open.slice(0, 8);
  return `
  <div class="card card-pad" style="margin-top:12px">
    <h3 style="margin-top:0">Research（未決）</h3>
    <ul class="small" style="margin:0;padding-left:18px">
      ${shown.map(r => `<li><span class="mono faint">${r.researchId}</span> ${r.title ?? ''}</li>`).join('')}
    </ul>
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
      <div class="palace-card ${p.isLifePalace ? 'is-life' : ''}" data-palace-card="${p.id}">
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
  const sections = renderNarrative(chart, { locale: state.locale });
  const patterns = chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced' || p.status === 'partial');
  return `
  <div>
    ${patterns.length ? `<div style="margin-bottom:10px">${patterns.map(p => `<span class="badge ${p.status === 'broken' ? 'deprecated' : 'canonical'}" title="${p.patternId}">${t(p.name)}</span> `).join('')}</div>` : ''}
    ${sections.length === 0 ? '<p class="sub small">此命盤目前無命中解讀規則。</p>' : ''}
    ${sections.map(s => `
      <div style="margin-bottom:14px">
        <h4 style="margin:0 0 4px;font-size:14px">${s.title}</h4>
        ${s.paragraphs.map(p => `<p class="small sub" style="margin:0 0 6px">${p}</p>`).join('')}
        ${mode === 'expert' ? `<div class="mono small faint">${s.hitRuleIds.join(', ')}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function tracePanel(chart: NonNullable<typeof state.chart>): string {
  if (!chart.trace) return '';
  return `
  <div style="margin-top:10px">
    <div class="small faint" style="margin-bottom:6px">Trace (${chart.trace.entries.length} entries)：</div>
    <pre tabindex="0" class="json" style="max-height:360px">${JSON.stringify(chart.trace.entries, null, 1).slice(0, 8000)}</pre>
  </div>`;
}

export function bindChartInteractions(root: HTMLElement = document.body): void {
  // 宮位點擊 → 切換 Bible Inspector
  root.querySelectorAll('[data-palace-card]').forEach(card => {
    card.addEventListener('click', () => {
      const pid = (card as HTMLElement).dataset.palaceCard as PalaceId;
      selectedPalaceId = pid;
      root.querySelectorAll('[data-palace-card]').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Bible Inspector Tabs 切換
  root.querySelectorAll('[data-inspector-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.inspectorTab;
      root.querySelectorAll('[data-inspector-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach(p => {
        (p as HTMLElement).hidden = (p as HTMLElement).dataset.panel !== tabName;
      });
    });
  });

  // AI Handoff Dialog 開啟
  root.querySelectorAll('[data-ai-handoff="dialog"]').forEach(btn => {
    btn.addEventListener('click', () => openAiHandoffDialog());
  });

  // AI 下載直接操作
  root.querySelector('[data-ai-handoff="download-md"]')?.addEventListener('click', () => {
    if (!state.chart) return;
    const pkg = handoff(state.chart, { mode: 'compact', privacy: 'interpretation' });
    const md = toMarkdown(pkg);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ziwei-chart-ai-${pkg.fingerprint}.md`;
    a.click();
  });

  root.querySelector('[data-ai-handoff="download-json"]')?.addEventListener('click', () => {
    if (!state.chart) return;
    const pkg = handoff(state.chart, { mode: 'compact', privacy: 'interpretation' });
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ziwei-chart-ai-${pkg.fingerprint}.json`;
    a.click();
  });
}

/** 前端 Privacy UI 對話框（spec 0.71 §61） */
function openAiHandoffDialog(): void {
  if (!state.chart) return;
  const container = document.getElementById('ai-handoff-dialog-container');
  if (!container) return;

  container.innerHTML = `
  <div class="modal-backdrop" id="ai-modal-backdrop">
    <div class="modal card card-pad" style="max-width:440px;width:90%">
      <h3 style="margin-top:0">複製給 AI</h3>
      <p class="small sub">將命盤結構化資料與解讀契約提供給外部 AI（ChatGPT、Claude 等），免重排盤。</p>
      
      <div style="margin-bottom:12px">
        <label class="small"><strong>資料量</strong></label>
        <div>
          <label><input type="radio" name="ai-mode" value="compact" checked /> 精簡（適合一般對話）</label><br>
          <label><input type="radio" name="ai-mode" value="full" /> 完整（含 Sources / Evidence / 完整落盤）</label>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <label class="small"><strong>隱私</strong></label>
        <div>
          <label><input type="radio" name="ai-privacy" value="interpretation" checked /> 解盤需要資料（不含姓名與坐標）</label><br>
          <label><input type="radio" name="ai-privacy" value="minimal" /> 最少資料（不含出生日期）</label><br>
          <label><input type="radio" name="ai-privacy" value="full" /> 完整原始資料（含姓名）</label>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label class="small"><strong>格式</strong></label>
        <div>
          <label><input type="radio" name="ai-format" value="markdown" checked /> Markdown</label><br>
          <label><input type="radio" name="ai-format" value="json" /> JSON</label>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn sm" id="ai-dialog-close">取消</button>
        <button class="btn sm primary" id="ai-dialog-copy">複製到剪貼簿</button>
      </div>
    </div>
  </div>`;
  container.hidden = false;

  document.getElementById('ai-dialog-close')?.addEventListener('click', () => {
    container.hidden = true;
  });

  document.getElementById('ai-dialog-copy')?.addEventListener('click', async () => {
    const mode = (document.querySelector('input[name="ai-mode"]:checked') as HTMLInputElement)?.value as 'compact' | 'full';
    const privacy = (document.querySelector('input[name="ai-privacy"]:checked') as HTMLInputElement)?.value as 'minimal' | 'interpretation' | 'full';
    const format = (document.querySelector('input[name="ai-format"]:checked') as HTMLInputElement)?.value as 'markdown' | 'json';

    const pkg = handoff(state.chart!, { mode, privacy });
    const content = format === 'json' ? JSON.stringify(pkg, null, 2) : toMarkdown(pkg);

    try {
      await navigator.clipboard.writeText(content);
      alert('已複製到剪貼簿！可直接貼給 AI。');
      container.hidden = true;
    } catch {
      // clipboard fallback（spec 0.71 §66）
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('已透過相容方式複製！');
      container.hidden = true;
    }
  });
}
