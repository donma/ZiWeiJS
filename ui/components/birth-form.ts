import { state } from '../app/state.js';
import { listProfiles, t } from '../../src/index.js';

export function birthFormHtml(compact = false): string {
  const i = state.input;
  const profiles = listProfiles();
  return `
  <form data-form="birth" class="card card-pad">
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
      <label class="field">時（留空＝未知時辰）
        <input type="number" name="hour" value="${i.time?.hour ?? ''}" min="0" max="23" placeholder="未知留空" />
      </label>
      <label class="field">分
        <input type="number" name="minute" value="${i.time?.minute ?? 0}" min="0" max="59" />
      </label>
      <label class="field">性別（演算法用）
        <select name="sex">
          <option value="male" ${i.sexForCalculation === 'male' ? 'selected' : ''}>男</option>
          <option value="female" ${i.sexForCalculation === 'female' ? 'selected' : ''}>女</option>
        </select>
      </label>
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
      <label class="field">Profile
        <select name="profile">
          ${profiles.map(p => `<option value="${p.profileId}" ${state.profile === p.profileId ? 'selected' : ''}>${t(p.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field">經度（真太陽時用，選填）
        <input type="number" step="0.01" name="longitude" value="${i.location?.longitude ?? ''}" placeholder="例 121.56" />
      </label>
      <label class="field">緯度（選填）
        <input type="number" step="0.01" name="latitude" value="${i.location?.latitude ?? ''}" placeholder="例 25.03" />
      </label>
      ${i.calendarType === 'lunar' ? `<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="isLeapMonth" ${i.date.isLeapMonth ? 'checked' : ''}/> 閏月</label>` : ''}
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button type="submit" class="btn primary">排盤</button>
    </div>
  </form>`;
}
