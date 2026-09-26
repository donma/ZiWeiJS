# Assimilation Status & Content Expansion 盤點 (0.6.0)

> 本文件記錄 ZiWeiJS 在外部專案研究消化（Assimilation Foundation）完成後，進入 0.6.0 內容深化（Content Expansion）的現況與邊界（對應 spec 0.6 §42）。

---

## 1. Assimilation Foundation 已完成能力 (0.5.0 ~ 0.6.0)

- **Star Taxonomy & Placement**：
  - 首批 6 顆補充星曜（台輔／封誥／解神／天巫／天才／天壽）全數以 canonical 落地本命盤。
  - 每顆星具備《全書》原文或中州派講義（SRC.ZHONGZHOU, Tier 2）依據，並獲 iztro / ZhouYiLab 雙重差分驗證 100% 一致。
- **Minor Period (小限)**：
  - 依《全書》卷二安小限訣實作「不論陰陽，男順女逆」，與 iztro `horoscope().age` 100% 一致。
- **Query Facade**：
  - 宮位、星曜、三方四正、四化飛化、限運、動態流曜等全維度唯讀查詢介面。
- **Product Layer**：
  - 實作 snapshot, trend, retrieve, sharePayload, match 等唯讀組合 API，預設保護隱私，不臆造吉凶分數。
- **Task-aware AI Context**：
  - 支援 `natal` / `relationship` / `yearly` 等任務過濾，上下文精準化。

---

## 2. 0.6.0 新增深化能力 (Content Expansion)

- **Evidence & Source 強化 (Milestone A)**：
  - `SRC.ZHONGZHOU` 補齊出版、版本、傳承脈絡與載體類型（work=原著, carrier=web-transcription）。
  - `SRC.ZHOUYILAB` 正式登錄為 Tier 3 implementation source。
  - 新增 `independenceGroup` 與 `validate:evidence-independence` 驗證器，防止同源網頁轉錄被誤計為 2× Tier 3。
- **Dynamic Period Stars (Milestone B)**：
  - 新增 10 顆動態流曜（流魁、流鉞、流昌、流曲、流祿、流羊、流陀、流馬、流鸞、流喜），首批支援流年（year scope）。
  - 資料層採 `(baseStarId, scope)` 合約（不建大量假星 ID）。
  - 與 iztro `horoscope().yearly.stars` 差分測試 100% 一致。
- **Runtime Placement Metadata (Milestone C)**：
  - Star Registry 標記各星曜之 `runtimePlacement` 支援範圍。
  - 結合 Integrity Validator，確保宣告之 scope 皆有對應 Rule 支持。
- **Zhongzhou Profile 深化 (Milestone D)**：
  - 實作中州派命主（依生年支取）與天傷天使（陰男陽女對調）之 Variant Rules。
  - 由 `school-zhongzhou` profile 的 `ruleOverrides` 驅動，canonical 輸出嚴格保持不變。
  - 建立 `fixtures/golden-zhongzhou/` 專屬 golden fixtures（4 案，涵蓋 5 個差異維度）。
- **Variant Catalog 落地 (Milestone E)**：
  - 落地 `VAR.MONTH_BOUNDARY`（流月節氣月界，`school-jieqi-month`）。
  - 落地 `VAR.CHANGSHENG`（長生十二神男順女逆，《全書》原文派 `quanshu-classical`）。
  - 建立 `Void Star Identity Matrix`，維持截路/旬中/空亡為 research，防止粗暴合併。
- **Pattern & Interpretation (Milestone F)**：
  - 建立 `tools/interpretation/condition-audit.ts`，結構化稽核解讀規則條件完整性（達 98.8% full）。
- **SDK & UI 增益 (Milestone G)**：
  - 實作 `ZiWei.Profiles.explain(profileId)` API，結構化說明 profile 相對 canonical 的具體差異。
  - Expert UI 整合 Profile 差異面板、動態流曜清單與未決研究可見性清單。

---

## 3. 未決研究與邊界留痕 (Research & Rejected)

- **馬頭帶劍 (PAT.MATOU_DAIJIAN)**：維持 `research`。因《全書》卷一、卷三原文存在吉凶與安法矛盾，在取得進一步權威古籍校勘前不強行落地。
- **正空 / 傍空 / 截路**：維持 `research`。在 Void Star Identity Matrix 完整確立前，不新增重複星曜。
- **十二神 Scope (各限層重安)**：維持 `research`。
- **明確拒絕 (Rejected)**：不計算吉凶/配對分數、不導入 GPL 前端、不引入外部排盤 runtime dependency、不接受無古典原文的流派斷語。
