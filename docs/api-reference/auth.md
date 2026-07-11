# API 參考 - 身份驗證與角色 (Auth & Characters)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋 Actor 登入/會話與 Character 管理端點。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。對應功能文件：[docs/features/auth.md](../features/auth.md)。

---

## 一、認證 (Auth)

### GET /api/v2/auth/config
取得 Discord OAuth2 設定（Client ID, Redirect URI）

**Response 200:**
```json
{
  "client_id": "123456789",
  "redirect_uri": "https://app.example.com/auth/discord/callback"
}
```

---

### POST /api/v2/auth/quick-login
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

### GET /api/v2/auth/quick-login/check?code=ABC1234
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

### GET /api/v2/auth/discord/callback
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

### POST /api/v2/auth/logout
登出（撤銷 access token / refresh token，並清除 auth cookies）

**Response 200:** `{ "message": "logged out" }`

---

### GET /api/v2/auth/me
### GET /api/v2/actors/me
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

### POST /api/v2/auth/discord/link
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

### POST /api/v2/auth/discord/link/merge
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

### DELETE /api/v2/auth/discord/link
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

### PUT /api/v2/actors/me/pin
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

### PUT /api/v2/actors/me/current-character
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


## 五、角色 (Characters)

### GET /api/v2/job-classes
取得職業清單 **[公開]**

**Response 200:** 職業選項陣列

**Error Codes:**
- `500` - `{ "code": "user_internal_error", "error": "failed to list job classes" }` 伺服器錯誤

---

### GET /api/v2/characters
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

**Error Codes:**
- `500` - `{ "code": "user_internal_error", "error": "failed to list characters" }` 伺服器錯誤

---

### POST /api/v2/characters
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
- `400` - `{ "code": "REQ_001", "message": "..." }` 請求格式錯誤（`apierror.CodeBadRequest`）
- `400` - `{ "code": "invalid_job_class", "message": "不支援的職業，請重新選擇。" }` 不支援的職業 ID
- `409` - `{ "code": "character_code_taken", "message": "角色代碼已被使用。" }` 角色代碼已被使用
- `500` - `{ "code": "user_internal_error", "error": "failed to create character" }` 未預期的伺服器錯誤

---

### PATCH /api/v2/characters/:id
更新角色 **[需認證]**

**Response 200:** 更新後的 Character 物件

欄位限制與建立角色相同：`game_name` 最多 20 字元、`character_code` 最多 7 個英數字元、`level` 僅接受 1-200。

更新成功後，後端會非同步同步各處角色顯示快照（隊伍/slot/申請/聊天室 sender/通知），規則詳見 [backend/docs/data_flow.md §5 Room 路由](../../backend/docs/data_flow.md#5-room-路由)。

**Error Codes:**
- `400` - `{ "code": "character_invalid_id", "error": "invalid character id" }` 角色 ID 格式錯誤
- `400` - `{ "code": "user_invalid_request", "error": "..." }` 請求格式錯誤
- `403` - `{ "code": "character_not_owned", "error": "character not owned" }` 角色不屬於目前使用者
- `409` - `{ "code": "character_is_primary", "error": "無法停用目前的主要角色，請先設定其他角色為主要角色。" }` 嘗試停用（`is_active: false`）目前的主要角色，且該使用者還有其他可設為主要的啟用中角色；若這是使用者唯一的啟用中角色，則允許停用。可透過 `PUT /api/v2/actors/me/current-character`（帶 `character_id`）改設其他角色為主要角色後再重試
- `500` - `{ "code": "user_internal_error", "error": "failed to update character" }` 伺服器錯誤

---

### DELETE /api/v2/characters/:id
刪除角色 **[需認證]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "character_invalid_id", "error": "invalid character id" }` 角色 ID 格式錯誤
- `403` - `{ "code": "character_not_owned", "error": "character not owned" }` 角色不屬於目前使用者
- `409` - `{ "code": "character_is_primary", "error": "無法刪除目前的主要角色，請先設定其他角色為主要角色。" }` 嘗試刪除目前的主要角色，且該使用者還有其他可設為主要的啟用中角色；若這是使用者唯一的啟用中角色，則允許刪除。可透過 `PUT /api/v2/actors/me/current-character`（帶 `character_id`）改設其他角色為主要角色後再重試
- `500` - `{ "code": "user_internal_error", "error": "failed to delete character" }` 伺服器錯誤

---

