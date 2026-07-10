# ADR-0026: 移除建立快速隊伍精靈的「隊伍預覽」面板

- 狀態: Accepted
- 日期: 2026-07-10
- 相關模組: frontend / party
- 相關文件: docs/features/party.md

## 背景 (Context)

`QuickCreateWizard.tsx` 的 `QuickCreatePreview` 面板（原本渲染在精靈每個 step 下方）先前是為了補齊「建立快速隊伍精靈原本沒有隊伍預覽」的落差而加上的（程式碼內舊註解鬆散標成「Bug 1 (docs/decisions/0016...) follow-up」，但 ADR-0016 本體的正式決策內容與此面板無關，該註解只是非正式追記）。

使用者於 2026-07-10 明確要求移除這塊面板，理由：快速隊伍精靈本身只有 2 個步驟（基本資料、加入方式），送出後立即會在 `/find` 列表看到剛建立的房卡並可點開詳情，預覽面板提供的資訊量（固定 1/6 名額、隊長列、5 個不限職業空位列）不足以抵銷多一塊 UI 佔用精靈垂直空間、增加使用者掃視負擔的代價。

## 考慮過的方案 (Options Considered)

1. **保留面板，只是精簡內容**：維護性上仍需持續同步面板顯示邏輯與 wizard 欄位（`title`/`channel`/`roomType` 三處雙向綁定），且使用者已明確表示不需要，保留任何形式的預覽都不符合需求。
2. **整塊移除 `QuickCreatePreview`**（採用此方案）：精靈維持單欄可捲動 modal 結構，移除後不需要額外版面調整（原本就不是兩欄佈局），對其餘畫面無副作用。

## 決策 (Decision)

移除 `QuickCreatePreview` 函式、其呼叫點、以及上方過時的「Bug 1」程式碼註解；一併清掉因此變成未使用的 import（`ClassAvatar`、`SlotStatusIcon`）與死 CSS（`.os-quick-create-preview`）。連帶移除 `.os-quick-create-dialog`／`.os-quick-create-body` 原本只在 768px 以上啟用的兩欄 grid（該欄位是專門留給預覽面板的第二欄，移除後所有斷點統一單欄可捲動）。

## 理由 (Rationale)

依 core.md §3.1 三大前提：

- **維護性**：移除後精靈不再需要維持「表單欄位 ↔ 預覽顯示」的雙向同步，減少一份需要跟著表單變動同步更新的顯示邏輯。
- **效能**：不涉及效能考量，純 UI 精簡。
- **安全性**：不涉及信任邊界變動。

主要驅動因素是使用者明確的產品決策（精靈簡化優先於預覽資訊量），非架構或效能考量。

## 被拒絕方案與原因 (Rejected Alternatives)

- **保留面板只精簡內容**：不符合使用者「移除」的明確要求，且維護代價（表單↔預覽雙向同步）未消除。

## 影響 (Consequences)

- `QuickCreateWizard.tsx` 精靈由「表單 + 預覽」變成純表單，modal 更緊湊。
- 使用者建立快速隊伍後，唯一能看到隊伍組成的地方變成建立成功後的 `/find` 列表或隊伍詳情頁（既有畫面，未受影響）。
- 不影響 `PreviewColumn.tsx`（一般隊伍建立流程的預覽欄，本次未觸碰）。

## Supersedes / Superseded by

不推翻任何既有 ADR；移除的面板本身只由程式碼內非正式註解鬆散提及 ADR-0016，ADR-0016 正式決策內容不受影響。
