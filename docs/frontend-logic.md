# OneShort 前端邏輯文件 (Frontend Logic)

> 本文件描述前端各頁面的顯示邏輯、按鈕行為、通知規則與狀態判斷。

---

## 一、全域狀態管理

### 1.1 Store 架構

| Store | 說明 | 主要狀態 |
|-------|------|---------|
| `authStore` | 認證狀態 | `actor`, `currentCharacter`, `isAuthenticated`, `hasCheckedSession` |
| `wsStore` | WebSocket 連線與房間訂閱狀態 | `status`, `socket`, `listeners`, `roomSubscriptionCounts` |
| `chatUnreadStore` | 聊天未讀計數 | `unreadCounts: {partyId: number}` |
| `partyPasswordStore` | 已記憶的隊伍密碼 | `passwords: {partyId: string}` |
| `uiStore` | 全域 UI 狀態 | 模態框、面板開關 |
| Header `GuildGadget` local state | 公會即時未讀面板 | 當前頁面生命週期內的公告、聊天、自動配對與角色分配事件 |

### 1.2 TanStack Query 快取鍵

| QueryKey | 說明 | 觸發失效的事件 |
|----------|------|---------------|
| `['parties']` | 隊伍清單 | 隊伍建立、成員加入/離開/踢出、解散、狀態變更、申請接受 |
| `['party', partyId]` | 單一隊伍資訊 | 所有隊伍相關事件 |
| `['applications', partyId]` | 隊伍收到的申請 | 新申請、申請取消 |
| `['myApplications', 'all', actorId]` | 我的申請 | 申請被接受/拒絕、`character.updated` |
| `['myApplications', partyId, actorId]` | 我在指定隊伍的申請 | 隊伍詳情內的申請狀態、帳號切換 |
| `['myOngoingActivityParticipations', actorId]` | 我目前參與的 NOW 活動（不含已關閉快照） | 建立（僅建立者）、加入/離開/解散/被踢出 |
| `['notifications', actorId]` | 通知清單（依 actor 隔離快取） | WebSocket 重連、`character.updated` |
| `['notifications', 'unread-count', actorId]` | 未讀通知數 | 通知讀取/刪除、通知事件 |
| `['characters', actorId]` | 我的角色列表 | 角色建立/更新/刪除、`character.updated` |
| `['jobClasses']` | 職業清單 | 靜態資料 |
| `['filterOptions']` | 隊伍篩選選項 | 地圖 / BOSS / GROUP 目標資料更新 |
| `['admin', 'announcement']` / `['admin', 'announcements']` | 管理公告 | 管理員新增/刪除/覆寫公告 |
| `['admin', 'members', filter]` / `['admin', 'members', actorId]` | 管理員會員清單與會員明細 | 管理員重設 PIN、清除 Discord 綁定、啟用/停用帳號、修改/刪除角色 |
| `['system', 'announcement']` / `['system', 'announcements']` | 公開公告 | 管理員新增/刪除/覆寫公告 |
| `['admin', 'notice']` / `['system', 'notice']` | NoticeBar 跑馬燈 | 管理員更新/清除獨立 NoticeBar 內容 |
| `['stats', 'online']` | 在線人數 | `system.online_count` 事件 |
| `['guilds']` / `['guilds', 'current', actorId]` | 公會清單與目前公會 | 公會建立、加入、離開、解散、成員異動 |
| `['guilds', guildId, 'members']` | 公會成員 | 成員加入/離開、角色更新、職位異動 |
| `['guilds', guildId, 'announcements']` | 公會公告 | 公告新增、更新、刪除、置頂 |
| `['guilds', guildId, 'parties']` | 公會隊伍 | 公會隊伍建立、自動配對完成、隊伍成員事件 |
| `['guilds', guildId, 'calendar', actorId]` | 我的公會行事曆 | 自動配對完成、公會隊伍建立、角色/隊伍成員事件 |
| `['guilds', guildId, 'chat']` | 公會聊天室 | 送出訊息、聊天室歷史重抓 |
| `['partyGuide', partyId]` | 隊伍攻略與 widget 狀態 | 攻略載入、`party.guide_state.updated`、玩家操作攻略工具、小工具同步 session |

### 1.3 隊伍攻略小工具狀態

- `answer_lookup` 會直接顯示題目與答案，不再用點擊展開答案。
- 隊員點選 `answer_lookup` 題目時，widget state 以 `assignments: { questionId: memberId[] }` 記錄隊員抽到的題目；同一隊員切換題目時會從原題目移到新題目，避免一人同時標記多題。
- 題目列需顯示已標記隊員的攻略顏色 chip，顏色來源為 `party_member_colors` 保留 widget state，並透過 `party.guide_state.updated` 即時同步給同房隊員。
- `jump_box_sync` 依 `stage_count` 與 `boxes_per_stage` 產生跳箱格子，前台直接以獨立操作視窗顯示網格，避免隊伍攻略頁面需要上下捲動；隊員點格子時以 `assignments: { cellId: memberId[] }` 記錄，格子直接呈現對應隊員攻略顏色且不顯示角色名稱，同一隊員再點同格會取消標記。
- **成員身分鍵**：所有 widget state（`assignments`、`party_member_colors`、`widget_sessions`）的成員識別一律使用「隊伍成員角色 id」（`slot.filled_by`；隊長為 `party.leader_id`）。渲染時須過濾掉已不在隊伍的成員 id。
- **權威成員清單須含隊長（ADR-0004）**：隊長是隊伍成員但**未必佔用 filled slot**（後端 `deriveCurrentMembersFromSlots` 會另計隊長），因此前台供渲染過濾用的「現有成員清單」（`PartyWidgetContext.members`）必須是「filled slots ＋ 隊長 `leader_id` ＋ acting self」的去重合併（`mergeWidgetMembers`），否則隊長以 `leader_id` 寫入的認領/顏色會被過濾層靜默丟棄，造成「小工具點了沒反應」。
- **顏色預先分配（ADR-0004）**：`party_member_colors` 由 `useEnsureMemberColors` 在攻略隊伍載入時，對權威成員清單一次補齊（不再只在首次互動時懶分配），確保每位成員（含隊長）都有穩定顏色；操作 idempotent、409-rebase-safe，僅成員且非唯讀時寫入。「隊伍資訊」分頁頂部的 `MemberColorLegend` 以此顏色顯示「色票 ↔ 名稱／職業」對照。
- **背景寫入靜默失敗（ADR-0009）**：`useEnsureMemberColors`（房間進入時補色）與 `useMemberColors.ensureSelfColor`（伴隨其他小工具操作的順帶補色）都是非使用者直接操作的背景寫入，經 `useWidgetStateOp(widgetId, { silent: true })` 標記；即使 409 rebase 重試後仍衝突，也只同步最新狀態、不彈出「請再操作一次」錯誤提示（`entry` 依賴會在下次 store 更新時自動重試）。其餘使用者主動點擊觸發的 guide-state 寫入不受影響，雙重衝突仍會提示使用者重新操作。
- **`party_member_colors` wire 格式（ADR-0006）**：必須對齊後端 `validatePartyMemberColorsState` 的既定契約：`{ version: 1, assignments: { [memberId]: { color_key: GuideMemberColorKey, assigned_at: string } } }`；`color_key` 僅接受後端 `knownPartyMemberColorKeys` 的 10 個固定值（`guide-red/orange/yellow/green/cyan/blue/violet/pink/stone/lime`），前端 `GUIDE_MEMBER_COLOR_HEX`（`memberColors.ts`）負責把色鍵映射成實際渲染用 hex。不得自創欄位名或直接寫入任意 hex——後端 `DisallowUnknownFields()` 會拒絕不符合此格式的寫入，曾因此造成顏色永遠無法持久化（每次重新整理都讀回未分配狀態）。
- **保留 widget_id**：`party_member_colors`（隊員攻略顏色）與 `widget_sessions`（小工具同步 session）是保留 id，不對應攻略內任何 widget block；後端 `UpdateState` 只驗證 id 格式與隊伍成員資格，不要求 id 存在於攻略中。
- **全型別覆蓋（ADR-0002）**：前台 `WidgetWindowBody` 對應後端 `knownWidgetTypes` 與 admin 授權面板的**全部 20 種** widget，管理員設計的工具不再落到「即將推出」占位。實作以少數共用狀態模型驅動：
  - `assignments`（成員↔目標＋成員顏色）：`answer_lookup`（一人一題）、`jump_box_sync`／`shared_toggle_board`／`image_marker_board`（多目標亮燈）、`assignment_board`／`toy101_door_assign`、`rj_door_numbers`（一人一路線）。
  - `checklist`（項目↔成員，全隊共用勾選）：`shared_progress`（checklist 模式）、`rj_perfect_check`（依 phase 分組）、`gw_reward_handoff`（單一確認）、`toy101_class_check`（必要職業）。
  - `counter` 單值：`gw_ticket_pool`／`gw_phase1_quota`／`rj_guard_tally`；`MultiCounterState` 每項計數：`shared_progress`（counter 模式）。
  - `SequenceState` 有序記錄：`sequence_recorder`。純本地：`preset_solver`（`goddess_400` 對照表計算器與步驟清單）、`toy101_box_jump`（跳箱序列參考）。
- **`answer_lookup` 欄位契約**：題目文字欄位為 `question`（對齊後端 validator 與 admin 授權），前端 parser 另讀舊 `prompt` 欄位作為相容 fallback。

### 1.4 攻略／小工具視窗與同步

- **攻略顯示（重新設計）**：`GROUP` 隊伍的攻略與小工具是隊伍詳情頁的頂層分頁（`PartyDetailTabs`：隊伍資訊／待審申請／攻略／小工具）。快速隊伍不顯示這兩個分頁。
- **桌機浮動視窗（≥900px `BP.bottomNav`）**：攻略分頁提供「展開為浮動視窗」，小工具清單以「開啟」把工具開成獨立浮動視窗（`react-rnd`）。視窗可自由拖曳、縮放、最小化（收到左下角 dock）、釘選（於視窗間置頂，不鎖定位置）。所有視窗與 dock 共用 `--z-float-window`（62，介於 `--z-overlay` 與 `--z-dropdown` 之間），視窗堆疊順序由 `PartyWindowsHost` 內 DOM 順序決定，不使用逐視窗 inline z-index。視窗位置／尺寸依隊伍存於 localStorage（`os.windows.party.v1`，LRU 上限 20 隊）。攻略圖片點擊可開全螢幕 lightbox（`--z-modal`）。
- **手機（<900px）**：不使用浮動視窗；攻略維持頁內顯示，開啟小工具改用底部抽屜（`MobilePartyToolsSheet`，沿用聊天室 bubble→peek→full 抽屜），抽屜頂部以 chip 切換多個已開啟的工具。工具 bubble 疊在聊天 bubble 上方。
- **小工具同步 session**：任一隊員開啟小工具，即在保留 id `widget_sessions` 建立或加入該工具的 session（存於既有攻略 state blob，走既有 `party.guide_state.updated` 廣播，零後端改動）。房內其他成員收到「{開啟者} 正在使用「XX」，是否同步開啟？」動作 toast：
  - 去重鍵為 `session_id`（每次全新開啟才產生新 id；加入會 bump revision，故不可用 revision 當鍵）。
  - 僅在 session「由無變有」的轉變時提示；進頁時已存在的 session 不主動提示，改由小工具清單的「進行中 · N 人」badge 供事後手動加入。
  - 「略過」持久化該 `session_id` 到 `sessionStorage`，不再對同一 session 重複提示。
  - 開啟者本人與已是參與者者不提示。
- **session 生命週期**：接受即加入參與者並開啟視窗／抽屜；關閉視窗（或抽屜項目）即離開 session；最後一位參與者離開即結束 session；任何寫入都會剔除已離隊成員（gc-on-write）；CLOSED／唯讀隊伍不建立或加入 session。

---

## 二、認證流程（前端）

### 2.1 登入狀態判斷

```typescript
// middleware.ts
// 未登入訪問受保護路由 → 重導向至登入頁
// 已登入訪問登入頁 → 重導向至首頁

// AuthGuard 組件
// isAuthenticated=false → 顯示登入 Dialog（Discord / 快速登入）
// public route（目前 `/`）會直接自動開啟 `LoginDialog`，不可退回成只提供 Discord 的 gate
// auth bootstrap（`useAuth`）在同一次頁面生命週期內只能確認 session 一次；若已確認未登入，不可讓後續 consumer 再重複打 `/actors/me`
// 明確登出或清除本地 auth state 時，`hasCheckedSession` 需回到 false，讓後續 mount / bootstrap 可重新驗證 cookie 狀態
// 已登入 session 必須擁有 `actor`；`currentCharacter` 可為 null，角色行為再要求可用角色
// isAuthenticated=true → 顯示正常內容
```

### 2.2 登入按鈕行為

1. 未登入點擊 Navbar / 首頁登入入口
2. 開啟 `LoginDialog`
3. 使用者可選：
   - Discord 登入
   - 快速登入（Quick Login）
   - Dialog 版面以垂直堆疊呈現，先顯示 Discord，再顯示快速登入表單
   - 手機短螢幕需保留登入視窗本身的垂直捲動；快速登入首次建立角色展開欄位後，不可裁切底部輸入欄或提交按鈕

Discord 登入：
1. 點擊「使用 Discord 登入」
2. 後端返回 Discord OAuth2 URL
3. 導向 `https://discord.com/oauth2/authorize?...`
   - 若 OAuth 設定暫時無法取得、缺少必要欄位或 API 服務無法連線，登入視窗維持開啟並在 Discord 區塊顯示錯誤，同步顯示錯誤 toast，不可讓按鈕看起來無反應
4. Discord 回調 → `/auth/discord/callback?code=...`
5. 前端先驗證 `state`，再依 OAuth intent 決定是登入或綁定
6. 成功後寫入 `{ actor, current_character }` 到 `authStore`
7. 登入優先導回開啟登入視窗前的站內畫面（例如隊伍詳情），無記錄時導回首頁；綁定導回 `/me`；成功後先顯示 callback feedback modal（約 1200ms 後自動跳轉），使用者可點擊「立即前往」即時跳轉，不使用全域 toast
8. 若 Discord callback 因 session 失效回 `401`，callback 頁需直接顯示單一錯誤訊息「登入已過期，請重新登入後再試。」；不可再額外觸發全域登入過期 toast 或首頁跳轉
9. 若 Discord 綁定流程回 `409 discord_merge_required`，callback 頁需切到 merge confirmation state，而不是回 `/me`
10. merge confirmation state 需直接顯示：
    - target actor 角色摘要
    - source actor 角色摘要
    - 將搬移的資料摘要與 warnings
    - `確認合併並綁定 Discord` / `取消並返回個人頁`
11. 使用者確認後呼叫 `POST /api/v1/auth/discord/link/merge`
12. merge confirm 成功後寫入 `{ actor, current_character }` 到 `authStore`，顯示 callback feedback modal「Discord 帳號已完成合併並綁定」（約 1200ms 後自動跳轉），不使用全域 toast；導回 `/me`
13. 若 callback 或 confirm 回 `409 discord_merge_blocked`，callback 頁需顯示 blocker 清單與返回 `/me` 動作
14. 若 confirm 回 `400 invalid_merge_token`，callback 頁需停留在 merge state，顯示「這次合併確認已失效，請重新發起 Discord 綁定後再試。」
15. `409 discord_already_linked` 保留為 fallback handled error，仍顯示「這個 Discord 帳號已綁定其他帳號，請改用原帳號登入。」

Quick Login：
1. 先輸入 `character_code` 與 4-6 位數字 PIN
2. 呼叫 `GET /api/v1/auth/quick-login/check`
3. 若 API 服務無法連線，快速登入表單維持開啟並在提交按鈕上方顯示錯誤，同步顯示錯誤 toast，不可只在 console 顯示 `ERR_CONNECTION_REFUSED`
4. `available`：前端展開 `display_name`、`job_class_id`、`level` 欄位，再呼叫 `POST /api/v1/auth/quick-login`
   - `job_class_id=0` 是合法的「初心者」，前端驗證需以 `null/undefined` 判斷未選職業，不可用 truthy/falsy 判斷
5. `requires_pin`：直接以 `character_code + pin` 呼叫 `POST /api/v1/auth/quick-login`
6. `discord_only`：阻止 quick login，提示改用 Discord
7. 成功後寫入 `{ actor, current_character }`，優先導回開啟登入視窗前的站內畫面，無記錄時導回首頁

### 2.2A 登入後訪客隊伍認領（[ADR-0015](decisions/0015-guest-standard-immediate-party-interop.md)）

1. Quick Login 成功（`LoginEntryPanel.handleQuickLogin`）與 Discord **登入**成功（`auth/discord/callback/page.tsx`，僅限一般登入，**不含**帳號綁定 `intent=link`，因為綁定不會有訪客身分需要遷移）之後，皆會呼叫 `claimGuestPartiesAfterLogin(queryClient)`（`src/lib/auth/claimGuestParties.ts`）。
2. 該函式呼叫 `partyApi.claimGuest()`（`POST /api/v1/parties/guest-claim`）；沒有 `quick_guest_token` cookie 時後端回 204，前端直接略過。
3. 有認領結果時：
   - 清除本機 `quickPartySession`（`clearQuickPartySession()`）與訪客暱稱（`persistQuickGuestDisplayName('')`）。
   - `claimed.length > 0` → 顯示成功 toast「已將 N 個訪客隊伍轉移到你的帳號。」
   - `skipped.length > 0` → 顯示提示 toast，請使用者至隊伍頁面確認（活動衝突、無目前角色等原因不逐一列出）。
   - 呼叫 `queryClient.invalidateQueries()`（無 filter，全量失效）讓所有隊伍相關查詢重新抓取最新資料。
4. 此呼叫是 best-effort：任何失敗（含網路錯誤）都只在 console 留下警告，**不會**中斷已完成的登入流程或顯示錯誤 toast，避免讓使用者以為登入失敗。

### 2.3 登出

1. 點擊「登出」按鈕
2. 前端同步清空 `authStore.actor`、`currentCharacter`、`isAuthenticated` 與帳號相關 modal / wizard 狀態；主動登出完成後導回首頁 `/`，不導向 `/login`
3. 背景呼叫 `POST /api/v1/auth/logout`；即使 API 失敗，也維持本地登出狀態，避免舊帳號資訊繼續顯示
4. 登出期間不得重新觸發 `/actors/me` bootstrap；任何登出前已送出的 `/actors/me` 回應都必須以 session/version guard 忽略，不可覆寫登出後狀態
5. auth 從登入變未登入、或 actor id 切換時，需取消並清空 React Query cache，清除 party password cache、post-login redirect 等帳號相關 session storage
6. 未登入仍可瀏覽公開隊伍與公開公會列表/詳情，也可建立快速隊伍；公開隊伍詳情 `/parties/[id]` 不可因未登入直接顯示「找不到此隊伍」，只有 detail API 明確回 404 才顯示不存在；除匿名 quick guest session 例外外，個人頁、我的申請、組隊紀錄、我的隊伍、建立一般隊伍、申請加入、一般隊伍/公會聊天室發言、角色切換、公會工具、BOSS 配對與設定需隱藏或顯示「登入後開始使用」類型提示；未登入一律不顯示「我的公會 / 我的工會」
7. 登出時需重置聊天室草稿、角色身分選擇、picker/modal、live message 的「我」標示與會員工具本地狀態；保留非帳號個資的純 UI 偏好，例如靜音、側欄寬度與聊天面板寬度
8. auth bootstrap 判定為未登入時，使用清除本地 auth state 的路徑；使用者主動登出時，使用明確的 user-logout 清除路徑，避免 stale cookie 在 API 尚未完成前把舊帳號塞回 store
9. 未登入瀏覽尋找隊伍時，大廳聊天仍啟用 `lobby:chat` 訂閱、載入 lobby chat history API（最近 100 筆、最久 24 小時），且發言者名稱一律顯示「遊客」；登出後需清掉帳號特定的聊天室草稿/角色選擇/「我」標示，但保留公開大廳聊天可用。大廳聊天送出後前端需顯示倒數並停用送出按鈕：未登入 10 秒、登入後 5 秒；若後端回 `429` 與 `Retry-After`，以前端倒數顯示剩餘秒數並保留草稿。當 lobby chat WebSocket 未連線時，聊天室指示燈顯示紅色，訊息輸入與送出按鈕必須停用，避免使用者以為已送出但實際沒有連線。

### 2.4 `/me` 帳號設定頁

`/me` 顯示：
- 角色管理：顯示 actor 的完整角色清單，可新增角色、編輯角色資料、刪除角色，並啟用或停用角色
- 角色建立與更新需接受 `job_class=0` 的「初心者」；只有 `null/undefined` 代表未選職業
- 登入方式狀態卡：Quick Login / Discord 依 `actor.linked_providers` 顯示
- 已啟用或已綁定的登入方式使用綠色狀態卡，未啟用使用灰色狀態卡
- Discord 未綁定時，整張 Discord 狀態卡就是綁定入口，點擊後發起 Discord 綁定流程
- Discord 已綁定時，只顯示綁定狀態，不提供解除綁定入口
- Discord 綁定若撞到 `discord_merge_required`，由 callback page 完成整個合併確認流程；`/me` 不額外開 modal
- Quick Login PIN 更新表單
- PIN 更新若 `current_pin` 錯誤，應留在 `/me` 顯示 API 錯誤訊息；不可觸發全域「登入已過期」toast 或跳回首頁

---

## 三、首頁 (Home Page `/`)

### 3.1 版面結構

```
┌─────────────────────────────────────────────────────┐
│  Navbar (頂部導覽列)                                  │
│  - Logo | 頁面切換 | 通知鈴鐺 | 線上人數 | 使用者頭像   │
├─────────────────────────────────────────────────────┤
│  [搜尋篩選列] Filter Bar                              │
│  - 類型/職業/等級/關鍵字/密碼/審核 篩選                │
├──────────────────────┬──────────────────────────────┤
│  [隊伍清單]            │  [隊伍資訊]                   │
│  PartyList            │  PartyDetailView              │
│  - PartyCard × N      │  - 依選取的隊伍 ID 顯示        │
│                       │  - 根據身份顯示不同操作         │
└──────────────────────┴──────────────────────────────┘
```

```
PartyHome 載入策略:
  - PartyHome 僅保留 tab / URL / modal 協調邏輯
  - 主工作區改由 lazy-loaded PartyHomeWorkspace 承接
  - Workspace 外層使用 Suspense fallback 顯示骨架畫面
  - Suspense 覆蓋隊伍詳情、建立隊伍、我的申請與列表工作區
```

### 3.1A 系統公告列與公告視窗

```
NoticeBar / AnnouncementModal:
  - 當 `useSystemNotice` 取得最新一則 notice 時，Navbar 下方顯示 NoticeBar
  - NoticeBar 只顯示 `/api/v1/notice` 的獨立純文字 `content`，不可 fallback 顯示 announcement Markdown `content`
  - notice content 留空時 Navbar 不顯示 NoticeBar；Footer 與自動彈窗仍可顯示最新公告 modal
  - Footer「公告」與自動彈窗共用 `openModal('announcement')` 與同一個公告視窗；NoticeBar 不開啟公告 modal
  - 公告視窗使用 `/api/v1/announcement` 的 DB 最新 active 公告，不可讀取 `public/docs/announcement.md`
  - `useSystemAnnouncement` 需定期刷新，讓長時間停留的使用者能看到新公告並重新評估 seen token；`useSystemNotice` 需獨立刷新跑馬燈內容
  - 公告視窗使用 shared `Modal` shell，內容必須以 Markdown + GFM 渲染，不可直接輸出原始字串
  - 後台送出公告時只能用 trim 判斷 content 是否為空，寫入 API/DB 的 content 必須保留原始空白與縮排
  - 需正確支援表格、清單、標題、粗體、引用與程式碼區塊
  - 表格內容需保留欄列結構，必要時允許橫向捲動，不可把 pipe 語法串成單一段落
  - 自動彈窗 seen state 使用公告 `id + updated_at` token，不使用前端硬編碼版本字串
```

### 3.2 Tab 切換邏輯

URL 參數 `?tab=` 控制顯示模式：

| Tab 值 | 顯示內容 |
|--------|---------|
| `FIND_QUICK` (預設) | 快速組隊列表與建立隊伍卡片；未登入訪客可使用快速建立 |
| `FIND_PARTY` | 公開組隊活動清單 |
| `FIND_BOSS` | BOSS 討伐清單 |
| `FIND_TRAINING` | 練功地圖清單 |
| `MY_PARTY` | 我的隊伍；未登入且本瀏覽器有 `quick_active_party` host/member session 時，只顯示該快速隊伍，pending 不顯示 |
| `MY_APPLICATIONS` | 我的申請；未登入且本瀏覽器有 pending quick session 時，顯示一筆 synthetic 待審申請 |
| `CREATE_PARTY` | 建立一般隊伍；目前 UI 仍需要登入（見下方 ADR-0015 現況說明） |

一般隊伍與快速隊伍建立流程的頻道欄位皆為必填，前端輸入層只允許 1~4 位數字，送出前需符合 `1~9999`，不得用 `CH. 01` 類顯示字串轉換成 API payload。

> **ADR-0015 現況**：後端已支援訪客建立/申請一般即時公開隊伍（`partyApi.createGuest`/`applyAsGuest` 等，見 [api-reference.md](../api-reference.md) 訪客一般即時隊伍互通章節），但**此頁與下方 §3.5/§3.6 描述的「需登入」UI 目前尚未改動**——訪客建立/申請一般隊伍的實際頁面（`CREATE_PARTY` tab 解鎖、`QuickGuestIdentityPrompt` 擴充職業/等級欄位、PartyCard 訪客渲染）為後續 UI 專案的範圍，本節其餘「需登入」相關描述在該專案完成前仍反映現況。已落地的部分只有登入後自動認領（§2.2A）與資料/API 層。

### 3.3 PartyCard 顯示邏輯

```
PartyCard 顯示規則:
  - 隊伍名稱 (title 或 target_name)
  - 尋找隊伍卡片會將「目標」顯示在左側類型 Logo 的正下方，並將「時間」顯示在目標下方
  - `需審核 / 需密碼` 會顯示在卡片右側狀態欄
  - 卡片上的目標顯示會移除 `兼具` 字樣
  - 若卡片標題已直接使用 target_name，則不重複再顯示一次目標
  - `我的隊伍` 卡片右上角會在成員數 badge 上方顯示房間狀態 badge（招募中 / 隱藏 / 關閉）；其中 `招募中` 僅顯示文字，`隱藏 / 關閉` 保留 icon
  - 卡片不再顯示類型標籤 (BOSS/TRAINING/GROUP) chip；類型資訊改由左側類型 Logo 傳達
  - 當前/最大成員數 (current_members/max_members)
  - 職業席位預覽（前 N 個）
  - 密碼鎖圖示（join_requires_password=true）
  - 審核圖示（join_requires_approval=true）
  - `allow_quick_login_players=false` 顯示「限綁 Discord」限制 badge
  - 狀態標籤（公開清單僅會出現 RECRUITING/ACTIVE）
  - 房間備註必須以 `whitespace-pre-wrap` 顯示，保留使用者輸入的空行與連續空格

快速申請按鈕 (QuickApply):
  - 顯示條件：
    - isAuthenticated AND 有可用角色 AND 非隊伍成員
  - 未綁 Discord、只能 quick login 的玩家遇到 `allow_quick_login_players=false` 時顯示 disabled / blocked 狀態，不送出 API
  - 點擊行為：見 3.4 快速申請流程
```

**可見性規則**:
- 公開清單不再以前端 `updated_at` 是否超過 1 小時做過濾
- 公開清單只顯示後端實際狀態為 `RECRUITING` / `ACTIVE` 的隊伍
- `HIDDEN` / `CLOSED` 不會出現在公開清單
- `我的隊伍` 會顯示目前仍進行中的 `RECRUITING` / `ACTIVE`、`HIDDEN`，以及最近 24 小時內的 `CLOSED`
- `我的隊伍` 的狀態篩選提供「全部 / 招募中 / 隱藏 / 關閉」，頁面預設套用「全部」；其中「招募中」同時包含 `RECRUITING` 與 `ACTIVE`
- `我的隊伍` 在未額外指定排序時，預設依房間狀態排序為「招募中 → 隱藏 → 關閉」
- `我的隊伍` 的列表卡片若為 `CLOSED`，不顯示成員的「離開隊伍」按鈕
- `我的隊伍` 的列表卡片若為 `CLOSED`，整張卡片使用反灰樣式，方便快速辨識唯讀狀態
- 加入限制（Join Block）只依據 `time_scope=NOW` 的活動資料；最近 24 小時內保留的 `CLOSED` 唯讀快照不可再鎖住角色
- `FIND_PARTY` 的「目標」篩選會使用 `GROUP` 預設任務選項（`GET /raid-boss-options?type=GROUP`），同步顯示例如 `活動任務`、`職業任務`

### 3.4 快速申請流程 (Quick Apply)

```
handleQuickApply(partyId, slotId, charId?, requiresPassword?):

1. 檢查 partyPasswordStore 是否有已記憶密碼
   - 有 → 直接帶密碼申請
2. 若 requiresPassword=true → 彈出密碼輸入框
3. 否則先不帶密碼嘗試
4. 若 403 → 需要密碼 → 彈出密碼輸入框
5. 若 409 + "已在進行中活動" → 顯示錯誤提示
6. 若 409 + "角色已在此隊伍" → 靜默刷新（競態條件）
7. 成功 → 記憶密碼至 partyPasswordStore
8. 送出時必須帶 `character_id`；Quick Login actor 使用目前角色或使用者選擇的角色
```

### 3.4A 快速組隊流程

```
QuickPartyDetailView:
  - `FIND_QUICK` 列表/房間是快速隊伍專用情境，不載入一般隊伍篩選、職業、角色清單或進行中活動查詢；只有切到一般隊伍或指定一般隊伍詳情時才啟用這些 query。
  - 快速隊伍詳情與一般隊伍共用同一套 `PartyDetailView` 版面；畫面差異只由 viewer role / capability 決定，不另外渲染獨立的快速隊伍加入面板。
  - 房間資訊區顯示「分享房間連結」按鈕，點擊後複製 `/parties/{partyId}` 深連結到剪貼簿。
  - 房間備註提交與顯示都保留使用者輸入的空行與連續空格；空字串才視為未填寫。
  - 進入聊天室 (`quick-enter`) 與申請/加入隊伍 (`quick-join`) 是兩個獨立動作。
  - 使用者點選房間後，不需要先進入聊天室才能點選空位申請或加入隊伍。
  - `quick-enter` 只建立 quick guest identity / visitor 狀態，不解鎖聊天室內容；快速隊伍聊天室只在 `viewer_capabilities.can_read_chat=true` 時掛載，且只有隊長與隊員可以讀取或發言。
  - 快速隊伍列表預覽不顯示空位條件、職業限制、等級限制或攻略；只顯示人數燈號，例如 `OOO●●` 與 `2/5 人`。
  - 快速隊伍列表預覽的 primary action 代表「加入」而不是「進房」：OPEN / PASSWORD 房送出 `quick-join`，成功後導向 `/parties/{partyId}`；APPROVAL 房送出 `quick-join` 建立 pending application，不自動導向成員視角。
  - PASSWORD 快速房若從列表加入，需先開密碼視窗，密碼正確才送出 `quick-join` 並導向隊伍詳情；密碼錯誤時清掉該房密碼快取。
  - 可加入的空位控制留在成員格子內；點選快速隊伍的開啟空位直接送出 `quick-join`。
  - 快速隊伍 slot 只代表開啟/關閉與已佔用狀態，不代表隊員條件；前端不得顯示或編輯職業、等級、是否必填、空位備註等限制。
  - 未登入且尚未建立 quick guest identity 時，若 `viewer_capabilities.chat_reason=NICKNAME_REQUIRED` 且快速隊伍仍有開啟空位，該空位仍應顯示為可加入；點擊後先補角色名稱，再用原本空位送出 `quick-join`。
  - 若快速隊伍角色名稱尚未設定，當前房間畫面彈出角色名稱輸入視窗，儲存後繼續原本動作，不要求返回列表。
  - 密碼房的流程為：角色名稱缺失時先補角色名稱，再顯示密碼視窗，最後送出 `quick-join`。
  - 未登入建立的快速房間，建立者憑 quick guest cookie 與 `viewer_capabilities.is_host` 可在房間詳情編輯快速隊伍設定與解散房間。
  - 非建立者或未帶有效 host capability 的訪客不得看到編輯/解散等房主設定元件。
  - 快速隊伍詳情不顯示攻略 tabs、不顯示準備出發區塊、不顯示 hero 的招募中 icon；頻道改在 hero 狀態位置以醒目的 `CH {channel}` badge 顯示。
```

### 3.5 隊伍資訊面板 (PartyDetailView)

```
通用操作:
  - 隊伍資訊卡顯示「分享房間連結」按鈕，點擊後複製 `/parties/{partyId}` 深連結到剪貼簿。
  - 隊伍備註提交與顯示都保留使用者輸入的空行與連續空格；空字串才視為未填寫。

身份判斷:
  - `PartyDetailView`、`PartyEditView`、`usePartyPasswordGuard` 共用 `usePartyMembership` / selector helper，避免各畫面各自判斷
  isLeader:
    - activeCharacters 中有角色 `id === party.leader_id`
  isParticipant:
    - party.slots 中有 `filled_by` 命中自己的 active character
  hasPendingApp = myApplications.some(a => a.status='PENDING')

顯示內容依身份:

[訪客/未登入]:
  - 查看基本資訊（title, target_name, slots overview）
  - 一般隊伍不顯示獨立「加入此隊伍」欄位；空缺列直接顯示「可以加入 / 不能加入 / 登入後申請」狀態
  - 快速隊伍同樣不顯示獨立「加入快速隊伍」欄位；訪客從「隊伍資訊」的開啟空位直接加入或申請，列內只顯示 `+`/`X` 與「開啟」/「關閉」
  - 未登入點選可申請空缺時觸發登入流程，登入後返回原隊伍
  - 若一般隊伍 `allow_quick_login_players=true`，未登入使用者可從「任意職業 / 不限職業」空缺直接開始；前端記住原本點選的空缺，快速登入或登入完成返回後以目前角色和該 slot 送出申請
  - 密碼隊伍 → 顯示密碼輸入框

[已登入/非成員]:
  - 查看詳情（無 channel）
  - 可申請空缺直接在隊伍資訊卡內以綠色狀態顯示；點選空缺後才開啟選擇加入角色視窗
  - 可申請空缺需呈現明確可點擊 affordance：左側使用 `+`，整列使用成功色 CTA 樣式，右側顯示「加入」動作膠囊與箭頭
  - 空缺列只保留主行與狀態，不顯示第二行職業名稱 / 登入後說明 / 申請提示
  - 不符合目前角色條件的空缺以危險色與 X icon 顯示「不能加入」
  - 「不限職業」空缺對所有職業角色都視為符合，仍需遵守等級上下限
  - 若有 PENDING 申請 → 顯示「取消申請」
  - 未綁 Discord、只能 quick login 的玩家 + `allow_quick_login_players=false` → 顯示不可申請提示
  - Quick Login actor 也使用角色 API 契約；若只有目前角色，前端可直接帶該角色申請

[成員 (isParticipant)]:
  - 查看 channel（遊戲頻道）
  - 快速隊伍 channel 在 hero 狀態位置顯示為 `CH {channel}` badge，不再併列招募中 icon
  - 非關閉隊伍的桌面版頂部列右側只顯示更新時間，不另外顯示招募中 / 滿員 / 隱藏狀態 badge
  - 隊伍資訊卡右上角的頻道 chip 兼作狀態提示：`RECRUITING / ACTIVE`（含滿員）使用綠色，`HIDDEN` 使用灰色
  - `BOSS` 隊伍資訊卡內需顯示開打狀態：`scheduled_at` 為空時顯示「現在開打」，有值時顯示具體開打時間
  - `BOSS` 隊伍的左側資訊需顯示 `目標` 與 `開打時間` 兩個同樣樣式的資訊 chip，且開打時間位於目標下方；其他類型維持「更新時間」
  - 手機版隊伍資訊卡中，右側僅顯示頻道並固定在右上方，顏色規則與桌面版一致
  - 隊伍資訊卡的隊伍類型與頻道需和上邊界保留較大的間距
  - 聊天室
    - 先顯示即時 slot 角色資料
    - 若角色已離隊、改名或不在目前 slots 中，改用訊息內的 `sender` snapshot 顯示名稱與職業
    - 快速隊伍 guest 的 sender/member 若沒有職業與等級 snapshot，職業統一顯示「遊客」，icon 也使用 guest 樣式，不得 fallback 成任一職業
    - 收到 `character.updated` 的隊伍房間事件時，聊天室會重新抓歷史訊息，確保舊訊息也同步成最新角色資料
    - 歷史訊息與連線期間已收到的 live 訊息合併時，需以 `timestamp + sender.id + content` 去重，避免初載 history 回來後重複顯示同一則訊息
  - 確認仍在線按鈕 (ConfirmLiveness)
  - 離開隊伍按鈕
  - 所有登入 actor 都會建立 WebSocket 連線；個人房間為 `actor:{actorId}`

[隊長 (isLeader)]:
  - 所有成員功能
  - 編輯頁頂部右側同樣顯示房間狀態（招募中 / 滿員 / 隱藏 / 關閉）與更新時間；狀態標籤在上、更新時間在下，且狀態那一行需和「隊伍資訊」標題維持同一水平
  - 編輯頁頂部操作區顯示「分享房間連結」按鈕，點擊後複製 `/parties/{partyId}` 深連結到剪貼簿
  - 編輯頁標題區需預留足夠底部空間，讓下方表單與聊天室整體往下，不可與右上操作列重疊
  - 踢出成員按鈕（僅顯示在非隊長本人槽位）
  - 隊長在編輯頁踢出隊員時，成員槽位需先做本地即時清空，再由後續 refetch 對齊正式資料
  - 若隊長正在編輯未儲存內容，同隊最新資料回來時只同步成員佔位資訊（加入 / 退出 / 踢出），不可覆蓋本地草稿欄位
  - 編輯隊伍按鈕
  - `RECRUITING/ACTIVE` 時顯示隱藏隊伍
  - 解散隊伍按鈕
  - 審核申請列表
  - 公告管理
  - Quick Login actor 可使用同一套通知鈴鐺；建立/編輯隊伍仍需提交自己的 `leader_character_id`

[已關閉隊伍 (status=CLOSED)]:
  - 顯示唯讀資訊
  - 手機版頂部列維持「返回」在左、「隊伍資訊」置中、「已關閉」標籤在右
  - 桌面版頂部列在「隊伍資訊」右側以純文字顯示「關閉」；隊伍資訊卡頂部的類型列右側只顯示更新時間，且更新時間位於最右側
  - 隊伍資訊卡以唯讀版型呈現，桌面版不重複顯示狀態與更新時間
  - 成員數改以下方「隊伍成員」區塊的計數為主，不另外顯示 badge
  - 不另外顯示「此隊伍已關閉…」整行提示
  - 不顯示重新顯示、解散、儲存、踢人、審核申請、加入/申請、取消申請、離開、聊天室等操作
```

### 3.6 申請流程 (Apply)

```
handleApply(slotId, charId, joinPassword?):

0. 使用者必須先點選隊伍資訊卡中的可申請空缺；一般隊伍不提供獨立全隊伍申請 CTA
1. 若已有 PENDING 申請且為同一角色 → 先取消舊申請
2. 呼叫 apply API
3. 若有密碼 → 記憶至 partyPasswordStore
4. 錯誤處理：
   - 409 + "ongoing activity" → "角色已在其他活動，請先退出"
   - 409 + "already in party" → 靜默刷新（競態條件）
   - 409 其他 → 重試一次（重新取得最新申請清單後再試）
   - 403 → "密碼錯誤" → 清除已記憶密碼
   - 其他錯誤 → 顯示後端回傳訊息
```

---

## 四、建立隊伍頁面 (`/parties/create`)

### 4.1 表單欄位邏輯

```
隊伍類型選擇:
  - 建立頁初始不預選類型、標題、目標、頻道、密碼或加入規則；使用者必須明確選擇後才送出
  - BOSS → 顯示 Boss 選擇器 + 時間設定，提交 `target_option_id`
  - TRAINING → 顯示地圖選擇器，提交 `target_map_id`
  - GROUP → 顯示任務選擇器（來自 `raid_boss_options.party_type=GROUP`），提交 `target_option_id`
  - 目標選單不自動帶入第一筆 option；切換隊伍類型時清空既有目標，避免錯送其他類型目標

時間設定 (BOSS 類型):
  - scheduleType='now' → 使用當前時間計算，`scheduled_at=null`
    recruit_until = now + 1h
    active_until = now + 24h
  - scheduleType='scheduled' → 使用者必須選擇時間，提交 `scheduled_at`
    recruit_until = scheduledAt + 1h
    active_until = scheduledAt + 24h

席位管理:
  - 初始顯示 6 個空欄位，不預設加入目前角色或主要角色
  - 使用者需自行從「我的角色」點選要加入隊伍的角色
  - 第一個被選入隊伍的角色作為 `leader_character_id` 與隊長；可改選，不強迫使用帳號主要角色
  - 每個席位可設定 job_class, min_level, max_level, note
  - is_required 標記必填性
  - 角色席位以角色 ID 送出 `filled_by`
  - 未設定的空欄位仍以 `is_filled=false` 送出，讓建立後房間詳情保留可加入空位

加入設定:
  - join_requires_password=true → 顯示密碼輸入欄
  - join_requires_approval=true → 隊長需手動審核
  - `allow_quick_login_players` toggle 控制是否允許快速登入玩家申請
```

### 4.2 提交按鈕邏輯

```
建立按鈕啟用條件:
  - 目標 / 任務 / 地圖已選擇（title 為選填）
  - 至少一個自己的角色已選擇（第一個選入角色作為 `leader_character_id`）
  - 必填欄位通過 Zod validation

提交流程:
  1. 前端 Zod 驗證
  2. 依隊伍類型解析參照 ID：
     - BOSS / GROUP → 對應 `target_option_id`
     - TRAINING → 對應 `target_map_id`
  3. POST /api/v1/parties
     - 帶 `leader_character_id`
     - `max_members` 必須等於送出的 slots 數；建立頁維持 6 格容量
     - 一律同步 `allow_quick_login_players`
  4. 成功 → 使用 `{ party, slots }` response 正規化後導向 `/parties/:id`
  5. 失敗 → 顯示錯誤訊息
```

---

## 五、編輯隊伍 (PartyEditView)

### 5.1 儲存邏輯

```
handleSaveParty():
  1. 比較 draft 與 originalDraft 的差異（dirty check）
  2. 若無變更 → 直接觸發 onSaveSuccess()（不呼叫 API）
  3. 若 type / target 有變更，先重新解析參照 ID：
     - BOSS / GROUP → `target_option_id`
     - TRAINING → `target_map_id`
  4. 以目前 query cache 內的 `selectedParty.revision` 建立完整 `PUT /parties/:id` payload
  5. 一次送出完整 slots snapshot：
     - 保留既有 slot 的 `id`
     - 既有 slot 需附帶 `base`（開始編輯時看到的 slot 狀態）
     - 新增空缺不帶 `id`
     - `_deleted=true` 的既有 slot 要改送到 `deleted_slots[]`，不能只從 `slots[]` 省略
     - 重新整理 `slot_order`
  6. 成功後直接用 response 覆蓋 `['party', partyId]` cache，並重建 draft/originalDraft
  7. 若後端回 `409 revision conflict` → 先重新抓最新 party detail
  8. 若刷新後比對發現只有 `revision` 不同、editable snapshot 與 originalDraft 其實一致 → 自動用新版 `revision` 重送一次
  9. 若後端回 `409 PARTY_SLOT_CONFLICT`：
     - 先用 response 內的最新 `party` 重建 draft
     - 顯示衝突格摘要（例如第 2 格在編輯時已有新成員加入）
     - 要求隊長重新確認後再儲存，不能自動重送
  10. 若刷新後連 editable snapshot 都已變更 → 提示使用者確認最新資料後再重新儲存

Dirty check 邏輯:
  titleDirty | targetDirty | typeDirty | channelDirty |
  noteDirty | schedDirty | slotsDirty |
  joinPasswordDirty | joinRequiresPasswordDirty | joinRequiresApprovalDirty
  （同時比較 `target_option_id` / `target_map_id`，避免選項文字改名造成草稿誤判）

UI 規則:
  - 儲存按鈕只顯示在 PartyEditMetaForm 的「加入規則」區塊下方
  - 踢人、審核申請、加入角色等即時操作不依賴此按鈕
```

### 5.2 隱藏/顯示隊伍

```
handleTogglePartyVisibility(shouldClose):
  - shouldClose=true → 確認對話框 "確定要隱藏隊伍嗎？"
    → PATCH /parties/:id { is_temporarily_closed: true }
    → 狀態切換為 HIDDEN，公開清單不可見，但仍保留在我的隊伍
  - shouldClose=false → 確認對話框 "確定要重新顯示隊伍嗎？"
    → PATCH /parties/:id { is_temporarily_closed: false }
    → HIDDEN 狀態恢復為 RECRUITING/ACTIVE
```

### 5.3 已關閉隊伍唯讀規則

```
status === 'CLOSED':
  - PartyEditMetaForm disabled
  - 不顯示儲存按鈕
  - 不顯示踢人、增刪席位、審核申請按鈕
  - 空席位以靜態資訊呈現
  - 若目前仍停留在該隊伍頁，聊天室元件必須卸載，並立即解除 `party:{id}` 房間訂閱
  - 編輯頁手機版頂部列維持「返回」在左、「隊伍資訊」置中、「已關閉」標籤在右
```

### 5.4 Draft 同步規則

```
usePartyHomeDraft(selectedParty):
  - 切換到不同隊伍時，一律以最新 selectedParty 重建 draft
  - draft / originalDraft 會保留 `target_option_id` / `target_map_id`，供 dirty check 與回填使用
  - 同一隊伍收到新的伺服器資料且表單仍為 clean 時，draft 會同步更新
  - 同一隊伍收到新的伺服器資料但表單已經 dirty 時，保留本地草稿，不覆蓋使用者輸入
  - 當本地草稿回到 clean 狀態時，會補套用先前延後的最新伺服器版本
- 離開隊伍資訊/編輯畫面後，當次 draft session 視為結束；之後重新開啟同一隊伍時，必須用最新 server 資料完整重建，不能沿用上一輪尚未帶回 `id` 的本地新 slot 草稿
- 同一編輯 session 內按下儲存後，前端必須以 `PUT /parties/:id` 的 response 立即重建 draft；不能再依賴多筆 slot API + 最後一次 detail refresh 才拿到正式 `slot.id`
- `usePartyHomeDraft` 內部追蹤「目前已同步到哪個 party snapshot」的 signature，必須和 `selectedParty` 比對使用同一種序列化格式，且要包含 `revision`；否則剛儲存成功的 snapshot 可能被舊 query props 誤覆蓋
- 本地儲存期間若收到同一隊伍的 `party.updated` WebSocket 事件，需以整段 save session 抑制 detail refetch；避免 editor 自己的 save 流程和 WebSocket 回推互相放大
- 若 `PUT /parties/:id` 回 `PARTY_REVISION_CONFLICT`，前端必須先刷新 detail；若只有 `revision` 漂移則可自動重送一次，否則再要求使用者以最新版本重做編輯
- 若 `PUT /parties/:id` 回 `PARTY_SLOT_CONFLICT`，前端必須直接採用 response 內的最新 `party` 取代本地 draft，並要求使用者重新確認衝突格；這類情況不可沿用舊 draft 直接重送
- dirty draft 期間若只是收到「未編輯 slot 的佔位變動」，可延後或局部同步；但若後端已明確判定為硬衝突（例如 `member_joined_while_editing_slot`、`member_changed_while_editing_slot`、`member_joined_while_deleting_slot`），就必須回到最新 server snapshot 重新編輯
```

```
PartyEditView 自己角色預先指派 UI:
  - 將「我的角色」指派到未填席位時，席位列只保留右側單一移除 X
  - 「我的角色」區塊的角色 chip 仍可用來取消該角色指派
  - 不再在同一個席位列內額外渲染第二個「取消指定」X，避免重複操作符號
```

---

## 六、WebSocket 事件處理

### 6.1 連線生命週期

```
useWebSocket hook:

1. 所有瀏覽器情境（包含未登入 guest）→ useWebSocket 建立 WS 連線並管理 socket lifecycle
   - 若設定 `NEXT_PUBLIC_WS_URL`，優先連到該位址（支援獨立 `ws-gateway`）
   - 否則回退為從 `NEXT_PUBLIC_API_URL` 推導同 host 的 `/ws`
2. ws.onopen → 發送 { type: 'auth' }
3. auth_success → 前端訂閱 `parties:global`，使用登入 actor 的 `actor:{actor.id}` 或 `payload.room_id`（未登入 quick guest）作為 personal room，並重送目前仍有 listener 的 `party:{id}` room 訂閱
   - 個人房間 `actor:{actorId}` 由 server 在握手成功時自動加入
   - reconnect 後必須重送 active room subscriptions，避免隊伍詳情與聊天室事件停止更新
4. useWebSocketEventHandler 負責解析 onmessage、emit 事件與 Query invalidation
   - handler 只依賴穩定的 `identityId` / `personalRoom`，不可在 options 內傳入每次 render 都重建的新物件，避免一般 re-render 觸發 socket teardown / reconnect
5. party 的互動式閒置提醒由 idleWarnings handler 統一處理；`payload.is_quick=true` 時，「我還在 / 已解散」必須改打 quick 專用 endpoint
6. 斷線 → useWebSocketReconnect 以指數退避加 jitter 重連（約 1s, 2s, 4s... 最大 30s，並加 0-1s 隨機延遲避免同時重連）
7. isAuthenticated=false → 仍保留 WS 連線，用於在線人數、公開事件與 quick guest personal-room 通知；沒有 quick guest token 時只會收到 public/global 類事件
```

### 6.2 事件處理矩陣

| 事件 | isPersonal? | Toast 通知 | Query 失效 | 其他動作 |
|------|------------|-----------|-----------|---------|
| `party.created` | ✓(僅建立者 actor room) | - | parties；若 actor:{creatorId} 額外刷新 myOngoing, party:{id} | 建立新隊伍後立即刷新公開列表 |
| `party.updated` | - | - | parties, myOngoing, applications:{id}, myApplications, party:{id} | 隊伍編輯、隱藏/重新開放、slot 調整，或角色資料快照同步後立即刷新清單、申請與詳情 |
| `party.application_accepted` | ✓ | ✅ "申請已被接受！" | parties, myApplications, myOngoing, party:{id} | - |
| `party.application_rejected` | ✓ | ℹ️ "申請已被拒絕" | myApplications, party:{id} | - |
| `party.application_created` | ✓ | ℹ️ "收到新申請！" | applications, party:{id} | - |
| `party.application_cancelled` | - | - | applications, party:{id} | - |
| `party.application_auto_cancelled` | ✓ | ℹ️ (後端 toast) | myApplications | - |
| `party.disbanded` | ✓ | ℹ️ "所在隊伍已解散" | parties, myOngoing, party:{id} | 若在該隊伍頁面 → 移除 `party` query param 並以 client navigation 回到列表 |
| `party.member_kicked` | ✓ | ℹ️ "被踢出隊伍" | parties, myOngoing, party:{id} | 若在該隊伍頁面 → 先暫存 toast，移除 `party` 參數後回到列表頁並重播通知 |
| `party.member_left` | ✓ | ℹ️ "有成員離開" / 自己主動離開時顯示對應文案 | applications, party:{id} | 若 `remove_mode='kicked'`，此事件只負責隊長/其他成員側刷新與提示；被踢者提示與退出目前隊伍畫面統一由 `party.member_kicked` 負責，避免雙重 Toast |
| `party.member_joined` | ✓ | ℹ️ "有成員加入" | parties, party:{id} | - |
| `party.status_changed` | ✓ | - | parties, party:{id} | 同步 RECRUITING / ACTIVE / HIDDEN / CLOSED |
| `party.expired` | ✓ | - | parties, myOngoing, party:{id}, notifications | - |
| `party.idle_warning` | ✓ | 互動式提醒 | parties, myOngoing, party:{id}, notifications | `warning_stage=initial` 時代表已先自動轉為 `HIDDEN`；`warning_stage=final` 時代表 5 分鐘後將自動關閉；快速隊伍只會提醒建立者，payload 會帶 `is_quick=true` |
| `chat` | quick personal room 時 ✓ | quick personal room 且不在該房間頁面時顯示房外 toast | - | party room → 局部訂閱者 (usePartyChat)；quick personal room → 房外通知 |
| `guild.chat` | guild room | Header 公會 icon 未讀 | guild chat | emit → 公會聊天室；畫面不顯示 `guild:{id}` |
| `guild.announcement.created` | guild room | Header 公會 icon 未讀 | guild announcements | 入口導向公會首頁/公告 |
| `guild.match.completed` | guild room | Header 公會 icon 未讀 | guild parties, match history | 顯示生成隊伍數，不顯示隊伍 UUID |
| `system.online_count` | - | - | stats:online | 更新 `['stats', 'online']` query cache |

### 6.3 房間訂閱策略

```
連線後自動訂閱:
  - server 端自動加入 `actor:{actorId}` → 個人化事件
  - client 於 `auth_success` 後訂閱 `actor:{actor.id}` → 個人通知與 actor-scoped 事件
  - client 於 `auth_success` 後訂閱 `parties:global` → 全域隊伍清單更新（含 `party.created`）
  - client 於 `auth_success` 後重送仍有 listener 的 `party:{partyId}` 訂閱 → reconnect 後延續隊伍詳情與聊天室更新

按需訂閱（進入隊伍頁面後）:
  - party:{partyId}      → 使用者開啟隊伍詳情且隊伍未 `CLOSED` 時即訂閱，非成員也可收到唯讀狀態與名額更新
                         → 聊天室只在 `viewer_capabilities.can_read_chat=true` 的隊長/隊員視圖中顯示；快速隊伍未登入成員可使用 quick guest cookie 讀取與發言，非成員訪客不掛載聊天室、不抓歷史
  - guild:{guildId}      → 使用者已加入公會時由公會頁與 Header 公會 icon 訂閱，接收公會聊天、公告與自動配對事件
```

- `wsStore` 會維護 `room_id` 的訂閱計數；多個元件同時訂閱同一房間時，前端只會向伺服器送出一次 `subscribe`，最後一個訂閱者離開時才送出 `unsubscribe`。
- `PartyChat` 與 `GlobalChatNotifier` 可同時訂閱同一個 `party:{id}` 房間；實際送往伺服器的訂閱仍只有一份。
- `GlobalChatNotifier` 以「進行中的活動」隊伍清單為來源；即使該清單缺少 `slots` 或 `chat.timestamp` 異常，仍需用隊伍標題 fallback 顯示跳窗通知並累加活動未讀數。
- `chat` payload 採統一 sender 結構：`{ party_id, sender: { kind, id, display_name, character_code, job_class_id, level }, content }`。Quick Login 與 Discord actor 使用同一套 sender 契約。
- 快速隊伍的 chat 會額外送到可讀取聊天的 quick participant personal room；只有隊長/隊員會收到，`useWebSocketEventHandler` 只在目前不在該 `party` 房間且 sender 不是自己時顯示 toast。
- 若目前正在瀏覽同一個 `party` 房間，聊天室新訊息只更新房內內容，不顯示全域跳窗、不播放提示音，也不累加該房間未讀。
- 進入房間的切頁過渡期也視為「正在進房」：一旦使用者點擊該隊伍入口，即使 URL 尚未完成切換，同房間的新訊息仍不可跳出全域提醒。
- `GlobalChatNotifier` 必須跟 `party` query 參數同步清除 `openingPartyRoom` 狀態：進房成功後立即解除暫存抑制，離開房間後也要同步清除，避免同房新訊息在房外仍被誤判成「正在進房」而漏掉全域提醒與活動未讀數。
- `PartyChat` 房內元件本身也不可對同房新訊息再額外觸發 toast / 音效；房內只更新訊息列表與自動捲動。

---

## 七、通知鈴鐺 (NotificationBell)

### 7.1 顯示邏輯

```
NotificationBell:
  - 已登入即可顯示（Quick Login / Discord 共用）
  - 未讀數量 > 0 → 顯示紅色數字徽章
  - 未讀數量 = 0 → 只顯示鈴鐺圖示
  - 點擊 → 展開通知下拉選單

通知列表顯示:
  - 依 created_at 倒序
  - 未讀通知背景色區分
  - 點擊通知 → 導向 link_url → 標記為已讀
  - Quick Login 與 Discord 共用同一個 API 契約；通知由後端 `notifications` 表提供
  - `party.idle_warning` / `party.expired` 標題優先顯示 `party_title`（隊伍名稱），不以 `party_name`（目標）覆蓋
  - `party.idle_warning` 會依 `warning_stage` 顯示不同文案：`initial` 顯示「已閒置 1 小時並暫時隱藏」，`final` 顯示「已閒置 1 小時 55 分，5 分鐘後自動關閉」
  - `party.idle_warning` 若 content 帶 `is_quick=true`，通知中心的「還在 / 解散」動作需使用 `POST /parties/:id/quick-liveness` 與 `POST /parties/:id/quick-close`
  - "全部標記已讀" 按鈕
  - 不提供單筆刪除或「刪除所有已讀」按鈕
  - `party.idle_warning` 在使用者點選「還在 / 解散 / 離開」後，會先 optimistic remove，避免重複點選
  - optimistic remove 前必須先等待 notification / unread-count 的 in-flight queries 完成取消，避免晚到回應把已移除通知覆蓋回來
  - 若後端回 `PARTY_IDLE_ACTION_NOT_FOUND` / `PARTY_IDLE_ACTION_ALREADY_CLOSED` / `PARTY_IDLE_ACTION_NOT_PARTICIPANT`，通知中心視為 stale no-op，靜默完成移除
  - 若是非 allowlist 的失敗，通知中心不顯示錯誤 toast，但必須 rollback optimistic remove，保留通知作為重試入口
```

### 7.2 實時更新

```
WebSocket 觸發通知更新:
  - 收到個人化事件 (`actor:{actorId}`) → invalidateQueries(['notifications'])
  - 連線後 auth_success → invalidateQueries(['notifications'])（補償斷線）
  - query key 需帶 `actorId`，避免帳號切換時讀到前一個身份的通知快取
```

---

## 八、NotificationAttentionManager

顯示需要立即注意的通知（彈跳提示）：

```
監聽規則:
  - party.idle_warning → 若我是隊長：顯示 "我還在 / 已解散"
                       → 若我是成員：顯示 "我還在 / 已離開"
                       → `warning_stage=initial` 顯示「已閒置 1 小時並暫時隱藏」
                       → `warning_stage=final` 顯示「已閒置 1 小時 55 分，若 5 分鐘內仍無回應將自動關閉」
                       → 收到事件時先同步刷新隊伍與 myOngoing 查詢
                       → "我還在" 會清除初次與最後提醒標記並重置閒置計時；若目前是系統自動隱藏的 `HIDDEN`，會重新顯示
                       → `is_quick=true` 代表快速隊伍建立者提醒；"我還在" 使用 `quick-liveness`，"已解散" 使用 `quick-close`
                       → action 成功或 stale no-op 時才會 invalidate；若正在該隊伍詳情，會移除 URL 的 `party` 參數回列表，不做整頁 reload
                       → 使用者在彈跳提示點選任一動作後，不顯示成功/失敗 toast，避免隊伍狀態已過期時干擾操作
  - party.expired     → 顯示 "隊伍已閒置兩小時沒有活動，已由系統自動關閉"
```

---

## 九、線上人數顯示 (OnlineCounter)

```
顯示邏輯:
  - `['stats', 'online']` query data 有值 → 顯示數字
  - query data 尚未載入 → 顯示載入動畫或空白
  - 顯示人數 icon + 數字
  - 桌面版顯示人數 icon + 數字 +「線上人數」文字
  - 手機版（< sm）顯示人數 icon + 數字，不顯示文字
  - 來源 1：WebSocket `system.online_count` 事件（即時推送）
  - 來源 2：API GET /stats/online（fallback 或首次載入）
```

---

## 十、我的申請頁面 (`/applications`)

### 10.1 顯示邏輯

```
申請清單:
  - 顯示所有狀態的申請（PENDING, ACCEPTED, REJECTED, CANCELLED）
  - PENDING 狀態 → 顯示「取消申請」按鈕
  - ACCEPTED 狀態 → 顯示「前往隊伍」連結
  - 依 created_at 倒序
  - 未登入不顯示 LoginRequiredState；若 `quick_active_party` 為 pending，需以 `GET /parties/:id` 補齊真實隊伍資料且確認 `viewer_capabilities.chat_reason=PENDING_APPROVAL` 後，顯示一筆 synthetic quick 申請列；取消時呼叫 quick cancel endpoint，不使用一般申請 cancel API
  - 未登入且無 pending quick session 時顯示空狀態，不主動開登入 dialog

篩選選項:
  - 全部 / 待審中 / 已接受 / 已拒絕
```

---

## 十一、使用者資料頁 (`/me`)

### 11.1 角色管理

```
角色列表:
  - 顯示所有已建立的角色（game_name, job_class, level）
  - 新增角色表單 → 填寫角色名稱、角色代碼、職業、等級後呼叫 `POST /characters`
  - 角色列可直接編輯角色名稱、職業與等級，按「儲存變更」後呼叫 `PATCH /characters/:id`
  - 角色列的「設為主要角色」需呼叫 `PUT /actors/me/current-character` 並傳入 `{ character_id }`，成功後同步更新 auth store 的 `currentCharacter`
  - 角色列可啟用 / 停用角色；只有 `is_active=true` 的角色會進入 party 建立、申請與席位指派的可選清單
  - 刪除角色前必須顯示確認 modal
  - 角色代碼 (character_code) → 用於 OCR 識別
  - 角色主檔與快速登入表單共用同一套輸入限制：遊戲 ID 最多 20 字元、遊戲代碼最多 7 個英數字元、等級 1-200
  - 最多 N 個角色（後端限制）
```

---

## 十二、管理員頁面 (`/admin`)

### 12.1 顯示邏輯

```
進入條件:
  - actor.is_admin=true → 可訪問
  - 否則 → 403 頁面

顯示內容:
  - 統計數字（`GET /api/v1/admin/stats` 回傳的總用戶與目前進行中隊伍）
  - 用戶管理（搜尋/封禁）
  - 隊伍管理（查看所有狀態包含 HIDDEN / CLOSED）
  - 會員管理入口（`/admin/members`）
  - `/admin/members`：可搜尋 actor、Discord 與角色，列表顯示帳號狀態、PIN/DC 綁定、角色數、開房數與入隊數
  - `/admin/members/{actorId}`：顯示帳號、角色清單、開房紀錄、入隊歷史，並提供重設 PIN、清除 DC 綁定、啟用/停用帳號、角色啟用/停用/刪除/資料修改
  - 清除 DC 綁定按鈕需遵守後端 fallback guard；沒有 PIN 時先重設 PIN，不讓 Discord-only 帳號被鎖住
```

---

## 十三、公會頁面 (`/guilds`)

### 13.1 導覽規則

```
/guilds:
  - 未加入公會 → 顯示公會清單、搜尋與「建立公會」
  - 已加入公會 → 預設導向 `/guilds/{guildId}`
  - `/guilds?view=list` → 即使已加入公會也顯示公會清單，用於「返回公會列表」

/guilds/{guildId}:
  - 導覽文案使用「首頁」，原「我的偏好」入口顯示為「BOSS 設定」
  - 小螢幕公會導覽列直接顯示所有可見入口；空間足夠時一次顯示完，空間不足時用橫向滑動操作，不再把入口摺疊到更多按鈕。
  - 不在公會導覽列顯示「建立隊伍」入口；建立隊伍改由公會隊伍頁第一張建立卡片進入
  - 不顯示 Guild、公會面板、slug、websocket room 或任何技術 ID
  - 公會標題資訊區最上方橫排顯示公會名稱與公會簡介；公告在公會首頁主內容區以獨立區塊顯示最新五則，點擊單則公告可展開或收合全文
  - 公會首頁右側行事曆讀取 `GET /guilds/{guildId}/me/calendar`，只顯示目前帳號所有 active 角色在最近一週內已被指派的 BOSS 公會隊伍；每筆顯示指定時間、BOSS 目標與角色名稱，點擊後導向 `/?tab=MY_PARTY&party={partyId}&fromGuild={guildId}`
  - 桌面版首頁為左側公告與公會隊伍、右側行事曆與主要成員預覽
  - 首頁公會隊伍區直接沿用尋找隊伍的卡片網格，不另做右側成員預覽
```

### 13.2 公會聊天室與通知

```
公會聊天室:
  - 歷史訊息載入最近 100 筆，且後端最久保留 24 小時
  - 訊息顯示名稱優先使用成員第一個可用角色：遊戲 ID · 職業
  - 職業文字套用系統職業色
  - 不在聊天室發言人資訊顯示角色代碼與等級
  - 發言人資訊用較小字級，訊息內容用較大字級以提高閱讀性
  - Enter 直接送出，Shift+Enter 保留換行

Header GuildGadget:
  - 僅已登入且已加入公會時顯示
  - 監聽 guild.chat、guild.announcement.created、guild.match.completed
  - 也監聽 actor:{actorId} 中帶 guild_id 且 generated_auto=true 的 party.member_joined
  - 未讀只存在前端即時狀態，開啟面板或點擊事件後清除，不持久化
```

### 13.3 公會隊伍

```
公會隊伍:
  - 顯示名稱統一為「公會隊伍」
  - 公開搜尋隔離依後端 `visibility=GUILD`，不把 status 改成 HIDDEN
  - 列表 type 篩選顯示：全部 / BOSS / 團練 / 組隊
  - 公會隊伍卡片與公會首頁中的公會隊伍卡片沿用尋找隊伍的 PartyCard 公開卡片呈現樣式；用既有隊伍詳情查詢補齊 slots，只關閉申請操作，不改隊員/席位顯示內容
  - 卡片不顯示 UUID 或「查看隊伍詳情」按鈕，整張卡片可點擊
  - 若隊伍 title 或 target 是 UUID / room key 等技術識別字，前端不可把它當作可見標題或目標文字
  - 公會隊伍頁第一張卡片固定為「建立隊伍」，尺寸與隊伍卡片一致，中間使用加號與「建立隊伍」文字
  - 從公會隊伍進隊伍詳情時帶 `fromGuild`，返回應回 `/guilds/{guildId}/parties`
```

---

## 十四、密碼提示機制

### 14.1 密碼輸入框觸發條件

```
需要顯示密碼輸入框的情況：
  1. 快速申請 (QuickApply)：API 返回 403 → 提示輸入密碼
  2. 點擊有密碼的隊伍 → GET /parties/:id 返回 403 → 提示驗證密碼
  3. 手動申請：join_requires_password=true 且 partyPasswordStore 無已記憶密碼

密碼記憶策略:
  - 正確密碼儲存於 partyPasswordStore（持久化至 sessionStorage）
  - 只有 API 回傳 403 時才顯示「密碼錯誤」並清除該隊伍的記憶密碼
  - 若密碼驗證已成功，但前端快取寫入失敗，仍視為驗證成功，不可誤顯示為密碼錯誤
  - 使用記憶密碼失敗 → 重新提示輸入
```

---

## 十五、確認對話框使用規則

| 操作 | 確認訊息 |
|------|---------|
| 踢出成員 | "確定要踢出此成員嗎？" |
| 離開隊伍 | "確定要離開隊伍嗎？" |
| 解散隊伍 | "確定要解散隊伍嗎？此操作無法復原。" |
| 隱藏隊伍 | "確定要隱藏隊伍嗎？隱藏後外部搜尋將看不到。" |
| 重新顯示隊伍 | "確定要重新顯示隊伍嗎？顯示後將可在搜尋頁面中看到。" |

---

## 十六、Toast 通知規則

### 顯示條件

```
showUniqueToast 防重複機制:
  - 同一 dedupe key 在 1000ms 內不重複顯示
  - key 優先使用 toast `id`，否則使用 `type + message`
  - WebSocket 成員事件需帶事件型 id（eventType + partyId + payloadId + timestamp），避免不同成員的同文案通知互相吞掉
  - 避免 WebSocket 重連時大量重複 Toast

Toast 類型:
  success → 綠色（申請被接受）
  info    → 藍色（收到新申請、被拒絕、被踢出）
  error   → 紅色（操作失敗、密碼錯誤）
```

---

## 十八、隊伍圖片系統 (Party Artwork)

> 核心邏輯：`src/lib/partyArtwork.ts` ｜ 顯示元件：`src/components/design/BossImage.tsx`

### 18.1 整體架構

隊伍圖片系統將「隊伍目標名稱 / 類型」對應到前端的圖片資產，並決定顯示方式（`contain` 或 `cover`）。

```
API 回傳 target_name / boss_label
        ↓
  getPartyArtworkLabel()   ← 解析 type + target_name → 取得 label (target-xxx.png)
        ↓
  getPartyArtworkAsset()   ← label → PartyArtworkAsset { src, fit, crops }
        ↓
  <BossImage label={...} crop="square|wide|default" />
```

### 18.2 圖片資產路徑

#### 地圖類圖片（MAP_TARGETS）

| label（DB 儲存值） | 顯示名稱 | 實際路徑 |
|---|---|---|
| `target-aqua-road.png` | 水世界 | `public/images/party/targets/target-aqua-road.png` |
| `target-dead-mine.png` | 廢棄礦坑 | `public/images/party/targets/target-dead-mine.png` |
| `target-el-nath.png` | 冰原雪域 | `public/images/party/targets/target-el-nath.png` |
| `target-japan.png` | 日本 | `public/images/party/targets/target-japan.png` |
| `target-kritias.png` | 克里提亞斯 | `public/images/party/targets/target-kritias.png` |
| `target-ludus-lake.png` | 路德斯湖 | `public/images/party/targets/target-ludus-lake.png` |
| `target-maple-island.png` | 楓之島 | `public/images/party/targets/target-maple-island.png` |
| `target-minar-forest.png` | 米納爾森林 | `public/images/party/targets/target-minar-forest.png` |
| `target-mu-lung.png` | 武陵桃園 | `public/images/party/targets/target-mu-lung.png` |
| `target-night-market.png` | 不夜城 | `public/images/party/targets/target-night-market.png` |
| `target-nihale-desert.png` | 納希沙漠 | `public/images/party/targets/target-nihale-desert.png` |
| `target-taipei-101.png` | 台北101 | `public/images/party/targets/target-taipei-101.png` |
| `target-temple-of-time.png` | 時間神殿 | `public/images/party/targets/target-temple-of-time.png` |
| `target-thailand.png` | 泰國 | `public/images/party/targets/target-thailand.png` |
| `target-victoria-island.png` | 維多利亞島 | `public/images/party/targets/target-victoria-island.png` |
| `target-ximending.png` | 西門町 | `public/images/party/targets/target-ximending.png` |

#### BOSS / 任務類圖片（非 MAP_TARGETS）

| label | 顯示名稱 | 路徑 |
|---|---|---|
| `target-normal-lotus.png` | 普通拉圖斯 | `public/images/party/targets/target-normal-lotus.png` |
| `target-hard-lotus.png` | 困難拉圖斯 | `public/images/party/targets/target-hard-lotus.png` |
| `target-zakum.png` | 殘暴炎魔 | `public/images/party/targets/target-zakum.png` |
| `target-horntail.png` | 龍王 | `public/images/party/targets/target-horntail.png` |
| `target-super-slime.png` | 超級綠水靈 | `public/images/party/targets/target-super-slime.png` |
| `target-toy-101.png` | 玩具城101 | `public/images/party/targets/target-toy-101.png` |
| `target-pirate-king.png` | 金勾海賊王 | `public/images/party/targets/target-pirate-king.png` |
| `target-romeo-juliet.png` | 羅密歐與茱麗葉 | `public/images/party/targets/target-romeo-juliet.png` |
| `target-goddess-tower.png` | 女神之塔 | `public/images/party/targets/target-goddess-tower.png` |

BOSS 類圖片各有三個預裁切版本：
- `target-{name}.png` — 預設
- `target-{name}-square.png` — 正方形（列表卡片用）
- `target-{name}-wide.png` — 寬版（預覽面板用）

#### Placeholder 圖片

| label | 說明 | 路徑 |
|---|---|---|
| `placeholder-map.png` | 地圖預設圖 | `public/images/party/placeholders/placeholder-map.png` |
| `placeholder-boss.png` | BOSS 隊伍預設圖 | `public/images/party/placeholders/placeholder-boss.png` |
| `placeholder-training.png` | 團練預設圖 | `public/images/party/placeholders/placeholder-training.png` |
| `placeholder-group.png` | 組隊任務預設圖 | `public/images/party/placeholders/placeholder-group.png` |
| `placeholder-default.png` | 通用預設圖 | `public/images/party/placeholders/placeholder-default.png` |

### 18.3 地圖圖片顯示規則（禁止裁切）

地圖類圖片（`MAP_TARGETS` 成員）是場景實景截圖，**必須完整顯示，禁止裁切**：

- `fit` 固定為 `'contain'`，禁止使用 `'cover'`。
- 三個 crop 變體（`default`、`square`、`wide`）全部指向同一張原始圖片，不使用 `-square.png`、`-wide.png` 預裁切版本。
- 圖片統一以 `.png` 格式存放，label key 為 DB 儲存值，不可改變副檔名。

BOSS 類圖片維持 `'contain'` + 獨立 `-square.png`/`-wide.png` 版本，與地圖邏輯無關。

### 18.4 BossImage 元件使用

```tsx
// 隊伍列表卡片
<BossImage label={party.image} height={92} crop="square" />

// 預覽面板（寬版）
<BossImage label={party.image} height={170} crop="wide" />

// 隊伍詳情頁
<BossImage label={party.image ?? party.boss} height={132} crop="square" />
```

`label` 來源：`getPartyArtworkLabel(targetName, partyType)` 的回傳值（即 `target-{name}.png` 格式的字串）。

### 18.5 新增地圖圖片的步驟

1. 將原始圖片放到 `public/images/party/targets/target-{name}.png`。
2. 在 `partyArtwork.ts` 的 `MAP_TARGETS` Set 加入 `'target-{name}.png'`。
3. 在 `TARGETS` 物件加入 `'target-{name}.png': '顯示名稱'`。
4. 在 `TARGET_ALIASES` 加入中英文別名對應。
5. **不需要**產生 `-square.png` / `-wide.png` 版本（地圖類不使用）。

---

## 十七、頁尾捷徑 (Footer)

```
Footer 顯示規則:
  - 顯示 © 2025 OneShort
  - 提供「公告」「回報 Bug」兩個捷徑
  - 公告 → 開啟 DB 最新公告 modal，不讀取前端靜態 Markdown 檔
  - 回報 Bug → 開啟 Bug 回報表單
  - 手機版（< sm）捷徑僅顯示 icon，桌面版顯示 icon + 文字
  - 滑鼠移入或鍵盤 focus 到捷徑 icon 時，會在上方顯示功能提示文字
  - 不再顯示獨立 GitHub icon 快捷入口
  - 保留 GitHub Repo stars 外部連結
```
