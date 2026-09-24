# Fortel（fortel-ziweidoushu）— Capability Inventory

- Repo：`airicyu/fortel-ziweidoushu`（MIT）— 見 `snapshot.json`
- 定位：中州派、Runtime Context、Criteria

## 值得吸收

| 能力 | ZiWeiJS 現況 | 決策 | 候選 |
|---|---|---|---|
| 中州派實作 | `school-zhongzhou` profile 已有但不完整 | 高優先研究（三方驗證） | `ASM.SCHOOL.ZHONGZHOU_DIFF_MATRIX` |
| Runtime star（hasRuntime / evalRuntimeGround） | 缺 | 吸收 Metadata 思路（`runtimePlacement` scope 表） | `ASM.METADATA.RUNTIME_PLACEMENT` |
| Criteria | — | 合併進 Query Facade | 見 `ASM.SDK.QUERY_FACADE` |

## 中州 Diff Matrix（spec §13.1，待建立 `zhongzhou-diff.json`）

需比較維度：命主 / 身主 / 天使天傷 / 魁鉞 / 截空旬空 / 歲前十二神名稱 / 四化表 /
星曜存在 / 廟旺 / 閏月 / 大限 / 流曜。

三方驗證：**Fortel + iztro zhongzhou mode + 獨立中州派資料**，不可只信一套。

## 明確拒絕（spec §15）

```text
Borrow Cell 空宮借宮百分比模型（來源不明）
Calendar 層（ZiWeiJS 較完整）
DestinyBoard / Cell / Star class OO 架構
```
