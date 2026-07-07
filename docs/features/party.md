# 隊伍管理模組 (Party Management)

OneShort 的核心模組，提供靈活且即時的遊戲組隊體驗。

---

## 1. 業務功能 (Business Features)

- **建立隊伍**: 
    - 設定活動類型 (Boss, Training, Group).
    - `GROUP` 類型的目標由預設組隊任務清單提供，來源為 `raid_boss_options.party_type=GROUP`，包含 **活動任務**、**職業任務** 等選項。
    - `BOSS` / `GROUP` 會以 `raid_boss_options.id` 儲存目標參照，`TRAINING` 會以 `maps.id` 儲存地圖參照；API 仍回傳可顯示的 `target_name`。
    - 設定隊伍上限與職位。
    - `max_members` 是唯讀衍生值，永遠等於目前 slot 數；建隊時 `max_members` 必須等於提交的 `slots.length`。
    - 建隊時若 slot 已預填角色或手動隊員，`current_members` 會直接計入這些已填席位。
    - **[New] 密碼保護**: 支援設定隊伍密碼，僅持有密碼者可加入。
    - **[New] 加入審核模式**: 隊長決定是否需審核，或由系統根據規則自動允許。
    - **審核房可視性**: 需審核（`join_requires_approval=true`）的隊伍對任何訪客（含未登入 guest）皆可查看完整房間資訊，行為與一般公開隊伍一致；差別只在非成員一律看不到頻道與聊天室內容。審核只發生在「申請加入」當下（建立 PENDING application，待隊長同意），不會讓隊伍在查詢階段對非申請者回傳 404。密碼優先於審核：`join_requires_password=true` 的隊伍仍會在非成員查看時要求先驗證密碼。
    - **快速登入玩家開關**: `allow_quick_login_players` 預設為 `true`，隊長可在建隊時關閉，限制只有已綁 Discord 的 actor 可申請。
    - 建隊必須提交 `leader_character_id`；隊長與預填席位角色都必須屬於目前 actor。

- **隊伍搜尋與房號**:
    - 全量搜尋 (Filter by Job/Role)。等級區間篩選固定為 1～200，見文件末尾「全域欄位範圍規範」。
    - **[New] 房號搜尋**: 每個隊伍具備獨一無二的 Hash ID，使用者可直接搜尋。
    - **[New] 房間名稱全域搜尋**: `/find` 頁面的房間名稱搜尋為**全域搜尋**——只要搜尋框有輸入文字，結果一律涵蓋所有房間類型（快速組隊／組隊任務／BOSS／團練），不受目前選中的房間類型 tab 限制。前端在有搜尋文字時改用不帶 `type`/`quick` 參數呼叫 `GET /api/v1/parties`（後端 `type`/`quick` 皆未帶入時本就回傳所有房間類型）。房間類型 tab 於搜尋期間仍可點擊、視覺狀態保留，但不會即時篩選列表，需清空搜尋框才恢復依 tab 篩選；僅特定房間類型才有意義的次要篩選（目標下拉選單）搜尋期間會隱藏。等級區間／職業／僅顯示可加入等篩選為全域篩選，不受房間類型 tab 影響，一律位於搜尋列旁的「更多篩選」面板。

- **成員操作**:
    - 申請加入 (Apply Join).
    - 批准/拒絕 (Approve/Reject).
    - 申請以 `character_id` 為單位；Quick Login-only actor 與已綁 Discord actor 使用同一個角色契約。
    - 若某個 pending 申請在接受他人後失去原本瞄準的顯式 slot，後端只會改配到目前已存在且相容的空 slot；找不到就自動取消。
    - 隊長可直接把自己擁有的角色指定到空 slot，不必先建立 pending application。
    - 踢出成員 (Kick Out)，但隊長不可踢出自己的隊長角色。
    - 手動新增、沒有 `filled_by` 的隊員席位，也必須走 kick 流程清空後才能刪除該 slot。
    - 主動離隊 (Leave Party).
    - 成員準備狀態 (Ready Status).

- **空缺職位靈活性**:
    - 每個 slot 可設定單一 `job_class` 或不限制職業，並可搭配等級上下限與備註。

- **攻略與小工具（`GROUP` 隊伍）**:
    - 隊伍詳情頁以頂層分頁呈現「隊伍資訊／待審申請／攻略／小工具」；攻略與小工具僅對 `GROUP` 隊伍的隊長與隊員顯示，快速隊伍不顯示。
    - 攻略由管理員以攻略模板（`guide_templates`，依 `raid_boss_option_id` 或 `target_map_id` 綁定目標）撰寫，隊伍依目標解析對應攻略；內容支援標題、文字、清單、圖片、影片、表格、callout、章節與 widget 區塊。
    - **桌機（≥900px）浮動視窗**：攻略與各小工具可展開成瀏覽器風格浮動視窗，支援拖曳、縮放、最小化（左下 dock）、釘選（視窗間置頂）；視窗位置尺寸依隊伍存 localStorage。攻略圖片可點擊開全螢幕檢視。
    - **手機（<900px）**：攻略維持頁內顯示，小工具改用底部抽屜（沿用聊天室抽屜三態），抽屜頂部以 chip 切換多個已開啟工具。
    - **小工具即時同步**：任一隊員開啟小工具即建立/加入該工具的同步 session，房內其他成員收到「是否同步開啟」動作提示；同意即加入並開啟，狀態透過 `party.guide_state.updated` 即時同步。詳見 [frontend-logic.md §1.3–1.4](../frontend-logic.md)。session 與工具狀態存於既有攻略 state（保留 id `widget_sessions`、`party_member_colors`），無專屬後端端點。
    - **唯讀凍結**：`CLOSED` 等唯讀隊伍的攻略與小工具僅供檢視，不可建立/加入 session 或修改任何 widget 狀態（前端強制；後端 hardening 為 follow-up）。

- **閒置隊伍生命週期**:
    - 閒置 1 小時先自動改為 `HIDDEN`，並發送 `party.idle_warning`。
    - 若持續閒置到 1 小時 55 分，會再送一次 `party.idle_warning` 最後提醒，告知 5 分鐘後將自動關閉。
    - 排程每輪會補掃 DB-backed immediate parties 與 Redis immediate index，避免舊資料或 Redis snapshot / index 缺失時漏掉未關閉隊伍。
    - 隊長可手動把隊伍切換為 `HIDDEN`，讓隊伍從公開搜尋移除，之後可重新顯示。
    - `ConfirmLiveness` 可由任何現有成員執行，會清除 `last_idle_notified_at` / `last_idle_final_notified_at`、重置閒置計時；若是系統自動隱藏的隊伍，會同步重新顯示。
    - idle warning 的 `not found / already closed / not participant` code 只用於真實 stale/no-op；若是 repository/DB 讀取失敗，仍回 500 讓客戶端可重試。
    - 隊伍若在自動隱藏後仍沒有新更新，系統會在總閒置滿 2 小時時自動改為 `CLOSED`。
    - `CLOSED` 為最終唯讀狀態，只供查詢，不可重新顯示、解散、調整容量或修改任何 slot 資料。

- **訪客（未登入）參與一般即時隊伍**（[ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md)）:
    - 未登入訪客（以 `quick_guest_token` cookie 識別，帳號本身不落 Postgres）可以建立、申請、擔任隊長於**一般即時公開隊伍**（`scheduled_at IS NULL`、非公會、非 quick）；排程隊伍、公會隊伍不開放訪客。
    - 訪客建隊/申請走獨立的 `guest-*` 端點（`POST /parties/guest`、`POST /parties/{id}/guest-applications` 等，見 [api-reference.md](../api-reference.md)），已登入使用者呼叫這些端點時會直接委派給一般的 `CreateParty`/`Apply` 流程，行為等價。
    - 訪客隊長擁有與 actor 隊長對等的管理能力：審核/接受/拒絕申請、踢除成員、關團、閒置確認、修改安全欄位（不含排程與成員異動以外的設定）。
    - 訪客與登入使用者可以**雙向互相申請對方的隊伍**（訪客申請 actor 建立的隊伍、actor 申請訪客建立的隊伍皆合法），`allow_quick_login_players=false` 時兩者皆會被擋下（語意已擴張為涵蓋訪客，見 ADR-0015）。
    - 訪客可以在其參與的一般即時隊伍中收發聊天訊息，資料層以 Redis snapshot（`leader_guest_*`、`filled_by_is_guest`、`applicant_is_guest`/`guest_applicant` 欄位）呈現，不新增 DB schema。
    - **登入自動認領**：訪客登入（quick-login 或 Discord）後，前端會呼叫 `POST /parties/guest-claim`，把訪客名下的一般即時隊伍與 quick party 身分改寫為登入帳號；per-party best-effort，單一隊伍認領失敗（無目前角色、活動衝突等）不影響其他隊伍。

---

## 2. 前後端組件對應 (Code Mapping)

### **後端 (Backend)**
- **Domain**: `backend/internal/party/domain.go` (Entity: `Party`, `Slot`, `Application`)。
- **Usecase**: `backend/internal/party/usecase.go` (核心邏輯: `CreateParty`, `Apply`, `ReviewApplication`, `ReplaceParty`)。
- **Repository**: `backend/internal/party/repository.go` (SQL Query、Redis immediate party cache 與 Transaction 管理)。
- **訪客互通**（ADR-0015）：`backend/internal/party/usecase_guest_party.go`（建隊/申請）、`usecase_guest_party_management.go`（隊長管理）、`usecase_guest_claim.go`（登入認領）、`handler_guest_party.go`／`handler_guest_party_management.go`／`handler_guest_claim.go`（HTTP 層）。

### **前端 (Frontend)**
- **Page**: `frontend/src/app/(main)/_components/PartyHome.tsx` 與 lazy-loaded workspace。
- **Components**: `frontend/src/components/party/` (Cards, Forms, SlotList, Detail/Edit views)。
- **Store**: 基於 TanStack Query 的 `['party']` 系列 hooks。
- **訪客互通**（ADR-0015）：`frontend/src/lib/api/partyApi.ts`（`createGuest`/`applyAsGuest`/`claimGuest` 等）、`frontend/src/hooks/useViewerIdentity.ts`、`frontend/src/lib/auth/claimGuestParties.ts`（登入後自動認領）。訪客建隊/申請的完整 UI（`QuickGuestIdentityPrompt` 擴充職業/等級、建隊頁與隊伍卡片渲染）為後續 UI 專案，資料層已就緒。

---

## 3. 狀態流轉圖 (State Transitions)

1. **Pending**: 使用者送出申請。
2. **Approved/Accepted**: 隊長批准或規則自動通過，成員填入對應 Slot。
3. **Joined**: 成員出現在隊伍詳情與通知訂閱範圍內。
4. **Idle Warned**: 閒置 1 小時後，隊伍先自動變成 `HIDDEN` 並送出第一個 `party.idle_warning`。
5. **Final Warned**: 閒置 1 小時 55 分後，隊伍維持 `HIDDEN`，再送出最後 5 分鐘提醒。
6. **Hidden**: 隊長可手動將隊伍切換為 `HIDDEN`；系統也會在閒置 1 小時後自動隱藏，從公開搜尋移除但保留在我的隊伍。
7. **Refreshed**: 任一現有成員可透過 `ConfirmLiveness` 清除提醒、重置閒置計時；若屬於系統自動隱藏，會重新顯示。
8. **Closed**: 總閒置 2 小時仍未出現新更新時，系統改為 `CLOSED` 並發送 `party.expired`。
9. **Dissolved**: 隊長主動解散時發送事件清除所有連線狀態。

---

## 4. 分析與維護性分析 (Analysis)

### 🟢 結構優點 (Pros)
- **職位邏輯複用**: 職位 (Slots) 的邏輯與隊伍 (Party) 解耦，方便維護 BOSS / TRAINING / GROUP 三種隊伍。
- **靈活審核**: 通過 `JoinCondition` 模式，可動態切換「自動接受」或「人工審核」。

### 🔴 當前分析 (Current State)
- **目標解析與搜尋效能**: `BOSS` / `GROUP` 透過 `raid_boss_options`，`TRAINING` 透過 `maps` 解析顯示名稱；若資料量增加，需觀察目標名稱篩選與清單快取命中率。
- **Actor/角色邊界**: Party 權限以 actor 判斷，入隊與排他鎖以 character 判斷；後續新增跨模組能力時需同時檢查 `leader_user_id` / `filled_by_user_id` 與角色所有權規則。
