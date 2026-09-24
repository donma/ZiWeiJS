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

## 0.4.0 — Hardening（P0 / P1 / P2 全數完成，含第二輪 Correctness / Governance）

目標：把 repo 從「功能完整的排盤程式」提升為「可被第三方當標準依據的 Bible Repo」。
重點是可信度、可重現、可追溯、可驗證、可治理 —— 不是功能數量。

### 第二輪 Correctness / Governance Hardening
- **P0-1 流月農曆語意**：不再把 Gregorian month 當農曆月；流月命宮由流年命宮起農曆正月順數，同一農曆月內不因國曆日期換月
- **P0-2 流日農曆語意**：由流月命宮起農曆初一順數至農曆當日，不再使用 Gregorian day
- **P0-3 PeriodInfo 契約固定**：明確 `branch`（限運命宮疊盤位置）與 `ganzhi.branch`（該層四柱真實地支）之語意差異
- **P0-4 移除 new Date() fallback**：核心 engine 不得使用無引數之 `new Date()` / `Date.now()` 作為計算結果補缺
- **P0-5 targetDate 真實日期驗證**：平年 2/29、4/31 等非法日期拋 `INVALID_TARGET_DATE`，不得靠 Date rollover 默默接受
- **P0-6 TargetDate.minute 正式支援**：驗證 0..59；`ganzhiAt` 支援 minute 精細度
- **P0-7 leapMonthPolicy 真正影響演算法**：支援 `same-as-normal`、`next-month`、`mid-month`；未支援之 `split` 明確拋 `UNSUPPORTED_PROFILE`
- **P0-8 Profile 移除假控制欄位**：移除無 consumer 之 `starRules` / `dignityRules` / `transformationPolicy`；所有 variant 統一由 `ruleOverrides` 控制
- **P0-9 限運 Differential**：五層限運（大限/流年/流月/流日/流時）對照 iztro；差異必分類（0 unclassified）；存檔至 `fixtures/differential/iztro-period/`
- **P1-1 Golden 統計拆分**：externally verified（35）與 engine-only（8）明確分開
- **P1-2 星曜覆蓋實測**：改為多案例真實排盤蒐集，不再以「非 deprecated 數量」冒充已安星（95/96 實測）
- **P1-3 README 測試數字去重**：移除 Quick Start 手寫數字
- **P1-4 Research Queue 公開 API**：`ZiWei.Research.list` / `.get` / `.forRule` / `.hasOpen`；Rules 頁面標示 open research 標籤
- **P1-5 classifyDifference 真實分類**：依 policy/table/boundary 判定分類，不再永遠回 unclassified
- **P1-7 SRC.LUNAR-TS 描述修正**：澄清真太陽時之經度修正與 equation of time 為 ZiWeiJS 自行實作
- **P2-1 跨瀏覽器 CI**：Playwright 加入 Firefox 與 WebKit（smoke + a11y 三引擎全過）
- **P2-2 Golden --check 真實漂移偵測**：重算並與 oracle 比對，任一 drift 立即報錯
- **P2-3 Period Golden Fixtures**：10 筆限運黃金案例（大限切換、農曆跨月/年、閏月、初一/月底、23:00、時區、真太陽時跨日）
- **P2-4 清理根目錄暫存檔**：移除 `.fixture-gen.tmp.ts`，`.gitignore` 加強
- **P2-5 ROADMAP 重整**：分 Done / In progress / Next，澄清 research pipeline 範圍

### 第三輪 Correctness / Contract Hardening（P0-1 ~ P2-5）
- **P0-1 虛歲以農曆年為準**：大限 / `active.age` 改用目標「農曆年」計算，跨越正月初一即換歲（不再用 Gregorian 年）；`virtualAge` / `ageAt` 改收 `targetLunarYear`
- **P0-2 年柱換年分界可選**：新增 `profile.yearBoundaryPolicy`（`lunar-new-year` / `lichun`）；新增共用 `resolveYearGanzhi(lunar, policy)`（本命與限運共用）；新增 `profiles/lichun.json`；新規則 `ZW.CALC.CALENDAR.YEAR_BOUNDARY.001` / `.V001`
- **P0-3 year-only 不再捏造 1/15**：`normalizeAnnualTarget()` 以年中定年柱；新增 `granularity` / `resolution`（`exact-date` / `representative-date` / `year-only`）；`solar.day` / `lunar.day` 於代表日情境留空
- **P0-4 斗君**：新增 `src/period-engine/doujun.ts`；流月命宮改由斗君（流年歲建起正月、逆數生月、順數生時）起算（原「流年命宮起正月順數」為誤），**修正 28 筆限運 iztro 差異**；`ZW.CALC.PERIOD.LIUYUE.001` → 2.0
- **P0-5 限運差分嚴格 Gate**：`bug` / `unclassified` / `external-error` 一律 FAIL；已知流派差異必須登錄 `variants/differential.json`
- **P0-6 四化差分真實比對**：逐 scope 比對 `lu/quan/ke/ji`；iztro locale 改 `zh-TW` 並補簡繁星名 fallback
- **P0-7 Differential fixtures 契約**：帶 `expectedScopes` 與 `external.sourceId` / `version`
- **P0-8 verify / CI 納入 live differential**：`npm run differential` 與 `differential:period`
- **P0-9 共用四化表**：新增 `ZW.CALC.SIHUA.TABLE.001` / `.V001` + `resolveSihuaPatch` / `resolveSihuaForStem`；本命/宮干/大限/流年/流月/流日/流時統一走同一 resolver
- **P0-10 歲建 / 將前十二神僅流年**：流月 / 流日 / 流時 overlay 之 `periodStars` 一律為空
- **P0-11 規則版本**：`LIUNIAN` / `LIURI` / `LIUSHI` → 1.1、`LIUYUE` → 2.0（皆附 `behavior-change` changeLog）
- **P1-1 / P1-2 嚴格出生輸入驗證**：真實國曆日期（`INVALID_DATE`）、時/分/秒範圍、經緯度範圍與 NaN/Infinity（`INVALID_INPUT`）、農曆大小月天數、DST 不存在/歧義時刻（`NONEXISTENT_LOCAL_TIME` / `AMBIGUOUS_LOCAL_TIME`）＋ `timezoneDisambiguation`
- **P1-3 / P1-4 共用年柱解析與 PeriodInfo 擴充**：`lunarYear` / `resolvedYear` / `yearBoundaryPolicy` / `resolution`
- **P1-5 / P1-6 Variance Registry**：`variants/differential.json`（6 筆，`acceptedByOwner: false`，僅 owner 可核可）；fixtures 帶外部來源版本
- **P1-7 Provenance 中繼資料**：`StarPlacement` / `Transformation` / `PatternResult` / `InterpretationHit` / `PeriodInfo` 皆帶 `provenance`（ruleId/ruleVersion/profile/sourceRefs/evidenceRefs）；修正 `placeStar` 的 `ruleId` 誤植
- **P1-8 共用限運四化解析**：`resolvePeriodTransformations` 由 `calcPeriodSihua` 與 `buildPeriodOverlay` 共用
- **P1-9 來源清理**：移除已刪除之 `SRC.MODERN-IMPL-CONSENSUS` 殘留引用
- **P2-1 ~ P2-3 治理資料**：`evidence` / `source` schema 補 `editionId` / `publisher` / `publicationYear` / `archiveUrl` / `editions[]`；補研究條目
- **P2-4 文件**：修正 `docs/api/periods.md`（斗君、虛歲、year-only、yearBoundaryPolicy、periodStars 範圍）、`public-api.md`（錯誤碼 / `timezoneDisambiguation`）
- **P2-5 Build Manifest**：新增 `tools/build-manifest.ts` → `dist/bible-manifest.json`（規則數 / profile 版本），納入 `npm run build`
- 契約：`chart.schema.json` 補 `provenance` 與 `PeriodInfo` 新欄位
- **P0-3 certainty 降級**：`year+month`（representative date）之 `certainty.periods` 由 `high` 降為 `medium`

### 第三輪補完（spec §4 / §5 / §6 / §7 驗收）
- **§4 Rule Version Gate**：新增 `tools/rule-version/validate.ts` 與 `npm run validate:versions`（最新 changeLog == ruleVersion、版本嚴格遞減、behavior-change 必升版），納入 `verify` 與 CI
- **§5 必加測試**：新增 `tests/calendar/local-wall-time-dst.test.ts`（DST 不存在/歧義 + disambiguation）、`tests/periods/doujun-leap-birth.test.ts`（出生閏月影響斗君）、`tests/differential/iztro-period-gate.test.ts`（gate 抽出為可測試純函式）、`tests/periods/overlay-scope-stars.test.ts`（歲建/將前僅流年）、`tests/governance/rule-version-behavior.test.ts`、`tests/provenance/result-provenance.test.ts`、`tests/periods/year-only-target.test.ts`
- **§6 Period Golden 外部驗證**：`fixtures/golden-period/*` 新增 `external` 中繼資料（iztro 交叉驗證；差異須通過 Variance Registry gate，否則產生失敗）；`--check` 同時偵測 oracle 與外部驗證漂移
- **§P0-5/§3 Gate 抽出**：新增 `tools/differential-runner/period-gate.ts`，runner 與測試共用同一 gate 實作
- **治理修補**：`schemas/research.schema.json` 原本拒絕既有之 `RSH.CALENDAR.YEAR_BOUNDARY` 等 ID/type（漂移未驗證）；已修正並由 `validate:schemas` 實際驗證 `research/registry.json` 與 `variants/differential.json`
- **流月天干（owner 裁定 2026-09-24）**：改採**農曆月五虎遁**（年上起月），不再採四柱節氣月柱；修正農曆月與節氣月不同步期間之流月干支與流月四化（例如 `2026-04-16` 為農曆二月 → `辛卯`，非節氣月柱 `壬辰`）
  - `ZW.CALC.PERIOD.LIUYUE.001` **2.0 → 2.1**（behavior-change）
  - 本命 `chart.calendar.ganzhi.month` 仍為真實節氣月柱，不受影響
  - 研究項 `RSH.PERIOD.MONTH_STEM` → `resolved`；原先登錄之 `VAR.PERIOD.MONTH_STEM_BASIS` 因差異消失而移除
  - period golden `lunar-year-cross` / `day-last` 由 `variance` 轉為 iztro `verified`

### P0-1 Rule 真正成為 Source of Truth
- 新增 `executor-registry` / `execute-rule` / `execution-plan`；`engine.ts` 不再直接呼叫 executor
- 執行順序來自規則資料的 `logic.stage` + `logic.order`（natal 31 步 / period 5 步）
- executor 只回 `{inputs, result, status, note}`；trace 的 `ruleId` / `ruleVersion` / `sourceRefs` / `evidenceRefs` / `profile` 一律由 Rule Registry 注入
- 補 6 條原本未被任何規則驅動的安星規則（月系第二組、年干第二組、日系、日時系、特殊雜曜、歲建將前十二神），標為 candidate 待 owner 覆核
- variant 規則不進計畫，只能經 `profile.ruleOverrides` 觸發

### P0-2 未知時辰不得偷猜
- `time.hour` 缺失 → `UNKNOWN_BIRTH_TIME`；`analyzeUnknownTime()` 仍可列舉 12 候選

### P0-3 限運正確性
- 移除隱含 `new Date()`：沒有 `targetDate` 就完全不產限運（輸出完全決定性）
- 明確 `TargetDate` 契約 + `INVALID_TARGET_DATE`
- 新增 `periods.active.major` 與 `major-period-resolver`；**大限四化改用實際所在大限**（原固定 `majorPeriods[0]`）
- `PeriodInfo.ganzhi` 明確化限運真實干支（原本 `branch` 混用「限運命宮位置」與「限運干支」）
- 流月 / 流日 / 流時干支由 `targetDate` 實際推算

### P0-4 Profile 真的控制演算法
- `ruleOverrides` → `resolveRuleForProfile` → 實際執行 variant，trace 標記 `status=variant`
- 未知 `periodRules.ageMethod` → 明確報錯，不再靜默

### P0-5 DSL fail-close
- 新增 `schemas/dsl.schema.json`（定義全部 operator 與必要參數）
- 未知 operator → `UNKNOWN_DSL_OPERATOR`；參數錯誤 → `INVALID_DSL`
- 移除 `default: return true` 的 fail-open 分支
- 修正 3 條格局使用未記載的 `type: "any"`（現為明確 operator）
- `pattern` operator 改讀真實 PatternResult
- DSL 錯誤不再靜默：寫入 trace `status=error` + reason

### P0-6 解讀衝突 / 覆蓋真正生效
- 新增 `interpretation-engine/resolver.ts`：overrides → conflicts → supports → priority sort
- `InterpretationHit.status`：`active` / `overridden` / `conflicted`（+ `supportedBy`）
- 被覆蓋者降強度但**不移除**；**不產生單一總分**
- Narrative 預設只吃 `active`

### P0-7 未知性別不得偷猜
- `direction` 新增 `undetermined`；長生十二神與大限標記 `unavailable` 並附 reason
- natal 不依賴性別的資料仍正常計算

### P1 治理與驗證
- `tools/integrity-validator`：ID 唯一、ref 可解析、executor 可解析、canonical 有來源與證據、DSL schema、計畫覆蓋、changeLog / 版本一致
- `tools/governance-validator`：Canonical Evidence Gate（Tier1/2 或 2×Tier3）、variantOf、deprecated 引用、AI 來源阻擋
- `tools/schema-validator`：`chart.schema.json` 嚴格驗證（15 張盤 + 3 錯誤情境）
- `chart.schema.json` 全面重寫：核心物件 `additionalProperties: false` + `extensions` 逃生口
- 新增 `schemas/dsl.schema.json` / `star.schema.json` / `pattern.schema.json`
- `validate:sources` 擴充為同時驗證 evidence；`evidence.schema.json` location 支援結構化
- 移除聚合來源 `SRC.MODERN-IMPL-CONSENSUS`（P1-3），新增 `SRC.LUNAR-TS`；廟旺共識改為 Derived Evidence
- 13 條 canonical 補 evidenceRef、89 條補 changeLog
- `TRUESOLAR` 由 canonical 降為 candidate（單一 Tier3 來源 + 近似式），並建 research 項目 RSH.007

### P1-6 真太陽時跨日
- 校正跨午夜時，solar / lunar / 日柱 / 時柱同步調整；子時換日以 effective time 判定

### P1-4 / P1-5 Oracle 化
- Golden V2：**35 張**完整 oracle fixtures（calendar / 12 宮 / 14 主星 / 輔煞 / 四化 / 廟旺 / 大限 / 格局），
  含 `verified` 區塊；產生時**必須先通過 iztro 外部對照**才寫入，禁止 `_computed_`
- Differential fixtures：`fixtures/differential/iztro/` 12 筆存檔外部結果，CI 不需外部套件即可比對

### P2 工程
- `npm run verify`：Schema → Governance → Integrity → Calendar Differential（`--check`）→ Tests → Build
- `npm run coverage:bible`：覆蓋率報告，並可自動更新 README 數據區塊（不再手寫數字）
- CI 加入全部 gate
- 文件：`docs/architecture/{calculation-flow,rule-execution}.md`、`docs/governance/{canonical,evidence,variants,versioning}.md`、`docs/rules/{patterns,interpretation}.md`、`docs/api/periods.md`、`docs/testing/verification.md`

### P2-4 UI Visual Regression（Playwright）
- 6 個 viewport（375x812 / 390x844 / 768x1024 / 1024x768 / 1440x900 / 1920x1080）全頁面水平溢出 = 0
- 星曜 tooltip 不被裁切（含行動裝置夾限修正）；同宮星曜方塊不得相交（重疊檢測）
- 視覺快照：home / chart-standard / chart-expert / dark / tooltip / bottom-sheet / rules / sources / geek
- 修正 `.chart-page-layout` / `.card` / `.grid` 的 `min-width: 0` 與 `.table-scroll`，解決 375 / 390 / 768 溢出

### P2-5 Accessibility
- 以 `@axe-core/playwright` 掃描 6 條路由（WCAG 2.0/2.1 A+AA），serious / critical = 0
- 修正：`.kv` 由 `div` 改為 `dl`、`role="tablist"` 誤用、SVG `role="img"` 內含互動節點、`select` 無名稱、內文連結無非色彩區別、可捲動 `pre` 不可聚焦、色彩對比不足（`--text-faint` / `--warn`）
- 鍵盤：Tab 順序涵蓋 nav → 表單欄位 → 送出；Enter 可提交表單
- **SVG 星曜互動不再只支援滑鼠**：補 `Enter` / `Space` 觸發（`<g role="button">` 不會自動觸發 click）
- dialog / drawer / bottom-sheet：Esc 關閉、開啟後焦點移入、關閉後焦點還原；`initSheet` 重複綁定修正
- touch target ≥ 24x24 CSS px（依 WCAG 2.5.8，內文 inline 連結豁免）

### P2-6 Calendar Differential
- 新增 `tools/calendar-differential/run.ts`，以兩套獨立實作互相驗證：
  `lunar-typescript@1.8.6`（本引擎依賴） vs `lunar-lite@0.2.8`（iztro 依賴）
- **逐日差分 1900-01-31 ~ 2100-12-31：73,384 日**，農曆 年/月/日/閏月（293,536 欄）與日柱（73,384 欄）**0 未解釋差異**
- 閏月表 201 年、年柱 / 月柱各 4,824 欄；所有差異均為已知且已驗證的慣例差
  （年柱換年 104 筆：本引擎採農曆正月初一，已用 lunar-typescript 立春版逐筆驗證；
   23:00 子時換日 10 筆）
- `fixtures/calendar/`：`calendar-differential.json`、`day-boundary.json`（子時 / 午夜 / 真太陽時跨日）、
  `timezone-dst.json`（9 筆人工查證 IANA 事實：1974 美國全年 DST、1968-1971 英國全年 BST、
  1979 台灣 DST、1986-1991 中國 DST）
- `npm run differential:calendar -- --check` 納入 `verify` 與 CI（fixture 與實作不得漂移）

### Breaking
- `schemaVersion` **1.0 → 2.0**（period 契約、`direction` 列舉、`chart.stars` 型別）
- 沒有 `targetDate` 時不再產生限運
- `time.hour` 成為必填
- 第三輪：`chart.schema.json` 新增可選 `provenance` 與 `PeriodInfo.{lunarYear,resolvedYear,yearBoundaryPolicy,resolution}`；規則版本 `LIUYUE` 升為 2.0（流月命宮改斗君）；`profile.yearBoundaryPolicy` 預設 `lunar-new-year`

### 測試
- **533 tests / 44 files**（Vitest；0.3.0 為 150、第二輪為 412）
- **62 Playwright tests**：Chromium（UI 20 + a11y 13 + file:// 1）+ Firefox（14）+ WebKit（14）
- `tests/integrity/`（spec §25）：與 `validate:integrity` 共用同一份實作，ID 唯一 / 參照可解析 /
  canonical 溯源 / DSL 與 star schema / 執行計畫覆蓋 / changeLog 一致性 / chart output schema
- `tests/regression/spec37.test.ts`（spec §37 逐條驗收）：無時辰→error、未知性別不 forward、
  無 targetDate 不產流年、targetDate 改變→active period 改變、真太陽時跨日、23:00 換日慣例差異、
  DSL typo→error、profile override 生效、Trace 自動帶 source/evidence/version
- Determinism（spec §26）：`JSON.stringify(calculate(input))` 連同 periods 完全一致，不再需要 strip
- 差分：iztro 30 案例 × 45 欄 = 1350 欄（natal 布星 0 needs-review；晚子時案例差異歸類換日/流派）
- 限運差分：5 案例五層限運 **154 欄：148 match / 6 已知 day-boundary variance（全數登錄）**；5 筆存檔 fixture
- 第三輪新增測試：year-boundary（14）、major-age-boundary（7）、doujun（6）、sihua-variant-scope（9）、birth-input-validation（11）、year-only-target（6）、doujun-leap-birth（5）、overlay-scope-stars（4）、local-wall-time-dst（8）、iztro-period-gate（11）、rule-version-behavior（8）、result-provenance（7）
- 曆法差分：73,384 日 + 201 閏月年 + 9 筆歷史時區查證，0 未解釋差異
- Golden fixtures：35 筆 v2 oracle + 8 legacy + 10 筆 period golden oracle；Differential fixtures：17 筆（12 iztro + 5 iztro-period）+ 3 筆（calendar）

## 0.4.1 — Final Stabilization（Hardening 收尾 / Stable Baseline）

本版**不變更排盤結果**（最後一次引擎行為變更為 0.4.0 的流月天干農曆月五虎遁）。
目的：契約對齊、研究治理、發佈層 smoke、文件對齊，並建立穩定基線。

### 契約對齊
- **ResearchStatus 單一型別**：`src/ai/research-registry.ts` 由 `open|in-progress|resolved|closed`
  改為 `open|candidate|resolved|rejected`，與 `research.schema.json` 一致，並自 `src/index.ts` 公開匯出
- `hasOpenResearch()` 改以 `ACTIVE_RESEARCH_STATUSES = {open, candidate}` 判定
- `ResearchItem` 新增 `resolution` / `resolvedAt` / `resolvedBy`；schema 於 `status=resolved` 時要求 `resolution`

### 研究治理
- 新增 `npm run validate:research`（`tools/research-validator/validate.ts`）：ID 唯一、
  `relatedRules` / `evidence` 可解析、`resolved` 需 `resolution` 且 `ownerReviewRequired=false`、
  `candidate` 需 `ownerReviewRequired=true`；並修正既有研究項 `RSH.004` 誤植的規則 ID
  （`QIANGYANG` → `QINGYANG_PARENTS.001`）
- `RSH.PERIOD.MONTH_STEM`：`question` 改為歷史敘述並補 `resolution`（owner 裁定農曆月五虎遁）；
  `RSH.001` 拆開「歌訣 / 實際落支 / 目前 canonical」三段
- `RSH.PERIOD.DOUJUN` 補 `resolution` / `resolvedAt` / `resolvedBy`

### 發佈層驗證
- 新增 `tools/release-validator/artifact-smoke.ts`：`dist/` 產物存在、ESM bundle 可 import 並實際排盤、
  版本常數與 `bible-manifest.json` 一致、manifest rules / profiles 數量與 Registry 一致
- 新增 `tools/release-validator/package-smoke.ts`：`npm pack` → 檢核 `files[]` → 解開到 `node_modules`
  → 以 bare specifier `import 'ziwei-bible'` 排盤，模擬第三方 consumer
- 新增 `npm run release:smoke` / `npm run release:check`（= `verify` + 發佈 smoke）；`verify` 納入 `validate:research`
- CI 收尾（`build.yml`）：於 `validate:versions` 後補 `validate:research`，並於 `npm run build` 後執行
  `npm run release:smoke`；CI 治理 Gate 自此與 `npm run verify` 完全一致

### 文件
- README 移除手寫統計（`209 rules` / `28 evidence` 等），改以指令輸出為準；Gate 清單補
  `validate:schemas` / `validate:versions` / `validate:research` / `release:check`
- `docs/testing/verification.md` 重寫：Gate 順序與 `verify` / CI 完全一致（含 `validate:versions`、
  `validate:research`、`differential`、`differential:period`、`verify:golden`），移除會漂移的數字，
  補 Release Gate 與三引擎 a11y 說明

### 版本
- `package.json` / `BIBLE_VERSION`：`0.4.0` → **`0.4.1`**（Stable Baseline）

> 依 Final Stabilization §11–§13：本版之後進入 **Hardening Freeze**。
> 除非發生 §12 所列 correctness / contract 等情況，否則不再開 Hardening，
> 後續一律歸類為 Feature / Assimilation / Research。

## 0.5.0 — Post-Stability Assimilation（Phase A + Phase B/C candidate）

依 `ZiWeiJS-Post-Stability-External-Strength-Assimilation-SPEC-v1` 施工。
外部專案只作 **研究樣本 / 實作觀點 / 驗證對象 / 資料索引**，不是 ZiWeiJS 的架構（spec §53）。

### Phase A — Catalog Foundation（M1）
- **Entity Taxonomy**：新增 `src/core/entity-kinds.ts`（`AstroEntityKind` = star / stage /
  cycle-deity / year-deity / period-dynamic / transformation-marker）；star schema 支援
  `entityKind` / `aliases`；沐浴（MUYU）明確標為 `stage`
- **Cycle Registry**：新增 `tables/cycles/{changsheng,boshi,suiqian,jiangqian}.json`
  （各 12 筆，含 stable key / index / starId / rule / evidence），把 stage / cycle-deity /
  year-deity 與 star 分開，避免「少 24 顆星」的誤判（spec §19 / §38）
- **Alias Registry**：新增 `tables/stars/aliases.json`（別名 / 簡繁 / 同名消歧，
  含飛廉、大耗、旬空、空亡、截路、年解…），禁止字面自動合併（spec §37）
- **Star Gap Audit**：新增 `tools/assimilation/{normalize-name,star-gap-audit,checks,validate-catalogs}.ts`
  → `research/assimilation/star-gap.json`：43 個外部名稱分類為
  actual-missing-star 3 / existing 5 / external-only 6 / stage 12 / cycle-deity 8 / ambiguous 4 / period-dynamic 5
- **External Snapshot**：新增 `tools/assimilation/external-snapshot.ts` 與
  `research/assimilation/*/snapshot.json`（**真實** commit / license / capturedAt；
  iztro・fortel・cdestiny・ziwei-doushu = MIT、ziwei-chart = GPL-3.0、ziwei-doushu-simple = 不明）
- **Reject Registry**：`research/assimilation/rejections.json`（12 項，spec §46）避免未來重複搬入
- **Assimilation Schema**：`schemas/{cycle,star-aliases,external-snapshot,assimilation-candidate,assimilation-rejection}.schema.json`
- Research Queue 新增 8 項（小限、年神 scope、封誥 / 解神 / 台輔 / 天才 / 天壽 / 天巫）

### Phase B / C — 古典原文查核 + Candidate 規則（不影響 canonical 輸出）
- **古典原文查核（雙獨立來源）**：新增 `SRC.QUANSHU.WIKISOURCE`（維基文庫）與
  `SRC.QUANSHU.DIANCANG`（中華典藏網，**非鏡像之第二份獨立文本**），兩者於台輔／封誥／解神／小限
  安星訣逐字相符；證據 `EVD.QUANSHU.{TAIFU,FENGGAO,JIESHEN,XIAOXIAN}` + `EVD.QUANSHU.DIANCANG.*`，
  另加負向查核 `EVD.QUANSHU.CLASSICAL-VERIFICATION.MISSING`（absence of evidence）
- **Canonical Evidence Gate 已解除**：candidate 規則之 `sourceRefs` 具兩份獨立 Tier3 → 符合
  「Tier1/2 或 2×獨立 Tier3」；由 `tests/unit/candidate-stars.test.ts` 的證據強度測試把關。
  升 canonical 仍需 Owner 批准（AI 不得自行升級）
- **同名異義防護**：維基文庫《紫微斗數》屬舊「十八飛星」系統（其「台輔」指文昌、另有天壽），
  已於 source notes 與 `research/assimilation/classical-verification.md` 明載，不得混用
- **新增 candidate 星曜**：台輔（午起子時順）、封誥（寅起子時順）、解神年解（戌起子逆至生年太歲）
  → `tables/stars/candidate-aux-tables.json` + `src/candidate-stars/candidate-stars.ts`
  + `src/executors/candidate-stars-executors.ts` + 星曜 registry（`status: candidate`）
- **新增小限**（`ZW.CALC.PERIOD.XIAOXIAN.001`）：寅午戌起辰、申子辰起戌、巳酉丑起未、亥卯未起丑；
  方向採原文「不論陰陽、男順女逆」；性別未知時 **skip，不猜方向**
- **規則**：`rules/calculation/stars/aux-candidates.json`、`rules/calculation/periods/periods-candidates.json`
  —— 一律 `status: candidate` + `stage: on-demand`，**不進** `NATAL_EXECUTION_PLAN` / `PERIOD_EXECUTION_PLAN`，
  故 canonical 盤面與 golden oracle 完全不變；升 canonical 為 Owner 專屬動作（spec §1.3 / §56）
- **查無古典依據者不實作**：天巫 / 天才 / 天壽（全書卷二安星訣未載）、月解、童限
  → 只更新 Research Queue（現 21 項），不建規則、不建表
- 公開 API：`ZiWei.Candidate.*`（auxStars / taiFu / fengGao / jieShen / xiaoXian）
- **小限改為目標日期綁定**（升 canonical 之必要前置）：新增 `xiaoXianForTarget()`
  以「目標農曆年 − 生年農曆年 + 1」求虛歲後定位（與大限同一慣例），
  並提供 `ZiWei.Candidate.xiaoXian.forTarget(chart, target)`；性別未知／無目標日期時回報 reason、不猜方向
- 測試：`tests/unit/candidate-stars.test.ts`（口訣逐支展開 + 目標綁定 + candidate 護欄 + 證據強度）、
  `tests/differential/candidate-stars.test.ts`（iztro 全案例 台輔／封誥／年解 100% 一致）
- 修正：`package.json` 重複的 `validate:catalogs` 鍵（先前 Phase A 誤植）

### Phase B（canonical 升格）— 台輔／封誥／解神併入本命盤
- **Owner 於 2026-09-24 批准**：`ZW.CALC.STAR.TAIFU_FENGGAO.001` 與 `ZW.CALC.STAR.JIESHEN.001`
  由 `candidate / on-demand` 升為 **`canonical / natal`**（ruleVersion `0.1 → 1.0`，changeLog `behavior-change`）
- 星曜 registry：`ZW.STAR.AUX.{TAIFU,FENGGAO,JIESHEN}` 升 canonical，`sources` 納入兩份獨立文本
- **星曜數 96 → 99**；每張盤新增台輔（午起子時順）、封誥（寅起子時順）、解神年解（戌起子逆至生年太歲）
- golden v2 oracle **重生 35 fixtures** 並重新通過 iztro 外部驗證與 `--check`（無 drift）
- 規則檔更名／整併：`aux-candidates.json` → `aux-taifu-fenggao-jieshen.json`；
  表檔 `candidate-aux-tables.json` → `aux-supplementary-tables.json`；
  executor 更名 `calcAuxTaiFuFengGao` / `calcAuxJieShen`（小限仍為 `calcCandidateXiaoXian`）
- 護欄測試改寫：canonical 三顆星必須進執行計畫且出現在盤面；小限必須維持 candidate 且不得進盤面
- Research Queue：`RSH.STAR.{TAIFU,FENGGAO,JIESHEN}` → `resolved`（resolvedBy: owner）
- 小限仍為 candidate（演算法已改為 `targetDate`／虛歲綁定），待 Owner 批准

### Phase C（canonical 升格）— 小限併入限運輸出
- **Owner 於 2026-09-24 批准**：`ZW.CALC.PERIOD.XIAOXIAN.001` 由 `candidate / on-demand`
  升為 **`canonical / period`**（ruleVersion `0.1 → 1.0`，changeLog `behavior-change`）
- 新增 `chart.periods.xiaoxian`（`XiaoXianPeriod`：虛歲 / 地支 / 宮位 / 目標農曆年 / label / provenance）
  與 `certainty.xiaoxian`；`chart.schema.json` 新增 `$defs/xiaoXianPeriod`
- 年齡以虛歲（目標農曆年 − 生年農曆年 + 1，與大限同一慣例）；方向採原文「不論陰陽、男順女逆」；
  性別未知 → 不產生小限且 `certainty=unknown`（不猜方向）
- **差分驗證**：與 `iztro` `horoscope().age`（`IZTRO_CASES` 7 案 × 2 目標日）**100% 一致**
（nominalAge 與 小限宮位地支皆相符）
- API 更名：`ZiWei.Candidate` → **`ZiWei.Supplementary`**（`Candidate` 保留為 deprecated 別名）；
  模組 `src/candidate-stars/` → `src/aux-supplementary/`，檔名／executor 同步更名
- `PERIOD_EXECUTION_PLAN` 由 5 → **6**（大限/流年/流月/流日/流時/小限）
- Research Queue：`RSH.PERIOD.MINOR_PERIOD` → `resolved`（resolvedBy: owner）

### Phase F — Variant Research Catalog（流派差異維度盤點）
- 新增 `research/variants/variant-catalog.json`：spec §26 之 **14 個維度**全數涵蓋
  （modeled 2 / partially-modeled 7 / not-modeled 5），每維度記載機制
  （profile 欄位 / ruleOverrides variant / none）、externalObservation、gap、nextAction
- 新增 `schemas/variant-catalog.schema.json`、`tools/variants/{checks,validate-catalog}.ts`
  與 `npm run validate:variants`（已納入 `verify` 與 CI）
- 新增測試 `tests/variants/variant-catalog.test.ts`（9 測試）：維度集合相等、
  機制一致性、modeled 必須有 profile 實際選用 variant、既有 variant 無黑數
- **重要發現**：《全書》卷二長生十二神作「男命順數、女命逆數」（不論陰陽），
  與 canonical 之「陽男陰女順、陰男陽女逆」於陰男／陽女時相反 →
  登錄 `RSH.STAR.CHANGSHENG_DIRECTION`（是否變更 canonical 屬 Owner 決策）
- Research Queue 新增 8 項（月界、閏月拆分、廟旺整表、天馬、天空、截空/旬空、
  天傷天使、長生方向，及晚子時混合流派、魁鉞其他天干）→ 共 31 項

### Phase G — Pattern Research Backlog（格局擴充，先研究不追數量）
- 新增 `research/patterns/pattern-backlog.json`：自《紫微斗數全書》卷三「格局」章
  逐條登錄 **11 條**（equivalent 1 / research 9 / rejected 1），每條附原文、來源與定位
- 新增 `schemas/pattern-backlog.schema.json`、`tools/patterns/{checks,validate-backlog}.ts`
  與 `npm run validate:patterns`（已納入 `verify` 與 CI）
- 新增測試 `tests/patterns/pattern-backlog.test.ts`（7 測試）：原文必填、
  research 必附 Research ID 且不得指向既有 pattern（防「假研究、真實作」）
- 重要判定：**貪狼遇火名為火貴格 ＝ 既有 `ZW.PAT.YINGHUO.001`（火貪／鈴貪）**；
  「財官格／貴格（依生年干逐宮條列）」**rejected**（屬 Interpretation 層，非具名格局）
- 優先研究候選：石中隱玉格（原文兩處互證）、兼文武格、左右朝垣格；
  馬頭帶劍原文疑似脫誤，需校勘後再議
- Research Queue 新增 `RSH.PATTERN.BACKLOG` → 共 32 項

### Phase E — Profile Gap Audit（宣告 vs runtime 實作盤點）
- 新增 `tools/profiles/{checks,profile-gap-audit}.ts` → `research/profiles/profile-gap.json`
  （spec §5 之 `profile-gap-audit`）＋ `npm run profiles:gap[:check]`（已納入 `verify` 與 CI）
- 盤點：6 profiles、11 個 schema 宣告欄位，其中 **6 個真的被 runtime 消費**（附消費位置）；
  4 個 **未實作值** 逐一標註（`leapMonthPolicy.split/mid-month/next-month`、
  `timeConvention.local-mean-solar`）並掛 Research ID
- 新增測試 `tests/profiles/profile-gap.test.ts`（6 測試）：profile 清單一致、
  未實作值必有 gap 與可解析 Research ID、`runtimeConsumed` 必有消費位置
- **中州派現況基線**：`school-zhongzhou` 僅覆寫庚干四化兩條；廟旺表、星曜互涉／宮干飛化用法
  尚未以 variant 表達 → 新增 `RSH.PROFILE.ZHONGZHOU`（需可引用來源，不得憑印象補齊）
- 另有 `RSH.PROFILE.TIME_CONVENTION`（local-mean-solar 未實作）→ Research Queue 共 34 項

### Phase I — Product Layer（唯讀組合層，SDK）
- 新增 `src/product/product.ts` 與 **`ZiWei.Product`**：
  `snapshot`（命盤摘要 + 指紋）、`trend`（逐年限運時間軸：大限／流年／小限）、
  `retrieve`（薄封裝 `QueryApi`）、`sharePayload`（**預設不含出生資料**）、
  `match`（僅列舉共同事實，**無吉凶評分**）、`fingerprint` / `canonicalJson`（穩定序列化）
- 護欄：**不新增任何命理規則**；若需新知識必須回到 Bible 流程
  （Research → Source/Evidence → Rule → Test → Owner 批准），不得寫在 Product 層
- 測試 `tests/product/product.test.ts`（11 測試）：決定性、唯讀（呼叫後 chart 不變）、
  `retrieve` 與 `QueryApi` 一致、`sharePayload` 隱私預設、`match` 無評分欄位
- 尚未做（待 Owner 決定）：UI 呈現（時間軸／分享卡），目前僅 SDK 層以免動到視覺回歸基準

### Phase D — Query Facade（SDK ergonomics）
- 新增 `src/query-engine/query.ts` 與 `ZiWei.Query.*`（palace / star / hasStars / hasAnyStar /
  relations / sanFangSiZheng / opposite / isEmptyPalace / transformations / fliesTo /
  selfTransformations / period）。**只查既有 Engine 結果，不新增第二套演算法**（spec §8 / §44）
- 公開 API 新增 `ZiWei.StarRegistry` / `ZiWei.Taxonomy`

### Phase H（部分）— Property Tests 與 Boundary 方法
- 新增 `tests/property/astro-invariants.test.ts`（spec §29）：12 宮 / 地支唯一 / 命身宮唯一 /
  十四主星各一 / 紫微系天府系相對位置 / 四化唯一 / deterministic / overlay 不污染 natal
- 新增 `tests/boundary/exact-instant.test.ts`（spec §30）：立春與農曆新年以**精確時刻**
  before / at / after 驗收

### Correctness 修正（由 §30 邊界測試發現）
- **`resolvedYear`（lichun 制）修正**：立春後、春節前之日原誤算為 `lunarYear - 1`（跨兩個年度），
  改為由立春制年柱回推所屬年度；`ZW.CALC.CALENDAR.YEAR_BOUNDARY.V001` 升 **1.1**（behavior-change）

### Gate
- `verify` 納入 `validate:catalogs` 與 `assimilation:star-gap:check`；CI 同步
- `npm run assimilation:snapshot`（需網路，手動執行，不在 verify）
- 版本 `0.4.1 → 0.5.0`

