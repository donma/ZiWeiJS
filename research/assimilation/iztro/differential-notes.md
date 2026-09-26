# Iztro 差分測試與整合記錄 (Differential Notes)

> 本文件記錄 `iztro` 作為本引擎 differential test oracle 的比對範圍、方法與邊界差異分類（spec §7 / §50 M1）。

## 1. 角色定位

- `iztro` 是成熟的 TypeScript 紫微排盤開源專案（MIT License）。
- 在 ZiWeiJS 中，`iztro` 嚴格作為 **外部獨立對照基準（Differential Oracle）**。
- 嚴禁：將 iztro 作為 runtime dependency、複製其程式碼或將其算法直接視為古典依據。

## 2. 測試覆蓋矩陣

### 2.1 本命盤（Natal Chart）
- 工具：`tools/differential-runner/iztro-runner.ts`
- 測試套件：`tests/differential/iztro.test.ts`、`tests/differential/fixtures.test.ts`
- 覆蓋案例：30 個具代表性案例（含閏月、跨年、子時、夏令時間等）。
- 覆蓋項目：十四主星、七吉六煞、四化、命身宮、五行局、限運起迄。

### 2.2 限運（Periods）
- 工具：`tools/differential-runner/iztro-period-runner.ts`
- 測試套件：`tests/differential/iztro-period.test.ts`、`tests/differential/iztro-period-gate.test.ts`
- 覆蓋範圍：大限、流年、流月、流日、流時。

### 2.3 補充星曜與小限（Phase B / C）
- 測試套件：`tests/differential/aux-supplementary.test.ts`
- 覆蓋星曜：台輔、封誥、年解、天巫、天才、天壽（29 個 civil 案例 100% 一致）。
- 小限：比對 iztro `horoscope().age` 虛歲與起宮，100% 一致。

## 3. 已知流派與換日差異分類

詳見 `variants/differential.json`：
1. **子時換日（Day Boundary）**：晚子時（23:00~00:00）日柱干支歸屬不同流派習慣（`VAR.PERIOD.DAY_BOUNDARY.LATE_ZI`）。
2. **真太陽時經度支援**：iztro `bySolar()` 未內建經度時差計算，真太陽時測試改以 Golden Oracle 驗證。
3. **部分雜曜安法**：如天傷／天使於陰陽男女性別之流派分支差異。
