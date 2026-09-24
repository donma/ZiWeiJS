# Periods API（限運）

## 原則：沒有 targetDate 就沒有流年

`calculate()` **不會**隱含使用系統當前時間。沒有 `targetDate` 時：

```ts
const c = calculate(input);
c.periods.year      // undefined
c.periods.month     // undefined
c.periods.day       // undefined
c.periods.hour      // undefined
c.periods.active    // undefined
c.certainty.periods // 'unavailable'
```

因此同一輸入在任何時間執行，輸出 JSON 完全相同。

## TargetDate 契約

```ts
interface TargetDate {
  year: number;      // 必填
  month?: number;    // 1-12
  day?: number;      // 1-31，需有 month（且須為真實日期）
  hour?: number;     // 0-23，需有 day
  minute?: number;   // 0-59，需有 hour
  timezone?: string;
}
```

違反依存關係（day 無 month、hour 無 day、minute 無 hour、缺 year）→ `INVALID_TARGET_DATE`。

日期必須真實存在：`2025-02-29` / `2026-04-31` / `2026-13-01` 皆為 `INVALID_TARGET_DATE`
（不得靠 JS `Date` rollover 默默接受）。

語意：

```text
year                → active major + 流年
                      → 不捏造月/日（year-only），不產生流月/流日/流時
                        （輸出 PeriodInfo.resolution = 'year-only'）
year + month        → 語意模糊（Gregorian month 可能跨兩個農曆月）
                      → 以該月 15 日為 representative date，並在輸出標示
                        （resolution = 'representative-date'；solar/lunar.day 留空）
year + month + day  → exact date（流月 / 流日以農曆月日定位，resolution = 'exact-date'）
+ hour（+ minute）  → exact hour（流時）
```

`PeriodInfo.resolution` 明確標示本次輸出之日期精度，呼叫端不得假設缺漏的月/日存在。

限運採**逐層疊加**：

| targetDate 提供 | 產出 |
|---|---|
| `{ year }` | 流年 |
| `{ year, month }` | 流年 + 流月（representative date） |
| `{ year, month, day }` | + 流日 |
| `{ year, month, day, hour }` | + 流時 + 限運四化 |

## 農曆語意（重要）

流月與流日**一律以農曆定位**，不得使用 Gregorian month / day：

- 斗君：由流年歲建起**農曆正月**、**逆數生月**，再自該宮起子時**順數至生時**
  （《紫微斗數全書》安子斗訣；spec 3rd §P0-4）。
- 流月命宮：由該年**斗君**（即流年正月命宮）起，順數至目標農曆月
- 流日命宮：由流月命宮起**農曆初一**順數至目標農曆日

因此「同一農曆月份內」不會單純因 Gregorian 日期不同而被判為不同流月。

> 注意：流月命宮並非「由流年命宮起正月」；兩者僅在特定條件下巧合相同。

### leapMonthPolicy

閏月目標以 `profile.leapMonthPolicy` 決定有效月序：

| policy | 閏五月 |
|---|---|
| `same-as-normal` | 視同五月 |
| `next-month` | 視同六月 |
| `mid-month` | 初一~十五 → 五月；十六~月底 → 六月 |
| `split` | **尚未支援**（現行 Period model 無法表達 13/14 個流月）→ `UNSUPPORTED_PROFILE` |

## 取得限運

```ts
import { ZiWei } from 'ziwei-bible';

const natal = ZiWei.calculate(input);                       // 只算本命
const timed = ZiWei.Periods.at(natal, { year: 2026, month: 3, day: 15 });
// 或是
const timed = ZiWei.calculate(input, { targetDate: { year: 2026, month: 3, day: 15 } });
```

`ZiWei.Periods.at()` 不 mutate 原 chart。

## active major period

```ts
timed.periods.active = {
  age: 37,                       // 虛歲 = 目標農曆年 − 生年農曆年 + 1（非 Gregorian 年）
  asOf: { year: 2026, ... },
  major: { fromAge: 36, toAge: 45, branch: 'yin', stem: 'wu', ... },
  majorSkippedReason?: string    // 未上運 / 性別未知 / 超出範圍
}
```

`majorSkippedReason` 可能值：

```text
BELOW_FIRST_MAJOR_PERIOD   // 未上運（童限）
ABOVE_LAST_MAJOR_PERIOD    // 超出第 12 大限
UNKNOWN_SEX_FOR_CALCULATION // 性別未知，順逆行無從判定
NO_MAJOR_PERIODS
```

**大限四化使用 `periods.active.major` 的天干**，不是 `majorPeriods[0]`。

## 限運干支與命宮地支語意契約（spec 2nd §P0-3）

必須嚴格區分兩者：

- `PeriodInfo.branch`：**該限運命宮所在的地支**（用於十二宮疊盤定位）。
  例如流月命宮由當年斗君起農曆正月順數所得之地支、流日命宮由流月命宮起農曆初一順數所得之地支。
- `PeriodInfo.ganzhi`：**目標日期本身該層級的真實干支**（以曆法實際日期推算之四柱）。
  `PeriodInfo.ganzhi.branch` 為該四柱的地支（如日柱地支、時柱地支）。

兩者屬於不同概念，偶爾可能恰好相同，不得假設 `branch === ganzhi.branch`，亦不得假設必不相同：

```ts
timed.periods.month.branch        // 流月命宮所在宮位地支（疊盤定位）
timed.periods.month.ganzhi        // { stem: 'geng', branch: 'yin' } ← 目標日農曆月份之真實月柱
timed.periods.day.branch          // 流日命宮所在宮位地支（自流月命宮起初一順數至當日農曆日）
timed.periods.day.ganzhi          // { stem: 'geng', branch: 'chen' } ← 該日真實日柱
timed.periods.hour.branch         // 流時命宮所在宮位地支
timed.periods.hour.ganzhi         // 該時刻真實時柱（日干+時辰）
```

各層干支一律由 `targetDate` 實際推算，**不會沿用上層天干**。

## 疊盤內容

每個 `PeriodInfo.overlay` 含：

- `palaces`：以該限運地支為命宮逆布的十二宮
- `periodStars`：**僅流年**（`scope: 'year'`）安放歲建十二神（12）+ 將前十二神（12）；
  流月 / 流日 / 流時之 `periodStars` 一律為空（spec 3rd §P0-10）
- `transformations`：該限運天干之四化

## 年柱換年分界（yearBoundaryPolicy）

`profile.yearBoundaryPolicy` 決定「年柱」何時換年（影響流年干支與虛歲基準）：

- `lunar-new-year`（預設）：以農曆正月初一換年
- `lichun`：以立春換年（立春前仍屬前一年度）

`PeriodInfo` 會回報 `lunarYear`、`resolvedYear`（年柱所屬年度）、`yearBoundaryPolicy`，
供呼叫端判斷跨年邊界。`profiles/lichun.json` 即採用 `lichun` 制。

## 真太陽時跨日

若 `timeConvention` 為 `true-solar` / `local-mean-solar`，校正可能跨日，
此時 `calendar.solar` / `lunar` / `ganzhi.day` 會同步調整，
且子時換日以 **effective time** 判定（見 `tests/boundary/true-solar-rollover.test.ts`）。
