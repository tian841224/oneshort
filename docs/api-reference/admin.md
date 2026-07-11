# API 參考 - 管理員 (Admin)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋管理員後台端點（會員/隊伍/公會管理、封禁），以及系統公告／NoticeBar 的公開讀取與管理端點（公開讀取端點與管理端點屬同一功能，依 [docs/features/announcement.md](../features/announcement.md) 慣例合併說明，故不歸入 others.md）。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。

---

## 八、系統公告 (Announcements)

### GET /api/v2/announcement
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

### GET /api/v2/announcements
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

### GET /api/v2/notice
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


## 十、管理員 (Admin)

### GET /api/v2/admin/stats
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

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to get stats" }` 伺服器錯誤

---

### GET /api/v2/admin/banlist
取得封禁清單 **[需認證，管理員]**

**Response 200:** `{ "data": [ /* BanEntry */ ] }`

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to list bans" }` 伺服器錯誤

---

### POST /api/v2/admin/banlist
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

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `409` - `{ "code": "ADMIN_CONFLICT", "error": "User already has an active ban" }` 該使用者已有有效封禁
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to create ban" }` 伺服器錯誤

---

### DELETE /api/v2/admin/banlist/:id
移除封禁 **[需認證，管理員]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "invalid ban id" }` 封禁記錄 ID 格式錯誤
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to delete ban" }` 伺服器錯誤

---

### GET /api/v2/admin/members
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

### GET /api/v2/admin/members/:actorId
取得會員帳號明細 **[需認證，管理員]**

回傳帳號、角色清單、該帳號角色開啟的房間，以及該帳號角色加入或申請過的隊伍歷史。

**Response 200:** `{ "data": { "account": { /* MemberSummary */ }, "characters": [ /* MemberCharacter */ ], "opened_parties": [ /* MemberParty */ ], "party_history": [ /* MemberPartyHistory */ ] } }`

---

### POST /api/v2/admin/members/:actorId/ban
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

### DELETE /api/v2/admin/members/:actorId/ban
啟用會員帳號 **[需認證，管理員]**

移除該 actor 的 banlist 記錄並將 `actors.is_banned=false`。

**Response 204:** No Content

---

### DELETE /api/v2/admin/members/:actorId/discord
清除會員 Discord 綁定 **[需認證，管理員]**

若帳號沒有 Quick Login PIN，回傳 409，管理員需先重設 PIN 以避免帳號失去登入方式。

**Response 204:** No Content

---

### PUT /api/v2/admin/members/:actorId/pin
重設會員 PIN **[需認證，管理員]**

**Request Body:**
```json
{
  "pin": "1234"
}
```

**Response 204:** No Content

---

### PATCH /api/v2/admin/members/:actorId/characters/:characterId
修改會員角色 **[需認證，管理員]**

**Request Body:** 任意組合的 `game_name`、`character_code`、`job_class`、`level`、`is_active`。

**Response 200:** `{ "data": { /* MemberCharacter */ } }`

---

### DELETE /api/v2/admin/members/:actorId/characters/:characterId
刪除會員角色 **[需認證，管理員]**

沿用角色 soft delete，將 `characters.is_active=false`。

**Response 204:** No Content

---

### GET /api/v2/admin/parties
取得管理員隊伍清單 **[需認證，管理員]**

**Response 200:** `{ "data": [ /* Party summary */ ] }`

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to list parties" }` 伺服器錯誤

---

### DELETE /api/v2/admin/parties/:id
強制關閉隊伍 **[需認證，管理員]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to close party" }` 伺服器錯誤

---

### GET /api/v2/admin/guilds
取得管理員公會清單 **[需認證，管理員]**

**Response 200:** `{ "data": [ /* Guild summary */ ] }`

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to list guilds" }` 伺服器錯誤

---

### DELETE /api/v2/admin/guilds/:id
強制解散公會 **[需認證，管理員]**

**說明:**
- 將公會標記 inactive、移除成員並關閉公會限定隊伍。

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "invalid guild id" }` 公會 ID 格式錯誤
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to disband guild" }` 伺服器錯誤

---

### GET /api/v2/admin/announcements
取得管理員公告列表 **[需認證，管理員]**

**Response 200:** 同公開公告列表格式。

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to get announcements" }` 伺服器錯誤

---

### GET /api/v2/admin/announcement
取得管理員主要公告 **[需認證，管理員]**

**Response 200:** 同公開主要公告格式。

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to get announcement" }` 伺服器錯誤

---

### POST /api/v2/admin/announcement
新增公告 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "公告內容",
  "priority": 0
}
```

**Response 201:** `{ "data": { /* Announcement */ } }`

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / 內容為空
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to add announcement" }` 伺服器錯誤

---

### PUT /api/v2/admin/announcement
覆寫主要公告 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "公告內容"
}
```

**Response 200:** `{ "data": { /* Announcement */ } }`

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / 內容為空
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to update announcement" }` 伺服器錯誤

---

### DELETE /api/v2/admin/announcement/:id
刪除指定公告 **[需認證，管理員]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "invalid id" }` 公告 ID 格式錯誤
- `404` - `{ "code": "ADMIN_NOT_FOUND", "error": "announcement not found" }` 公告不存在
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to delete announcement" }` 伺服器錯誤

---

### DELETE /api/v2/admin/announcement
清除公告 **[需認證，管理員]**

**Response 204:** No Content

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to clear announcement" }` 伺服器錯誤

---

### GET /api/v2/admin/notice
取得管理員 NoticeBar 內容 **[需認證，管理員]**

**Response 200:** 同公開 NoticeBar 格式。

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to get notice" }` 伺服器錯誤

---

### PUT /api/v2/admin/notice
覆寫 NoticeBar 內容 **[需認證，管理員]**

**Request Body:**
```json
{
  "content": "NoticeBar 文字"
}
```

**Response 200:** `{ "data": { /* Notice */ } }`

**Error Codes:**
- `400` - `{ "code": "ADMIN_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / 內容為空
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to update notice" }` 伺服器錯誤

---

### DELETE /api/v2/admin/notice
清除 NoticeBar 內容 **[需認證，管理員]**

**Response 204:** No Content

**Error Codes:**
- `500` - `{ "code": "ADMIN_INTERNAL_ERROR", "error": "failed to clear notice" }` 伺服器錯誤

---

