import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { calculate, ZiWei, handoff, handoffUnknownTime, analyzeBirthTime } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const outDir = join(process.cwd(), 'fixtures/ai-handoff');
mkdirSync(outDir, { recursive: true });

const base: ZiWeiBirthInput = {
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male',
  name: '王小明'
};

// 1. exact-canonical
const cExact = calculate(base);
writeFileSync(join(outDir, 'exact-canonical.json'), JSON.stringify(handoff(cExact, { mode: 'compact', privacy: 'interpretation' }), null, 2));

// 2. hour-branch
const cHour = calculate({ ...base, timePrecision: 'hour-branch', hourBranch: 'wu' });
writeFileSync(join(outDir, 'hour-branch.json'), JSON.stringify(handoff(cHour, { mode: 'compact', privacy: 'interpretation' }), null, 2));

// 3. unknown-time
const unkRes = analyzeBirthTime({ ...base, time: { precision: 'unknown' } });
writeFileSync(join(outDir, 'unknown-time.json'), JSON.stringify(handoffUnknownTime(unkRes), null, 2));

// 4. zhongzhou-profile
const cZz = calculate(base, { profile: 'school-zhongzhou' });
writeFileSync(join(outDir, 'zhongzhou-profile.json'), JSON.stringify(handoff(cZz, { mode: 'compact', privacy: 'interpretation' }), null, 2));

// 5. with-periods
const cPeriods = calculate(base, { targetDate: { year: 2026, month: 9, day: 24, hour: 14 } });
writeFileSync(join(outDir, 'with-periods.json'), JSON.stringify(handoff(cPeriods, { mode: 'compact', privacy: 'interpretation' }), null, 2));

// 6. minimal-privacy
writeFileSync(join(outDir, 'minimal-privacy.json'), JSON.stringify(handoff(cExact, { mode: 'compact', privacy: 'minimal' }), null, 2));

// 7. full-privacy
writeFileSync(join(outDir, 'full-privacy.json'), JSON.stringify(handoff(cExact, { mode: 'full', privacy: 'full' }), null, 2));

console.log('generated 7 ai-handoff fixtures');
