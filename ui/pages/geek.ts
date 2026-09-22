import { state } from '../app/state.js';
import { birthFormHtml } from '../components/birth-form.js';
import { STEM_ZH, BRANCH_ZH, t, toContext, DIGNITY_ZH, PALACE_NAME } from '../../src/index.js';

export function renderGeek(): string {
  const chart = state.chart;
  if (!chart) {
    return `<h1>Geek Test</h1><p class="sub">輸入任意出生資料，檢視引擎所有中間值與 Rule Trace。</p>${birthFormHtml()}`;
  }
  const c = chart.calendar;
  const gz = (p: { stem: keyof typeof STEM_ZH; branch: keyof typeof BRANCH_ZH }) => `${STEM_ZH[p.stem]}${BRANCH_ZH[p.branch]} (${p.stem}-${p.branch})`;

  return `
  <h1>Geek Test</h1>
  <div class="grid" style="grid-template-columns:280px 1fr;gap:18px;align-items:start">
    <div>${birthFormHtml(true)}</div>
    <div>
      <div class="card card-pad">
        <h3 style="margin-top:0">正規化輸入</h3>
        <dl class="kv small">
          <dt>國曆</dt><dd>${c.solar.year}-${c.solar.month}-${c.solar.day}</dd>
          <dt>農曆</dt><dd>${c.lunar.year}年${c.lunar.isLeapMonth ? '閏' : ''}${c.lunar.month}月${c.lunar.day}日</dd>
          <dt>時支</dt><dd>${BRANCH_ZH[c.hourBranch]} (${c.hourBranch})</dd>
          <dt>時區</dt><dd>${c.timezone} (UTC${c.utcOffsetMinutes >= 0 ? '+' : ''}${(c.utcOffsetMinutes / 60).toFixed(1)})</dd>
          <dt>時間制</dt><dd>${c.timeConvention}${c.trueSolarOffsetMinutes !== undefined ? ` · 真太陽時差 ${c.trueSolarOffsetMinutes}min` : ''}</dd>
          <dt>換日</dt><dd>${c.dayBoundary}</dd>
          ${c.solarTerm ? `<dt>節氣</dt><dd>${c.solarTerm}</dd>` : ''}
        </dl>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <h3 style="margin-top:0">四柱干支</h3>
        <dl class="kv small">
          <dt>年</dt><dd class="mono">${gz(c.ganzhi.year)}</dd>
          <dt>月</dt><dd class="mono">${gz(c.ganzhi.month)}</dd>
          <dt>日</dt><dd class="mono">${gz(c.ganzhi.day)}</dd>
          <dt>時</dt><dd class="mono">${gz(c.ganzhi.hour)}</dd>
        </dl>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <h3 style="margin-top:0">命盤關鍵值</h3>
        <dl class="kv small">
          <dt>命宮</dt><dd>${t(PALACE_NAME[chart.chart.natal.lifePalace])} · ${chart.chart.natal.lifePalaceBranch}</dd>
          <dt>身宮</dt><dd>${t(PALACE_NAME[chart.chart.natal.bodyPalace])} · ${chart.chart.natal.bodyPalaceBranch}</dd>
          <dt>五行局</dt><dd>${t(chart.birthContext.bureauName)}</dd>
          <dt>陰陽 / 方向</dt><dd>${chart.birthContext.yinYang} / ${chart.birthContext.direction}</dd>
          <dt>命主 / 身主</dt><dd class="mono">${chart.chart.natal.masterStar ?? '—'} / ${chart.chart.natal.bodyStar ?? '—'}</dd>
        </dl>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <h3 style="margin-top:0">每顆星定位原因（Rule Trace）</h3>
        <table class="data small">
          <thead><tr><th>星曜</th><th>宮位/地支</th><th>廟旺</th><th>Rule ID</th></tr></thead>
          <tbody>
            ${chart.chart.palaces.flatMap(p => p.stars.map(s => `<tr>
              <td>${t(s.star.name)}</td>
              <td class="mono">${t(p.name)} ${s.branch}</td>
              <td>${s.dignity ? DIGNITY_ZH[s.dignity] : ''}</td>
              <td class="mono">${s.ruleId}</td>
            </tr>`)).join('')}
          </tbody>
        </table>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <h3 style="margin-top:0">Chart JSON</h3>
        <pre class="json">${escapeHtml(JSON.stringify(chart, null, 1).slice(0, 20000))}${JSON.stringify(chart).length > 20000 ? '\n…(truncated)' : ''}</pre>
        <button class="btn sm" data-chart-action="export-json">下載完整 JSON</button>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <h3 style="margin-top:0">AI Context</h3>
        <pre class="json">${escapeHtml(JSON.stringify(toContext(chart), null, 1).slice(0, 12000))}</pre>
      </div>
    </div>
  </div>
  <style>@media(max-width:900px){.grid[style*="280px"]{grid-template-columns:1fr !important}}</style>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
