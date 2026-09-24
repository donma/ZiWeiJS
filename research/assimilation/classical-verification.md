# 古典原文查核紀錄（Assimilation Phase B / C）

本檔記錄「外部缺星清單 → 古典原文查核 → candidate 決策」的過程與結論。
對應 SPEC：`ZiWeiJS-Post-Stability-External-Strength-Assimilation-SPEC-v1`（Phase B 星曜覆蓋、Phase C 小限）。
結構化資料見同目錄 `classical-basis.json`。

## 方法

1. 由外部實作清單（見各 `research/assimilation/<project>/external-star-names.json`）取得 Gap Detector 清單。
2. 以**古典原文**為主要依據，且**至少兩份互相獨立的電子文本**：
   - `SRC.QUANSHU.WIKISOURCE`（維基文庫《紫微斗數全書》卷二，tier 3，2026-09-24 取得）
   - `SRC.QUANSHU.DIANCANG`（中華典藏網《紫微斗數全書》卷二，tier 3，2026-09-24 取得；非鏡像）
   兩份文本於台輔／封誥／解神／小限等安星訣**逐字相符**（僅簡繁差異）。
3. 以外部實作（`SRC.IZTRO`，tier 3）作**交叉比對**，僅證明實作一致性，不作為 canonical 依據。
4. 有古典原文者 → 建 `candidate` 規則（`stage: "on-demand"`，不影響 canonical 盤面）；
   無古典原文者 → 只登錄 Research Queue，**不實作、不建表**。

取得原文的方式（可重現）：

```
GET https://zh.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=紫微斗數全書/卷二
GET https://www.diancangwang.cn/xuanxuewushu/c890bd9a328b/804fd5cb53e4.html
```

## 同名異義陷阱（重要）

維基文庫另有《紫微斗數》條目（pageid 254072），屬舊「十八飛星」系統：
星曜為紫微、天虛、天貴、天印、天壽、紅鸞、天庫、天貫、文昌、天福、天祿。
該文直言「**文昌星，名曰台輔**」——其台輔、天壽與十四主星系統**同名異義**。
因此本專案僅採《紫微斗數全書》卷二之安星訣，並已在 source notes 明載，避免日後誤引。

## 結論一覽

| 名稱 | 古典依據 | 原文（節錄） | 處置 |
|---|---|---|---|
| 台輔 | 有 | 由午宫起子顺数至本生时安之 | candidate 規則 |
| 封誥 | 有 | 由寅起宫子顺数至本生时安之 | candidate 規則 |
| 解神（年解） | 有 | 解神从戌上起子，逆数至当生年太岁上是也 | candidate 規則 |
| 小限 | 有 | 寅午戌人起辰宫…不论阴阳男俱顺数不论阴阳女俱逆数 | candidate 規則 |
| 天巫 | **未載** | — | open（不實作） |
| 天才 | **未載** | — | open（不實作） |
| 天壽 | **未載** | — | open（不實作） |
| 月解 | 未取得 | 僅見於外部實作 | open（RSH.STAR.YUEJIE） |
| 童限 | 有訣但語意未定 | 一命二財三疾厄…十五命宮看端的 | open（RSH.PERIOD.TONGLIAN） |

負向查核以 `EVD.QUANSHU.CLASSICAL-VERIFICATION.MISSING`（type: `mentions`，quote 標記 `(absent)`）記錄，
避免將「查無」誤當成「有依據」。

## candidate 規則（尚未影響上線輸出）

| 規則 | 內容 | stage |
|---|---|---|
| `ZW.CALC.STAR.TAIFU_FENGGAO.001` | 台輔（午起子時順）、封誥（寅起子時順） | on-demand |
| `ZW.CALC.STAR.JIESHEN.001` | 解神年解（戌起子逆至生年太歲） | on-demand |
| `ZW.CALC.PERIOD.XIAOXIAN.001` | 小限起宮 + 男順女逆（性別未知則 skip） | on-demand |

因 `stage: "on-demand"`，三者**不在** `NATAL_EXECUTION_PLAN` / `PERIOD_EXECUTION_PLAN` 中，
canonical 盤面與既有 golden fixtures 完全不變（由 `tests/unit/candidate-stars.test.ts` 護欄驗證）。
Owner 核可後，將 `status` 改 `canonical` 並把 `stage` 改 `natal` / `period` 即可併入主盤。

## 升 canonical 準備度（2026-09-24）

| 項目 | 證據強度 | 狀態 |
|---|---|---|
| 台輔、封誥 | 2×獨立 Tier3（相符） | **證據已足**，待 Owner 批准 |
| 解神（年解） | 2×獨立 Tier3（相符） | **證據已足**，待 Owner 批准 |
| 小限 | 2×獨立 Tier3（起宮/方向相符） | 證據已足，但**演算法須先改**（見下） |
| 天巫／天才／天壽 | 無古典依據 | 不升（維持 Research Queue） |

升 canonical 前置作業（非證據問題）：

1. **小限必須先改為由 `targetDate`／虛歲定位**：現行 executor 回傳靜態「虛歲 1–12 序列」，
   未綁限運；直接改 `stage: "period"` 會輸出與流年無關的死資料。
2. 重生 35 個 golden v2 oracle（新增三顆星會使全部 fixture drift），並重新與 iztro 交叉驗證。
3. 更新護欄測試（`tests/unit/candidate-stars.test.ts`、`tests/regression/integrity.test.ts`）
   由「不得進入盤面」改為 canonical 期待值，並保留負向測試。
4. Owner 批准為**必要條件**（`canPromoteStatus()`：AI 不得將 candidate 升 canonical）。

## 驗證

- 單元測試：`tests/unit/candidate-stars.test.ts`（口訣逐支展開、護欄、canonical 不受影響）
- 交叉比對：`tests/differential/candidate-stars.test.ts`（`IZTRO_CASES` 全案例 台輔／封誥／年解 100% 一致）
- 注意：iztro 之「解神」為**月解**，與本專案 candidate 解神（年解）不同義，故未納入比對。

## API

```ts
ZiWei.Candidate.taiFu(hourBranch)            // → branch
ZiWei.Candidate.fengGao(hourBranch)
ZiWei.Candidate.jieShen(yearBranch)
ZiWei.Candidate.auxStars({ hourBranch, yearBranch })
ZiWei.Candidate.xiaoXian.startBranch(yearBranch)
ZiWei.Candidate.xiaoXian.branchAtAge(yearBranch, sex, age)
ZiWei.Candidate.xiaoXian.sequence(yearBranch, sex, 1, 12)
```

以上輸出均標示為 candidate，**預設不併入 canonical 盤面**。
