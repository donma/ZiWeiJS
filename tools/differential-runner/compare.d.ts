import type { ZiWeiChart } from '../../src/index.js';
export interface DiffRow {
    field: string;
    bible: string;
    sourceA?: string;
    sourceB?: string;
    status: 'match' | 'needs-review' | 'empty';
}
export declare const EXTERNAL_FIELDS: string[];
export declare function bibleValue(chart: ZiWeiChart, field: string): string;
export declare function compareChart(chart: ZiWeiChart, externalValue: (field: string, bibleValue: string) => string | undefined): DiffRow[];
