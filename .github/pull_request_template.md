## Assimilation PR 必填說明（spec §51）

> 本 Phase（Post-Stability External Strength Assimilation）之每個 PR 都必須完整回答以下欄位。
> 未填寫者不得 merge。純內部修正（非 Assimilation）請於 `External project` 填 `n/a` 並說明範圍。

```
External project:
External version:
Studied capability:
ZiWeiJS current gap:
Why this adds value:
Why existing ZiWeiJS module cannot already do it:
What is being assimilated:
What is explicitly NOT being copied:
ZiWeiJS Rule IDs:
Source/Evidence:
Tests:
Differential:
License review:
Owner decision required:
```

### 各欄位要求

| 欄位 | 要求 |
| --- | --- |
| External project | 外部專案名稱（須存在於 `research/assimilation/external-projects.json`） |
| External version | commit / tag / package version（須與 `snapshot.json` 一致） |
| Studied capability | 具體能力（例：minor period 定位），不可寫「整體架構」 |
| ZiWeiJS current gap | missing / partial，並說明現況 |
| Why this adds value | 覆蓋率 / 驗證力 / SDK，禁止空泛行銷語 |
| Why existing ZiWeiJS module cannot already do it | 必須指名既有模組並說明不足 |
| What is being assimilated | 僅限**規則、資料表、介面契約**；不得是程式碼 |
| What is explicitly NOT being copied | 逐項列出未採用部分（UI / 框架 / dataset …） |
| ZiWeiJS Rule IDs | canonical 規則 ID；candidate 不得以 canonical 形式呈現 |
| Source/Evidence | Tier1/2 或 2× 獨立 Tier3；無 Evidence 不得升 canonical |
| Tests | 新增／更新之測試檔案與案例數 |
| Differential | 對照來源、案例數、差異分類（不得只寫「一致」） |
| License review | GPL-3.0 / UNKNOWN 之界線（見 `research/assimilation/external-capability-report.json`） |
| Owner decision required | `status: pending/approved/rejected` + 日期；AI 不得自填 approved |

### 禁止事項（spec §52）

- 外部 runtime dependency、GPL 程式碼混入、重複 Engine
- cycle / star taxonomy 混亂（一律先過 alias registry）
- 假古籍 Evidence、generated dataset 當真理、來源不明的精準百分比
- AI 自行將規則升為 `canonical` 或自填 `acceptedByOwner: true`

### 檢查清單

- [ ] `npm run verify` 全綠（含 assimilation / variants / patterns / profiles / stats gates）
- [ ] `npm run release:check` 全綠
- [ ] 若動到 `src/`：已重建 `dist/`（`npm run build` + `node tools/build-standalone.mjs`）
- [ ] 相關研究文件已更新（`research/`、`docs/testing/verification.md`、`CHANGELOG.md`）
