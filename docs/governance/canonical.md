# Canonical（canonical 規則門檻）

## 什麼是 canonical

`canonical` 代表「本專案認可的預設行為」。它**不是**「已完全驗證的真理」。
升為 canonical 需要同時滿足來源、證據、測試與 owner 覆核。

## 門檻（`npm run validate:governance` 強制）

```text
✓ ≥1 sourceRef，且 Tier 1–3
✓ ≥1 evidenceRef（且不得為 conflicts-only）
✓ 建議強度：1 個 Tier 1/2，或 2 個獨立 Tier 3
✓ changeLog 最新版本 == ruleVersion
✓ 測試通過（golden / differential 無未知回歸）
✓ Owner 覆核
```

唯一例外：**工程契約類規則**（`tags` 含 `engine-contract`）可用 `SRC.SPEC.ENGINE`，
但該來源明文禁止用於安星、四化、廟旺、格局等命理規則。

## AI 不得升級

`src/ai/research.ts` 的護欄：

```ts
canAdvance(stage)        // AI 不得進入 owner-review / canonical
canPromoteStatus(status) // AI 不得把 candidate / variant 升為 canonical
```

AI 可以做的：

```text
✓ 新增 candidate / research 規則
✓ 補 source / evidence / changeLog / tests
✓ 標記衝突並提出研究項目（research/registry.json）
✗ 自行宣稱 canonical
✗ 移除既有 evidence 以通過 gate
```

## 目前狀態

```text
canonical : 34 / 209
candidate : 168
variant   : 5
research  : 2
```

canonical 的 source / evidence 覆蓋率皆為 **100%**（由 governance gate 保證）。
大量 `candidate` 代表「已實作且有來源，但尚未取得 owner 覆核」——這是誠實的狀態標記。

## 降級也是治理行為

若發現 canonical 的溯源不足，**應降為 candidate**，而不是放寬 gate。
實例：`ZW.CALC.CALENDAR.TRUESOLAR.001` 因僅有單一 Tier 3 來源、
且均時差為近似式，已由 canonical 降為 candidate（見 `research/registry.json` RSH.007）。
