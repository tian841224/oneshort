# OneShort API 總覽

本文件提供 OneShort API 的分類與代表性端點，說明各類端點負責的功能範圍。完整端點細節由後端 Swagger 文件描述。

## 1. 基本資訊

- 所有 REST 端點統一掛在 `/api/v2` 前綴之下
- 需要身份的端點以 JWT（Cookie session）驗證；access token 過期時後端自動以 refresh token 輪替
- 部分端點開放未登入（公開查詢）或訪客（quick guest）流程
- 即時更新透過 WebSocket（`/ws`）推送，握手時同樣驗證 JWT
- 另提供健康檢查與 Prometheus metrics 端點供監控使用

## 2. API 分類與代表性端點

### Auth API

登入、身份確認與帳號綁定：

- `POST /api/v2/auth/quick-login` — 快速登入（角色代碼 + PIN）
- `GET /api/v2/auth/discord/callback` — Discord OAuth 回呼
- `POST /api/v2/auth/discord/link` / `link/merge` — 綁定 Discord 與帳號合併
- `GET /api/v2/actors/me` — 取得目前帳號與角色
- `PUT /api/v2/actors/me/pin`、`PUT /api/v2/actors/me/current-character`
- `POST /api/v2/auth/logout`

### Party API

隊伍建立、查詢、申請、席位與聊天：

- `GET /api/v2/parties`、`POST /api/v2/parties`、`GET/PATCH/DELETE /api/v2/parties/:id`
- `POST /api/v2/parties/:id/verify-password` — 密碼房驗證
- `POST /api/v2/parties/:id/applications`、`PATCH .../applications/:appId` — 申請與審核
- `GET /api/v2/applications/me` — 我的申請聚合
- `POST/PATCH/DELETE /api/v2/parties/:id/slots/...` — 席位管理與踢人
- `GET /api/v2/parties/:id/chat` — 隊伍聊天歷史
- `GET/POST/DELETE /api/v2/blocklist` — 黑名單
- `GET /api/v2/maps` — 練功地圖選項

### Guild API

公會、成員、公告、聊天與自動配對：

- `GET/POST /api/v2/guilds`、`GET/PUT/DELETE /api/v2/guilds/:id`
- `POST /api/v2/guilds/:id/join`、`PATCH .../join-requests/:rid` — 入會與審核
- `GET/POST /api/v2/guilds/:id/parties` — 公會隊伍
- `GET/POST/PUT/DELETE /api/v2/guilds/:id/announcements/...` — 公會公告
- `GET/POST /api/v2/guilds/:id/chat` — 公會聊天
- `GET/PUT /api/v2/guilds/:id/me/preferences` — 成員 BOSS / 時段偏好
- `POST /api/v2/guilds/:id/match`、`GET/PUT .../boss-configs` — 自動配對與 BOSS 設定
- `GET /api/v2/guilds/:id/me/calendar` — 個人公會行事曆

### Notify API

通知與即時連線：

- `GET /ws` — WebSocket 連線入口
- `GET /api/v2/notifications`、`GET .../unread-count`
- `PATCH /api/v2/notifications/:id/read`、`PATCH .../read-all`
- `DELETE /api/v2/notifications/:id`

### Announcement / Admin API

公告與管理端：

- `GET /api/v2/announcement`、`GET /api/v2/announcements` — 公開公告（最新一則 / active 列表）
- `GET /api/v2/notice` — NoticeBar 跑馬燈文字
- `GET /api/v2/admin/...` — 統計、封禁名單、隊伍 / 公會管理、公告維護（限管理員）
- `POST /api/v2/webhook/telegram` — Telegram Bot webhook

### 其他

- `POST /api/v2/bug-reports` — 問題回報
- `POST /api/v2/ocr/...` — OCR 截圖解析（目前停用）

## 3. WebSocket 契約摘要

- 握手驗證 JWT，成功後自動加入公共廣播與個人房間（`actor:{id}`）
- 客戶端可額外訂閱：`parties:global`、`lobby:chat`、自己有權限的 `party:{id}` 與 `guild:{id}` 房間；未授權的訂閱直接回錯誤
- 事件內容包含隊伍狀態變更、成員異動、聊天訊息、通知等；前端據此做局部更新

## 4. API 設計方向

- 一般資料互動透過 HTTP API 完成；需要同步更新的場景搭配即時事件
- 各 API 模組對應不同業務領域，避免職責混雜
- 列表型回應盡量帶齊渲染所需資料（如公會隊伍列表附席位），減少 N+1 請求
- 寫入型操作在後端以資料庫交易保護一致性，並統一經由 Outbox 發布事件
