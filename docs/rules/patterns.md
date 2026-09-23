# Patterns（格局）

## 定義格式

格局存於 `rules/patterns/geju.json`，是一種**特殊的規則**（有 `ruleId`，前綴 `ZW.PAT.`）：

```json
{
  "ruleId": "ZW.PAT.ZIFU_TONGGONG.001",
  "ruleVersion": "1.0",
  "status": "candidate",
  "name": { "zh-TW": "紫府同宮" },
  "required": [
    { "type": "star-group", "group": ["ZW.STAR.MAJOR.ZIWEI", "ZW.STAR.MAJOR.TIANFU"], "relation": "same-palace" }
  ],
  "enhancers": [ { "type": "relation", "relation": "san-fang-si-zheng", "containsAny": ["ZW.STAR.AUX.ZUOFU", "ZW.STAR.AUX.YOUBI"] } ],
  "breakers": [ { "type": "star-group", "group": "major-malefic", "relation": "same-palace" } ],
  "sourceRefs": ["SRC.QUANSHU"],
  "evidenceRefs": [],
  "text": { "zh-TW": "…" },
  "logic": { "stage": "analysis" }
}
```

`required` / `enhancers` / `breakers` 都是 **DSL 節點**，須符合 `schemas/dsl.schema.json`。

## 判定

`runPatterns(ctx)` 逐條評估，產生 `PatternResult`：

| status | 條件 |
|---|---|
| `insufficient` | 無 required，或 DSL 執行錯誤，或全部 required 未成立 |
| `partial` | 部分 required 成立 |
| `broken` | required 全成立但有 breaker |
| `enhanced` | required 全成立且有 enhancer |
| `complete` | required 全成立、無 breaker、無 enhancer |
| `variant-only` | 規則本身 status 為 variant / research |

`score = 成立 required 數 / required 總數`（僅供參考，不是吉凶總分）。

## DSL 錯誤不得靜默

DSL 執行錯誤（未知 operator、缺參數）會：

1. 使該格局狀態為 `insufficient`
2. 寫入 trace：`status = "error"` + `reason`

**不會**被當成「不成立」。`tests/schema/dsl.test.ts` 斷言 trace 中不得出現未預期的 error。

## 供其他規則引用

`runPatterns` 結束後會設定 `ctx.patternResults`，
解讀規則可用 `pattern` operator 引用真實格局結果：

```json
{
  "type": "pattern",
  "patternId": "ZW.PAT.ZIFU_TONGGONG.001",
  "statusIn": ["complete", "enhanced"]
}
```

## 驗證

```bash
npm run validate:integrity   # DSL schema + 規則參照
npx tsx tools/schema-validator/validate.ts  # chart.patterns 契約
```
