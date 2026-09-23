# 規則生命週期與治理

## 狀態機

```
research ──→ candidate ──→ canonical
   │            │              │
   │            │              ├──→ deprecated
   │            │              │
   └────────────┴──────────────┴──→ undetermined
                │
                └──→ variant（與 canonical 並存，不走同一條升級線）
```

| 狀態 | 中文 | 意義 |
|---|---|---|
| `research` | 研究中 | 已蒐集資料但未定論 |
| `candidate` | 候選 | 有證據支持，待 Owner 審核 |
| `canonical` | 標準 | 已批准，Bible 預設採用 |
| `variant` | 流派版本 | 與 canonical 並存的另一種做法 |
| `deprecated` | 已棄用 | 不再採用（例如已被其他機制取代） |
| `undetermined` | 未定 | 無法判定 |

## 權限

| 動作 | AI Agent | Owner |
|---|---|---|
| 建立 research rule | ✅ | ✅ |
| 建立 candidate rule | ✅ | ✅ |
| 建立 evidence | ✅ | ✅ |
| 產生 conflict report | ✅ | ✅ |
| `candidate → canonical` | ❌ | ✅ 僅 Owner |
| 建立 variant | ✅ | ✅ |

## 每條 Canonical Rule 必備

```
ruleId          ZW.<DOMAIN>.<NAME>.<NNN>
ruleVersion     語意版本，如 "1.0"
status          canonical
scope           如 calculation.palace.life
inputs          需要的輸入欄位
logic           { executor } 或 { dsl }
sourceRefs      ≥1（Tier 1–3 優先）
evidenceRefs    ≥1（引文 + 位置）
changeLog       變更類型 + 說明
```

## 變更類型

| 類型 | 意義 | 是否升 Schema Version |
|---|---|---|
| `breaking` | 輸出結構改變 | ✅ 必須 |
| `behavior-change` | 計算結果改變（如換流派） | 升 Rule Version |
| `evidence-update` | 只補/改來源證據 | 否 |
| `wording-only` | 文案調整 | 否 |
| `deprecated` | 標記棄用 | 否 |

## 三層版本

| 層級 | 欄位 | 位置 |
|---|---|---|
| Repo Version | `version` | package.json |
| Schema Version | `schemaVersion` | Chart JSON 頂層 |
| Rule Version | `ruleVersion` | 每條 rule |

Chart 會記錄 `generatedWith { bibleVersion, schemaVersion, profile, engineVersion }`，任何結果都可回溯到產生它的版本組合。

## AI Research Pipeline

```
外部來源
  ↓
Research Agent（抓取、整理）
  ↓
Research Rule（status: research）
  ↓
Source / Evidence 登錄
  ↓
Conflict Detection（與現有 canonical 比對）
  ↓
Candidate（status: candidate）
  ↓
Tests（golden / unit）
  ↓
Owner Review  ← AI 不得跳過
  ↓
Canonical（status: canonical）
```

## 紅線

- AI 永遠不能作為 Evidence Source
- 不得把 Variant 直接改成 Canonical
- 不得用單一總分取代可解釋的 Interpretation
- 不得偷偷預設未知時辰或性別
- 不確定就標記，不猜
