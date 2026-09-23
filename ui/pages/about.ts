import { BIBLE_VERSION, SCHEMA_VERSION } from '../../src/index.js';

export function renderAbout(): string {
  return `
  <h1>關於 ZiWeiJS</h1>
  <div class="card card-pad" style="max-width:820px">
    <p><strong>ZiWeiJS is not merely a fortune-telling application.</strong><br/>
    It is a machine-readable, traceable and testable Zi Wei Dou Shu reference repository and reference engine.</p>
    <p>ZiWeiJS 不只是算命工具 — 它是給未來 ZiWei.NET、ZiWeiPython、心齋圓與第三方紫微工具共同引用的<b>規則與驗證基準</b>。</p>

    <h3>設計原則</h3>
    <ul class="small">
      <li>不知道就標示不知道（certainty model：certain → unknown / variant-dependent）</li>
      <li>有爭議就保存差異（canonical / variant / research / candidate / deprecated / undetermined）</li>
      <li>有來源就能追（Source tier 1–6 + Evidence supports/conflicts/mentions/variant-only）</li>
      <li>有規則就能測（unit / golden / boundary / differential / regression）</li>
      <li>有結果就能重現（deterministic engine，無 AI 參與排盤）</li>
      <li>AI 只能參與 Narrative 層，不得改寫底層規則</li>
    </ul>

    <h3>版本</h3>
    <dl class="kv">
      <dt>version</dt><dd class="mono">${BIBLE_VERSION}</dd>
      <dt>schemaVersion</dt><dd class="mono">${SCHEMA_VERSION}</dd>
      <dt>License</dt><dd>原始碼公開 · 個人/研究/學術/非商用使用 · 商用需告知 Owner（見 LICENSE-DRAFT.md / COMMERCIAL_USE.md）</dd>
    </dl>

    <h3>Privacy</h3>
    <p class="small sub">核心與官方 UI 為 local-only：出生資料不會自動送往任何伺服器、不做 telemetry、不寫入外部 log。AI / 雲端功能必須由上層明確啟用。</p>
  </div>`;
}
