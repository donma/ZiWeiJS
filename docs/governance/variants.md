# Variants（流派變體）

## 概念

同一條安星/四化規則在不同流派可能有不同結果。
本專案**不覆蓋**其中一方，而是：

```text
canonical 規則         = 預設行為
variant 規則（variantOf） = 特定流派行為
profile.ruleOverrides  = 選擇要用的流派
```

## 檔案結構

```text
rules/calculation/stars/aux-variants.json
  └─ ZW.CALC.STAR.YEARSTEM_AUX.V001   (variantOf: ZW.CALC.STAR.YEARSTEM_AUX.001)
       logic.params.variantPatch = { "ZW.STAR.AUX.TIANYUE": { "xin": 5 } }

profiles/school-ma-hu.json
  └─ ruleOverrides: { "ZW.CALC.STAR.YEARSTEM_AUX.001": "ZW.CALC.STAR.YEARSTEM_AUX.V001" }
```

## variantPatch 機制

Executor 以 `variantPatchFor(ctx, canonicalRuleId)` 取得 patch，覆蓋查表結果：

```json
{ "ZW.STAR.AUX.TIANYUE": { "xin": 5 } }   // 辛干天鉞由寅(2) 改巳(5)
{ "geng": { "quan": "ZW.STAR.MAJOR.TIANFU" } }  // 庚干化權改天府
```

未提供 patch 時完全走 canonical 路徑，行為不變。

## 執行語意

- variant 規則 `logic.stage = "variant"`，**不進入執行計畫**
- 只能經 `profile.ruleOverrides` 觸發（`resolveRuleForProfile`）
- trace 的 `ruleId` 會是 **variant 的 ruleId**，`status = "variant"`
- variant 規則的 `sourceRefs` / `evidenceRefs` 來自 variant 規則本身

## 已建置的流派

| Profile | 覆寫 | 內容 |
|---|---|---|
| `school-zhongzhou` | `ZW.CALC.SIHUA.NATAL.001` → `.V001` | 庚干：天府化權、天相化科 |
| `school-ma-hu` | `ZW.CALC.STAR.YEARSTEM_AUX.001` → `.V001` | 辛干天鉞：寅 → 巳（馬蛇版） |

## 驗證

```bash
npx tsx tools/differential-runner/iztro-runner.ts   # 差異需歸類為 school-variance
npm run validate:integrity                          # variantOf 必須可解析
npm run validate:governance                         # variant 必須有 variantOf，且指向 canonical
```

`tests/unit/rule-execution.test.ts` 驗證：
profile 覆寫真的改變輸出、trace 標記 variant、variant 不進計畫。
