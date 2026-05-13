# 系統公告與 NoticeBar

**狀態**: 已實作
**更新日期**: 2026-05-13

## 邊界

- 系統公告用於 modal 內容，資料來源是 `admin_announcements`。
- NoticeBar 用於 Navbar 跑馬燈，資料來源是 `admin_notices`。
- NoticeBar 是獨立功能，不讀取公告、不顯示公告 Markdown，也不開啟公告 modal。
- 公告 `content` 是 Markdown，寫入時只能用 trim 判斷是否為空，送到 API/DB 的字串必須保留原始空白、換行與縮排。
- NoticeBar `content` 是純文字，上限 240 字元。

## 公開讀取

| Endpoint | 用途 |
| --- | --- |
| `GET /api/v1/announcement` | 取得 `created_at DESC, id DESC` 最新 active 公告，供公告 modal 使用 |
| `GET /api/v1/announcements` | 取得 active 公告列表，排序為 `priority DESC, created_at DESC` |
| `GET /api/v1/notice` | 取得 `created_at DESC, id DESC` 最新 active NoticeBar 文字 |

## 管理端點

| Endpoint | 用途 |
| --- | --- |
| `GET /api/v1/admin/announcements` | 管理員列出 active 公告 |
| `GET /api/v1/admin/announcement` | 管理員取得最新 active 公告 |
| `POST /api/v1/admin/announcement` | 新增一則 active 公告，不清除既有公告 |
| `PUT /api/v1/admin/announcement` | 停用既有 active 公告後建立單則公告 |
| `DELETE /api/v1/admin/announcement/:id` | 停用指定公告 |
| `DELETE /api/v1/admin/announcement` | 停用所有 active 公告 |
| `GET /api/v1/admin/notice` | 管理員取得 active NoticeBar 文字 |
| `PUT /api/v1/admin/notice` | 停用既有 active notice 後建立單則 NoticeBar 文字 |
| `DELETE /api/v1/admin/notice` | 停用所有 active notice |

## 前端行為

- `Footer` 的「公告」按鈕只呼叫 `openModal('announcement')`。
- `AnnouncementManager` 依公告 `id + updated_at` seen token 自動顯示最新公告 modal。
- `SystemAnnouncementModalHost` 只在公告 modal 開啟時讀 `/api/v1/announcement`。
- `NoticeBar` 由 `Navbar` 透過 `useSystemNotice(true)` 讀 `/api/v1/notice`，內容空白時不渲染。
- 管理頁公告表單只送 `content` 與 `priority`。
- 管理頁 NoticeBar 表單只送獨立 notice `content`。

## 後端行為

- `GetLatestActiveAnnouncement` 使用 `created_at DESC, id DESC LIMIT 1`。
- `ListActiveAnnouncements` 使用 `priority DESC, created_at DESC`。
- `GetActiveNotice` 使用 `created_at DESC, id DESC LIMIT 1`。
- `UpsertNotice` 會先停用既有 active notice，再新增一筆 active notice。
- Primary read stickiness 分別使用 `announcements` 與 `notices` resource key，公告寫入不會讓 NoticeBar 讀取公告資料。

## Telegram Bot

Telegram webhook 仍只管理系統公告：

- `/announce <文字>` 新增公告。
- `/clear` 清除公告。
- `/delete <uuid>` 停用指定公告。

Telegram 指令不管理 NoticeBar；NoticeBar 目前只透過管理後台與 admin notice API 操作。
