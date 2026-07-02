# OneShort 後端資料流程文件 (Backend Data Flows)

> 本文件描述各 API 端點的資料流程、判斷邏輯與 Worker 運作機制。

---

## 一、服務入口與路由

### 1.1 API Server 路由結構

```
GET  /health                          → 健康檢查

// 公開路由（無需 JWT）
GET  /api/v1/maps                     → 取得地圖清單
GET  /api/v1/parties                  → 取得隊伍清單（公開可見）
GET  /api/v1/auth/config              → 取得 Discord OAuth2 設定
POST /api/v1/auth/quick-login         → Quick Login 建立 / 回訪
GET  /api/v1/auth/quick-login/check   → 檢查角色代碼狀態
GET  /api/v1/auth/discord/callback    → Discord OAuth callback
GET  /api/v1/job-classes              → 取得職業清單
GET  /api/v1/raid-boss-options        → 取得 BOSS / GROUP 目標選項
GET  /api/v1/stats/online             → 取得在線人數
GET  /api/v1/announcement             → 取得主要系統公告
GET  /api/v1/announcements            → 取得公告列表
GET  /api/v1/notice                   → 取得 NoticeBar 跑馬燈內容
POST /api/v1/bug-reports              → 提交 Bug 回報
GET  /api/v1/docs/*                   → API 文件

// 需認證路由（JWT 必須）
POST /api/v1/auth/logout              → 登出
GET  /api/v1/auth/me                  → 取得當前 session（相容路徑）
GET  /api/v1/actors/me                → 取得當前 session
POST /api/v1/auth/discord/link        → 綁定 Discord
POST /api/v1/auth/discord/link/merge  → 確認 Discord actor 合併
DELETE /api/v1/auth/discord/link      → 解除 Discord 綁定
PUT  /api/v1/actors/me/pin            → 更新 quick-login PIN
PUT  /api/v1/actors/me/current-character → 更新目前角色資料
GET  /api/v1/characters               → 取得我的角色
POST /api/v1/characters               → 建立角色
PATCH /api/v1/characters/:id          → 更新角色
DELETE /api/v1/characters/:id         → 刪除角色

POST /api/v1/parties                  → 建立隊伍
GET  /api/v1/parties/:id             → 取得隊伍詳情
PUT  /api/v1/parties/:id             → 以完整快照覆蓋編輯隊伍
PATCH /api/v1/parties/:id            → 更新隊伍
DELETE /api/v1/parties/:id           → 解散隊伍
POST /api/v1/parties/:id/verify-password → 驗證隊伍密碼
POST /api/v1/parties/:id/reopen       → 重新顯示 HIDDEN 隊伍
DELETE /api/v1/parties/:id/my-membership → 離開自己的隊伍
POST /api/v1/parties/:id/applications   → 申請加入
GET  /api/v1/parties/:id/applications   → 取得隊伍申請列表（隊長）
GET  /api/v1/parties/:id/my-applications → 取得我的申請
GET  /api/v1/applications/me        → 取得我的全部待審申請（含隊伍摘要）
PATCH /api/v1/parties/:id/applications/:appId → 審核申請
DELETE /api/v1/parties/:id/applications/:appId → 取消申請
POST /api/v1/parties/:id/slots        → 新增席位
PATCH /api/v1/parties/:id/slots/:slotId → 更新席位
DELETE /api/v1/parties/:id/slots/:slotId → 刪除席位
POST /api/v1/parties/:id/slots/:slotId/kick → 踢出席位成員
POST /api/v1/parties/:id/liveness    → 現有成員確認仍在並重置閒置計時
POST /api/v1/ocr/parse-screenshot    → OCR 解析截圖
POST /api/v1/ocr/presign             → 取得 OCR 圖片上傳預簽 URL

GET  /api/v1/blocklist               → 取得封鎖清單
POST /api/v1/blocklist               → 封鎖角色
DELETE /api/v1/blocklist/:blocked_character_id → 解除封鎖

GET  /api/v1/notifications           → 取得通知清單
GET  /api/v1/notifications/unread-count → 未讀通知數量
PATCH /api/v1/notifications/:id/read → 標記通知已讀
PATCH /api/v1/notifications/read-all → 全部標記已讀
DELETE /api/v1/notifications/:id    → 刪除通知
DELETE /api/v1/notifications/read-all → 刪除所有已讀

// 管理員路由
GET  /api/v1/admin/stats             → 統計資料
GET  /api/v1/admin/banlist           → 封禁清單
POST /api/v1/admin/banlist           → 新增封禁
DELETE /api/v1/admin/banlist/:id     → 移除封禁
GET  /api/v1/admin/parties           → 隊伍管理清單
DELETE /api/v1/admin/parties/:id     → 強制關閉隊伍
GET  /api/v1/admin/announcements     → 管理公告列表
GET  /api/v1/admin/announcement      → 管理主要公告
POST /api/v1/admin/announcement      → 新增公告
PUT  /api/v1/admin/announcement      → 覆寫主要公告
DELETE /api/v1/admin/announcement/:id → 刪除指定公告
DELETE /api/v1/admin/announcement    → 清除公告
GET  /api/v1/admin/notice            → 管理 NoticeBar 內容
PUT  /api/v1/admin/notice            → 覆寫 NoticeBar 內容
DELETE /api/v1/admin/notice          → 清除 NoticeBar 內容
```

### 1.2 中間件執行順序

```
Request → CORS → Security Headers → Body Limit →
          Rate Limit → Sanitize →
          [Auth Middleware (JWT 驗證)] →
          [可選 RequireDiscordUser()]
          [API Version Middleware] →
          [Primary Read Stickiness] →
          Handler
```

Auth Middleware 補充：
- actor token：注入 `actor_id`、`character_id`、`linked_providers`、`login_method`、`is_admin`
- `ContextKeyUserID` 目前仍回填 `actor_id` 供既有模組相容
- `RequireDiscordUser()` 目前改成檢查 `linked_providers` 是否含 `discord`

### 1.3 Auth Phase 2 Flow

```
POST /api/v1/auth/quick-login
  1. 驗證 character_code / pin；首次建立額外驗證 display_name / job_class_id / level
  2. `characters.character_code -> actor_id`
   3. 不存在則建立 actors + characters
  4. 驗證 actors.pin_hash
  5. 寫 access_token / refresh_token cookies
  6. 回傳 { actor, current_character }

GET /api/v1/auth/quick-login/check
  1. 將 code 正規化成大寫
  2. 查 character_code
  3. 回傳 `available` / `requires_pin` / `discord_only`

GET /api/v1/auth/discord/callback
  1. 驗 state cookie
  2. 向 Discord 換 token + 查 `/users/@me`
  3. 依序處理：
     - 已綁定 Discord actor
     - quick-login actor 補綁 Discord
     - 新建 Discord actor
  4. 依 current-character 規則選擇角色
  5. 寫 access_token / refresh_token cookies，回傳 { actor, current_character }

POST /api/v1/auth/logout
  1. 將 access / refresh token jti 寫入撤銷清單
  2. 清除 access / refresh cookies

POST /api/v1/auth/discord/link
  1. 以目前 JWT claims.ActorID 為 target actor
  2. 驗證 request body `state` 與 `oauth_state` cookie，驗證後清除 cookie
  3. Discord OAuth code exchange + `/users/@me`
  4. 若 Discord 未綁定 / 已綁目前 actor → 沿用原本成功流程
  5. 若 Discord 已綁別的 actor：
     - `repo.BuildDiscordMergePreview(target, source)`
     - 檢查 banned / active party leader / active party member / pending application / activity lock
  6. 有 blocker → `409 discord_merge_blocked`
  7. 無 blocker → 建立 Redis 一次性 `merge_token`（TTL 5 分鐘），回 `409 discord_merge_required`

POST /api/v1/auth/discord/link/merge
  1. 驗證 `merge_token` 存在且 target actor 必須等於目前 claims.ActorID
  2. `GetDel` 消費 merge token，避免重放
  3. 再跑一次 `BuildDiscordMergePreview`，避免 TOCTOU
  4. blocker 出現 → `409 discord_merge_blocked`
  5. `repo.MergeDiscordActors(...)`
     - 搬移 source characters / notifications / bug_reports / discord link
     - 清空 source.pin_hash
     - 保留 target primary/current character
  6. 重新載入 `GetMe`
7. 以目前 login_method 重簽 access_token / refresh_token cookie，回 `{ actor, current_character }`
```

前端不呼叫顯式 `/auth/refresh`；protected API middleware 會在 access token 過期且 refresh token 仍有效時自動重簽 cookie。重簽前會先消費舊 refresh token，確保同一 refresh token JTI 只能成功輪替一次；若最終仍為 `401` 再由前端進入登入導向。

### 1.4 PATCH /api/v1/characters/:id（更新角色）

```
1. 驗證操作者擁有該 character
2. Repository transaction 更新 characters
3. 同 transaction 寫入 outbox:
   - event_type = character.updated
   - room_id = system:character:{characterID}
4. Stream consumer 收到 internal 事件後執行 CharacterUpdateProcessor:
   - 同步刷新 party:data:* 內的 leader / slot 角色快照
   - 同步刷新 party:apps:* 內的 application.character
   - 改寫 chat:party:* 歷史訊息中的 sender snapshot
   - 改寫 notifications.content 內的角色顯示欄位
5. Processor 再補發 actor:{id} / party:{id} 的 character.updated refresh 事件
```

- `PATCH /characters/:id` 現在不只更新角色主表，也會同步回寫歷史聊天與通知中的角色顯示資料。
- `GET /parties/:id/chat` 回傳的每筆訊息都可能包含 `sender` snapshot；新訊息寫入 Redis 時也會帶入同一份 sender 資料。

---

## 二、隊伍 API 資料流程

### 2.1 GET /api/v1/parties（取得清單）

```
1. 解析 Query Params → ListPartiesFilter
   - type, target_name, job_class, min_level, status
   - include_closed, time_scope (NOW/UPCOMING/ALL_ACTIVE)
   - cursor, limit, offset
   - requires_password, requires_approval

2. 版本化快取查詢:
   a. 計算 filter 的 hash 簽名 (buildPartyListCacheSignature)
   b. 取得當前快取版本號 (Redis GET "party_list_version")
   c. 組合 key = "party_list:{version}:{hash}"
   d. Redis GET → 命中 → 返回快取結果 (cache hit)
   e. 未命中 → 繼續查 DB

3. DB 查詢 (ListParties):
   SELECT p.*, slots.* FROM parties p
   LEFT JOIN party_slots slots ON p.id = slots.party_id
   WHERE status IN ('RECRUITING', 'ACTIVE')  -- 非 include_closed
   AND [type filter] AND [name filter] AND [job_class filter]
   AND recruit_until > NOW()  -- time_scope=NOW
   ORDER BY created_at DESC
   LIMIT :limit OFFSET :offset

   - `parties.target_name` 在 DB 內部可能是參照 ID；查詢時會依類型解析成 `target_option_id` / `target_map_id` / 顯示用 `target_name`
   - `target_name` 篩選永遠對解析後的顯示名稱做比對，不直接比對 DB 內儲存的 ID 字串
   - 對 `scheduled_at IS NOT NULL` 與 `HIDDEN/CLOSED/DISBANDED` 這類需要即時同步的 DB-backed 隊伍，清單查詢必須走 Primary Read，確保建立或更新後在「尋找隊伍 / 我的隊伍」立即可見，不受 replica lag 影響
   - `time_scope=NOW` 只回傳真正仍在進行中的活動：
     - immediate 隊伍：`scheduled_at IS NULL` 且未關閉
     - 指定時間隊伍：`scheduled_at <= NOW()` 且 `active_until > NOW()`
     - 公開搜尋不可混入 `HIDDEN` / `CLOSED` / `DISBANDED` 的非公開或唯讀快照
   - Redis immediate 隊伍索引拆成兩份：
     - `party:list:immediate`：仍可搜尋的 immediate 隊伍
     - `party:list:immediate:closed`：最近 72 小時內保留唯讀的已關閉 immediate 快照
     - 若索引缺失，會 fallback 掃描 `party:data:*`，並在讀取時自動修補索引

   include_closed=true（我的隊伍）時：
   - 回傳 RECRUITING / ACTIVE / HIDDEN
   - 回傳最近 72 小時內的 CLOSED / DISBANDED
   - immediate `CLOSED` 快照從 `party:list:immediate:closed` 讀取，不再留在公開搜尋索引
   - 公開搜尋不再以前端 updated_at 1 小時過濾

4. 密碼遮蔽:
   - 非隊長 → join_password = null

5. 寫入快取 (5-30min TTL 依 filter 類型)

6. 返回 JSON 陣列
```

### 2.2 GET /api/v1/parties/:id（取得單一隊伍）

```
1. 解析 party_id UUID
2. GetParty from DB:
   SELECT p.*, slots.* FROM parties WHERE id=:id
   - 同步解析 `target_option_id` / `target_map_id`
   - `target_name` 回傳顯示名稱，而非 DB 內部儲存的參照 ID
   - 會一併載入 `last_idle_notified_at` / `last_idle_final_notified_at`
   - 這兩個欄位必須跟著寫入 Redis，否則後續 `POST /parties/:id/liveness` 無法正確判斷 cached `HIDDEN` 隊伍是否屬於「閒置自動隱藏」
   - `max_members` 為唯讀衍生值，永遠等於目前 slot 數
   - `current_members` 會依所有已填 / 手動已填席位重新校正；若 DB 計數落後，會背景自我修正

3. 確認使用者身份:
   - JWT 內的 `actor_id` 會對應到 `leader_user_id` / `filled_by_user_id`
   - leader 由 `leader_user_id` 或角色所有權判斷
   - participant 由 `filled_by_user_id` / leader 判斷

4. 資訊遮蔽:
   - !isLeader → join_password = null (隊長才能看密碼)
   - !isLeader AND !isParticipant:
     - party.JoinRequiresPassword=true → 返回 403 (ErrPartyPasswordRequired)
     - party.Channel = ""  (非成員看不到遊戲頻道)

5. 返回 Party（含 slots 及 enriched 欄位）
```

### 2.3 POST /api/v1/parties（建立隊伍）

```
1. ShouldBindJSON → CreatePartyInput 驗證
2. UseCase.CreateParty:
   a. sanitizeCreatePartyInput（XSS 過濾）
   b. 驗證隊伍類型與目標欄位組合
   c. 驗證 actor 與角色：
      - `leader_character_id` 必填，且必須屬於目前 actor
      - 預填席位的 `filled_by` 若不是隊長角色，也必須屬於目前 actor
      - `max_members` 必須等於 `len(slots)`；slot 本身就是容量
      - `filled_by` 有值的席位會直接視為已填入成員，即使 payload 同時帶 `is_filled=false` 也會正規化為已填滿
   d. 密碼邏輯驗證
   e. `allow_quick_login_players` 若缺省，補成 `true`
   f. 時序驗證 (recruit_until <= active_until)
   g. 解析目標參照
      - BOSS / GROUP：解析 `target_option_id`（或 fallback 以 `target_name` 回查）到 `raid_boss_options`
      - TRAINING：解析 `target_map_id`（或 fallback 以 `target_name` 回查）到 `maps`
      - 實際寫入 DB 時，參照 ID 會存進 `parties.target_name`
      - 回傳 / 廣播 payload 仍使用顯示名稱 `target_name`
   h. 依 `scheduled_at` 分流建立隊伍
      - `scheduled_at = null`（立即隊伍）→ Redis-only 建立 + 寫入 party cache
      - `scheduled_at != null`（預約隊伍）→ Transaction：INSERT party + INSERT slots
      - `current_members` 會依「所有已填 / 手動已填席位」計算
   i. 發布 `party.created`
      - `party:{partyID}` room
      - 另外寫入建立者 personal room：`actor:{leaderUserID}`
      - StreamConsumer 會把 `party:{partyID}` 事件鏡像到 `parties:global`
   j. Redis ZSET 更新 party_expiry
   k. Bump 快取版本號
3. 返回 { party, slots }
```

### 2.3.1 PATCH /api/v1/parties/:id（更新 / 隱藏 / 重新顯示）

```
1. ShouldBindJSON → UpdatePartyInput
2. UseCase.UpdateParty:
   a. 驗證操作者為隊長
   b. ensurePartyMutable（CLOSED / DISBANDED 不可修改）
   c. 若 is_temporarily_closed=true:
      - status = HIDDEN
      - 從公開搜尋移除，但保留在我的隊伍
   d. 若 is_temporarily_closed=false:
      - status = RECRUITING 或 ACTIVE
      - 重新顯示到公開搜尋
      - 清除 last_idle_notified_at / last_idle_final_notified_at
   e. 若 type / target 有變更，重新解析目標參照
      - BOSS / GROUP → `raid_boss_options.id`
      - TRAINING → `maps.id`
      - DB 內部仍寫入 `parties.target_name`，Response 解析回顯示名稱
   f. 其他欄位照正常流程更新
      - `max_members` 不可直接 patch；容量只能透過 slot 新增 / 刪除改變
      - `HIDDEN` / `CLOSED` / `DISBANDED` 不會因為 slot 容量變化而被強制改成可見狀態
   g. 在同一個 DB Transaction 內寫入 `party.updated` outbox
      - `party:{partyID}` room
      - `actor:{leaderUserID}` room
      - 若 outbox enqueue 失敗，整個 UpdateParty 會回滾，避免 DB 已更新但列表 refresh 事件遺失
      - StreamConsumer 會鏡像到 `parties:global`
   h. bumpListCacheVersion + 開啟短暫 primary-read 視窗，避免全域清單 refetch 命中 replica 舊資料
```

### 2.3.2 PUT /api/v1/parties/:id（完整覆蓋編輯隊伍）

```
1. ShouldBindJSON → ReplacePartyInput
   - `slots[]` 代表儲存後仍存在的完整 slot snapshot
   - 每個既有 slot 會額外帶 `base`，描述使用者開始編輯時看到的 slot 狀態
   - `deleted_slots[]` 代表這次想刪除的既有 slot，以及刪除前看到的 `base`

2. UseCase.ReplaceParty:
   a. 驗證操作者為隊長
      - 透過 `AuthActor` 驗證，不再依賴舊 `GetUserID()` 單一路徑
   b. ensurePartyMutable（CLOSED 不可修改）
   c. 驗證基本規則：
      - slot 數 1..6
      - 隊長 slot 仍存在且保持已填
      - `filled_by` 不可重複
   d. 驗證 `filled_by`：
      - 可以是隊長自己擁有的角色
      - 或已在隊伍中的角色
      - 或對此隊伍有 pending application 的角色

3. Repository.ReplaceParty:
   a. 以 `SELECT ... FOR UPDATE` 鎖住 party 與現有 slots
   b. 若 `revision` 一致：
      - 重建 slots
      - 同一個已保留 slot 不會因 editor payload 漏帶 `filled_by` 就遺失既有成員
      - 刪除未保留的空 slot
      - 重算 `current_members` / `max_members` / `status`
      - `revision = revision + 1`
      - 發送一次 `party.updated`
   c. 若 `revision` 不一致：
      - 先比對目前 server slots 與 client 提交的 `base`
      - 若只是一般 stale revision → 回 `ErrPartyRevisionConflict`
      - 若偵測到硬衝突：
        * `member_joined_while_editing_slot`
        * `member_changed_while_editing_slot`
        * `member_joined_while_deleting_slot`
        → 回 `PartyReplaceConflictError`

4. Handler.ReplaceParty:
   - 一般 revision 漂移 → `409 { error: "party revision conflict" }`
   - slot 級硬衝突 → `409`
     {
       "code": "PARTY_SLOT_CONFLICT",
       "error": "party slot conflict",
       "party": 最新隊伍快照,
       "conflicts": [...]
     }

5. 前端拿到 `PARTY_SLOT_CONFLICT` 後，應先同步最新 `party`，再要求隊長依衝突格重新確認
```

### 2.4 POST /api/v1/parties/:id/applications（申請加入）

```
1. 解析 ApplyInput { character_id, target_slot_id, join_password? }
2. UseCase.Apply:
   a. actor 驗證
      - `character_id` 必填，需通過角色所有權驗證
   b. GetParty → 確認隊伍存在
      - 若 `allow_quick_login_players=false` 且 actor `linked_providers` 只有 `quick_login`、未綁 `discord` → 409
   c. 密碼驗證（隊長帳號免密碼）
   d. CreateApplication 前先驗證 slot：
      - `target_slot_id` 若存在，必須屬於該隊伍
      - `target_slot_id` 僅是偏好位置；只要目前存在其他相容空缺，申請仍可成立
      - 必須至少存在一個「未填且相容」的 slot（`job_class` / `min_level` / `max_level` 全部符合）
      - 不可因剩餘容量動態建立 on-demand slot；只允許使用目前已存在的顯式空缺
   e. join_requires_approval=false:
      - 若為進行中活動 → 對 applicant character 套用 `activity_presence_locks`
      - 建立 Application (PENDING)
      - AutoAccept → 重新從目前相容空缺中選出最佳 slot
       - AutoAccept → status=ACCEPTED, slot.is_filled=true, application.target_slot_id=實際 slot
       - slot 寫 `filled_by`
       - 取消申請者其他隊伍的 PENDING 申請並通知：
          - CancelPendingRequests
       - 其他原本指向該實際 slot 的 PENDING 申請，會依 `created_at ASC` 重新分配：
         * 有其他相容空位 → 保留 `PENDING`，並改寫 `target_slot_id`
         * 沒有其他相容空位 → 改成 `CANCELLED` 並通知
   f. join_requires_approval=true:
      - 建立 Application (PENDING)
      - 不做任何其他操作（等隊長審核）
   g. refreshRecruitUntil（Sliding Expiration）
      - 使用 `ACTIVITY_VISIBILITY_DURATION` 延長招募截止時間（預設 1 小時）
   h. bumpListCacheVersion
   i. Redis-only 立即隊伍會寫入 `party:apps:*`、`application:party:*`、`actor:app_refs:*`，且 `party:data:*` 與 application list 都必須維持 TTL
3. 發布事件（透過 Outbox）:
   - 隊長個人通知：party.application_created → personal room（`actor:*`）
   - (若 autoAccept) party.application_accepted → applicant personal room（`actor:*`）
   - (若 autoAccept) party.member_joined → party:{partyID} room
4. 返回 Application
```

### 2.5 PATCH /api/v1/parties/:id/applications/:appId（審核申請）

```
1. 解析 ReviewApplicationInput { action: "accept" | "reject" }
2. UseCase.ReviewApplication:
   a. GetApplication → 確認申請存在且屬於此隊伍
   b. 確認操作者為隊長
   c. ensurePartyMutable（非 CLOSED/DISBANDED）
   
   d. action=accept:
      - 若進行中 → 對 applicant character 套用排他鎖；若衝突返回 409
      - AcceptApplication → 重新掃描目前所有未填且相容的 slot，依同一排序規則選最佳位置：
        * 明確 `job_class` 匹配優先
        * 等級區間較窄優先
        * `is_required=true` 優先
        * `slot_order` 較小優先
      - 若目前沒有未填且相容的 slot → 直接回 `ErrNoCompatibleSlot`
      - AcceptApplication → slot.is_filled=true，並把 `target_slot_id` 改寫為實際分配到的 slot
      - 寫 `filled_by`
      - 取消申請者其他隊伍的 PENDING 申請並通知
        * CancelPendingRequests
      - 其他原本指向該實際 slot 的 PENDING 申請，會依 `created_at ASC` 重新分配：
        * 有其他相容空位 → 保留 `PENDING`，並改寫 `target_slot_id`
        * 沒有其他相容空位 → 改成 `CANCELLED` 並通知受影響申請者
      - refreshRecruitUntil
      - bumpListCacheVersion
      - 發布事件：
        * party.application_accepted → applicant personal room
        * party.member_joined → party:{partyID} room + parties:global

   e. action=reject:
      - RejectApplication → status=REJECTED
      - 不呼叫 refreshRecruitUntil；拒絕不代表隊伍有新活動
      - bumpListCacheVersion
      - 發布事件：
        * party.application_rejected → applicant personal room

3. 返回 200 { "status": "success" }
```

Redis-only 立即隊伍補充：
- accept / reject / cancel 只要重建 `party:apps:*`，必須重新套用 application list TTL，避免 list 變成永久 key。
- cancel、delete party、idle auto-expire 會同步刪除對應 `application:party:*`，並從 `actor:app_refs:*` 移除 `partyID:applicationID`。
- cancel 不呼叫 refreshRecruitUntil；取消不代表隊伍有新活動。

### 2.5.1 Slot 編輯 API（新增 / 更新 / 刪除）

```
1. AddSlot / UpdateSlot / DeleteSlot 共用前置：
   - 僅隊長可操作
   - 隊長權限一律由 `AuthActor` + 角色/actor 所有權判斷
   - 隊伍必須不是 `CLOSED` / `DISBANDED`
   - `slot = 容量`；`max_members` 為唯讀衍生值，永遠等於目前 slot 數

2. AddSlot：
   - 一律新增一格新容量，總 slot 數不可超過 6
   - 新增後同步重算 `current_members`、`max_members=len(slots)`、可見狀態與 `revision`

3. UpdateSlot：
   - 隊長可直接把自己擁有的角色指定進 slot，不必先建立 pending application
   - 隊長不可指定不屬於自己、未在隊伍中、也未對此隊伍送出 pending application 的 `filled_by`
   - 若 `filled_by` 有值，後端會把該席位正規化為 `is_filled=true`
   - 當 slot 從空位變成已填入時，`current_members` 會遞增，並依容量同步重算狀態與 `revision`

4. DeleteSlot：
   - 已填席位必須先透過 kick / leave 清空，不能直接刪除
   - 刪除空位時會同步縮減容量，`max_members` 直接變成剩餘 slot 數
   - 刪除後同步重算可見狀態與 `revision`
```

### 2.6 POST /api/v1/parties/:id/slots/:slotId/kick（踢出成員）

```
1. 確認操作者為隊長（或為該席位的角色擁有者 → 自願離開）
   - 隊長只能踢出其他成員，不可指定自己的隊長角色槽位
2. 確認隊伍非 CLOSED/DISBANDED
   - `filled_by = null`、但 `is_filled = true` 的手動隊員席位也可由隊長移除
3. DB 操作：
   a. slot.is_filled=false, slot.filled_by=null
   b. 更新 activity_presence_locks（釋放排他鎖）
   c. 更新 party.current_members-=1
   d. 根據 current_members 重新計算狀態（RECRUITING/ACTIVE）
4. 發布事件（透過 Outbox）：
   - 踢出：party.member_kicked → 被踢者 personal room + party:{partyID}
   - 自願：party.member_left → 隊長 personal room + party:{partyID}
5. bumpListCacheVersion
6. Redis immediate 隊伍的快取 slot 必須同步保留 `filled_by_user_id`
   - 否則踢人流程雖然知道 `character_id`，仍無法正確找出被踢者的 `actor:{id}` 房間送出 `party.member_kicked`
```

### 2.7 POST /api/v1/parties/:id/liveness（重置閒置）

```
1. 驗證呼叫者是否仍為隊伍現有成員（不限隊長）
2. 更新 updated_at
3. 清除 last_idle_notified_at / last_idle_final_notified_at
4. 若隊伍是因閒置提醒而自動變成 `HIDDEN`，同步恢復為 `RECRUITING` / `ACTIVE`
5. 不會將隊長手動隱藏的 `HIDDEN` 狀態自動改回公開
6. 若為 Redis-only 立即隊伍，同步刷新 Redis 快取內容與索引
7. bumpListCacheVersion

stale/no-op 契約：
  - `PARTY_IDLE_ACTION_NOT_FOUND`：隊伍已不存在
  - `PARTY_IDLE_ACTION_ALREADY_CLOSED`：隊伍已關閉或已解散
  - `PARTY_IDLE_ACTION_NOT_PARTICIPANT`：呼叫者已不在隊伍中
  - 只有真實 stale/no-op 會回上述 code；repository / DB 讀取失敗仍走 500
  - handler 會保留 HTTP status（404 / 409 / 403），並在 body 補 `code`
  - 前端 idle warning action 應將這些情境視為 silent no-op，而非真正錯誤
```

### 2.7A POST /api/v1/parties/:id/quick-liveness（快速隊伍重置閒置）

```
1. 透過 quick_guest_token 解析目前 quick viewer
2. 驗證 viewer 是快速隊伍 HOST participant
3. 呼叫 ConfirmPartyLiveness，同步清除 last_idle_notified_at / last_idle_final_notified_at 並刷新 updated_at
4. 若隊伍是因閒置提醒而自動變成 `HIDDEN`，恢復為 `RECRUITING` / `ACTIVE`
5. 更新 quick immediate Redis snapshot、刷新招募快取、發布 `party.updated`
6. stale/no-op code 與一般 `/liveness` 相同；非 HOST 會回 `PARTY_IDLE_ACTION_NOT_PARTICIPANT`
```

---

## 三、事件發布與傳遞流程

### 3.1 Transactional Outbox 模式

```
UseCase 層呼叫 outboxStore.Enqueue(event):

1. 在同一個 DB Transaction 內：
   INSERT INTO outbox_events (
     event_type, payload_json, room_id, status='PENDING', created_at
   )

2. Relay Worker（獨立 goroutine，每 500ms 輪詢）：
   SELECT * FROM outbox_events WHERE status='PENDING' ORDER BY created_at LIMIT 100
   FOR EACH event:
     XADD ws_events * event_type=... room_id=... payload=... emitted_at=...
     UPDATE outbox_events SET status='PROCESSED' WHERE id=...

3. 原子性保證：
   - DB 寫入 + outbox 寫入在同一 Transaction
   - 若 API server crash → Relay Worker 重啟後繼續處理未發布事件
```

### 3.2 WS Gateway Stream Consumer 流程

```
StreamConsumer.Start(ctx):

迴圈:
  1. 每 5 秒嘗試 XAUTOCLAIM 過期消息（處理崩潰恢復）
  2. XREADGROUP GROUP ws_gateway_{hostname} CONSUMER {hostname-pid}
     STREAMS ws_events > COUNT 100 BLOCK 2000ms

processMessage(m):
  1. 解析 room_id, event_type, payload, emitted_at, outbox_id
  2. 若 `notify:outbox:delivered:{group}:{outbox_id}` 已存在:
     → 視為同一 consumer group 的 XACK 失敗 / reclaim 重送
     → 不重送本機 hub，XACK 後結束

  3. hub.Deliver(room_id, message) → 發送給訂閱該 room 的所有 WS 連線

  4. 若 room_id 以 "party:" 開頭 + 屬於 partyListRefreshEvents:
     → hub.Deliver("parties:global", message)
     (讓清單頁面即時感知到成員變動)

  5. 若 `notify:outbox:seen:{outbox_id}` 已被其他 gateway instance 標記為處理過:
     → 仍完成本機 hub.Deliver / parties:global mirror
     → 跳過 DB notification、chat cleanup、character internal processor 等全域副作用
     → SET notify:outbox:delivered:{group}:{outbox_id} TTL 24h
     → XACK 後結束

  6. 若 event_type=party.disbanded + room_id 以 "party:" 開頭:
     → DEL "chat:{room_id}" (清除 Redis 聊天記錄)

  7. 若 room_id 以 "actor:" 開頭 + 屬於 actorNotificationEvents:
     → maybeStoreNotification() → INSERT notifications

  8. SET notify:outbox:seen:{outbox_id} TTL 24h
  9. SET notify:outbox:delivered:{group}:{outbox_id} TTL 24h
  10. XACK ws_events ws_gateway_{hostname} {message_id}
```

Consumer group 補充：
- 預設 group 名稱為 instance-scoped（`ws_gateway_{hostname}`），確保每個 gateway instance 都會收到 outbox-backed event，並廣播給自己記憶體內的 WebSocket 連線。
- 建立新的 instance-scoped group 時從 Redis Stream 的 `$` 開始，不回放既有 `ws_events` 歷史 backlog；避免 instance rollout 建立新 group 後掃描整條 stream。
- `notify:outbox:seen:{outbox_id}` 是跨 instance 的全域副作用 dedupe，不是本機 hub 廣播 dedupe；每個 gateway 仍必須把首次收到的事件送到自己的 hub。
- `notify:outbox:delivered:{group}:{outbox_id}` 是同一 consumer group 的本機 delivery dedupe，用來避免 XACK 失敗或 pending message reclaim 對同一批本機連線重送。

Gateway WebSocket 授權補充：
- 握手成功後，server 會自動把連線加入 `public:broadcast` 與當前 identity 的 personal room（`actor:{id}`）。
- 額外 `subscribe` action 只允許：
  - `parties:global`
  - 呼叫者自己的 personal room
  - 通過成員驗證的 `party:{id}`
- 其他 room（包含他人的 `actor:*`）會直接回 error，不會加入 subscription。

### 3.3 房間廣播策略

```
事件 → 路由至哪些房間:

party.created                   → party:{partyID} + parties:global + 建立者 personal room
party.updated                   → party:{partyID} + parties:global + 隊長 personal room
party.application_created       → 隊長 personal room
party.application_accepted      → 申請者 personal room
party.application_rejected      → 申請者 personal room
party.application_auto_cancelled → 申請者 personal room
party.member_joined             → party:{partyID} + parties:global + 隊長 personal room
party.member_left               → party:{partyID} + parties:global + 隊長 personal room
party.member_kicked             → party:{partyID} + parties:global + 被踢者 personal room
party.disbanded                 → party:{partyID} + parties:global + 各成員 personal room
party.status_changed            → party:{partyID} + parties:global
party.expired                   → party:{partyID} + 各成員 personal room
party.idle_warning              → 隊長與成員 personal room + party:{partyID}
system.online_count             → public:broadcast
```

快速隊伍補充：
- quick participant token 為 `actor:{id}` 時 personal room 直接對應該登入 actor；未登入 guest token 會轉成 deterministic quick guest `actor:{id}` personal room。
- `party.updated` 會送到 `party:{partyID}` 與所有 quick participant personal room，確保登入 actor 與未登入 guest 都會刷新快速隊伍狀態。
- `party.application_created` 會送到 `party:{partyID}` 與 HOST personal room；`party.application_accepted` / `party.application_rejected` 會送到申請者 personal room。
- `party.member_joined` 會送到 `party:{partyID}` 與 HOST personal room，維持與一般隊伍的隊長通知語義一致。
- `chat` 仍寫入一次 `chat:party:{id}` 歷史並推送 `party:{partyID}`；快速隊伍會額外鏡射同一 payload 到可讀聊天的 quick participant personal room，供房外 toast 使用。

---

## 四、Worker 機制

### 4.1 Relay Worker

```
cmd/relay-worker/main.go

職責：
  從 outbox_events 表讀取 PENDING 事件 → 寫入 Redis Stream

輪詢間隔：500ms
批次大小：100 events/批

流程：
  SELECT → XADD → UPDATE status=PROCESSED
  若 XADD 失敗 → UPDATE status=FAILED, retry_count++
  超過 3 次失敗 → status=DEAD_LETTER
```

### 4.2 隊伍過期 Worker

```
party expiry worker:

1. 讀取 Redis ZSET "party_expiry"（sorted by recruit_until timestamp）
2. ZRANGEBYSCORE 0 NOW → 取出已過期的 party_ids
3. 批次更新 DB：UPDATE parties SET status='EXPIRED' WHERE id IN (...)
4. 發布 party.expired 事件給隊伍 room + 各成員個人 room
5. ZREM "party_expiry" {party_ids}

時機：每 1 分鐘執行一次
```

### 4.3 閒置警告 Worker

```
idle party worker:

第一階段：閒置提醒
  - 條件：status IN ('RECRUITING', 'ACTIVE') 且更新時間超過 1 小時
  - 來源：
    - 預約隊伍：DB 查詢 scheduled_at / updated_at 雙門檻
    - 立即隊伍：DB-backed immediate rows + Redis immediate index 批次讀取 `party:data:*`
    - 排程每輪都會補掃 DB 與 Redis 的未關閉候選，避免 Redis snapshot / index 缺失時漏掉舊資料
  - 動作：
    1. 設定 status='HIDDEN'、last_idle_notified_at = NOW()
    2. 發送 `party.idle_warning` 給隊長、成員與隊伍房間
    3. 若隊長個人通知目標查詢失敗，仍發送成員與隊伍房間通知並標記已提醒，避免同一筆 stale party 每輪重複卡住
    4. 若 immediate 索引缺失，讀取 fallback 會掃描 `party:data:*` 並修補 `party:list:immediate*`
  - 快速隊伍：
    - 沿用同一個 1 小時門檻
    - 只發送 `party.idle_warning` 給 HOST participant 的 personal room，payload 帶 `is_quick=true`
    - 若找不到 HOST participant personal room，直接呼叫 ExpireParties 關閉房間，不送 idle warning

第二階段：最後提醒
  - 來源：DB hidden scheduled/immediate rows + Redis immediate cache
  - 條件：
    - `status = 'HIDDEN'`
    - `last_idle_notified_at + 55m <= NOW()`
    - `last_idle_final_notified_at IS NULL`
  - 動作：
    1. 設定 `last_idle_final_notified_at = NOW()`
    2. 再送一次 `party.idle_warning`
    3. payload 會帶 `warning_stage=final`、`close_in_minutes=5`
    4. 快速隊伍最後提醒仍只送給建立者；建立者找不到時直接關閉

第三階段：自動關閉
  - 來源：DB hidden scheduled/immediate rows + Redis immediate cache
  - 條件：
    - `status = 'HIDDEN'`
    - `last_idle_final_notified_at + 5m <= NOW()`
  - 動作：
    1. 呼叫 ExpireParties
    2. status='CLOSED'
    3. 發送 `party.expired`

預設值：
  - 1 小時 → 自動隱藏 + `party.idle_warning`
  - 1 小時 55 分 → 最後提醒 + `party.idle_warning`
  - 2 小時 → 未回應時 CLOSED（總閒置 2 小時）

時機：每 1 分鐘執行一次
```

### 4.4 快取預熱 Worker (Cache Warmer)

```
party cache warmer:

定時（每 5 分鐘）:
  1. 取出熱點清單 Query 的 signatures
  2. 執行對應的 DB Query
  3. 寫入 Redis（新版本號）

每日午夜預熱:
  - 使用 `MIDNIGHT_TIMEZONE` 計算下一次本地午夜，預設 `Asia/Taipei`
  - 到點後執行 `PrewarmScheduledParties`

目的：確保熱點請求命中快取，降低 DB 壓力
```

### 4.5 在線人數統計 Worker

```
online count worker:

每 30 秒:
  1. 計算目前 WebSocket 活躍連線數
  2. 發布 system.online_count { count: N } 事件至 parties:global room
  3. 更新 Redis "stats:online_count" 快取
```

---

## 五、認證中間件流程

### 5.1 JWT 驗證

```
middleware/auth.go:

1. 優先從 Cookie 讀取 `access_token`；若沒有再讀 Authorization Bearer
2. 驗證 access token（簽章 / 過期時間 / revocation）
3. 若 access token 缺失或失效，且 Cookie 內有 `refresh_token`：
   - 驗證 refresh token 是否仍存在於 Redis 白名單
   - 重新載入 actor + current_character
   - 消費舊 refresh token；若已被其他請求消費則回 `401`
   - 簽發新的 access_token / refresh_token cookies
4. 設定 Gin Context：
   c.Set("userID", userID)
   c.Set("isAdmin", isAdmin)
5. next()
```

### 5.2 管理員驗證

```
middleware/admin.go:

1. 從 Context 取得 isAdmin
2. isAdmin=false → 返回 403
3. next()
```

---

## 六、速率限制

```
middleware/rate_limit.go:

基於 IP 的速率限制：
  - 一般 API：60 req/min
  - Auth API：10 req/min
  - 管理員 API：無限制

基於 Redis 的分散式限制（生產環境）
本地記憶體限制（開發環境）
```

---

## 七、資料庫讀寫分離

```
middleware/primary_read_stickiness.go:

寫入操作（POST/PATCH/DELETE）:
  → 主庫（Primary Postgres）

讀取操作（GET）:
  → 從庫（Replica Postgres）

例外 - "Read Stickiness":
  最近 5 分鐘內有寫入的 session → 繼續讀主庫
  (避免主從延遲導致讀到舊資料)
```

---

## 八、請求消毒 (Sanitization)

```
middleware/sanitize.go:

所有 POST/PATCH 請求 body:
  - 使用 bluemonday 過濾 XSS
  - 去除 <script> 及所有 HTML 標籤（僅允許純文字）
  - 對特定欄位（note, title）允許安全 Markdown

party usecase 層額外 sanitize:
  - sanitizeCreatePartyInput()
  - sanitizeUpdatePartyInput()
  - 房間 `note` 使用保留空白版本的 sanitize：移除 HTML/control characters，但不 trim 開頭/結尾空格或空行。
```

---

## 九、Idempotency 機制

```
middleware/idempotency.go:

客戶端可在 Header 加入 Idempotency-Key: {uuid}

處理流程：
  1. 檢查 Redis "idem:{key}" 是否已存在
  2. 已存在 → 直接返回快取的響應（避免重複建立）
  3. 不存在 → 執行請求 → 存儲響應至 Redis (TTL 24h)

適用場景：防止網路重試導致重複建立隊伍/申請
```

---

## 十、聊天功能資料流

```
WebSocket Chat（非持久化，Redis 快取）:

發送訊息:
  1. 客戶端透過 WS 發送 { action: 'chat', room_id: 'party:{id}', content: '...' }
2. API Server / WS Gateway 依 JWT identity 驗證發送者仍是隊伍成員
     - 以 `actor_id` 與目前角色驗證 leader / filled slot 關係
3. Gateway 產生 payload { party_id, sender, content } 與 emitted_at timestamp
     - sender = { kind, id, display_name, character_code, job_class_id, level }
     - sender.id = 當前在隊伍中的 `character_id`
  4. XADD "ws_events" * { room_id, event_type='chat', payload, emitted_at }
  5. WS Stream Consumer 將 chat event 轉譯成 { type:'chat', room_id, payload, timestamp } 並廣播到 party room
  6. 同步 RPush "chat:party:{id}" 保留最近 100 則歷史訊息，並設定 24 小時 TTL
  7. 若為快速隊伍，另外 XADD 同一 chat payload 到可讀聊天的 quick participant personal room；這一步不追加聊天歷史，避免重複訊息

讀取歷史:
  1. 前端呼叫 GET /api/v1/parties/{id}/chat，可用 `limit` 指定最近 1-100 筆（預設 100），後端不回傳 24 小時以前的訊息
  2. 後端再次依 identity 驗證呼叫者仍為隊伍成員
  3. LRange "chat:party:{id}" -limit -1，回傳 { sender, content, timestamp } 陣列
  4. 後續新訊息透過 WS 推送

清除策略:
  - 隊伍解散時：DEL "chat:party:{id}"
  - 訊息歷史：Redis List 僅保留最近 100 則，且最久保留 24 小時
```

---

## 十一、OCR 處理流程

``` 
POST /api/v1/ocr/parse-screenshot:

1. 接收 multipart/form-data `file` 欄位（PNG/JPEG/WEBP，上限 5 MB）
2. 驗證 content-type、檔案大小與 magic bytes
3. 讀入 bytes 後交給 OCR usecase；目前實作以 `DummyScanner` 為行為假設
4. 回傳 `{ success, data }`，其中 `data.members[]` 包含 `game_name`、`job_class_id`、`job_class_name`、`level`、`is_leader`
5. 前端將 `members` 正規化成建立隊伍表單的已填席位資料

POST /api/v1/ocr/presign:
1. 接收 `{ content_type, extension }`
2. 驗證允許的圖片格式
3. 若 storage 未設定回 `503`
4. 回傳 `{ url, object_key }`
```

---

## 十二、統計資料流程

### 12.1 即時統計

```
GET /api/v1/stats/online:
  1. 嘗試從 Redis "stats:online_count" 取得快取值
  2. 若無快取 → 從 WS Hub 計算活躍連線數
  3. 返回 { count: N }
```

### 12.2 管理後台統計

```
GET /api/v1/admin/stats:
  1. AdminOnly middleware 驗證 `is_admin`
  2. Repository 查詢：
     - `actors` 總數 → `total_users`
     - status IN ('RECRUITING','ACTIVE') 的 parties 總數 → `active_parties`
  3. 回傳 `{ data: { total_users, active_parties } }`
```

---

## 十三、NoticeBar 資料流

### 13.1 公開讀取

```
GET /api/v1/notice:
  1. Repository 查詢 admin_notices 取得最新一筆 active notice
     SELECT * FROM admin_notices WHERE is_active=true ORDER BY created_at DESC, id DESC LIMIT 1
  2. 回傳 { data: AdminNotice | null }
     AdminNotice: { id, content, is_active, created_at, updated_at }
  3. Notice 內容為純文字，上限 240 字元
```

### 13.2 前端刷新語義

```
useSystemNotice hook（useAdminDashboard.ts）:
  - staleTime: 0（每次存取均視為過期，確保最快感知到更新）
  - refetchIntervalInBackground: true（背景 Tab 仍持續輪詢）

  輪詢間隔（依 WS 連線狀態動態切換）:
    WS connected    → 60 秒（SYSTEM_NOTICE_CONNECTED_REFETCH_INTERVAL_MS）
    WS disconnected → 15 秒（SYSTEM_NOTICE_FALLBACK_REFETCH_INTERVAL_MS，降低延遲感知）
```

### 13.3 管理員寫入後的前端失效

```
PUT /api/v1/admin/notice / DELETE /api/v1/admin/notice:
  1. Handler 完成寫入後，發布 system.notice.updated 到 public:broadcast room
     payload: { notice: AdminNotice | null }

  2. 前端 WS handler 收到 system.notice.updated 事件後執行（systemEffects.ts）:
     a. setQueryData(adminQueryKeys.systemNotice, payload.notice) → 立即更新 Ticker 顯示
     b. invalidate(adminQueryKeys.systemNotice) → 背景確認 refetch，確保資料一致

  3. 若前端 WS 尚未連線，輪詢間隔（15s）確保最遲 15 秒內感知到更新
```
