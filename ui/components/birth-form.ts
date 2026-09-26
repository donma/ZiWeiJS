import { state } from '../app/state.js';
import { listProfiles, t, BRANCH_ZH } from '../../src/index.js';
import type { BranchId, BirthTimePrecision } from '../../src/index.js';

const HOUR_BRANCHES: BranchId[] = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const HOUR_LABELS: Record<BranchId, string> = {
  zi: '子時 23:00–00:59', chou: '丑時 01:00–02:59', yin: '寅時 03:00–04:59',
  mao: '卯時 05:00–06:59', chen: '辰時 07:00–08:59', si: '巳時 09:00–10:59',
  wu: '午時 11:00–12:59', wei: '未時 13:00–14:59', shen: '申時 15:00–16:59',
  you: '酉時 17:00–18:59', xu: '戌時 19:00–20:59', hai: '亥時 21:00–22:59'
};

function precisionOf(i: typeof state.input): BirthTimePrecision {
  if (i.timePrecision) return i.timePrecision;
  if (i.time?.hour !== undefined) return 'exact';
  return 'unknown';
}

export function birthFormHtml(compact = false): string {
  const i = state.input;
  const profiles = listProfiles();
  const precision = precisionOf(i);
  const isUnknown = precision === 'unknown';

  return `
  <form data-form="birth" class="card card-pad">
    <input type="hidden" name="timePrecision" value="${precision}" />
    <input type="hidden" name="hourBranch" value="${i.hourBranch ?? ''}" />

    <!-- 出生資料 -->
    <fieldset class="form-section">
      <legend>出生資料</legend>
      <div class="grid ${compact ? '' : 'grid-2'}" style="gap:12px">
        <label class="field">曆法
          <select name="calendarType">
            <option value="solar" ${i.calendarType === 'solar' ? 'selected' : ''}>國曆（陽曆）</option>
            <option value="lunar" ${i.calendarType === 'lunar' ? 'selected' : ''}>農曆（陰曆）</option>
          </select>
        </label>
        <label class="field">姓名（選填，僅展示用）
          <input type="text" name="name" value="${i.name ?? ''}" placeholder="不影響排盤" />
        </label>
        <label class="field">年
          <input type="number" name="year" value="${i.date.year}" min="1900" max="2100" required />
        </label>
        <label class="field">月
          <input type="number" name="month" value="${i.date.month}" min="1" max="12" required />
        </label>
        <label class="field">日
          <input type="number" name="day" value="${i.date.day}" min="1" max="31" required />
        </label>
        ${i.calendarType === 'lunar' ? `<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="isLeapMonth" ${i.date.isLeapMonth ? 'checked' : ''}/> 閏月</label>` : ''}
      </div>
    </fieldset>

    <!-- 出生時間：4 模式 segmented control（spec 0.71 §15–§16） -->
    <fieldset class="form-section">
      <legend>出生時間</legend>
      <div class="seg seg-wrap" role="group" aria-label="出生時間精度">
        <button type="button" class="seg-btn ${precision === 'exact' ? 'active' : ''}" data-time-precision="exact" aria-pressed="${precision === 'exact'}">精確時間</button>
        <button type="button" class="seg-btn ${precision === 'hour-branch' ? 'active' : ''}" data-time-precision="hour-branch" aria-pressed="${precision === 'hour-branch'}">只知道時辰</button>
        <button type="button" class="seg-btn ${precision === 'range' ? 'active' : ''}" data-time-precision="range" aria-pressed="${precision === 'range'}">大概時段</button>
        <button type="button" class="seg-btn ${precision === 'unknown' ? 'active' : ''}" data-time-precision="unknown" aria-pressed="${precision === 'unknown'}">不知道</button>
      </div>

      <div data-precision-panel="exact" ${precision !== 'exact' ? 'hidden' : ''} style="margin-top:10px">
        <div class="grid grid-3" style="gap:8px">
          <label class="field">時
            <input type="number" name="hour" value="${i.time?.hour ?? ''}" min="0" max="23" placeholder="0–23" />
          </label>
          <label class="field">分
            <input type="number" name="minute" value="${i.time?.minute ?? 0}" min="0" max="59" />
          </label>
          <label class="field">秒（選填）
            <input type="number" name="second" value="${i.time?.second ?? ''}" min="0" max="59" />
          </label>
        </div>
      </div>

      <div data-precision-panel="hour-branch" ${precision !== 'hour-branch' ? 'hidden' : ''} style="margin-top:10px">
        <div class="hour-cards" role="listbox" aria-label="十二時辰">
          ${HOUR_BRANCHES.map(b => `
            <button type="button" class="hour-card ${i.hourBranch === b ? 'selected' : ''}"
              data-hour-branch="${b}" role="option"
              aria-selected="${i.hourBranch === b}"
              aria-label="${HOUR_LABELS[b]}">
              <span class="hb">${BRANCH_ZH[b]}時</span>
              <span class="range">${HOUR_LABELS[b].split(' ')[1]}</span>
            </button>`).join('')}
        </div>
        <p class="faint small" style="margin:8px 0 0">僅知道時辰時，內部使用代表時間計算；不會寫成真實出生分鐘。${state.profile !== 'canonical' ? '（目前 profile 換日政策：' + state.profile + '）' : ''}</p>
      </div>

      <div data-precision-panel="range" ${precision !== 'range' ? 'hidden' : ''} style="margin-top:10px">
        <div class="grid grid-2" style="gap:8px">
          <label class="field">從
            <input type="number" name="rangeFrom" value="${i.timeRange?.fromHour ?? 9}" min="0" max="23" />
          </label>
          <label class="field">到
            <input type="number" name="rangeTo" value="${i.timeRange?.toHour ?? 17}" min="0" max="23" />
          </label>
        </div>
        <p class="faint small" style="margin:8px 0 0">時段內所有可能時辰將作為候選分析。</p>
      </div>

      <div data-precision-panel="unknown" ${precision !== 'unknown' ? 'hidden' : ''} style="margin-top:10px">
        <p class="small sub" style="margin:0">完全不知道出生時辰 — 將比較 12 個時辰候選，並列出「不論哪個時辰都穩定」的結構。</p>
      </div>
    </fieldset>

    <!-- 基本設定 -->
    <fieldset class="form-section">
      <legend>基本設定</legend>
      <div class="grid ${compact ? '' : 'grid-2'}" style="gap:12px">
        <label class="field">性別（演算法用）
          <select name="sex">
            <option value="male" ${i.sexForCalculation === 'male' ? 'selected' : ''}>男</option>
            <option value="female" ${i.sexForCalculation === 'female' ? 'selected' : ''}>女</option>
          </select>
        </label>
        <label class="field">Profile
          <select name="profile">
            ${profiles.map(p => `<option value="${p.profileId}" ${state.profile === p.profileId ? 'selected' : ''}>${t(p.name)}</option>`).join('')}
          </select>
        </label>
      </div>
    </fieldset>

    <!-- 進階設定（Expert 才展開） -->
    ${!compact ? `
    <details class="form-section" ${state.mode === 'expert' ? 'open' : ''}>
      <summary><strong>進階設定</strong></summary>
      <div class="grid grid-2" style="gap:12px;margin-top:10px">
        <label class="field">時區（IANA）
          <input type="text" name="timezone" value="${i.timezone ?? 'Asia/Taipei'}" list="tz-list" />
          <datalist id="tz-list">
            <option value="Asia/Taipei"></option>
            <option value="Asia/Shanghai"></option>
            <option value="Asia/Hong_Kong"></option>
            <option value="Asia/Tokyo"></option>
            <option value="America/New_York"></option>
            <option value="America/Los_Angeles"></option>
            <option value="Europe/London"></option>
            <option value="Australia/Sydney"></option>
          </datalist>
        </label>
        <label class="field">查流年（西元年，選填）
          <input type="number" name="targetYear" value="${state.targetYear ?? ''}" min="1900" max="2100" placeholder="例 2026" />
        </label>
        <label class="field">經度（真太陽時用，選填）
          <input type="number" step="0.01" name="longitude" value="${i.location?.longitude ?? ''}" placeholder="例 121.56" />
        </label>
        <label class="field">緯度（選填）
          <input type="number" step="0.01" name="latitude" value="${i.location?.latitude ?? ''}" placeholder="例 25.03" />
        </label>
        <label class="field">出生地（選填）
          <input type="text" name="placeName" value="${i.location?.placeName ?? ''}" placeholder="僅展示用" />
        </label>
      </div>
    </details>` : ''}

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      ${isUnknown
        ? `<button type="submit" class="btn primary" data-unknown-cta>比較 12 個時辰</button>`
        : `<button type="submit" class="btn primary">排盤</button>`}
    </div>
  </form>`;
}

/** 綁定 segmented control + hour-card 事件（於 render 後由 main.ts 呼叫） */
export function bindBirthFormInteractions(root: HTMLElement = document.body): void {
  // segmented control 切換 precision
  root.querySelectorAll('[data-time-precision]').forEach(btn => {
    btn.addEventListener('click', () => {
      const precision = (btn as HTMLElement).dataset.timePrecision as BirthTimePrecision;
      const form = btn.closest('form') as HTMLFormElement;
      const hidden = form.querySelector('input[name="timePrecision"]') as HTMLInputElement;
      hidden.value = precision;
      // toggle active class
      form.querySelectorAll('[data-time-precision]').forEach(b => {
        b.classList.toggle('active', (b as HTMLElement).dataset.timePrecision === precision);
        b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.timePrecision === precision));
      });
      // toggle panels
      for (const p of ['exact', 'hour-branch', 'range', 'unknown']) {
        const panel = form.querySelector(`[data-precision-panel="${p}"]`) as HTMLElement;
        if (panel) panel.hidden = p !== precision;
      }
      // 切換按鈕文字（spec 0.71 §16：不知道模式 CTA 為「比較 12 個時辰」）
      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.innerText = precision === 'unknown' ? '比較 12 個時辰' : '排盤';
      }
    });
  });

  // hour-card selection
  root.querySelectorAll('[data-hour-branch]').forEach(card => {
    card.addEventListener('click', () => {
      const branch = (card as HTMLElement).dataset.hourBranch as BranchId;
      const form = card.closest('form') as HTMLFormElement;
      (form.querySelector('input[name="hourBranch"]') as HTMLInputElement).value = branch;
      form.querySelectorAll('[data-hour-branch]').forEach(c => {
        const sel = (c as HTMLElement).dataset.hourBranch === branch;
        c.classList.toggle('selected', sel);
        c.setAttribute('aria-selected', String(sel));
      });
    });
    // Keyboard navigation（spec 0.71 §42 A11y）
    card.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        e.preventDefault();
        (card as HTMLElement).click();
      }
    });
  });
}
