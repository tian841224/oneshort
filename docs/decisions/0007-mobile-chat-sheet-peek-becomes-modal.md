# ADR-0007: 手機聊天 sheet 的 peek 狀態改為模態（點外自動關閉）

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend-rwd / chat（`MobileChatSheet`）
- 相關文件: [ADR-0003](0003-mobile-chat-sheet-close-button.md)（本 ADR 推翻其「peek 維持非模態」決策）、[ADR-0005](0005-mobile-chat-sheet-dedupe-close-and-dynamic-title.md)、.agent/rules/style.md §10

## 背景 (Context)

[ADR-0003](0003-mobile-chat-sheet-close-button.md) 明確決定：`full` 狀態（近全螢幕）點擊背景遮罩會關閉聊天 sheet，但 `peek` 狀態（~34dvh 預覽）刻意**不加背景遮罩、維持非模態**，理由是 `FindPartyScreen`（`/find`）需要讓使用者能「邊瀏覽隊伍列表邊 peek 聊天室」，兩者同時可互動。

使用者本次回報：手機聊天室應該「點選聊天室視窗外的畫面時自動關閉」。經確認，使用者截圖顯示的正是 `peek` 狀態，且使用者在追問後明確表示：**即使會犧牲「peek 時仍可點列表卡片」的能力，也要 peek 狀態也支援點外自動關閉**。這是對 ADR-0003 該部分決策的直接、有意識的推翻（非在不知情下的重複調整），依 core.md §3.1「推翻舊決策」流程處理。

## 考慮過的方案 (Options Considered)

1. **維持 ADR-0003 現狀（peek 非模態），僅回覆使用者現況。**
   - 不採用：使用者已在澄清問題後明確表示要犧牲雙欄同時互動、改要 peek 也點外關閉，維持現狀不符合使用者明確指示。
2. **peek 與 full 共用同一個 `.os-chat-sheet-backdrop`，點擊即關閉；peek 的 `z-index` 從 `--z-content-overlay`（低於 `--z-bottom-nav`）提升到 `--z-overlay`（與 full 一致，高於 backdrop 與底部導覽）（採用）。**
   - 維護性：好。沿用既有 `close()` 語意與 backdrop 元件，不新增分支或另一套關閉機制。
   - 效能：無差異。
   - 安全性：無差異，仍是既有 `close()`，不新增 history 操作路徑（延續 ADR-0001 的安全對帳機制）。
3. **只在 `/find` 以外的頁面讓 peek 模態化，`/find` 維持非模態以保留雙欄互動。**
   - 維護性：差——`MobileChatSheet` 是共用殼，讓同一個元件依賴「呼叫者是哪個頁面」切換模態行為，會造成隱性、難以追蹤的條件分支，且使用者的訴求是「點外都要關閉」，並未限定僅特定頁面例外。

## 決策 (Decision)

- `MobileChatSheet.tsx`：`.os-chat-sheet-backdrop` 改為在 `peek` 與 `full` 兩種狀態都渲染（原本只在 `state === 'full'` 渲染）。
- `globals.css`：`.os-chat-sheet[data-state="peek"]` 的 `z-index` 由 `var(--z-content-overlay)`（45，刻意低於 `--z-bottom-nav` 的 50）改為 `var(--z-overlay)`（60，與 `full` 一致）——否則 backdrop 會蓋在 peek sheet 本身上方，把 peek 的聊天內容視覺蓋暗，而非只蓋暗 sheet 以外的頁面。連帶結果：peek 狀態現在也會蓋住底部導覽（與 full 一致），這是「peek 全面模態化」的必然結果，使用者已在澄清時接受此取捨。
- `FindPartyScreen`（peek 時「邊看列表邊聊」的唯一依賴者）不再擁有雙欄同時互動能力；`/find` 的列表卡片在聊天 peek 開啟時將被 backdrop 遮蓋、需先關閉聊天才能點選。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能均無差異，方案 2 用最小改動（backdrop 渲染條件 + 一個 z-index 值）達成使用者明確要求的行為，且與 full 狀態共用同一套關閉機制，維護性最好。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（維持現狀）：與使用者明確澄清後的指示直接衝突，否決。
- 方案 3（依頁面條件切換模態）：造成共用元件的隱性頁面耦合，且不符合使用者「點外都要關閉」的一般性要求，否決。

## 影響 (Consequences)

- `FindPartyScreen` 的「peek 時雙欄同時瀏覽列表＋聊天」設計（ADR-0003 的核心理由）不再成立；使用者需先收合/關閉聊天 peek 才能繼續瀏覽隊伍列表。
- 所有消費 `MobileChatSheet` 的介面（`GlobalChatSwitcher`、`MobilePartyToolsSheet`、`FindPartyScreen`）的 peek 狀態行為一併改變（共用殼，無法只改單一消費者）。
- 未來若要恢復 peek 非模態（例如發現使用者實際上很依賴雙欄瀏覽），需在此 ADR 之上新增決策並標記 Supersedes，不得直接改動。

## Supersedes / Superseded by

Supersedes [ADR-0003](0003-mobile-chat-sheet-close-button.md) 的「`peek` 狀態維持非模態」決策（該 ADR 新增顯式關閉鈕的決策本身不受影響、維持有效）。
