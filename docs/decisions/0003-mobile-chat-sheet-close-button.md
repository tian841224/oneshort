# ADR-0003: 行動版聊天／小工具 sheet 新增顯式關閉鈕；peek 狀態維持非模態

- 狀態: 「peek 狀態維持非模態」已 Superseded by [ADR-0007](0007-mobile-chat-sheet-peek-becomes-modal.md)；「新增顯式關閉鈕」決策本身仍 Accepted
- 日期: 2026-07-05
- 相關模組: frontend-rwd / chat（`MobileChatSheet`、`useMobileChatSheet`）
- 相關文件: docs/decisions/0001-overlay-history-dismiss.md、.agent/rules/style.md §10

## 背景 (Context)

使用者回報：手機版聊天室主畫面應該加入關閉按鈕，並且點選聊天室視窗外的畫面時要能自動關閉，比照左側選單（`MobileNavDrawer`）的邏輯。

檢視 `MobileChatSheet`／`useMobileChatSheet`（bubble → peek → full 三態共用殼，`GlobalChatSwitcher`／`MobilePartyToolsSheet`／`FindPartyScreen` 皆共用同一元件）現況：

- **關閉按鈕**：sheet 展開後唯一的互動元素是頂部拖曳把手（`.os-chat-sheet__handle`），其 `aria-label` 為「收合聊天室」/「展開聊天室」，語意是 peek↔full 切換，不是「關閉」。使用者要嘛靠往下拖曳超過門檻、要嘛靠硬體返回鍵、要嘛（僅 full 狀態）點擊背景遮罩，沒有一個畫面上**明確可見的關閉鈕**。
- **點外自動關閉**：`full` 狀態已有 `.os-chat-sheet-backdrop`（`inset:0` 的全螢幕按鈕）蓋在 sheet 之外的區域，`onClick={close}` 直接呼叫 `useMobileChatSheet` 的 `close()`（依 [ADR-0001](0001-overlay-history-dismiss.md) 的模式：直接 `setState`，只有自身 sentinel 確實在 history 頂端才 `history.back()` 收回），行為已經與 `MobileNavDrawer` 的背景遮罩一致。
  `peek` 狀態則**刻意沒有**背景遮罩：`.os-chat-sheet[data-state="peek"]` 的既有註解明確說明「the sheet floats ABOVE the bottom nav ... an auxiliary/陪伴型 feature must never block the primary task」——`FindPartyScreen`（`/find`）依賴這個非模態特性，讓使用者可以在瀏覽隊伍列表的同時 peek 聊天室，兩者同時可互動。

## 考慮過的方案 (Options Considered)

1. **peek／full 皆加上背景遮罩＋點外關閉（完全比照 `MobileNavDrawer` 的二元開關邏輯）。**
   - 維護性：程式碼更單純（拿掉 `state === 'full'` 條件），但抹除 peek 和 full 兩種模式原本的語意差異。
   - 效能：無差異。
   - 安全性：無差異。
   - 缺點：`MobileNavDrawer` 本身沒有「peek」這種半開狀態可比較——它永遠是全螢幕模態。若比照它把 peek 也變成全螢幕背景遮罩會擋住整個畫面，直接推翻 `FindPartyScreen` 依賴的「peek 不擋主要任務」既有設計（程式碼註解已明確記載的刻意決策），屬於未經確認的規格倒退。

2. **只在 full（近全螢幕、`aria-modal="true"` 的「主畫面」）維持現有點外關閉；peek 維持非模態不變；另外新增一顆畫面上明確可見的 X 關閉鈕（peek／full 皆顯示）（採用）。**
   - 維護性：好。不新增特殊分支，只是把既有「關閉」語意（`close()`，已符合 ADR-0001 模式）多綁一個顯式按鈕；peek 的非模態設計維持不變、不需要改動 `FindPartyScreen` 或 CSS 的既有規則。
   - 效能：無差異。
   - 安全性：好。關閉鈕直接呼叫既有 `close()`，不繞過 ADR-0001 的 history 安全對帳機制。
   - 「聊天室主畫面」在使用者情境下對應的是近全螢幕的 `full` 狀態（`aria-modal="true"`），而非只顯示 34dvh 的 peek 預覽；`full` 狀態的點外關閉本來就已經與 `MobileNavDrawer` 一致，不需要再改。

3. **保留現狀，只加關閉鈕，不處理點外關閉。**
   - 維護性：好，但不完整回應使用者「跟左側選單一樣的邏輯」的明確要求（`full` 狀態確實已一致，但沒有把這件事講清楚／驗證過，容易被下一次修改誤判成 bug 而重複調查）。

## 決策 (Decision)

採方案 2：

- `MobileChatSheet` 新增一顆與拖曳把手同排、視覺獨立的 `.os-chat-sheet__close`（`.os-icon-btn` + `x` icon），`onClick` 直接呼叫 `sheet.close()`；在 peek／full 皆顯示（bubble 狀態整個 sheet 未掛載，不適用）。
- `.os-chat-sheet__handle` 與新關閉鈕改用 flex row（`.os-chat-sheet__topbar`）並排，因為兩者都是 `<button>`，不可互相巢狀。
- `full` 狀態既有的 `.os-chat-sheet-backdrop` 點外關閉**維持不變**（已符合 ADR-0001 模式，且是使用者所稱「主畫面」實際對應的狀態）；一併把其 `aria-label` 從寫死的「關閉聊天室」改為動態 `` `關閉${label}背景` ``，讓 `MobilePartyToolsSheet`（label="小工具"）也有正確的無障礙標籤，並與新關閉鈕的 `` `關閉${label}` `` 區分成不同的可存取名稱（`full` 狀態下兩者同時存在於 DOM，同名會讓螢幕報讀器／`getByRole` 無法區分）（此為與本次改動同一段程式碼的一致性修正，非新決策）。
- `peek` 狀態**不新增**背景遮罩／點外關閉，維持非模態，保留 `FindPartyScreen` 的既有雙欄同時互動設計。

## 理由 (Rationale)

- **安全性**：關閉鈕與既有點外關閉共用同一個 `close()`，不引入新的 history 操作路徑，維持 ADR-0001 已驗證安全的關閉語意。
- **維護性**：不新增條件分支或 prop 穿透；peek 的非模態行為已有清楚的程式碼註解記載其理由，維持原樣可讀性最好，也避免未來又要為了「點外關閉」而在多個消費者（`GlobalChatSwitcher`／`MobilePartyToolsSheet`／`FindPartyScreen`）之間分歧設定。
- **效能**：無額外成本。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1：會讓 peek 變成全螢幕遮罩，擋住 `FindPartyScreen` 需要「同時瀏覽列表＋peek 聊天」的既有可用性設計，屬於未經確認即推翻先前決策，違反 core.md §3.1「修改前必查 ADR」與「禁止在不知情下重複調整或推翻先前決策」。

## 影響 (Consequences)

- `MobileChatSheet.tsx`：新增 `.os-chat-sheet__topbar` 包住把手與新關閉鈕；`GlobalChatSwitcher`／`MobilePartyToolsSheet`／`FindPartyScreen` 三個消費者不需個別修改即可拿到關閉鈕（共用殼的既有架構優勢）。
- `globals.css`：新增 `.os-chat-sheet__topbar`、`.os-chat-sheet__close`；`.os-chat-sheet__handle` 由 `width: 100%` 改為 `flex: 1`（在新的 topbar row 內與關閉鈕並排）。
- 未來若要讓 peek 也支援點外關閉，需先確認 `FindPartyScreen` 的雙欄同時互動需求是否仍然成立，並在此 ADR 之上新增決策（標記 Supersedes），不得直接修改 CSS 移除既有非模態行為。

## Supersedes / Superseded by

無。
