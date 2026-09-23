# Public API

## 命名空間

```ts
import { ZiWei } from 'ziwei-bible';
```

| API | 說明 |
|---|---|
| `ZiWei.calculate(input, options)` | 排盤，回傳 `ZiWeiChart` |
| `ZiWei.calculateSafe(input, options)` | 同上但回傳 `{ ok, chart }` / `{ ok: false, error }` |
| `ZiWei.Periods.at(chart, {year,month,day,hour})` | 以既有輸入套用指定時間的限運 |
| `ZiWei.Interpret(chart)` | 回傳 `{ hits, byDomain }` |
| `ZiWei.Patterns.match(chart)` | 回傳格局評估結果 |
| `ZiWei.Rectification.analyze(input, clues)` | 時辰校正候選 |
| `ZiWei.Rectification.analyzeUnknownTime(input)` | 12 時辰候選盤 |
| `ZiWei.Renderer.render(chart, options)` | 回傳 SVG 字串 |
| `ZiWei.AI.toContext(chart)` | 回傳 AI-ready context 物件 |
| `ZiWei.Rules.get(id)` / `.list(filter)` / `.explain(id)` | 規則存取 |
| `ZiWei.Sources.get(id)` / `.list()` | 文獻存取 |
| `ZiWei.Trace.explain(chart, {ruleId})` | 取出 trace 條目 |
| `ZiWei.analyzeUnknownTime(input)` | 同上（頂層捷徑） |

## 型別

```ts
interface ZiWeiBirthInput {
  calendarType: 'solar' | 'lunar';
  date: { year: number; month: number; day: number; isLeapMonth?: boolean };
  time?: { hour?: number; minute?: number; second?: number };
  timezone?: string;                 // IANA，如 'Asia/Taipei'
  location?: { latitude?: number; longitude?: number; placeName?: string };
  sexForCalculation?: 'male' | 'female' | 'unknown';
  timeConvention?: 'civil' | 'true-solar' | 'local-mean-solar';
  dayBoundary?: 'midnight' | 'zi-hour';
  name?: string;                     // 僅展示用
}

interface CalculateOptions {
  profile?: string;                  // 'canonical' | 'traditional-zi' | 'true-solar'
  trace?: boolean;
  targetDate?: { year?: number; month?: number; day?: number; hour?: number };
  interpretation?: boolean;
  patterns?: boolean;
}
```

## 錯誤碼

| 碼 | 觸發條件 |
|---|---|
| `INVALID_DATE` | 國曆日期不合法 |
| `INVALID_LUNAR_DATE` | 農曆日期不合法 |
| `INVALID_LEAP_MONTH` | 該年無此閏月 |
| `INVALID_TIMEZONE` | IANA 時區不存在 |
| `MISSING_LOCATION_FOR_SOLAR_TIME` | 真太陽時未提供經度 |
| `UNKNOWN_SEX_FOR_CALCULATION` | 未提供 `sexForCalculation` |
| `UNSUPPORTED_PROFILE` | Profile 不存在 |
| `RULE_NOT_FOUND` | `ZiWei.Rules.get` 找不到 |
| `SOURCE_NOT_FOUND` | `ZiWei.Sources.get` 找不到 |
| `SCHEMA_VALIDATION_FAILED` | 規則/資料 schema 驗證失敗 |
| `EXECUTOR_NOT_FOUND` | rule 引用的 executor 不存在 |

```ts
const res = ZiWei.calculateSafe(input);
if (!res.ok) console.error(res.error.code, res.error.message, res.error.details);
```

## Chart JSON 頂層結構

```jsonc
{
  "schemaVersion": "1.0",
  "generatedWith": { "bibleVersion": "0.1.0", "schemaVersion": "1.0", "profile": "canonical", "engineVersion": "0.1.0" },
  "input": { /* ZiWeiBirthInput */ },
  "calendar": { "solar": {}, "lunar": {}, "ganzhi": {}, "hourBranch": "si", "timezone": "Asia/Taipei", "utcOffsetMinutes": 480, "dayBoundary": "midnight" },
  "birthContext": { "sexForCalculation": "male", "yinYang": "yang", "direction": "forward", "bureau": "shui2", "bureauName": {} },
  "chart": {
    "natal": { "lifePalace": "life", "bodyPalace": "spouse", "lifePalaceBranch": "zi", "bodyPalaceBranch": "xu", "masterStar": "...", "bodyStar": "..." },
    "palaces": [ /* 12 palaces */ ],
    "stars": { "ZW.STAR.MAJOR.ZIWEI": { /* StarPlacement */ } },
    "transformations": [ /* Transformation[] */ ],
    "patterns": [ /* PatternResult[] */ ]
  },
  "periods": { "major": [ /* 12 */ ], "year": {}, "month": {}, "day": {}, "hour": {} },
  "interpretation": { "hits": [], "byDomain": {} },
  "certainty": { "calendar": "certain", "dignity": "variant-dependent", ... },
  "trace": { "entries": [] }   // 僅 trace: true 時
}
```
