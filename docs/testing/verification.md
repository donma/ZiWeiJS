# 驗證體系（Verification）

本文件說明 ZiWeiJS 如何證明「每一個結果都可回答：為什麼、哪條 Rule、哪一版、哪個 Profile、
哪個 Source、哪個 Evidence、哪個 Test 驗證過」。

驗證分為六層：**結構 → 治理 → 契約 → 差分 → 測試 → 視覺 / 無障礙**。

## 1. Gate 順序

`npm run verify` 依序執行：

| # | 指令 | 驗證內容 |
|---|------|----------|
| 1 | `npm run validate:rules` | Rule 欄位、ID 格式、生命週期一致性 |
| 2 | `npm run validate:sources` | Source / Evidence schema 與引用 |
| 3 | `npm run validate:schemas` | `chart.schema.json` 嚴格驗證（15 張盤 + 3 錯誤情境） |
| 4 | `npm run validate:governance` | Canonical Evidence Gate、variantOf、AI 來源阻擋 |
| 5 | `npm run validate:integrity` | ID 唯一、ref 可解析、executor 可解析、DSL schema、計畫覆蓋、changeLog |
| 6 | `npm run differential:calendar -- --check` | 曆法差分 fixture 與現行實作不得漂移 |
| 7 | `npm run test` | 單元 / golden / differential / boundary / schema / period |
| 8 | `npm run build` | app + library + types + standalone demo |

瀏覽器層另外執行：

```bash
npm run test:a11y     # Accessibility（13 tests）
npm run test:visual   # UI / Visual regression（20 tests）
```

CI（`.github/workflows/build.yml`）在 push 時依序跑完 1–8，再安裝 chromium 執行 `test:a11y`，
最後 `node tools/build-standalone.mjs` 產生 `dist/ziwei-bible-demo.html` 並部署 Pages。

## 2. 治理驗證（Governance）

- **Canonical Evidence Gate**：規則升為 `canonical` 需具備 Tier1 / Tier2 來源證據，或 2 條以上 Tier3。
- **AI 來源阻擋**：AI 產出永遠不是合法 Evidence Source，不得作為 canonical 依據。
- **AI 不得自行升格**：升為 `canonical` 僅能由 owner 執行；AI 只能提出 `candidate` 並附 research 項目。

## 3. 契約驗證（Schema）

`schemas/` 下為公開契約，`additionalProperties: false` + `extensions` 逃生口：

```text
chart.schema.json     盤面輸出（含 trace / calendar / periods）
dsl.schema.json       Rule DSL 全部 operator 與必要參數
star.schema.json      星曜
pattern.schema.json   格局
evidence.schema.json  證據（location 可為結構化物件）
rule.schema.json      規則
source.schema.json    文獻來源
```

`schemaVersion` 目前為 `2.0`。

## 4. 差分驗證（Differential）

差分是「不信任單一實作」的具體手段。三組差分：

| 對象 | 方法 | 規模 |
|------|------|------|
| 安星正確性 | 與 `iztro@2.6.1` 對照 | 10 案例 × 45 欄 = 450 欄，0 needs-review |
| 安星快照 | `fixtures/differential/iztro/*.json`（12 筆） | CI 不需外部套件 |
| 曆法層 | `lunar-typescript@1.8.6` vs `lunar-lite@0.2.8` | 73,384 日逐日 |

### 曆法差分（P2-6）

```bash
npm run differential:calendar            # 重新產生 fixtures/calendar/
npm run differential:calendar -- --check  # 驗證 fixture 未漂移（CI 使用）
```

產出：

```text
fixtures/calendar/calendar-differential.json   逐日農曆 / 日柱 / 月柱 / 年柱 / 閏月
fixtures/calendar/day-boundary.json            子時換日、午夜換日、真太陽時跨日
fixtures/calendar/timezone-dst.json            歷史時區 / DST（9 筆人工查證 IANA 事實）
```

結果：**0 未解釋差異**。所有差異皆歸類為已知慣例並逐筆驗證：

- `year-boundary-convention:day1-vs-lichun`（104 筆）：本引擎採農曆正月初一換年，
  `lunar-lite` 預設採立春。以 `lunar-typescript` 的立春版本逐筆驗證差異純屬慣例。
- `zi-hour-boundary-convention`（10 筆）：23:00 起子時之日歸屬。

## 5. Golden Fixtures（Oracle）

`fixtures/golden/golden-*.json` 為 35 筆完整 oracle，含 `verified` 區塊。
產生器（`tools/fixture-generator/generate-v2.ts`）**必須先通過 iztro 外部對照才寫入**，
且禁止 `_computed_` 這類自我引用欄位 —— 否則 oracle 只是實作的鏡像，沒有驗證價值。

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
