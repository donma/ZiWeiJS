# External Strength Assimilation

本目錄為 **Post-Stability External Strength Assimilation Phase** 的研究區（spec §5）。

> 這不是把外部 library 當 dependency，也不是 Fork / 複製 / 拼裝。
> 唯一目的是：**研究外部專案的長處 → 重新表達為 ZiWeiJS 自己的 Rule / Variant / Engine / Test / Dataset Metadata。**

## 流程（spec §4）

```text
External Project
      ↓
Capability Inventory        （capability-inventory.md）
      ↓
ZiWeiJS Gap Comparison      （tools/assimilation/star-gap-audit.ts 等）
      ↓
Assimilation Candidate      （candidates.json，status=research）
      ↓
Normalize to ZiWeiJS Model
      ↓
Independent Source / Evidence Research
      ↓
Candidate Rule / Entity / Variant
      ↓
Unit / Property / Golden / Differential
      ↓
Owner Review
      ↓
Canonical / Variant / Reject
```

禁止 `External Repo → Canonical`。

## 目錄結構

```text
research/assimilation/
  README.md
  external-projects.json      研究對象與 areasUsed（snapshot 的輸入）
  rejections.json             明確拒絕清單（§45/§46）
  star-gap.json               star-gap-audit 產出（星曜 Gap Detector）
  pattern-gap.json            pattern-gap-audit 產出（格局 Gap Detector）
  external-capability-report.json  external-capability-report 產出（license 界線 / 產出物盤點）
  <project>/
    snapshot.json             真實 repo metadata（commit / license / capturedAt）
    capability-inventory.md   該專案能力盤點與採用決策
    candidates.json           內化候選（初始 status=research）
    rejected.json             指向 rejections.json 的拒絕項
    external-star-names.json  （選用）外部星名清單，供 gap audit
    external-pattern-names.json （選用）外部格局名稱清單，供 pattern gap audit
    zhongzhou-diff.json       （fortel/）中州 Diff Matrix：12 維度實跑對照
```

## Gate（spec §3）

外部能力至少符合一項才可進 Research Queue：

```text
補真實缺口 / 增加獨立流派 / 擴充可考證資料 / 增加獨立驗證 / 提升 SDK 可用性
```

以下一律拒絕：只是別人也有、只是寫法不同、換 UI framework、第二套 Calendar、
第二套 AI Prompt、無 Evidence 斷語、同星換名重複存、把 Cycle/Stage 誤當 Star。

## 污染防線（spec §6 / §44）

- 正式 `src/` **不得** `import` 外部排盤套件（iztro / fortel …）。
- 外部套件只允許存在 `devDependencies` 與 `tools/` 的 differential / research 用途。
- 禁止 `src/vendor/*`。
- 不得新增第二套 Calendar / Relation / Pattern / Transformation / Interpretation / Star ID / Profile / Renderer。

## License（spec §41）

| 授權 | 專案 | 規則 |
|---|---|---|
| MIT | iztro / fortel / cdestiny / ziwei-doushu | 研究 → 自己實作；若保留 substantial code 須附 MIT notice |
| GPL-3.0 | ziwei-chart | **禁止複製程式碼**，只可研究後重新設計 |
| 不明 | ziwei-doushu-simple | 只研究，不 copy |

## Evidence 分層（spec §42）

```text
Layer 1  Historical / Textual      古籍、正式出版、可靠教材
Layer 2  Independent Implementations  iztro、Fortel、其他排盤
Layer 3  Generated / Empirical      大型 dataset、sample output
```

外部 implementation 只支持「現代實作共識」，**不能**直接支持「古籍標準就是如此」。
Canonical Promotion 不可只靠 Layer 3。

## 指令

```bash
npm run assimilation:snapshot          # 抓取 repo metadata（需網路，手動執行）
npm run assimilation:snapshot:check    # 比對 snapshot 是否漂移
npm run assimilation:star-gap          # 產生 star-gap.json
npm run assimilation:star-gap:check    # 檢查 star-gap 未漂移
npm run assimilation:pattern-gap       # 產生 pattern-gap.json
npm run assimilation:pattern-gap:check # 檢查 pattern-gap 未漂移
npm run assimilation:capability-report # 產生 external-capability-report.json
npm run assimilation:capability-report:check
npm run assimilation:zhongzhou-diff     # 產生中州 Diff Matrix
npm run assimilation:zhongzhou-diff:check
npm run profiles:gap                    # Profile 欄位實作盤點（tools/assimilation/profile-gap-audit.ts）
npm run validate:catalogs              # 驗證 cycles / aliases / candidates / rejections / snapshots
```

`assimilation:snapshot` 需要網路，因此**不在** `npm run verify`；其餘皆納入 `verify` 與 CI。

## PR 必填（spec §51）

```text
External project / version
Studied capability
ZiWeiJS current gap
Why this adds value
Why existing ZiWeiJS module cannot already do it
What is being assimilated
What is explicitly NOT being copied
ZiWeiJS Rule IDs
Source / Evidence
Tests / Differential
License review
Owner decision required
```

沒有這份說明，不得 merge。任何候選初始狀態一律 `research`，AI 不得自行升為 `canonical`。
