# ZiWeiJS-Bible — AI 施工文件 v1.0

> 本文件是給 AI Coding Agent（OpenCode / Codex / Claude Code / GitHub Copilot Agent / 其他 Agent）直接施工使用的主規格。
>
> **不要自行簡化需求、不要擅自更換架構、不要把「之後再做」當成預設答案。**
>
> 目標不是做一個普通紫微斗數網站，而是建立一個可驗證、可追溯、可機器執行、可持續研究擴充、可被第三方 SDK 與產品引用的 **紫微斗數 Bible Repo**。

---

# 0. 專案定位

專案名稱：

```text
ZiWeiJS-Bible
```

核心定位：

```text
紫微斗數 Machine-readable Bible
+
Reference Engine
+
Interpretation Engine
+
Rule DSL
+
Source / Evidence Registry
+
Canonical / Variant Governance
+
Golden / Differential Test
+
Standard / Expert UI
+
Professional SVG Chart Renderer
```

它不是：

```text
只會排盤的小工具
只會顯示十二宮的網站
只有文章的知識庫
只有 AI 解盤的聊天工具
只有一套寫死流派的演算法
```

它要成為未來：

```text
ZiWeiJS
ZiWei.NET
ZiWeiPython
ZiWeiGo
心齋圓
第三方紫微工具
AI 命理解讀系統
```

共同可引用的規則與驗證基準。

---

# 1. 最重要設計原則

AI 開發時必須遵守以下原則。

## 1.1 Bible 與正式 SDK 分離

`ZiWeiJS-Bible` 是：

```text
規則庫 + Reference Engine + 官方驗證工具
```

正式產品 SDK 可以另外存在。

Reference Engine 的使命是：

```text
正確
透明
可驗證
可重現
可追溯
```

而不是極端效能最佳化。

---

## 1.2 Canonical + Variant

不得宣稱所有紫微規則只有唯一流派。

系統必須支援：

```text
canonical
variant
research
candidate
deprecated
undetermined
```

中文 UI 建議顯示：

```text
標準
流派版本
研究中
候選
已棄用
未定
```

Canonical 不代表某一整個門派。

Canonical 必須逐條規則決定。

例如：

```text
命宮算法 → Canonical A
五行局 → Canonical A
某星曜安法 → Canonical B
四化表 → Canonical C
```

每條規則都可以有不同 Variant。

---

## 1.3 規則升級流程

正式狀態：

```text
研究中
↓
候選
↓
標準
```

對應 ID：

```text
research
candidate
canonical
```

AI 可以：

```text
抓資料
整理文獻
建立 research rule
建立 candidate rule
建立 evidence
建立 conflict report
```

AI 不可以自行：

```text
candidate → canonical
```

Canonical 最終批准目前只由專案 Owner 執行。

---

## 1.4 Machine-readable Rule 是 Source of Truth

不要把規則藏在：

```text
Markdown
README
程式 if/else
UI
LLM Prompt
```

真正的 Source of Truth 必須是：

```text
Machine-readable Rule Data
```

建議格式：

```text
JSON
```

必要時可使用 JSONC，但正式發布檔仍應能驗證。

所有：

```text
文件
Reference Engine
Expert UI
Test
AI Context
Rule Explorer
```

都應從這些 Rule Data 衍生。

---

## 1.5 複雜演算法允許 JS/TS Executor

不要為了資料化而把複雜演算法硬塞成難以維護的 DSL。

規則可以：

```json
{
  "ruleId": "ZW.CALC.EXAMPLE",
  "executor": "calculateSomething"
}
```

再由：

```text
src/executors/calculateSomething.ts
```

執行。

原則：

```text
資料能表達 → Rule DSL
資料不適合表達 → Executor
```

Executor 仍必須有：

```text
ruleId
source
evidence
version
test
trace
```

---

# 2. 技術要求

## 2.1 開發語言

Reference Engine：

```text
TypeScript
```

正式 Build：

```text
ESM JavaScript
Browser JavaScript
TypeScript definitions
```

Consumer 不必使用 TypeScript。

---

## 2.2 執行環境

核心必須：

```text
Offline-first
Browser 可跑
Node.js 可跑
Runtime 儘量零依賴
不依賴 API
不依賴資料庫
不依賴 Server
不依賴 AI
```

網路只允許用於：

```text
AI Narrative
Research Agent
抓外部 Evidence
Differential Test
外部資料同步
```

正常排盤即使完全離線也要可運作。

---

## 2.3 Build 輸出

至少產生：

```text
dist/
  ziwei-bible.esm.js
  ziwei-bible.browser.js
  ziwei-bible.d.ts
```

建議同時提供：

```text
package exports
tree-shaking
source maps
```

---

# 3. Repo 建議結構

```text
ZiWeiJS-Bible/
│
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ README.md
├─ CHANGELOG.md
├─ ROADMAP.md
├─ CONTRIBUTING.md
├─ COMMERCIAL_USE.md
├─ LICENSE
│
├─ schemas/
│  ├─ rule.schema.json
│  ├─ source.schema.json
│  ├─ evidence.schema.json
│  ├─ chart.schema.json
│  ├─ interpretation.schema.json
│  ├─ trace.schema.json
│  └─ profile.schema.json
│
├─ rules/
│  ├─ calculation/
│  │  ├─ calendar/
│  │  ├─ birth/
│  │  ├─ palace/
│  │  ├─ bureau/
│  │  ├─ stars/
│  │  ├─ transformations/
│  │  ├─ dignity/
│  │  ├─ periods/
│  │  └─ relations/
│  │
│  ├─ interpretation/
│  ├─ patterns/
│  └─ rectification/
│
├─ tables/
│  ├─ stars/
│  ├─ stems/
│  ├─ branches/
│  ├─ transformations/
│  └─ dignity/
│
├─ sources/
├─ evidence/
├─ variants/
├─ profiles/
├─ fixtures/
│  ├─ golden/
│  ├─ boundary/
│  └─ differential/
│
├─ src/
│  ├─ core/
│  ├─ calendar/
│  ├─ reference-engine/
│  ├─ rule-engine/
│  ├─ relation-engine/
│  ├─ pattern-engine/
│  ├─ transformation-engine/
│  ├─ dignity-engine/
│  ├─ period-engine/
│  ├─ interpretation-engine/
│  ├─ narrative/
│  ├─ rectification/
│  ├─ trace/
│  ├─ renderer/
│  ├─ ai/
│  └─ executors/
│
├─ ui/
│  ├─ app/
│  ├─ components/
│  ├─ pages/
│  ├─ styles/
│  └─ assets/
│
├─ tests/
│  ├─ unit/
│  ├─ golden/
│  ├─ differential/
│  ├─ regression/
│  └─ boundary/
│
├─ tools/
│  ├─ rule-validator/
│  ├─ source-validator/
│  ├─ fixture-generator/
│  └─ differential-runner/
│
└─ docs/
   ├─ architecture/
   ├─ rules/
   ├─ sources/
   ├─ profiles/
   ├─ api/
   └─ governance/
```

---

# 4. Shared Core Contract

現在不要直接重構現有 BaziJS。

先在 ZiWeiJS-Bible 內定義新的 Shared Core Contract。

未來成熟後才考慮抽成：

```text
MingLiCore
```

最後可能：

```text
MingLiCore
   ↑
 ┌─┴──────┐
BaziJS  ZiWeiJS
```

V1 不得要求 BaziJS 立刻改用新的 Core。

---

# 5. Birth Input Contract

建議：

```ts
interface ZiWeiBirthInput {
  calendarType: 'solar' | 'lunar';

  date: {
    year: number;
    month: number;
    day: number;
    isLeapMonth?: boolean;
  };

  time?: {
    hour?: number;
    minute?: number;
    second?: number;
  };

  timezone?: string;

  location?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
  };

  sexForCalculation?: 'male' | 'female' | 'unknown';

  timeConvention?: 'civil' | 'true-solar' | 'local-mean-solar';

  dayBoundary?: 'midnight' | 'zi-hour';
}
```

## 5.1 全球時間規格

V1 要原生支援：

```text
IANA Time Zone
歷史 UTC Offset
DST
經緯度
海外出生
真太陽時
地方平太陽時
```

不要把系統寫死在 UTC+8。

---

## 5.2 Canonical 時間

預設：

```text
civil time
```

真太陽時為可切換 Variant。

---

## 5.3 換日

Canonical 必須有明確預設。

同時支援：

```text
00:00 換日
23:00 子初換日
```

不同 Profile 可指定不同方式。

---

## 5.4 閏月

Lunar Input 必須明確：

```text
isLeapMonth
```

不得猜。

閏月規則：

```text
Canonical + Variant
```

---

## 5.5 未知時辰

不知道時辰時：

```text
不可偷偷預設午時
不可偷偷預設 12:00
不可輸出假裝確定的單一命盤
```

必須提供：

```ts
analyzeUnknownTime()
```

一次建立 12 個候選盤。

結果分類：

```text
stable
variable
unavailable
```

UI 可顯示：

```text
哪些結果 12 時辰一致
哪些隨時辰改變
哪些不能判定
```

---

# 6. 性別欄位

演算法欄位：

```text
sexForCalculation
```

不得與 UI 顯示性別綁在一起。

例如：

```json
{
  "birth": {
    "sexForCalculation": "male"
  },
  "profile": {
    "displayGender": null
  }
}
```

Calculation Layer 只能讀 `sexForCalculation`。

---

# 7. Calculation Layer

Calculation Layer 必須 deterministic。

相同輸入：

```text
=
相同輸出
```

不得呼叫 AI。

至少涵蓋：

```text
國曆 / 農曆
干支
時辰
命宮
身宮
十二宮
宮干支
五行局
十四主星
輔星
煞星
雜曜
四化
廟旺利陷
十二長生
大限
流年
流月
流日
流時
```

---

# 8. 星曜 Registry

星曜不得用中文名稱直接當程式 Key。

建議 ID：

```text
ZW.STAR.MAJOR.ZIWEI
ZW.STAR.MAJOR.TIANJI
ZW.STAR.AUX.ZUOFU
ZW.STAR.MALEFIC.QINGYANG
```

星曜資料至少：

```json
{
  "id": "ZW.STAR.MAJOR.ZIWEI",
  "category": "major",
  "name": {
    "zh-TW": "紫微",
    "zh-CN": "紫微",
    "en": "Zi Wei"
  },
  "status": "canonical",
  "sources": [],
  "tags": []
}
```

---

# 9. 星曜範圍

Bible 要收所有可考證星曜。

但要分級：

```text
core
common
extended
school
historical
research
```

不要因為現代少用就刪除。

---

# 10. Palace Model

不要使用：

```text
命宮
兄弟宮
夫妻宮
```

直接當固定程式 Key。

建議：

```json
{
  "id": "life",
  "name": {
    "zh-TW": "命宮"
  },
  "branch": "wu",
  "stem": "wu",
  "index": 0,
  "stars": [],
  "transformations": [],
  "cycles": {}
}
```

---

# 11. Relation Engine

必須是一級核心能力。

支援：

```text
同宮
對宮
三方四正
夾宮
會照
沖
拱
鄰宮
星曜群組
```

不要讓 Pattern / Interpretation / Period 各自重寫關係算法。

---

# 12. Transformation Engine

四化不能只是查表。

必須建成完整 Transformation Engine。

支援來源：

```text
生年
宮干
大限
流年
流月
流日
流時
```

至少可表達：

```json
{
  "type": "ji",
  "sourceScope": "annual",
  "sourceStem": "jia",
  "targetStarId": "ZW.STAR.xxx",
  "targetPalaceId": "career",
  "profile": "canonical"
}
```

需支援：

```text
飛化
自化
多層疊加
來源 Scope
時間 Scope
Variant
```

---

# 13. Dignity / Brightness Engine

廟、旺、得、利、平、不、陷等必須是正式 Engine。

不是只有 UI label。

Interpretation / Pattern 可以直接引用。

例如：

```json
{
  "starId": "ZW.STAR.MAJOR.TAIYANG",
  "branch": "wu",
  "dignity": "miao",
  "profile": "canonical"
}
```

允許流派差異。

---

# 14. Period Engine

時間層必須一開始就完整建模：

```text
natal
major-period
year
month
day
hour
```

不要把所有限運直接污染 natal chart。

建議：

```text
chart.natal
periods.major
periods.year
periods.month
periods.day
periods.hour
```

---

# 15. Rule DSL

必須有正式 DSL。

最低能力：

```text
all
any
none
not
exists
compare
star-in-palace
relation
star-group
transformation
dignity
period-scope
palace
pattern
profile
variant
```

例：

```json
{
  "all": [
    {
      "type": "star-in-palace",
      "star": "ZW.STAR.MAJOR.ZIWEI",
      "palace": "life"
    },
    {
      "type": "relation",
      "relation": "san-fang-si-zheng",
      "containsAny": [
        "ZW.STAR.AUX.ZUOFU",
        "ZW.STAR.AUX.YOUBI"
      ]
    }
  ],
  "none": [
    {
      "type": "star-group",
      "group": "major-malefic",
      "relation": "same-palace"
    }
  ]
}
```

DSL Schema 要可以驗證。

---

# 16. Interpretation Layer

Interpretation 與 Calculation 嚴格分離。

Interpretation 必須是：

```text
Machine-readable Rule Graph
```

不是文章資料庫。

規則至少：

```json
{
  "ruleId": "ZW.INT.EXAMPLE",
  "domain": "career",
  "conditions": {},
  "tendency": "positive",
  "strength": 0.72,
  "confidence": 0.91,
  "priority": 80,
  "supports": [],
  "conflictsWith": [],
  "overrides": [],
  "evidence": []
}
```

---

# 17. Domain Model

Interpretation 要能依 Domain 查詢。

至少預留：

```text
personality
career
wealth
relationship
marriage
family
health
learning
migration
social
risk
timing
```

不要把每宮所有意思塞成一大段文字。

---

# 18. Pattern Engine

格局是一級 Rule Graph。

至少：

```text
required
enhancers
breakers
variants
evidence
```

狀態不能只有 true / false。

必須可以表達：

```text
完整成格
部分成立
得輔助條件
遭破格
僅某流派成立
條件不足
```

---

# 19. Interpretation Conflict Model

解讀規則要支援：

```text
strength
confidence
priority
supports
conflictsWith
overrides
```

不要把最後結果硬轉成：

```text
事業 87 分
感情 64 分
```

可以內部有權重，但對外應保留可解釋性。

---

# 20. Narrative Layer

整體架構：

```text
Calculation
↓
Interpretation
↓
Narrative
```

AI 只能參與 Narrative。

Narrative 有兩種：

```text
Deterministic Template
AI / LLM
```

AI 不得：

```text
重新排盤
重新安星
自己決定命中哪條規則
自行創造 Canonical
```

---

# 21. AI Context

提供：

```ts
ZiWei.AI.toContext(chart)
```

至少輸出：

```text
出生資料
命宮
身宮
五行局
十二宮
星曜
四化
格局
大限
流年
流月
流日
流時
命中規則
Rule IDs
Evidence IDs
Variant / Profile
```

---

# 22. Rectification Engine

出生時辰校正是獨立推論層。

介面：

```ts
ZiWei.Rectification.analyze(...)
```

輸出候選時辰：

```json
{
  "candidates": [
    {
      "hour": "wu",
      "support": 0.78,
      "matchedRules": [],
      "conflicts": []
    }
  ]
}
```

不得自動把候選寫回真實出生時間。

UI 必須清楚標示：

```text
推論
≠
出生時間事實
```

---

# 23. Source Registry

Source 是一級資料模型。

至少：

```json
{
  "sourceId": "SRC.XXXX",
  "title": "...",
  "author": "...",
  "era": "...",
  "edition": "...",
  "type": "classical-text",
  "tier": 1,
  "notes": ""
}
```

---

# 24. Evidence Model

Rule 不只寫 `source`。

必須：

```json
{
  "sourceId": "SRC.XXXX",
  "type": "supports",
  "location": "卷 / 頁 / 條目",
  "confidence": 0.95
}
```

支援：

```text
supports
conflicts
mentions
variant-only
```

---

# 25. Source Tier

建議：

```text
Tier 1
原始古籍、可靠版本、正式出版文獻

Tier 2
具明確傳承或專業背景的現代著作、教材

Tier 3
多個可信排盤系統一致實作

Tier 4
老師文章、專業網站、公開課程

Tier 5
論壇、社群、影片、個人說法

Tier 6
無法確認來源的整理
```

AI 本身永遠不能是 Evidence Source。

---

# 26. Trace

Reference Engine 原生支援 Trace。

API：

```ts
calculate(input, {
  trace: true
})
```

Trace 是正式資料結構。

例如：

```json
{
  "ruleId": "ZW.CALC.LIFE_PALACE.001",
  "inputs": {},
  "result": {},
  "profile": "canonical",
  "sourceRefs": []
}
```

Expert UI 必須可以：

```text
點某顆星
↓
看安星規則
↓
看輸入
↓
看結果
↓
看 Rule ID
↓
看 Source / Evidence
```

---

# 27. JSON Public Contract

Chart JSON 本身就是 Public Contract。

必須有：

```text
schemaVersion
```

建議：

```json
{
  "schemaVersion": "1.0",
  "engine": {},
  "input": {},
  "calendar": {},
  "birthContext": {},
  "chart": {
    "natal": {},
    "palaces": [],
    "stars": {},
    "transformations": {},
    "patterns": []
  },
  "periods": {},
  "interpretation": {},
  "certainty": {},
  "trace": {}
}
```

Breaking Change 必須升 Schema Version。

---

# 28. 版本治理

三層：

```text
Repo Version
Schema Version
Rule Version
```

每條 Rule：

```json
{
  "ruleId": "...",
  "ruleVersion": "1.0"
}
```

變更類型：

```text
breaking
behavior-change
evidence-update
wording-only
deprecated
```

Chart 結果記錄：

```json
{
  "generatedWith": {
    "bibleVersion": "1.0.0",
    "schemaVersion": "1.0",
    "profile": "canonical"
  }
}
```

---

# 29. 測試策略

必須三層：

```text
Unit Tests
Golden Charts
Differential Tests
```

另外必須：

```text
Boundary Tests
Regression Tests
```

---

## 29.1 Golden Charts

輸入固定出生資料。

整張 JSON 必須一致。

---

## 29.2 Differential Tests

與多個可信外部排盤來源比對。

比對：

```text
命宮
身宮
五行局
十二宮
十四主星
輔星
四化
大限
流年
流月
流日
流時
```

如果不同：

```text
不要直接判 Bible 錯
不要直接判外部網站錯
```

必須產生：

```json
{
  "status": "needs-review",
  "field": "...",
  "bible": "...",
  "sourceA": "...",
  "sourceB": "..."
}
```

再人工分類：

```text
流派差異
曆法差異
時間基準差異
換日差異
閏月差異
Bug
外部來源錯誤
```

---

# 30. 官方 UI

UI 不是 Debug 頁。

必須：

```text
專業
現代
乾淨
正式
高資訊密度但不雜亂
完整 RWD
桌機 / 平板 / 手機都好看
```

---

# 31. UI 模式

同一套 UI：

```text
Standard Mode
Expert Mode
```

Standard：

```text
一般使用者
漂亮
乾淨
可閱讀
可截圖
```

Expert：

```text
Rule ID
Source
Evidence
Variant
Trace
JSON
Differential
Version
```

---

# 32. 視覺方向

整體視覺建議：

```text
東方命理元素
+
現代 SaaS / Developer Tool
```

不要做：

```text
廟宇風
廉價算命網站
滿版金紅
過度古風
大量陰影
大量玻璃特效
過度裝飾
```

應偏：

```text
乾淨留白
沉穩
高級
專業
精細線條
明確資訊層級
```

可使用：

```text
米白
暖灰
墨色
低飽和紫
低飽和靛藍
低飽和金
```

但實際 Theme 請由 UI Agent 維持一致設計系統。

---

# 33. RWD

至少測試：

```text
375px
390px
768px
1024px
1280px
1440px
1920px
```

不得只縮放整張 SVG。

手機版應重新布局。

例如：

```text
Desktop
左側輸入 / 控制
中央命盤
右側解讀

Mobile
上方摘要
命盤可水平 / 比例自適應
下面卡片式宮位解讀
```

---

# 34. SVG 命盤

**命盤核心必須使用 SVG。**

不得用：

```text
Canvas 作為唯一 renderer
純 HTML table 假裝命盤
圖片底圖
```

原因：

```text
可縮放
不失真
可列印
可截圖
可 export
可 hover
可互動
可標註
```

---

# 35. SVG 命盤規格

命盤應呈現：

```text
十二宮
中央資訊區
宮位名稱
宮干支
主星
輔星
煞星
四化
廟旺
大限
流年
必要時間 Scope
```

主星與重要星曜必須有明確視覺優先級。

不要所有星字體大小完全一樣。

---

# 36. 星曜 Hover / Tooltip

使用者滑鼠移到星曜時：

```text
必須有簡易解釋
```

例如：

```text
紫微
十四主星之一
常被視為統御、主導、尊貴相關象徵
目前位置：命宮
廟旺狀態：旺
四化：化權
```

Tooltip 原則：

```text
簡短
不超過約 4~6 行
不直接展開完整命理解讀
```

可提供：

```text
查看更多
```

點擊後開 Side Panel / Drawer 顯示：

```text
完整星曜解釋
所在宮位
關聯星曜
三方四正
四化
Rule IDs
Evidence
```

---

# 37. 手機 Tooltip

手機沒有 hover。

因此：

```text
tap 星曜
→ bottom sheet / popover
```

不要依賴 mouse hover 才能使用。

---

# 38. Standard Mode 命盤

Standard Mode：

```text
美觀優先
資訊適量
主星突出
四化突出
宮位清楚
```

不要顯示：

```text
大量 Rule ID
大量 Debug Trace
大量 Source ID
```

---

# 39. Expert Mode 命盤

Expert Mode 允許：

```text
Rule Badge
Variant Badge
Trace Icon
Source Icon
Conflict Icon
Differential Warning
```

點擊星曜 / 宮位可查看：

```text
計算步驟
Rule
Source
Evidence
Version
Variant
```

---

# 40. SVG Export

至少支援：

```text
SVG Download
PNG Export
Print
```

PNG 可由前端 SVG → Canvas export，但 Renderer Source 必須是 SVG。

---

# 41. UI 頁面建議

至少：

```text
/
首頁 / Demo

/chart
完整命盤

/expert
Expert Mode

/rules
Rule Explorer

/sources
Source Explorer

/differential
差異測試

/geek
Geek Test

/about
Bible / Governance
```

---

# 42. Demo 初始頁

展示頁要能讓第一次打開的人立刻理解：

```text
ZiWeiJS-Bible
不是普通算命網站
而是可驗證的紫微斗數 Reference Engine
```

首頁至少：

```text
Hero
快速輸入
Sample Chart
特色
Rule Trace
Canonical / Variant
Source Evidence
Open Source / License 說明
```

---

# 43. Privacy

核心與官方 UI：

```text
Local-only by default
```

出生資料：

```text
不得自動送 Server
不得自動 Telemetry
不得自動寫入外部 Log
```

AI / Cloud 功能必須由上層明確啟用。

---

# 44. 姓名

排盤核心不應要求姓名。

姓名屬於展示資料。

不要把姓名放進核心演算法。

---

# 45. i18n

內部 ID：

```text
穩定英文 ID
```

官方第一語言：

```text
zh-TW
```

至少預留：

```text
zh-TW
zh-CN
en
```

不要因翻譯改 Rule ID。

---

# 46. License

此專案不是 MIT。

授權方向：

```text
原始碼公開
可個人使用
可研究
可學術
可非商用
商業使用必須告知
Owner 保留針對特定商業使用要求另外商業授權的權利
```

商業使用依用途判定，不依公司或個人身分。

可能包含：

```text
SaaS
付費 App
廣告營收
顧問
命理服務
企業產品
API 轉售
白牌
商業導流
付費功能
```

正式 LICENSE 法律文字不要讓 Coding Agent 自行發明完整法律條文。

先產：

```text
LICENSE-DRAFT.md
COMMERCIAL_USE.md
```

並註明：

```text
正式法律文字需由 Owner 最後確認
```

---

# 47. 商用告知資料

建議：

```text
公司 / 組織名稱
產品名稱
用途
聯絡方式
使用版本
```

---

# 48. API 建議

```ts
ZiWei.calculate(input, options)

ZiWei.calculateSafe(input, options)

ZiWei.Periods.at(chart, dateTime)

ZiWei.Interpret(chart, options)

ZiWei.Patterns.match(chart)

ZiWei.Rectification.analyze(input)

ZiWei.Renderer.render(chart, options)

ZiWei.AI.toContext(chart)

ZiWei.Rules.get(ruleId)

ZiWei.Rules.explain(ruleId)

ZiWei.Sources.get(sourceId)

ZiWei.Trace.explain(chart, target)
```

---

# 49. Profile

至少：

```text
canonical
```

未來：

```text
school-x
school-y
```

Profile 必須明確記錄：

```text
timeConvention
dayBoundary
leapMonthPolicy
transformationPolicy
starRules
periodRules
dignityRules
```

---

# 50. UI Rule Explorer

Rule Explorer 必須支援：

```text
搜尋 Rule ID
搜尋中文名稱
分類
Canonical / Variant
狀態
Source
Evidence
Rule Version
```

Rule Detail 顯示：

```text
規則名稱
Rule ID
狀態
條件
結果
來源
Evidence
Variant
版本
變更紀錄
Trace 範例
```

---

# 51. Geek Test

Geek Test 要能輸入任意生日。

顯示：

```text
原始輸入
正規化時間
時區
真太陽時
農曆
干支
命宮
身宮
五行局
十二宮
每顆星定位原因
四化
限運
Rule Trace
JSON
```

---

# 52. 必須支援的錯誤狀態

不要 throw 無意義 generic error。

至少：

```text
INVALID_DATE
INVALID_LUNAR_DATE
INVALID_LEAP_MONTH
INVALID_TIMEZONE
MISSING_LOCATION_FOR_SOLAR_TIME
UNKNOWN_BIRTH_TIME
UNKNOWN_SEX_FOR_CALCULATION
UNSUPPORTED_PROFILE
RULE_NOT_FOUND
SOURCE_NOT_FOUND
SCHEMA_VALIDATION_FAILED
```

---

# 53. Certainty Model

對未知 / 爭議資料要有：

```text
certain
high
medium
low
unknown
variant-dependent
```

不要假裝所有結果都同樣確定。

---

# 54. V1 不可缺少

即使資料尚未填滿，V1 架構必須包含：

```text
rules
sources
evidence
variants
schemas
reference-engine
rule-engine
relation-engine
pattern-engine
transformation-engine
dignity-engine
period-engine
interpretation-engine
rectification
renderer
ui
tests
geek
docs
research
```

---

# 55. V1 功能目標

V1 至少要能：

```text
完整輸入出生資料
排完整本命
命宮
身宮
十二宮
五行局
十四主星
主要輔星 / 煞星
四化
廟旺
大限
流年
流月
流日
流時
完整 JSON
SVG 命盤
RWD
Standard / Expert
Tooltip
Trace
Rule Explorer
Source Explorer
Golden Tests
Differential Test framework
Unknown-time framework
Rectification framework
```

---

# 56. 禁止事項

AI 不得：

```text
把所有規則寫進單一 TS 檔
把規則大量 hardcode if/else
用 AI 結果代替 Calculation
把 Variant 直接改成 Canonical
用中文名稱當唯一程式 ID
忽略時區
寫死 UTC+8
忽略 DST
偷偷預設未知時辰
偷偷預設性別
用 Canvas 取代 SVG 命盤
只做桌機 UI
手機版單純縮小桌機版
所有星曜 hover 都只顯示名稱
做廉價算命網站風
把 Standard 與 Expert 拆成兩套完全獨立前端
用單一總分取代可解釋的 Interpretation
```

---

# 57. UI 驗收

UI 必須：

```text
專業
一致
視覺層級清楚
桌機漂亮
手機漂亮
平板漂亮
沒有 overflow
沒有星曜互相重疊
Tooltip 不被裁切
SVG 字體可讀
深色 / 淺色主題至少預留
```

命盤不能有：

```text
字太小
四化看不到
宮位擠爆
主星與雜曜同等視覺
手機完全不能操作
```

---

# 58. 技術驗收

至少：

```text
npm install
npm run dev
npm run build
npm run test
```

都能執行。

Build 不應依賴任何私有 Server。

---

# 59. Rule 驗收

每條 Canonical Rule 至少：

```text
ruleId
ruleVersion
status
scope
inputs
logic / executor
sourceRefs
evidenceRefs
tests
```

---

# 60. Source 驗收

不得出現：

```text
Source: ChatGPT
Source: AI
Source: 網路說法
```

必須指向真正來源。

---

# 61. 第一階段施工順序

AI Agent 應依序：

```text
1. 建 Repo Skeleton
2. 建 Schema
3. 建 Core Types
4. 建 Rule Registry
5. 建 Rule DSL
6. 建 Reference Engine
7. 建 Trace
8. 建 Relation Engine
9. 建 Transformation Engine
10. 建 Dignity Engine
11. 建 Period Engine
12. 建 Interpretation Engine
13. 建 Pattern Engine
14. 建 SVG Renderer
15. 建 Standard / Expert UI
16. 建 Tooltip / Mobile Sheet
17. 建 Rule / Source Explorer
18. 建 Test Framework
19. 加 Golden Fixtures
20. 加 Differential Framework
```

---

# 62. 第二階段施工

再逐步擴充：

```text
更多星曜
更多格局
更多流派
更多文獻
更多 Interpretation
更多 Golden Charts
Rectification
AI Research Pipeline
```

---

# 63. AI Research Pipeline

研究流程：

```text
外部來源
↓
Research Agent
↓
Research Rule
↓
Source / Evidence
↓
Conflict Detection
↓
Candidate
↓
Tests
↓
Owner Review
↓
Canonical
```

AI 不得跳過 Owner Review。

---

# 64. README 首頁應清楚寫

核心概念：

```text
ZiWeiJS-Bible is not merely a fortune-telling application.
It is a machine-readable, traceable and testable Zi Wei Dou Shu reference repository and reference engine.
```

中文版也要有。

---

# 65. 專案成功標準

這個專案成功不是：

```text
畫出一張命盤
```

而是：

```text
任何一顆星為什麼在這裡，都能追溯
任何一條規則為什麼成立，都能解釋
任何流派差異，都不會偷偷消失
任何 Canonical 變動，都能知道版本與原因
任何第三方實作，都可以拿 Golden Fixtures 驗證
任何 AI 解讀，都不能篡改底層規則
任何裝置，都能漂亮地看命盤
```

---

# 66. AI 施工時的優先順序

如果遇到衝突：

```text
正確性
>
可追溯
>
可驗證
>
架構一致
>
可維護
>
UI 品質
>
效能最佳化
```

但 UI 不能因此做成工程 Demo。

正式展示頁仍必須專業。

---

# 67. 最終交付要求

AI 每一階段施工完成後要回報：

```text
完成項目
檔案位置
設計決策
尚未完成
已知差異
Tests 數量
Golden Cases 數量
目前 Canonical Coverage
目前 UI Coverage
```

不得只回：

```text
Done
```

---

# 68. 施工中的未知規則

遇到命理規則不確定時：

```text
不可自行猜
不可直接 hardcode
```

應：

```text
建立 research rule
標記 unknown / candidate
加入 TODO evidence
保留 Variant 空間
```

---

# 69. 最終精神

ZiWeiJS-Bible 的底線：

```text
不知道就標示不知道
有爭議就保存差異
有來源就能追
有規則就能測
有結果就能重現
AI 可以幫忙研究，但不能改寫真相
```

---

# 70. 第一個 Milestone 定義

Milestone 0.1 必須可以做到：

```text
Browser 開啟
輸入生日
看到專業 RWD 紫微命盤
命盤使用 SVG
桌機 hover 星曜有簡易解釋
手機 tap 星曜有 Bottom Sheet
可以切 Standard / Expert
Expert 可看 Rule Trace
可以輸出 Chart JSON
可以跑 Unit / Golden Tests
可以查 Rule / Source
```

即使此時部分紫微規則仍屬 candidate，整個技術骨架與 UI 不可以是假頁。

---

# 71. UI 微互動

可以有：

```text
hover
focus
selected
transition
drawer
tooltip
bottom sheet
panel resize
```

但動畫必須：

```text
快速
穩定
不花俏
不干擾閱讀
```

---

# 72. Accessibility

至少：

```text
Keyboard focus
Tooltip 可被鍵盤觸發
aria-label
合理 contrast
手機 touch target >= 40px
```

SVG 星曜互動不得只支援 mouse。

---

# 73. 性能

官方 Demo 目標：

```text
首次載入快速
切換大限 / 流年不整頁 reload
切 Standard / Expert 不重算整張盤
Tooltip 即時
```

Reference Engine 應保持 deterministic，避免 UI state 污染 Engine state。

---

# 74. State Management

不要一開始導入過重框架。

核心規則：

```text
Engine State
UI State
Research State
```

分離。

---

# 75. 重要補充

如果 AI 發現 BaziJS 現有設計有可重用概念：

```text
可以參考
不可直接耦合
不可破壞 BaziJS
```

先維持 ZiWeiJS-Bible 可獨立運行。

---

# 76. 完成定義

只有當以下條件同時成立，才算 V1 架構完成：

```text
可排
可驗
可追
可看
可擴充
可換流派
可版本化
可給 AI
可離線
可 RWD
```

任何只完成其中一部分，都不能宣告 Bible V1 完成。

