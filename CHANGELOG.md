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
