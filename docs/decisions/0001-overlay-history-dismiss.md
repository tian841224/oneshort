# ADR-0001: 行動版浮層（聊天 sheet／導覽抽屜）的關閉與瀏覽器歷史整合方式

- 狀態: Accepted
- 日期: 2026-07-04
- 相關模組: frontend-rwd / chat / shell（`useMobileChatSheet`、`useMobileNavDrawer`）
- 相關文件: frontend repo `docs/frontend-logic.md`、.agent/rules/style.md §10

## 背景 (Context)

行動版有兩個滑出式浮層：聊天 bottom sheet（`useMobileChatSheet`）與左側導覽抽屜（`useMobileNavDrawer`）。兩者都希望**硬體／OS 返回鍵能先關閉浮層，而不是直接離開頁面**，因此在「開啟」時 `window.history.pushState` 推入一個 sentinel 記錄，並監聽 `popstate` 來關閉。

問題：兩個 hook 原本也用 `window.history.back()` 當作**使用者主動關閉**（點背景遮罩、按返回、往下拖曳）的手段。使用者回報：

- 聊天室按關閉／往下拖曳 → 跳轉到上一頁而非關閉聊天室。
- 左側選單點選單外範圍 → 跳到上一頁而非關閉選單。

根因：`history.back()` 只有在「我們推入的 sentinel 正好是堆疊頂端」時才等於「關閉浮層」；一旦 sentinel 不在頂端（例如點導覽項已先 `router.push` 推入新路由，或 Next.js App Router 對手動 `pushState` 的整合造成 sentinel 未如預期建立），`history.back()` 就會**真的導覽到上一頁**。近期多個 commit（`tag popstate cycles to prevent stale-close race`、`reconcile mobile sheet state across breakpoint`）已反覆修補這條 history 驅動的關閉路徑，顯示此模式本身脆弱。

## 考慮過的方案 (Options Considered)

1. **就地再 patch `history.back()` 路徑** — 繼續在既有 back() 流程上加條件。
   - 維護性：差。已多次修補仍出問題，屬於在錯誤抽象上疊例外。
   - 效能：無差異。
   - 安全性：無差異。

2. **完全移除 history 整合（開啟不 pushState，關閉只 setState）** — 最單純。
   - 維護性：好，但**改變既定 UX 規格**：硬體返回鍵不再先關浮層而是直接離開頁面，且可能牴觸既有 E2E。
   - 效能：無差異。
   - 安全性：無差異。

3. **關閉一律走「直接 setState」+ 安全對帳（採用）** — UI 關閉（背景、返回、拖曳、導覽項）一律直接 `setState('bubble')` / `setIsOpen(false)`；`pushState` 的 sentinel 帶 `cycleId`，`popstate` 只在 `cycleId` 相符時關閉（仍支援硬體返回）；關閉後**只有在確認自己的 sentinel 是當前 history 記錄時**才 `history.back()` 收回它，否則不動 history。
   - 維護性：好。單一關閉語意、兩個 hook 一致、脆弱點集中且有防呆。
   - 效能：無差異。
   - 安全性：好。UI 關閉在任何 history 狀態下都**不可能**誤導覽（guard 保證）。

## 決策 (Decision)

採方案 3。具體作法：

- **開啟**：`window.history.pushState({ os<Overlay>: true, cycleId }, '')`，`cycleId` 為每次開啟遞增的唯一值。
- **硬體返回**：`popstate` listener 僅在 `event.state.cycleId === 本週期 cycleId` 時關閉浮層（避免上一週期延遲送達的 popstate 誤關新開的浮層）。
- **UI 關閉**：直接 `setState('bubble')` / `setIsOpen(false)`；接著僅當 `hasPushedHistoryRef && window.history.state?.os<Overlay>` 為真（＝自己的 sentinel 在頂端）才 `window.history.back()` 收回，否則保留（同 URL 的殘留記錄無害）。
- **導覽項**：`Sidebar` 新增 `onNavigate`；點項目時 `router.push(href)` 後呼叫 `mobileNavDrawer.closeForNavigation()`——它**只 `setIsOpen(false)`、完全不碰 history**。這裡不能用會做 history 對帳的 `close()`：`router.push` 是**非同步**提交，close() 在同一 tick 讀 `window.history.state` 時 sentinel 仍在頂端，其 `history.back()` 會與 push 競態並把頁面彈回原頁（實測發現：點導覽項後抽屜關了卻停在原頁）。導覽本身會管理 history stack，殘留的同 URL sentinel 無害。

## 理由 (Rationale)

- **安全性**（最高優先）：使用者主動關閉在任何 history 狀態下都不會誤觸發頁面導覽，直接根治回報的「關閉／拖曳／點外面跳頁」。
- **維護性**：兩個浮層共用同一套關閉語意與 `cycleId` 防呆；脆弱的 history 操作被 guard 收斂到單一、可讀的判斷式。
- **效能**：與原方案相同，無額外成本。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（再 patch）：在已證明脆弱的抽象上疊條件，違反 core.md §3.1「禁止以最小修補繞過根因」。
- 方案 2（移除 history 整合）：會退化「返回鍵先關浮層」的既定 UX，且可能破壞既有 E2E，屬於未經確認的規格變更。

## 影響 (Consequences)

- `useMobileChatSheet`、`useMobileNavDrawer` 的 `close()` 語意由「history 驅動」改為「state 驅動 + 安全對帳」；拖曳關閉改呼叫 `close()`。
- `Sidebar` 多一個 `onNavigate` prop（桌機為 undefined，行為不變）。
- 未來若新增其他行動版浮層，應沿用本 ADR 的「pushState+cycleId 開啟／popstate 關閉／UI 關閉走 guard 對帳」模式，不要再用 `history.back()` 當關閉手段。
- 已知可接受的小瑕疵：透過導覽項關閉抽屜時會留下一筆同 URL 的殘留 history 記錄（下一次返回等於原地），不影響資料與正確導覽。

## Supersedes / Superseded by

無。
