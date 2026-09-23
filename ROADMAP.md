# Roadmap

## Done

### 基金骨架（Milestone 0.1）
- [x] Browser 開啟、輸入生日、離線 RWD SVG 排盤
- [x] hover 顯示 tooltip / 手機 tap bottom sheet
- [x] Standard / Expert 模式
- [x] Expert Rule Trace
- [x] Chart JSON 輸出
- [x] Unit / Golden / Boundary / Differential 測試框架
- [x] Rule / Source Explorer

### Hardening 第一輪（0.4.0）
- [x] Rule 真控制 Engine（execution plan 由 `logic.stage` / `logic.order` 產生）
- [x] Profile 真控制 Rule（`ruleOverrides` → variant 實際執行）
- [x] 未知輸入不偷猜（`UNKNOWN_BIRTH_TIME` / `UNKNOWN_SEX_FOR_CALCULATION` / `direction: undetermined`）
- [x] Period 不依賴錯誤預設（`periods.active.major`、無 `targetDate` 不產限運）
- [x] Rule DSL fail-close（`UNKNOWN_DSL_OPERATOR` / `INVALID_DSL`）
- [x] Interpretation conflict / override 真實處理
- [x] Canonical Evidence Gate（canonical 全部有 source + evidence）
- [x] Golden fixtures ≥ 30（目前 43）
- [x] Differential 可自動跑（iztro 安星對照 + 存檔 fixtures）
- [x] CI：schema / governance / integrity / golden / differential
- [x] Research Pipeline guard（AI 不得升 canonical）
- [x] docs/（architecture / api / governance / testing）

### Hardening 第二輪
- [x] 限運目標單一正規化來源（`normalizePeriodTarget`）
- [x] 流月 / 流日改用農曆語意（非 Gregorian month / day）
- [x] 移除核心 engine 的 `new Date()` fallback
- [x] `targetDate` 真實日期驗證（2025-02-29 / 2026-04-31 → `INVALID_TARGET_DATE`）
- [x] `TargetDate.minute` 正式支援（含 0..59 驗證）
- [x] `leapMonthPolicy` 真正影響演算法（含 `split` → `UNSUPPORTED_PROFILE`）
- [x] Profile 移除假控制欄位（`starRules` / `dignityRules` / `transformationPolicy`）
- [x] 限運 differential（大限 / 流年 / 流月 / 流日 / 流時）
- [x] Golden verified / engine-only 分開統計；`--check` 會偵測 oracle drift
- [x] 星曜覆蓋改為實測（95/96，未安者為 deprecated）
- [x] Research Queue 公開 API（`ZiWei.Research.list/get/forRule/hasOpen`）
- [x] `classifyDifference` 為真實 classifier（非永遠 unclassified）
- [x] Firefox / WebKit smoke + a11y coverage

## In progress

- [ ] 流派變體擴充（三合 / 飛星 / 欽天四化差異）— 骨架已具備，內容待補
- [ ] 格局庫擴充（目前 24，目標 40+，每條需 evidence）
- [ ] 限運 golden 覆蓋擴大（目前 10 筆）

## Next

- [ ] npm publish pipeline
- [ ] Rule versioning tooling + migration
- [ ] MingLiCore 整合（與 BaziJS 一致，另行規劃）
- [ ] Rectification 精確度規則
- [ ] Evidence 定位升級（版本 / 卷 / 章 / 頁 / anchor）
- [ ] 外部研究自動化 ingestion
      （目前 guard 已完成：AI 不得升 canonical；自動抓取外部文獻尚未實作）
