# 通知與通訊模組 (Notification Module)

Notify 模組是 OneShort 的中心化事件處裡站，負責將所有 Domain 的狀態變更推送給使用者。

---

## 1. 業務功能 (Business Features)

- **系統級通知 (System Notify)**:
    - 隊員申請入隊、批准、拒絕。
    - 成員加入、離開、被踢出、隊伍解散、閒置提醒與自動關閉。
- **通知分類與狀態**:
    - `READ` / `UNREAD` (已讀、未讀)。
    - 通知類型以事件名稱儲存，例如 `party.application_accepted`、`party.idle_warning`。
- **通知中心互動規則**:
    - 僅提供「標記已讀」操作，不提供手動刪除按鈕。
    - `party.idle_warning` 在使用者完成「還在 / 解散 / 離開」任一操作後，會自動刪除該則通知以避免重複點選。
    - `party.idle_warning` 的彈跳提示在使用者點選任一動作後不再顯示成功/失敗回應；若隊伍已在稍早解散或關閉，前端僅靜默刷新狀態。
    - `party.idle_warning` 發送時，隊伍已先被系統暫時隱藏；點「還在」會重新顯示，僅手動隱藏的隊伍不受影響。
- **即時串流 (Real-time Stream)**:
    - WebSocket 事件進入 `useWebSocketEventHandler`，再失效 TanStack Query 的通知與隊伍相關快取。

---

## 2. 前後端組件對應 (Code Mapping)

### **後端 (Backend)**
- **Domain**: `backend/internal/notify/domain.go` (Entity: `Notification`, WebSocket payload).
- **Handler**: `backend/internal/notify/handler.go` (`/ws`、notifications API、party chat history).
- **Stream Consumer**: `backend/internal/notify/stream_consumer.go`（Redis Stream → WS room + notification persistence）。

### **前端 (Frontend)**
- **Components**: `frontend/src/components/auth/NotificationBell.tsx`、`NotificationAttentionManager.tsx`。
- **Hooks**: `frontend/src/hooks/useNotifications.ts`。
- **Cache**: `['notifications', actorId]` 與 `['notifications', 'unread-count', actorId]`。

---

## 3. 分析與維護性分析 (Analysis)

### 🟢 結構優點 (Pros)
- **非同步非阻塞**: 業務 Domain 只需要發送一個 Event，由 Notify 模組負責後續分發（DB 寫入 + WS 通道）。

### 🔴 當前分析 (Current State)
- **通知積壓問題**: 若前端太久沒讀取，通知可能過多，目前缺乏分頁加載機制。
- **建議**: 針對 `unreads` 增加緩存與分頁加載機制，提升長度。
