# ADR-0029: 尋找隊伍卡片重新加回隊伍類型 chip（目標旁），推翻既有非 ADR 決策

- 狀態: Accepted
- 日期: 2026-07-11
- 相關模組: frontend / party
- 相關文件: [docs/frontend-logic.md §3.3](../frontend-logic.md)

## 背景 (Context)

使用者回報：尋找隊伍卡片／預覽面板的「目標」旁邊，希望能同時看到「隊伍類型」（打王/遠征/練功/團練/任務/活動）。

`docs/frontend-logic.md:253` 目前記載一條既有產品決策：「卡片不再顯示類型標籤 (BOSS/TRAINING/GROUP) chip；類型資訊改由左側類型 Logo 傳達」。這條文字建立於 2026-05-03，早於本專案的 ADR 制度（約 2026-07 才開始），因此從未掛過正式 ADR 編號，只是純文件記載。

實際檢視程式碼發現：目前唯一的「類型 chip」只在 `isQuickParty && party.type` 時於卡片標題列渲染（`PartyListCard.tsx`、`PartyPreview.tsx`），因為快速隊伍沒有「目標」區塊可依附，才留了這個例外。一般隊伍（BOSS/TRAINING/GROUP）完全沒有類型文字標籤，只能透過左側縮圖間接暗示類型——這正是使用者這次回報「看不到類型」的根因。

`PartyListCard.tsx` 與 `PartyPreview.tsx` 各自內聯重複同一份「類型 chip」JSX/樣式（`.os-list-card__type-chip`，定義於 `globals.css:3717-3722`），若繼續內聯複製到「目標旁」這個新情境會變成第三份重複，違反 core.md §3.1 的重複邏輯封裝要求。

依 core.md §3「文件過期必須同步更新或移除」與 §3.1「新決策必記錄」：這次是使用者明確指示的設計決策異動（重新加回類型標籤，且改變顯示位置），必須新增 ADR 並同步更新過期文件。

## 考慮過的方案 (Options Considered)

1. **就地複製既有內聯 JSX 到目標區塊**——在 `PartyListCard.tsx`/`PartyPreview.tsx` 的目標/objective 區塊各自再貼一份與標題列相同的內聯 chip 樣式。
   維護性：差——同一份樣式會有三處拷貝（標題列 x2 + 目標列 x2，實際上是 4 處），未來若要調整 chip 視覺（顏色、padding、字級）需要同步改 4 個地方，極易漏改。
   效能：無影響。
   安全性：無影響。
2.（採用）**抽出共用 `PartyTypeChip` 元件，兩個既有內聯呼叫點與新的目標旁呼叫點都改用它**——新增 `frontend/src/app/find/_components/PartyTypeChip.tsx`，接受 `type: PartyTypeLabel`，沿用既有 `.os-list-card__type-chip` class 與內聯樣式。`PartyListCard.tsx`/`PartyPreview.tsx` 的標題列既有呼叫點與目標/objective 旁的新呼叫點都改用它，僅在非 quick 隊伍時於目標旁渲染（quick 隊伍仍只在標題列顯示一次，不重複）。
   維護性：優——樣式與結構單一來源，未來調整只需改一處；符合 core.md §3.1「重複邏輯必須封裝」。
   效能：無影響（純展示元件，無額外查詢或運算）。
   安全性：無影響。
3. **改變資訊呈現方式，不用 chip，改成純文字附加在目標 label 裡**（如「目標：打王 · 巴風特」）——把類型併入既有 `targetLabel`/`objective.label` 字串，不新增獨立視覺元素。
   維護性：中——省去一個元件，但混合語意的字串會讓「目標 label」與「隊伍類型」耦合在一起，未來若目標 label 本身需要調整格式（例如加上地圖名稱）會牽動類型顯示邏輯。
   效能：無影響。
   安全性：無影響。且與快速隊伍既有的 chip 視覺不一致，體驗割裂。

## 決策 (Decision)

採用方案 2。具體作法：

- 新增 `frontend/src/app/find/_components/PartyTypeChip.tsx`，接受 `type: PartyTypeLabel`，沿用 `.os-list-card__type-chip` 既有 class 與內聯樣式（不新增 CSS）。
- `PartyListCard.tsx`：標題列既有的 `isQuickParty && party.type` chip 改用 `<PartyTypeChip type={party.type} />`；在 `target` 存在的 `.os-list-card__target` 區塊內，新增 `!isQuickParty && party.type && <PartyTypeChip type={party.type} />`，緊接在既有目標 chip 之前（`.os-list-card__target` 本身是 `inline-flex` + `gap`，新增的 chip 會自然並排；2026-07-11 依使用者回饋由「之後」調整為「之前」）。
- `PartyPreview.tsx`：標題-meta 列既有的 quick-party chip 同樣改用共用元件；在 `!isQuickParty && objective.target` 的 objective 區塊旁，新增同一元件（`.os-party-preview__title-meta` 本身是 `flex` + `gap`，新增的 chip 同樣自然並排）。
- 快速隊伍（quick party）維持原本標題列顯示一次，目標/objective 區塊本身對 quick party 不存在（`objectiveOf`/`objective.target` 對 quick 隊伍回傳空），因此不會重複顯示。
- `party.type`（`PartyTypeLabel`，`frontend/src/lib/design/parties.ts`）已經是人類可讀中文標籤，直接顯示，不需額外映射。
- 文件同步：`docs/frontend-logic.md` §3.3 該行文字更新為反映新行為（見「影響」段）。

## 理由 (Rationale)

- **安全性**：三個方案對安全邊界均無影響，非決策因素。
- **維護性**（本案主要考量）：方案 2 消除既有重複（原本標題列已有兩處內聯拷貝）並避免新增第三、四處拷貝，符合 core.md §3.1 的封裝要求；方案 3 雖然也能省一個元件，但會把「類型」語意耦合進目標文字，長期較難維護且與 quick 隊伍既有視覺不一致。
- **效能**：三個方案效能相同（純展示層），非決策因素。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 1（就地複製內聯 JSX）**：否決，會製造第三、四處重複拷貝，直接違反 core.md §3.1「重複邏輯必須封裝」的強制要求。
- **方案 3（併入目標文字，不用獨立 chip）**：否決，會讓「目標」與「類型」兩種不同語意的資訊耦合成單一字串，且與 quick 隊伍既有的獨立 chip 視覺不一致，體驗割裂；使用者的訴求也明確是「能看到類型」而非「調整目標文字格式」。

## 影響 (Consequences)

- `docs/frontend-logic.md` §3.3「卡片不再顯示類型標籤 (BOSS/TRAINING/GROUP) chip；類型資訊改由左側類型 Logo 傳達」這行過期文字，改為：「一般隊伍（BOSS/TRAINING/GROUP）的目標旁會顯示類型標籤（`PartyTypeChip`）；快速隊伍維持在標題列顯示，不重複」。
- 新增的 `PartyTypeChip` 元件是純展示層，對 API 契約、資料結構、後端均無影響。
- 舊決策（左側 Logo 傳達類型）並未被完全推翻——左側縮圖仍然存在、仍傳達類型的視覺印象，本次只是額外恢復文字標籤作為補充，兩者並存。

## Supersedes / Superseded by

無正式 ADR 可標記為 supersede（舊決策僅為 `docs/frontend-logic.md` 內的一般文字記載，未掛 ADR 編號），本 ADR 是該主題首次正式記錄。
