import { listSources, listEvidence, listRules } from '../../src/index.js';

const TIER_LABEL: Record<number, string> = {
  1: 'Tier 1 · 古籍/正式文獻',
  2: 'Tier 2 · 傳承/專業著作',
  3: 'Tier 3 · 多系統一致實作',
  4: 'Tier 4 · 專業文章課程',
  5: 'Tier 5 · 社群論壇',
  6: 'Tier 6 · 來源不明'
};

export function renderSources(): string {
  const sources = listSources();
  const evidence = listEvidence();
  const rules = listRules();

  return `
  <h1>Source Explorer</h1>
  <p class="sub">文獻來源與 Evidence 登錄。AI 不得作為 Evidence Source。</p>

  <h2>Sources (${sources.length})</h2>
  <div class="card">
    <table class="data">
      <thead><tr><th>ID</th><th>書名</th><th>作者</th><th>時代</th><th>Tier</th><th>類型</th></tr></thead>
      <tbody>
        ${sources.map(s => `<tr>
          <td class="mono small">${s.sourceId}</td>
          <td>${s.title}</td>
          <td>${s.author ?? '—'}</td>
          <td class="small">${s.era ?? '—'}</td>
          <td><span class="badge">${TIER_LABEL[s.tier] ?? s.tier}</span></td>
          <td class="small">${s.type}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <h2>Evidence (${evidence.length})</h2>
  <div class="card">
    <table class="data">
      <thead><tr><th>ID</th><th>來源</th><th>類型</th><th>位置</th><th>信心</th><th>摘要</th></tr></thead>
      <tbody>
        ${evidence.map(e => `<tr>
          <td class="mono small">${e.evidenceId}</td>
          <td class="mono small">${e.sourceId}</td>
          <td><span class="badge ${e.type === 'supports' ? 'canonical' : e.type === 'conflicts' ? 'deprecated' : 'variant'}">${e.type}</span></td>
          <td class="small">${e.location ?? '—'}</td>
          <td class="small">${e.confidence ?? '—'}</td>
          <td class="small sub">${e.quote ?? e.notes ?? ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <h2>Canonical 覆蓋率</h2>
  <div class="card card-pad">
    <div class="kv">
      <dt>canonical</dt><dd>${rules.filter(r => r.status === 'canonical').length}</dd>
      <dt>variant</dt><dd>${rules.filter(r => r.status === 'variant').length}</dd>
      <dt>candidate</dt><dd>${rules.filter(r => r.status === 'candidate').length}</dd>
      <dt>research</dt><dd>${rules.filter(r => r.status === 'research').length}</dd>
    </div>
  </div>`;
}
