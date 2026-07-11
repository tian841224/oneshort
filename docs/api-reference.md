# OneShort API 參考文件 (API Reference)

> 完整 API 端點列表、請求格式、回應格式與錯誤碼說明。
> 詳細 OpenAPI 規格請見 `backend/docs/swagger.yaml`。
> 本文件為總覽頁：只保留跨模組共用的認證說明、WebSocket 協定與錯誤碼對照；各業務模組的端點詳情已拆分至下方子模組文件。

---

## 模組索引

| 模組 | 檔案 | 涵蓋範圍 |
|------|------|---------|
| 身份驗證與角色 | [auth.md](./api-reference/auth.md) | Actor 登入/會話（Quick Login、Discord OAuth、merge）、角色 CRUD、職業清單 |
| 隊伍 | [party.md](./api-reference/party.md) | 隊伍、快速隊伍、訪客一般隊伍互通、攻略/小工具、席位、封鎖清單、組隊選項 |
| 公會 | [guild.md](./api-reference/guild.md) | 公會、成員、公告、聊天室、公會限定隊伍、每週王團自動配對 |
| 通知 | [notify.md](./api-reference/notify.md) | 全站通知、大廳聊天 |
| 管理員 | [admin.md](./api-reference/admin.md) | 管理後台（會員/隊伍/公會管理、封禁）、系統公告與 NoticeBar |
| 其他 | [others.md](./api-reference/others.md) | OCR、Bug 回報、公開系統統計端點 |

---

## 認證說明

所有需認證的 API 會優先使用 Cookie 中的 `access_token`。登入成功後後端會同時設定 `access_token` 與 `refresh_token`：
- `access_token`：15 分鐘有效
- `refresh_token`：7 天滑動有效期；只要使用者持續有活動且未主動登出，後端會在 access token 失效時自動續期

前端不需要、也不應呼叫顯式 `/auth/refresh` 端點；受保護 API 會由後端 middleware 依 cookie 自動輪替 session。

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
  "type": "party.guide_state.updated",
  "room_id": "party:uuid",
  "payload": {
    "party_id": "uuid",
    "widget_id": "cnt-1",
    "state": { "v": 1, "total": 3 },
    "revision": 5,
    "updated_by": "actor-uuid",
    "updated_at": "2026-07-04T03:00:00Z"
  },
  "timestamp": "2026-07-04T03:00:00Z"
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

// 錯誤訊息（訂閱被拒 / 聊天頻率限制）
{
  "type": "error",
  "code": "NOTIFY_WS_UNAUTHORIZED_ROOM",
  "message": "unauthorized to subscribe to this room"
}

{
  "type": "error",
  "code": "NOTIFY_CHAT_RATE_LIMITED",
  "message": "lobby chat rate limited",
  "retry_after_ms": 4200
}

{
  "type": "error",
  "code": "NOTIFY_CHAT_TOO_LONG",
  "message": "message too long (max 2000 characters)"
}
```

`auth_success` 後 server 已自動加入當前 identity 的 personal room；登入 actor 會是 `actor:{actorId}`，未登入 quick guest 則以 `payload.room_id` 回傳 deterministic personal room。client 需訂閱 `parties:global` 與該 personal room，並在 reconnect 後重送仍有 listener 的 `party:{partyId}` 訂閱。
快速隊伍聊天仍以 `party:{partyId}` 作為房內主事件；後端會另外把同一個 `chat` payload 鏡射到可讀取聊天的 quick participant personal room，用於房外 toast，不會重複寫入聊天歷史。可讀取聊天的 quick participant 僅包含隊長與已加入的隊員，不包含 visitor 或 pending guest。

**WebSocket 錯誤訊息（`type: "error"`）:**
- `NOTIFY_WS_UNAUTHORIZED_ROOM` - 嘗試訂閱無權限的房間（非隊伍成員 / 非公會成員 / 未知房間格式）
- `NOTIFY_CHAT_RATE_LIMITED` - 大廳聊天頻率限制（未登入者 10 秒 1 則，登入者 5 秒 1 則），附 `retry_after_ms`
- `NOTIFY_CHAT_TOO_LONG` - 聊天內容超過長度限制（2000 字）
- 內容為空（`errChatMessageEmpty`）或訊息寫入失敗（`errChatPersistFailed`）時，伺服器僅記錄 log 並靜默略過，不會回傳 `type: "error"` 訊息。
- 連線數超過上限時，upgrade 請求本身會回 HTTP `429`（`{ "code": "RATE_002", "message": "WebSocket 連線數已達上限" }`，`apierror.CodeWSConnectionLimit`），而非透過已建立連線的 `type: "error"` 訊息。

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

> [!NOTE]
> 下表為常見/跨端點共用錯誤碼的精選清單，非完整列表。各端點實際回傳的完整錯誤碼請見該端點的 **Error Codes** 小節。
> 密碼相關錯誤碼目前有兩套並存的常數家族，依端點而異：`GET /parties/:id`、`POST /parties/:id/verify-password` 使用 `apierror` 套件的 `PARTY_001`（`CodePartyPasswordRequired`）／`PARTY_002`（`CodePartyInvalidPassword`）；`POST /parties/:id/applications` 與所有 `quick-*` 端點使用 `party` handler 套件內定義的字串常數 `PARTY_PASSWORD_REQUIRED`／`PARTY_INVALID_PASSWORD`。兩者語意相同但字面值不同，前端須依端點分別比對。

| Code | 說明 |
|------|------|
| `PARTY_001` | 需要隊伍密碼才能查看（`GET /parties/:id`，`apierror.CodePartyPasswordRequired`） |
| `PARTY_002` | 隊伍密碼錯誤（`POST /parties/:id/verify-password`，`apierror.CodePartyInvalidPassword`） |
| `PARTY_PASSWORD_REQUIRED` | 需要隊伍密碼（申請加入 / 快速隊伍系列端點） |
| `PARTY_INVALID_PASSWORD` | 隊伍密碼錯誤（申請加入 / 快速隊伍系列端點） |
| `PARTY_NOT_FOUND` | 隊伍不存在 |
| `PARTY_ALREADY_CLOSED` | 隊伍已關閉或已解散（read-only） |
| `PARTY_GUILD_MEMBERSHIP_REQUIRED` | 公會隊伍要求呼叫者為該公會成員 |
| `PARTY_QUICK_BUSY` | 快速隊伍併發鎖定中，可重試 |
| `PARTY_SLOT_CONFLICT` | 編輯隊伍時，某個 slot 在同一期間被其他操作填入、換人或占用，必須先同步最新隊伍後再重新確認 |
| `PARTY_REVISION_CONFLICT` | `PUT /parties/:id` 送出的 `revision` 與伺服器目前版本不符 |
| `PARTY_IDLE_ACTION_NOT_FOUND` / `PARTY_IDLE_ACTION_NOT_PARTICIPANT` / `PARTY_IDLE_ACTION_ALREADY_CLOSED` | 閒置提醒相關動作（liveness / 解散 / 退出）的 stale no-op 狀態碼 |
| `RATE_001` | 請求過於頻繁（全域寫入限流 / 聊天頻率限制，`apierror.CodeRateLimitExceeded`） |
| `RATE_002` | WebSocket 連線數已達上限（`apierror.CodeWSConnectionLimit`） |
| `RES_001` | 資源不存在（`apierror.CodeResourceNotFound`） |
| `REQ_001` | 請求參數錯誤（`apierror.CodeBadRequest`） |
| `GUILD_NOT_FOUND` / `GUILD_MEMBER_NOT_FOUND` / `GUILD_JOIN_REQUEST_NOT_FOUND` / `GUILD_ANNOUNCEMENT_NOT_FOUND` | 公會相關資源不存在 |
| `INSUFFICIENT_PERMISSION` | 公會操作權限不足（角色階級不允許） |
| `ALREADY_GUILD_MEMBER` / `ALREADY_IN_GUILD` | 已是公會成員 / 已加入公會或已有待審申請 |
| `GUILD_MATCH_DRAFT_REVISION_CONFLICT` | 公會自動配對草案 `draft_revision` 與目前草案不符 |
| `discord_merge_required` | Discord 已綁在另一個 actor，但目前狀態允許合併 |
| `discord_merge_blocked` | Discord 已綁在另一個 actor，但 target/source 目前仍有 blocker，不能合併 |
| `invalid_merge_token` | Discord merge token 已過期、已被使用或與目前登入 actor 不符 |
