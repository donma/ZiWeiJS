import { state } from '../app/state.js';
import { birthFormHtml } from '../components/birth-form.js';
import { t, STEM_ZH, BRANCH_ZH } from '../../src/index.js';

interface CompareRow {
  field: string;
  bible: string;
  external: string;
  status: 'match' | 'diff' | 'empty';
}

export function renderDifferential(): string {
  const chart = state.chart;
  return `
  <h1>Differential Test</h1>
  <p class="sub">將本引擎排盤結果與外部可信來源逐欄比對。差異不直接判錯 — 分類為流派/曆法/時間基準/換日/閏月差異或 Bug。</p>
  ${!chart ? birthFormHtml() : diffBody()}
  `;
}

function diffBody(): string {
  const chart = state.chart!;
  const rows: CompareRow[] = [];

  const fields: Array<[string, (c: typeof chart) => string]> = [
    ['命宮', c => `${c.chart.natal.lifePalaceBranch} (${t(c.chart.palaces.find(p => p.isLifePalace)!.name)})`],
    ['身宮', c => c.chart.natal.bodyPalaceBranch],
    ['五行局', c => t(c.birthContext.bureauName)],
    ['紫微', c => posOf(c, 'ZW.STAR.MAJOR.ZIWEI')],
    ['天機', c => posOf(c, 'ZW.STAR.MAJOR.TIANJI')],
    ['太陽', c => posOf(c, 'ZW.STAR.MAJOR.TAIYANG')],
    ['武曲', c => posOf(c, 'ZW.STAR.MAJOR.WUQU')],
    ['天同', c => posOf(c, 'ZW.STAR.MAJOR.TIANTONG')],
    ['廉貞', c => posOf(c, 'ZW.STAR.MAJOR.LIANZHEN')],
    ['天府', c => posOf(c, 'ZW.STAR.MAJOR.TIANFU')],
    ['太陰', c => posOf(c, 'ZW.STAR.MAJOR.TAIYIN')],
    ['貪狼', c => posOf(c, 'ZW.STAR.MAJOR.TANLANG')],
    ['巨門', c => posOf(c, 'ZW.STAR.MAJOR.JUMEN')],
    ['天相', c => posOf(c, 'ZW.STAR.MAJOR.TIANXIANG')],
    ['天梁', c => posOf(c, 'ZW.STAR.MAJOR.TIANLIANG')],
    ['七殺', c => posOf(c, 'ZW.STAR.MAJOR.QISHA')],
    ['破軍', c => posOf(c, 'ZW.STAR.MAJOR.POJUN')],
    ['左輔', c => posOf(c, 'ZW.STAR.AUX.ZUOFU')],
    ['右弼', c => posOf(c, 'ZW.STAR.AUX.YOUBI')],
    ['文昌', c => posOf(c, 'ZW.STAR.AUX.WENCHANG')],
    ['文曲', c => posOf(c, 'ZW.STAR.AUX.WENQU')],
    ['祿存', c => posOf(c, 'ZW.STAR.AUX.LUCUN')],
    ['擎羊', c => posOf(c, 'ZW.STAR.MALEFIC.QINGYANG')],
    ['陀羅', c => posOf(c, 'ZW.STAR.MALEFIC.TUOLUO')],
    ['火星', c => posOf(c, 'ZW.STAR.AUX.HUOLING')],
    ['鈴星', c => posOf(c, 'ZW.STAR.AUX.LINGXING')],
    ['地空', c => posOf(c, 'ZW.STAR.MALEFIC.DIKONG')],
    ['地劫', c => posOf(c, 'ZW.STAR.MALEFIC.DIJIE')],
    ['天魁', c => posOf(c, 'ZW.STAR.AUX.TIANKUI')],
    ['天鉞', c => posOf(c, 'ZW.STAR.AUX.TIANYUE')],
    ['天馬', c => posOf(c, 'ZW.STAR.AUX.TIANMA')],
    ['化祿', c => sihuaOf(c, 'lu')],
    ['化權', c => sihuaOf(c, 'quan')],
    ['化科', c => sihuaOf(c, 'ke')],
    ['化忌', c => sihuaOf(c, 'ji')]
  ];

  for (const [name, fn] of fields) {
    rows.push({ field: name, bible: fn(chart), external: '', status: 'empty' });
  }

  return `
  <div class="card">
    <div class="table-scroll">
    <table class="data" id="diff-table">
      <thead><tr><th>欄位</th><th>本引擎</th><th>外部來源 A</th><th>外部來源 B</th><th>狀態</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr data-field="${r.field}" data-bible="${r.bible}">
          <td>${r.field}</td>
          <td class="mono">${r.bible}</td>
          <td><input type="text" class="ext-a" placeholder="貼上外部值" style="min-height:30px;padding:4px 8px;font-size:12.5px" /></td>
          <td><input type="text" class="ext-b" placeholder="貼上外部值" style="min-height:30px;padding:4px 8px;font-size:12.5px" /></td>
          <td class="diff-status small">—</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
  </div>
  <p class="small faint" style="margin-top:10px">在各欄貼入外部排盤結果（例：iztro、文墨天機截圖文字），系統即時標示 match / needs-review。</p>
  <button class="btn sm" id="diff-eval">評估差異</button>
  <div id="diff-report" style="margin-top:12px"></div>
  <script type="module">
    document.getElementById('diff-eval').addEventListener('click', () => {
      const report = [];
      document.querySelectorAll('#diff-table tbody tr').forEach(tr => {
        const field = tr.dataset.field;
        const bible = tr.dataset.bible;
        const a = tr.querySelector('.ext-a').value.trim();
        const b = tr.querySelector('.ext-b').value.trim();
        const cell = tr.querySelector('.diff-status');
        if (!a && !b) { cell.textContent = '—'; return; }
        const vals = [a, b].filter(Boolean);
        const allMatch = vals.every(v => v === bible);
        if (allMatch) { cell.innerHTML = '<span class="badge canonical">match</span>'; }
        else {
          cell.innerHTML = '<span class="badge variant">needs-review</span>';
          report.push({ status: 'needs-review', field, bible, sourceA: a, sourceB: b });
        }
      });
      document.getElementById('diff-report').innerHTML = report.length
        ? '<div class="card card-pad"><h3 style="margin-top:0">Needs Review (' + report.length + ')</h3><pre tabindex="0" class="json">' + JSON.stringify(report, null, 2).replace(/</g,'&lt;') + '</pre><p class="small sub">請人工分類：流派差異 / 曆法差異 / 時間基準差異 / 換日差異 / 閏月差異 / Bug / 外部來源錯誤</p></div>'
        : '<p class="sub">沒有需要檢視的差異。</p>';
    });
  </script>`;
}

function posOf(c: NonNullable<typeof state.chart>, starId: string): string {
  return c.chart.stars[starId]?.branch ?? '—';
}

function sihuaOf(c: NonNullable<typeof state.chart>, type: string): string {
  const tr = c.chart.transformations.find(t => t.sourceScope === 'natal' && t.type === type);
  if (!tr) return '—';
  const star = c.chart.stars[tr.targetStarId];
  return star ? `${t(star.star.name)}@${tr.targetPalaceId}` : tr.targetStarId;
}
