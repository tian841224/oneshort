# OneShort 系統全覽 (System Overview)

> 本文件為整體系統架構說明，描述各服務的角色、技術選型與互動方式。

---

## 一、系統定位

**OneShort** 是一個即時遊戲組隊平台，讓玩家可以快速發佈或搜尋隊伍，進行 Boss 討伐、訓練地圖或一般組隊活動。
核心設計目標：

- **即時性**：成員加入、申請審核、隊伍解散等事件毫秒級推送給前端。
- **一致性**：透過 Transactional Outbox 確保資料庫操作與事件發布的原子性。
- **可擴展性**：前端（Next.js）與後端（Go Gin）獨立部署；WebSocket Gateway 可水平擴展。

---

## 二、整體架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                    │
│   Next.js 16 · React 19 · TanStack Query · Zustand         │
│                                                             │
│   HTTP/REST ──────────────► API Server (Go Gin :8080)      │
│   WebSocket ──────────────► WS Gateway (Go :8081)          │
└─────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────┐
          │                         │                      │
     ┌────▼────┐             ┌──────▼──────┐        ┌─────▼──────┐
     │Postgres │             │ Redis Cache │        │Redis Stream│
     │(Primary)│             │   :6379     │        │  :6380     │
     │(Replica)│             └─────────────┘        └─────┬──────┘
     └─────────┘                                          │
                                                    ┌─────▼──────┐
                                                    │Relay Worker│
                                                    │(Background)│
                                                    └────────────┘
```

---

## 三、服務說明

| 服務 | 語言/框架 | 職責 |
|------|----------|------|
| **API Server** | Go 1.24 + Gin | 處理所有 REST 請求；驗證 JWT；調用 UseCase 層 |
| **WS Gateway** | Go + gorilla/websocket | 管理 WebSocket 長連線；訂閱 Redis Stream 並轉發事件至對應 Room |
| **Relay Worker** | Go | 從 Outbox 讀取待發佈事件，寫入 Redis Stream `ws_events` |
| **Frontend** | Next.js 16 App Router | 提供使用者介面；透過 TanStack Query 管理 API 狀態；透過 Zustand 管理全域 UI 狀態 |
| **PostgreSQL 16** | 主從架構 | 持久化所有業務資料（用戶、隊伍、申請、通知等） |
| **Redis Cache** (:6379) | Redis 7 | 快取隊伍清單（版本化快取）、Redis ZSET expiry 追蹤 |
| **Redis Realtime** (:6380) | Redis 7 Streams | 跨服務事件傳遞；`ws_events` Stream；Chat 記錄 |

---

## 四、技術棧摘要

### 後端
- **框架**: Go 1.24 + Gin
- **ORM**: GORM + raw SQL (pgx/pq)
- **驗證**: JWT (access token + refresh token，存 cookie)
- **事件**: Transactional Outbox → Redis Streams
- **日誌**: Zap (structured logging)
- **指標**: Prometheus + Grafana
- **文件**: Swagger/OpenAPI（swaggo 自動生成）

### 前端
- **框架**: Next.js 16 (App Router) + React 19
- **型別**: TypeScript 5
- **狀態管理**: TanStack Query v5（伺服器狀態）+ Zustand（客戶端狀態）
- **表單**: React Hook Form + Zod validation
- **HTTP**: ky (Fetch 封裝)
- **UI**: Tailwind CSS v4 + shadcn/ui + Radix UI
- **測試**: Vitest

---

## 五、認證機制摘要

1. Discord OAuth 與 Quick Login 都會登入同一種 `actor` session，成功後寫入 `access_token` 與 `refresh_token` HttpOnly Cookie。
2. Quick Login 以 `character_code + pin` 建立或回訪 actor；首次建立時會同時建立 primary `characters` 資料列並設為 `current_character`。
3. Discord OAuth 會建立或綁定 `actor_auth_links(provider='discord')`；若和既有 actor 衝突，走 Discord merge preflight / confirm 流程。
4. 前端每次 API 請求攜帶 Cookie；middleware 驗證 JWT 後注入 `actor_id`、`character_id`、`linked_providers`、`login_method` 與 `is_admin`。
5. Protected API 會在 access token 過期但 refresh token 仍有效時自動輪替 session；前端不呼叫顯式 refresh API。
6. 舊 Guest token / guest personal room 已退場；只能 Quick Login 的玩家是 `linked_providers=["quick_login"]` 的 actor，可被隊伍的 `allow_quick_login_players=false` 阻擋申請。

---

## 六、資料庫主要表格

| 表格 | 說明 |
|------|------|
| `actors` | 登入主體，包含 PIN hash、管理員與封禁狀態 |
| `actor_auth_links` | 外部登入方式綁定，目前包含 Discord provider |
| `characters` | 遊戲角色，關聯 `actors`，含職業/等級/角色代碼 |
| `parties` | 隊伍，含狀態機、時間窗口、密碼設定；`target_name` 在 DB 內部儲存目標 reference ID，API 解析為顯示名稱 |
| `party_slots` | 隊伍席位，含職業限制、填充狀態 |
| `party_applications` | 加入申請，狀態：PENDING/ACCEPTED/REJECTED/CANCELLED |
| `raid_boss_options` | Boss / 組隊任務選項；`party_type` 使用 `BOSS` / `GROUP` |
| `maps` | 練功地圖主檔，供 `TRAINING` 隊伍解析地圖參照 |
| `notifications` | 持久化通知，含 `link_url` |
| `activity_presence_locks` | 角色的活動排他鎖（防止同一角色同時在多個進行中 party） |
| `daily_stats` | 每日統計快照 |

---

## 七、隊伍生命週期摘要

系統中的隊伍採用「公開 → 隱藏 → 最終關閉」的生命週期：

| 狀態 | 說明 |
|------|------|
| `RECRUITING` | 招募中，公開搜尋可見 |
| `ACTIVE` | 進行中，公開搜尋可見 |
| `HIDDEN` | 暫時隱藏，公開搜尋不可見，但仍可重新顯示 |
| `CLOSED` | 最終關閉，只供查詢 |

核心規則：
- 閒置 1 小時後，系統先將隊伍改為 `HIDDEN`
- 任一現有成員可透過 `POST /parties/:id/liveness` 重新顯示 `HIDDEN`
- 若在關閉門檻內仍未被重新顯示，系統再將隊伍改為 `CLOSED`
- idle worker 每輪會補掃 DB-backed immediate parties 與 Redis immediate index，避免舊資料或 Redis snapshot / index 缺失時漏掉未關閉隊伍
- `CLOSED` 不可再修改、不可重新顯示、不可解散

---

## 八、關鍵設計模式

### Transactional Outbox
確保「資料庫寫入」與「事件發布」的原子性：
```
UseCase → DB Transaction {
  UPDATE parties SET ...
  INSERT INTO outbox_events (event_type, payload, status='PENDING')
} COMMIT

Relay Worker (polling) → 
  SELECT * FROM outbox_events WHERE status='PENDING'
  → XADD ws_events ...
  → UPDATE outbox_events SET status='PROCESSED'
```

### 版本化快取 (Versioned Cache)
隊伍清單採用版本號+簽名作為快取鍵：
```
key = "party_list:{version}:{hash(filter)}"
任何寫入操作 → INCR party_list:version → 舊快取自動失效
```

### WebSocket Room 模型
```
actor:{actorID}                 → 個人化事件（申請通知、被踢出等）
party:{partyID}                 → 隊伍內事件（成員變動、聊天）
parties:global                  → 全域廣播（清單狀態變化）
public:broadcast                → 公開廣播（例如在線人數）
```
