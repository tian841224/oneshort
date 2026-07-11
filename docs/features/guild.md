# 公會系統 (Guild System)

> 現行功能文件。Guild 模組已於 2026-04-28 重新導入，後端實作位於 `internal/guild/`，前端入口位於 `/guilds`。

---

## 1. 現行範圍

- 公會公開列表、建立公會、OPEN / APPROVAL / PASSWORD 三種加入模式。
- 1 個 actor 同時間只能屬於 1 個 active 公會。
- 公會角色為 LEADER / OFFICER / MEMBER。
- 成員可使用公會主頁、聊天室、公告、成員列表、公會限定隊伍、個人配對偏好。
- 幹部與會長可審核入會、管理公告、執行自動配對。
- 會長可修改設定、設定人數上限、升降幹部、踢人、轉讓會長與解散公會。
- 公會詳情頁「設定」分頁僅幹部（含會長）可見，與其他分頁同列常駐顯示，不藏在次要選單後（見 ADR-0031）。
- 管理員後台可列出公會並強制解散。

---

## 2. 公會限定隊伍

- 公會隊伍複用既有 party 流程，透過 `guild_id`、`visibility=GUILD`、`generated_by_match` 區分。
- 公開 `/parties` 列表不回傳 guild-only party。
- Guild-only party 的讀取、更新、刪除、申請、審核、slot 操作、`/applications/me` party 摘要與 WebSocket party room 訂閱都需通過公會成員檢查。
- `generated_by_match=true` 的自動配對公會隊伍可由隊長或公會 LEADER/OFFICER 管理；手動公會隊伍與公開隊伍仍維持隊長管理。
- 公會隊伍列表會回傳 `note`，前端隊伍卡片需顯示備註。
- 非成員操作 guild-only party 回 403。

---

## 3. 自動配對

- 會長與幹部可在 `/guilds/:id/match` dry-run 或產生配對草案。
- 會長可維護每個 BOSS 的啟用狀態、最低等級（1～200，見 `docs/business-logic.md` §10.1 全域欄位範圍規範）、人數上限與 job slot 模板。
- 成員在 `/guilds/:id/me/preferences` 維護 BOSS、30 分鐘時段格與可參戰角色。
- 成員在公會首頁的行事曆由 `/guilds/:id/me/calendar` 提供；後端會以目前 actor 的所有 active 角色查詢未來 7 天內已指派 slot 的 BOSS 公會隊伍，回傳 `scheduled_at`、`target_name`、`character_name`、`character_code` 與 `party_id`。
- `time_slots` 為 Monday-first：slot `0` 是週一 00:00，slot `13` 是週一 06:30；後端以台灣時間下個週一 00:00 作為 cycle start 後存 UTC `scheduled_at`。
- dry-run／草案（`DRAFT`）／生成（`GENERATED`）的完整生命週期規則（單一 actor 同時段限額、每 guild/cycle 僅一個 active DRAFT、`generate` 重新驗證項目、Cron 排程與手動配對的流程差異）與配對演算法細節，詳見 [backend/docs/specs/guild.md § BOSS 自動配對（Auto-Match）](../../backend/docs/specs/guild.md)。

---

## 4. 即時事件與快取

- Guild WebSocket room 使用 `guild:{guild_id}`。
- Officer-only join request 通知使用 `guild:{guild_id}:officers`；幹部 / 會長瀏覽公會頁時會額外訂閱此 room。
- 退會、被踢、角色異動與解散會額外推送到受影響 actor 的 `actor:{actor_id}` room，避免使用者不在公會頁時保留 stale current-guild cache。
- Guild 頁面 shell 會在會員瀏覽任何公會頁時維持 guild room 訂閱，不只依賴聊天室頁面。
- 前端 guild detail query key 會帶 actor id，避免不同登入者共享 membership cache。

---

## 5. 相關文件

- 後端功能索引：`backend/docs/features.md`
- 前端文件索引：`frontend/docs/README.md`
