# Versioning（版本治理）

## 三種版本

| 版本 | 位置 | 意義 |
|---|---|---|
| `ruleVersion` | 每條規則 | 該規則的行為版本 |
| `schemaVersion` | `schemas/*.json` + chart 輸出 | 公開 JSON 契約版本 |
| `BIBLE_VERSION` | `src/core/constants.ts` + `package.json` | repo 整體版本 |

## ruleVersion 提升時機

只要下列任一改變，**必須**提升 `ruleVersion` 並新增 `changeLog`：

```text
logic.executor
logic.params（含 variantPatch）
logic.dsl / conditions
tableRef
status（canonical ↔ candidate ↔ deprecated）
```

僅改錯字、註解、`name`/`text` 措辭 → 不強制升版（changeLog type 用 `wording-only`）。

## changeLog 格式

```json
{
  "version": "1.1",
  "type": "behavior-change",
  "date": "2026-09-23",
  "note": "修正五虎遁取模錯誤：子宮干由丙改戊。"
}
```

`type` 允許值：

```text
rule-add / rule-remove / breaking / behavior-change
evidence-update / wording-only / deprecated
```

**最新一筆 changeLog 的 `version` 必須等於 `ruleVersion`**（integrity gate 強制）。

## schemaVersion 提升時機

公開 JSON 契約變更即需升版，不得偷偷改：

```text
chart.stars 型別            1.0 → 2.0（StarPlacement[] → StarPlacement）
period contract            1.0 → 2.0（新增 periods.active、PeriodInfo.ganzhi）
direction 列舉             1.0 → 2.0（新增 undetermined）
```

目前 **schemaVersion = 2.0**。

## 驗證

```bash
npm run validate:integrity   # changeLog 存在、版本一致
npm run validate:governance  # 同上 + 來源證據 gate
npm run coverage:bible       # 顯示 version 三件套
```
