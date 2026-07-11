# ADR-0030: 訪客建立的一般隊伍加入「我的隊伍」可見範圍（沿用單一快速隊伍 session 機制）

- 狀態: Accepted
- 日期: 2026-07-11
- 相關模組: frontend / party / auth
- 相關文件: frontend repo `docs/frontend-logic.md` §3.2、[ADR-0014](0014-guest-party-interop-frontend-ui.md)、[ADR-0015](0015-guest-standard-immediate-party-interop.md)

## 背景 (Context)

使用者回報：訪客身分建立的一般隊伍，目前完全不會出現在「我的隊伍」分頁。

**結構性根因**（非單純漏寫）：

1. 後端「我的隊伍」查詢（`is_participant=true`）以 `characters.actor_id` JOIN（`backend/internal/party/repository_party_read.go`），前端對未登入使用者也直接停用這個 query（`shouldEnablePartyListQuery` 在 `MY_PARTY`/`MY_APPLICATIONS` 分頁對 `!isAuthenticated` 一律回傳 `false`）。訪客建立/加入一般隊伍時走的是 `leader_guest_id`/`FilledByIsGuest`（token hash 衍生的識別），沒有 `characters` 資料列，結構上不可能被這個 SQL 撈到。
2. 前端目前對訪客的「我的隊伍」是完全另一套機制：`frontend/src/lib/quickPartySession.ts` 在 localStorage 存**單一**一筆 `{partyId, status: host|member|pending}`（key: `oneshort.quick_active_party`），`useQuickGuestPartySession.ts` 的 `isConfirmedQuickGuestSession()` 硬寫 `if (party.is_quick !== true) return false;`，只承認快速隊伍，一般隊伍被排除在外。
3. `GuestCreatePartyScreen.tsx` 的 `handleSubmit`（呼叫 `partyApi.createGuest` 成功後 `router.push`）沒有呼叫 `rememberQuickPartySession(...)`——即使拿掉 (2) 的限制，訪客建立一般隊伍後也還是沒有任何本地紀錄可用。

這是 [ADR-0015](0015-guest-standard-immediate-party-interop.md)（訪客一般隊伍互通）與 [ADR-0014](0014-guest-party-interop-frontend-ui.md)（訪客建隊 UI）之後遺留的後續缺口：「訪客可以建立一般隊伍」這個能力上線時，沒有同步擴充舊有（只為快速隊伍設計）的本地 session 追蹤機制。

## 考慮過的方案 (Options Considered)

1.（採用）**沿用既有單一 session 機制，移除 `is_quick` 硬性限制**——`isConfirmedQuickGuestSession()` 移除 `party.is_quick !== true` 的 early return，改為同時承認 quick 與一般隊伍（其餘 `viewer_capabilities.is_host`/`is_member`/`chat_reason` 判斷邏輯不變）；`GuestCreatePartyScreen.tsx` 的 `handleSubmit` 成功後補呼叫 `rememberQuickPartySession(party.id, "host")`，比照 `FindPartyScreen.tsx` 既有的 `handleQuickCreateComplete`/`joinQuickFromPreview` 模式。不需要任何後端變更。
   維護性：優——`useQuickGuestPartySession` 這個 hook 同時被 `Sidebar.tsx`／`MobileBottomNav.tsx`／`ApplicationsScreen.tsx`／`FindPartyScreen.tsx`（MY_PARTY tab）共用，拿掉限制後這些消費者一致地同步受益，不需要逐一調整。
   效能：無額外查詢——沿用既有單筆 localStorage 讀寫與既有的單一 party detail query。
   安全性：無新增信任邊界——沿用既有的訪客 token/cookie 驗證機制，`party.viewer_capabilities` 仍由後端依 token 判斷，前端只是讀取既有欄位、不做任何權限判斷。
2. **改造成多筆清單機制**——把 `quickPartySessionStorageKey` 從單一物件改為陣列，支援訪客同時追蹤多筆隊伍（含未來多個 host/member 情境）。
   維護性：中——牽動範圍大，`quickPartySession.ts` 的讀寫 API、`useQuickGuestPartySession` 的回傳型別、以及所有 4 個消費端（Sidebar/MobileBottomNav/ApplicationsScreen/FindPartyScreen）都需要改成處理陣列而非單一值，且訪客系統既有業務規則本來就是「同一瀏覽器同時只能有一個進行中活動」（`quickPartyBlockedMessage`），多筆清單機制解決的是一個目前不存在、也不打算開放的情境。
   效能：無明顯差異（localStorage 讀寫量微增）。
   安全性：無新增風險，但改動面遠大於方案 1，回歸風險更高。
3. **後端新增訪客專屬的隊伍列表端點**——例如依訪客 token/cookie 直接查詢其建立/加入過的隊伍清單，不依賴前端 localStorage。
   維護性：差——需要新的後端查詢邏輯（訪客沒有穩定的長期識別，token 是短期 cookie，如何界定「訪客的隊伍列表」本身就是開放問題）、新的 API 契約、前端對應的資料層改動，範圍遠超本次使用者回報的問題。
   效能：新增一條後端查詢路徑，需評估索引與查詢成本；若訪客識別改為跨裝置持久化，還要考慮額外的儲存與清理機制。
   安全性：需要重新設計訪客身分驗證的範圍（目前訪客 token 僅用於單一隊伍互動驗證，若擴大為「列出該訪客所有隊伍」，需要重新審視 token 的權限邊界，避免不同訪客 session 互相洩漏隊伍列表）。

## 決策 (Decision)

採用方案 1。具體作法：

- `frontend/src/hooks/useQuickGuestPartySession.ts`：`isConfirmedQuickGuestSession()` 移除 `if (party.is_quick !== true) return false;` 這行硬性限制，其餘 `session.status`（pending/host/member）對照 `viewer_capabilities` 的判斷邏輯完全不變。
- `frontend/src/app/parties/create/_components/GuestCreatePartyScreen.tsx`：`handleSubmit` 呼叫 `partyApi.createGuest(payload)` 成功、拿到 `party.id` 後，呼叫 `rememberQuickPartySession(party.id, "host")`，再 `router.push`。
- 不修改 `Sidebar.tsx`／`MobileBottomNav.tsx`／`ApplicationsScreen.tsx`／`FindPartyScreen.tsx`——這 4 個消費端都是透過 `useQuickGuestPartySession()` 的回傳值運作，拿掉 `is_quick` 限制後自動一致地涵蓋一般隊伍，經檢查這些檔案內沒有任何寫死「僅限快速隊伍」的假設會因此變得錯誤（`Sidebar.tsx` 的 `getSidebarPartyTypeBadge` 本來就已經依 `party.is_quick`/`party.type` 分別顯示「快速」/「BOSS」/「團練」/「組隊」徽章，對一般隊伍原本就有正確的 fallback 分支）。
- 不需要任何後端 API 變更。

## 理由 (Rationale)

- **安全性**：三個方案的安全影響差異明顯——方案 1 完全不新增信任邊界，方案 3 需要重新設計訪客 token 的權限範圍（有洩漏風險）；方案 1 在安全前提上最保守可靠。
- **維護性**：方案 1 改動面最小（2 個檔案、各 1-2 行邏輯），且與訪客系統既有的「同時只能一個進行中活動」業務規則語意一致，不需要引入新的資料結構或新的 API 契約；方案 2 的多筆清單機制解決的是一個目前不存在、也非本次需求範圍的情境，過度設計。
- **效能**：三者差異不大，但方案 1 完全複用既有查詢路徑，無額外後端負擔；方案 3 需要新增查詢路徑，成本最高。

依 core.md §3.1 優先順序（安全性 > 維護性 > 效能），方案 1 在三個前提上都是最佳解。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 2（多筆清單機制）**：否決，解決的問題超出目前訪客業務規則允許的範圍（訪客本來就只能有一個進行中活動），屬於不必要的架構複雜化；若未來訪客業務規則明確改變（允許同時多個活動），屆時再重新評估。
- **方案 3（後端新增訪客隊伍列表端點）**：否決，改動範圍與風險遠超使用者回報的問題本身，且訪客身分的權限邊界設計需要更審慎的獨立討論，不適合搭這次 bugfix 一併處理。

## 影響 (Consequences)

- frontend repo `docs/frontend-logic.md` §3.2 `MY_PARTY` tab 那一列的描述（原文：「未登入且本瀏覽器有 `quick_active_party` host/member session 時，只顯示該快速隊伍」）需要更新為不再限定快速隊伍。
- `Sidebar.tsx`／`MobileBottomNav.tsx`（導覽徽章）／`ApplicationsScreen.tsx`（我的申請）會一致地同步看到訪客建立的一般隊伍，這是沿用同一套機制的自然結果，非需要額外處理的新行為。
- **明確排除的範圍**：本次修正聚焦在訪客擔任隊長（host）**建立**的一般隊伍。訪客申請並被接受成為一般隊伍**成員**（非隊長）的情境，理論上沿用同一個 `rememberQuickPartySession(partyId, "member")` 機制也能受益，但目前的訪客申請流程（`PartyDetailScreen.tsx` 的 `submitGuestApply`）沒有明確的「已被接受」時機點可以掛上這個呼叫（需要額外判斷申請結果或訂閱 `party.application_accepted` 事件），複雜度不同，本次不展開，留作已知後續。
- 已知限制（非本次修正引入的新限制，訪客身分模型本身既有）：此追蹤機制僅限同一瀏覽器/裝置的 localStorage，換裝置或清除瀏覽器資料會遺失記錄；`quickPartySessionTtlMs`（24 小時）到期後自動失效。

## Supersedes / Superseded by

無（ADR-0014/ADR-0015 的後續補完，非推翻）。
