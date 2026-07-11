# API 參考 - 公會 (Guild)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋公會、成員、公告、聊天室、公會限定隊伍與每週王團自動配對端點。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。對應功能文件：[docs/features/guild.md](../features/guild.md)。

---

## 十三、公會 (Guilds)

角色權限：`LEADER`（會長）> `OFFICER`（幹部）> `MEMBER`（成員）。標注「幹部」的 endpoint 會長亦可呼叫。

### GET /api/v2/guilds
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

### GET /api/v2/guilds/:id
公會詳情 **[公開，無需認證]**

**Response 200:** `Guild`（同列表單筆格式，成員另含 `membership`）

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在或已解散

---

### POST /api/v2/guilds
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

**Error Codes:**
- `400` - `{ "code": "GUILD_VALIDATION_FAILED", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "GUILD_INVALID_MEMBER_LIMIT", "error": "..." }` `member_limit` 不合法
- `401` - `{ "error": "invalid actor" }` 未認證
- `500` - 伺服器錯誤

---

### PUT /api/v2/guilds/:id
更新公會設定 **[需認證，會長]**

**Request Body:** 同建立公會（所有欄位可選）

**Response 200:** `Guild`

**Error Codes:**
- `400` - `{ "code": "GUILD_VALIDATION_FAILED", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "GUILD_INVALID_MEMBER_LIMIT", "error": "..." }` `member_limit` 不合法
- `400` - `{ "code": "GUILD_MEMBER_LIMIT_BELOW_CURRENT", "error": "..." }` `member_limit` 低於目前成員數
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 不是會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### DELETE /api/v2/guilds/:id
解散公會 **[需認證，會長]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 不是會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/join
加入公會 / 送出加入申請 **[需認證]**

**Request Body:**
```json
{ "password": "123456" }
```

**說明:**
- 三種 `join_mode`（`OPEN` / `PASSWORD` / `APPROVAL`）的加入行為規則詳見 [backend/docs/specs/guild.md § 加入模式（join_mode）](../../backend/docs/specs/guild.md)。

**Response 200:** `Guild`（含 `membership`；APPROVAL 模式下 `membership` 為 null）

**Error Codes:**
- `400` - `{ "code": "GUILD_PASSWORD_REQUIRED", "error": "..." }` 需要密碼
- `401` - `{ "code": "INVALID_GUILD_PASSWORD", "error": "..." }` 密碼錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `409` - `{ "code": "ALREADY_GUILD_MEMBER", "error": "..." }` 已是成員
- `409` - `{ "code": "ALREADY_IN_GUILD", "error": "..." }` 已加入其他公會或已有待審申請
- `409` - `{ "code": "GUILD_MEMBER_LIMIT_REACHED", "error": "..." }` 公會已滿
- `500` - 伺服器錯誤

---

### DELETE /api/v2/guilds/:id/me
離開公會 **[需認證，成員]**

**說明:**
- 會長離開時自動將會長移交給最早加入的幹部或成員；若為最後一名成員，公會轉為 inactive。

**Response 200:** 離開結果（含新會長資訊，若有移交）

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MEMBER_NOT_FOUND", "error": "..." }` 呼叫者不是公會成員
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/transfer
移交會長 **[需認證，會長]**

**Request Body:**
```json
{ "new_leader_user_id": "uuid" }
```

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤 / `{ "error": "..." }` 請求格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 不是會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MEMBER_NOT_FOUND", "error": "..." }` 目標不是公會成員
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/members
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### PATCH /api/v2/guilds/:id/members/:uid/role
變更成員角色 **[需認證，會長]**

**Request Body:**
```json
{ "role": "OFFICER" }
```

- `role` 只接受 `OFFICER` / `MEMBER`；不可變更會長本人。

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid user id" }` ID 格式錯誤
- `400` - `{ "error": "..." }` `role` 不合法
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 不是會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MEMBER_NOT_FOUND", "error": "..." }` 目標不是公會成員
- `500` - 伺服器錯誤

---

### DELETE /api/v2/guilds/:id/members/:uid
踢出成員 **[需認證，幹部]**

**說明:**
- 幹部只能踢出 `MEMBER`；會長可踢出幹部與成員；不可踢出自己。

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid user id" }` ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 權限不足（角色階級不允許）
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MEMBER_NOT_FOUND", "error": "..." }` 目標不是公會成員
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/join-requests
待審加入申請列表 **[需認證，幹部]**

**Response 200:** `{ "data": [JoinRequest] }`（`status`：`PENDING` / `APPROVED` / `REJECTED`）

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### PATCH /api/v2/guilds/:id/join-requests/:rid
審核加入申請 **[需認證，幹部]**

**Request Body:**
```json
{ "action": "APPROVE", "reject_reason": null }
```

- `action` 只接受 `APPROVE` / `REJECT`；`REJECT` 可附 `reject_reason`（最長 500 字）。

**Response 200:** 更新後的 `JoinRequest`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid request id" }` ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤 / `action` 不合法
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_JOIN_REQUEST_NOT_FOUND", "error": "..." }` 申請不存在
- `409` - `{ "code": "GUILD_MEMBER_LIMIT_REACHED", "error": "..." }` 核准時公會已滿
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/announcements
公告列表 **[需認證，成員]**

**Response 200:** `{ "data": [Announcement] }`
```json
{
  "data": [
    { "id": "uuid", "guild_id": "uuid", "author_user_id": "uuid", "title": "週末打王", "body": "<p>內容</p>", "pinned": true, "created_at": "2026-05-10T00:00:00Z", "updated_at": "2026-05-10T00:00:00Z" }
  ]
}
```

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/announcements
新增公告 **[需認證，幹部]**

**Request Body:**
```json
{ "title": "週末打王", "body": "公告內容", "pinned": false }
```

- `title` 必填（最長 100 字）；`body` 必填（最長 10000 字，HTML 會被 sanitize）。

**Response 201:** `Announcement`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤（`title`／`body` 缺漏或超長）
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### PUT /api/v2/guilds/:id/announcements/:aid
更新公告 **[需認證，幹部]**

**Request Body:** 同新增公告

**Response 200:** `Announcement`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid announcement id" }` ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_ANNOUNCEMENT_NOT_FOUND", "error": "..." }` 公告不存在
- `500` - 伺服器錯誤

---

### DELETE /api/v2/guilds/:id/announcements/:aid
刪除公告 **[需認證，幹部]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid announcement id" }` ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_ANNOUNCEMENT_NOT_FOUND", "error": "..." }` 公告不存在
- `500` - 伺服器錯誤

---

### PATCH /api/v2/guilds/:id/announcements/:aid/pin
置頂 / 取消置頂公告 **[需認證，幹部]**

**Request Body:**
```json
{ "pinned": true }
```

**Response 200:** `Announcement`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid announcement id" }` ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_ANNOUNCEMENT_NOT_FOUND", "error": "..." }` 公告不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/chat
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/chat
傳送公會聊天訊息 **[需認證，成員]**

**Request Body:**
```json
{ "content": "今晚八點" }
```

- `content` 必填（最長 10000 字，HTML 會被 sanitize）。
- 訊息透過 WebSocket `guild.chat` 事件推送給訂閱 `guild:{id}` 的用戶端。

**Response 201:** `ChatMessage`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤（`content` 缺漏或超長）
- `400` - `{ "code": "GUILD_INVALID_CHAT_CONTENT", "error": "..." }` 內容不合法
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/parties
公會隊伍列表 **[需認證，成員]**

- Query：`type`、`status`、`include_history=true`（含歷史隊伍）、`limit`（預設 20）、`offset`（預設 0）。

**Response 200:** `{ "data": [GuildParty] }`（含 `generated_by_match`、`scheduled_at`、`slots[]` 等欄位）

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/parties
建立公會隊伍 **[需認證，成員]**

**Request Body:** 同 `POST /api/v2/parties`（CreatePartyInput）

**說明:**
- 後端自動設定 `guild_id` 與 `visibility = GUILD`；公會隊伍不出現在公開列表。

**Response 201:** 同 `POST /api/v2/parties` 回傳格式

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 非公會成員
- `500` - `{ "code": "PARTY_CREATE_FAILED", "error": "failed to create guild party" }` 伺服器錯誤

---

### GET /api/v2/guilds/:id/me/preferences
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### PUT /api/v2/guilds/:id/me/preferences
更新自己的配對偏好 **[需認證，成員]**

**Request Body:** 同 Response（不含 `guild_id` / `user_id` / `updated_at`）

**Response 200:** 更新後的偏好

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "GUILD_INVALID_TIME_SLOT", "error": "..." }` `time_slots` 不合法
- `400` - `{ "code": "GUILD_CHARACTER_NOT_OWNED", "error": "..." }` `character_ids` 含非本人角色
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/me/match-history
取得自己的公會配對紀錄 **[需認證，成員]**

- Query：`limit`（預設 10）。

**Response 200:** `{ "data": [MatchRun] }`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/boss-configs
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### PUT /api/v2/guilds/:id/boss-configs
更新 BOSS 配對設定 **[需認證，幹部]**

**Request Body:** `[BossConfigInput]`（`boss_id` 必填；`max_members` 1–6）

**Response 200:** `{ "data": [BossConfig] }`

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/me
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

**Error Codes:**
- `401` - `{ "error": "invalid actor" }` 未認證
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/match
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "GUILD_INVALID_MATCH_SLOT_TEMPLATE", "error": "..." }` `slot_template` 不合法
- `400` - `{ "code": "GUILD_INVALID_TIME_SLOT", "error": "..." }` `time_slots` 不合法
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `409` - `{ "code": "GUILD_MATCH_RUN_ALREADY_EXISTS", "error": "..." }` 目前週期已有 active `DRAFT`（`dry_run=false`）
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/match/member-settings
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `400` - `{ "error": "invalid boss_id" }` `boss_id` 缺漏或格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/match-runs/current-draft
取得目前週期尚未確認的公會配對草案。會長與幹部可呼叫；沒有草案時回 `404`。

**Response 200**

回傳格式同 `POST /api/v2/guilds/:id/match` 的 `DRAFT` response。

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MATCH_DRAFT_NOT_FOUND", "error": "..." }` 沒有進行中的草案
- `500` - 伺服器錯誤

---

### POST /api/v2/guilds/:id/match-runs/:runId/generate
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` / `{ "error": "invalid match run id" }` ID 格式錯誤
- `400` - `{ "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "GUILD_INVALID_MATCH_DRAFT", "error": "..." }` 提交的 `generated` 內容與草案驗證不符（角色非 active 成員 / 職業或等級不符 slot / `leader_character_id` 不在 assignments 中）
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非幹部或會長
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `404` - `{ "code": "GUILD_MATCH_DRAFT_NOT_FOUND", "error": "..." }` 草案不存在
- `409` - `{ "code": "GUILD_MATCH_DRAFT_REVISION_CONFLICT", "error": "..." }` `draft_revision` 與目前草案不符
- `500` - 伺服器錯誤

---

### GET /api/v2/guilds/:id/me/calendar
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

**Error Codes:**
- `400` - `{ "error": "invalid guild id" }` 公會 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "INSUFFICIENT_PERMISSION", "error": "..." }` 非公會成員
- `404` - `{ "code": "GUILD_NOT_FOUND", "error": "..." }` 公會不存在
- `500` - 伺服器錯誤

---

