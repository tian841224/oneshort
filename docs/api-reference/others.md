# API 參考 - 其他 (Others)

> 本檔為 [docs/api-reference.md](../api-reference.md) 拆分後的子模組文件，涵蓋 OCR、Bug 回報，以及未獨立成域的公開系統統計端點（在線人數／統計摘要／最近活動）。
> 共用的認證 Cookie 說明、WebSocket 協定與錯誤碼對照請見總覽頁。對應功能文件：[docs/features/others.md](../features/others.md)、[docs/features/online-stats.md](../features/online-stats.md)。

---

## 七、統計 (Stats)

### GET /api/v2/stats/online
取得在線人數

**Response 200:** `{ "count": 42 }`

**Error Codes:**
- `500` - `{ "code": "STATS_INTERNAL_ERROR", "error": "failed to load online count" }` 伺服器錯誤
- `503` - `{ "code": "STATS_UNAVAILABLE", "error": "stats service unavailable" }` 統計服務未就緒

---

### GET /api/v2/stats/summary
取得公開統計摘要 **[公開]**

**Response 200:** `PublicSummaryResponse`

**Error Codes:**
- `500` - `{ "code": "STATS_INTERNAL_ERROR", "error": "failed to load summary" }` 伺服器錯誤
- `503` - `{ "code": "STATS_UNAVAILABLE", "error": "stats service unavailable" }` 統計服務未就緒

---

### GET /api/v2/activity/recent
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


## 十一、OCR

### POST /api/v2/ocr/parse-screenshot
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

**Error Codes:**
- `400` - `{ "code": "OCR_INVALID_REQUEST", "error": "missing file field" }` 缺少 `file` 欄位 / 檔案讀取失敗 / 檔案為空
- `400` - `{ "code": "OCR_FILE_TOO_LARGE", "error": "file too large (max 5MB)" }` 檔案超過 5 MB
- `400` - `{ "code": "OCR_INVALID_IMAGE_TYPE", "error": "..." }` Content-Type 或圖片格式不符（僅接受 PNG/JPEG/WEBP）／magic bytes 驗證失敗
- `500` - `{ "code": "OCR_INTERNAL_ERROR", "error": "ocr analysis failed" }` OCR 解析失敗

---

### POST /api/v2/ocr/presign
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
- `400` - `{ "code": "OCR_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / 副檔名與 content type 不符
- `400` - `{ "code": "OCR_INVALID_IMAGE_TYPE", "error": "unsupported content type" }` 不支援的圖片格式
- `400` - `{ "code": "OCR_FILE_TOO_LARGE", "error": "file too large (max 5MB)" }` 檔案超過 5 MB
- `500` - `{ "code": "OCR_INTERNAL_ERROR", "error": "..." }` 產生唯一 key 或預簽 URL 失敗
- `503` - `{ "code": "OCR_STORAGE_UNAVAILABLE", "error": "storage is not configured" }` Storage 未設定

---


## 十二、Bug 回報

### POST /api/v2/bug-reports
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

**Error Codes:**
- `400` - `{ "code": "BUGREPORT_INVALID_REQUEST", "error": "..." }` 請求格式錯誤
- `500` - `{ "code": "BUGREPORT_INTERNAL_ERROR", "error": "failed to submit bug report" }` 伺服器錯誤

### GET /api/v2/bug-reports
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

**Error Codes:**
- `500` - `{ "code": "BUGREPORT_INTERNAL_ERROR", "error": "failed to list bug reports" }` 伺服器錯誤

### PATCH /api/v2/admin/bug-reports/{id}
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

**Error Codes:**
- `400` - `{ "code": "BUGREPORT_INVALID_REQUEST", "error": "invalid id" }` Bug report ID 格式錯誤
- `400` - `{ "code": "BUGREPORT_INVALID_REQUEST", "error": "..." }` 請求格式錯誤 / `status` 與 `developer_reply` 皆未提供 / 不支援的 `status` 值
- `404` - `{ "code": "BUGREPORT_NOT_FOUND", "error": "bug report not found" }` Bug report 不存在
- `500` - `{ "code": "BUGREPORT_INTERNAL_ERROR", "error": "failed to update bug report" }` 伺服器錯誤

---

