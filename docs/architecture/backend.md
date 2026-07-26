# OneShort 後端架構

本文件描述 OneShort 後端的技術框架、服務拓樸、分層設計、認證模型與資料模型。

## 1. 後端定位

後端負責業務規則、資料一致性、權限判斷與即時事件產生，是整個平台的核心邏輯層。

## 2. 技術框架

| 分類 | 技術 |
|------|------|
| 語言與框架 | Go 1.24、Gin（HTTP 框架） |
| 資料庫 | PostgreSQL 16（GORM / sqlx 存取，SQL migration 管理 schema） |
| 快取與即時 | Redis 7 ×2 實例——cache（快取）與 realtime（Redis Streams 事件） |
| 即時通訊 | gorilla/websocket（WebSocket Gateway） |
| 身份驗證 | JWT（golang-jwt，Cookie session） |
| 可觀測性 | zap 結構化日誌、Prometheus metrics |
| API 文件 | Swagger（swaggo） |
| 檔案儲存 | AWS S3 |
| 外部整合 | Telegram Bot（管理端操作入口） |
| 測試 | testify、sqlmock、miniredis、mockery |

## 3. 服務拓樸

後端由多個角色組成，可依部署需求拆成獨立行程：

```text
Client
  ├─ REST /api/v2 ─▶ API Server
  └─ WebSocket /ws ─▶ WS Gateway

API Server
  ├─ PostgreSQL（業務資料）
  ├─ Redis cache（token、隊伍快取、索引）
  └─ Outbox Table（與業務寫入同交易）

Relay Worker
  └─ 將 outbox 事件發布到 Redis Streams

WS Gateway
  └─ 消費 Redis Streams，依房間推送給前端連線

System Worker
  ├─ 閒置隊伍警告與關閉
  ├─ 每日統計與快取預熱
  └─ 公會每週自動配對

Migrator
  └─ 唯一執行 SQL migration 與 seed 的角色；其他服務啟動時只驗證 schema
```

## 4. 專案結構與分層

```text
backend/
├── cmd/         # 各服務進入點（API server、migrator 等）
├── internal/    # 依領域切分的業務模組
│   ├── auth / user        # 身份驗證與角色管理
│   ├── party / partytarget # 隊伍、席位、申請、聊天與目標選項
│   ├── guild              # 公會、成員、公告、自動配對
│   ├── notify             # WebSocket、通知、房間路由
│   ├── activity / stats   # 活動排他鎖與統計
│   ├── admin / telegram   # 管理端與 Telegram Bot
│   └── bugreport / ocr / guide # 輔助模組
├── pkg/         # 共用套件
└── migrations/  # 資料庫 migration
```

每個請求依固定分層流動：

```text
Middleware（認證、限流）→ Handler（HTTP 層）→ UseCase（業務邏輯）→ Repository（資料存取）→ PostgreSQL / Redis
```

## 5. 認證模型

- 所有登入方式（Discord OAuth、快速登入）最終都解析成 `actor + current_character`；不再區分使用者型別
- JWT 以 Cookie 保存，claims 以 `actor_id` 為必要欄位，角色資訊為 optional
- access token 失效時，middleware 以 refresh token 自動輪替 session（舊 refresh token 先消費再簽發新的）
- `login_method` 只作審計與 UI 顯示用途，不作為授權依據
- 隊伍密碼以密文儲存，PIN 以加鹽（可另混入 server-side pepper）雜湊儲存

## 6. 資料模型（核心資料表）

| 表名 | 用途 |
|------|------|
| `actors` / `actor_auth_links` | 帳號層身份與外部登入方式綁定 |
| `characters` | actor 底下的遊戲角色 |
| `parties` / `party_slots` / `party_applications` | 隊伍主檔、席位與加入申請 |
| `maps` / `raid_boss_options` | 練功地圖與 BOSS / 團體目標選項 |
| `notifications` | actor 個人通知 |
| `activity_presence_locks` | 角色的活動排他鎖 |
| `outbox_events` | 事件外盒（Transactional Outbox） |
| `admin_announcements` / `admin_notices` | 平台公告與 NoticeBar |
| `ban_list` / `bug_reports` | 封禁名單與問題回報 |

公會相關（成員、偏好、BOSS 設定、配對紀錄）另有一組 guild 資料表。

## 7. Redis 使用方式

| 實例 | 用途 |
|------|------|
| cache Redis | refresh token、revoked token、隊伍快取與索引、立即隊伍的 Redis-only 儲存 |
| realtime Redis | Redis Streams（事件流）、聊天歷史、WebSocket fan-out |

立即（快速）隊伍以快取為主要儲存並帶 TTL，搭配索引讓背景工作能批次檢查閒置狀態，避免全 keyspace 掃描。

## 8. 房間（Room）模型

| Room | 用途 |
|------|------|
| `actor:{actor_id}` | 帳號層個人事件（申請結果、通知） |
| `party:{party_id}` | 隊伍事件與聊天 |
| `parties:global` | 全域隊伍列表刷新 |
| `lobby:chat` | 公開大廳聊天 |
| `guild:{guild_id}`（含幹部子房間） | 公會事件；入會審核通知只進幹部房間 |

- WebSocket 握手時驗證 JWT；連線建立後自動加入公共廣播與自己的個人房間
- 客戶端額外的訂閱請求會做授權檢查——只能訂閱公開房間、自己的個人房間與通過成員驗證的隊伍 / 公會房間

## 9. 設計原則

- 依領域模組化，將業務邏輯與資料存取責任分層
- 關鍵狀態變更與事件發布放在同一個資料庫交易內（Outbox 模式），維持一致性
- 對多人協作場景透過 Redis Streams + WebSocket 提供可同步的事件輸出
- 併發保護：活動排他鎖、資料庫交易內的容量檢查、事件去重
- 可觀測性內建：結構化日誌、Prometheus metrics、健康檢查端點
