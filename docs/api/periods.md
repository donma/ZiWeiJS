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
  day?: number;      // 1-31，需有 month
  hour?: number;     // 0-23，需有 day
  minute?: number;
  timezone?: string;
}
```

違反依存關係（day 無 month、hour 無 day、缺 year）→ `INVALID_TARGET_DATE`。

限運採**逐層疊加**：

| targetDate 提供 | 產出 |
|---|---|
| `{ year }` | 流年 |
| `{ year, month }` | 流年 + 流月 |
| `{ year, month, day }` | + 流日 |
| `{ year, month, day, hour }` | + 流時 + 限運四化 |

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
  age: 37,                       // 虛歲 = targetYear − 農曆生年 + 1
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

## 限運干支

`PeriodInfo.branch` 是**限運命宮疊盤位置**，與該限運的真實干支無關。
真實干支請讀 `PeriodInfo.ganzhi`：

```ts
timed.periods.day.branch        // 流日命宮在十二宮疊盤中的位置
timed.periods.day.ganzhi        // { stem: 'geng', branch: 'chen' } ← 該日真實日柱
timed.periods.hour.ganzhi       // 由日干 + 時支推算
```

各層干支一律由 `targetDate` 實際推算，**不會沿用上層天干**。

## 疊盤內容

每個 `PeriodInfo.overlay` 含：

- `palaces`：以該限運地支為命宮逆布的十二宮
- `periodStars`：歲建十二神（12）+ 將前十二神（12）
- `transformations`：該限運天干之四化

## 真太陽時跨日

若 `timeConvention` 為 `true-solar` / `local-mean-solar`，校正可能跨日，
此時 `calendar.solar` / `lunar` / `ganzhi.day` 會同步調整，
且子時換日以 **effective time** 判定（見 `tests/boundary/true-solar-rollover.test.ts`）。
