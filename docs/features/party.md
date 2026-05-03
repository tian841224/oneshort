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
    - **快速登入玩家開關**: `allow_quick_login_players` 預設為 `true`，隊長可在建隊時關閉，限制只有已綁 Discord 的 actor 可申請。
    - 建隊必須提交 `leader_character_id`；隊長與預填席位角色都必須屬於目前 actor。

- **隊伍搜尋與房號**:
    - 全量搜尋 (Filter by Job/Role).
    - **[New] 房號搜尋**: 每個隊伍具備獨一無二的 Hash ID，使用者可直接搜尋。

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

- **閒置隊伍生命週期**:
    - 閒置 1 小時先自動改為 `HIDDEN`，並發送 `party.idle_warning`。
    - 若持續閒置到 1 小時 55 分，會再送一次 `party.idle_warning` 最後提醒，告知 5 分鐘後將自動關閉。
    - 隊長可手動把隊伍切換為 `HIDDEN`，讓隊伍從公開搜尋移除，之後可重新顯示。
    - `ConfirmLiveness` 可由任何現有成員執行，會清除 `last_idle_notified_at` / `last_idle_final_notified_at`、重置閒置計時；若是系統自動隱藏的隊伍，會同步重新顯示。
    - idle warning 的 `not found / already closed / not participant` code 只用於真實 stale/no-op；若是 repository/DB 讀取失敗，仍回 500 讓客戶端可重試。
    - 隊伍若在自動隱藏後仍沒有新更新，系統會在總閒置滿 2 小時時自動改為 `CLOSED`。
    - `CLOSED` 為最終唯讀狀態，只供查詢，不可重新顯示、解散、調整容量或修改任何 slot 資料。

---

## 2. 前後端組件對應 (Code Mapping)

### **後端 (Backend)**
- **Domain**: `backend/internal/party/domain.go` (Entity: `Party`, `Slot`, `Application`)。
- **Usecase**: `backend/internal/party/usecase.go` (核心邏輯: `CreateParty`, `Apply`, `ReviewApplication`, `ReplaceParty`)。
- **Repository**: `backend/internal/party/repository.go` (SQL Query、Redis immediate party cache 與 Transaction 管理)。

### **前端 (Frontend)**
- **Page**: `frontend/src/app/(main)/_components/PartyHome.tsx` 與 lazy-loaded workspace。
- **Components**: `frontend/src/components/party/` (Cards, Forms, SlotList, Detail/Edit views)。
- **Store**: 基於 TanStack Query 的 `['party']` 系列 hooks。

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
