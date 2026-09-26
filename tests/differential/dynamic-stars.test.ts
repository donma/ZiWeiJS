import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { calculate, BranchId } from '../../src/index.js';
import type { ZiWeiBirthInput } from '../../src/index.js';

const require = createRequire(import.meta.url);
const { astro } = require('iztro') as {
  astro: { bySolar(date: string, timeIndex: number, gender: string, fixLeap: boolean, locale: string): any };
};

/**
 * Dynamic Stars Differential vs iztro (spec 0.6 §37 / §46)
 *
 * 比對 10 顆動態流曜在流年（year scope）上的落宮是否與 iztro 100% 一致：
 * - 流魁 (TIANKUI)
 * - 流鉞 (TIANYUE)
 * - 流昌 (WENCHANG)
 * - 流曲 (WENQU)
 * - 流祿 (LUCUN)
 * - 流羊 (QINGYANG)
 * - 流陀 (TUOLUO)
 * - 流馬 (TIANMA)
 * - 流鸞 (HONGLUAN)
 * - 流喜 (TIANXI)
 */

const ZH_TO_BRANCH: Record<string, BranchId> = {
  '子': 'zi', '丑': 'chou', '寅': 'yin', '卯': 'mao',
  '辰': 'chen', '巳': 'si', '午': 'wu', '未': 'wei',
  '申': 'shen', '酉': 'you', '戌': 'xu', '亥': 'hai'
};

const STAR_NAME_MAP: Array<[string, string]> = [
  ['ZW.STAR.AUX.TIANKUI', '流魁'],
  ['ZW.STAR.AUX.TIANYUE', '流鉞'],
  ['ZW.STAR.AUX.WENCHANG', '流昌'],
  ['ZW.STAR.AUX.WENQU', '流曲'],
  ['ZW.STAR.AUX.LUCUN', '流祿'],
  ['ZW.STAR.MALEFIC.QINGYANG', '流羊'],
  ['ZW.STAR.MALEFIC.TUOLUO', '流陀'],
  ['ZW.STAR.AUX.TIANMA', '流馬'],
  ['ZW.STAR.AUX.HONGLUAN', '流鸞'],
  ['ZW.STAR.AUX.TIANXI', '流喜']
];

describe('differential: 10 顆動態流曜 (year scope) vs iztro', () => {
  const cases: Array<{
    name: string;
    solarDate: string;
    hour: number;
    gender: 'male' | 'female';
    targetDate: string;
    targetObj: { year: number; month: number; day: number };
  }> = [
    {
      name: '1990 甲午生 @2026 丙午年',
      solarDate: '1990-5-15',
      hour: 10,
      gender: 'male',
      targetDate: '2026-09-24',
      targetObj: { year: 2026, month: 9, day: 24 }
    },
    {
      name: '1984 甲子生 @2028 戊申年',
      solarDate: '1984-2-2',
      hour: 14,
      gender: 'female',
      targetDate: '2028-08-15',
      targetObj: { year: 2028, month: 8, day: 15 }
    },
    {
      name: '1993 癸酉生 @2023 癸卯年',
      solarDate: '1993-7-7',
      hour: 14,
      gender: 'female',
      targetDate: '2023-10-01',
      targetObj: { year: 2023, month: 10, day: 1 }
    },
    {
      name: '1988 戊辰生 @2030 庚戌年',
      solarDate: '1988-8-8',
      hour: 20,
      gender: 'female',
      targetDate: '2030-05-10',
      targetObj: { year: 2030, month: 5, day: 10 }
    }
  ];

  for (const c of cases) {
    it(`案例 ${c.name}：10 顆流曜落宮與 iztro 100% 一致`, () => {
      // 1. 取得 iztro 流曜落宮
      const timeIndex = Math.floor((c.hour + 1) / 2) % 12;
      const a = astro.bySolar(c.solarDate, timeIndex, c.gender, true, 'zh-TW');
      const h = a.horoscope(c.targetDate);
      const extStars: Record<string, BranchId> = {};

      h.yearly.stars.forEach((stars: Array<{ name: string }>, idx: number) => {
        const branchZh = a.palaces[idx].earthlyBranch;
        const branch = ZH_TO_BRANCH[branchZh];
        for (const s of stars) {
          extStars[s.name] = branch;
        }
      });

      // 2. 取得 ZiWeiJS 動態星曜落宮
      const [y, m, d] = c.solarDate.split('-').map(Number);
      const input: ZiWeiBirthInput = {
        calendarType: 'solar',
        date: { year: y, month: m, day: d },
        time: { hour: c.hour },
        timezone: 'Asia/Taipei',
        sexForCalculation: c.gender
      };
      const chart = calculate(input, { targetDate: c.targetObj });
      const dynamicStars = chart.periods.dynamicStars ?? [];

      expect(dynamicStars.length).toBe(10);

      // 3. 逐一比對
      for (const [id, label] of STAR_NAME_MAP) {
        const our = dynamicStars.find(s => s.baseStarId === id);
        expect(our, `${label} (${id}) 存在`).toBeDefined();
        const extBranch = extStars[label];
        expect(extBranch, `iztro 包含 ${label}`).toBeDefined();
        expect(our!.branch, `${label} 落宮一致`).toBe(extBranch);
      }
    });
  }
});
