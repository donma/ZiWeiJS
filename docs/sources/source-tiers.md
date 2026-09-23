# 文獻來源分級

## Tier 定義

| Tier | 定義 | 本 repo 範例 |
|---|---|---|
| **1** | 原始古籍、可靠版本、正式出版文獻 | 紫微斗數全書、紫微斗數全集 |
| **2** | 具明確傳承或專業背景的現代著作、教材 | 中州派講義、飛星體系著作 |
| **3** | 多個可信排盤系統一致實作 | iztro、文墨天機、多系統共識 |
| **4** | 老師文章、專業網站、公開課程 | 三合派教材、百科條目 |
| **5** | 論壇、社群、影片、個人說法 | （尚未登錄） |
| **6** | 無法確認來源的整理 | （尚未登錄） |

## Candidate 規則的最低要求

- `canonical`：必須有 Tier 1–3 來源 + ≥1 筆 evidence
- `candidate`：至少 Tier 1–4 來源
- `research`：可暫無來源，但須標記待補

## 工程契約類規則（engine-contract）

有一類規則不是命理知識，而是引擎的**輸入/輸出契約**，例如：

- `ZW.CALC.BIRTH.SEX_REQUIRED.001`（未給性別時必須回報 `UNKNOWN_SEX_FOR_CALCULATION`，不得預設）
- 錯誤碼、序列化契約、schema 版本要求

這類規則的溯源對象是本 repo 的規範性建構文件，登錄為 `SRC.SPEC.ENGINE`（Tier 3、type `other`），
並在 `tags` 標記 `engine-contract`。

**限制**：`SRC.SPEC.ENGINE` 只能用於工程契約類規則；
不得用於安星、四化、廟旺、格局等命理規則（那些必須有 Tier 1–3 的命理文獻或實作來源）。

## Evidence 驗證

`npm run validate:sources` 同時驗證 source 與 evidence registry：

```
source schema 驗證
sourceId 唯一
evidence schema 驗證（location 支援字串或結構化物件）
evidenceId 唯一
evidence.sourceId 必須可解析
來源標題/作者不得含 AI 字樣
```

## 明確紅線

```
❌ Source: ChatGPT
❌ Source: AI
❌ Source: 網路說法
```

**AI 本身永遠不能是 Evidence Source。** `npm run validate:sources` 會自動偵測並擋掉來源中含 `chatgpt` / `openai` / `claude` / `gemini` / 獨立 `ai` 字樣的條目。

## Evidence 類型

| 類型 | 用途 |
|---|---|
| `supports` | 直接支持該規則 |
| `conflicts` | 與該規則衝突（用於 conflict report） |
| `mentions` | 提及但未直接支持 |
| `variant-only` | 僅支持某流派變體 |

每筆 evidence 應含 `sourceId`、`location`（卷/頁/條目）、`confidence`，並盡量附 `quote` 原文。

## 流派差異處理範例

庚干四化：

| 干 | canonical | variant（中州派） |
|---|---|---|
| 庚 | 太陽化祿、武曲化權、太陰化科、天同化忌 | 化權改天府、化科改天相 |

兩者並存：canonical 為 `ZW.CALC.SIHUA.NATAL.001`，variant 為 `ZW.CALC.SIHUA.NATAL.V001`，由 `variants/registry.json` 索引，evidence `EVD.SIHUA.VARIANT.GENG` 記錄差異依據。

辛干魁鉞亦有 `六辛逢馬虎` vs `六辛逢馬蛇` 兩說，已記錄於 `EVD.KUIYUE.VARIANT`，canonical 採馬虎（丑午）。
