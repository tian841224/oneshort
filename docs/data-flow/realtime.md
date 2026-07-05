# 即時通訊與通知機制 (Real-time & WS Flow)

OneShort 針對「隊伍加入」、「成員變動」等高頻率變更，採用了事件驅動的即時通訊機制。

---

## 1. 異步事件驅動 (Async Flow)

為了應對高併發下 API 的等待時間，後端不論在寫入資料庫時多快，都會透過 **Transactional Outbox 模式** 進行。

### **後端事件發布流程 (Publishing)**
1. **DB Transaction Start**: `usecase` 層開啟資料庫交易。
2. **Persistence**: 更新 `parties` 表或 `members` 表。
3. **Outbox Insert**: 在同一個交易內，將對應的變更事件（如 `PARTY_UPDATE`）寫入 `outbox_events` 表。
4. **DB Commit**: 確保「資料更新」與「事件通知」具備原子性。
5. **Relay Worker**: 後台行程定期抓取 `outbox_events` 並將其發送至 **Redis Streams**。

---

## 2. WebSocket 轉譯與推播 (Gateway)

### **資料流向圖**
`Redis Streams` → `WS Gateway / API Server` → `WebSocket Client (Browser)`

- **Gateway 職責**: 消費 `ws_events` stream，根據 `room_id` 將訊息轉發給對應連線；`chat` action 若是 `party:{id}` 會使用 cache Redis + DB 檢查 party membership，快速隊伍只允許隊長與隊員讀取/發言，若是 `lobby:chat` 則走公開大廳聊天並以未登入 guest 名稱「遊客」發送。
- **Consumer Group**: 預設使用 instance-scoped group（`ws_gateway_{hostname}`），每個 gateway instance 都會各自收到 outbox-backed event，並廣播給本機 in-memory hub；新 group 從 stream 的 `$` 建立，不回放既有 `ws_events` 歷史 backlog。
- **Outbox Dedupe**: `notify:outbox:seen:{outbox_id}` 只用來避免 DB notification、chat cleanup、internal character processor 等全域副作用重複執行。即使 outbox ID 已被其他 instance 標記處理過，本 instance 仍會先完成本機 `hub.Deliver` 與 `parties:global` mirror，再 ack 該 stream message。`notify:outbox:delivered:{group}:{outbox_id}` 則用來避免同一 consumer group 因 XACK 失敗或 pending message reclaim 對本機 WebSocket 連線重送同一事件。
- **認證 (Auth)**: WebSocket 握手時會驗證 JWT；建立連線後，server 會自動把連線加入 `public:broadcast` 與當前 identity 的 personal room（`actor:{id}`）。未登入 quick guest 若帶有效 `quick_guest_token`，當前 identity 會是 quick guest 對應的 personal room，因此可收到快速隊伍建立者專屬事件。
- **訂閱授權**: 客戶端額外發出的 `subscribe` 只允許 `parties:global`、公開 `lobby:chat`、自己的 personal room，以及通過成員驗證的 `party:{id}`；快速隊伍的 visitor / pending guest 即使有 quick guest cookie 也不能訂閱聊天室。其他人的 `actor:*` 房間會直接回 error，不會加入 subscription。

### **角色更新同步事件**
- `PATCH /characters/:id` 會先寫入 internal `character.updated` 到 `system:character:{characterID}`。
- `StreamConsumer` 不會把這個 internal room 直接推給前端，而是先執行後台同步：
  - 更新房間快照與申請快照
  - 更新 `chat:party:*` 歷史 sender snapshot
  - 更新 `notifications.content` 的角色顯示欄位
- 同步完成後才補發對前端可見的 refresh 事件：
  - `actor:{id}` → 刷新角色列表 / 我的申請 / 通知
  - `party:{id}` → 刷新房間詳情與聊天室歷史

---

## 3. 前端回應規則 (Frontend Handling)

- **`useWebSocket` Hooks**:
    1. 接收 `MESSAGE` Payload。
    2. **偵測類型**: 若事件為 `party.created` / `party.updated` / `party.member_joined` / `party.status_changed` 等隊伍事件。
    3. **Action**:
      - `auth_success` → 前端訂閱 `parties:global`，使用登入 actor 的 `actor:{id}` 或 `payload.room_id`（未登入 quick guest）作為 personal room，並重送目前仍有 listener 的 `party:{id}` room subscriptions；個人房間也由 server 在握手成功後自動加入
      - `party.created`（來自 `parties:global`）→ 觸發 `queryClient.invalidateQueries(['parties'])`
      - `party.updated`（來自 `parties:global`、`party:{id}`，或 quick-party 發送到各 quick participant personal room）→ 刷新列表、隊伍詳情與進行中活動快取
      - `chat`（來自 `party:{id}`）→ 房內聊天室更新；快速隊伍額外鏡射到 quick participant personal room 時，若不在該房間頁面則顯示房外 toast
      - `lobby.chat`（來自 `lobby:chat`）→ 尋找隊伍的大廳聊天室追加公開訊息；未登入也會載入 `GET /api/v1/lobby/chat`（最近 100 筆、最久 24 小時）並可 `POST /api/v1/lobby/chat`
      - `party.guide_state.updated`（來自 `party:{id}`）→ 更新本地 guide state store（依 `revision` 保護，舊事件不覆蓋新狀態）並失效 `['partyGuide', partyId]`；同一事件同時承載攻略小工具狀態、小工具同步 session（保留 id `widget_sessions`）與隊員顏色（`party_member_colors`）的更新，房內成員即使不在攻略分頁也會收到（隊伍房間訂閱），驅動「是否同步開啟」提示與「進行中」badge
      - `character.updated`（來自 `actor:{id}` 或 `party:{id}`）→ 刷新角色/通知/申請快取，且在隊伍房間內重新抓聊天室歷史
      - 進入中的 `party:{id}` 事件 → 觸發 `queryClient.invalidateQueries(['party', partyId])`
    4. **UI**: UI 偵測到失效並重新背景獲取資料，實現「即時自動重整」。
- **連線位址解析**:
    1. 若前端設定 `NEXT_PUBLIC_WS_URL`，直接連該位址（供獨立 `ws-gateway` 部署使用）。
    2. 若未設定，前端會從 `NEXT_PUBLIC_API_URL` 推導同 host 的 `/ws`。

---

## 4. 隱藏隊伍生命週期事件 (Hidden Party Lifecycle)

### **Worker 掃描規則**
- **立即隊伍 (`scheduled_at = null`)**：由 Redis immediate index 批次讀取 `party:data:*`，`updated_at + 1h` 先把隊伍改為 `HIDDEN` 並送出 `party.idle_warning`，`updated_at + 2h` 關閉隊伍；索引缺失時才 fallback 掃描並修補索引。
- **預約隊伍 (`scheduled_at != null`)**：由資料庫掃描，需同時滿足 `scheduled_at + 1h` 與 `updated_at + 1h` 才先改為 `HIDDEN` 並送提醒；關閉條件為 `scheduled_at + 1h` 且 `updated_at + 2h`。

### **通知與前端動作**
- `party.idle_warning` 會持久化到通知中心，並附上 `/?tab=MY_PARTY&party=<id>` 導向。
- Payload 會帶 `role = leader | member`，前端依角色顯示不同動作：
  - `leader`：確認隊伍仍存在 / 解散隊伍
  - `member`：確認自己仍在隊伍 / 離開隊伍
- 快速隊伍沿用同一個 1h / 1h55m / 5m 閒置節奏，但 `party.idle_warning` 只送到建立者（HOST participant）的 personal room，payload 會帶 `is_quick=true`；前端需改用 `POST /parties/:id/quick-liveness` 與 `POST /parties/:id/quick-close`。
- 若快速隊伍掃描時找不到建立者 personal room，worker 不送 idle warning，直接關閉該快速隊伍並送出 `party.expired`。
- 前端收到 `party.idle_warning`、`party.expired`、`party.member_left` 後，都會同步失效 `['parties']`、`['party', id]`、`['myOngoingActivityParticipations']` 與通知相關 Query。
- 點擊 `party.idle_warning` 的「我還在」時，若隊伍是因閒置提醒被自動隱藏，後端會同步重新顯示。

### **關閉語義**
- 2 小時未回應時，系統將隊伍狀態改為 `CLOSED`，不是 `DISBANDED`，也不是 `EXPIRED`。
- `party.expired` 會通知隊伍房間與所有現有成員的個人房間，而非只通知隊長。

---
