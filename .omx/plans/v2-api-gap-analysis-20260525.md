# v2 Frontend API Gap Analysis

**範圍：** `feature/oneshort-v2-redesign` worktree  
**日期：** 2026-05-25  
**判斷標準：** 元件目前仍從 `src/lib/design/` 讀取靜態假資料，尚未接上後端 API

---

## 類型說明

| 類型 | 定義 |
|------|------|
| **A** | 後端 API 已存在、前端 hook 已存在，只需在元件裡換掉假資料 |
| **B** | 後端 API 存在但欄位不齊，或回傳格式需要 adapter 轉換才能接上 UI |
| **C** | 後端完全沒有對應 API，需要全新開發 |

---

## 類型 A — 有可用 API，尚未串接（純前端工作）

| # | 元件 | 目前假資料 | 所需 API | 現有 hook | 備注 |
|---|------|-----------|---------|---------|------|
| A1 | `MatchSection` → `MyPreferencesPanel` | `SAMPLE_CHARACTERS` | `GET /characters` | `useCharacters()` | 需轉換 game_name/job_class → name/cls |
| A2 | `AnnouncementsSection` | `GUILD_ANNOUNCEMENTS` | `GET /guilds/:id/announcements` | `useGuildAnnouncements(id)` | CRUD 操作也需串接（pin/delete/edit） |
| A3 | `PartiesSection` | `GUILD_PARTIES` | `GET /guilds/:id/parties` | `useGuildParties(id)` | 建立隊伍按鈕需串接 `useCreateGuildPartyMutation` |
| A4 | `MatchSection` → `ConfigsPanel` | `GUILD_BOSS_CONFIGS` | `GET /guilds/:id/boss-configs` | `useGuildBossConfigs(id)` | 儲存需串接 `useUpdateGuildBossConfigsMutation` |
| A5 | `MatchSection` → `MatchRunPanel` | `GUILD_BOSS_MEMBER_SETTINGS` | `GET /guilds/:id/match/member-settings?boss_id=X` | `useGuildBossMemberSettings(id, bossId)` | bossId 由選取狀態決定 |
| A6 | `MatchSection` → `MyPreferencesPanel` | `GUILD_MY_PREFERENCES` | `GET /guilds/:id/me/preferences` | `useGuildPreferences(id)` | 儲存需串接 `useUpdateGuildPreferencesMutation` |
| A7 | `MatchSection` → `HistoryPanel` | `GUILD_MATCH_HISTORY` | `GET /guilds/:id/me/match-history` | `useGuildMatchHistory(id)` | 唯讀 |
| A8 | `GuildsClient` (公會列表) | `SAMPLE_GUILDS` | `GET /guilds` | `useGuildList()` | 依賴 B2 補足欄位後才能完整顯示 |
| A9 | `GuildDetailClient` (公會詳情) | `SAMPLE_GUILDS` | `GET /guilds/:id` | `useGuildDetail(id)` | 依賴 B2 補足欄位 |
| A10 | `SettingsSection` (儲存/離開/解散按鈕) | 按鈕目前無 onClick | `PUT /guilds/:id` / `DELETE /guilds/:id/me` / `DELETE /guilds/:id` | `useUpdateGuildMutation` / `useLeaveGuildMutation` / `useDisbandGuildMutation` | 按鈕 UI 存在，只需加 onClick 與 loading 狀態 |

---

## 類型 B — 有相近 API，但需要修改

### B2 — `GET /guilds` 缺少 `min_level` 欄位

| 項目 | |
|------|---|
| **用到的元件** | `GuildListCard`（「需 Lv. X+」）、`GuildPreview`（加入需求）、`SettingsSection`（設定表單） |
| **UI 需要的欄位** | `min_level`（加入最低等級限制） |
| **現有 API 回傳** | `GET /guilds` / `GET /guilds/:id` 均無此欄位 |
| **缺少原因** | `guilds` 表沒有 `min_level` 欄位（`BossConfig` 有同名欄位但屬 BOSS 層級） |
| **需要的修改** | 後端：migration 新增欄位 + domain struct + query + create/update input |
| **影響檔案** | `backend/migrations/` (新 migration)、`backend/internal/guild/domain.go`、`backend/internal/guild/repository_guild.go`、`backend/internal/guild/handler.go` |

---

### B3 — `GUILD_MEMBERS` → API 缺少 `online` 狀態欄位

| 項目 | |
|------|---|
| **用到的元件** | `MembersSection`（線上/離線分組）、`OverviewSection`（成員列表） |
| **UI 需要的欄位** | `online`（是否在線）、`lastSeen`（最近上線時間） |
| **現有 API 回傳** | `GET /guilds/:id/members` → `GuildMember[]`，有 `characters[]` 但無 online 狀態 |
| **缺少原因** | 後端目前追蹤 WebSocket 連線數但未 expose 每位使用者的 online 狀態 |
| **選項** | A. 後端新增 `is_online` 欄位（查 Redis/WebSocket 連線表） B. 前端移除 online 分組（改依 role 排序） |
| **建議** | 選項 B（移除 online 分組），`lastSeen` 以 `joined_at` 代替；online 狀態留待 WebSocket 整合後再補 |

---

### ~~B4 — `GUILD_SCHEDULE` → calendar API 回傳格式不符~~ ✅ 完成

`OverviewSection` 已改用 `useGuildCalendar(guild.id)` 串接真實 API，並選用選項 A（移除 slot 數顯示）。`whenRel` 由前端 `formatCalendarTime` 函式從 `scheduled_at` 計算。

---

### ~~B5 — `GUILD_CHAT` → API 訊息格式需要 adapter~~ ✅ 完成

`apiToUiGuildChatMessage` adapter 已抽出至 `src/features/guild/chatAdapter.ts`，含 5 個單元測試。`GuildChatUiMessage` UI 型別定義於 `src/features/guild/types.ts`（正確 features→app 相依方向）。`cls` 欄位待後端加入 `job_class` 後再補。

---

### B6 — `QUEST_STRATEGY` → Guide API 回傳格式不符

| 項目 | |
|------|---|
| **用到的元件** | `StrategyTabs`、`WalkthroughTab`（party 詳情頁副本攻略） |
| **UI 需要的格式** | `QuestStrategy`（設計型別：steps、tips、videoUrl 等） |
| **現有 API 回傳** | `GET /raid-boss-options/:id/guide` 或 `GET /parties/:id/guide` → `GuideTemplate`（Markdown content / structured JSON） |
| **缺少原因** | 設計的攻略型別與後端 `GuideTemplate` 結構不同，需要對應 adapter 或重新設計 UI 型別 |
| **建議** | 前端棄用設計型別 `QuestStrategy`，直接使用後端 `GuideTemplate` 結構重新設計 `WalkthroughTab` |

---

## 類型 C — 無 API，需要全新開發

### ~~C1 — 登入頁活動牆~~ ✅ 完成

`ActivityItem` 型別移除 `kind` 欄位，`SAMPLE_ACTIVITY` 改為 10 筆純隊伍資料。`FlipItem` 移除 guild 分支，固定顯示隊伍 badge。不再需要公會資料。

---

### C2 — GuildMember 線上狀態

| 項目 | |
|------|---|
| **元件** | `MembersSection`（線上分組顯示）、`OverviewSection`（線上成員數） |
| **需要的 API** | 每位 guild member 的 `is_online` 狀態 |
| **現況** | 後端有 WebSocket 連線，但未 expose per-user 線上狀態；`GET /stats/online` 只回傳總連線數 |
| **開發方式** | 在 Redis 維護 guild_id:user_id → is_online 的 Hash；`GET /guilds/:id/members` 加入 `is_online` 欄位 |
| **短期替代** | 移除線上分組，改為單一成員列表（B3 選項 B） |

---

### C3 — Party / Guild 即時聊天 WebSocket 整合

| 項目 | |
|------|---|
| **元件** | `GuildChat`（公會聊天）、`ChatPanel`（party 聊天） |
| **目前** | 聊天只有初始 HTTP 載入歷史，無即時推送 |
| **後端狀態** | `/ws` WebSocket endpoint 已存在，支援 `party:{id}:chat`、`guild:{id}:chat` 頻道推送 |
| **缺少** | 前端 `useWebSocket()` hook 整合：訂閱頻道、append 新訊息、斷線重連 |
| **備注** | `src/hooks/useWebSocket.ts` 已存在但功能待確認；這是獨立工作量，估計高 |

---

## 摘要統計

| 類型 | 數量 | 工作量 |
|------|------|--------|
| A — 有 API，尚未串接 | 10 項 | 低–中（純前端 hook 串接） |
| B — 有相近 API，需修改 | 3 項待辦（B4/B5 已完成） | B2 需後端修改；B3/B6 可純前端解決 |
| C — 無 API，需開發 | 2 項待辦（C1 已完成） | C2/C3 需後端新開發 |

---

## 建議開發批次

| 批次 | 內容 | 前置條件 | 可並行 |
|------|------|---------|--------|
| **Batch 1** | A1（MatchSection 角色）、~~C1~~ ✅ | 無 | ✅ 可同時 |
| **Batch 2** | B2（後端：min_level 欄位） | 無 | ✅ 可同時 |
| **Batch 3** | A2–A7（公會各子 section）、B3 前端解法（~~B4/B5~~ ✅） | 無 | ✅ 可並行分工 |
| **Batch 4** | A8/A9/A10（GuildsClient + GuildDetailClient + Settings）+ B6（Guide UI 重設計） | Batch 2 | ❌ 需後端欄位就位 |
| **Batch 5** | C3（WebSocket 即時聊天） | 無（後端已就緒） | 獨立 task |
| **Batch 6** | C2（member online 狀態） | 後端新開發 | 獨立 task |
