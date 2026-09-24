# iztro — Capability Inventory

- Repo：`SylarLong/iztro`（MIT）— 見 `snapshot.json`
- 定位：成熟 TS 排盤 / 運限 / Query API / 多配置

## 值得吸收（高價值）

| 能力 | ZiWeiJS 現況 | 決策 | 候選 |
|---|---|---|---|
| 小限（minor period / agePalace） | 缺 | 高優先吸收概念，自己重寫 | `ASM.PERIOD.MINOR_PERIOD` |
| Query API（palace / horoscope 查詢） | 散落於 relation / transformation | 高優先吸收設計 | `ASM.SDK.QUERY_FACADE`（已實作單一 facade） |
| 動態運限星曜（流魁 / 流昌 / 流馬…） | 缺 | 高優先研究（baseStarId + scope 表達） | `ASM.PERIOD.DYNAMIC_STARS` |
| 中州 Variant | profile 已存在但不完整 | Research / Differential | `ASM.SCHOOL.ZHONGZHOU` |
| 天盤 / 地盤 / 人盤 | 缺 | Future Research | `ASM.CHART.PLANE` |

## 明確不吸收（spec §12）

```text
FunctionalAstrolabe OO 架構
i18n 系統 / AI Chat API / Agents SDK / Hosted Model / Plugin system / Docs site
核心 Engine 整包
```

## Differential 關係

iztro 為 ZiWeiJS 主要 differential oracle（`npm run differential` / `differential:period`），
**正因為不整包搬入，才保留獨立驗證價值**（spec §7）。
