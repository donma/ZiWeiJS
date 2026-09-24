# cdestiny — Capability Inventory

- Repo：`ying-rushi/cdestiny`（MIT）— 見 `snapshot.json`
- 定位：Python 排盤 + 107 Star Dataset

## Engine：不內化（spec §16）

```text
輔星很少
廟旺簡化
true-solar 只做經度近似（無 EoT / IANA timezone / DST）
測試偏 smoke
```

→ 低於 ZiWeiJS Engine 驗證標準；**DO NOT ASSIMILATE ENGINE**，也不升為高權重 Oracle。

## 107 Star Dataset：只作 Gap Detector（spec §17 / §21）

`107 records ≠ 107 顆獨立靜態星`：內容混合 star / stage / cycle-deity / year-deity，
同名不同 category 也可能分列。故僅用於 `star-gap-audit.ts`，輸出見 `../star-gap.json`。

第一批真正值得研究的 Missing Stars（spec §18）：

```text
封誥 解神 台輔 天才 天壽 天巫
```

## 明確拒絕

```text
Python ZWDS engine
true-solar 演算法
```
