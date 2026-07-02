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
- 會長可維護每個 BOSS 的啟用狀態、最低等級、人數上限與 job slot 模板。
- 成員在 `/guilds/:id/me/preferences` 維護 BOSS、30 分鐘時段格與可參戰角色。
- 成員在公會首頁的行事曆由 `/guilds/:id/me/calendar` 提供；後端會以目前 actor 的所有 active 角色查詢未來 7 天內已指派 slot 的 BOSS 公會隊伍，回傳 `scheduled_at`、`target_name`、`character_name`、`character_code` 與 `party_id`。
- `time_slots` 為 Monday-first：slot `0` 是週一 00:00，slot `13` 是週一 06:30；後端以台灣時間下個週一 00:00 作為 cycle start 後存 UTC `scheduled_at`。
- 同一 actor 在同一時段只會被分到 1 個 BOSS 隊伍。
- `dry_run=true` 只回傳一次性預覽，不寫入 DB。
- `dry_run=false` 會建立 `DRAFT` match run 與 `draft_plan`，不建立 party，也不通知成員；重新整理後可透過 `GET /guilds/:id/match-runs/current-draft` 接續調整。
- 草案包含每個成團隊伍的 BOSS、時段、隊長角色、隊員角色名稱/代碼/職業/等級，以及有該 BOSS 偏好但未配對成功的 `unmatched` 名單。
- 幹部確認草案後呼叫 `POST /guilds/:id/match-runs/:runId/generate`，後端會重新驗證角色仍屬於 active 公會成員、職業與等級符合 slot、隊長在 assignments 中，然後於單一 transaction 建立隊伍、slot、更新 run 為 `GENERATED`，並送出既有 party 通知。
- 每個 guild/cycle 僅允許一個 active `DRAFT`；重新產生草案會取消舊草案。已 `GENERATED` 的 cycle 不允許再次生成正式隊伍。
- Cron 排程配對暫時維持直接生成；手動配對才使用 draft -> edit -> generate 流程。

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
