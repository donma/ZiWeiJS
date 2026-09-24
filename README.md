# ZiWeiJS

**ZiWeiJS is not merely a fortune-telling application.**
**It is a machine-readable, traceable and testable Zi Wei Dou Shu reference repository and reference engine.**

ZiWeiJS 不只是算命工具 — 它是給未來 ZiWei.NET、ZiWeiPython、心齋圓與第三方紫微工具共同引用的 **規則與驗證基準**。

> **Current maturity: Reference implementation / pre-1.0**
>
> canonical 規則已具備來源、證據與測試，但**不等於全部命理知識已驗證完畢**；
> 大量規則仍為 `candidate`，待領域 owner 覆核後方可升為 `canonical`。
> AI 不得自行升級規則狀態（見 `docs/governance/rule-lifecycle.md`）。

## 現況數據

<!-- STATS:BEGIN (由 `npm run coverage:bible -- --update-readme` 產生，請勿手寫) -->
| 項目 | 數量 |
|---|---|
| 規則總數 | 213 |
| canonical | 36 |
| candidate | 168 |
| variant | 7 |
| research | 2 |
| Canonical source 覆蓋率 | 100% |
| Canonical evidence 覆蓋率 | 100% |
| 星曜（實測安星 / 總數）| 95 / 96（active 95）|
| 格局 | 24 |
| 解讀規則 | 138（12 domains）|
| 文獻 / 證據 | 10 / 30 |
| Golden fixtures（外部 verified / 本地）| 35 / 8（總計 43）|
| Differential fixtures | 17 |
| Calendar fixtures | 3 |
| Tests | 444 it() / 49 files（靜態計數）|
| E2E / Visual | 21 test() / 3 files（靜態計數；實際執行數見 npm run test:visual）|
| schemaVersion | 2.0 |
<!-- STATS:END -->

---

## 這是什麼？

ZiWeiJS 是一套**紫微斗數的開放規格與參考實作**，包含三個層次：

| 層次 | 給誰用 | 內容 |
|---|---|---|
| **命盤工具** | 一般使用者 | 瀏覽器開啟即可排盤、看解釋、匯出圖檔。完全離線，資料不會外傳。 |
| **開發者 SDK** | 程式開發者 | `import { ZiWei } from 'ziwei-bible'`，三行排出一張完整的命盤 JSON / SVG。 |
| **規則標準庫** | 命理研究者 / 其他排盤系統作者 | 每條安星、四化、格局規則皆以 JSON 記錄，含來源文獻、流派差異、版本治理。可作為各家排盤系統的對照基準（differential test oracle）。 |

---

## 為什麼要做這個？

紫微斗數領域長期存在幾個問題：

- **各家排盤結果不同**，但沒有人說得出差在哪、誰對
- **規則藏在程式碼或書裡**，無法機器讀取、無法測試
- **流派差異被抹平**——某個軟體寫死了某派規則，使用者不知道
- **AI 解盤滿天飛**，但底層排盤對不對沒人驗證

ZiWeiJS 的解法是：**把規則變成資料（data），不是程式（code）**。

每條規則都是一筆 JSON，長這樣：

```json
{
  "ruleId": "ZW.CALC.PALACE.LIFE.001",
  "ruleVersion": "1.0",
  "status": "canonical",
  "scope": "calculation.palace.life",
  "name": { "zh-TW": "安命宮" },
  "logic": { "executor": "calcLifePalace" },
  "sourceRefs": ["SRC.QUANSHU"],
  "evidenceRefs": ["EVD.QUANSHU.ANXING"]
}
```

這代表：
- `ruleId` — 全球唯一識別碼
- `status` — `canonical`（標準）/ `variant`（流派版本）/ `research`（研究中）/ `candidate`（候選）/ `deprecated`（棄用）/ `undetermined`（未定）
- `sourceRefs` — 出自哪本文獻
- `evidenceRefs` — 引文原文與位置（卷/頁/條目）

**任何一顆星為什麼在那個宮位，都可以從命盤一路點回規則、點回文獻原文。**

---

## 主要功能

### 給使用者

- **完整命盤**：命宮、身宮、十二宮、五行局、十四主星、輔星、煞星、雜曜、四化、廟旺、長生十二神、博士十二神、大限、流年、流月、流日、流時
- **SVG 向量命盤**：可無限放大、列印、匯出 PNG / SVG / JSON
- **星曜說明**：滑鼠移到星曜顯示簡易解釋（類別、位置、廟旺、四化），點擊看完整詳情
- **Standard / Expert 雙模式**：一般人看美觀命盤；研究者看 Rule ID、Trace、Source、Evidence、Version
- **RWD**：桌機 / 平板 / 手機都有對應排版
- **完全離線**：排盤不連網、不傳資料、不追蹤

### 給開發者

```ts
import { ZiWei } from 'ziwei-bible';

const chart = ZiWei.calculate({
  calendarType: 'solar',
  date: { year: 1990, month: 5, day: 15 },
  time: { hour: 10, minute: 30 },
  timezone: 'Asia/Taipei',
  sexForCalculation: 'male'
}, { trace: true, profile: 'canonical' });

ZiWei.Renderer.render(chart, { mode: 'expert' }); // → SVG string
ZiWei.AI.toContext(chart);                        // → AI-ready context
ZiWei.Rectification.analyzeUnknownTime(input);    // → 12 時辰候選盤
ZiWei.Rules.get('ZW.CALC.PALACE.LIFE.001');       // → rule object
ZiWei.Sources.get('SRC.QUANSHU');                 // → source object
```

### 給研究者

- **Canonical + Variant**：每條規則逐條標記狀態，流派差異不被抹除
- **Source tier 1–6**：古籍 > 傳承著作 > 多系統共識 > 專業文章 > 社群 > 不明
- **Evidence model**：supports / conflicts / mentions / variant-only，附引文與位置
- **Rule DSL**：`all / any / none / not / star-in-palace / relation / star-group / transformation / dignity / compare / exists / period-scope / profile / variant`
- **Trace**：`calculate(input, { trace: true })` 回傳每條規則的 inputs → result
- **Differential test**：與外部排盤逐欄比對，差異分類（流派 / 曆法 / 時間基準 / 換日 / 閏月 / Bug）
- **Golden fixtures**：固定輸入 → 固定輸出，第三方可用同樣 fixture 驗證自家實作

---

## 快速開始

### 雙擊即用（免安裝）

打開 `dist/ziwei-bible-demo.html` — 單一 HTML 檔，離線可用。

**線上 gist 版**：https://gist.github.com/donma/3325f639458af903a0d8948f2bf26fe1

下載後雙擊即可排盤。

### 開發模式

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 執行完整測試套件
npm run build      # dist/ 輸出 esm + browser + d.ts + demo.html + bible-manifest.json
npm run differential           # 與 iztro 逐欄對照（安星差分）
npm run differential:calendar  # 與 lunar-lite 逐日對照（曆法差分）
npm run test:visual            # Playwright：UI / Visual regression
npm run test:a11y              # Playwright：無障礙（axe + 鍵盤）
npm run release:check          # 最終 release gate（verify + artifact / package smoke）
```

### 規則驗證

> 以下指令的實際數量以各自輸出與 `npm run coverage:bible` 為準，本文件不手寫會變動的統計數字。

```bash
npm run verify                # 全部 gate：rules → sources → schemas → governance → integrity → versions → research → differential → golden → test → build
npm run validate:rules        # 規則 schema 驗證
npm run validate:sources      # 來源 / 證據驗證（含 AI-source 阻擋）
npm run validate:schemas      # 公開 JSON 契約驗證（含 variance / research registry）
npm run validate:governance   # Canonical Evidence Gate
npm run validate:integrity    # ID / ref / executor / DSL / 計畫覆蓋
npm run validate:versions     # Rule Version Gate（changeLog / behavior-change 必須升版）
npm run validate:research     # Research Queue governance（參照 / 狀態 / resolution）
npm run validate:catalogs     # cycles / aliases / assimilation catalogs 治理
npm run coverage:bible        # 覆蓋率報告（可 --update-readme）
npm run release:check         # 最終 gate：verify + release artifact smoke + npm package smoke
```

> 詳細驗證體系見 `docs/testing/verification.md`。
>
> CI（`.github/workflows/build.yml`）執行與 `verify` 相同的治理 Gate（另加 `coverage:bible`），
> 並於 `npm run build` 之後執行 `npm run release:smoke`，再跑 A11y 與 Pages 部署。

---

## Repo 結構

```
schemas/        JSON Schema（rule / source / evidence / research / chart / interpretation / trace / profile / differential-variance）
rules/          規則資料（calculation · interpretation · patterns · rectification）
tables/         星曜 registry、別名 registry、cycles（長生/博士/歲建/將前）、四化表、廟旺表、納音、雜曜安星表
sources/        文獻登錄（Tier 1–6）
evidence/       證據登錄（supports / conflicts / mentions / variant-only）
research/       Research Queue（open / candidate / resolved / rejected）＋ assimilation 研究區
profiles/       canonical / traditional-zi / true-solar / lichun / school-zhongzhou / school-ma-hu
variants/       Variant 與 Variance Registry
src/            Reference Engine（calendar · rule · relation · transformation · dignity · period · interpretation · pattern · rectification · query · star-registry · trace · renderer · ai · narrative）
ui/             官方 UI（Standard / Expert · RWD · tooltip / bottom-sheet / drawer）
tests/          unit / golden / boundary / differential / schema / periods / calendar / provenance / governance / property / assimilation / visual
fixtures/       golden / boundary / differential / calendar fixtures
tools/          rule-validator / source-validator / schema-validator / governance-validator / integrity-validator / rule-version / research-validator / release-validator / assimilation / fixture-generator / differential-runner / calendar-differential / stats / build-types / build-standalone
docs/           architecture / rules / sources / profiles / api / governance / testing
```

---

## 設計原則

| 原則 | 說明 |
|---|---|
| 不知道就標示不知道 | certainty model：certain → high → medium → low → unknown → variant-dependent |
| 有爭議就保存差異 | 逐條規則標記 canonical / variant / research / candidate / deprecated / undetermined |
| 有來源就能追 | Source tier 1–6 + Evidence 引文位置 |
| 有規則就能測 | unit / golden / boundary / differential / regression |
| 有結果就能重現 | deterministic engine，無 AI 參與排盤 |
| AI 只能參與敘述層 | Narrative 層才能用 LLM，不得改寫底層規則 |

---

## License

原始碼公開；個人、研究、學術與非商業使用自由。**商業使用必須告知 Owner**，Owner 保留對特定商業使用要求另行授權的權利。

詳見 `LICENSE-DRAFT.md`（草案，待 Owner 確認）與 `COMMERCIAL_USE.md`。

**本專案不是 MIT License。**
