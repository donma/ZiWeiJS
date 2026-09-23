# Rule Execution（規則執行架構）

> 本文件說明 Hardening P0-1 之後的執行模型：**規則資料是唯一真實來源**。

## 核心原則

```text
Rule JSON  →  Rule Registry  →  Execution Plan  →  executeRule()  →  Executor  →  Trace
```

Engine 不再直接呼叫 executor 函式。`src/reference-engine/engine.ts` 只做三件事：

1. 正規化輸入（曆法層）
2. `executePlan(NATAL_EXECUTION_PLAN, ctx)` 與 `executePlan(PERIOD_EXECUTION_PLAN, ctx)`
3. 組裝公開 chart 物件

## 執行計畫由資料產生

`src/rule-engine/execution-plan.ts` 掃描 Rule Registry：

```ts
rules.filter(r => r.logic.stage === 'natal' && r.logic.executor)
     .sort((a, b) => a.logic.order - b.logic.order)
```

因此**改 JSON 就能改行為**：

| 想要的效果 | 修改方式 |
|---|---|
| 新增一個安星步驟 | 新增規則 JSON，填 `logic.executor` + `logic.stage` + `logic.order` |
| 改變執行順序 | 調整 `logic.order` |
| 停用某步驟 | 規則 `status` 改為 `deprecated`（executeRule 會標記 skipped） |
| 某步驟只在目標日期存在時執行 | 規則 `logic.stage: "period"`（executor 自行回報 skipped） |

## stage 種類

| stage | 用途 | 進入計畫 |
|---|---|---|
| `natal` | 本命盤計算 | ✅ |
| `period` | 限運（需 `targetDate`） | ✅ |
| `variant` | 流派變體，只能經 `profile.ruleOverrides` 觸發 | ❌ |
| `on-demand` | API 觸發（關係查詢、矯正） | ❌ |
| `analysis` | 解讀與格局（由 analysis engine 逐條評估） | ❌ |
| `unplanned` | 未分類（integrity validator 會擋） | ❌ |

## executeRule()

```ts
executeRule(ruleId, ctx)
```

1. `getRule(ruleId)` — 不存在 → `RULE_NOT_FOUND`
2. `resolveRuleForProfile(ruleId, profile)` — profile 覆寫 → 實際執行 variant
3. status 檢查：`deprecated` / `undetermined` → 記 trace `skipped` 後結束
4. `getExecutor(rule.logic.executor)` — 未註冊 → `RULE_EXECUTOR_NOT_FOUND`
5. 執行，將回傳值正規化為 outcomes
6. **Trace 中介資料全部由 Rule Registry 帶入**

## Executor 契約

Executor 只回傳：

```ts
interface ExecutorOutcome {
  inputs?: Record<string, unknown>;
  result: unknown;
  status?: 'executed' | 'skipped' | 'unavailable' | 'variant' | 'error';
  reason?: string;
  note?: string;
}
```

**不得**自行填 `ruleId` / `ruleVersion` / `profile` / `sourceRefs` / `evidenceRefs`。
這些由 `executeRule` 從規則 JSON 讀取後寫入 trace —— 也就是說，
**規則改了來源，trace 自動跟著改**，不會出現程式與資料不一致。

## 執行狀態（spec §28）

每筆 trace entry 都帶 `status`：

| status | 意義 |
|---|---|
| `executed` | 正常執行 |
| `variant` | 因 profile 覆寫而執行 variant |
| `skipped` | 條件不足（例如沒有 `targetDate` 的流月） |
| `unavailable` | 資訊不足無法判定（例如性別未知 → 大限） |
| `error` | DSL 或 executor 錯誤（**不得靜默視為 false**） |

## 驗證

- `npm run validate:integrity` — 計畫中的 executor 必須存在、calculation 規則必須有 stage、無 deprecated 進計畫
- `tests/unit/rule-execution.test.ts` — canonical / variant / 覆寫 / trace 中介資料 / 未註冊 executor
- `npm run coverage:bible` — 顯示各 stage 規則數
