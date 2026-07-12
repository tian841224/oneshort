# 系統公告與 NoticeBar

> **狀態**：已實作。本檔僅為高層總覽與邊界定義；實作規格以下方「深入文件」為準。

---

## 邊界

- 系統公告用於 modal 內容，資料來源是 `admin_announcements`。
- NoticeBar 用於 Navbar 跑馬燈，資料來源是 `admin_notices`。
- NoticeBar 是獨立功能，不讀取公告、不顯示公告 Markdown，也不開啟公告 modal。
- 公告 `content` 是 Markdown，寫入時只能用 trim 判斷是否為空，送到 API/DB 的字串必須保留原始空白、換行與縮排。
- NoticeBar `content` 是純文字，上限 240 字元。
- Telegram Bot 指令只管理系統公告（`/announce`、`/clear`、`/delete`）與 NoticeBar（`/notice`、`/notice-clear`）——指令表見 backend 規格書。

---

## 深入文件

- **後端規格書**：backend repo `docs/specs/admin.md` — 公告/NoticeBar 排序與 upsert 行為、read-stickiness resource key、Telegram 指令表
- **API 參考**：backend repo `docs/api-reference/admin.md`（管理端點）與 `docs/api-reference/others.md`（公開讀取端點）
- **後端資料流**：backend repo `docs/data_flow.md` §10（NoticeBar 資料流）
- **前端行為**：frontend repo `docs/frontend-logic.md` §3.1A（AnnouncementManager／SystemAnnouncementModalHost／NoticeBar 元件與顯示規則、seen token、管理頁表單）
