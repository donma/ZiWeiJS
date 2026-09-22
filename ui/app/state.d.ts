import type { ZiWeiChart, ZiWeiBirthInput } from '../../src/index.js';
export interface AppState {
    chart: ZiWeiChart | null;
    input: ZiWeiBirthInput;
    mode: 'standard' | 'expert';
    theme: 'light' | 'dark';
    profile: string;
    error: string | null;
    route: string;
}
export declare const state: AppState;
export declare function recalc(): void;
export declare function navigate(route: string): void;
export declare function currentRoute(): string;
