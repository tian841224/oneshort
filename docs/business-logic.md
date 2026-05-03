# OneShort 商業邏輯文件 (Business Logic)

> 本文件描述各功能模組的核心商業規則、狀態機與判斷邏輯。

---

## 一、認證模組 (Auth)

### 1.1 登入流程

```
Quick Login Flow:
  1. 前端送出 character_code + pin；首次建立時額外帶 display_name / job_class_id / level
  2. POST /api/v1/auth/quick-login
  3. 後端先以 character_code 查 actor + current character
  4. 若不存在：
     - 建立 actors
     - 建立 primary characters
5. 驗證 actors.pin_hash（4-6 位純數字 PIN；若後端設定 QUICK_LOGIN_PIN_PEPPER，新 hash 會混入 server-side pepper 並保留舊 hash 相容）
6. 更新 actors.last_active_at
7. 簽發 access_token / refresh_token HttpOnly Cookie
  8. 回傳 { actor, current_character }

Discord OAuth Callback Flow:
  1. 前端先呼叫 GET /api/v1/auth/config 取得 client_id / redirect_uri / state
  2. Discord callback 命中 GET /api/v1/auth/discord/callback?code=...&state=...
  3. 後端向 Discord 交換 access token，取得 discord_user_id
  4. 若 actor_auth_links 已存在 discord 綁定：
     - 載入 actor
     - 依 primary / created_at 規則選 current_character
  5. 若未綁定，但 Discord 提供的 character_code 已命中 quick-login actor：
     - 將 Discord link 綁到該 actor
  6. 若完全新用戶：
     - 建立 Discord actor + primary character
  7. 封禁 actor 一律回 403
8. 成功後簽發 access_token / refresh_token HttpOnly Cookie，回傳 { actor, current_character }

Quick Login Check:
  1. GET /api/v1/auth/quick-login/check?code=ABC1234
  2. 正規化 character_code 為大寫後查詢
  3. 回傳 `available` / `requires_pin` / `discord_only`

Discord Link Merge Flow (`POST /api/v1/auth/discord/link` -> `POST /api/v1/auth/discord/link/merge`):
  1. 使用者必須先登入 quick-login / 既有 actor，再從 `/me` 發起 Discord 綁定
  2. `/auth/discord/link` 的 `state` 必須與 `/auth/config` 設定的 `oauth_state` cookie 匹配
  3. 後端先完成 Discord OAuth code exchange，取得 discord_user_id
  4. 若該 Discord 尚未綁定任何 actor，沿用一般 LinkDiscord 成功流程
  5. 若該 Discord 已綁在目前 actor，也沿用一般成功流程
  6. 若該 Discord 綁在別的 actor：
     - 目前登入 actor 視為 `target actor`
     - 原 Discord actor 視為 `source actor`
  7. 後端先做 merge preflight，檢查 target/source 任一方是否：
     - `actors.is_banned = true`
     - 仍在 `RECRUITING` / `ACTIVE` 隊伍中擔任隊長或隊員
     - 有 `PENDING` party application
     - 有未過期 `activity_presence_locks`
  8. 若有 blocker：
     - `POST /auth/discord/link` 回 `409 discord_merge_blocked`
     - details 內帶 `blockers[] + target_actor_summary + source_actor_summary`
  9. 若可合併：
     - `POST /auth/discord/link` 回 `409 discord_merge_required`
     - details 內帶一次性 `merge_token`、TTL、target/source summary 與 warnings
  10. 前端顯示合併確認；使用者確認後呼叫 `POST /auth/discord/link/merge`
  11. confirm 時後端重新跑一次 preflight，避免 preflight/confirm 之間狀態改變
  12. 合併 transaction 內會：
      - 將 source 全部 characters 改掛到 target
      - 搬移 Discord link、notifications、bug_reports
      - 保留 target 的 actor id、目前 session、目前 primary/current character、quick-login PIN
      - 將搬入角色的 `is_primary` 設為 false；只有 target 原本沒有 active character 時才補選 primary
      - 清空 source.pin_hash，但保留 source actor row
  13. 成功後重簽 target access_token / refresh_token，前端以 `{ actor, current_character }` 更新目前 session
```

### 1.2 Token 機制

- **Access Token**: JWT 攜帶 `actor_id`、`character_id`、`character_code`、`display_name`、`job_class_id`、`level`、`linked_providers`、`login_method`、`is_admin`
- **Refresh Token**: 不對外提供 refresh API；protected API middleware 會在 access token 過期且 refresh token 仍有效時自動輪替 session。每個 refresh token JTI 僅能成功輪替一次；重新載入 session 後，後端會先消費舊 refresh token，再簽發新的 access / refresh token。
- **登出**: `POST /api/v1/auth/logout` 將 access token 的 `jti` 加入 Redis 黑名單並清除 cookie
- **PIN 防爆破**: Redis `auth:pin_fail:{actor_id}`，15 分鐘窗內連續 5 次失敗後回 `429 too_many_attempts`
- **linked_providers**:
  - `quick_login` 代表 `actors.pin_hash IS NOT NULL`
  - `discord` 代表 `actor_auth_links(provider='discord')` 存在
- **Discord merge token**:
  - Redis key: `auth:discord_merge:{token}`
  - TTL: 5 分鐘
  - 一次性 `GetDel` 消費；過期或重放回 `400 invalid_merge_token`

### 1.3 中間件驗證

每個需認證的 API 請求：
```
1. 優先從 Cookie 讀 access_token，回退支援 Authorization: Bearer
2. 解析 JWT，驗證簽章、過期時間與 revoked token key
3. 注入 actor/session claims：
   - actor_id
   - character_id
   - linked_providers
   - login_method
   - is_admin
4. 向後相容：
   - ContextKeyUserID 仍填 actor_id
   - RequireDiscordUser() 目前改成檢查 linked_providers 是否包含 discord
5. 舊 guest token / request context 已退場；Quick Login 也以 actor + current character claims 執行
```

---

## 二、隊伍模組 (Party)

### 2.1 隊伍類型

| 類型 | 代碼 | 說明 | 特殊權限 |
|------|------|------|---------|
| Boss 討伐 | `BOSS` | 即時或預約討伐 Boss | 無 |
| 訓練地圖 | `TRAINING` | 地圖練功，需選擇 GameMap | 無 |
| 組隊活動 | `GROUP` | 自由組隊；前端會從預設組隊任務清單選擇任務，後端以 `raid_boss_options.id` 儲存參照，API 回傳顯示名稱到 `target_name` | 無 |

### 2.2 隊伍狀態機

```
RECRUITING
  ├─ 人數達上限 → ACTIVE
  ├─ 閒置 1 小時 → 自動改為 HIDDEN 並發送 party.idle_warning
  ├─ 超過 recruit_until → EXPIRED
  ├─ 隊長手動隱藏 → HIDDEN
  └─ 隊長解散 → DISBANDED

ACTIVE
  ├─ 有空位 → RECRUITING
  ├─ 閒置 1 小時 → 自動改為 HIDDEN 並發送 party.idle_warning
  ├─ 超過 active_until → EXPIRED
  ├─ 隊長手動隱藏 → HIDDEN
  └─ 隊長解散 → DISBANDED

HIDDEN
  ├─ 任一現有成員確認仍在（自動隱藏）→ RECRUITING / ACTIVE
  ├─ 隊長重新顯示（手動隱藏）→ RECRUITING / ACTIVE
  ├─ 自動隱藏後 55 分鐘仍無活動 → 發送最後提醒
  ├─ 最後提醒後 5 分鐘仍無活動 → CLOSED
  └─ 隊長解散 → DISBANDED

CLOSED
  └─ 唯讀查詢，不可再修改
```

**狀態說明**:
- `RECRUITING`: 對外公開招募，可被搜尋
- `ACTIVE`: 滿員，仍公開顯示
- `HIDDEN`: 從公開搜尋移除的進行中隊伍，可能來自隊長手動隱藏，或系統在閒置 1 小時後自動隱藏
- `EXPIRED`: `recruit_until` 過期，系統自動設定
- `CLOSED`: 最終關閉狀態，只供查詢，不可重新顯示或修改
- `DISBANDED`: 隊長主動解散

**可見性規則**:
- 對外搜尋只顯示 `RECRUITING` 和 `ACTIVE` 狀態的隊伍
- `HIDDEN`, `EXPIRED`, `CLOSED`, `DISBANDED` 均不對外可見
- `我的隊伍` 會保留目前仍為 `HIDDEN` 的隊伍，以及最近 24 小時內的 `CLOSED` / `DISBANDED`

### 2.3 隊伍建立邏輯

```
CreateParty:
  1. sanitizeCreatePartyInput()  → XSS 過濾、去除多餘空白
  2. 檢查隊伍類型與目標欄位組合是否合法
  3. 驗證目前 actor 與隊長角色：
     - `leader_character_id` 必填
     - 隊長角色必須通過所有權驗證 (charVerify.VerifyOwnership)
  4. 驗證 `slots`：
     - 至少 1 格、最多 6 格
     - `max_members` 必須等於 `len(slots)`；slot 本身就是容量
     - 隊長可預填自己擁有的角色
     - 同一角色不可出現在多個席位
  5. 驗證預填席位的角色所有權
  6. 驗證密碼邏輯：
     - join_requires_password=true → join_password 必須提供
     - join_requires_password=false → 清除 join_password
  6.1 `allow_quick_login_players`：
     - 若 request 未提供，預設補成 `true`
  7. 驗證時序：recruit_until <= active_until
  8. 解析目標參照：
     - BOSS / GROUP：優先使用 `target_option_id`，否則以 `target_name` 回查 `raid_boss_options`
     - TRAINING：優先使用 `target_map_id`，否則以 `target_name` 回查 `maps`
     - DB 內部會把參照 ID 寫入 `parties.target_name`，Response 再解析回顯示名稱
  9. 儲存至 DB (CreateParty + CreateSlots in transaction)
     - `current_members` 由已填席位推導
     - `max_members` 為唯讀衍生值，等於目前 slot 數
     - `revision=1`
  10. 將 party_id 加入 Redis ZSET "party_expiry"（score=recruit_until ms）
  11. Bump 版本化快取版本號
```

### 2.4 隊伍時間窗口

| 欄位 | 說明 |
|------|------|
| `scheduled_at` | 活動預計開始時間（null = 立即開始） |
| `recruit_until` | 招募截止時間（自動設為 now+ACTIVITY_VISIBILITY_DURATION 或 scheduled_at+ACTIVITY_VISIBILITY_DURATION；預設 1 小時） |
| `active_until` | 隊伍有效期限（自動設為 now+24h 或 scheduled_at+24h） |

**Sliding Expiration**: 會延長招募生命週期的成員操作（申請、接受、席位/隊伍內容變更等）→ `recruit_until` 自動延長至 now+ACTIVITY_VISIBILITY_DURATION（預設 1 小時）；拒絕申請與申請者自行取消不延長，避免無實質活動的隊伍變成殭屍招募。

### 2.5 申請/加入流程

```
Apply (申請加入):
  1. 驗證 actor：
     - `character_id` 必填，需通過角色所有權驗證
  2. 取得隊伍資訊
     - 若 `allow_quick_login_players=false`，且 actor `linked_providers` 只有 `quick_login`、未綁 `discord` → 直接拒絕
  3. 密碼驗證（若需要）：
     - 隊長帳號擁有者免密碼
     - 其他人需提供正確密碼（比對明文）
  4. 驗證申請位置與空缺：
     - `target_slot_id` 僅代表申請者偏好的位置，不保證最終一定分配到該格
     - `target_slot_id` 若存在，必須屬於該隊伍
     - 角色必須至少符合一個目前可用的 slot（`job_class`、`min_level`、`max_level` 全部符合）才可送出申請
     - 只允許使用「目前已存在且未填滿」的顯式 slot；不可依剩餘容量動態建立 on-demand slot
  5. 判斷是否需人工審核：
     a. join_requires_approval=true → 建立 PENDING 申請，等待隊長審核
     b. join_requires_approval=false → 建立申請 + 立即 AutoAccept
        - 如果是立即活動 (scheduled_at=null 或已過) → 對申請角色套用 activity_presence_locks
        - AutoAccept → 依目前所有相容空缺重新選出最佳 slot，並將 `party_applications.target_slot_id` 更新為實際分配的 slot
        - AutoAccept → 申請者其他所有 PENDING 申請會被自動取消並通知
        - AutoAccept → 寫入 `filled_by`
        - AutoAccept → 其他原本指向該實際 slot 的 PENDING 申請，會依 `created_at ASC` 重新判斷是否還有其他相容空位
           - 有相容空位 → 保留 `PENDING`，並改寫 `target_slot_id`
           - 無相容空位 → 自動取消並通知
  6. 刷新 recruit_until (Sliding Expiration)
  7. Bump 快取版本
```

**排他鎖邏輯**:
- 角色透過 `activity_presence_locks` 保證一次只能參與一個「進行中」活動
- 預約活動（scheduled_at 在未來）不佔用排他鎖
- 接受申請時若 actor 已在其他活動 → 返回 `ErrActivityConflict`

### 2.6 審核申請

```
ReviewApplication (隊長操作):
  1. 驗證申請存在且屬於此隊伍
  2. 驗證操作者為隊長；若為自動配對生成的公會隊伍 (`visibility=GUILD` 且 `generated_by_match=true`)，公會 LEADER/OFFICER 也可審核
  3. 確認隊伍非 CLOSED/DISBANDED
  4. action=accept:
     - 若為進行中活動 → 對 applicant character 套用排他鎖
     - AcceptApplication → 從「目前所有未填且相容」的 slot 中選出最佳位置
       1. 明確 `job_class` 匹配優先於無職業限制
       2. 等級區間較窄優先
       3. `is_required=true` 優先
       4. `slot_order` 較小優先
     - AcceptApplication → 更新實際 slot：
       - applicant → `is_filled=true`, `filled_by=character_id`
     - AcceptApplication → 將 `party_applications.target_slot_id` 改寫成實際分配到的 slot
      - 取消申請者的其他所有 PENDING 申請 + 通知
      - 其他原本指向該實際 slot 的 PENDING 申請，會依 `created_at ASC` 重新判斷是否還有其他相容空位
        1. 有相容空位 → 保留 `PENDING`，並改寫 `target_slot_id`
        2. 無相容空位 → 自動取消並通知
     - 刷新 recruit_until
  5. action=reject:
     - RejectApplication → status=REJECTED
     - 不刷新 recruit_until（拒絕不代表隊伍有新活動）
```

### 2.7 踢出/離開隊伍

```
KickSlotMember:
  1. 驗證操作者為隊長 OR 操作者擁有該席位 snapshot（自願離開）
     - 若為自動配對生成的公會隊伍，公會 LEADER/OFFICER 可視為管理者執行踢出；手動公會隊伍與公開隊伍不套用此放寬
     - 隊長只能踢出其他成員，不可透過此流程移除自己的隊長角色
     - 隊長若要結束隊伍，需改用解散隊伍流程
     - `filled_by = null`、但 `is_filled = true` 的手動隊員席位，也只能由隊長移除
  2. 確認隊伍非 CLOSED/DISBANDED
  3. 更新 slot.is_filled=false, slot.filled_by=null
  4. 更新 activity_presence_locks（釋放排他鎖）
  5. 更新隊伍 current_members 計數
  6. 根據操作類型重新計算狀態：
     - currentMembers < maxMembers → RECRUITING
     - currentMembers >= maxMembers → ACTIVE
  7. 發送通知事件：
     - 踢出：party.member_kicked → 被踢者個人 room + 隊伍 room
     - 自願離開：party.member_left → 隊長個人 room + 隊伍 room
  8. Bump 快取版本
```

### 2.7A 角色資料同步

```
UpdateCharacter / UpdateCurrentCharacter:
  1. 更新 characters 主表
  2. 發送 internal character.updated 事件
  3. 後台同步刷新所有依賴角色顯示資料的快照：
     - party:data:* 的隊長 / 成員 slot 快照
     - party:apps:* 的 application.character
     - chat:party:* 的 sender snapshot
     - notifications.content 內的角色顯示欄位
  4. 對受影響的個人房間與隊伍房間補發 refresh 事件
```

- 角色名稱、職業、等級、角色代碼一旦更新，隊伍詳情、申請列表、聊天室歷史、通知內容都會同步成最新資料。
- 聊天歷史與通知內容不再保留「當下發送時的角色快照」，而是以最新角色資料為準。

### 2.8 隊伍密碼機制

- **隊長查看**: 可看到原始密碼（供編輯）
- **非成員查看**: 若隊伍有密碼 → GET /parties/:id 返回 403 (ErrPartyPasswordRequired)
- **加入流程**: 
  1. 嘗試不帶密碼 → 若 403 → 提示輸入密碼
  2. 正確密碼儲存在前端 `partyPasswordStore`（localStorage）
- **Channel 欄位**: 非成員/非隊長無法看到 `channel`（遊戲頻道資訊）

### 2.9 閒置警告與自動關閉

```
Worker 生命週期:

1. 第一階段提醒（閒置 1 小時）：
   - status in (RECRUITING, ACTIVE)
   - immediate 隊伍：updated_at 超過 1 小時未更新
   - scheduled 隊伍：scheduled_at 與 updated_at 都超過 1 小時未更新
   → status = HIDDEN
   → last_idle_notified_at = now
   → 發送 party.idle_warning 給全隊

2. 確認仍活躍：
   - 任一現有成員 POST /parties/:id/liveness
   - 若為閒置自動隱藏的 HIDDEN → 恢復為 RECRUITING / ACTIVE
   - 若為隊長手動隱藏的 HIDDEN → 維持 HIDDEN
   → 清除 last_idle_notified_at / last_idle_final_notified_at，重置 updated_at
   → 下次重新從「閒置 1 小時自動隱藏」開始計時

   閒置提醒按鈕的過期操作（例如別人已先解散、離開或確認）：
   - 視為 stale/no-op，而不是使用者可見錯誤
   - 後端會回 `PARTY_IDLE_ACTION_NOT_FOUND` / `PARTY_IDLE_ACTION_ALREADY_CLOSED` / `PARTY_IDLE_ACTION_NOT_PARTICIPANT`
   - 只有真實的「隊伍不存在 / 已關閉 / 呼叫者不再是成員」才會回上述 code；repository/DB 讀取失敗仍視為 500 伺服器錯誤
   - 前端收到這些 code 時應靜默完成 UI 收尾；只有非 allowlist 的失敗才算真正異常

3. 最後提醒：
   - status = HIDDEN
   - last_idle_notified_at 超過 55 分鐘
   - last_idle_final_notified_at 尚未設定
   → 再送一次 party.idle_warning
   → payload.warning_stage = "final"
   → payload.close_in_minutes = 5
   → 記錄 last_idle_final_notified_at

4. 最終關閉：
   - status = HIDDEN
   - last_idle_final_notified_at 超過 5 分鐘
   → status = CLOSED
   → 發送 party.expired
```

**預設時間**:
- 第一次提醒並自動隱藏：閒置 1 小時
- 最後提醒：閒置 1 小時 55 分
- 自動關閉：總閒置 2 小時

---

## 三、席位管理 (Slots)

### 3.1 席位規則

- 每個隊伍最多 **6 個席位**（ErrMaxSlotsReached）
- `slot` 本身就是容量；`max_members` 為唯讀衍生值，永遠等於 `len(slots)`
- `current_members` 代表實際隊伍人數，由所有 `is_filled=true` 的席位推導；隊長必須永遠佔用其中一格
- 席位新增、更新、刪除與完整隊伍 snapshot 編輯預設只有隊長可操作；自動配對生成的公會隊伍額外允許公會 LEADER/OFFICER 管理
- 席位可設定：職業(job_class)、等級範圍(min/max_level)、是否必填(is_required)
- 席位可預填（建立時 `filled_by` 即指定角色）
- 隊長可直接把自己擁有的角色指定到空 slot，不必先建立 pending application
- 當 `filled_by` 有值時，後端會將該席位視為已填入成員，不接受 `filled_by != null` 且 `is_filled = false` 的半完成狀態
- 編輯畫面儲存使用完整 snapshot（`PUT /parties/:id`）與 `revision`；任何 party / slot / member 狀態變動都必須遞增 `revision`
- 席位刪除條件：必須先踢出該席位成員
- `CLOSED` / `DISBANDED` 隊伍不可新增、更新、刪除或踢出 slot 成員

### 3.2 席位填充狀態

| 欄位 | 說明 |
|------|------|
| `is_filled` | 是否已填充 |
| `filled_by` | 填充此席位的角色 ID |
| `filled_by_name/code/job/level` | 填充者的展示資訊（Enriched fields） |

### 3.3 編輯隊伍的版本衝突規則

```
ReplaceParty (`PUT /parties/:id`):
  1. 前端送出完整 party snapshot + `revision`
  2. 既有 slot 要附帶 `base`，表示使用者開始編輯時看到的 slot 狀態
  3. 刪除既有 slot 時，要改放進 `deleted_slots[]`，讓後端能比較刪除前看到的舊狀態
  4. 後端比對目前 server slots 與 client `base`
     - 只有版本漂移、但沒有撞到硬衝突 → 回 `party revision conflict`
     - 若偵測到硬衝突 → 回 `PARTY_SLOT_CONFLICT`
```

**目前定義為硬衝突的情況**：
- `member_joined_while_editing_slot`
  - 使用者正在改某格 slot 的限制/內容，但該格在同期間被新成員填入
- `member_changed_while_editing_slot`
  - 使用者正在改某格 slot，而該格原本的佔位狀態在同期間被換人
- `member_joined_while_deleting_slot`
  - 使用者打算刪掉某格 slot，但該格在送出前已被新成員佔用

**衝突處理原則**：
- 一般 stale revision：允許前端刷新最新 detail 後，若 editable snapshot 未變，可自動以新 `revision` 重送一次
- 硬衝突：不可自動覆蓋或自動重送；前端必須先同步最新 `party`，再要求隊長重新確認衝突格
- 像是「某成員離開，slot 變空」這類沒有與本次 slot 結構修改互撞的情況，不屬於硬衝突

---

## 四、通知模組 (Notifications)

### 4.1 通知觸發事件

下列事件會觸發持久化通知（寫入 `notifications` 表）：

| 事件 | 通知對象 | 連結 |
|------|---------|------|
| `party.application_created` | 隊長 | `/?tab=MY_PARTY&party={id}` |
| `party.application_accepted` | 申請者 | `/?tab=MY_PARTY&party={id}` |
| `party.application_rejected` | 申請者 | `/?tab=MY_PARTY&party={id}` |
| `party.application_auto_cancelled` | 申請者 | `/?tab=MY_PARTY&party={id}` |
| `party.expired` | 隊長+全體成員 | `/?tab=MY_PARTY&party={id}` |
| `party.idle_warning` | 隊長+全體成員 | `/?tab=MY_PARTY&party={id}` |
| `party.member_joined` | 隊長 | `/?tab=MY_PARTY&party={id}` |
| `party.member_left` | 隊長 | `/?tab=MY_PARTY&party={id}` |
| `party.member_kicked` | 被踢者 | `/?tab=MY_PARTY&party={id}` |
| `party.disbanded` | 全體成員 | `/?tab=MY_PARTY&party={id}` |
| `party.status_changed` | 全體成員 | `/?tab=MY_PARTY&party={id}` |

### 4.2 通知生命週期

- 初始狀態：`is_read=false`
- 使用者標記已讀：`PATCH /api/v1/notifications/{id}/read`
- 全部標記已讀：`PATCH /api/v1/notifications/read-all`
- 刪除已讀通知：`DELETE /api/v1/notifications/{id}` 或 `/delete-all-read`
- 未讀數量：`GET /api/v1/notifications/unread-count`

---

## 五、已移除模組

- `guild/raid` 模組已於 quick-login parity phase4 從前後端與文件移除。
- `raid_boss_options` 仍保留，僅作為 `BOSS` / `GROUP` 隊伍的目標選項資料來源。

---

## 六、活動排他鎖 (Activity Exclusion)

### 6.1 排他鎖規則

```
Character:
  activity_presence_locks 表
    character_id → activity_id + activity_type

JoinActivity:
  - 同一 actor 只能有一個進行中活動
  - 若已在其他活動 → 返回 ErrActivityConflict

LeaveActivity:
  - 釋放對應排他鎖

CancelPendingRequests:
  - 接受或 auto-accept 後，自動取消該 actor 在其他隊伍的 PENDING 申請
  - 對每個被取消的申請，送出個人通知並持久化到 `notifications`
```

### 6.2 預約活動例外

- `scheduled_at` 在未來 → 加入時**不**佔用排他鎖
- `is_scheduled=true` 的 activity_lock 記錄標記為預約
- 活動開始時才轉為正式佔用

---

## 七、管理員功能 (Admin)

### 7.1 管理員判斷

- `actors.is_admin=true` → 具有管理員權限
- 管理員 API 需通過 `is_admin` 中間件驗證

### 7.2 管理員操作

- **查看統計**: 用戶數、角色數、隊伍數、每日活躍等
- **封禁 actor**: `POST /api/v1/admin/banlist`
- **查看隊伍列表**: 包含 HIDDEN 狀態（`include_closed=true`）
- **強制關閉隊伍**: 直接設定 status

---

## 八、OCR 截圖功能

- 使用者可上傳遊戲截圖
- 後端進行 OCR 掃描，自動識別角色代碼/等級等資訊
- 識別結果回傳前端，協助填寫角色資訊

---

## 九、Bug 回報功能

- 使用者可提交 Bug 報告
- `POST /api/v1/bug-reports`
- 儲存至 `bug_reports` 表
- 欄位包含 `title`、`description`、選填 `contact`；目前正式路由註冊在 public group，通常不要求登入
