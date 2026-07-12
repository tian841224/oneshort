# 通知與通訊模組 (Notification Module)

> **狀態**：現行功能。本檔僅為高層功能總覽；實作規格一律以下方「深入文件」為準。

---

## 功能總覽

Notify 模組是中心化事件處理站：各業務 Domain 只需發送事件，由本模組負責持久化通知（寫入 `notifications` 表）與 WebSocket 即時分發。涵蓋隊伍申請/審核、成員進出、解散、閒置提醒與自動關閉等事件；通知有已讀/未讀狀態，通知中心僅提供「標記已讀」，不提供手動刪除。`party.idle_warning` 有特殊互動規則（點選動作後自動移除該通知、stale 狀態靜默處理），細節見前端行為文件。

已知限制：通知列表目前無分頁載入，若使用者長期未讀可能累積過多；未來可針對 unread 增加快取與分頁機制。

---

## 深入文件

- **後端規格書**：backend repo `docs/specs/notify.md` — 通知儲存、WebSocket 模型、持久化事件表、聊天室規則（大廳/隊伍/公會）、節流
- **API 參考**：backend repo `docs/api-reference/notify.md`
- **事件契約**：backend repo `docs/event_contract.md`
- **前端行為**：frontend repo `docs/frontend-logic.md` §六（WS 事件處理矩陣）、§七（通知鈴鐺）、§八（NotificationAttentionManager 彈跳提示與 idle_warning 互動規則）
