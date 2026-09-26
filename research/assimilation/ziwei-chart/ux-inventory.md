# ziwei-chart UX 與產品層能力清單 (UX Inventory)

> 本文件記錄 `ziwei-chart` 產品與 UX 設計特點分析，供 ZiWeiJS Product Layer 參考（spec §31 / §32 / §50 M9）。
> 嚴格遵守規範：不複製 GPLv3 程式碼、不建立第二套 Knowledge DB、不引入運勢分數。

## 1. UX 設計亮點與借鏡

1. **資訊分層與摘要**
   - 產品需求：一般使用者需要一目了然的特徵摘要，而非直接面對複雜的星曜干支表。
   - 實作對應：`src/product/product.ts` 實作 `snapshot()`，提供命身宮主星、四化摘要、核心格局與各宮精簡資料。

2. **時間趨勢（Trend）**
   - 產品需求：觀察特定時段（例如數年或數月）內的運勢起伏、焦點宮位轉移。
   - 實作對應：`src/product/product.ts` 實作 `trend()`，按時間序列輸出限運宮位、流耀與重點星曜狀態。

3. **合盤與共鳴（Match）**
   - 產品需求：兩張命盤的互動比較（宮位星曜對照、三方四正相互激發）。
   - 實作對應：`src/product/product.ts` 實作 `match()`，客觀輸出共同主星、命宮地支關係（六合/沖/刑/同宮）與四化交錯，嚴格禁止臆造百分比「配對分數」。

4. **安全分享卡片（Share Payload）**
   - 產品需求：產生社群分享圖卡或資訊摘要，但保護個人出生隱私。
   - 實作對應：`src/product/product.ts` 實作 `sharePayload()`，預設不包含詳細生辰八字（`includeBirthInput: false`），僅輸出命宮主星、格局標籤與匿名指紋。

5. **任務導向 AI 檢索（Task-aware Context Retrieval）**
   - 產品需求：針對特定問題（本命個性、感情關係、流年財運）提供 LLM 精確的上下文切片。
   - 實作對應：`toContext(chart, { task: 'natal' | 'relationship' | 'yearly' })`，過濾出對應領域的 Interpretation Hits。

## 2. 明確拒絕事項（Anti-Patterns）

- 禁止計算「吉凶分數」或「相合度百分比」。
- 禁止內嵌第二套非古典來源的「解盤資料庫」。
- 禁止使用 GPLv3 前端元件或樣式表。
