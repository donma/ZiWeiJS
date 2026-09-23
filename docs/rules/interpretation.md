# Interpretation（解讀）

## 規則格式

```json
{
  "ruleId": "ZW.INT.PERS.ZIWEI_LIFE.001",
  "status": "candidate",
  "domain": "personality",
  "name": { "zh-TW": "紫微坐命" },
  "conditions": { "all": [ { "type": "star-in-palace", "star": "ZW.STAR.MAJOR.ZIWEI", "palace": "life" } ] },
  "tendency": "positive",
  "strength": 0.7,
  "confidence": 0.8,
  "priority": 70,
  "supports": [],
  "conflictsWith": [],
  "overrides": [],
  "text": { "zh-TW": "紫微居命，主厚重謙恭…" },
  "logic": { "stage": "analysis" }
}
```

`conditions` 是 DSL 節點，須符合 `schemas/dsl.schema.json`。

## 解析流程（resolver）

```text
raw hits
  ↓ apply overrides       （def.overrides = 本規則覆蓋哪些規則）
  ↓ resolve conflicts     （雙向對稱）
  ↓ apply supports        （雙向對稱，記入 supportedBy）
  ↓ sort priority         （同優先度再比 effectiveStrength）
resolved hits
```

程式位置：`src/interpretation-engine/resolver.ts`。

## 狀態

`InterpretationHit.status`：

| status | 意義 | effectiveStrength |
|---|---|---|
| `active` | 未被覆蓋、無衝突 | `strength` |
| `overridden` | 被其他命中覆蓋（**不移除**） | `strength × 0.5` |
| `conflicted` | 與其他命中互相衝突 | `strength × 0.75` |

關聯欄位：`overriddenBy` / `overridesList` / `conflictsWith` / `supportedBy`。

## 沒有單一總分

刻意不產生「吉凶總分」。結果以**可解釋的關係網路**呈現，
任何一筆都能回答「為什麼？」：

```text
之所以被降強度，是因為 X 規則覆蓋它。
```

## 消費者

| 消費者 | 使用範圍 |
|---|---|
| `renderNarrative()` | 預設只吃 `active`（`includeNonActive: true` 可全部） |
| Expert UI | 顯示 `active` / `overridden` / `conflicted` 與彼此關係 |
| `ZiWei.Interpret(chart)` | 全部 hits（原始資料） |

## DSL 錯誤處理

條件式錯誤 → 該規則不列入 hits，並寫入 trace `status="error"` + `reason`。
這與「條件不成立」在語意上完全不同（spec §P0-5）。

## 驗證

- `tests/unit/interpretation-resolver.test.ts` — 覆蓋/衝突/支持/排序/無總分
- `tests/unit/interpretation.test.ts` — 真實命盤命中性
- `tests/unit/conflict.test.ts` — 關係對稱性
- `npm run validate:integrity` — conditions DSL schema
