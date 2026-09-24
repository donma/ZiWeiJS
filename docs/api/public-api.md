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
  profile?: string;                  // 'canonical' | 'traditional-zi' | 'true-solar' | 'lichun' | ...
  trace?: boolean;
  /** year 必填；month/day/hour/minute 逐層可選（見 docs/api/periods.md） */
  targetDate?: { year: number; month?: number; day?: number; hour?: number; minute?: number; timezone?: string };
  interpretation?: boolean;
  patterns?: boolean;
}

interface ZiWeiBirthInput {
  // ...
  /** DST 邊界本地時間歧義處理（預設 'reject'） */
  timezoneDisambiguation?: 'reject' | 'earlier' | 'later';
}
```

## 錯誤碼

| 碼 | 觸發條件 |
|---|---|
| `INVALID_DATE` | 國曆日期不合法（含不存在的日期，如 2025-02-30） |
| `INVALID_LUNAR_DATE` | 農曆日期不合法（含小月無 30 日） |
| `INVALID_LEAP_MONTH` | 該年無此閏月 |
| `INVALID_TIMEZONE` | IANA 時區不存在 |
| `INVALID_INPUT` | 時/分/秒或經緯度超出範圍、NaN / Infinity 等非數值 |
| `NONEXISTENT_LOCAL_TIME` | DST 跳躍造成該本地時刻不存在（需 `timezoneDisambiguation`） |
| `AMBIGUOUS_LOCAL_TIME` | DST 重疊造成本地時刻有歧義（需 `timezoneDisambiguation`） |
| `INVALID_TARGET_DATE` | `targetDate` 欄位依存關係錯誤或日期不存在 |
| `MISSING_LOCATION_FOR_SOLAR_TIME` | 真太陽時未提供經度 |
| `UNKNOWN_BIRTH_TIME` | 未提供出生時辰 |
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

## 限運資料契約（PeriodInfo）

- `PeriodInfo.branch`：**該限運命宮所在的地支**（十二宮疊盤定位）。
- `PeriodInfo.ganzhi`：**目標日期本身該層級之真實干支**（四柱干支）。`ganzhi.branch` 為該柱地支。
- 兩者語意不同，偶爾可能剛好相同。流月 / 流日定位一律採農曆月日序（非 Gregorian）。

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
  "periods": { "major": [ /* 12 */ ], "active": { /* 有 targetDate 時才有 */ }, "year": {}, "month": {}, "day": {}, "hour": {}, "xiaoxian": { "age": 37, "branch": "chen", "palaceId": "friends" } },
  "interpretation": { "hits": [], "byDomain": {} },
  "certainty": { "calendar": "certain", "dignity": "variant-dependent", "xiaoxian": "high", ... },
  "trace": { "entries": [] }   // 僅 trace: true 時
}
```

## AiContext（`ZiWei.AI.toContext`）

AI-ready 扁平化 context；只重排既有 chart 輸出，不含任何新命理判斷。

```ts
interface AiContext {
  birth; pillars;                                   // 出生 / 四柱
  lifePalace; bodyPalace; lifeMaster?; bodyMaster?; // 命宮 / 身宮 / 命主 / 身主（zh 名稱）
  bureau; palaces; transformations; patterns;
  periods: {
    major; activeMajor?;                            // 目標當下大限（需 targetDate）
    year?; month?; day?; hour?;                     // 干支中文字
    xiaoxian?: { age; branch; palace }              // 小限（canonical）
  };
  interpretationHits; ruleIds; sourceIds; evidenceIds; // 皆可回溯（來自 trace）
  profile; schemaVersion; certainty;
}
```

- `certainty` 完整轉出（`xiaoxian` 於無 targetDate 為 `unavailable`、性別未知為 `unknown`）。
- `sourceIds` / `evidenceIds` 來自 trace 的 `sourceRefs` / `evidenceRefs`，因此 `toContext` 需搭配
  `calculate(input, { trace: true })` 才有完整溯源（否則僅有 ruleIds）。
