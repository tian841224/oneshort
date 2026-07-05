# ADR-0005: 手機聊天室去除重複關閉鈕（改用既有返回鈕樣式）並顯示實際頻道名稱

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend-rwd / chat（`MobileChatSheet`、`LiveChatRoom`、`FindPartyScreen`、`ChatPanel`、`GuildChat`）
- 相關文件: [ADR-0001](0001-overlay-history-dismiss.md)、[ADR-0003](0003-mobile-chat-sheet-close-button.md)、.agent/rules/style.md §10

## 背景 (Context)

使用者回報兩個手機版聊天問題：

1. **`/find` 大廳聊天 sheet 顯示兩層關閉鈕**：`MobileChatSheet` 的 `.os-chat-sheet__topbar`（ADR-0003 新增）與其內嵌的 `LiveChatRoom` 自身標題列的收合鈕同時存在，且兩者在 `FindPartyScreen.tsx` 的呼叫方式下都直接綁定 `mobileChatSheet.close`——**兩顆按鈕做完全相同的事**，視覺上重複、語意混亂。使用者要求：`大廳聊天` 右側按鈕改成「返回」樣式，最上方的關閉鈕移除。
2. **進入隊伍／公會聊天室時，標題沒有顯示對應的隊伍或公會名稱**：`ChatPanel.tsx`／`GuildChat.tsx` 的 `title` 一律寫死 `"隊伍聊天室"`／`"公會訊息"`，即使 `PartyChatChannelPanel`／`GuildChatChannelPanel` 已經各自抓到 `apiParty.title`／guild `name`，也從未傳入。

根因（均已讀原始碼確認，非臆測）：

- ADR-0003 新增 `.os-chat-sheet__close` 是為了給 `GlobalChatSwitcher` 內「沒有自帶關閉/返回鈕」的內容（`ChatChannelList`、`GuildChatChannelPanel`／`PartyChatChannelPanel` 的 `onBack` 只是「回頻道清單」而非「整個關閉」）補上一個**唯一**的「完全關閉 sheet」出口，在那個情境下 topbar 關閉鈕與各面板的 `onBack`（回清單）是**兩個不同動作**，並不重複。
- 但 `FindPartyScreen.tsx` 是另一條獨立路徑：`/find` 的手機聊天 sheet **不經過 `GlobalChatSwitcher`**，直接把 `LiveChatRoom` 包進 `MobileChatSheet`，且 `LiveChatRoom` 在沒有傳 `onBack` 時，會用 `collapseIcon="x"` 自己渲染一顆「收合」圖示鈕，`onCollapse` 也直接綁 `mobileChatSheet.close`——與 topbar 的關閉鈕完全同義，才造成使用者看到的「兩層關閉鈕」。
- 標題寫死問題則單純是 `ChatPanel`/`GuildChat` 從未開放 `title` 覆寫；呼叫端（`PartyChatChannelPanel`/`GuildChatChannelPanel`）其實已經有正確資料（`usePartyDetail`/`useGuildAccess` 回傳的 `title`/`name`），只是沒有接上。

## 考慮過的方案 (Options Considered)

### 關閉鈕重複

1. **從共用殼（`MobileChatSheet`）整個移除 topbar 關閉鈕，回到 ADR-0003 之前的狀態。**
   - 維護性：差——會讓 `GlobalChatSwitcher` 內沒有自帶關閉鈕的內容（`ChatChannelList` 等）重新失去唯一的「完全關閉」出口，等於推翻 ADR-0003 已驗證過的決策，且未經確認即改變其他消費者的行為。
   - 效能/安全性：無差異。
2. **`MobileChatSheet` 新增 `showClose` 開關（預設 `true`），只在 `FindPartyScreen` 這個唯一會重複的消費者關閉它；`LiveChatRoom` 改吃 `onBack` 走既有的「返回」樣式按鈕（`os-chat-back-btn`，`GlobalChatSwitcher`／`ChatSidePanel` 已在用同一樣式）（採用）。
   - 維護性：好。不新增元件、不新增 CSS，只是把 `/find` 這個特例接到既有的「onBack 優先於 onCollapse」分支（`LiveChatRoom.tsx` 既有邏輯），`GlobalChatSwitcher` 的其他消費者完全不受影響。
   - 效能：無差異。
   - 安全性：無差異——按鈕仍呼叫既有 `close()`，不新增 history 操作路徑（延續 ADR-0001 的安全對帳機制）。
3. **在 `LiveChatRoom` 內偵測「父層是否已提供關閉鈕」自動隱藏自身按鈕。**
   - 維護性：差——`LiveChatRoom` 需要感知外層容器狀態，形成跨元件隱性耦合，且無法用簡單 prop 表達，違反單一責任。

### 頻道標題

1. **`ChatPanel`/`GuildChat` 新增可選 `title` prop（預設維持原字串），呼叫端傳入實際隊伍/公會名稱（採用）。**
   - 維護性：好，資料已存在於呼叫端，純粹補一條資料管線，無需新查詢。
   - 效能/安全性：無差異。
2. **在 `ChatSidePanel` 內部各自抓取 party/guild 資料。**
   - 維護性：差——`ChatSidePanel` 是通用殼，硬耦合 party/guild 查詢會破壞其可重用性，且會造成重複請求（呼叫端已經抓過一次）。

## 決策 (Decision)

- `MobileChatSheetProps` 新增 `showClose?: boolean`（預設 `true`）；`FindPartyScreen.tsx` 對其手機聊天 sheet 傳 `showClose={false}`，並把 `<LiveChatRoom>` 改為同時傳入 `onBack={mobileChatSheet.close}` 與 `collapseIcon="chevronLeft"`——沿用 `LiveChatRoom` 既有「`onBack` 優先於 `onCollapse`」邏輯，渲染出與 `GlobalChatSwitcher`／`ChatSidePanel` 一致的「‹ 返回」按鈕樣式，行為仍是呼叫 `close()`（回到 bubble）。
- `GlobalChatSwitcher.tsx` 的呼叫方式不變（`showClose` 維持預設 `true`）：其內容（`ChatChannelList`／有 `onBack` 的頻道面板）本來就需要 topbar 提供的「完全關閉」出口，兩者語意不同，不算重複。
- `full` 狀態既有的 `.os-chat-sheet-backdrop` 點外關閉（ADR-0001／ADR-0003 已定案）維持不變，未新增/移除任何 backdrop 邏輯；`peek` 狀態依然刻意非模態（`FindPartyScreen` 雙欄需求，見 ADR-0003），不在本次變更範圍內。
- `ChatPanelProps`/`GuildChatProps` 新增可選 `title?: string`（預設分別為 `"隊伍聊天室"`/`"公會訊息"`，向後相容其餘呼叫端）；`PartyChatChannelPanel` 傳 `apiParty?.title?.trim() || "隊伍聊天室"`，`GuildChatChannelPanel` 傳 `detailQuery.data?.name?.trim() || "公會訊息"`。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能均無差異，故以維護性決勝。方案 2（開關 + 沿用既有返回鈕樣式）用最小的、有明確語意的 prop 表達「這個消費者不需要 topbar 關閉鈕」，不影響 ADR-0003 已驗證的其他消費者行為；標題則是單純補齊既有資料管線，無需新增查詢或耦合。

## 被拒絕方案與原因 (Rejected Alternatives)

- 關閉鈕方案 1（整個移除 topbar 關閉鈕）：會讓 `GlobalChatSwitcher` 的其他消費者（`ChatChannelList` 等）失去唯一關閉出口，等同未經確認推翻 ADR-0003，否決。
- 關閉鈕方案 3（`LiveChatRoom` 自動偵測父層）：造成隱性跨元件耦合，否決。
- 標題方案 2（`ChatSidePanel` 內部各自查詢）：破壞通用殼的可重用性並造成重複請求，否決。

## 影響 (Consequences)

- `MobileChatSheet.tsx`：新增 `showClose` prop（預設 `true`，向後相容）。
- `FindPartyScreen.tsx`：手機聊天 sheet 改用 `showClose={false}` + `LiveChatRoom` 的 `onBack`。
- `ChatPanel.tsx`／`GuildChat.tsx`：新增可選 `title` prop；`PartyChatChannelPanel.tsx`／`GuildChatChannelPanel.tsx` 傳入實際名稱。
- 未來若要在 `GlobalChatSwitcher` 情境下也「合併」back 與 close 語意，需先確認是否會讓使用者失去「完全關閉 sheet」的能力，並在此 ADR 之上新增決策，不得直接修改。

## Supersedes / Superseded by

無。延續並補強 [ADR-0001](0001-overlay-history-dismiss.md) 與 [ADR-0003](0003-mobile-chat-sheet-close-button.md)（未推翻其任何決定——`GlobalChatSwitcher` 情境下的 topbar 關閉鈕行為維持 ADR-0003 原決策不變）。
