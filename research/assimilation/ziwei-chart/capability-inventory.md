# ziwei-chart — Capability Inventory

- Repo：`ziweiknows/ziwei-chart`（**GPL-3.0**）— 見 `snapshot.json`
- 定位：React 產品、AI、Knowledge Retrieval、合盤 / 趨勢

## 只學設計，不複製程式碼（spec §31 / §33）

值得研究：

```text
Chart Facts → Signals → Knowledge Retrieval → Task-specific Context → LLM
Knowledge Entry 欄位：domain / entities / appliesTo / topics / priority /
                     guidance / taskFit / source / confidence / reviewStatus
```

對應候選：`ASM.AI.TASK_CONTEXT`。**不建第二套 Knowledge DB**，改為建在既有
Interpretation Rule Graph / Domain / Pattern Hits / Period Scope / Source-Evidence / `AI.toContext()` 之上。

## Product Layer only（spec §32）

```text
合盤 UI / 年度趨勢 / Life K-Line / 分享卡 / AI streaming / 設定面板
```

放 `ui/experimental/` 或未來獨立 Product Repo；不得污染 Reference Engine / rules / tables。

## 明確拒絕（spec §33）

```text
GPL 程式碼
fortune-score（財運 92 / 感情 71 之類 fake precision）
true-solar helper
另一套 Knowledge DB / 另一套排盤 Engine
```
