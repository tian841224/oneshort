# API 參考 - 通知與聊天 (Notify)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋全站通知與大廳聊天端點。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。對應功能文件：[docs/features/notify.md](../features/notify.md)。

---

## 四、通知 (Notifications)

### GET /api/v2/notifications
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

**Error Codes:**
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to list notifications" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### GET /api/v2/notifications/unread-count
取得未讀通知數量 **[需認證]**

**Response 200:** `{ "count": 3 }`

**Error Codes:**
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to count unread" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### PATCH /api/v2/notifications/:id/read
標記通知為已讀 **[需認證]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid notification id" }` 通知 ID 格式錯誤
- `404` - `{ "code": "NOTIFY_NOT_FOUND", "error": "notification not found" }` 通知不存在
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to mark read" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### PATCH /api/v2/notifications/read-all
全部標記為已讀 **[需認證]**

**Response 204:** No Content

**Error Codes:**
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to mark all read" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### DELETE /api/v2/notifications/:id
刪除通知 **[需認證]**

**Response 204:** No Content

**說明:**
- 只能刪除已讀通知；未讀通知呼叫此端點會回 `404`。

**Error Codes:**
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid notification id" }` 通知 ID 格式錯誤
- `404` - `{ "code": "NOTIFY_NOT_FOUND_OR_UNREAD", "error": "notification not found or not yet read" }` 通知不存在或尚未讀取
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to delete notification" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### DELETE /api/v2/notifications/read-all
刪除所有已讀通知 **[需認證]**

**Response 204:** No Content

**Error Codes:**
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to delete all read notifications" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "notification service unavailable" }` 通知服務未就緒

---

### GET /api/v2/lobby/chat
取得大廳聊天歷史 **[公開，無需認證]**

- Query `limit` 指定最近訊息筆數（預設 100，最大 100）；聊天歷史最久保留 24 小時。
- 登入者的 `sender` snapshot 會包含 `character_id`、`job_class_id`、`level`；訪客若已透過 `POST /api/v2/lobby/chat` 完成角色設定（見下方），`sender` 同樣包含 `job_class_id`、`level`，否則以「遊客」顯示。歷史訊息的 sender snapshot 在送出當下寫死，訪客事後修改角色資訊不會回填舊訊息（ADR-0025/ADR-0032 既有慣例）。
- 只讀（不發言）不需要任何角色設定，未完成角色設定的訪客仍可正常瀏覽歷史與即時訊息。

**Response 200:** `{ "data": [聊天訊息] }`

**Error Codes:**
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid limit" }` limit 參數錯誤
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to fetch lobby chat history" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "service unavailable" }` 聊天服務未就緒

---

### POST /api/v2/lobby/chat
傳送大廳聊天訊息 **[公開，無需認證]**

**Request Body:**
```json
{ "content": "有人要打王嗎？" }
```

**Request Body（訪客首次或需更新角色資訊時，可另帶）:**
```json
{
  "content": "有人要打王嗎？",
  "guest_display_name": "路人甲",
  "guest_job_class_id": 100,
  "guest_level": 30
}
```

**說明:**
- 訊息寫入公開歷史並透過 WebSocket 推送給訂閱大廳頻道的用戶端。
- 頻率限制：未登入者 10 秒 1 則，登入者 5 秒 1 則。
- 登入者：`sender` snapshot 包含目前角色的 `character_id`、`job_class_id`、`level`。
- 未登入訪客：首次無 `quick_guest_token` cookie 時，`guest_display_name` 為唯一嚴格必填欄位（用以建立既有 quick-guest session，與一般隊伍訪客流程共用，見 ADR-0015/ADR-0025），回應會 `Set-Cookie: quick_guest_token`；`guest_job_class_id`/`guest_level` 皆為可選欄位，缺席時請求仍會成功送出（僅暫時顯示為通用遊客）。之後的訊息可省略全部 3 個欄位，改用 cookie 內已儲存的 session（`quick_guest_token` 有效期內免重填）。訊息是否顯示完整職業/等級 pill，只看 session 是否已設定 `level`（`level==0` 視為未設定，`level` 合法值域為 `[1,200]`）；`guest_job_class_id`（含 `0`＝初心者/Beginner）本身不作為「是否已設定」的判斷依據，因為 `0` 是合法職業列舉值而非未設定的哨兵值。`level` 未設定時顯示通用「遊客」，已設定時比照登入玩家顯示 `job_class_id`/`level`（`job_class_id` 未提供則以初心者 0 顯示）。詳見 ADR-0032。

**Response 201:** 新建的聊天訊息物件

**Error Codes:**
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid chat payload" }` 請求格式錯誤
- `400` - `{ "code": "NOTIFY_CHAT_EMPTY", "error": "..." }` 內容為空
- `400` - `{ "code": "NOTIFY_CHAT_TOO_LONG", "error": "..." }` 內容超過長度限制（大廳聊天上限 500 字）
- `400` - `{ "code": "NOTIFY_CHAT_GUEST_PROFILE_INVALID", "error": "..." }` 訪客尚未設定角色資訊，或 `guest_job_class_id`/`guest_level` 未通過驗證
- `429` - `{ "code": "RATE_001", "message": "請求過於頻繁，請稍後再試" }` 發言頻率限制
- `500` - `{ "code": "NOTIFY_CHAT_PERSIST_FAILED", "error": "failed to persist lobby chat" }` 訊息寫入失敗
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to rate limit lobby chat" }` 頻率限制檢查失敗
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "service unavailable" }` 聊天服務未就緒

---

