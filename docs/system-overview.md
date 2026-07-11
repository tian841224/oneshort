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
| **Frontend** | Next.js 16 App Router | 提供使用者介面；透過 TanStack Query 管理 API 狀態；透過 Zustand 管理全域 UI 狀態 |

後端服務（API Server / WS Gateway / Relay Worker）與資料儲存（PostgreSQL / Redis Cache / Redis Realtime）的角色與職責，詳見 [backend/docs/architecture.md §2 服務拓樸](../backend/docs/architecture.md#2-服務拓樸)。

---

## 四、技術棧摘要

### 後端
詳見 [backend/docs/architecture.md §1 技術選型](../backend/docs/architecture.md#1-技術選型)。

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

核心模型（所有登入方式最終解析成同一種 `actor + current_character` session、JWT claims 必要欄位、Cookie-based token）詳見 [backend/docs/architecture.md §5 認證模型](../backend/docs/architecture.md#5-認證模型)。

補充流程重點（前端整合相關）：
1. Quick Login 以 `character_code + pin` 建立或回訪 actor；首次建立時會同時建立 primary `characters` 資料列並設為 `current_character`。
2. Discord OAuth 會建立或綁定 `actor_auth_links(provider='discord')`；若和既有 actor 衝突，走 Discord merge preflight / confirm 流程。
3. 前端每次 API 請求攜帶 Cookie；Protected API 會在 access token 過期但 refresh token 仍有效時自動輪替 session，前端不呼叫顯式 refresh API。
4. 舊 Guest token / guest personal room 已退場；只能 Quick Login 的玩家是 `linked_providers=["quick_login"]` 的 actor，可被隊伍的 `allow_quick_login_players=false` 阻擋申請。

---

## 六、資料庫主要表格

完整資料表清單詳見 [backend/docs/architecture.md §3 核心資料表](../backend/docs/architecture.md#3-核心資料表)。

補充（前端整合相關）：`parties.target_name` 在 DB 內部儲存目標 reference ID，API 回應會解析為顯示名稱供前端使用。

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
房間模型（`actor:{id}` / `party:{id}` / `parties:global`）詳見 [backend/docs/architecture.md §6 Room 模型](../backend/docs/architecture.md#6-room-模型)。

補充：前端另訂閱 `public:broadcast`（公開廣播，例如在線人數）。
