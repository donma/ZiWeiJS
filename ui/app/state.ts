import type { ZiWeiChart, ZiWeiBirthInput } from '../../src/index.js';
import { calculateSafe } from '../../src/index.js';

export interface AppState {
  chart: ZiWeiChart | null;
  input: ZiWeiBirthInput;
  mode: 'standard' | 'expert';
  theme: 'light' | 'dark';
  profile: string;
  error: string | null;
  route: string;
}

const defaultInput: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
};

export const state: AppState = {
  chart: null,
  input: defaultInput,
  mode: 'standard',
  theme: 'light',
  profile: 'canonical',
  error: null,
  route: location.hash.replace('#', '') || '/'
};

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
  location.hash = route;
}

export function currentRoute(): string {
  return location.hash.replace('#', '') || '/';
}
