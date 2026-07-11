# Telegram Bot（管理員操作介面）

> **狀態**：✅ 已實作（文件於 2026-06-25 校正）。本檔僅為高層功能總覽；指令與行為規格以下方「深入文件」為準。

---

## 功能總覽

Telegram Bot 讓管理員不用進後台，直接在白名單 Telegram 群組內完成日常維運操作：發布/清除/刪除系統公告、更新/清除 NoticeBar 跑馬燈、查詢與管理 bug 回報（列表、詳情、狀態變更、開發者回覆），並對每個指令收到操作結果回覆。webhook 以 secret token 加 chat 白名單雙重限制，所有 TG 觸發的寫入一律以系統管理員身分記錄。

實作位於 `backend/internal/admin/telegram.go`（webhook 與指令路由）與 `backend/internal/telegram/`（outbound sender 與 update 去重）。

---

## 深入文件

- **指令清單與行為規格**：[backend/docs/specs/admin.md](../../backend/docs/specs/admin.md)（「Telegram Bot 指令」章節）
- 本檔原始的實作計畫（驗收清單、實作步驟、風險表、估時）為歷史規劃文件，完整內容保留於 git history。
