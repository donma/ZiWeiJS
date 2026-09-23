# Evidence（證據模型）

## Source vs Evidence

| 層級 | 內容 | 登錄位置 |
|---|---|---|
| **Source** | 文獻或實作本身（書、講義、排盤系統） | `sources/registry.json` |
| **Evidence** | 該文獻中「具體支持某條規則」的條目（卷/頁/條目 + 引文） | `evidence/registry.json` |

規則透過 `sourceRefs` / `evidenceRefs` 指向它們。

## Evidence 欄位

```json
{
  "evidenceId": "EVD.QUANSHU.ZIWEIXI",
  "sourceId": "SRC.QUANSHU",
  "type": "supports",
  "location": { "section": "安紫微諸星訣" },
  "quote": "六五四三二，酉午亥辰丑，局數除日數，商數宮前走…",
  "confidence": 0.95,
  "notes": "紫微星定位歌訣。"
}
```

`location` 支援字串（卷/頁/條目）或結構化物件
（`volume` / `chapter` / `page` / `section` / `imagePage` / `anchor`）。

`type` 只能是：`supports` / `conflicts` / `mentions` / `variant-only`。

## Source Tier

| Tier | 定義 |
|---|---|
| 1 | 原始古籍、可靠版本、正式出版文獻 |
| 2 | 具明確傳承或專業背景的現代著作 |
| 3 | 多個可信排盤系統一致實作（iztro、文墨天機…） |
| 4 | 老師文章、專業網站、公開課程 |
| 5 | 論壇、社群、影片、個人說法 |
| 6 | 無法確認來源的整理 |

canonical 要求 Tier 1–3。

## 明確紅線

```text
❌ Source: ChatGPT / AI / 網路說法
```

`npm run validate:sources` 會掃描來源標題與作者，含 `chatgpt` / `openai` / `claude` / `gemini` / 獨立 `ai` 字樣即失敗。
**AI 本身永遠不能是 Evidence Source。**

## 不要聚合來源（spec §P1-3）

```text
❌ SRC.MODERN-IMPL-CONSENSUS  ← 同時代表 iztro + 文墨 + 其他
✓ SRC.IZTRO / SRC.WENMO       ← 各自登錄
```

「多系統共識」是 **Derived Evidence**，不是 Source。
廟旺利陷表即採此模式：`EVD.CONSENSUS.MIAOWANG` 為衍生共識，實際引用具體實作 `SRC.IZTRO`。

## 驗證

```bash
npm run validate:sources     # schema、ID 唯一、sourceId 可解析、AI 阻擋
npm run validate:governance  # canonical evidence gate
npm run validate:integrity   # 所有 ref 可解析
```
