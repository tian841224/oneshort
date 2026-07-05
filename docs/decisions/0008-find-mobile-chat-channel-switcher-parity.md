# ADR-0008: `/find` 手機聊天 sheet 改用共用頻道切換內容，與其他頁面行為一致

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend-rwd / chat（`FindPartyScreen`、`GlobalChatSwitcher`、新元件 `ActiveChatChannelContent`）
- 相關文件: [ADR-0005](0005-mobile-chat-sheet-dedupe-close-and-dynamic-title.md)

## 背景 (Context)

ADR-0005 把 `/find` 手機聊天 sheet 的關閉鈕改成「返回」樣式，但只是**把原本的關閉動作換了個樣式**——`onBack` 綁的仍是 `mobileChatSheet.close`（整個關閉 sheet），因為 `/find` 的手機聊天 sheet 架構上**只會顯示大廳聊天**（`LiveChatRoom` 是唯一內容），沒有像 `GlobalChatSwitcher`（其他頁面共用的聊天泡泡）那樣的「大廳／公會／已加入隊伍」頻道清單可以返回。

使用者測試後回報：點「返回」變成關閉，而不是進到聊天室選單，並質疑「為什麼不同頁面的聊天室行為不一致，應該要一致」。這指出一個更根本的問題：`/find` 的手機聊天體驗與全站其他頁面不同調——其他頁面的聊天泡泡都能在大廳/公會/隊伍聊天間切換，只有 `/find` 被鎖死在大廳聊天，導致「返回」這個字面意思本身就有誤導性（沒有地方可以「返回」）。

## 考慮過的方案 (Options Considered)

1. **把「返回」改回單純的關閉樣式（X 圖示），承認 `/find` 從來沒有頻道選單這件事，避免用詞誤導。**
   - 維護性：好，改動極小。
   - 效能/安全性：無差異。
   - 缺點：沒有回應使用者「應該要一致」的明確訴求，且沒有解決「/find 跟其他頁面體驗不同調」的根本問題——下次還是可能被回報成 bug。
2. **把 `GlobalChatSwitcher` 內「依 `view`/`activeChannel` 決定要渲染頻道清單或哪個頻道」的邏輯抽成共用元件（`ActiveChatChannelContent`），`FindPartyScreen` 的手機 sheet 改用同一個元件，並在 `/find` 掛載時把共用的 `activeChatChannelStore` 預選為大廳頻道（不強制彈出，比照 `PartyDetailScreen` 既有對其自身頁面的預選 pattern）（採用）。**
   - 維護性：好。抽出的邏輯只有一份，`GlobalChatSwitcher` 與 `FindPartyScreen` 都消費同一份定義，不會再因為各自維護一份 switch 邏輯而分歧；沿用已存在且已測試過的 `ChatChannelList`／`PartyChatChannelPanel`／`GuildChatChannelPanel`，沒有新建 UI。
   - 效能：無差異（同一批 hooks/查詢，只是換了掛載位置）。
   - 安全性：無差異。
   - 取捨：`activeChatChannelStore` 是全域 store，`/find` 與其他頁面現在共享同一份「目前選到哪個頻道」狀態；需要在 `/find` 掛載時主動預選大廳，否則會顯示使用者上一個頁面留下的頻道（甚至是頻道清單本身），而非預期的「一進 /find 就看到大廳聊天」。
3. **`/find` 自己重新實作一份簡化版頻道清單元件，不與 `GlobalChatSwitcher` 共用。**
   - 維護性：差——會產生第二份幾乎相同的 switch 邏輯與頻道清單 UI，未來新增頻道種類或調整清單顯示規則時，兩處都要改，重蹈 core.md §3.1 禁止的重複邏輯覆轍。

## 決策 (Decision)

採方案 2：

- 新增 `src/components/chat/ActiveChatChannelContent.tsx`：從 `GlobalChatSwitcher.tsx` 抽出「依 `activeChatChannelStore` 的 `view`/`activeChannel` 決定渲染 `ChatChannelList` 或哪個頻道面板」的邏輯，參數化 `currentUser`／`isAuthenticated`／`onRequireLogin`。
- `GlobalChatSwitcher.tsx` 改為呼叫 `<ActiveChatChannelContent>`，行為與改動前完全一致（純重構，無行為變更）。
- `FindPartyScreen.tsx`：
  - 手機 `<MobileChatSheet>` 的子元件由固定的 `<LiveChatRoom>` 改為 `<ActiveChatChannelContent>`；`label` 由固定的 `"大廳聊天"` 改為通用的 `"聊天室"`（比照 `GlobalChatSwitcher`，因為 sheet 內容現在會依選擇的頻道而變）；`showClose` 移除（恢復預設 `true`）——頻道清單根視圖本身沒有「返回」目標，需要 topbar 的關閉鈕作為唯一出口，與 `GlobalChatSwitcher` 的既有模式一致。
  - 新增一個 `useEffect`，在 `/find` 掛載時呼叫 `openChatChannel({ kind: "lobby" }, { openPopover: false })`，只預選頻道、不強制彈出 sheet——與 `PartyDetailScreen.tsx` 既有的「掛載時預選自己頁面的頻道」pattern 完全相同寫法，確保使用者一進 `/find` 仍是直接看到大廳聊天，而非頻道清單或上一頁殘留的頻道。
- 桌面版（`chatDock.pinned`／`DesktopChatDock` 的兩個 `<LiveChatRoom>`）不受影響——桌面版的釘選/浮動聊天本來就是 `/find` 專屬、獨立於 `GlobalChatSwitcher` 的既有設計（未在使用者本次回報範圍內），本次改動只涉及手機版。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能均無差異，方案 2 用單一共用元件消除「兩份幾乎相同的頻道切換邏輯」，直接回應使用者「應該要一致」的訴求，且完全重用既有、已測試過的子元件（`ChatChannelList`／`PartyChatChannelPanel`／`GuildChatChannelPanel`），是最小風險的做法。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（只改用詞）：沒有解決使用者指出的根本不一致問題，否決。
- 方案 3（`/find` 自建一套）：會製造重複邏輯與未來維護分歧，違反 core.md §3.1，否決。

## 影響 (Consequences)

- `/find` 的手機聊天現在可以切換到公會／已加入隊伍聊天，與其他頁面完全一致；`FindPartyScreen` 桌面版行為不變。
- `activeChatChannelStore`（全域）現在也被 `/find` 讀寫；離開 `/find` 後其他頁面的聊天泡泡預設頻道會是使用者在 `/find` 最後選到的頻道（與現有「頁面預選頻道」機制一致的既有行為，非新增的例外）。
- 聊天泡泡在 `/find` 手機版上的未讀數（`unreadCount`）目前仍固定為 0（`MobileChatSheet` 預設值），未比照 `GlobalChatSwitcher` 加總大廳/公會/隊伍未讀數——這不在使用者本次回報範圍內，若之後需要一併補上，屬於下一個獨立任務。

## Supersedes / Superseded by

無。延續並補強 [ADR-0005](0005-mobile-chat-sheet-dedupe-close-and-dynamic-title.md)（未推翻其決策，`showClose` 開關機制仍保留供其他消費者使用，只是 `/find` 本次改為不再需要它）。
