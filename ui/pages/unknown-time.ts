import { state, navigate, recalc } from '../app/state.js';
import {
  analyzeBirthTime, selectCandidate, t, BRANCH_ZH, STEM_ZH,
  handoffUnknownTime, toMarkdown, toJson
} from '../../src/index.js';
import type { BranchId, BirthTimeUncertaintyResult, BirthTimeCandidate } from '../../src/index.js';

let lastResult: BirthTimeUncertaintyResult | null = null;
let selectedForCompare: Set<BranchId> = new Set();

export function renderUnknownTimePage(): string {
  // 執行 12 時辰分析
  const res = analyzeBirthTime({
    ...state.input,
    time: { precision: 'unknown' }
  }, { profile: state.profile });
  lastResult = res;

  const validCandidates = res.candidates.filter(c => c.chart);
  const stableCount = res.stableFacts.length;
  const variableCount = res.variableFacts.length;

  return `
  <div class="unknown-time-workspace">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <h1 style="margin:0">未知時辰分析</h1>
      <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm" data-ut-action="copy-ai">複製候選比較給 AI</button>
        <button class="btn sm" data-ut-action="download-json">下載 AI JSON</button>
        <button class="btn sm" data-ut-action="download-md">下載 AI Markdown</button>
        <a class="btn sm" href="#/chart">返回命盤</a>
      </div>
    </div>

    <!-- 頁首摘要（spec 0.71 §17） -->
    <div class="card card-pad" style="margin-bottom:16px">
      <h3 style="margin-top:0">時辰不確定分析摘要</h3>
      <div class="grid grid-4" style="gap:12px">
        <div class="metric"><span class="k">候選時辰</span><span class="v mono">${res.candidates.length}</span></div>
        <div class="metric"><span class="k">結構分組</span><span class="v mono">${res.groups.length} 組</span></div>
        <div class="metric"><span class="k">穩定結構（不變）</span><span class="v mono">${stableCount} 項</span></div>
        <div class="metric"><span class="k">變動結構</span><span class="v mono">${variableCount} 項</span></div>
      </div>
      <p class="faint small" style="margin:10px 0 0">
        不論哪個時辰都不變的事實最為可靠。勾選 2–3 個候選可並排比較；點擊「選定此時辰」可進入完整命盤。
      </p>
    </div>

    <!-- 候選比較表（spec 0.71 §18） -->
    <div class="card card-pad" style="margin-bottom:16px">
      <h3 style="margin-top:0">十二時辰候選一覽表</h3>
      <div class="table-scroll">
        <table class="data small">
          <thead>
            <tr>
              <th>比較</th>
              <th>時辰</th>
              <th>命宮</th>
              <th>身宮</th>
              <th>五行局</th>
              <th>命主</th>
              <th>身主</th>
              <th>主星摘要</th>
              <th>格局數</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${res.candidates.map(c => renderCandidateRow(c)).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn sm" data-ut-action="compare-selected">並排比較選中的時辰</button>
      </div>
    </div>

    <!-- 並排比較區（spec 0.71 §22） -->
    <div id="side-by-side-compare" style="margin-bottom:16px" hidden></div>

    <!-- 穩定結構專區（spec 0.71 §19） -->
    <div class="card card-pad" style="margin-bottom:16px">
      <h3 style="margin-top:0">不論哪個時辰都不變的事實（Stable Facts）</h3>
      <p class="faint small" style="margin:0 0 10px">這是未知時辰最有價值的資訊，不因出生分鐘改變。</p>
      <dl class="kv small">
        ${res.stableFacts.map(f => `
          <dt>${f.label}</dt>
          <dd><strong>${Object.keys(f.values)[0]}</strong> <span class="faint mono">（12 個時辰全數一致）</span></dd>`).join('')}
      </dl>
    </div>

    <!-- 變動結構（spec 0.71 §20） -->
    <div class="card card-pad" style="margin-bottom:16px">
      <h3 style="margin-top:0">因時辰改變的結構（Variable Facts）</h3>
      <div class="grid grid-2" style="gap:12px">
        ${res.variableFacts.map(f => `
          <div class="small">
            <strong>${f.label}</strong>
            <ul style="margin:4px 0 0;padding-left:18px">
              ${Object.entries(f.values).slice(0, 4).map(([v, branches]) => `
                <li><code>${v}</code>：${branches.map(b => BRANCH_ZH[b]).join('、')}</li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderCandidateRow(c: BirthTimeCandidate): string {
  if (!c.chart) {
    return `<tr>
      <td></td>
      <td><strong>${BRANCH_ZH[c.hourBranch]}時</strong></td>
      <td colspan="7" class="faint">排盤失敗：${c.error?.message ?? ''}</td>
      <td></td>
    </tr>`;
  }
  const natal = c.chart.chart.natal;
  const majorStars = c.chart.chart.palaces.find(p => p.isLifePalace)?.majorStars ?? [];
  const majorsText = majorStars.map(s => t(s.star.name)).join('、') || '（無主星）';
  const patCount = c.chart.chart.patterns.filter(p => p.status === 'complete' || p.status === 'enhanced').length;
  const isChecked = selectedForCompare.has(c.hourBranch);

  return `<tr>
    <td><input type="checkbox" data-compare-branch="${c.hourBranch}" ${isChecked ? 'checked' : ''} /></td>
    <td><strong>${BRANCH_ZH[c.hourBranch]}時</strong><br><span class="faint mono">${c.timeRange.start}–${c.timeRange.end}</span></td>
    <td>${t(c.chart.chart.palaces.find(p => p.isLifePalace)?.name ?? {})}（${BRANCH_ZH[natal.lifePalaceBranch]}）</td>
    <td>${t(c.chart.chart.palaces.find(p => p.isBodyPalace)?.name ?? {})}（${BRANCH_ZH[natal.bodyPalaceBranch]}）</td>
    <td>${t(c.chart.birthContext.bureauName)}</td>
    <td>${natal.masterStar ?? '—'}</td>
    <td>${natal.bodyStar ?? '—'}</td>
    <td>${majorsText}</td>
    <td class="mono">${patCount}</td>
    <td>
      <button class="btn sm" data-select-candidate="${c.hourBranch}">選此時辰</button>
    </td>
  </tr>`;
}

export function bindUnknownTimeInteractions(root: HTMLElement = document.body): void {
  // 勾選比較
  root.querySelectorAll('[data-compare-branch]').forEach(cb => {
    cb.addEventListener('change', () => {
      const branch = (cb as HTMLElement).getAttribute('data-compare-branch') as BranchId;
      if ((cb as HTMLInputElement).checked) {
        if (selectedForCompare.size >= 3) {
          alert('最多勾選 3 個時辰比較');
          (cb as HTMLInputElement).checked = false;
          return;
        }
        selectedForCompare.add(branch);
      } else {
        selectedForCompare.delete(branch);
      }
    });
  });

  // 並排比較按鈕
  root.querySelector('[data-ut-action="compare-selected"]')?.addEventListener('click', () => {
    if (selectedForCompare.size === 0) {
      alert('請先勾選 1–3 個時辰進行比較');
      return;
    }
    const container = document.getElementById('side-by-side-compare');
    if (!container || !lastResult) return;
    const candidates = [...selectedForCompare].map(b => lastResult!.candidates.find(c => c.hourBranch === b)!).filter(Boolean);
    container.innerHTML = `
      <div class="card card-pad">
        <h3 style="margin-top:0">候選時辰並排比較</h3>
        <div class="grid grid-${candidates.length}" style="gap:12px">
          ${candidates.map(c => `
            <div class="card card-pad">
              <h4 style="margin-top:0">${BRANCH_ZH[c.hourBranch]}時 (${c.timeRange.start}–${c.timeRange.end})</h4>
              <dl class="kv small">
                <dt>命宮</dt><dd>${BRANCH_ZH[c.signature.lifePalaceBranch]}</dd>
                <dt>身宮</dt><dd>${BRANCH_ZH[c.signature.bodyPalaceBranch]}</dd>
                <dt>五行局</dt><dd>${c.signature.bureau}</dd>
                <dt>命主</dt><dd>${c.signature.masterStar ?? '—'}</dd>
                <dt>身主</dt><dd>${c.signature.bodyStar ?? '—'}</dd>
                <dt>命中格局</dt><dd class="small">${c.signature.patterns.join('、') || '無'}</dd>
              </dl>
              <button class="btn sm primary" data-select-candidate="${c.hourBranch}" style="margin-top:10px;width:100%">以此時辰排盤</button>
            </div>`).join('')}
        </div>
      </div>`;
    container.hidden = false;
    // re-bind select buttons inside container
    container.querySelectorAll('[data-select-candidate]').forEach(btn => {
      btn.addEventListener('click', () => handleSelect((btn as HTMLElement).dataset.selectCandidate as BranchId));
    });
  });

  // 選擇 Candidate
  root.querySelectorAll('[data-select-candidate]').forEach(btn => {
    btn.addEventListener('click', () => handleSelect((btn as HTMLElement).dataset.selectCandidate as BranchId));
  });

  // AI 匯出操作
  root.querySelector('[data-ut-action="copy-ai"]')?.addEventListener('click', async () => {
    if (!lastResult) return;
    const pkg = handoffUnknownTime(lastResult);
    const text = toMarkdown(pkg);
    try {
      await navigator.clipboard.writeText(text);
      alert('已複製候選比較資料給 AI！');
    } catch {
      alert('複製失敗，請手動下載。');
    }
  });

  root.querySelector('[data-ut-action="download-json"]')?.addEventListener('click', () => {
    if (!lastResult) return;
    const pkg = handoffUnknownTime(lastResult);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ziwei-unknown-time-ai-${pkg.fingerprint}.json`;
    a.click();
  });

  root.querySelector('[data-ut-action="download-md"]')?.addEventListener('click', () => {
    if (!lastResult) return;
    const pkg = handoffUnknownTime(lastResult);
    const md = toMarkdown(pkg);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ziwei-unknown-time-ai-${pkg.fingerprint}.md`;
    a.click();
  });
}

function handleSelect(branch: BranchId): void {
  if (!lastResult) return;
  const chart = selectCandidate(lastResult, branch);
  state.chart = chart;
  state.input = {
    ...state.input,
    timePrecision: 'hour-branch',
    hourBranch: branch,
    birthTimeSource: 'user-selected-candidate'
  };
  navigate('/chart');
}
