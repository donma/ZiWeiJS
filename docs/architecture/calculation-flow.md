# Calculation Flow（計算流程）

## 全貌

```text
輸入 ZiWeiBirthInput
  │
  ├─ 1. 輸入驗證
  │     sexForCalculation 缺失 → UNKNOWN_SEX_FOR_CALCULATION
  │     time.hour 缺失      → UNKNOWN_BIRTH_TIME（唯一例外：analyzeUnknownTime）
  │     targetDate 契約違反  → INVALID_TARGET_DATE
  │
  ├─ 2. 曆法層 normalizeBirth(input, profile)
  │     國曆 ↔ 農曆（含閏月）
  │     四柱干支（年柱以立春為界）
  │     真太陽時 / 地方平太陽時 → 可能跨日，日期同步調整（P1-6）
  │     dayBoundary: midnight | zi-hour
  │
  ├─ 3. 執行計畫（規則驅動）
  │     NATAL_EXECUTION_PLAN（31 步）
  │       requireSex → calendar 驗證 → calcDirection
  │       → 命/身/十二宮/宮干/命主身主/五行局
  │       → 紫微定位 → 紫微系 → 天府系
  │       → 月系/時系/年干系/年支系/日系/特殊雜曜/歲建將前/固定
  │       → 長生十二神 / 博士十二神
  │       → 生年四化 / 宮干四化 / 廟旺 / 大限
  │
  ├─ 4. 若有 targetDate
  │     虛歲 = 目標農曆年 − 生年農曆年 + 1
  │     resolveMajorPeriod() → periods.active.major
  │     PERIOD_EXECUTION_PLAN（5 步）
  │       流年 → 流月 → 流日 → 流時 → 限運四化
  │
  ├─ 5. 格局 runPatterns(ctx)  → ctx.patternResults
  ├─ 6. 解讀 runInterpretation(ctx) → resolver（active/overridden/conflicted）
  └─ 7. 組裝 ZiWeiChart（公開 JSON 契約，schemaVersion 2.0）
```

## 為什麼曆法層不在計畫裡？

`normalizeBirth` 必須在 `EngineContext` 存在之前完成（ctx 需要農曆月、時支、年干支）。
因此曆法層以「驗證型 executor」納入計畫：

- `ZW.CALC.CALENDAR.SOLAR_LUNAR.001` → `convertCalendar`（回報轉換結果）
- `ZW.CALC.CALENDAR.GANZHI.001` → `calcGanzhi`（回報四柱）
- `ZW.CALC.CALENDAR.TRUESOLAR.001` → `calcTrueSolar`（回報位移與有效時辰）

這樣曆法規則同樣具備 ruleId / 來源 / 證據的完整溯源。

## 決定性（Determinism）

- 沒有 `targetDate` → **完全不計算限運**，也**不使用 `new Date()`**
- 相同輸入在任何時間執行 → 輸出 JSON byte-for-byte 相同
- 需要限運時明確傳入：

```ts
const natal = ZiWei.calculate(input);
const timed = ZiWei.Periods.at(natal, { year: 2026, month: 3, day: 15 });
```

## 性別未知（spec §27）

`sexForCalculation: 'unknown'` 時：

| 項目 | 行為 |
|---|---|
| 本命盤（命身宮、十二宮、主星、輔煞、四化、廟旺） | 正常計算 |
| `birthContext.direction` | `undetermined`（不猜） |
| 長生十二神 | 不產出，trace `unavailable` |
| 大限 | 空陣列，trace `unavailable`，`certainty.majorPeriods = 'unknown'` |
