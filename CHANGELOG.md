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
