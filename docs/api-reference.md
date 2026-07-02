# OneShort API 參考文件 (API Reference)

> 完整 API 端點列表、請求格式、回應格式與錯誤碼說明。
> 詳細 OpenAPI 規格請見 `backend/docs/swagger.yaml`。

---

## 認證說明

所有需認證的 API 會優先使用 Cookie 中的 `access_token`。登入成功後後端會同時設定 `access_token` 與 `refresh_token`：
- `access_token`：15 分鐘有效
- `refresh_token`：7 天滑動有效期；只要使用者持續有活動且未主動登出，後端會在 access token 失效時自動續期

前端不需要、也不應呼叫顯式 `/auth/refresh` 端點；受保護 API 會由後端 middleware 依 cookie 自動輪替 session。

---

## 一、認證 (Auth)

### GET /api/v1/auth/config
取得 Discord OAuth2 設定（Client ID, Redirect URI）

**Response 200:**
```json
{
  "client_id": "123456789",
  "redirect_uri": "https://app.example.com/auth/discord/callback"
}
```

---

### POST /api/v1/auth/quick-login
Quick Login 建立 / 回訪登入

成功後會同時設定 `access_token` 與 `refresh_token` cookies。

**Request：首次建立**
```json
{
  "character_code": "ABC1234",
  "display_name": "新手練等中",
  "job_class_id": 3,
  "level": 180,
  "pin": "1234"
}
```

**Request：回訪登入**
```json
{
  "character_code": "ABC1234",
  "pin": "1234"
}
```

**Response 200**
```json
{
  "actor": {
    "id": "uuid",
    "is_admin": false,
    "is_banned": false,
    "linked_providers": ["quick_login", "discord"]
  },
  "current_character": {
    "id": "uuid",
    "actor_id": "uuid",
    "name": "新手練等中",
    "character_code": "ABC1234",
    "job_class_id": 3,
    "level": 180,
    "is_primary": true
  }
}
```

**錯誤碼**
- `401 invalid_pin`
- `403 account_banned`
- `409 character_code_taken`
- `409 discord_only`
- `422 validation_failed`
- `429 too_many_attempts`

---

### GET /api/v1/auth/quick-login/check?code=ABC1234
檢查角色代碼狀態

**Response 200**
```json
{ "status": "available" }
```

`status` 可能值：
- `available`
- `requires_pin`
- `discord_only`

---

### GET /api/v1/auth/discord/callback
Discord OAuth callback，登入或綁定 actor

成功後會同時設定 `access_token` 與 `refresh_token` cookies。

**Query**
- `code`：required
- `state`：required（需與 `/auth/config` 回傳 cookie 匹配）

**Response 200**
```json
{
  "actor": {
    "id": "uuid",
    "is_admin": false,
    "is_banned": false,
    "linked_providers": ["discord"]
  },
  "current_character": {
    "id": "uuid",
    "actor_id": "uuid",
    "name": "角色名稱",
    "character_code": "ABC1234",
    "job_class_id": 5,
    "level": 200,
    "is_primary": true
  }
}
```

---

### POST /api/v1/auth/logout
登出（撤銷 access token / refresh token，並清除 auth cookies）

**Response 200:** `{ "message": "logged out" }`

---

### GET /api/v1/auth/me
### GET /api/v1/actors/me
取得當前 session；`/auth/me` 為相容路徑，Phase 2 canonical 路徑為 `/actors/me`

若 `access_token` 已過期但 `refresh_token` 仍有效，後端會先自動續期再回傳 session。

**Response 200:**
```json
{
  "actor": {
    "id": "uuid",
    "is_admin": false,
    "is_banned": false,
    "linked_providers": ["quick_login", "discord"]
  },
  "current_character": {
    "id": "uuid",
    "actor_id": "uuid",
    "name": "PlayerName",
    "character_code": "ABC1234",
    "job_class_id": 5,
    "level": 200,
    "is_primary": true
  }
}
```

---

### POST /api/v1/auth/discord/link
綁定 Discord 到目前 actor

`state` 為必填，且必須與 `/auth/config` 設定的 `oauth_state` cookie 匹配。

**Request**
```json
{
  "code": "discord_oauth2_code",
  "state": "oauth_state"
}
```

**Response 200**：同 `{ actor, current_character }`

**Response 409 - `discord_merge_required`**
```json
{
  "error": {
    "code": "discord_merge_required",
    "message": "Discord account can be merged into the current account.",
    "details": {
      "merge_token": "opaque-token",
      "expires_in": 300,
      "target_actor_summary": {
        "actor_id": "uuid",
        "has_quick_login": true,
        "has_discord": false,
        "is_banned": false,
        "characters": [
          {
            "id": "uuid",
            "actor_id": "uuid",
            "name": "目前角色",
            "character_code": "ABC1234",
            "job_class_id": 3,
            "level": 200,
            "is_primary": true
          }
        ],
        "current_character": {
          "id": "uuid",
          "actor_id": "uuid",
          "name": "目前角色",
          "character_code": "ABC1234",
          "job_class_id": 3,
          "level": 200,
          "is_primary": true
        }
      },
      "source_actor_summary": {
        "actor_id": "uuid",
        "has_quick_login": true,
        "has_discord": true,
        "is_banned": false,
        "characters": [
          {
            "id": "uuid",
            "actor_id": "uuid",
            "name": "舊 Discord 角色",
            "character_code": "SRC1234",
            "job_class_id": 4,
            "level": 190,
            "is_primary": true
          }
        ]
      },
      "warnings": [
        "合併不會自動清理隊伍、申請或活動鎖。",
        "來源帳號的其他登入能力會被移除。"
      ]
    }
  }
}
```

**Response 409 - `discord_merge_blocked`**
```json
{
  "error": {
    "code": "discord_merge_blocked",
    "message": "Discord account merge is blocked.",
    "details": {
      "blockers": [
        {
          "type": "party_leader_active",
          "actor_scope": "target",
          "character_id": "uuid",
          "character_name": "目前角色"
        }
      ],
      "target_actor_summary": { "actor_id": "uuid", "has_quick_login": true, "has_discord": false, "is_banned": false, "characters": [] },
      "source_actor_summary": { "actor_id": "uuid", "has_quick_login": true, "has_discord": true, "is_banned": false, "characters": [] }
    }
  }
}
```

`blockers[].type` 固定可能值：
- `actor_banned`
- `party_leader_active`
- `party_member_active`
- `pending_application`
- `activity_lock_active`

---

### POST /api/v1/auth/discord/link/merge
確認把已綁定該 Discord 的 `source actor` 合併到目前登入的 `target actor`

**Request**
```json
{
  "merge_token": "opaque-token"
}
```

**Response 200**：同 `{ actor, current_character }`

**錯誤碼**
- `400 invalid_merge_token`
- `401 unauthorized`
- `409 discord_merge_blocked`

---

### DELETE /api/v1/auth/discord/link
解除目前 actor 的 Discord 綁定

**Response 200**
```json
{
  "actor": {
    "id": "uuid",
    "is_admin": false,
    "is_banned": false,
    "linked_providers": ["quick_login"]
  }
}
```

---

### PUT /api/v1/actors/me/pin
更新 quick-login PIN

PIN 僅允許 4-6 位數字。

**Request**
```json
{
  "current_pin": "1234",
  "new_pin": "5678"
}
```

**Response 200**
```json
{ "message": "PIN updated." }
```

---

### PUT /api/v1/actors/me/current-character
更新目前角色資料，或切換目前/主要角色

**Request**
```json
{
  "character_id": "uuid",
  "display_name": "新名稱",
  "job_class_id": 5,
  "level": 180
}
```

`character_id` 可單獨傳入，用來將同帳號下的 active 角色設為目前/主要角色；成功後後端會重簽 session cookies。

**Response 200**
```json
{
  "current_character": {
    "id": "uuid",
    "actor_id": "uuid",
    "name": "新名稱",
    "character_code": "ABC1234",
    "job_class_id": 5,
    "level": 180,
    "is_primary": true
  }
}
```

---

## 二、隊伍 (Parties)

### GET /api/v1/parties
取得隊伍清單（支援篩選）

**Query Parameters:**

| 參數 | 型別 | 說明 |
|------|------|------|
| `type` | string | `BOSS` / `TRAINING` / `GROUP` |
| `target_name` | string | 依顯示名稱搜尋目標 / 任務 / 地圖（模糊比對） |
| `job_class` | string | 職業篩選 |
| `min_level` | int | 最低等級 |
| `status` | string | `RECRUITING` / `ACTIVE` |
| `time_scope` | string | `NOW` / `UPCOMING` / `ALL_ACTIVE`（預設：`NOW`）。`NOW` 只回傳仍在進行中的活動，不含 `CLOSED` / `DISBANDED` 唯讀快照 |
| `requires_password` | bool | 是否有密碼 |
| `requires_approval` | bool | 是否需審核 |
| `is_leader` | bool | 只顯示我是隊長的 |
| `is_participant` | bool | 只顯示我參與的 |
| `include_closed` | bool | 我的隊伍 / 歷史查看模式下，於 `ALL_ACTIVE` 視圖額外包含 `HIDDEN` 與最近 24 小時內的 `CLOSED` / `DISBANDED`；不影響 `NOW` 進行中活動判斷 |
| `limit` | int | 分頁大小（預設 20，最大 100） |
| `offset` | int | 分頁偏移 |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "leader_id": "uuid",
    "leader_user_id": "uuid",
    "revision": 3,
    "type": "BOSS",
    "title": null,
    "target_option_id": "uuid",
    "target_name": "奧丁",
    "channel": "",
    "note": "需要 200 等以上",
    "max_members": 4,
    "current_members": 2,
    "min_level": 200,
    "status": "RECRUITING",
    "scheduled_at": null,
    "recruit_until": "2024-01-01T12:00:00Z",
    "active_until": "2024-01-02T11:00:00Z",
    "join_requires_password": false,
    "join_requires_approval": true,
    "allow_quick_login_players": true,
    "created_at": "2024-01-01T11:00:00Z",
    "updated_at": "2024-01-01T11:00:00Z",
    "slots": [
      {
        "id": "uuid",
        "party_id": "uuid",
        "job_class": "WARRIOR",
        "min_level": 200,
        "max_level": null,
        "note": null,
        "is_required": true,
        "is_filled": true,
        "filled_by": "char_uuid",
        "filled_by_user_id": "actor_uuid",
        "filled_by_name": "PlayerName",
        "filled_by_code": "ABC123",
        "filled_by_job": "WARRIOR",
        "filled_by_level": 200,
        "slot_order": 1
      }
    ]
  }
]
```

說明：
- `target_name` 為 API 顯示名稱；後端會依資料來源解析，不直接回傳 DB 內部儲存的參照 ID。
- `target_option_id` 會出現在 `BOSS` / `GROUP` 隊伍。
- `target_map_id` 會出現在 `TRAINING` 隊伍。
- `note` 為房間備註；後端會移除 HTML/control characters，但保留使用者輸入的空行、開頭/結尾空格與連續空格。
- `leader_user_id` 與 `filled_by_user_id` 都是 actor id，用於個人 room 與權限判斷。
- 舊版 Guest snapshot 欄位不再出現在正式 API。

---

### POST /api/v1/parties
建立新隊伍 **[需認證]**

**Request Body:**
```json
{
  "leader_character_id": "uuid",
  "type": "BOSS",
  "title": null,
  "target_option_id": "uuid",
  "target_name": "奧丁",
  "channel": "頻道 1",
  "note": "備註說明",
  "max_members": 4,
  "min_level": 200,
  "scheduled_at": null,
  "recruit_until": "2024-01-01T12:00:00Z",
  "active_until": "2024-01-02T11:00:00Z",
  "join_requires_password": false,
  "join_password": null,
  "join_requires_approval": true,
  "allow_quick_login_players": true,
  "slots": [
    {
      "job_class": "WARRIOR",
      "min_level": 200,
      "max_level": null,
      "note": null,
      "is_required": true,
      "filled_by": "char_uuid",
      "is_filled": true,
      "slot_order": 1
    }
  ]
}
```

請求欄位說明：
- `BOSS` / `GROUP` 建議提交 `target_option_id`；`target_name` 可作為相容用途或顯示字串。
- `TRAINING` 建議提交 `target_map_id`；若仍提交 `target_name`，後端會以地圖名稱或 `[code] region - name` 格式回查。
- `max_members` 是唯讀衍生值，建隊時必須等於 `slots.length`；之後由新增/刪除 slot 推導。
- 建立隊伍必須提交 `leader_character_id`，且該角色必須屬於目前 actor。
- `allow_quick_login_players` 若省略，後端預設補為 `true`。
- 若 `allow_quick_login_players=false`，則 `linked_providers` 僅有 `quick_login`、未綁 `discord` 的玩家不可申請加入。

**Response 201:**
```json
{
  "party": { /* Party 物件，含 viewer_capabilities */ },
  "slots": [ /* Slot 陣列 */ ]
}
```

**Error Codes:**
- `400` - 請求格式錯誤
- `500` - 伺服器錯誤

---

### GET /api/v1/parties/:id
取得隊伍詳情 **[需認證]**

**Response 200:** Party 物件（含 slots、enriched 資訊及 `viewer_capabilities`）

- 審核房（`join_requires_approval=true`）對非成員一律可查看（不再要求已送出申請），只是 `channel` 會被清空；密碼房仍優先回 `403`。

**Error Codes:**
- `403` - `{ "code": "PARTY_PASSWORD_REQUIRED", "message": "此隊伍需要密碼才能查看" }`
- `404` - 隊伍不存在

---

### POST /api/v1/parties/:id/verify-password
驗證隊伍密碼 **[需認證]**

**Request Body:**
```json
{ "password": "abc123" }
```

**Response 200:** Party 物件（驗證成功後返回）

**Error Codes:**
- `400` - 密碼格式錯誤
- `403` - `{ "code": "PARTY_INVALID_PASSWORD" }` 密碼不正確

---

### PATCH /api/v1/parties/:id
更新隊伍資訊 **[需認證，隊長]**

**Request Body（所有欄位皆為可選）:**
```json
{
  "type": "BOSS",
  "title": "更新後標題",
  "target_option_id": "uuid",
  "target_name": "新目標",
  "channel": "頻道 2",
  "note": "新備註",
  "min_level": null,
  "scheduled_at": null,
  "scheduled_at_is_now": false,
  "recruit_until": "2024-01-01T14:00:00Z",
  "active_until": "2024-01-02T13:00:00Z",
  "join_requires_password": false,
  "join_password": null,
  "join_requires_approval": true,
  "allow_quick_login_players": true,
  "is_temporarily_closed": false
}
```

PATCH 補充說明：
- 變更 `type` 或目標時，應同步提交新的 `target_option_id` 或 `target_map_id`。
- 回應中的 `target_name` 仍是解析後的顯示名稱。
- `PATCH` 僅用於更新隊伍 metadata 與 `is_temporarily_closed`；不可直接修改 `max_members` 或整體 slots snapshot。

**狀態欄位語意:**
- `is_temporarily_closed=true` → 後端會將隊伍改為 `HIDDEN`
- `is_temporarily_closed=false` → 後端會把 `HIDDEN` 隊伍重新顯示為 `RECRUITING` 或 `ACTIVE`
- `CLOSED` 隊伍為唯讀狀態，不可再透過此 API 修改

**Response 200:** 更新後的 Party 物件

**Error Codes:**
- `400` - 請求格式錯誤
- `403` - 非隊長
- `404` - 隊伍不存在
- `403` - 隊伍已關閉或已解散（read-only）

---

### PUT /api/v1/parties/:id
以完整快照覆蓋編輯隊伍 **[需認證，隊長]**

**Request Body:**
```json
{
  "revision": 3,
  "type": "BOSS",
  "title": "更新後標題",
  "target_option_id": "uuid",
  "target_name": "新目標",
  "channel": "頻道 2",
  "note": "新備註",
  "min_level": null,
  "scheduled_at": null,
  "scheduled_at_is_now": false,
  "recruit_until": "2024-01-01T14:00:00Z",
  "active_until": "2024-01-02T13:00:00Z",
  "join_requires_password": false,
  "join_password": null,
  "join_requires_approval": true,
  "allow_quick_login_players": true,
  "slots": [
    {
      "id": "slot_uuid",
      "job_class": "WARRIOR",
      "min_level": 200,
      "max_level": null,
      "note": null,
      "is_required": true,
      "filled_by": "leader_char_uuid",
      "is_filled": true,
      "slot_order": 1,
      "base": {
        "job_class": "WARRIOR",
        "min_level": 200,
        "max_level": null,
        "note": null,
        "filled_by": "leader_char_uuid",
        "is_filled": true
      }
    },
    {
      "id": "slot_uuid_2",
      "job_class": null,
      "min_level": null,
      "max_level": null,
      "note": null,
      "is_required": false,
      "filled_by": null,
      "is_filled": false,
      "slot_order": 2,
      "base": {
        "job_class": null,
        "min_level": null,
        "max_level": null,
        "note": null,
        "filled_by": null,
        "is_filled": false
      }
    }
  ],
  "deleted_slots": [
    {
      "id": "slot_uuid_3",
      "base": {
        "job_class": null,
        "min_level": null,
        "max_level": null,
        "note": null,
        "filled_by": null,
        "is_filled": false
      }
    }
  ]
}
```

PUT 補充說明：
- 編輯畫面儲存應使用此端點；後端會在單一交易內重建 slots、重算 `current_members` / `max_members`，並回傳最新 `revision`。
- `max_members` 不接受 client 指定；回應值永遠由 `slots.length` 推導。
- 隊長 slot 不可被移除或清空。
- 既有 slot 應提交 `base`，表示使用者開始編輯時看到的 slot 狀態；刪除既有 slot 時，需改放到 `deleted_slots[]`，也帶上對應 `base`。
- 若 `revision` 與目前伺服器版本不符，且只是一般 stale revision，後端回 `409 { "error": "party revision conflict" }`。
- 若 `revision` 衝突同時偵測到 slot 級硬衝突，後端回 `409 PARTY_SLOT_CONFLICT`，前端應先同步最新 `party` 再要求隊長重新確認衝突格。

**Response 200:** 更新後的 Party 物件

**Response 409 (`PARTY_SLOT_CONFLICT`) 範例:**
```json
{
  "code": "PARTY_SLOT_CONFLICT",
  "error": "party slot conflict",
  "party": {
    "id": "uuid",
    "revision": 4,
    "max_members": 2,
    "current_members": 2,
    "slots": []
  },
  "conflicts": [
    {
      "slot_id": "slot_uuid_2",
      "slot_order": 2,
      "type": "member_joined_while_editing_slot",
      "message": "第 2 格在你編輯限制時已有新成員加入，請先確認最新狀態。",
      "server_slot": {
        "id": "slot_uuid_2",
        "is_filled": true,
        "filled_by": "char_uuid"
      }
    }
  ]
}
```

**Error Codes:**
- `400` - 請求格式錯誤 / slot 數超過 6 / 隊長 slot 缺失
- `403` - 非隊長
- `404` - 隊伍不存在
- `409` - `{ "error": "party revision conflict" }` 一般版本衝突
- `409` - `{ "code": "PARTY_SLOT_CONFLICT", "party": ..., "conflicts": [...] }` slot 級硬衝突
- `409` - 隊伍已關閉或已解散（read-only）

---

### POST /api/v1/parties/:id/reopen
重新顯示手動隱藏的隊伍 **[需認證，隊長]**

**說明:**
- 等同於送出 `PATCH /api/v1/parties/:id` 並帶上 `is_temporarily_closed=false`
- 會將 `HIDDEN` 隊伍重新顯示為 `RECRUITING` 或 `ACTIVE`
- 對已是公開狀態的隊伍可視為冪等操作；`CLOSED` 唯讀快照不應依賴此端點恢復

**Response 200:** 更新後的 Party 物件

**Error Codes:**
- `403` - 非隊長
- `404` - 隊伍不存在

---

### DELETE /api/v1/parties/:id
解散隊伍（設為 DISBANDED）**[需認證，隊長]**

**Response 204:** No Content

**Error Codes:**
- `403` - 非隊長
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉或已解散（stale no-op）

---

### DELETE /api/v1/parties/:id/my-membership
退出自己的隊伍 **[需認證，隊伍成員]**

**說明:**
- 隊員呼叫時會離開自己的席位
- 隊長呼叫時等同 `DELETE /api/v1/parties/:id`
- 來自閒置提醒的過期操作會維持靜默 no-op，由前端依 `code` 判斷

**Response 204:** No Content

**Error Codes:**
- `403` - `{ "code": "PARTY_IDLE_ACTION_NOT_PARTICIPANT" }` 呼叫者已不在隊伍中
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉或已解散（stale no-op）

---

### POST /api/v1/parties/quick
建立快速隊伍 **[免登入；登入者與遊客皆可]**

**Request Body:**
```json
{
  "title": "速刷炎魔",
  "note": "缺補",
  "room_type": "OPEN",
  "join_password": "123456",
  "channel": "7",
  "show_channel_on_card": true,
  "guest_display_name": "遊客名稱"
}
```

**說明:**
- `room_type` 必填，`OPEN` / `APPROVAL` / `PASSWORD` 三選一；`PASSWORD` 房需附 `join_password`（最長 6 碼）。
- 未登入呼叫時會建立 quick guest identity（cookie），`guest_display_name` 作為遊客顯示名稱（最長 20 字）。
- 建立者自動成為快速隊伍 HOST participant。

**Response 201:** `QuickPartyResponse`（`{ "party": Party, "viewer_capabilities": {...}, "guest": {...} }`）

**Error Codes:**
- `400` - 請求格式錯誤
- `429` - 建立頻率限制

---

### POST /api/v1/parties/:id/quick-enter
進入快速隊伍 / 取得訪客能力 **[快速隊伍，可使用 quick guest cookie]**

**Request Body:**
```json
{
  "guest_display_name": "遊客名稱",
  "join_password": "123456"
}
```

**說明:**
- `quick-enter` 只建立或更新 quick guest identity，並回傳快速隊伍 detail 與 `viewer_capabilities`。
- OPEN 房呼叫此 endpoint 不會增加隊伍人數、不會自動佔用 slot。
- PASSWORD 房需要正確 `join_password` 才能解鎖檢視；前端可把正確密碼存在 `partyPasswordStore`。
- 是否能讀取/發言聊天室由 `viewer_capabilities.can_read_chat` 決定；visitor / pending guest 不應掛載隊伍聊天室。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - 請求格式錯誤
- `403` - 密碼錯誤 / 無法檢視此快速隊伍
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 隊伍已滿、已關閉或狀態不可進入

---

### POST /api/v1/parties/:id/quick-join
加入快速隊伍或建立快速隊伍申請 **[快速隊伍，可使用 quick guest cookie]**

**Request Body:**
```json
{
  "guest_display_name": "遊客名稱",
  "slot_order": 2,
  "join_password": "123456"
}
```

**說明:**
- `quick-join` 是快速隊伍唯一的加入/申請操作；前端列表預覽的「加入隊伍」與詳情空位列都必須呼叫此 endpoint。
- OPEN 房直接加入最低可用空位；若指定 `slot_order`，該空位必須存在且可用。
- PASSWORD 房需要正確 `join_password`，成功後加入空位並回傳成員能力。
- APPROVAL 房只建立 pending application，不自動佔位，也不應自動導向成員視角。
- 快速隊伍 slot 不支援職業、等級或是否必填條件；加入判斷只看空位是否開啟且未佔用。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - 請求格式錯誤 / 指定 slot order 無效
- `403` - 密碼錯誤 / 無法加入此快速隊伍
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 隊伍已滿、已加入、已有待審申請、已關閉或狀態不可加入

---

### POST /api/v1/parties/:id/quick-leave
離開快速隊伍 **[快速隊伍成員，使用 quick guest cookie 或登入身分]**

**說明:**
- 成員（非 HOST）離開快速隊伍，釋放原本佔用的空位。
- HOST 不可用此 endpoint 離開；請改用 `quick-close` 關閉房間。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `403` - 呼叫者不是此快速隊伍成員
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 隊伍已關閉

---

### GET /api/v1/parties/:id/quick-applications
取得快速隊伍待審申請清單 **[快速隊伍 HOST]**

**Response 200:** `QuickApplication[]`
```json
[
  {
    "id": "uuid",
    "display_name": "申請者名稱",
    "status": "PENDING",
    "slot_order": 2,
    "character": { "id": "uuid", "name": "角色名", "job_class": 1, "level": 200 },
    "created_at": "2026-06-01T12:00:00Z",
    "updated_at": "2026-06-01T12:00:00Z"
  }
]
```

**Error Codes:**
- `403` - 不是快速隊伍 HOST
- `404` - 隊伍不存在或不是快速隊伍

---

### PATCH /api/v1/parties/:id/quick-applications/:appId
審核快速隊伍申請 **[快速隊伍 HOST]**

**Request Body:**
```json
{ "action": "accept" }
```

- `action` 只接受 `accept` / `reject`。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - action 無效
- `403` - 不是快速隊伍 HOST
- `404` - 隊伍或申請不存在
- `409` - 申請已被處理 / 隊伍已滿或已關閉

---

### DELETE /api/v1/parties/:id/quick-applications/me
取消自己的快速隊伍申請 **[使用 quick guest cookie 或登入身分]**

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `404` - 隊伍不存在、不是快速隊伍或沒有待審申請

---

### PATCH /api/v1/parties/:id/quick-settings
更新快速隊伍房間設定 **[快速隊伍建立者 cookie]**

**說明:**
- 只允許快速隊伍房主更新房名、備註、房型、密碼、頻道、是否在卡片顯示頻道等房間設定。
- 不用於更新 slot 條件；快速隊伍不支援隊員條件。
- 既有密碼房未提供 `join_password` 時會保留原密碼。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - 請求格式錯誤
- `403` - 不是快速隊伍房主
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 隊伍已關閉或版本狀態不可更新

---

### PUT /api/v1/parties/:id/quick-settings
取代快速隊伍設定與空位開關 **[快速隊伍建立者 cookie]**

**說明:**
- 只允許快速隊伍房主取代房間設定與空位開關。
- slot payload 只代表空位是否存在/開啟與已佔用狀態；`job_class`、`job_classes`、`min_level`、`max_level`、空位 `note`、`is_required` 不接受作為隊員條件。
- 後端會清除或忽略快速隊伍 slot 條件，並以保留的 slot 數量推導 `max_members`。
- 已佔用 slot 不能透過 settings 直接清空；需沿用 kick/leave flow。
- 取代設定時會保留既有 quick participant 與 occupied slot runtime snapshot，避免登入角色或遊客顯示資料被覆蓋成空資料。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - 請求格式錯誤 / slot 數超過限制 / 嘗試用 settings 清空已佔用 slot
- `403` - 不是快速隊伍房主
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 版本衝突 / 隊伍已關閉或狀態不可更新

---

### POST /api/v1/parties/:id/quick-slots/:slotId/kick
踢出快速隊伍空位上的成員 **[快速隊伍 HOST]**

**說明:**
- 對應一般隊伍的 `POST /parties/:id/slots/:slotId/kick`；快速隊伍必須使用本路徑。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `403` - 不是快速隊伍 HOST
- `404` - 隊伍或 slot 不存在、不是快速隊伍
- `409` - slot 未被佔用或隊伍已關閉

---

### POST /api/v1/parties/:id/quick-close
關閉快速隊伍 **[快速隊伍 HOST]**

**說明:**
- HOST 主動關閉房間；關閉後隊伍進入唯讀狀態，成員與訪客不可再加入或發言。

**Response 200:** `Party`

**Error Codes:**
- `403` - 不是快速隊伍 HOST
- `404` - 隊伍不存在或不是快速隊伍
- `409` - 隊伍已關閉

---

### POST /api/v1/parties/:id/applications
申請加入隊伍 **[需認證]**

**Request Body:**
```json
{
  "character_id": "uuid",
  "target_slot_id": "uuid",
  "join_password": "abc123"
}
```

- `character_id` 必填，且必須屬於目前 actor。
- `allow_quick_login_players=false` 時，只有已綁定 Discord 的 actor 可申請。

**Response 201:**
```json
{
  "id": "uuid",
  "party_id": "uuid",
  "applicant_id": "uuid",
  "target_slot_id": "uuid",
  "status": "PENDING | ACCEPTED",
  "created_at": "...",
  "updated_at": "..."
}
```

`target_slot_id` 代表申請時選擇的偏好位置；若系統在 auto-accept 或隊長接受時改配到其他相容空缺，該欄位會被改寫為實際分配到的 slot。系統只會使用「已存在的顯式空缺」進行分配；若其他 pending 申請原本也指向同一實際 slot，系統會依 `created_at ASC` 重新判斷是否可改配到其他相容空位；找不到就自動取消。

**Error Codes:**
- `409` - 未綁 Discord、只能 quick login 的玩家不被此房間接受（`allow_quick_login_players=false`）
- `403` - 密碼錯誤（`PARTY_INVALID_PASSWORD`）
- `400` - 指定的 `target_slot_id` 不屬於此隊伍
- `409` - 角色已在活動中 / 隊伍已滿 / 非招募中狀態 / 目前沒有任何符合條件的顯式空缺
- `403` - 隊伍已關閉或已解散（不可申請）

---

### GET /api/v1/parties/:id/applications
取得隊伍所有申請 **[需認證，隊長]**

**Response 200:**
```json
[
  {
    "id": "uuid",
    "party_id": "uuid",
    "applicant_id": "uuid",
    "target_slot_id": "uuid",
    "status": "PENDING",
    "character": {
      "id": "uuid",
      "user_id": "uuid",
      "game_name": "PlayerName",
      "character_code": "ABC123",
      "job_class": "WARRIOR",
      "level": 200
    },
    "created_at": "...",
    "updated_at": "..."
  }
]
```

說明：
- 申請以角色為單位；`applicant_id` 為角色 ID。
- `character` 是申請列表的顯示用快照，來源為 `characters`。

---

### GET /api/v1/parties/:id/my-applications
取得我在指定隊伍的待審申請 **[需認證]**

**Response 200:**
```json
[
  {
    "id": "uuid",
    "party_id": "uuid",
    "applicant_id": "uuid",
    "target_slot_id": "uuid",
    "status": "PENDING",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

### GET /api/v1/applications/me
取得我所有待審申請 **[需認證]**

**說明:**
- 回傳目前登入 actor 的所有 pending applications。
- 每筆申請會附帶 `party` 摘要，供前端「我的申請」列表直接渲染，避免先打不存在端點再對每筆申請做 party detail N+1 查詢。

**Response 200:**
```json
[
  {
    "id": "uuid",
    "party_id": "uuid",
    "applicant_id": "uuid",
    "target_slot_id": "uuid",
    "status": "PENDING",
    "party": {
      "id": "uuid",
      "type": "BOSS",
      "title": "每日王團",
      "target_name": "BossName",
      "scheduled_at": null
    },
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

### PATCH /api/v1/parties/:id/applications/:appId
審核申請（接受/拒絕）**[需認證，隊長]**

**Request Body:**
```json
{ "action": "accept" }
// 或
{ "action": "reject" }
```

**Response 200:**
```json
{ "status": "success" }
```

**Side Effects:**
- `accept` 會依 `ACTIVITY_VISIBILITY_DURATION` 刷新 `recruit_until`；`reject` 不刷新。

**Error Codes:**
- `409` - 申請者已在其他活動中（accept 時） / 目前沒有任何相容顯式空位可供分配
- `403` - 隊伍已關閉或已解散（不可審核）

---

### DELETE /api/v1/parties/:id/applications/:appId
取消申請 **[需認證，申請者本人]**

**Response 204:** No Content

**Side Effects:**
- 取消申請不刷新 `recruit_until`。

---

### POST /api/v1/parties/:id/slots/:slotId/kick
踢出席位成員（或自願離開）**[需認證]**

**Response 204:** No Content

**Error Codes:**
- `403` - 非隊長（且非席位成員本人）
- `403` - 隊長不可踢出自己的角色
- `403` - 隊伍已關閉或已解散（不可修改）

---

### POST /api/v1/parties/:id/liveness
確認隊伍仍活躍 **[需認證，隊伍成員]**

**說明:**
- 任一現有成員皆可呼叫，不限隊長
- 會更新 `updated_at` 並清除 `last_idle_notified_at` / `last_idle_final_notified_at`
- 若隊伍是因閒置提醒被自動隱藏，會同步重新顯示為 `RECRUITING / ACTIVE`
- 不會將隊長手動隱藏的 `HIDDEN` 狀態自動重新顯示；若要重新顯示，請使用 `PATCH is_temporarily_closed=false` 或 `POST /parties/:id/reopen`

**Response 200:** `{ "status": "confirmed" }`

**Error Codes:**
- `403` - `{ "code": "PARTY_IDLE_ACTION_NOT_PARTICIPANT" }` 呼叫者已不在隊伍中
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉或已解散（stale no-op）

---

### POST /api/v1/parties/:id/quick-liveness
確認快速隊伍仍活躍 **[快速隊伍建立者 cookie]**

**說明:**
- 快速隊伍沿用一般隊伍閒置流程：1 小時自動隱藏並提醒、1 小時 55 分最後提醒、2 小時自動關閉。
- 此 endpoint 只允許快速隊伍建立者（HOST participant）確認存續。
- 會更新 `updated_at` 並清除 `last_idle_notified_at` / `last_idle_final_notified_at`。
- 若快速隊伍因閒置提醒被自動隱藏，會同步重新顯示為 `RECRUITING / ACTIVE`。

**Response 200:** `{ "status": "confirmed" }`

**Error Codes:**
- `403` - `{ "code": "PARTY_IDLE_ACTION_NOT_PARTICIPANT" }` 呼叫者不是快速隊伍建立者
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉（stale no-op）

---

### GET /api/v1/parties/:id/chat
取得隊伍聊天室歷史 **[隊伍成員；快速隊伍可使用 quick guest cookie]**

- Query `limit` 可指定最近訊息筆數，預設 100，最大 100；聊天歷史最久保留 24 小時。
- 快速隊伍只有隊長與隊員可以讀取聊天室；visitor / pending guest 不能讀取。
- 每筆訊息都會回傳 `character_id`。
- `sender` 為可選欄位，代表當前最新的角色顯示資料；角色改名、改職業、改等級後，歷史訊息中的 `sender` 也會同步更新。

**Response 200:**
```json
{
  "data": [
    {
      "character_id": "char_uuid",
      "sender": {
        "display_name": "角色名稱",
        "character_code": "ABC123",
        "job_class": 1,
        "level": 200
      },
      "content": "Hello!",
      "timestamp": "2026-04-15T12:00:00Z"
    }
  ]
}
```

**Error Codes:**
- `403` - 非隊伍成員 / 非快速隊伍隊長或隊員
- `404` - 隊伍不存在
- `500` - 讀取聊天記錄失敗

---

### POST /api/v1/parties/:id/chat
傳送隊伍聊天訊息 **[隊伍成員；快速隊伍可使用 quick guest cookie]**

**Request Body:**
```json
{ "content": "Hello!" }
```

**說明:**
- 只有隊長與成員（`viewer_capabilities.can_send_chat`）可以發言。
- 訊息寫入聊天歷史並透過 WebSocket `chat` 事件即時推送給訂閱 `party:{id}` 的用戶端。

**Response 201:** 新建的聊天訊息物件（同 GET 之 `data[]` 單筆格式）

**Error Codes:**
- `400` - 內容為空或超過長度限制
- `403` - 無發言權限
- `404` - 隊伍不存在
- `429` - 發言頻率限制

---

### GET /api/v1/actors/me/party-history
取得自己的組隊紀錄 **[需認證]**

- Query `limit`（預設 20，最大 100）、`offset`（預設 0）。
- 回傳目前 actor 以隊長或成員身分參與過的隊伍歷史，供 `/history` 頁使用。

**Response 200:** `{ "data": [ ... ] }`

---

## 三、席位 (Slots)

### POST /api/v1/parties/:id/slots
新增席位 **[需認證，隊長]**

**Request Body:**
```json
{
  "job_class": "MAGE",
  "min_level": 180,
  "max_level": null,
  "note": "需會法術",
  "is_required": false,
  "filled_by": null,
  "is_filled": false,
  "slot_order": 2
}
```

**Response 201:** 新建的 Slot 物件

**Error Codes:**
- `400` - 席位已達上限（6個）
- `400` - 新增後總 slot 數超過 6
- `403` - 隊伍已關閉或已解散（不可修改）

---

### PATCH /api/v1/parties/:id/slots/:slotId
更新席位資訊 **[需認證，隊長]**

**Request Body（所有欄位可選）:**
```json
{
  "job_class": "PRIEST",
  "min_level": 200,
  "max_level": null,
  "note": null,
  "filled_by": "char_uuid",
  "is_filled": true
}
```

**Response 200:** 更新後的 Slot 物件

**Error Codes:**
- `400` - `filled_by` 若存在，必須是隊長擁有、已在隊伍中，或已對此隊伍送出 pending application 的角色
- `403` - 隊伍已關閉或已解散（不可修改）

---

### DELETE /api/v1/parties/:id/slots/:slotId
刪除席位 **[需認證，隊長]**

**Response 204:** No Content

**Error Codes:**
- `409` - 席位有成員，需先踢出
- `409` - 不可刪除隊長目前佔用的席位
- `403` - 隊伍已關閉或已解散（不可修改）

---

## 四、通知 (Notifications)

### GET /api/v1/notifications
取得通知清單 **[需認證]**

- 通知來自 `notifications` 資料表。
- 回傳欄位 `user_id` 代表通知接收者 actor id。

**Query Parameters:**
- `limit` (int, 預設 20)
- `offset` (int, 預設 0)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "party.application_accepted",
      "content": { /* 事件 payload */ },
      "is_read": false,
      "link_url": "/?tab=MY_PARTY&party=uuid",
      "created_at": "..."
    }
  ],
  "total": 15
}
```

---

### GET /api/v1/notifications/unread-count
取得未讀通知數量 **[需認證]**

**Response 200:** `{ "count": 3 }`

---

### PATCH /api/v1/notifications/:id/read
標記通知為已讀 **[需認證]**

**Response 204:** No Content

---

### PATCH /api/v1/notifications/read-all
全部標記為已讀 **[需認證]**

**Response 204:** No Content

---

### DELETE /api/v1/notifications/:id
刪除通知 **[需認證]**

**Response 204:** No Content

---

### DELETE /api/v1/notifications/read-all
刪除所有已讀通知 **[需認證]**

**Response 204:** No Content

---

### GET /api/v1/lobby/chat
取得大廳聊天歷史 **[公開，無需認證]**

- Query `limit` 指定最近訊息筆數（預設 100，最大 100）；聊天歷史最久保留 24 小時。
- 登入者的 `sender` snapshot 會包含 `character_id`、`job_class_id`、`level`；未登入者以「遊客」顯示。

**Response 200:** `{ "data": [聊天訊息] }`

---

### POST /api/v1/lobby/chat
傳送大廳聊天訊息 **[公開，無需認證]**

**Request Body:**
```json
{ "content": "有人要打王嗎？" }
```

**說明:**
- 訊息寫入公開歷史並透過 WebSocket 推送給訂閱大廳頻道的用戶端。
- 頻率限制：未登入者 10 秒 1 則，登入者 5 秒 1 則。

**Response 201:** 新建的聊天訊息物件

**Error Codes:**
- `400` - 內容為空或格式錯誤
- `429` - 發言頻率限制

---

## 五、角色 (Characters)

### GET /api/v1/job-classes
取得職業清單 **[公開]**

**Response 200:** 職業選項陣列

---

### GET /api/v1/characters
取得我的角色列表 **[需認證]**

**Response 200:**
```json
[
  {
    "id": "uuid",
    "actor_id": "uuid",
    "game_name": "PlayerName",
    "character_code": "ABC123",
    "job_class": "WARRIOR",
    "level": 200,
    "is_active": true,
    "created_at": "..."
  }
]
```

---

### POST /api/v1/characters
建立角色 **[需認證]**

**Request Body:**
```json
{
  "game_name": "PlayerName",
  "character_code": "ABC123",
  "job_class": "WARRIOR",
  "level": 200
}
```

**Response 201:** 建立的 Character 物件

欄位限制：
- `game_name` 最多 20 字元。
- `character_code` 最多 7 個英數字元。
- `level` 僅接受 1-200。

**Error Codes:**
- `400 invalid_job_class` - 不支援的職業 ID
- `409 character_code_taken` - 角色代碼已被使用
- `409 game_name_taken` - 角色名稱已被使用
- `500` - 未預期的伺服器錯誤

---

### PATCH /api/v1/characters/:id
更新角色 **[需認證]**

**Response 200:** 更新後的 Character 物件

欄位限制與建立角色相同：`game_name` 最多 20 字元、`character_code` 最多 7 個英數字元、`level` 僅接受 1-200。

更新成功後，後端會非同步同步以下資料中的角色顯示欄位：
- 隊伍詳情與 slot 快照
- 申請快照
- 隊伍聊天室歷史 `sender`
- 通知內容中的角色名稱 / 職業 / 等級

---

### DELETE /api/v1/characters/:id
刪除角色 **[需認證]**

**Response 204:** No Content

---

## 六、封鎖清單 (Blocklist)

### GET /api/v1/blocklist
取得我的封鎖清單 **[需認證]**

**Query Parameters:** `character_id` (uuid, 角色 ID)

**Response 200:** `["uuid1", "uuid2", ...]`（被封鎖的角色 ID 列表）

---

### POST /api/v1/blocklist
封鎖角色 **[需認證]**

**Request Body:**
```json
{
  "blocker_character_id": "uuid",
  "blocked_character_id": "uuid"
}
```

**Response 201:** No Content

---

### DELETE /api/v1/blocklist/:blocked_character_id
解除封鎖 **[需認證]**

**Response 204:** No Content

---

## 七、統計 (Stats)

### GET /api/v1/stats/online
取得在線人數

**Response 200:** `{ "count": 42 }`

---

### GET /api/v1/activity/recent
取得最近活動 **[公開，無需認證]**

- 回傳最近 24 小時內的公開活動事件（隊伍建立、玩家加入），供登入頁活動牆使用。

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kind": "party_created",
      "actor_name": "角色名稱",
      "target_name": "隊伍或 BOSS 名稱",
      "timestamp": "2026-06-01T12:00:00Z"
    }
  ]
}
```

- `kind`：`party_created` / `player_joined` / `boss_cleared`。

---

## 八、系統公告 (Announcements)

### GET /api/v1/announcement
取得主要有效公告 **[公開]**

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "content": "公告內容",
    "is_active": true,
    "priority": 0,
    "created_by": "actor_uuid",
    "updated_by": "actor_uuid",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### GET /api/v1/announcements
取得所有有效公告 **[公開]**

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "content": "公告內容",
      "is_active": true,
      "priority": 0,
      "created_by": "actor_uuid",
      "updated_by": "actor_uuid",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### GET /api/v1/notice
取得 NoticeBar 跑馬燈內容 **[公開]**

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "content": "NoticeBar 文字",
    "is_active": true,
    "created_by": "actor_uuid",
    "updated_by": "actor_uuid",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

## 九、組隊選項

### GET /api/v1/raid-boss-options?type=BOSS|GROUP
取得 BOSS / GROUP 類型可選目標清單

**Response 200:**
```json
{
  "data": [
    {
      "id": "2d3f8f8c-2f69-4ef5-9f51-8de07e145e76",
      "name": "炎魔",
      "is_enabled": true,
      "sort_order": 1,
      "party_type": "BOSS"
    }
  ]
}
```

### GET /api/v1/maps
取得可選地圖清單（TRAINING 類型用）

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "code": "MAP_001",
      "region": "冰雪地帶",
      "name": "冰雪地帶 1"
    }
  ]
}
```

---

## 十、管理員 (Admin)

### GET /api/v1/admin/stats
取得系統統計 **[需認證，管理員]**

**Response 200:**
```json
{
  "data": {
    "total_users": 1000,
    "active_parties": 30
  }
}
```

---

### GET /api/v1/admin/banlist
取得封禁清單 **[需認證，管理員]**

**Response 200:** `{ "data": [ /* BanEntry */ ] }`

---

### POST /api/v1/admin/banlist
新增 Discord UID 封禁 **[需認證，管理員]**

**Request Body:**
```json
{
  "discord_uid": "1234567890",
  "reason": "違規原因",
  "banned_until": null
}
```

**Response 201:** `{ "data": { /* BanEntry */ } }`

---

### DELETE /api/v1/admin/banlist/:id
移除封禁 **[需認證，管理員]**

**Response 204:** No Content

---

### GET /api/v1/admin/members
搜尋會員帳號 **[需認證，管理員]**

**Query Parameters:**

| 參數 | 型別 | 說明 |
|------|------|------|
| `search` | string | 依 actor id、Discord UID/名稱、角色名稱或角色代碼搜尋 |
| `limit` | int | 預設 50，最大 100 |
| `offset` | int | 分頁偏移 |

**Response 200:**
```json
{
  "data": [
    {
      "id": "actor_uuid",
      "is_admin": false,
      "is_banned": false,
      "has_pin": true,
      "discord_uid": "1234567890",
      "discord_username": "discord_name",
      "character_count": 2,
      "active_character_count": 2,
      "opened_party_count": 5,
      "joined_party_count": 8,
      "last_active_at": "2026-05-15T12:00:00Z",
      "created_at": "2026-05-15T12:00:00Z",
      "updated_at": "2026-05-15T12:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/admin/members/:actorId
取得會員帳號明細 **[需認證，管理員]**

回傳帳號、角色清單、該帳號角色開啟的房間，以及該帳號角色加入或申請過的隊伍歷史。

**Response 200:** `{ "data": { "account": { /* MemberSummary */ }, "characters": [ /* MemberCharacter */ ], "opened_parties": [ /* MemberParty */ ], "party_history": [ /* MemberPartyHistory */ ] } }`

---

### POST /api/v1/admin/members/:actorId/ban
停用會員帳號 **[需認證，管理員]**

沿用既有 `actors.is_banned` / `admin_banlist` 機制，不新增獨立帳號狀態。

**Request Body:**
```json
{
  "reason": "違規原因",
  "banned_until": null
}
```

**Response 204:** No Content

---

### DELETE /api/v1/admin/members/:actorId/ban
啟用會員帳號 **[需認證，管理員]**

移除該 actor 的 banlist 記錄並將 `actors.is_banned=false`。

**Response 204:** No Content

---

### DELETE /api/v1/admin/members/:actorId/discord
清除會員 Discord 綁定 **[需認證，管理員]**

若帳號沒有 Quick Login PIN，回傳 409，管理員需先重設 PIN 以避免帳號失去登入方式。

**Response 204:** No Content

---

### PUT /api/v1/admin/members/:actorId/pin
重設會員 PIN **[需認證，管理員]**

**Request Body:**
```json
{
  "pin": "1234"
}
```

**Response 204:** No Content

---

### PATCH /api/v1/admin/members/:actorId/characters/:characterId
修改會員角色 **[需認證，管理員]**

**Request Body:** 任意組合的 `game_name`、`character_code`、`job_class`、`level`、`is_active`。

**Response 200:** `{ "data": { /* MemberCharacter */ } }`

---

### DELETE /api/v1/admin/members/:actorId/characters/:characterId
刪除會員角色 **[需認證，管理員]**

沿用角色 soft delete，將 `characters.is_active=false`。

**Response 204:** No Content

---

### GET /api/v1/admin/parties
取得管理員隊伍清單 **[需認證，管理員]**

**Response 200:** `{ "data": [ /* Party summary */ ] }`

---

### DELETE /api/v1/admin/parties/:id
強制關閉隊伍 **[需認證，管理員]**

**Response 204:** No Content

---

### GET /api/v1/admin/announcements
取得管理員公告列表 **[需認證，管理員]**

**Response 200:** 同公開公告列表格式。

---

### GET /api/v1/admin/announcement
取得管理員主要公告 **[需認證，管理員]**

**Response 200:** 同公開主要公告格式。

---

### POST /api/v1/admin/announcement
新增公告 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "公告內容",
  "priority": 0
}
```

**Response 201:** `{ "data": { /* Announcement */ } }`

---

### PUT /api/v1/admin/announcement
覆寫主要公告 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "公告內容"
}
```

**Response 200:** `{ "data": { /* Announcement */ } }`

---

### DELETE /api/v1/admin/announcement/:id
刪除指定公告 **[需認證，管理員]**

**Response 204:** No Content

---

### DELETE /api/v1/admin/announcement
清除公告 **[需認證，管理員]**

**Response 204:** No Content

---

### GET /api/v1/admin/notice
取得管理員 NoticeBar 內容 **[需認證，管理員]**

**Response 200:** 同公開 NoticeBar 格式。

---

### PUT /api/v1/admin/notice
覆寫 NoticeBar 內容 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "NoticeBar 文字"
}
```

**Response 200:** `{ "data": { /* Notice */ } }`

---

### DELETE /api/v1/admin/notice
清除 NoticeBar 內容 **[需認證，管理員]**

**Response 204:** No Content

---

## 十一、OCR

### POST /api/v1/ocr/parse-screenshot
上傳截圖進行 OCR 識別 **[需認證]**

**Request:** `multipart/form-data` with `file` field（PNG/JPEG/WEBP，最大 5 MB）

**Response 200:**
```json
{
  "success": true,
  "data": {
    "boss_name": "BossName",
    "channel": "CH1",
    "members": [
      {
        "game_name": "PlayerName",
        "job_class_id": 1,
        "job_class_name": "Warrior",
        "level": 200,
        "is_leader": true
      }
    ],
    "confidence": 0.95
  }
}
```

---

### POST /api/v1/ocr/presign
取得 OCR 圖片上傳預簽 URL **[需認證]**

**Request Body:**
```json
{
  "content_type": "image/png",
  "extension": "png"
}
```

**Response 200:**
```json
{
  "url": "https://storage.example.com/...",
  "object_key": "ocr/uploads/uuid.png"
}
```

**Error Codes:**
- `400` - 不支援的圖片格式
- `503` - Storage 未設定

---

## 十二、Bug 回報

### POST /api/v1/bug-reports
提交 Bug 回報 **[公開]**

**Request Body:**
```json
{
  "title": "無法送出申請",
  "description": "點擊申請後畫面停在載入中",
  "contact": "discord:player"
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "title": "無法送出申請",
    "description": "點擊申請後畫面停在載入中",
    "contact": "discord:player",
    "status": "open",
    "created_at": "2026-04-16T03:00:00Z",
    "updated_at": "2026-04-16T03:00:00Z"
  }
}
```

欄位限制：
- `title` 必填，最多 128 字元。
- `description` 必填，最多 2000 字元。
- `contact` 選填，最多 128 字元。

### GET /api/v1/bug-reports
列出 Bug 回報 **[公開]**

回傳最新 50 筆、所有狀態的公開摘要，依 `created_at` 由新到舊排序。公開列表會回傳 `description` 與 `developer_reply`，讓使用者能查看問題內容與開發者回覆；此公開端點不得回傳 `user_id` 或 `contact`。

`status` 可能值：
- `open`
- `in_progress`
- `completed`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "無法送出申請",
    "description": "點擊申請後畫面停在載入中",
    "status": "open",
    "developer_reply": "已修正，會在下一次部署後生效。",
    "created_at": "2026-04-16T03:00:00Z",
    "updated_at": "2026-04-16T03:00:00Z"
  }
]
```

### PATCH /api/v1/admin/bug-reports/{id}
更新 Bug 回報狀態與開發者回覆 **[需要管理員]**

**Request Body:**
```json
{
  "status": "completed",
  "developer_reply": "已修正，會在下一次部署後生效。"
}
```

至少需提供 `status` 或 `developer_reply` 其中一個欄位。`developer_reply` 最多 2000 字元。

**Response 200:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "無法送出申請",
  "description": "點擊申請後畫面停在載入中",
  "contact": "discord:player",
  "status": "completed",
  "developer_reply": "已修正，會在下一次部署後生效。",
  "created_at": "2026-04-16T03:00:00Z",
  "updated_at": "2026-04-16T04:00:00Z"
}
```

---

## 十三、公會 (Guilds)

角色權限：`LEADER`（會長）> `OFFICER`（幹部）> `MEMBER`（成員）。標注「幹部」的 endpoint 會長亦可呼叫。

### GET /api/v1/guilds
公會列表 **[公開，無需認證；帶認證時回傳 current_role]**

- Query：`keyword`（名稱關鍵字）、`page`（預設 1）、`size`（預設 20）。

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "遠征隊",
      "slug": "expedition",
      "description": "公會簡介",
      "icon_url": null,
      "join_mode": "OPEN",
      "member_limit": 50,
      "min_level": 100,
      "created_by": "uuid",
      "is_active": true,
      "member_count": 12,
      "current_role": "MEMBER",
      "created_at": "2026-05-01T00:00:00Z",
      "updated_at": "2026-05-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

- `join_mode`：`OPEN` / `APPROVAL` / `PASSWORD`。
- `current_role` / `membership` 僅在帶認證且為該公會成員時出現。

---

### GET /api/v1/guilds/:id
公會詳情 **[公開，無需認證]**

**Response 200:** `Guild`（同列表單筆格式，成員另含 `membership`）

**Error Codes:**
- `404` - 公會不存在或已解散

---

### POST /api/v1/guilds
建立公會 **[需認證]**

**Request Body:**
```json
{
  "name": "遠征隊",
  "description": "公會簡介",
  "icon_url": null,
  "join_mode": "PASSWORD",
  "password": "123456",
  "member_limit": 50,
  "min_level": 100
}
```

- `name` 必填（最長 64 字）；`join_mode` 必填。
- `join_mode = PASSWORD` 時需附 `password`（最長 64 字）。
- 建立者自動成為 `LEADER`。

**Response 201:** `Guild`

---

### PUT /api/v1/guilds/:id
更新公會設定 **[需認證，會長]**

**Request Body:** 同建立公會（所有欄位可選）

**Response 200:** `Guild`

**Error Codes:**
- `403` - 不是會長
- `404` - 公會不存在

---

### DELETE /api/v1/guilds/:id
解散公會 **[需認證，會長]**

**Response 204:** No Content

---

### POST /api/v1/guilds/:id/join
加入公會 / 送出加入申請 **[需認證]**

**Request Body:**
```json
{ "password": "123456" }
```

**說明:**
- `OPEN` 房直接加入成為 `MEMBER`。
- `PASSWORD` 房需附正確 `password`。
- `APPROVAL` 房建立 PENDING join request，待幹部審核。

**Response 200:** `Guild`（含 `membership`；APPROVAL 模式下 `membership` 為 null）

**Error Codes:**
- `403` - 密碼錯誤
- `409` - 已是成員 / 已有待審申請 / 公會已滿

---

### DELETE /api/v1/guilds/:id/me
離開公會 **[需認證，成員]**

**說明:**
- 會長離開時自動將會長移交給最早加入的幹部或成員；若為最後一名成員，公會轉為 inactive。

**Response 200:** 離開結果（含新會長資訊，若有移交）

---

### POST /api/v1/guilds/:id/transfer
移交會長 **[需認證，會長]**

**Request Body:**
```json
{ "new_leader_user_id": "uuid" }
```

**Response 204:** No Content

**Error Codes:**
- `403` - 不是會長
- `404` - 目標不是公會成員

---

### GET /api/v1/guilds/:id/members
成員列表 **[需認證，成員]**

**Response 200:**
```json
{
  "data": [
    {
      "guild_id": "uuid",
      "user_id": "uuid",
      "role": "MEMBER",
      "display_name": "顯示名稱",
      "joined_at": "2026-05-02T00:00:00Z",
      "characters": [
        { "id": "uuid", "user_id": "uuid", "game_name": "角色名", "character_code": "ABC1234", "job_class": 1, "level": 200, "created_at": "2026-05-01T00:00:00Z" }
      ]
    }
  ]
}
```

---

### PATCH /api/v1/guilds/:id/members/:uid/role
變更成員角色 **[需認證，會長]**

**Request Body:**
```json
{ "role": "OFFICER" }
```

- `role` 只接受 `OFFICER` / `MEMBER`；不可變更會長本人。

**Response 204:** No Content

---

### DELETE /api/v1/guilds/:id/members/:uid
踢出成員 **[需認證，幹部]**

**說明:**
- 幹部只能踢出 `MEMBER`；會長可踢出幹部與成員；不可踢出自己。

**Response 204:** No Content

**Error Codes:**
- `403` - 權限不足（角色階級不允許）
- `404` - 目標不是公會成員

---

### GET /api/v1/guilds/:id/join-requests
待審加入申請列表 **[需認證，幹部]**

**Response 200:** `{ "data": [JoinRequest] }`（`status`：`PENDING` / `APPROVED` / `REJECTED`）

---

### PATCH /api/v1/guilds/:id/join-requests/:rid
審核加入申請 **[需認證，幹部]**

**Request Body:**
```json
{ "action": "APPROVE", "reject_reason": null }
```

- `action` 只接受 `APPROVE` / `REJECT`；`REJECT` 可附 `reject_reason`（最長 500 字）。

**Response 200:** 更新後的 `JoinRequest`

---

### GET /api/v1/guilds/:id/announcements
公告列表 **[需認證，成員]**

**Response 200:** `{ "data": [Announcement] }`
```json
{
  "data": [
    { "id": "uuid", "guild_id": "uuid", "author_user_id": "uuid", "title": "週末打王", "body": "<p>內容</p>", "pinned": true, "created_at": "2026-05-10T00:00:00Z", "updated_at": "2026-05-10T00:00:00Z" }
  ]
}
```

---

### POST /api/v1/guilds/:id/announcements
新增公告 **[需認證，幹部]**

**Request Body:**
```json
{ "title": "週末打王", "body": "公告內容", "pinned": false }
```

- `title` 必填（最長 100 字）；`body` 必填（最長 10000 字，HTML 會被 sanitize）。

**Response 201:** `Announcement`

---

### PUT /api/v1/guilds/:id/announcements/:aid
更新公告 **[需認證，幹部]**

**Request Body:** 同新增公告

**Response 200:** `Announcement`

---

### DELETE /api/v1/guilds/:id/announcements/:aid
刪除公告 **[需認證，幹部]**

**Response 204:** No Content

---

### PATCH /api/v1/guilds/:id/announcements/:aid/pin
置頂 / 取消置頂公告 **[需認證，幹部]**

**Request Body:**
```json
{ "pinned": true }
```

**Response 200:** `Announcement`

---

### GET /api/v1/guilds/:id/chat
取得公會聊天歷史 **[需認證，成員]**

- Query：`before`（訊息游標，往前翻頁）、`size`（預設 50）。

**Response 200:**
```json
{
  "data": [
    { "message_id": "id", "guild_id": "uuid", "user_id": "uuid", "content": "今晚八點", "ts": "2026-06-01T12:00:00Z" }
  ]
}
```

---

### POST /api/v1/guilds/:id/chat
傳送公會聊天訊息 **[需認證，成員]**

**Request Body:**
```json
{ "content": "今晚八點" }
```

- `content` 必填（最長 10000 字，HTML 會被 sanitize）。
- 訊息透過 WebSocket `guild.chat` 事件推送給訂閱 `guild:{id}` 的用戶端。

**Response 201:** `ChatMessage`

---

### GET /api/v1/guilds/:id/parties
公會隊伍列表 **[需認證，成員]**

- Query：`type`、`status`、`include_history=true`（含歷史隊伍）、`limit`（預設 20）、`offset`（預設 0）。

**Response 200:** `{ "data": [GuildParty] }`（含 `generated_by_match`、`scheduled_at`、`slots[]` 等欄位）

---

### POST /api/v1/guilds/:id/parties
建立公會隊伍 **[需認證，成員]**

**Request Body:** 同 `POST /api/v1/parties`（CreatePartyInput）

**說明:**
- 後端自動設定 `guild_id` 與 `visibility = GUILD`；公會隊伍不出現在公開列表。

**Response 201:** 同 `POST /api/v1/parties` 回傳格式

---

### GET /api/v1/guilds/:id/me/preferences
取得自己的配對偏好 **[需認證，成員]**

**Response 200:**
```json
{
  "guild_id": "uuid",
  "user_id": "uuid",
  "boss_ids": ["uuid"],
  "time_slots": [20, 21],
  "character_ids": ["uuid"],
  "character_preferences": [
    { "character_id": "uuid", "boss_ids": ["uuid"], "time_slots": [20] }
  ],
  "updated_at": "2026-06-01T12:00:00Z"
}
```

---

### PUT /api/v1/guilds/:id/me/preferences
更新自己的配對偏好 **[需認證，成員]**

**Request Body:** 同 Response（不含 `guild_id` / `user_id` / `updated_at`）

**Response 200:** 更新後的偏好

---

### GET /api/v1/guilds/:id/me/match-history
取得自己的公會配對紀錄 **[需認證，成員]**

- Query：`limit`（預設 10）。

**Response 200:** `{ "data": [MatchRun] }`

---

### GET /api/v1/guilds/:id/boss-configs
取得 BOSS 配對設定 **[需認證，幹部]**

**Response 200:** `{ "data": [BossConfig] }`
```json
{
  "data": [
    {
      "guild_id": "uuid",
      "boss_id": "uuid",
      "max_members": 6,
      "min_members": 4,
      "min_level": 120,
      "job_slots": [ { "job_class": 1, "count": 1 } ],
      "enabled": true,
      "updated_at": "2026-06-01T12:00:00Z"
    }
  ]
}
```

---

### PUT /api/v1/guilds/:id/boss-configs
更新 BOSS 配對設定 **[需認證，幹部]**

**Request Body:** `[BossConfigInput]`（`boss_id` 必填；`max_members` 1–6）

**Response 200:** `{ "data": [BossConfig] }`

---

### GET /api/v1/guilds/me
取得目前 actor 加入的公會清單。

**Response 200**
```json
{
  "guild": {
    "id": "uuid",
    "name": "遠征隊",
    "join_mode": "OPEN",
    "membership": {
      "guild_id": "uuid",
      "user_id": "uuid",
      "role": "MEMBER",
      "joined_at": "2026-05-02T00:00:00Z"
    }
  },
  "guilds": [
    {
      "id": "uuid",
      "name": "遠征隊",
      "join_mode": "OPEN",
      "membership": {
        "guild_id": "uuid",
        "user_id": "uuid",
        "role": "MEMBER",
        "joined_at": "2026-05-02T00:00:00Z"
      }
    }
  ],
  "membership": {
    "guild_id": "uuid",
    "user_id": "uuid",
    "role": "MEMBER",
    "joined_at": "2026-05-02T00:00:00Z"
  }
}
```

備註：
- `guilds` 是目前 actor 加入的所有公會。
- `guild` / `membership` 會指向清單中的最新加入公會，以相容舊版單一公會客戶端。
- 若 actor 尚未加入任何公會，回傳 `{ "guild": null, "guilds": [], "membership": null }`。

---

### POST /api/v1/guilds/:id/match
執行公會自動配對。會長與幹部可呼叫。

`dry_run=true` 只回傳一次性預覽，不寫入 DB。`dry_run=false` 會建立目前週期的 `DRAFT` match run 與可編輯 `draft_plan`，不會建立隊伍，也不會發送 party/member 通知。

**Request**
```json
{
  "boss_ids": ["uuid"],
  "max_members": 6,
  "min_level": 120,
  "slot_template": [
    {
      "job_classes": [200, 201],
      "count": 1
    }
  ],
  "dry_run": false
}
```

**Response 200**
```json
{
  "run": {
    "id": "uuid",
    "guild_id": "uuid",
    "triggered_by": "MANUAL",
    "triggered_by_user_id": "uuid",
    "cycle_start": "2026-05-04T00:00:00Z",
    "cycle_end": "2026-05-11T00:00:00Z",
    "generated_party_ids": [],
    "skipped_reasons": [],
    "status": "DRAFT",
    "draft_plan": {
      "generated": [
        {
          "boss_id": "uuid",
          "time_slot": 252,
          "scheduled_at": "2026-05-09T12:00:00Z",
          "max_members": 6,
          "min_level": 120,
          "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
          "leader_character_id": "uuid",
          "assignments": [
            {
              "user_id": "uuid",
              "character_id": "uuid",
              "character_name": "波比",
              "character_code": "ABC1234",
              "job_class": 200,
              "level": 180
            }
          ]
        }
      ],
      "skipped": [],
      "unmatched": [
        {
          "boss_id": "uuid",
          "time_slot": 252,
          "user_id": "uuid",
          "character_id": "uuid",
          "character_name": "尚未成團",
          "character_code": "DEF5678",
          "job_class": 411,
          "level": 170,
          "reason": "capacity_reached"
        }
      ]
    },
    "dry_run": false,
    "created_at": "2026-05-01T05:00:00Z",
    "updated_at": "2026-05-01T05:00:00Z"
  },
  "plan": {
    "generated": [
      {
        "boss_id": "uuid",
        "time_slot": 252,
        "scheduled_at": "2026-05-09T12:00:00Z",
        "max_members": 6,
        "min_level": 120,
        "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
        "leader_character_id": "uuid",
        "assignments": [
          {
            "user_id": "uuid",
            "character_id": "uuid",
            "character_name": "波比",
            "character_code": "ABC1234",
            "job_class": 200,
            "level": 180
          }
        ]
      }
    ],
    "skipped": [],
    "unmatched": [
      {
        "boss_id": "uuid",
        "time_slot": 252,
        "user_id": "uuid",
        "character_id": "uuid",
        "character_name": "尚未成團",
        "character_code": "DEF5678",
        "job_class": 411,
        "level": 170,
        "reason": "capacity_reached"
      }
    ]
  },
  "generated": [
    {
      "boss_id": "uuid",
      "time_slot": 252,
      "scheduled_at": "2026-05-09T12:00:00Z",
      "max_members": 6,
      "min_level": 120,
      "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
      "leader_character_id": "uuid",
      "assignments": [
        {
          "user_id": "uuid",
          "character_id": "uuid",
          "character_name": "波比",
          "character_code": "ABC1234",
          "job_class": 200,
          "level": 180
        }
      ]
    }
  ],
  "skipped": [],
  "unmatched": [
    {
      "boss_id": "uuid",
      "time_slot": 252,
      "user_id": "uuid",
      "character_id": "uuid",
      "character_name": "尚未成團",
      "character_code": "DEF5678",
      "job_class": 411,
      "level": 170,
      "reason": "capacity_reached"
    }
  ]
}
```

備註：
- `plan`、`generated`、`skipped`、`unmatched` 會與 `run.draft_plan` 對齊；前端可優先讀取 `run.draft_plan`。
- 每個 guild/cycle 僅允許一個 active `DRAFT`；重新產生草案會取消舊草案。
- 已 `GENERATED` 的 cycle 不允許再次生成正式隊伍。

---

### GET /api/v1/guilds/:id/match/member-settings
查詢指定 BOSS 的成員偏好設定 **[需認證，幹部]**

- Query：`boss_id`（必填）。
- 供幹部在執行自動配對前查看已設定此 BOSS 的角色、順位與可出團時段。

**Response 200:**
```json
{
  "boss_id": "uuid",
  "members": [
    {
      "guild_id": "uuid",
      "boss_id": "uuid",
      "user_id": "uuid",
      "display_name": "顯示名稱",
      "role": "MEMBER",
      "character_id": "uuid",
      "character_name": "角色名",
      "character_code": "ABC1234",
      "job_class": 1,
      "level": 200,
      "boss_rank": 1,
      "time_slots": [20, 21],
      "updated_at": "2026-06-01T12:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/guilds/:id/match-runs/current-draft
取得目前週期尚未確認的公會配對草案。會長與幹部可呼叫；沒有草案時回 `404`。

**Response 200**

回傳格式同 `POST /api/v1/guilds/:id/match` 的 `DRAFT` response。

---

### POST /api/v1/guilds/:id/match-runs/:runId/generate
依照執行者確認後的草案建立正式公會隊伍。後端會重新驗證草案狀態、操作者幹部權限、角色仍屬於 active 公會成員、職業與等級符合 slot，以及每隊 `leader_character_id` 必須存在於 assignments。

**Request**
```json
{
  "draft_revision": "2026-05-01T05:00:00Z",
  "generated": [
    {
      "boss_id": "uuid",
      "time_slot": 252,
      "scheduled_at": "2026-05-09T12:00:00Z",
      "max_members": 6,
      "min_level": 120,
      "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
      "leader_character_id": "uuid",
      "assignments": [
        {
          "user_id": "uuid",
          "character_id": "uuid",
          "character_name": "波比",
          "character_code": "ABC1234",
          "job_class": 200,
          "level": 180
        }
      ]
    }
  ]
}
```

**Response 200**
```json
{
  "run": {
    "id": "uuid",
    "guild_id": "uuid",
    "generated_party_ids": ["uuid"],
    "status": "GENERATED",
    "draft_plan": {
      "generated": [
        {
          "boss_id": "uuid",
          "time_slot": 252,
          "scheduled_at": "2026-05-09T12:00:00Z",
          "max_members": 6,
          "min_level": 120,
          "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
          "leader_character_id": "uuid",
          "assignments": [
            {
              "user_id": "uuid",
              "character_id": "uuid",
              "character_name": "波比",
              "character_code": "ABC1234",
              "job_class": 200,
              "level": 180
            }
          ]
        }
      ],
      "skipped": [],
      "unmatched": [
        {
          "boss_id": "uuid",
          "time_slot": 252,
          "user_id": "uuid",
          "character_id": "uuid",
          "character_name": "尚未成團",
          "character_code": "DEF5678",
          "job_class": 411,
          "level": 170,
          "reason": "capacity_reached"
        }
      ]
    },
    "confirmed_at": "2026-05-01T05:10:00Z",
    "dry_run": false,
    "created_at": "2026-05-01T05:00:00Z",
    "updated_at": "2026-05-01T05:10:00Z"
  },
  "plan": {
    "generated": [
      {
        "boss_id": "uuid",
        "time_slot": 252,
        "scheduled_at": "2026-05-09T12:00:00Z",
        "max_members": 6,
        "min_level": 120,
        "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
        "leader_character_id": "uuid",
        "assignments": [
          {
            "user_id": "uuid",
            "character_id": "uuid",
            "character_name": "波比",
            "character_code": "ABC1234",
            "job_class": 200,
            "level": 180
          }
        ]
      }
    ],
    "skipped": [],
    "unmatched": [
      {
        "boss_id": "uuid",
        "time_slot": 252,
        "user_id": "uuid",
        "character_id": "uuid",
        "character_name": "尚未成團",
        "character_code": "DEF5678",
        "job_class": 411,
        "level": 170,
        "reason": "capacity_reached"
      }
    ]
  },
  "generated": [
    {
      "boss_id": "uuid",
      "time_slot": 252,
      "scheduled_at": "2026-05-09T12:00:00Z",
      "max_members": 6,
      "min_level": 120,
      "job_slots": [{ "job_classes": [200, 201], "count": 1 }],
      "leader_character_id": "uuid",
      "assignments": [
        {
          "user_id": "uuid",
          "character_id": "uuid",
          "character_name": "波比",
          "character_code": "ABC1234",
          "job_class": 200,
          "level": 180
        }
      ]
    }
  ],
  "skipped": [],
  "unmatched": [
    {
      "boss_id": "uuid",
      "time_slot": 252,
      "user_id": "uuid",
      "character_id": "uuid",
      "character_name": "尚未成團",
      "character_code": "DEF5678",
      "job_class": 411,
      "level": 170,
      "reason": "capacity_reached"
    }
  ]
}
```

生成成功後會建立 `visibility=GUILD`、`generated_by_match=true` 的 BOSS party 與 slots，並送出既有 `party.created` / `party.member_joined` 通知。`run.draft_plan`、`plan`、`generated`、`skipped`、`unmatched` 會反映已驗證的最終草案；原草案的略過與未配對名單會保留供 UI 檢查。這類自動配對隊伍可由隊長或公會 LEADER/OFFICER 管理；手動公會隊伍與公開隊伍仍維持隊長管理。

`draft_revision` 必須帶入目前草案 `run.updated_at`。若草案已被其他操作更新或取消，後端回 `409 GUILD_MATCH_DRAFT_REVISION_CONFLICT`，前端應重新讀取目前草案後再提交。生成出的 BOSS party 在 DB 內部以 `raid_boss_options.id` 儲存 `target_name`，API 讀取時仍回傳玩家可讀的 BOSS 名稱與 `target_option_id`。

---

### GET /api/v1/guilds/:id/me/calendar
取得目前 actor 在指定公會的個人王團行事曆。

後端會以該 actor 的所有 active 角色查詢最近 7 天內已被填入 slot 的公會 BOSS 隊伍；只回傳 `visibility=GUILD`、`type=BOSS`、狀態為 `RECRUITING` 或 `ACTIVE` 且有 `scheduled_at` 的房間。非公會成員回 `403`。

**Response 200**
```json
{
  "data": [
    {
      "party_id": "uuid",
      "guild_id": "uuid",
      "scheduled_at": "2026-04-30T12:00:00Z",
      "target_name": "拉圖斯",
      "character_id": "uuid",
      "character_name": "波比",
      "character_code": "ABC1234"
    }
  ]
}
```

前端使用 `party_id` 導向對應房間：`/?tab=MY_PARTY&party={party_id}&fromGuild={guild_id}`。

---

## 十四、WebSocket API

### 連線端點
`wss://api.example.com/ws`

### 訊息格式（客戶端 → 伺服器）

```json
// 認證
{ "type": "auth" }

// 訂閱房間
{ "action": "subscribe", "room_id": "actor:uuid" }
{ "action": "subscribe", "room_id": "party:uuid" }
{ "action": "subscribe", "room_id": "parties:global" }

// 取消訂閱
{ "action": "unsubscribe", "room_id": "party:uuid" }

// 發送聊天
{ "action": "chat", "room_id": "party:uuid", "content": "文字內容" }
```

### 訊息格式（伺服器 → 客戶端）

```json
// 認證成功
{
  "type": "auth_success",
  "payload": {
    "kind": "actor",
    "id": "actor_uuid",
    "room_id": "actor:actor_uuid"
  }
}

// 事件通知
{
  "type": "party.created",
  "room_id": "parties:global",
  "payload": {
    "party_id": "uuid",
    "party_name": "新隊伍",
    "target_name": "火龍團",
    "type": "GROUP",
    "status": "RECRUITING"
  },
  "timestamp": "2026-04-16T03:00:00Z"
}

{
  "type": "party.updated",
  "room_id": "parties:global",
  "payload": {
    "party_id": "uuid",
    "party_name": "已更新隊伍",
    "target_name": "火龍團",
    "status": "HIDDEN",
    "revision": 4,
    "current_members": 2,
    "max_members": 2
  },
  "timestamp": "2026-04-16T03:05:00Z"
}

{
  "type": "party.application_accepted",
  "room_id": "actor:uuid",
  "payload": {
    "party_id": "uuid",
    "party_name": "隊伍名稱",
    "applicant_name": "角色名稱"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}

{
  "type": "party.idle_warning",
  "room_id": "actor:uuid",
  "payload": {
    "party_id": "uuid",
    "party_name": "深淵遠征隊",
    "title": "深淵遠征隊",
    "role": "leader",
    "idle_period": "1 hour",
    "warning_stage": "initial"
  },
  "timestamp": "2026-04-15T08:00:00Z"
}

{
  "type": "party.idle_warning",
  "room_id": "actor:uuid",
  "payload": {
    "party_id": "uuid",
    "party_name": "深淵遠征隊",
    "title": "深淵遠征隊",
    "role": "member",
    "idle_period": "1 hour 55 minutes",
    "warning_stage": "final",
    "close_in_minutes": 5
  },
  "timestamp": "2026-04-15T08:55:00Z"
}

// 聊天訊息
{
  "type": "chat",
  "room_id": "party:uuid",
  "payload": {
    "party_id": "uuid",
    "sender": {
      "kind": "actor",
      "id": "character_uuid",
      "display_name": "快速玩家",
      "character_code": "ABC1234",
      "job_class_id": 1,
      "level": 200
    },
    "content": "Hello!"
  },
  "timestamp": "2026-04-15T12:00:00Z"
}

// 在線人數
{
  "type": "system.online_count",
  "room_id": "parties:global",
  "payload": { "count": 42 }
}
```

`auth_success` 後 server 已自動加入當前 identity 的 personal room；登入 actor 會是 `actor:{actorId}`，未登入 quick guest 則以 `payload.room_id` 回傳 deterministic personal room。client 需訂閱 `parties:global` 與該 personal room，並在 reconnect 後重送仍有 listener 的 `party:{partyId}` 訂閱。
快速隊伍聊天仍以 `party:{partyId}` 作為房內主事件；後端會另外把同一個 `chat` payload 鏡射到可讀取聊天的 quick participant personal room，用於房外 toast，不會重複寫入聊天歷史。可讀取聊天的 quick participant 僅包含隊長與已加入的隊員，不包含 visitor 或 pending guest。

---

## 十五、錯誤碼對照

| HTTP Status | 說明 |
|------------|------|
| `400` | 請求格式錯誤（validation failed） |
| `401` | 未認證（Token 無效或已過期） |
| `403` | 無權限（非隊長、已封禁、密碼錯誤） |
| `404` | 資源不存在 |
| `409` | 衝突（角色已在活動、隊伍已滿等） |
| `500` | 伺服器內部錯誤 |

**自定義錯誤碼 (code 欄位):**

| Code | 說明 |
|------|------|
| `PARTY_PASSWORD_REQUIRED` | 需要隊伍密碼才能查看 |
| `PARTY_INVALID_PASSWORD` | 隊伍密碼錯誤 |
| `PARTY_SLOT_CONFLICT` | 編輯隊伍時，某個 slot 在同一期間被其他操作填入、換人或占用，必須先同步最新隊伍後再重新確認 |
| `discord_merge_required` | Discord 已綁在另一個 actor，但目前狀態允許合併 |
| `discord_merge_blocked` | Discord 已綁在另一個 actor，但 target/source 目前仍有 blocker，不能合併 |
| `invalid_merge_token` | Discord merge token 已過期、已被使用或與目前登入 actor 不符 |
