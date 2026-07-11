# API 參考 - 隊伍 (Party)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋隊伍、快速隊伍、訪客一般隊伍互通（[ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md)）、攻略/小工具、席位、封鎖清單與組隊選項端點。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。對應功能文件：[docs/features/party.md](../features/party.md)。

---

## 二、隊伍 (Parties)

### GET /api/v2/parties
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

### POST /api/v2/parties
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
- `allow_quick_login_players` 預設值與申請阻擋規則詳見 [backend/docs/specs/party.md § CreateParty / Apply](../../backend/docs/specs/party.md#核心流程)。

**Response 201:**
```json
{
  "party": { /* Party 物件，含 viewer_capabilities */ },
  "slots": [ /* Slot 陣列 */ ]
}
```

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤（JSON bind 失敗）
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 建立公會隊伍時非公會成員
- `500` - `{ "code": "PARTY_CREATE_FAILED", "error": "failed to create party" }` 伺服器錯誤

---

### GET /api/v2/parties/:id
取得隊伍詳情 **[需認證]**

**Response 200:** Party 物件（含 slots、enriched 資訊及 `viewer_capabilities`）

- 審核房（`join_requires_approval=true`）對非成員一律可查看（不再要求已送出申請），只是 `channel` 會被清空；密碼房仍優先回 `403`。

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `403` - `{ "code": "PARTY_001", "message": "此隊伍需要密碼才能查看" }` 需要密碼才能查看（`apierror.CodePartyPasswordRequired`）
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員不可查看
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "party not found" }` 隊伍不存在
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "failed to get party" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/verify-password
驗證隊伍密碼 **[需認證]**

**Request Body:**
```json
{ "password": "abc123" }
```

**Response 200:** Party 物件（驗證成功後返回）

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 密碼格式錯誤或請求格式錯誤
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_002", "message": "密碼錯誤" }` 密碼不正確（`apierror.CodePartyInvalidPassword`）
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員不可驗證
- `404` - `{ "code": "RES_001", "message": "隊伍不存在" }` 隊伍不存在（`apierror.CodeResourceNotFound`）
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "failed to verify password" }` 伺服器錯誤

---

### PATCH /api/v2/parties/:id
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "..." }` 隊伍不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（read-only）
- `409` - `{ "code": "PARTY_REVISION_CONFLICT", "error": "..." }` 版本衝突
- `409` - `{ "code": "PARTY_QUICK_BUSY", "error": "..." }` 快速隊伍暫時忙碌（併發鎖定，可重試）
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "failed to update party" }` 伺服器錯誤

---

### PUT /api/v2/parties/:id
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗 / slot 數超過 6 / 隊長 slot 缺失
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "unauthorized" }` 未認證
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "..." }` 隊伍不存在
- `409` - `{ "code": "PARTY_REVISION_CONFLICT", "error": "party revision conflict" }` 一般版本衝突
- `409` - `{ "code": "PARTY_SLOT_CONFLICT", "error": "...", "party": ..., "conflicts": [...] }` slot 級硬衝突
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（read-only）
- `409` - `{ "code": "PARTY_QUICK_BUSY", "error": "..." }` 快速隊伍暫時忙碌（併發鎖定，可重試）
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "failed to replace party" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/reopen
重新顯示手動隱藏的隊伍 **[需認證，隊長]**

**說明:**
- 等同於送出 `PATCH /api/v2/parties/:id` 並帶上 `is_temporarily_closed=false`
- 會將 `HIDDEN` 隊伍重新顯示為 `RECRUITING` 或 `ACTIVE`
- 對已是公開狀態的隊伍可視為冪等操作；`CLOSED` 唯讀快照不應依賴此端點恢復

**Response 200:** 更新後的 Party 物件

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "..." }` 隊伍不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（read-only）
- `409` - `{ "code": "PARTY_QUICK_BUSY", "error": "..." }` 快速隊伍暫時忙碌（併發鎖定，可重試）

---

### DELETE /api/v2/parties/:id
解散隊伍（設為 DISBANDED）**[需認證，隊長]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉或已解散（stale no-op）

---

### DELETE /api/v2/parties/:id/my-membership
退出自己的隊伍 **[需認證，隊伍成員]**

**說明:**
- 隊員呼叫時會離開自己的席位
- 隊長呼叫時等同 `DELETE /api/v2/parties/:id`
- 來自閒置提醒的過期操作會維持靜默 no-op，由前端依 `code` 判斷

**Response 204:** No Content

**Error Codes:**
- `403` - `{ "code": "PARTY_IDLE_ACTION_NOT_PARTICIPANT" }` 呼叫者已不在隊伍中
- `404` - `{ "code": "PARTY_IDLE_ACTION_NOT_FOUND" }` 隊伍已不存在
- `409` - `{ "code": "PARTY_IDLE_ACTION_ALREADY_CLOSED" }` 隊伍已關閉或已解散（stale no-op）

---

### POST /api/v2/parties/quick
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
  "guest_display_name": "遊客名稱",
  "guest_job_class_id": 112,
  "guest_level": 150
}
```

**說明:**
- `room_type` 必填，`OPEN` / `APPROVAL` / `PASSWORD` 三選一；`PASSWORD` 房需附 `join_password`（最長 6 碼）。
- 未登入呼叫時會建立 quick guest identity（cookie），`guest_display_name` 作為遊客顯示名稱（最長 20 字）。
- `guest_job_class_id`/`guest_level` 選填，僅用來讓 HOST slot 的訪客顯示卡片帶職業/等級快照（回應 `slots[].filled_by_job`/`filled_by_level`/`filled_by_is_guest`），前端渲染方式比照一般隊伍訪客成員；不影響加入判斷（見 `quick-join` 說明）。兩者需同時提供才會生效，缺任一項時維持舊行為（僅顯示暱稱）。
- 建立者自動成為快速隊伍 HOST participant。

**Response 201:** `QuickPartyResponse`（`{ "party": Party, "viewer_capabilities": {...}, "guest": {...} }`）

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗（如密碼長度、暱稱長度）
- `429` - `{ "code": "RATE_001", "message": "請求過於頻繁，請稍後再試" }` 建立頻率限制
- `500` - `{ "code": "PARTY_QUICK_GUEST_FAILED", "error": "failed to prepare quick guest" }` 建立訪客身分失敗
- `500` - `{ "code": "PARTY_QUICK_CREATE_FAILED", "error": "failed to create quick party" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/quick-enter
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `403` - `{ "code": "PARTY_PASSWORD_REQUIRED", "error": "..." }` 需要密碼
- `403` - `{ "code": "PARTY_INVALID_PASSWORD", "error": "..." }` 密碼錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 無法檢視此快速隊伍
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉
- `409` - `{ "code": "PARTY_FULL", "error": "..." }` 隊伍已滿或狀態不可進入
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/quick-join
加入快速隊伍或建立快速隊伍申請 **[快速隊伍，可使用 quick guest cookie]**

**Request Body:**
```json
{
  "guest_display_name": "遊客名稱",
  "slot_order": 2,
  "join_password": "123456",
  "guest_job_class_id": 112,
  "guest_level": 150
}
```

**說明:**
- `quick-join` 是快速隊伍唯一的加入/申請操作；前端列表預覽的「加入隊伍」與詳情空位列都必須呼叫此 endpoint。
- OPEN 房直接加入最低可用空位；若指定 `slot_order`，該空位必須存在且可用。
- PASSWORD 房需要正確 `join_password`，成功後加入空位並回傳成員能力。
- APPROVAL 房只建立 pending application，不自動佔位，也不應自動導向成員視角；申請當下提供的 `guest_job_class_id`/`guest_level` 會隨申請一併保存，待 HOST 核准時原封不動套用到最終佔用的空位（訪客沒有 characters 列可查，核准當下無法重新索取）。
- 快速隊伍 slot 不支援職業、等級或是否必填條件；加入判斷只看空位是否開啟且未佔用。`guest_job_class_id`/`guest_level` 純粹是佔用後的顯示快照（同 `POST /parties/quick`），不會篩選誰能加入。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / 指定 slot order 無效
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `403` - `{ "code": "PARTY_PASSWORD_REQUIRED", "error": "..." }` 需要密碼
- `403` - `{ "code": "PARTY_INVALID_PASSWORD", "error": "..." }` 密碼錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 無法加入此快速隊伍
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或狀態不可加入
- `409` - `{ "code": "PARTY_FULL", "error": "..." }` 隊伍已滿、已加入或已有待審申請
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/quick-leave
離開快速隊伍 **[快速隊伍成員，使用 quick guest cookie 或登入身分]**

**說明:**
- 成員（非 HOST）離開快速隊伍，釋放原本佔用的空位。
- HOST 不可用此 endpoint 離開；請改用 `quick-close` 關閉房間。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 呼叫者不是此快速隊伍成員
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### GET /api/v2/parties/:id/quick-applications
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍 HOST
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### PATCH /api/v2/parties/:id/quick-applications/:appId
審核快速隊伍申請 **[快速隊伍 HOST]**

**Request Body:**
```json
{ "action": "accept" }
```

- `action` 只接受 `accept` / `reject`。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` action 無效 / 請求格式錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍 HOST
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍或申請不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 申請已被處理 / 隊伍已滿或已關閉
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### DELETE /api/v2/parties/:id/quick-applications/me
取消自己的快速隊伍申請 **[使用 quick guest cookie 或登入身分]**

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在、不是快速隊伍或沒有待審申請
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### PATCH /api/v2/parties/:id/quick-settings
更新快速隊伍房間設定 **[快速隊伍建立者 cookie]**

**說明:**
- 只允許快速隊伍房主更新房名、備註、房型、密碼、頻道、是否在卡片顯示頻道等房間設定。
- 不用於更新 slot 條件；快速隊伍不支援隊員條件。
- 既有密碼房未提供 `join_password` 時會保留原密碼。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍房主
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或版本狀態不可更新
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### PUT /api/v2/parties/:id/quick-settings
取代快速隊伍設定與空位開關 **[快速隊伍建立者 cookie]**

**說明:**
- 只允許快速隊伍房主取代房間設定與空位開關。
- slot payload 只代表空位是否存在/開啟與已佔用狀態；`job_class`、`job_classes`、`min_level`、`max_level`、空位 `note`、`is_required` 不接受作為隊員條件。
- 後端會清除或忽略快速隊伍 slot 條件，並以保留的 slot 數量推導 `max_members`。
- 已佔用 slot 不能透過 settings 直接清空；需沿用 kick/leave flow。
- 取代設定時會保留既有 quick participant 與 occupied slot runtime snapshot，避免登入角色或遊客顯示資料被覆蓋成空資料。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` slot 數超過限制 / 嘗試用 settings 清空已佔用 slot
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍房主
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或狀態不可更新（含版本衝突）
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/quick-slots/:slotId/kick
踢出快速隊伍空位上的成員 **[快速隊伍 HOST]**

**說明:**
- 對應一般隊伍的 `POST /parties/:id/slots/:slotId/kick`；快速隊伍必須使用本路徑。

**Response 200:** `QuickPartyResponse`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 隊伍 ID 或 slot ID 格式錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍 HOST
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍或 slot 不存在、不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` slot 未被佔用或隊伍已關閉
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/quick-close
關閉快速隊伍 **[快速隊伍 HOST]**

**說明:**
- HOST 主動關閉房間；關閉後隊伍進入唯讀狀態，成員與訪客不可再加入或發言。

**Response 200:** `Party`

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 不是快速隊伍 HOST
- `404` - `{ "code": "PARTY_QUICK_NOT_FOUND", "error": "not found" }` 隊伍不存在或不是快速隊伍
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "quick party action failed" }` 伺服器錯誤

---

### 訪客一般即時隊伍互通 (Guest Standard Party Interop, [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md))

以下 `guest-*` 端點只適用「一般即時公開隊伍」（`scheduled_at=null`、非公會、非 quick）。已登入使用者呼叫同一端點會直接委派給對應的一般 actor 端點，行為等價；未登入訪客則以 `quick_guest_token` cookie（24h HttpOnly）識別，帳號不落 Postgres，資料以 Redis snapshot 呈現（`leader_guest_*`、`filled_by_is_guest`、`applicant_is_guest`/`guest_applicant` 欄位）。

### POST /api/v2/parties/guest
訪客建立一般即時公開隊伍並自動擔任隊長 **[免登入；登入者呼叫時等價於 `POST /parties`]**

**Request Body:**
```json
{
  "type": "GROUP",
  "title": "速刷炎魔",
  "target_name": "炎魔",
  "channel": "7",
  "max_members": 4,
  "recruit_until": "2026-07-07T13:00:00Z",
  "active_until": "2026-07-08T13:00:00Z",
  "slots": [
    { "slot_order": 1, "job_class": null, "min_level": null, "max_level": null, "is_required": false },
    { "slot_order": 2, "job_class": null, "min_level": null, "max_level": null, "is_required": false }
  ],
  "leader_slot_order": 1,
  "guest_display_name": "遊客名稱",
  "guest_job_class_id": 3,
  "guest_level": 120
}
```

**說明:**
- 後端強制 `scheduled_at=null`、`guild_id=null`、`visibility=PUBLIC`、`is_quick=false`，即便請求帶了排程/公會欄位也會被忽略。
- `guest_display_name`／`guest_job_class_id`／`guest_level` 三者皆須提供（或先前已透過其他 `guest-*` 呼叫存在 Redis session 中）；缺少時回 400。
- `leader_slot_order` 指定哪個 slot 是隊長席位（預設 1），該 slot 不可預先指定 `filled_by`。
- 訪客一次只能持有一場進行中的即時活動（Redis 鎖 `quick:guest:activity:{guestID}`），衝突回 409。

**Response 201:** `{ "party": Party, "slots": Slot[] }`（`party.leader_guest_id`/`leader_guest_name`/`leader_guest_job`/`leader_guest_level` 已填）

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗（含 `leader_slot_order` 無對應 slot、slot 預填角色）
- `400` - `{ "code": "PARTY_GUEST_PROFILE_REQUIRED", "error": "..." }` 訪客暱稱/職業/等級未齊備
- `409` - `{ "code": "PARTY_APPLICATION_ACTIVITY_CONFLICT", "error": "..." }` 訪客已在其他進行中活動
- `500` - `{ "code": "PARTY_CREATE_FAILED", "error": "..." }` 伺服器錯誤

---

### POST /api/v2/parties/:id/guest-applications
訪客申請一般即時公開隊伍 **[免登入；登入者呼叫時等價於 `POST /parties/:id/applications`]**

**Request Body:**
```json
{
  "target_slot_id": "uuid",
  "join_password": "123456",
  "guest_display_name": "遊客名稱",
  "guest_job_class_id": 3,
  "guest_level": 120
}
```

**說明:**
- 隊伍必須是即時、公開、非 quick；`allow_quick_login_players=false` 時拒絕（語意已擴張為同時涵蓋訪客與未綁 Discord actor）。
- 訪客申請 actor 建立的隊伍、actor 申請訪客建立的隊伍皆合法（雙向互通）。
- `join_requires_approval=false` 時自動接受並取得 slot；`=true` 時建立 PENDING 申請待隊長審核。

**Response 201:** `Application`（`applicant_is_guest=true`、`guest_applicant` 填暱稱/職業/等級）

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `400` - `{ "code": "PARTY_GUEST_PROFILE_REQUIRED", "error": "..." }` 訪客資料未齊備
- `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }` 目標隊伍非「即時公開非 quick」
- `403` - `{ "code": "PARTY_PASSWORD_REQUIRED", "error": "..." }` / `{ "code": "PARTY_INVALID_PASSWORD", "error": "..." }` 密碼相關
- `409` - `{ "code": "PARTY_QUICK_LOGIN_NOT_ALLOWED", "error": "..." }` `allow_quick_login_players=false`
- `409` - `{ "code": "PARTY_APPLICATION_ACTIVITY_CONFLICT", "error": "..." }` 訪客已在其他進行中活動
- `409` - `{ "code": "PARTY_ALREADY_IN_PARTY", "error": "..." }` / `{ "code": "PARTY_FULL", "error": "..." }` 已在隊或已滿

---

### GET /api/v2/parties/:id/guest-applications
訪客隊長查看申請列表 **[訪客隊長 cookie；登入者呼叫時等價於 `GET /parties/:id/applications`]**

**Response 200:** `Application[]`

**Error Codes:**
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 非此隊伍隊長
- `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }` 非即時公開非 quick 隊伍
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "..." }` 隊伍不存在

---

### PATCH /api/v2/parties/:id/guest-applications/:appId
訪客隊長審核申請 **[訪客隊長 cookie；登入者呼叫時等價於 `PATCH /parties/:id/applications/:appId`]**

**Request Body:** `{ "action": "accept" }`（`accept` / `reject`）

**說明:**
- 申請人可能是訪客或 actor，審核邏輯與活動鎖分支依申請人自身身分（`applicant_is_guest`）判斷，與隊伍隊長是誰無關。

**Response 200:** `{ "status": "success" }`

**Error Codes:** 同 `PATCH /parties/:id/applications/:appId`，另加 `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }`

---

### DELETE /api/v2/parties/:id/guest-applications/me
訪客取消自己的待審申請 **[免登入，quick_guest_token cookie；登入者呼叫時等價於一般取消申請]**

**Response 204**

**Error Codes:**
- `404` - `{ "code": "PARTY_APPLICATION_NOT_FOUND", "error": "..." }` 找不到待審申請

---

### POST /api/v2/parties/:id/guest-slots/:slotId/kick
訪客隊長／成員移除槽位 **[訪客隊長或槽位本人 cookie；登入者呼叫時等價於 `POST /parties/:id/slots/:slotId/kick`]**

**說明:**
- 隊長可踢出其他任意成員（含 actor 成員）；非隊長訪客只能移除自己的槽位（自願離開）。
- 隊長不可透過此端點移除自己的隊長槽位。

**Response 204**

**Error Codes:**
- `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }` 無權限踢出該槽位
- `403` - `{ "code": "PARTY_LEADER_CANNOT_KICK_SELF", "error": "..." }` 嘗試移除隊長槽位
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉

---

### DELETE /api/v2/parties/:id/guest-membership
訪客離開隊伍 **[免登入，quick_guest_token cookie；登入者呼叫時等價於 `DELETE /parties/:id/my-membership`]**

**說明:**
- 隊長呼叫等同解散隊伍（`guest-close`）；一般成員呼叫等同移除自己的槽位。

**Response 204**

**Error Codes:** 同 idle-action 系列（`PARTY_IDLE_ACTION_NOT_FOUND`／`PARTY_IDLE_ACTION_ALREADY_CLOSED`／`PARTY_IDLE_ACTION_NOT_PARTICIPANT`），另加 `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }`

---

### POST /api/v2/parties/:id/guest-close
訪客隊長關閉隊伍 **[訪客隊長 cookie；登入者呼叫時等價於 `DELETE /parties/:id`]**

**Response 204**

**Error Codes:** 同 idle-action 系列，另加 `403` - `{ "code": "PARTY_LEADER_ONLY", "error": "..." }`

---

### POST /api/v2/parties/:id/guest-liveness
訪客確認隊伍存續 **[訪客參與者 cookie；登入者呼叫時等價於 `POST /parties/:id/liveness`]**

**Response 200:** `{ "status": "confirmed" }`

**Error Codes:** 同 idle-action 系列

---

### PATCH /api/v2/parties/:id/guest-settings
訪客隊長更新隊伍安全設定 **[訪客隊長 cookie；登入者呼叫時等價於 `PATCH /parties/:id`]**

**說明:**
- 只允許更新標題、備註、頻道、密碼、是否需審核、`allow_quick_login_players` 等安全欄位；`scheduled_at`/`scheduled_at_is_now` 一律拒絕（`PARTY_GUEST_IMMEDIATE_ONLY`）。

**Response 200:** `Party`

**Error Codes:** 同 `PATCH /parties/:id`，另加 `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }`

---

### PUT /api/v2/parties/:id/guest-settings
訪客隊長取代隊伍設定 **[訪客隊長 cookie；登入者呼叫時等價於 `PUT /parties/:id`]**

**說明:**
- `scheduled_at`/`scheduled_at_is_now` 一律拒絕。
- `slots[].filled_by` 只能設為隊伍**現有成員**（訪客隊長無法像 actor 隊長一樣以「本人擁有其他角色」放行未參與者），欲加入新成員必須走申請/接受流程。

**Response 200:** `Party`

**Error Codes:** 同 `PUT /parties/:id`，另加 `403` - `{ "code": "PARTY_GUEST_IMMEDIATE_ONLY", "error": "..." }`

---

### POST /api/v2/parties/guest-claim
登入後認領訪客隊伍 **[需認證]**

**說明:**
- 伺服器端讀取 `quick_guest_token` cookie（前端不需、也無法讀取此 HttpOnly cookie 的內容），把訪客名下的一般即時隊伍與 quick party 身分改寫為目前登入使用者；每筆隊伍各自 best-effort，單一失敗不影響其他隊伍，整個操作冪等可重試。
- 沒有訪客 cookie 時回 204。
- 認領成功後會清除 `quick_guest_token` cookie。

**Response 200:**
```json
{
  "claimed": [{ "party_id": "uuid", "kind": "standard", "role": "leader" }],
  "skipped": [{ "party_id": "uuid", "reason": "ACTIVITY_CONFLICT" }],
  "warnings": [{ "party_id": "uuid", "code": "SLOT_REQUIREMENT_MISMATCH" }]
}
```
- `kind`: `"quick"` | `"standard"`；`role`: `"leader"` | `"member"` | `"applicant"`
- `skipped[].reason`: `NO_CHARACTER`（登入者無目前角色）／`ACTIVITY_CONFLICT`（已在其他進行中活動）／`PARTY_CLOSED`／`LOCK_BUSY`
- `warnings[].code`: `SLOT_REQUIREMENT_MISMATCH`（角色不符合原 slot 職業/等級限制，仍完成認領，不自動逐出）

**Response 204:** 無訪客 cookie

**Error Codes:**
- `500` - `{ "code": "PARTY_INTERNAL_ERROR", "error": "failed to claim guest parties" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/applications
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
- `allow_quick_login_players=false` 阻擋規則詳見 [backend/docs/specs/party.md § Apply / ReviewApplication](../../backend/docs/specs/party.md#核心流程)。

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
- `400` - `{ "code": "PARTY_APPLICATION_VALIDATION_FAILED", "error": "..." }` 欄位驗證失敗
- `400` - `{ "code": "PARTY_INVALID_TARGET_SLOT", "error": "指定的位置不存在於此隊伍" }` 指定的 `target_slot_id` 不屬於此隊伍
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_PASSWORD_REQUIRED", "error": "..." }` 需要密碼才能申請
- `403` - `{ "code": "PARTY_INVALID_PASSWORD", "error": "..." }` 密碼錯誤
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員不可申請
- `403` - `{ "code": "PARTY_APPLICATION_FORBIDDEN", "error": "forbidden" }` 隊伍已關閉或已解散（不可申請）
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "party not found" }` 隊伍不存在
- `409` - `{ "code": "PARTY_NOT_RECRUITING", "error": "隊伍目前未在招募中" }` 隊伍非招募中狀態
- `409` - `{ "code": "PARTY_ALREADY_IN_PARTY", "error": "角色已在隊伍中，或是已有正在進行的申請" }` 角色已在隊伍中或已有進行中的申請
- `409` - `{ "code": "PARTY_FULL", "error": "隊伍或位置已額滿" }` 隊伍或位置已額滿
- `409` - `{ "code": "PARTY_APPLICATION_ACTIVITY_CONFLICT", "error": "角色已在其他現在進行中的活動，請先退出後再申請" }` 角色已在活動中
- `409` - `{ "code": "PARTY_APPLICATION_BLOCKLISTED", "error": "由於黑名單限制，無法申請此隊伍" }` 黑名單限制
- `409` - `{ "code": "PARTY_QUICK_BUSY", "error": "系統忙碌中，請稍後再試" }` 快速隊伍暫時忙碌（併發鎖定，可重試）
- `409` - `{ "code": "PARTY_NO_COMPATIBLE_SLOT", "error": "目前沒有符合角色條件的空缺" }` 目前沒有任何符合條件的顯式空缺
- `409` - `{ "code": "PARTY_QUICK_LOGIN_NOT_ALLOWED", "error": "此隊伍未開放未綁 Discord 的快速登入玩家申請" }` 未綁 Discord、只能 quick login 的玩家不被此房間接受（`allow_quick_login_players=false`）
- `409` - `{ "code": "PARTY_APPLICATION_PENDING", "error": "已有待審核的申請，請等待審核結果或取消後再試" }` 已有待審核的申請（unique constraint）
- `500` - `{ "code": "PARTY_APPLICATION_INTERNAL_ERROR", "error": "failed to apply" }` 伺服器錯誤

---

### GET /api/v2/parties/:id/applications
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

**Error Codes:**
- `400` - `{ "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "error": "only party managers can list applications" }` 非隊長
- `403` - `{ "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "error": "party not found" }` 隊伍不存在
- `500` - `{ "error": "internal server error" }` 伺服器錯誤

---

### GET /api/v2/parties/:id/my-applications
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

**Error Codes:**
- `400` - `{ "error": "invalid party id" }` 隊伍 ID 格式錯誤
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "error": "..." }` 公會隊伍非公會成員
- `500` - `{ "error": "failed to list my applications" }` 伺服器錯誤

---

### GET /api/v2/applications/me
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

**Error Codes:**
- `401` - `{ "error": "invalid actor" }` 未認證
- `500` - `{ "error": "failed to list my applications" }` 伺服器錯誤

---

### PATCH /api/v2/parties/:id/applications/:appId
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
- `recruit_until` 刷新規則（accept 刷新、reject 不刷新）詳見 [backend/docs/specs/party.md § Apply / ReviewApplication](../../backend/docs/specs/party.md#核心流程)。

**Error Codes:**
- `400` - `{ "error": "invalid party id" }` / `{ "error": "invalid application id" }` ID 格式錯誤
- `400` - `{ "error": "application does not belong to party" }` 申請不屬於此隊伍
- `400` - `{ "error": "invalid action" }` action 無效
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "error": "only party managers can review applications" }` 非隊長
- `403` - `{ "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "error": "application or party not found" }` 申請或隊伍不存在
- `409` - `{ "error": "application review conflict" }` 申請已非 pending / slot 已被佔用 / 目前沒有相容空位 / 隊伍已滿或非招募中 / 角色已在隊伍中 / 申請者已在其他活動中（accept 時）
- `500` - `{ "error": "failed to review application" }` 伺服器錯誤

---

### DELETE /api/v2/parties/:id/applications/:appId
取消申請 **[需認證，申請者本人]**

**Response 204:** No Content

**Side Effects:**
- 取消申請不刷新 `recruit_until`（規則同 [backend/docs/specs/party.md § Apply / ReviewApplication](../../backend/docs/specs/party.md#核心流程)）。

**Error Codes:**
- `400` - `{ "error": "invalid party id" }` / `{ "error": "invalid application id" }` ID 格式錯誤
- `400` - `{ "error": "application does not belong to party" }` 申請不屬於此隊伍
- `401` - `{ "error": "invalid actor" }` 未認證
- `403` - `{ "error": "..." }` 公會隊伍非公會成員
- `403` - `{ "error": "..." }` 非申請者本人
- `404` - `{ "error": "application or party not found" }` 申請或隊伍不存在
- `500` - `{ "error": "failed to cancel application" }` 伺服器錯誤

---

### POST /api/v2/parties/:id/slots/:slotId/kick
踢出席位成員（或自願離開）**[需認證]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 隊伍 ID 或 slot ID 格式錯誤
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "invalid actor" }` 未認證
- `403` - `{ "code": "PARTY_FORBIDDEN", "error": "..." }` 非隊長（且非席位成員本人）/ 隊長不可踢出自己的角色
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "..." }` 隊伍不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（不可修改）

---

### POST /api/v2/parties/:id/liveness
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

### POST /api/v2/parties/:id/quick-liveness
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

### GET /api/v2/parties/:id/chat
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
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤 / `{ "error": "invalid limit" }` limit 參數錯誤
- `403` - `{ "code": "NOTIFY_CHAT_FORBIDDEN", "error": "not a member of this party" }` 非隊伍成員 / 非快速隊伍隊長或隊員
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to verify party membership" }` 成員資格檢查失敗
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to fetch chat history" }` 讀取聊天記錄失敗
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "service unavailable" }` 聊天服務未就緒

---

### POST /api/v2/parties/:id/chat
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
- `400` - `{ "code": "NOTIFY_INVALID_REQUEST", "error": "invalid party id" }` 隊伍 ID 格式錯誤 / `{ "error": "invalid chat payload" }` 請求格式錯誤
- `400` - `{ "code": "NOTIFY_CHAT_EMPTY", "error": "message cannot be empty" }` 內容為空
- `400` - `{ "code": "NOTIFY_CHAT_TOO_LONG", "error": "message too long (max 2000 characters)" }` 內容超過長度限制
- `403` - `{ "code": "NOTIFY_CHAT_FORBIDDEN", "error": "not a member of this party" }` 無發言權限
- `429` - `{ "code": "RATE_001", "message": "請求過於頻繁，請稍後再試" }` 發言頻率限制（全域寫入限流）
- `500` - `{ "code": "NOTIFY_CHAT_PERSIST_FAILED", "error": "failed to persist chat message" }` 訊息寫入失敗
- `500` - `{ "code": "NOTIFY_INTERNAL_ERROR", "error": "failed to send chat message" }` 伺服器錯誤
- `503` - `{ "code": "NOTIFY_SERVICE_UNAVAILABLE", "error": "service unavailable" }` 聊天服務未就緒

---

### GET /api/v2/actors/me/party-history
取得自己的組隊紀錄 **[需認證]**

- Query `limit`（預設 20，最大 100）、`offset`（預設 0）。
- 回傳目前 actor 以隊長或成員身分參與過的隊伍歷史，供 `/history` 頁使用。

**Response 200:** `{ "data": [ ... ] }`

---


## 二之一、攻略與小工具 (Guides & Widgets)

攻略模板由管理員撰寫，依 `raid_boss_option_id`（`BOSS` / `GROUP`）或 `target_map_id`（`TRAINING`）綁定目標；隊伍依其目標解析對應攻略。攻略內容含 widget 區塊，widget 的即時狀態存於 `party_guide_states`，以樂觀鎖 `revision` 控制並透過 WebSocket `party.guide_state.updated` 廣播給訂閱 `party:{id}` 的用戶端。

### GET /api/v2/parties/:id/guide
取得指定隊伍的攻略與所有 widget 狀態 **[需認證，隊伍成員]**

**Response 200:** `{ "guide": GuideTemplate | null, "states": PartyGuideState[] | null }`

### POST /api/v2/parties/:id/guide/state
更新單一 widget 狀態 **[需認證，隊伍成員]**

- Request：`{ "widget_id": string, "state": <任意 JSON>, "base_revision": number }`。
- `widget_id` 只驗證格式 `^[a-zA-Z0-9_-]{1,64}$` 與隊伍成員資格，**不要求存在於攻略中**——保留 id `party_member_colors`（隊員顏色）與 `widget_sessions`（小工具同步 session）即以此機制存放。
- `base_revision` 為樂觀鎖：與伺服器最新 `revision` 不符時回 `409`，body 帶最新狀態 `{ "latest": PartyGuideState }` 供前端 rebase 重送；建立新狀態時 `base_revision` 為 `0`。
- **Response 200:** `PartyGuideState`（含遞增後的 `revision`）。成功後發送 `party.guide_state.updated` 至 `party:{id}`。

### 管理員攻略端點 **[需認證，管理員]**
- `GET /api/v2/admin/guides` — 列出所有可綁定攻略的 BOSS/GROUP 選項與地圖目標。
- `GET /api/v2/admin/guides/by-boss/:bossOptionId`、`GET /api/v2/admin/guides/by-map/:mapId` — 取得指定目標的攻略。
- `PUT /api/v2/admin/guides/by-boss/:bossOptionId`、`PUT /api/v2/admin/guides/by-map/:mapId` — 建立或覆寫攻略：`{ "title": string, "content": GuideContent, "base_version"?: number, "is_published"?: boolean }`。
- `DELETE /api/v2/admin/guides/:guideId` — 刪除攻略模板。

---


## 三、席位 (Slots)

### POST /api/v2/parties/:id/slots
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "unauthorized" }` 未認證
- `403` - `{ "code": "PARTY_SLOT_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "party not found" }` 隊伍不存在
- `409` - `{ "code": "PARTY_SLOT_MAX_REACHED", "error": "..." }` 席位已達上限（6個）／新增後總 slot 數超過 6
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（不可修改）
- `500` - `{ "code": "PARTY_SLOT_INTERNAL_ERROR", "error": "failed to add slot" }` 伺服器錯誤

---

### PATCH /api/v2/parties/:id/slots/:slotId
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
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 隊伍 ID 或 slot ID 格式錯誤 / 請求格式錯誤
- `400` - `{ "code": "PARTY_SLOT_VALIDATION_FAILED", "error": "..." }` `filled_by` 若存在，必須是隊長擁有、已在隊伍中，或已對此隊伍送出 pending application 的角色
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "unauthorized" }` 未認證
- `403` - `{ "code": "PARTY_SLOT_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "party not found" }` 隊伍不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（不可修改）
- `500` - `{ "code": "PARTY_SLOT_INTERNAL_ERROR", "error": "failed to update slot" }` 伺服器錯誤

---

### DELETE /api/v2/parties/:id/slots/:slotId
刪除席位 **[需認證，隊長]**

**Response 204:** No Content

**Error Codes:**
- `400` - `{ "code": "PARTY_INVALID_REQUEST", "error": "..." }` 隊伍 ID 或 slot ID 格式錯誤
- `400` - `{ "code": "PARTY_SLOT_VALIDATION_FAILED", "error": "..." }` 席位有成員，需先踢出 / 不可刪除隊長目前佔用的席位
- `401` - `{ "code": "PARTY_UNAUTHORIZED", "error": "unauthorized" }` 未認證
- `403` - `{ "code": "PARTY_SLOT_LEADER_ONLY", "error": "..." }` 非隊長
- `403` - `{ "code": "PARTY_GUILD_MEMBERSHIP_REQUIRED", "error": "..." }` 公會隊伍非公會成員
- `404` - `{ "code": "PARTY_NOT_FOUND", "error": "party not found" }` 隊伍不存在
- `409` - `{ "code": "PARTY_ALREADY_CLOSED", "error": "..." }` 隊伍已關閉或已解散（不可修改）
- `500` - `{ "code": "PARTY_SLOT_INTERNAL_ERROR", "error": "failed to delete slot" }` 伺服器錯誤

---


## 六、封鎖清單 (Blocklist)

### GET /api/v2/blocklist
取得我的封鎖清單 **[需認證]**

**Query Parameters:** `character_id` (uuid, 角色 ID)

**Response 200:** `["uuid1", "uuid2", ...]`（被封鎖的角色 ID 列表）

---

### POST /api/v2/blocklist
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

### DELETE /api/v2/blocklist/:blocked_character_id
解除封鎖 **[需認證]**

**Response 204:** No Content

---


## 九、組隊選項

### GET /api/v2/raid-boss-options?type=BOSS|GROUP
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

### GET /api/v2/maps
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

