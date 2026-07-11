# 網站 Logo 右側即時線上人數與每日統計落庫

**版本**: 1.1  
**日期**: 2026-04-12  
**狀態**: ✅ 已實作（文件於 2026-06-25 校正；原標「待實作」已過期）

> 已落地：後端 `backend/internal/stats/`（service / redis_stats / repository / middleware / handler + 測試）、migration `0015_daily_stats`；前端 `frontend/src/hooks/useOnlineCount.ts` + Navbar 顯示；即時推送走 WebSocket `system.online_count` 事件。

---

## 1. 功能需求

| 功能 | 說明 | 呈現 / 儲存位置 |
|------|------|----------------|
| 即時線上人數 | 顯示目前同時在線的 WebSocket 連線數 | 網站 Header，Logo 右側 |
| 每日流量 | 記錄每日業務 HTTP Request 總數 | 僅寫入 DB |
| 每日峰值人數 | 記錄每日最高同時在線人數與發生時間 | 僅寫入 DB |

> 本規格沿用原先定義，將「每日流量」視為每日業務 HTTP Request 總數，不包含 `/metrics`、`/health`、`/ws` 等非業務端點。

---

## 2. 非目標

本次需求**不包含**以下功能：

- 不新增後台統計頁面
- 不新增每日流量 / 每日峰值查詢 API
- 不新增圖表、報表匯出、通知或排行功能
- 不記錄獨立訪客（UV）等額外統計欄位

---

## 3. 現有架構盤點

### 可直接利用的資源

| 現有資源 | 用途 |
|---------|------|
| `oneshort_ws_active_connections` Prometheus gauge | 已追蹤 WS 連線數，可作為驗證來源 |
| `internal/notify/hub.go` | 管理所有 WS 連線的 Register / Unregister 生命週期 |
| Redis Streams + Outbox Pattern | 可廣播線上人數變動 |
| Worker 系統（`pkg/worker/`） | 可加入跨日持久化任務 |
| HTTP Middleware | 可加入 Request 計數 |

### 技術棧確認

- **後端**: Go 1.24 + Gin + PostgreSQL 16 + Gorilla WebSocket
- **前端**: Next.js 16 + React 19 + Zustand + React Query
- **快取 / 即時資料**: Redis

---

## 4. 整體資料流

### 4.1 即時線上人數

```text
客戶端建立 WS 連線
    └─► Hub.Register()
            ├─► Redis INCR stats:online_count
            ├─► 更新當日峰值 stats:peak:{date}
            └─► Broadcast system.online_count
                    └─► Header Logo 右側數字即時更新

客戶端斷開 WS 連線
    └─► Hub.Unregister()
            ├─► Redis DECR stats:online_count
            └─► Broadcast system.online_count
```

### 4.2 每日統計落庫

```text
每次 HTTP Request
    └─► Stats Middleware
            └─► Redis INCR stats:requests:{YYYY-MM-DD}

每日 00:00:30
    └─► MidnightStatsWorker
            ├─► 讀取前一天 requests / peak
            ├─► UPSERT daily_stats
            └─► 清除前一天 Redis keys
```

---

## 5. 資料庫設計

### 新增表：`daily_stats`

```sql
CREATE TABLE daily_stats (
    id              BIGSERIAL    PRIMARY KEY,
    stat_date       DATE         NOT NULL UNIQUE,
    total_requests  INT          NOT NULL DEFAULT 0,
    peak_concurrent INT          NOT NULL DEFAULT 0,
    peak_time       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_stats_date ON daily_stats(stat_date DESC);
```

Migration 檔案路徑：`backend/migrations/XXXXXX_add_daily_stats.sql`

---

## 6. Redis Key 設計

| Key | 類型 | 說明 | TTL |
|-----|------|------|-----|
| `stats:online_count` | String | 目前 WS 連線總數 | 無 |
| `stats:peak:{YYYY-MM-DD}` | Hash | 當日峰值：`value` + `time` | 48 小時 |
| `stats:requests:{YYYY-MM-DD}` | String | 當日 HTTP Request 總數 | 48 小時 |

> TTL 設為 48 小時，確保跨日 worker 延遲執行時仍可補寫前一天資料。

---

## 7. 後端實作規格

### 7.1 新增檔案結構

```text
backend/
  internal/
    stats/
      model.go
      redis_stats.go
      service.go

  pkg/worker/
    midnight_stats.go
```

### 7.2 修改現有檔案

| 檔案 | 修改內容 |
|------|---------|
| `internal/notify/hub.go` | Register / Unregister 時更新線上人數、峰值並廣播 |
| `internal/notify/handler.go` | WS 認證成功後加入 `public:broadcast` room |
| `internal/server/middleware.go` | 新增 stats middleware 計算每日 request 總數 |
| `cmd/server/main.go` | 初始化 StatsService，啟動 MidnightStatsWorker |

### 7.3 核心責任

- `OnConnectionChange(ctx, delta)`：更新 `stats:online_count`，必要時刷新當日峰值
- `RecordHTTPRequest(ctx)`：累加當日 request 計數
- `PersistDayStats(ctx, date)`：將指定日期的 request / peak 統計寫入 `daily_stats`

---

## 8. 前端實作規格

### 8.1 顯示位置

- 元件放在網站主要 Header
- 位置固定在 Logo 右側
- 呈現格式建議為：`● 123 在線`

### 8.2 資料來源

- 前端沿用現有 `useWebSocket` / `wsStore`
- 訂閱 `system.online_count` 事件後更新畫面
- 若需要首屏同步，可保留 `GET /api/v2/stats/online` 作為初始值 fallback

### 8.3 本次不做

- 不新增統計頁面
- 不顯示每日流量或每日峰值歷史資料

---

## 9. API / WebSocket 規格

### 9.1 公開端點

#### `GET /api/v2/stats/online`

用途：提供頁面初始化時的即時線上人數。

```json
{
  "count": 123
}
```

### 9.2 WebSocket 事件

#### `system.online_count`

廣播至 `public:broadcast` room，於連線數變動時觸發。

```json
{
  "type": "system.online_count",
  "payload": {
    "count": 45
  }
}
```

### 9.3 不提供的介面

- 不提供 `GET /api/v2/admin/stats/daily`
- 不提供 `GET /api/v2/admin/stats/today`

---

## 10. 實作順序與驗收標準

### Phase 1 — 即時線上人數顯示

- [ ] 新增 / 串接 `system.online_count` 事件
- [ ] 新增 `OnlineCounter` 元件
- [ ] 將元件放到網站 Header 的 Logo 右側

**驗收標準**：網站載入後，Logo 右側可看到目前在線人數；連線 / 斷線時數字會同步更新。

### Phase 2 — 每日統計落庫

- [ ] 新增 `daily_stats` migration
- [ ] 實作 request 計數 middleware
- [ ] 實作峰值更新邏輯
- [ ] 實作 `MidnightStatsWorker`，每日將統計寫入 DB

**驗收標準**：每天 DB 會有一筆 `daily_stats` 記錄，至少包含 `stat_date`、`total_requests`、`peak_concurrent`、`peak_time`。

### Phase 3 — 範圍控制確認

- [ ] 確認未新增後台頁面
- [ ] 確認未新增每日統計查詢 API

**驗收標準**：本功能僅提供首頁在線人數顯示，以及每日統計落庫，不包含額外查看功能。
