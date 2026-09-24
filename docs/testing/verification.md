# 驗證體系（Verification）

本文件說明 ZiWeiJS 如何證明「每一個結果都可回答：為什麼、哪條 Rule、哪一版、哪個 Profile、
哪個 Source、哪個 Evidence、哪個 Test 驗證過」。

驗證分為六層：**結構 → 治理 → 契約 → 版本 / 研究 → 差分 → 測試 → 視覺 / 無障礙**。

> **本文件不手寫會頻繁漂移的統計數字。** 實際數量一律以指令輸出為準：
> `npm run coverage:bible`、`npm run differential`、`npm run differential:period`、
> `npm run differential:calendar`。

## 1. Gate 順序

`npm run verify`（= `package.json` 的 `verify`）依序執行，**順序與 `.github/workflows/build.yml`
完全一致**：

| # | 指令 | 驗證內容 |
|---|------|----------|
| 1 | `npm run validate:rules` | Rule 欄位、ID 格式、生命週期一致性 |
| 2 | `npm run validate:sources` | Source / Evidence schema 與引用（含 AI-source 阻擋） |
| 3 | `npm run validate:schemas` | `chart.schema.json` 嚴格驗證 + `variants/differential.json`、`research/registry.json` |
| 4 | `npm run validate:governance` | Canonical Evidence Gate、variantOf、AI 來源阻擋 |
| 5 | `npm run validate:integrity` | ID 唯一、ref 可解析、executor 可解析、DSL schema、計畫覆蓋、changeLog |
| 6 | `npm run validate:versions` | Rule Version Gate：`changeLog[0] == ruleVersion`、版本遞減、behavior-change 必升版 |
| 7 | `npm run validate:research` | Research Queue：ID 唯一、relatedRules / evidence 可解析、resolved 需有 resolution |
| 8 | `npm run validate:catalogs` | Cycles / aliases / assimilation candidates / rejections / snapshots schema 與交互參照 |
| 9 | `npm run assimilation:star-gap:check` | Star gap report 未漂移（stage / cycle-deity / year-deity 不得誤判為缺星） |
| 10 | `npm run differential:calendar -- --check` | 曆法差分 fixture 與現行實作不得漂移 |
| 11 | `npm run differential` | 安星即時對照 `iztro`（live） |
| 12 | `npm run differential:period` | 五層限運即時對照 `iztro`（live），未登錄差異即 fail |
| 13 | `npm run verify:golden` | Golden v2 + Period Golden `--check`（oracle 與外部驗證不得漂移） |
| 14 | `npm run test` | Vitest 全測試（含 `tests/property/` invariants） |
| 15 | `npm run build` | app + library + types + `bible-manifest.json` |

CI（`.github/workflows/build.yml`）在 push 時執行與上表相同的 Gate 順序（另加 `npm run coverage:bible`
於 `validate:research` 之後），並於 `npm run build` 之後執行 `npm run release:smoke`，
再安裝 **chromium / firefox / webkit** 執行 `npm run test:a11y`，最後 `node tools/build-standalone.mjs`
產生 `dist/ziwei-bible-demo.html` 並部署 Pages。

CI 的實際 step 清單：

```text
validate:rules
validate:sources
validate:schemas
validate:governance
validate:integrity
validate:versions
validate:research
validate:catalogs
assimilation:star-gap:check
coverage:bible
differential:calendar -- --check
differential
differential:period
verify:golden
test
build
release:smoke
Playwright install（chromium / firefox / webkit）
test:a11y
node tools/build-standalone.mjs
Pages deploy
```

> CI 與 `npm run verify` 的治理 Gate **完全一致**：`verify` = validate:rules → sources → schemas →
> governance → integrity → versions → research → catalogs → star-gap:check → differential:calendar →
> differential → differential:period → verify:golden → test → build；CI 另加 `coverage:bible` 與 `release:smoke`。

## 1.1 Release Gate（`npm run release:check`）

在 `verify` 之上，Final Stabilization 追加發佈層驗證：

```bash
npm run release:check          # = npm run verify && npm run release:smoke
npm run release:smoke          # artifact smoke + package smoke
```

- **Artifact smoke**（`tools/release-validator/artifact-smoke.ts`）：
  驗 `dist/` 五項產物存在、ESM bundle 可 import 並實際 `calculate()`、
  `schemaVersion` / `bibleVersion` / `engineVersion` 正確、
  `dist/bible-manifest.json` 的版本與 rules / profiles 數量與 Registry 一致。
- **Package smoke**（`tools/release-validator/package-smoke.ts`）：
  `npm pack` 產生真實 tarball → 確認 `files[]` 含必要產物 →
  解開到 `node_modules` → 以 bare specifier `import 'ziwei-bible'` →
  排盤成功，模擬第三方 consumer 安裝。

兩者已納入 CI：`build.yml` 在 `npm run build` 之後執行 `npm run release:smoke`（再繼續 A11y 與 Pages）。

## 1.2 Integrity Tests（`tests/integrity/`）

`tests/integrity/integrity.test.ts` 與 `npm run validate:integrity` **共用同一份實作**
（`tools/integrity-validator/checks.ts`），因此規則 / 來源 / 證據 / profile / 星曜 registry
的任何破壞都會同時擋下 `npm test` 與 CI gate，不會出現「gate 過但測試沒過」的分歧。

檢查項目即 spec §25 清單：ID 唯一（rule / star / source / evidence / profile）、
`sourceRefs` / `evidenceRefs` / `variantOf` / `executor` 全可解析、canonical rule 有 source 與 evidence、
canonical star 有 source、profile override 來源與目標存在、DSL / star / chart schema 合法、
執行計畫覆蓋（0 unplanned）、changeLog 與 ruleVersion 一致。

## 1.3 Determinism（spec §26）

`tests/unit/engine.test.ts` 的 determinism 區塊要求 `JSON.stringify(calculate(input))`
**連同 `periods` 完全一致** —— 不得再靠 strip periods 才 deterministic。
這是 P0-3「移除隱含 `new Date()`」的驗收條件。

## 1.4 Regression Checklist（spec §37）

`tests/regression/spec37.test.ts` 把規格列出的驗收清單逐條寫成測試：

```text
無時辰 → error                       未知性別 → 不得偷偷 forward
無 targetDate → 不產流年             targetDate 改變 → active period 改變
真太陽時 00:10 → 前日                真太陽時 23:55 → 次日
23:00 midnight vs zi-hour → 不同      DSL typo → error
profile override 真的影響 output      Trace 自動帶 source / evidence / version
```

瀏覽器層另外執行：

```bash
npm run test:a11y     # Accessibility（axe + 鍵盤；3 引擎）
npm run test:visual   # UI / Visual regression（Chromium 快照）
```

## 2. 治理驗證（Governance）

- **Canonical Evidence Gate**：規則升為 `canonical` 需具備 Tier1 / Tier2 來源證據，或 2 條以上 Tier3。
- **AI 來源阻擋**：AI 產出永遠不是合法 Evidence Source，不得作為 canonical 依據。
- **AI 不得自行升格**：升為 `canonical` 僅能由 owner 執行；AI 只能提出 `candidate` 並附 research 項目。
- **Research 一致性**：`npm run validate:research` 檢查 research 參照與狀態（`resolved` 需有 `resolution`
  且 `ownerReviewRequired=false`；`candidate` 需 `ownerReviewRequired=true`）。

## 3. 契約驗證（Schema）

`schemas/` 下為公開契約，`additionalProperties: false` + `extensions` 逃生口：

```text
chart.schema.json                 盤面輸出（含 trace / calendar / periods / provenance）
dsl.schema.json                   Rule DSL 全部 operator 與必要參數
star.schema.json                  星曜
pattern.schema.json               格局
evidence.schema.json              證據（location 可為結構化物件，含版本欄位）
rule.schema.json                  規則
source.schema.json                文獻來源（含 editions）
profile.schema.json               Profile（含 yearBoundaryPolicy）
research.schema.json              Research Queue（resolved 需 resolution）
differential-variance.schema.json Variance Registry
interpretation.schema.json        解讀規則
trace.schema.json                 Trace entry
```

`schemaVersion` 目前為 `2.0`。

## 4. 差分驗證（Differential）

差分是「不信任單一實作」的具體手段。四組差分（**規模以即時輸出為準**）：

| 對象 | 方法 |
|------|------|
| 安星正確性 | 與 `iztro@2.6.1` 對照（30 案例，natal） |
| 安星快照 | `fixtures/differential/iztro/*.json`（CI 不需外部套件） |
| 限運（大限/流年/流月/流日/流時） | `tools/differential-runner/iztro-period-runner.ts`（5 案例，各 scope 的 stem/branch/lifePalaceBranch/sihua） |
| Candidate 星曜（台輔/封誥/年解） | `tests/differential/candidate-stars.test.ts`：`IZTRO_CASES` 全案例 100% 一致（僅證明實作一致，非 canonical 依據） |
| 曆法層 | `lunar-typescript@1.8.6` vs `lunar-lite@0.2.8`，逐日 1900-01-31 ~ 2100-12-31 |

### 限運差分（spec 2nd §P0-9 / 3rd §P0-5）

```bash
npm run differential:period                        # 即時比對（需 iztro），gate fail-close
npm run differential:period -- --write-fixtures     # 更新存檔
```

比對欄位：`stem` / `branch` / `lifePalaceBranch`（限運命宮疊盤位置）與 `sihua.lu|quan|ke|ji`。

差異一律分類，**禁止 `unclassified` 進入通過狀態**：

```text
school-variance | calendar-variance | time-basis-variance |
day-boundary-variance | leap-month-variance | bug | external-error
```

Gate 規則（`tools/differential-runner/period-gate.ts`，由 `tests/differential/iztro-period-gate.test.ts` 驗證）：

- `bug` / `unclassified` → **fail**
- `external-error` → **fail**（需 allowlist 才能忽略）
- 已知 variance 分類 → 必須登錄於 `variants/differential.json`，否則 **fail**
- `acceptedByOwner` 一律由 owner 核可；AI 不得設為 `true`

存檔位於 `fixtures/differential/iztro-period/`，由 `tests/differential/iztro-period.test.ts` 驗證
（CI 不需要 iztro 也能跑）：0 unclassified，且引擎現行輸出與存檔 oracle 一致。

### 曆法差分（P2-6）

```bash
npm run differential:calendar             # 重新產生 fixtures/calendar/
npm run differential:calendar -- --check   # 驗證 fixture 未漂移（CI 使用）
```

產出：

```text
fixtures/calendar/calendar-differential.json   逐日農曆 / 日柱 / 月柱 / 年柱 / 閏月
fixtures/calendar/day-boundary.json            子時換日、午夜換日、真太陽時跨日
fixtures/calendar/timezone-dst.json            歷史時區 / DST（人工查證 IANA 事實）
```

結果：**0 未解釋差異**。所有差異皆歸類為已知慣例並逐筆驗證：

- `year-boundary-convention:day1-vs-lichun`：本引擎採農曆正月初一換年，`lunar-lite` 預設採立春。
- `zi-hour-boundary-convention`：23:00 起子時之日歸屬。

## 5. Golden Fixtures（Oracle）

`fixtures/golden/golden-*.json` 為完整 oracle，含 `verified` 區塊。
產生器（`tools/fixture-generator/generate-v2.ts`）**必須先通過 iztro 外部對照才寫入**，
且禁止 `_computed_` 這類自我引用欄位 —— 否則 oracle 只是實作的鏡像，沒有驗證價值。

`fixtures/golden-period/period-*.json` 另附 `external` 外部驗證中繼資料
（`verified` / `variance` / `engine-only`）；產生器（`generate-period.ts`）在寫入前對
iztro 交叉驗證，未登錄之差異即產生失敗。`--check` 同時偵測 oracle 與外部驗證漂移。

## 6. 無障礙（P2-5）

`tests/visual/a11y.e2e.ts` 涵蓋：

```text
keyboard       Tab 順序 nav → 表單欄位 → 送出；Enter 可提交
focus          面板開啟 / 關閉後焦點處理
aria           tooltip / dialog / aria-modal / SVG 名稱
dialog drawer bottom-sheet   Esc 關閉
contrast       WCAG 2.0/2.1 A+AA，serious / critical = 0
touch target   ≥ 24x24 CSS px（WCAG 2.5.8；內文 inline 連結豁免）
```

**SVG 星曜互動不得只支援滑鼠**：`<g role="button">` 不會因 `Enter` 自動觸發 `click`，
因此星曜另綁 `Enter` / `Space`，並可被 Tab 聚焦。

## 7. 視覺回歸（P2-4）

`tests/visual/ui.e2e.ts` 於 6 個 viewport 檢查水平溢出與版面，並保存快照：

```text
375x812  390x844  768x1024  1024x768  1440x900  1920x1080

home  chart-standard  chart-expert  dark  tooltip  bottom-sheet  rules  sources  geek
```

另檢測「同宮星曜文字方塊不得相交」，防止星曜重疊。

視覺快照的 baseline 與作業系統字型相關，因此只在本地 / 相同環境執行；
CI 只跑不受字型影響的無障礙測試。

## 8. Candidate 星曜 / 小限（Assimilation Phase B / C）

外部缺星清單不得直接進 canonical。本次查核《紫微斗數全書》卷二「安星訣」原文：

| 項目 | 古典依據 | 處置 |
|------|----------|------|
| 台輔、封誥 | 有（午起子時順、寅起子時順） | candidate 規則 `ZW.CALC.STAR.TAIFU_FENGGAO.001` |
| 解神（年解） | 有（戌起子逆至生年太歲） | candidate 規則 `ZW.CALC.STAR.JIESHEN.001` |
| 小限 | 有（寅午戌起辰…男順女逆） | candidate 規則 `ZW.CALC.PERIOD.XIAOXIAN.001` |
| 天巫、天才、天壽 | **查無**（全書卷二未載） | 不實作，僅 Research Queue |
| 月解、童限 | 未取得 / 語意未定 | 不實作，僅 Research Queue |

- candidate 規則一律 `status: "candidate"` + `stage: "on-demand"`，**不進入** `NATAL_EXECUTION_PLAN` / `PERIOD_EXECUTION_PLAN`，
  故 canonical 盤面與 golden oracle 不變；`tests/unit/candidate-stars.test.ts` 對此設有護欄。
- 升 canonical 為 **Owner 專屬**動作（AI 不得自行升級，spec §1.3 / §56）。
- 來源與證據：`SRC.QUANSHU.WIKISOURCE`（tier 3，電子文本未校勘）、`EVD.QUANSHU.{TAIFU,FENGGAO,JIESHEN,XIAOXIAN}`，
  以及負向查核 `EVD.QUANSHU.CLASSICAL-VERIFICATION.MISSING`（absence of evidence）。
- 詳見 `research/assimilation/classical-verification.md` 與 `classical-basis.json`。
