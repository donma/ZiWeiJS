# Changelog

## 0.1.0 — Milestone 0.1

- Repo skeleton：schemas / rules / tables / sources / evidence / profiles / variants / fixtures / tools / docs
- Reference Engine：國曆↔農曆（含閏月）、四柱干支、IANA 時區 + 歷史 UTC offset + 真太陽時、子初/午夜換日
- 命宮 / 身宮 / 十二宮 / 宮干（五虎遁）/ 命主身主
- 五行局（命宮納音）、十四主星（紫微系逆行 + 天府系順行）
- 輔星 / 煞星 / 雜曜：左輔右弼、文昌文曲、祿存羊陀魁鉞、火鈴、天馬、紅鸞天喜、孤辰寡宿、華蓋咸池、天傷天使、天刑天姚、地空地劫等
- 四化：生年 + 宮干（飛化/自化）+ 限運（大限/流年/流月/流日/流時）
- 廟旺利陷 engine、十二長生、博士十二神
- 大限（陽男陰女順/陰男陽女逆、局數起歲）、流年/流月/流日/流時
- Relation engine：同宮/對宮/三方四正/夾宮/拱照
- Rule DSL：all/any/none/not/exists/compare/star-in-palace/relation/star-group/transformation/dignity/period-scope/palace/pattern/profile/variant
- Interpretation engine（domain 分組、strength/confidence/priority/supports/conflicts/overrides）
- Pattern engine（complete/partial/enhanced/broken/variant-only/insufficient）
- Rectification + `analyzeUnknownTime`（12 時辰候選、stable/variable/unavailable 分類）
- `ZiWei.AI.toContext`、deterministic Narrative templates
- Trace：每條 executor 記錄 ruleId/inputs/result/profile/sourceRefs/evidenceRefs
- SVG 命盤 renderer（4×4 宮位、中央資訊區、主星視覺優先、四化 badge、廟旺、長生博士、大限）
- 官方 UI：首頁 / 命盤 / Expert / Rule Explorer / Source Explorer / Differential / Geek / About；RWD、深淺主題、tooltip + bottom sheet + drawer、SVG/PNG/JSON/Print 匯出
- Tests：52 cases（unit 27 / golden 5 / boundary 11 / differential 3 / regression 6）
- Tools：rule-validator / source-validator / differential-runner / build-types
- Phase-2 partial：輔星擴充（三台/八座/龍池/鳳閣/天官/天福/天廚/恩光/天貴/歲驛/官符/大耗/小耗/病符/亡神/陰煞）、interpretation 擴充至 37 條、格局擴充至 12 條
- Bug fix：sihua 表輔星 ID 誤植 MAJOR 前綴（WENCHANG/WENQU/ZUOFU/YOUBI）→ 改為 AUX，natal sihua 現恆為 4 筆

## 0.2.0 — Bible 嚴整性補完

### 星曜（72 → 96）
- 歲建十二神（period）：歲建/晦氣/喪門/貫索/官符/小耗/大耗/龍德/白虎/福德/弔客/病符
- 將前十二神（interim）：將星/攀鞍/歲驛/息神/華蓋/劫煞/災煞/天煞/指背/咸池/月煞/亡神
- 補 11 顆沒安的小星：截空/旬空/天空/天乙（年干）、蜚廉（年支）、天德/月德/天月（月支）、息神/指背（年支）
- 沐浴標 deprecated（已由長生十二神取代）
- 星曜覆蓋率 **96 中 95 有安法**

### 規則（88 → 111）
- 格局 13 → 24（紫殺朝斗、廉殺同宮、武貪同行、機巨同臨、同巨同宮、日巨同宮、廉相同宮、府梁同宮、日月照壁、羊陀夾忌、火鈴夾命）
- 解讀 43 → 51，domain 覆蓋 12/12（補 family / learning / migration / relationship / risk / social / timing）
- 全部 111 條補上 `changeLog`

### 治理（spec §28 / §63）
- 新增 `src/ai/research.ts`：Research Pipeline 階段護欄
  - `canAdvance()` — AI 不得進入 owner-review / canonical、不得跳階段
  - `canPromoteStatus()` — AI 不得將 candidate/variant 升級為 canonical
  - `classifyDifference()` — spec §29.2 八類差異分類
- 新增 `research/registry.json` + `schemas/research.schema.json`（研究佇列 6 筆）
- 新增 `docs/governance/rule-lifecycle.md`

### 衝突模型修正（spec §19）
- 修正 `overrides` / `conflictsWith` 解析（原實作讀錯物件、方向相反）
- 新增 `overridesList` 與 `effectiveStrength`（被覆蓋者降強度但**不移除**，保留可解釋性）
- 新增 `tests/unit/conflict.test.ts`（6 條：對稱性、反向一致性、降強度、不移除）

### 介面（spec §26 / §45 / §50）
- Rule Explorer 可展開規則詳情（條件、來源、Evidence、變更紀錄、Trace 範例）+ 即時搜尋/篩選
- Trace 完整鏈路：點星曜 → 安星規則 → inputs/result → Source/Evidence
- i18n：zh-TW / zh-CN / en 切換（topbar），廟旺/長生/博士標籤支援三語

### 工具與文件
- `tools/fixture-generator`（golden / differential 產生器）
- `docs/`：architecture/overview、governance/rule-lifecycle、api/public-api、rules/rule-dsl、sources/source-tiers、profiles/profiles

### 測試（82 → 108）
- + `tests/unit/conflict.test.ts`（6）、`tests/unit/research.test.ts`（11）、`tests/unit/i18n.test.ts`（7）、golden 全星圖驗證（+2）
- 目前 11 檔 / 108 tests 全過

## 0.3.0 — 差分驗證與布星正確性修正

差分測試（iztro 對照）首次實跑即抓出兩個真實排盤 Bug，已修正並以外部來源回歸驗證。

### 正確性修正（P0）
- **宮干五虎遁公式錯誤**：地支序未先對 12 取模即對 10 取模，導致子、丑宮干偏移。
  例：1990-05-15 命宮 `丙子` → 正確為 `戊子`；五行局連帶由 `水二局` 修正為 `火六局`。
- **起紫微星訣索引基準錯誤**：誤將「宮位序（寅 = 0）」當作「地支序（子 = 0）」，
  導致紫微定位與十四主星全數位移。已改用宮位序演算法（`ziweiPalaceIndex`）。
- **流年宮位天干** 同類取模錯誤一併修正（`src/period-engine`）。
- 型別修正：`chart.stars` 由 `Record<string, StarPlacement[]>` 更正為 `Record<string, StarPlacement>`；
  `Star` 補上 `shortDesc`；移除因錯誤型別而散落各處的 `as unknown as` 強制轉型。

### 差分測試（spec §29）
- `tools/differential-runner/iztro-compare.ts`：抽出可重用對照核心（星名對映、時辰索引、快照、比對、分類）
- `tools/differential-runner/iztro-runner.ts`：CLI 改寫（`npm run differential`），自動併入 `fixtures/golden/*.json` 案例
- 對照結果：**10 案例 × 45 欄 = 450 欄，0 需人工檢視**（35 欄/案例可比對全部吻合）
  - 涵蓋命宮、身宮、五行局、十四主星、可比對輔煞雜曜、四化
  - 23 時（晚子時）案例以 `traditional-zi` profile 對齊，差異自動歸類為「換日差異」而非 Bug

### 測試（108 → 150）
- 新增 `tests/differential/iztro.test.ts`（8）：命身宮/五行局/十四主星全等、每案吻合數門檻、
  所有差異必附 §29.2 分類、不得出現 `bug` 分類、換日差異專項
- 新增 `tests/regression/ziwei-position.test.ts`（11）：以《全書》口訣「六五四三二，酉午亥辰丑」
  與三個原典算例（木三局 27 日→戌、火六局 13 日→亥、土五局 6 日→未）作獨立期望值；
  水二局 30 日完整定位表
- `tests/unit/engine.test.ts` 補「庚年五虎遁十二宮干全表」驗證

### Golden Fixtures
- `case-1990-05-15-male`、`case-1993-07-07-female` 期望值依修正後引擎重生，並改由差分測試同步檢驗

### 維護
- `tsconfig.json` 加 `noEmit: true`（避免 `tsc` 誤將 `.d.ts` 產物寫入 `tests/`）
- 移除誤入版控的 `tests/**/*.test.d.ts`；`.gitignore` 補建置產物與本機 `ai-guide/`
- CI 加入 `validate:rules` / `validate:sources`

### 治理
- 新增來源類別「工程契約」：`SRC.SPEC.ENGINE`（Tier 3, type `other`）+ `EVD.SPEC.ENGINE.SEX_REQUIRED`，
  使 `ZW.CALC.BIRTH.SEX_REQUIRED.001` 具備可溯源依據（spec §52）；規則 `tags` 標記 `engine-contract`
  - 明文限制：此來源不得用於安星/四化/廟旺/格局等命理規則
- `evidence.schema.json`：`location` 支援結構化定位（volume/chapter/page/section/imagePage/anchor）
- `validate:sources` 擴充為同時驗證 evidence：schema、ID 唯一、`sourceId` 可解析
  → 目前 10 sources / 20 evidence / 0 failed
- 文件補 `docs/sources/source-tiers.md`：工程契約類規則與 Evidence 驗證說明
