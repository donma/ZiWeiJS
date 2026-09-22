# Contributing

## 規則貢獻流程

1. 新規則一律先建為 `research` 或 `candidate` status。
2. 每條規則必須有 `ruleId / ruleVersion / status / scope / logic / sourceRefs`。
3. Canonical 規則必須有 `sourceRefs`（Tier 1–3 優先）與至少一筆 `evidenceRefs`。
4. `candidate → canonical` 僅專案 Owner 可批准。
5. AI（含本檔案協作者）不得作為 evidence source。

## 規則命名

```
ZW.CALC.<domain>.<name>.<nnn>     計算規則
ZW.INT.<DOMAIN>.<name>.<nnn>     解讀規則
ZW.PAT.<name>.<nnn>              格局
ZW.RECT.<name>.<nnn>             校正
ZW.STAR.<category>.<name>        星曜 ID
SRC.<name>                       文獻
EVD.<source>.<topic>             證據
```

## 程式規範

- TypeScript strict；核心 runtime 零外部依賴（僅 lunar-typescript 曆法）。
- 資料可表達 → Rule DSL；不適合 → `src/executors/` executor，但仍須 ruleId/source/evidence/version/test/trace。
- 禁止把規則藏在 if/else、Markdown、UI 或 LLM prompt。
- 禁止用中文名稱當程式 key。

## 測試

每條 canonical rule 需對應 golden fixture 或 unit test。提交前執行：

```bash
npm run test && npm run validate:rules && npm run validate:sources
```
