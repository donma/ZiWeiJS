# 架構總覽

## 分層

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                            │
│  Standard Mode / Expert Mode / Geek / Rule+Source Explorer│
└───────────────────────┬─────────────────────────────────┘
                        │ 只讀 chart JSON，不重算
┌───────────────────────┴─────────────────────────────────┐
│                  Public API (ZiWei.*)                     │
│  calculate / Periods / Interpret / Patterns / Renderer    │
│  AI.toContext / Rules / Sources / Trace / Rectification   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                  Reference Engine                        │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  calendar   │→ │ executors    │→ │ transformation │  │
│  │  solar/lunar│  │ palace/star  │  │ dignity/period │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ relation-   │  │ rule-engine  │  │ interpretation │  │
│  │ engine      │  │ registry+DSL │  │ pattern/narr.  │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐                      │
│  │    trace    │  │    renderer  │                      │
│  └─────────────┘  └──────────────┘                      │
└───────────────────────┬─────────────────────────────────┘
                        │ 讀取
┌───────────────────────┴─────────────────────────────────┐
│                  Data Layer (Source of Truth)             │
│  rules/*.json   tables/*.json   schemas/*.json           │
│  sources/  evidence/  profiles/  variants/               │
└─────────────────────────────────────────────────────────┘
```

## 資料流（calculate）

```
ZiWeiBirthInput
  │
  ├─ normalizeBirth()           國曆↔農曆、干支、時區、真太陽時、換日
  │     └─ Profile 決定 timeConvention / dayBoundary / leapMonthPolicy
  │
  ├─ calcLifePalace / calcBodyPalace
  ├─ calcTwelvePalaces / calcPalaceStems（五虎遁）
  ├─ calcBureau（命宮納音 → 水二/木三/金四/土五/火六）
  ├─ calcMajors（紫微定位 → 紫微系逆行 + 天府系順行）
  ├─ calcAuxBy*（月/時/年干/年支/日 → 輔煞雜曜）
  ├─ calcMasterStars / calcChangSheng / calcBoshi / calcPeriodStars
  ├─ calcSihua（生年 / 宮干 / 限運）
  ├─ calcDignities（廟旺利陷）
  ├─ calcMajorPeriods / calcYear/Month/Day/HourPeriod
  ├─ runPatterns（Rule DSL → 格局狀態）
  ├─ runInterpretation（Rule DSL → hits + conflict/override 解析）
  │
  └─ ZiWeiChart（schemaVersion 標記，含 certainty 與 optional trace）
```

## 關鍵設計

| 設計 | 理由 |
|---|---|
| 規則放 JSON，不放程式 | 可被文件、UI、測試、AI 共同引用；可版本化 |
| 複雜演算法用 executor | 不宜硬塞 DSL 的計算保留為 TS，但仍掛 ruleId/source/evidence |
| 每步都寫 trace | 「為什麼這顆星在這裡」可完整回溯 |
| Canonical 與 Variant 並存 | 流派差異不被抹除 |
| Chart JSON 即 Public Contract | 第三方可用同一份 fixture 驗證自家實作 |
| Engine 與 UI state 分離 | UI 切換不重算，Engine deterministic |
