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
| 5 | `npm run validate:integrity` | ID 唯一、ref 可解析、executor 可解析、DSL schema、計畫覆蓋、changeLog、**isolation（外部排盤套件 / vendor 污染防線）** |
| 6 | `npm run validate:versions` | Rule Version Gate：`changeLog[0] == ruleVersion`、版本遞減、behavior-change 必升版 |
| 7 | `npm run validate:research` | Research Queue：ID 唯一、relatedRules / evidence 可解析、resolved 需有 resolution |
| 8 | `npm run validate:catalogs` | Cycles / aliases / assimilation candidates / rejections / snapshots schema 與交互參照 |
| 9 | `npm run validate:variants` | Variant Research Catalog：維度涵蓋、profile 欄位 / variant 參照可解析、未建模必附 Research ID |
| 10 | `npm run validate:patterns` | Pattern Research Backlog：古典原文必填、research 必附 Research ID、implemented 必可解析 |
| 10b | `npm run patterns:packet:check` | Pattern Decision Packet：readiness 分類與 backlog 一致、ownerDecision 不得被 AI 填寫 |
| 11 | `npm run profiles:gap:check` | Profile Gap Audit：schema 欄位 / enum 與 runtime 實作盤點不得漂移 |
| 12 | `npm run assimilation:star-gap:check` | Star gap report 未漂移（stage / cycle-deity / year-deity 不得誤判為缺星） |
| 13 | `npm run assimilation:pattern-gap:check` | 格局 Gap：外部格局名稱必被古典 backlog 追蹤；equivalent 必指向真實 pattern 規則 |
| 14 | `npm run assimilation:candidate-checklist:check` | §49 候選清單：知識型候選必附 researchId、非 research 狀態必有 Owner decision |
| 15 | `npm run assimilation:capability-report:check` | 外部能力報告未漂移（license 界線 / commit / 產出物盤點須與 snapshot 一致） |
| 16 | `npm run assimilation:zhongzhou-diff:check` | 中州 Diff Matrix 未漂移（12 維度 × 3 probe 實跑值） |
| 17 | `npm run stats:distribution:check` | 分佈報告未漂移（1900–2100 每 5 日一盤，14,683 盤） |
| 18 | `npm run differential:calendar -- --check` | 曆法差分 fixture 與現行實作不得漂移 |
| 19 | `npm run differential` | 安星即時對照 `iztro`（live） |
| 20 | `npm run differential:period` | 五層限運即時對照 `iztro`（live），未登錄差異即 fail |
| 21 | `npm run verify:golden` | Golden v2 + Period Golden `--check`（oracle 與外部驗證不得漂移） |
| 22 | `npm run test` | Vitest 全測試（含 `tests/property/` invariants、`fuzz/`、large corpus） |
| 23 | `npm run build` | app + library + types + `bible-manifest.json` |

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
validate:variants
validate:patterns
patterns:packet:check
profiles:gap:check
assimilation:star-gap:check
assimilation:pattern-gap:check
assimilation:candidate-checklist:check
assimilation:capability-report:check
assimilation:zhongzhou-diff:check
stats:distribution:check
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
> governance → integrity → versions → research → catalogs → variants → patterns → patterns:packet:check → profiles:gap:check →
> assimilation:star-gap:check → pattern-gap:check → candidate-checklist:check → capability-report:check →
> zhongzhou-diff:check → stats:distribution:check → differential:calendar → differential → differential:period →
> verify:golden → test → build；CI 另加 `coverage:bible` 與 `release:smoke`。

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
| 補充星曜（台輔/封誥/年解）與小限 | `tests/differential/aux-supplementary.test.ts`：`IZTRO_CASES` ＋ golden fixtures（civil 時制、29 案）100% 一致；小限另比對 iztro `horoscope().age`（29 案 × 2 目標日） |
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

## 8. 補充星曜：台輔／封誥／解神（canonical）與小限（canonical）

spec §18「第一批真正值得研究的 Missing Stars」共六顆（封誥／解神／台輔／天才／天壽／天巫；
M2 = 「第一批六顆 + Placement + Evidence + UI + Tests」）。目前狀態：

| 批次 | 狀態 |
|------|------|
| 台輔、封誥、解神 | **已 canonical**（Placement + Evidence + UI + Tests + differential 全備） |
| 天才、天壽、天巫 | **阻塞**：兩份獨立電子文本查無安法 → 不實作，僅留 Research Queue（`RSH.STAR.{TIANCAI,TIANSHOU,TIANWU}`）與 iztro-only `mentions` 記錄 |

M2 之完成定義因此為「3 顆落地 + 3 顆具名阻塞並留痕」，其餘不得以外部實作共識充當古典依據（spec §18.1 / §42）。

外部缺星清單不得直接進 canonical。本次查核《紫微斗數全書》卷二「安星訣」原文：

| 項目 | 古典依據 | 處置 |
|------|----------|------|
| 台輔、封誥 | 有（午起子時順、寅起子時順） | **canonical** `ZW.CALC.STAR.TAIFU_FENGGAO.001`（Owner 2026-09-24 批准） |
| 解神（年解） | 有（戌起子逆至生年太歲） | **canonical** `ZW.CALC.STAR.JIESHEN.001`（Owner 2026-09-24 批准） |
| 小限 | 有（寅午戌起辰…男順女逆） | **canonical** `ZW.CALC.PERIOD.XIAOXIAN.001`（Owner 2026-09-24 批准，`chart.periods.xiaoxian`） |
| 天巫、天才、天壽 | **查無**（全書卷二未載） | 不實作，僅 Research Queue |
| 月解、童限 | 未取得 / 語意未定 | 不實作，僅 Research Queue |

- canonical 三顆星已進 `NATAL_EXECUTION_PLAN`（golden v2 oracle 35 fixtures 已重生）；小限已進 `PERIOD_EXECUTION_PLAN`（`chart.periods.xiaoxian`）。
- 差分（M2 外部驗證廣度）：`tests/differential/aux-supplementary.test.ts` 將案例擴大為 `IZTRO_CASES` ＋
  `fixtures/golden/*.json`（陽曆、時辰已知、civil 時制，共 29 案）：台輔／封誥／年解 87 組全數一致；
  小限對比 iztro `horoscope().age`（29 案 × 2 目標日）虛歲 100% 一致。真太陽時／`timeConvention !== 'civil'`
  案例（iztro `bySolar()` 不支援經度）明確排除，改由 golden oracle 驗證；未來出生案例則驗證 fail-close
  為 `INVALID_TARGET_DATE`。
- 升 canonical 為 **Owner 專屬**動作（AI 不得自行升級，spec §1.3 / §56）；本次四項均經 Owner 於 2026-09-24 明確批准。
- 來源與證據：**兩份互相獨立的 Tier3 電子文本** —— `SRC.QUANSHU.WIKISOURCE`（維基文庫）與
  `SRC.QUANSHU.DIANCANG`（中華典藏網），四條口訣逐字相符；
  證據 `EVD.QUANSHU.{TAIFU,FENGGAO,JIESHEN,XIAOXIAN}` 與 `EVD.QUANSHU.DIANCANG.*`；
  另負向查核 `EVD.QUANSHU.CLASSICAL-VERIFICATION.MISSING`（absence of evidence）。
- 小限之目標綁定：`xiaoXianForTarget`（`targetDate`/虛歲，與大限同一慣例）；
  `tests/unit/aux-supplementary.test.ts` 的「證據強度」測試確保未來 candidate 升格前證據充足。
- 詳見 `research/assimilation/classical-verification.md` 與 `classical-basis.json`。


## 9. Variant Research Catalog（Assimilation Phase F）

流派差異不得以 `if (profile === ...)` 散落在演算法中，一律走
`Profile 欄位 → ruleOverrides → Variant Rule`。Phase F 把差異維度變成可驗證資料：

- 檔案：`research/variants/variant-catalog.json`（14 個 spec §26 維度）
- Gate：`npm run validate:variants`（結構、參照、機制一致性、未建模必附 Research ID）
- 測試：`tests/variants/variant-catalog.test.ts`

盤點結果（2026-09-24）：

| 狀態 | 數量 | 說明 |
|------|------|------|
| modeled | 2 | 年界、四化表（有 profile 欄位或 profile 實際選用之 variant） |
| partially-modeled | 7 | 晚子時、閏月、廟旺、魁鉞、天傷天使、長生十二神、小限 |
| not-modeled | 5 | 月界、天馬、天空、截空/旬空、十二神 Scope |

- **未建模者一律附 Research ID**（如 `RSH.STAR.CHANGSHENG_DIRECTION`、`RSH.PERIOD.MONTH_BOUNDARY`），
  不得以口頭差異帶過。
- **重要發現**：《全書》卷二長生十二神作「男命順數、女命逆數」（不論陰陽），
  與本引擎 canonical 之「陽男陰女順、陰男陽女逆」在陰男／陽女時相反 → 已登錄
  `RSH.STAR.CHANGSHENG_DIRECTION`，是否變更 canonical 屬 Owner 決策。
- 不在 spec 清單的既有 variant（五行局納音、火鈴起子時）亦一併登錄，避免黑數。

## 10. Pattern Research Backlog（Assimilation Phase G）

規則：**不追數量，每條先 Research**。格局只登錄有古典原文可引者。

- 檔案：`research/patterns/pattern-backlog.json`（11 條：equivalent 1 / research 9 / rejected 1）
- Gate：`npm run validate:patterns`（原文必填、來源可解析、research 必附 Research ID、
  implemented/equivalent 必指向既有 pattern 規則、rejected 必說明理由）
- 測試：`tests/patterns/pattern-backlog.test.ts`、`tests/patterns/decision-packet.test.ts`

來源與發現（《紫微斗數全書》卷三「格局」章）：

| 格局 | 原文 | 處置 |
|------|------|------|
| 對面朝斗格 | 子午宮逢祿存是也 | research |
| 科權祿主格 | 詩曰（無一句式定義） | research（定義不足） |
| 左右朝垣格 | 左輔右弼在三方 | research（與君臣慶會區辨） |
| 兼文武格 | 文曲武曲在身命是也 | research（定義明確，優先） |
| 文星朝命格 | 詩曰（無定義） | research（定義不足） |
| 石中隱玉格 | 命在子午逢巨門是也（卷二亦有互證） | research（優先） |
| 貪狼遇火名為火貴格 | 三合照身命是也 | **equivalent**（＝既有 `ZW.PAT.YINGHUO.001`） |
| 馬頭帶劍 | 原文疑似脫誤 | research（需校勘） |
| 十二宮諸星得地合格／失陷破格訣 | 逐宮歌訣 | research（體系性議題，需 Owner 決策） |
| 財官格／貴格（依生年干逐宮條列） | 卷二諸星章 | **rejected**（屬 Interpretation 層，非具名格局） |

### Decision Packet（M7 前置：交給 Owner 的決策包）

`npm run patterns:packet` → `research/patterns/pattern-decision-packet.json`（gate：`patterns:packet:check`）

readiness 由 backlog 文字**機械分類**（非命理判斷），`ownerDecision` 一律 `null`：

| readiness | 條數 | 內容 |
|-----------|------|------|
| `ready-for-owner-review` | 4 | 對面朝斗格、兼文武格、石中隱玉格、左右朝垣格（定義明確或與既有格局明確區辨） |
| `needs-definition` | 2 | 科權祿主格、文星朝命格（僅詩曰，無一句式定義） |
| `needs-collation` | 1 | 馬頭帶劍（原文殘缺，需校勘／第二來源） |
| `needs-owner-scope` | 2 | 十二宮得地合格訣／失陷破格訣（體系性議題） |
| `landed` / `rejected` | 1 / 1 | 火貴格（＝既有 `ZW.PAT.YINGHUO.001`）／財官格（屬 Interpretation 層） |

每條附 `proposedRuleId`、`requiredArtifacts`（Source+Evidence / Rule / Tests / plan coverage / 影響評估）。
**AI 不得自行實作或升級 canonical**；Owner 批准後才走 Rule + Evidence + Tests 流程。

## 11. Profile Gap Audit（Assimilation Phase E）

目的：schema 宣告的 profile 欄位 / enum 值，必須與 runtime 實作分開記錄，
避免 `_reserved` 或未實作的 enum 被當成可用功能（spec 2nd §P0-8）。

- 檔案：`research/profiles/profile-gap.json`（6 profiles、11 宣告欄位、6 個真的被 runtime 消費、4 個未實作值）
- 指令：`npm run profiles:gap` / `npm run profiles:gap:check`（已納入 `verify` 與 CI）
- 測試：`tests/profiles/profile-gap.test.ts`

未實作值（皆有 gap 與 Research ID）：

| 欄位 | 值 | Research |
|------|----|----------|
| `leapMonthPolicy` | `split` / `mid-month` / `next-month` | `RSH.LEAP_MONTH_SPLIT` |
| `timeConvention` | `local-mean-solar` | `RSH.PROFILE.TIME_CONVENTION` |

中州派現況：`school-zhongzhou` 僅覆寫庚干四化兩條規則；廟旺表、星曜互涉／宮干飛化用法
尚未以 variant 表達 → `RSH.PROFILE.ZHONGZHOU`（需可引用來源，不得憑印象補齊）。

## 12. Product Layer（Assimilation Phase I）

定位：**唯讀組合層**，不得污染 Bible Core（不新增命理規則、不改動 canonical 輸出）。

- 模組：`src/product/product.ts`（`ZiWei.Product`）
- API：`snapshot` / `trend` / `retrieve` / `sharePayload` / `match` / `fingerprint` / `canonicalJson`
- 測試：`tests/product/product.test.ts`（11 測試）
  - 決定性（同盤同指紋）、不同盤不同指紋
  - **唯讀**：呼叫後 chart 序列化內容不變
  - `trend` 逐年限運（大限／流年／小限）含範圍守衛
  - `retrieve` 與 `QueryApi` 結果完全一致（薄封裝、不新增演算法）
  - `sharePayload` 預設**不含出生資料**；`match` 僅列舉共同事實、**無吉凶評分**
- UI：`/chart` 已提供「查流年」（西元年）→ 限運面板（大限／流年／小限 + certainty）、
  12 年時間軸（`ZiWei.Product.trend`）與分享面板（`sharePayload` 指紋 + 可展開 payload，不含出生資料）。
  程式碼界線：UI 只組合既有輸出，不含任何命理規則（`ui/pages/chart.ts`）。
- 測試：`tests/visual/ui.e2e.ts` 之「查流年：顯示大限／流年／小限與 12 年時間軸」＋視覺快照。

## 13. Assimilation Tools（spec §5）

| 工具 | 產物 | Gate |
|------|------|------|
| `tools/assimilation/star-gap-audit.ts` | `research/assimilation/star-gap.json` | `assimilation:star-gap:check` |
| `tools/assimilation/pattern-gap-audit.ts` | `research/assimilation/pattern-gap.json` | `assimilation:pattern-gap:check` |
| `tools/assimilation/candidate-checklist.ts` | `research/assimilation/candidate-checklist.json` | `assimilation:candidate-checklist:check` |
| `tools/assimilation/profile-gap-audit.ts` | `research/profiles/profile-gap.json` | `profiles:gap:check` |
| `tools/assimilation/external-capability-report.ts` | `research/assimilation/external-capability-report.json` | `assimilation:capability-report:check` |
| `tools/assimilation/zhongzhou-diff-matrix.ts` | `research/assimilation/fortel/zhongzhou-diff.json` | `assimilation:zhongzhou-diff:check` |

共同原則：外部名稱／能力只作 Gap Detector 與研究索引；`fortel` 未安裝未執行時一律 `null`，不臆測。
GPL-3.0 / 授權不明者於能力報告中明列使用界線（不得複製程式碼、不得作為 Evidence）。

## 14. 中州 Diff Matrix（M5 / §13.1）

- 產物：`research/assimilation/fortel/zhongzhou-diff.json`（12 維度 × 3 probe）
- 方法：全部數值為**實跑輸出**——本庫 `calculate()`（`canonical` 與 `school-zhongzhou` 兩個 profile）
  對比 iztro 2.6.1 `astro.bySolar()`（`algorithm=default` / `zhongzhou`）；fortel 未執行 → `null`。
- 實測差異（皆附原始碼引用，MIT，僅比對行為）：
  | 維度 | 發現 |
  |------|------|
  | 命主 | iztro 中州以**年支**查命主，通用派以命宮地支（`lib/astro/astro.js:210-212`） |
  | 天使 / 天傷 | 中州在「生年支陰陽 ≠ 性別陰陽」時對調（`lib/star/location.js:673-689`）；P2 probe 實際對調 |
  | 歲前十二神 | 中州第 11 位作「歲破」而非「大耗」（`lib/star/decorativeStar.js:193-211`） |
  | 截空 / 旬空 | 中州不安截路／空亡，改安截空等（`lib/star/adjectiveStar.js:57-68`） |
  | 星曜存在 | 落差僅為呈現方式（年系／將系十二神在 iztro 為獨立欄位）與名稱對齊（年解＝解神） |
- 決策：12 維度皆為 `research` / `variant-only`，**未變更任何 canonical 規則**；
  測試：`tests/assimilation/zhongzhou-diff.test.ts`。

## 15. Research Scale（M8）

| 類型 | 位置 | 內容 |
|------|------|------|
| Fuzz | `tests/property/fuzz/random-inputs.test.ts` | 固定種子 250 個隨機輸入（含未知時辰／未知性別／閏月／跨時區）：不丟未預期例外、結構鐵律、小限語意、決定性 |
| Large Corpus | `tests/property/large-corpus.test.ts` | 1900–2100 每 10 日一盤（7,342 盤）：0 例外、無結構違規，且覆蓋 5 種五行局與 12 命宮地支 |
| Distribution | `tools/stats/distribution.ts` → `research/stats/distribution.json` | 1900–2100 每 5 日一盤（14,683 盤）：五行局分佈、命宮地支分佈、星曜落宮 Top30、廟旺、格局、certainty、小限覆蓋率 |

M8 附帶發現（已修）：目標日期早於出生時，小限曾以 `Error` 崩潰並產生負虛歲。現在
`calculate()` 對早於出生之目標 fail-close 為 `INVALID_TARGET_DATE`，且虛歲 < 1 時
`xiaoXianForTarget` 回報 `TARGET_BEFORE_FIRST_XIAOXIAN`（不落宮、不猜），
`certainty.xiaoxian` 為 `unavailable`。

## 16. Assimilation PR 必填（§51）

- 模板：`.github/pull_request_template.md`（§51 14 欄位 + 禁止事項 + 檢查清單）
- 規則：未填寫不得 merge；AI 不得自填 `Owner decision required: approved`。

## 18. Isolation / Pollution Defense（spec §6 / §44 / §52）

「最終不得出現外部 runtime dependency / GPL code 混入 / 重複 Engine」已變成可執行檢查：

- 實作：`tools/integrity-validator/pollution.ts`（與 `validate:integrity`、`tests/integrity/no-external-deps.test.ts` 共用）
- 檢查項：
  1. `src/` 不得 import 外部排盤套件（iztro / fortel / cdestiny / ziwei-* …）
  2. `src/` 不得存在 `vendor/`，不得 import `node_modules` 路徑
  3. `package.json.dependencies` 不得含外部排盤套件；GPL-3.0（ziwei-chart）與授權不明
     （ziwei-doushu-simple）**連 devDependency 都不允許**
  4. `iztro` 僅存在 devDependencies（differential oracle）
  5. 曆法換算集中：`lunar-typescript` 之 import 僅允許既有 3 個模組，新增使用點會 fail
- 判準自我驗證：測試以已知違規樣本（`iztro`、`../vendor/iztro` …）做 negative control，
  確保檢查不是空轉。
- 現況：`src` 40 檔、0 forbidden import、calendar importers = 3。

## 17. Candidate Checklist（§49）

把「Candidate 進入 Repo 前」的 12 項檢查機械化，避免候選靠印象升級。

- 產物：`research/assimilation/candidate-checklist.json`（19 候選；11 已落地、8 研究中、0 enforced failure）
- Gate：`npm run assimilation:candidate-checklist:check`（已納入 `verify` 與 CI）
- 測試：`tests/assimilation/candidate-checklist.test.ts`

判準分兩級（**AI 不得代為宣告通過**）：

| 級別 | 項目 | 處置 |
|------|------|------|
| enforced | stable ID、Gap 說明、增益說明、external comparison、知識型候選之 researchId、status 與 decision 一致 | 違反即 fail |
| advisory | 無現有重複能力（僅 star 型可機械驗證）、Test、Owner review 實質內容 | 只記錄，需 Owner 判斷 |

已落地候選（`status: accepted` + Owner decision）：

| Candidate | 落地內容 |
|-----------|----------|
| `ASM.STAR.TAIFU` / `FENGGAO` / `JIESHEN` | canonical 星曜（`ZW.CALC.STAR.TAIFU_FENGGAO.001` / `ZW.CALC.STAR.JIESHEN.001`），附兩份獨立 Tier3 證據 |
| `ASM.PERIOD.MINOR_PERIOD` | canonical 小限（`ZW.CALC.PERIOD.XIAOXIAN.001`） |
| `ASM.SDK.QUERY_FACADE` | Phase D 唯讀 Query Facade |
| `ASM.SCHOOL.ZHONGZHOU_DIFF_MATRIX` | M5 中州 Diff Matrix |
| `ASM.PATTERN.CANDIDATE_HARVEST` / `ASM.VARIANT.CATALOG` / `ASM.TEST.PROPERTY` | Phase G / F / H-M8 產物 |
| `ASM.AI.TASK_CONTEXT` / `ASM.PRODUCT.UX` | Phase I：`Product.retrieve`、AiContext 精準化、UI 限運面板 |

仍研究中且**不得升級**者：`ASM.STAR.TIANCAI` / `TIANSHOU` / `TIANWU`（查無古典依據）、
`ASM.CHART.PLANE`、`ASM.PERIOD.DYNAMIC_STARS`、`ASM.METADATA.RUNTIME_PLACEMENT`、
`ASM.SCHOOL.ZHONGZHOU`、`ASM.PERIOD.YEAR_DEITY_SCOPE`（皆有 researchId 或標記 advisory）。