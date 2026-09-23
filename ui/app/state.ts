import type { ZiWeiChart, ZiWeiBirthInput, Locale } from '../../src/index.js';
import { calculateSafe, setLocale } from '../../src/index.js';

export interface AppState {
  chart: ZiWeiChart | null;
  input: ZiWeiBirthInput;
  mode: 'standard' | 'expert';
  theme: 'light' | 'dark';
  locale: Locale;
  profile: string;
  error: string | null;
  route: string;
}

const defaultInput: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1983, month: 5, day: 11 },
  time: { hour: 0, minute: 0 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

export const state: AppState = {
  chart: null,
  input: defaultInput,
  mode: 'standard',
  theme: 'light',
  locale: 'zh-TW',
  profile: 'canonical',
  error: null,
  route: location.hash.replace('#', '') || '/'
};

setLocale(state.locale);

export function setAppLocale(locale: Locale): void {
  state.locale = locale;
  setLocale(locale);
}

export function recalc(): void {
  const res = calculateSafe(state.input, { profile: state.profile, trace: true });
  if (res.ok) {
    state.chart = res.chart;
    state.error = null;
  } else {
    state.chart = null;
    state.error = `[${res.error.code}] ${res.error.message}`;
  }
}

export function navigate(route: string): void {
  if (location.protocol === 'file:') {
    // file:// 視為獨立 origin：location.hash 指派可能被擋、location.href 會整頁重載
    // （重載會清掉 state.chart / input）。改用 history.replaceState 更新 URL
    // 且不觸發 reload；路由更新由呼叫端 route() 處理。
    try {
      history.replaceState(null, '', location.pathname + '#' + route);
    } catch {
      /* ignore */
    }
    return;
  }
  location.hash = route;
}

export function currentRoute(): string {
  return location.hash.replace('#', '') || '/';
}
