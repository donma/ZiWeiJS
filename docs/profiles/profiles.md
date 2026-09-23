# Profiles

Profile 決定「同一組輸入，用哪一套規則與時間慣例排盤」。規則本身不變，變的是被選用的規則與參數。

## 內建 Profile

| profileId | 時間制 | 換日 | 閏月 | 用途 |
|---|---|---|---|---|
| `canonical` | civil（民用時） | midnight（00:00） | 歸當月 | Bible 預設 |
| `traditional-zi` | civil | **zi-hour（23:00 子初）** | 歸當月 | 傳統子初換日 |
| `true-solar` | **true-solar（真太陽時）** | midnight | 歸當月 | 以出生地經度 + 均時差校正 |

## 欄位

```json
{
  "profileId": "canonical",
  "name": { "zh-TW": "標準" },
  "timeConvention": "civil",
  "dayBoundary": "midnight",
  "leapMonthPolicy": "same-as-normal",
  "transformationPolicy": "natal-stem",
  "starRules": {},
  "periodRules": {},
  "dignityRules": {},
  "ruleOverrides": {}
}
```

| 欄位 | 可選值 | 作用 |
|---|---|---|
| `timeConvention` | `civil` / `true-solar` / `local-mean-solar` | 時辰判定基準 |
| `dayBoundary` | `midnight` / `zi-hour` | 換日點 |
| `leapMonthPolicy` | `mid-month` / `same-as-normal` / `split` / `next-month` | 閏月歸屬 |
| `transformationPolicy` | 字串 | 四化取用來源 |
| `ruleOverrides` | `{ canonicalRuleId: variantRuleId }` | 逐條規則替換 |

## true-solar 需求

使用 `true-solar` 時必須提供 `location.longitude`，否則拋 `MISSING_LOCATION_FOR_SOLAR_TIME`。

校正量 = 經度修正（`(經度 − 標準子午線) × 4 分鐘`）+ 均時差（equation of time 近似式）。結果記錄於 `calendar.trueSolarOffsetMinutes`。

## ruleOverrides 範例

若要採用庚干天府化權的流派：

```json
{
  "profileId": "school-zhongzhou",
  "ruleOverrides": {
    "ZW.CALC.SIHUA.NATAL.001": "ZW.CALC.SIHUA.NATAL.V001"
  }
}
```

`resolveRuleForProfile(ruleId, profile)` 會自動改讀 variant 規則，而 Chart JSON 的 `generatedWith.profile` 會記錄實際使用的 profile，使結果可回溯。

## 新增 Profile 的流程

1. 建立 `profiles/<id>.json`
2. 在 `src/rule-engine/registry.ts` 匯入並加入 `profileIndex`
3. 補上 golden fixture（同一輸入、不同 profile 應產生不同結果）
4. 若非標準（canonical），於 `variants/registry.json` 登錄
