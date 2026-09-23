# Rule DSL

規則條件以 JSON 表達，由 `evalDsl()` 求值。所有節點皆為物件。

## 邏輯組合

| 節點 | 語意 |
|---|---|
| `{ "all": [ ... ] }` | 全部成立 |
| `{ "any": [ ... ] }` | 任一成立 |
| `{ "none": [ ... ] }` | 全部不成立 |
| `{ "not": { ... } }` | 取反 |

## 條件節點

### star-in-palace
```json
{ "type": "star-in-palace", "star": "ZW.STAR.MAJOR.ZIWEI", "palace": "life" }
```

### relation
`relation` 可為 `same-palace` / `opposite` / `san-fang-si-zheng` / `jia` / `gong` / `hui-zhao` / `chong` / `adjacent`。
```json
{ "type": "relation", "relation": "san-fang-si-zheng", "palace": "life",
  "containsAny": ["ZW.STAR.AUX.ZUOFU", "ZW.STAR.AUX.YOUBI"] }
{ "type": "relation", "relation": "san-fang-si-zheng", "palace": "life",
  "containsAll": ["ZW.STAR.MAJOR.TIANFU", "ZW.STAR.MAJOR.TIANXIANG"] }
```

### star-group
`group` 可用預設群組（`major-14` / `major-malefic` / `aux-assist` / `literary` / `nobleman` / `peach`）或星曜 ID 陣列。
```json
{ "type": "star-group", "group": "major-malefic", "relation": "same-palace" }
{ "type": "star-group", "group": ["ZW.STAR.MAJOR.ZIWEI", "ZW.STAR.MAJOR.TIANFU"],
  "relation": "san-fang-si-zheng", "palace": "life", "minCount": 2 }
```

### transformation
```json
{ "type": "transformation", "transform": "ji", "palace": "life", "scope": "natal" }
```
`transform`: `lu` / `quan` / `ke` / `ji`；省略 `palace` 表示任一宮。

### dignity
```json
{ "type": "dignity", "star": "ZW.STAR.MAJOR.TAIYANG", "minLevel": "wang" }
```
順序：`miao > wang > de > li > ping > bu > xian`。

### palace
```json
{ "type": "palace", "palace": "friends", "empty": true }
{ "type": "palace", "palace": "life", "isBody": true }
```

### period-scope
```json
{ "type": "period-scope", "scope": "year" }
```
`major-period` / `year` / `month` / `day` / `hour`。

### compare / exists / profile / variant
```json
{ "type": "compare", "left": "bureau", "op": "eq", "right": "shui2" }
{ "type": "exists", "path": "periods.year" }
{ "type": "profile", "profile": "canonical" }
{ "type": "variant" }
```

## 完整範例

```json
{
  "all": [
    { "type": "star-in-palace", "star": "ZW.STAR.MAJOR.ZIWEI", "palace": "life" },
    { "type": "relation", "relation": "san-fang-si-zheng", "palace": "life",
      "containsAny": ["ZW.STAR.AUX.ZUOFU", "ZW.STAR.AUX.YOUBI"] }
  ],
  "none": [
    { "type": "star-group", "group": "major-malefic", "relation": "same-palace" }
  ]
}
```

## 求值失敗處理

`evalDsl` 對未知 `type` 回傳 `true`（寬鬆），但 pattern/interpretation engine 會 `try/catch`，例外一律視為未命中，避免單一壞規則汙染整盤。
