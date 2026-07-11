# OneShort 後端資料流程文件 (Backend Data Flows) — 已移轉

> 本文件原有的後端實作細節（路由表、中間件順序、各端點處理步驟、Outbox / Relay Worker、WS Gateway stream consumer、worker 機制、JWT / admin 驗證、速率限制、讀寫分離、消毒、冪等、聊天 / OCR / 統計 / NoticeBar 資料流）已全數合併到 backend repo 的 [`backend/docs/data_flow.md`](../backend/docs/data_flow.md)（跨 repo 資訊性參照）。ROOT 只保留本導覽 stub；後端資料流的唯一權威來源為 backend repo 該檔，請勿在此處新增實作細節。

## 章節搬移對照

| 原本章節（本檔） | 現在位置（backend/docs/data_flow.md） |
|---|---|
| 一、服務入口與路由（1.1 路由表 / 1.2 中間件順序） | [§1 API Request Lifecycle](../backend/docs/data_flow.md#1-api-request-lifecycle)（路由總覽、Middleware 執行順序、Auth 注入） |
| 1.3 Auth Phase 2 Flow / 五、認證中間件流程 | [§2 Auth Phase 2 資料流](../backend/docs/data_flow.md#2-auth-phase-2-資料流) |
| 1.4 PATCH /characters/:id 快照同步 | [§5 Room 路由](../backend/docs/data_flow.md#5-room-路由)（角色更新的快照同步） |
| 二、隊伍 API 資料流程（2.1–2.7B，含訪客互通 / guest-claim） | [§3 Party 相關資料流](../backend/docs/data_flow.md#3-party-相關資料流) |
| 三、事件發布與傳遞流程（Outbox / Stream Consumer / 廣播策略） | [§4 Outbox -> Realtime](../backend/docs/data_flow.md#4-outbox---realtime) 與 [§5 Room 路由](../backend/docs/data_flow.md#5-room-路由)（事件廣播路由） |
| 四、Worker 機制（4.1 Relay / 4.2 過期 / 4.3 閒置 / 4.4 預熱 / 4.5 在線人數） | Relay Worker 併入 §4；其餘見 §7 System Worker 機制（在線人數實為事件驅動廣播，非定時 worker） |
| 六、速率限制 / 七、讀寫分離 / 八、Sanitization / 九、Idempotency | §1 API Request Lifecycle 對應小節 |
| 十、聊天功能資料流 | §6 聊天資料流 |
| 十一、OCR 處理流程 | §8 OCR 處理流程 |
| 十二、統計資料流程 | §9 統計資料流程 |
| 十三、NoticeBar 資料流 | §10 NoticeBar 資料流 |
