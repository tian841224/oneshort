# 即時線上人數與每日統計 (Online Stats)

> **狀態**：已實作。本檔僅為高層總覽；實作規格以下方「深入文件」為準。

---

## 功能總覽

網站 Header 的 Logo 右側即時顯示目前同時在線人數（WebSocket presence 追蹤，連線增減時透過 `system.online_count` 事件即時推送）；後端同時統計每日業務 HTTP request 總數與每日峰值人數，由午夜 worker 落庫到 `daily_stats` 表。刻意不做：後台統計頁、每日統計查詢 API、UV 統計、圖表報表。

---

## 深入文件

- **後端規格書**：backend repo `docs/specs/online-stats.md` — Redis key 設計（presence lease 機制）、服務介面、`daily_stats` 表結構、對外端點與 WS 事件
- **後端資料流**：backend repo `docs/data_flow.md` §7（worker 機制）、§9（統計資料流程）
- **API 參考**：backend repo `docs/api-reference/others.md`
- **前端行為**：frontend repo `docs/frontend-logic.md` §九（OnlineCounter 顯示邏輯與資料來源）
