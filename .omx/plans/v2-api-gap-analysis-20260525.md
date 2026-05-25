# v2 Frontend API Gap Analysis

**範圍：** `feature/oneshort-v2-redesign` worktree  
**日期：** 2026-05-25（更新：2026-05-25）  
**判斷標準：** 元件使用靜態假資料、按鈕/表單無動作、或缺少 API hook

---

## 類型說明

| 類型 | 定義 |
|------|------|
| **A** | 後端 API 已存在、前端 hook 已存在，只需在元件裡換掉假資料或接上事件處理器 |
| **B** | 後端 API 存在但欄位不齊，或回傳格式需要 adapter 轉換才能接上 UI |
| **C** | 後端完全沒有對應 API，需要全新開發 |

---

## 類型 A — 有可用 API，尚未串接（純前端工作）

### 原始項目

| # | 元件 | 目前假資料 | 所需 API | 現有 hook | 備注 |
|---|------|-----------|---------|---------|------|
| A1 | `MatchSection` → `MyPreferencesPanel` | `SAMPLE_CHARACTERS` | `GET /characters` | `useCharacters()` | 需轉換 game_name/job_class → name/cls |
| ~~A2~~ | ~~`AnnouncementsSection`~~ | ~~`GUILD_ANNOUNCEMENTS`~~ | ~~`GET /guilds/:id/announcements`~~ | ~~`useGuildAnnouncements(id)`~~ | ✅ 完成：新增/編輯公告 inline form + `useCreateGuildAnnouncementMutation` / `useUpdateGuildAnnouncementMutation`；pin/delete 原已串接 |
| A3 | `PartiesSection` | `GUILD_PARTIES` | `GET /guilds/:id/parties` | `useGuildParties(id)` | 建立隊伍按鈕需串接 `useCreateGuildPartyMutation` |
| A4 | `MatchSection` → `ConfigsPanel` | `GUILD_BOSS_CONFIGS` | `GET /guilds/:id/boss-configs` | `useGuildBossConfigs(id)` | 儲存需串接 `useUpdateGuildBossConfigsMutation` |
| A5 | `MatchSection` → `MatchRunPanel` | `GUILD_BOSS_MEMBER_SETTINGS` | `GET /guilds/:id/match/member-settings?boss_id=X` | `useGuildBossMemberSettings(id, bossId)` | bossId 由選取狀態決定 |
| A6 | `MatchSection` → `MyPreferencesPanel` | `GUILD_MY_PREFERENCES` | `GET /guilds/:id/me/preferences` | `useGuildPreferences(id)` | 儲存需串接 `useUpdateGuildPreferencesMutation` |
| A7 | `MatchSection` → `HistoryPanel` | `GUILD_MATCH_HISTORY` | `GET /guilds/:id/me/match-history` | `useGuildMatchHistory(id)` | 唯讀 |
| A8 | `GuildsClient` (公會列表) | `SAMPLE_GUILDS` | `GET /guilds` | `useGuildList()` | 依賴 B2 補足欄位後才能完整顯示 |
| A9 | `GuildDetailClient` (公會詳情) | `SAMPLE_GUILDS` | `GET /guilds/:id` | `useGuildDetail(id)` | 依賴 B2 補足欄位 |
| A10 | `SettingsSection` (儲存/離開/解散按鈕) | 按鈕目前無 onClick | `PUT /guilds/:id` / `DELETE /guilds/:id/me` / `DELETE /guilds/:id` | `useUpdateGuildMutation` / `useLeaveGuildMutation` / `useDisbandGuildMutation` | 按鈕 UI 存在，只需加 onClick 與 loading 狀態 |

---

### ~~登入頁 `/login`~~ ✅ 完成

| # | 元件 | 狀態 |
|---|------|------|
| ~~A11~~ | `LoginScreen` → Discord 登入按鈕 | ✅ `handleDiscordLogin()` 呼叫 `startDiscordLogin()`，`/auth/discord/callback` 頁面已存在於 v2 worktree |
| ~~A12~~ | `LoginScreen` → 快速登入表單 | ✅ `handleQuickLogin()` 完整實作 `quickLoginCheck` 流程、loading/error 狀態 |

---

### 帳號頁 `/me`（新增）

`AccountScreen.tsx` 有 8 個無動作的按鈕/表單，所有 hook 與 API 在 develop branch 均已存在。

| # | 元件 | 問題 | 所需 API | 現有 hook |
|---|------|------|---------|---------|
| A13 | `AccountScreen` → 編輯個人資料按鈕 | 無 onClick | `PUT /actors/me` | `useUpdateActorMutation` |
| A14 | `AccountScreen` → 新增角色按鈕 | 無 onClick | `POST /characters` | `useCharacters()` |
| A15 | `AccountScreen` → 設為主要角色按鈕 | 無 onClick | `PUT /actors/me/current-character` | `useCharacterMutations` |
| A16 | `AccountScreen` → 編輯角色按鈕 | 無 onClick | `PUT /characters/:id` | `useCharacterMutations` |
| A17 | `AccountScreen` → PIN 更新表單 | 有輸入框但無提交邏輯 | `PUT /actors/me/pin` | `authApi.updatePin()` |
| A18 | `AccountScreen` → Discord 解除綁定按鈕 | 無 onClick | `DELETE /auth/discord/link` | `authApi.unlinkDiscord()` |
| A19 | `AccountScreen` → Discord 連結按鈕 | 無 onClick，OAuth 流程缺失 | `POST /auth/discord/link` | `authApi.linkDiscord()`、`startDiscordLogin()` |
| A20 | `AccountScreen` → 通知偏好 toggle | 有 local state 但無保存到 API | 待確認後端端點 | 不確定 hook 是否存在，需確認 |

---

### 配對頁面（新增）

| # | 元件 | 問題 | 所需 API | 現有 hook |
|---|------|------|---------|---------|
| A21 | `MatchSection` → `MatchRunPanel` → 「確認並建立隊伍」按鈕 | 完全無 onClick，隊伍建立邏輯缺失 | `POST /guilds/:id/parties` | `useCreateGuildPartyMutation` |

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

> **注意：** 登入頁線上人數與總用戶數仍為假數字（每 2.4 秒隨機變化），屬於 C1-補；短期可直接改用 `GET /stats/online`，總用戶數待後端 expose 後再串。

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

### C4 — 建立公會

| 項目 | |
|------|---|
| **元件** | `GuildsClient` → 「建立公會」按鈕 |
| **目前** | 按鈕只顯示 toast「建立公會功能即將推出」，無實際邏輯 |
| **需要的 API** | `POST /guilds`（建立公會）；完整的建立表單 UI（名稱、說明、`min_level`、公開/私有） |
| **前置條件** | 依賴 B2（`min_level` 欄位）就位後才能完整實作 |

---

### C5 — MatchRunPanel 試算與草案生成

| 項目 | |
|------|---|
| **元件** | `MatchSection` → `MatchRunPanel` → 「試算預覽」、「產生配對草案」按鈕 |
| **目前** | 兩個按鈕只改變本地 UI state（`setPreviewExpanded`），無算法實現或 API 呼叫 |
| **需要的 API** | `POST /guilds/:id/match/preview`（試算）、`POST /guilds/:id/match/draft`（產生草案）；後端需評估是否已存在相關邏輯 |
| **備注** | 這是配對核心功能，工作量未知；需後端確認現有 matching 算法是否可直接 expose |

---

## 摘要統計

| 類型 | 數量 | 工作量 |
|------|------|--------|
| A — 有 API，尚未串接 | 19 項待辦（A11/A12 ✅ 已完成） | 低–中（純前端 hook 串接） |
| B — 有相近 API，需修改 | 3 項待辦（B4/B5 ✅ 已完成） | B2 需後端修改；B3/B6 可純前端解決 |
| C — 無 API，需開發 | 4 項待辦（C1 ✅ 已完成） | C4 依賴 B2；C2/C3/C5 需後端評估 |

---

## 建議開發批次（更新）

| 批次 | 內容 | 前置條件 | 可並行 | 優先度 |
|------|------|---------|--------|--------|
| ~~**Batch 0**~~ | ~~A11（Discord 登入 + callback 頁面移植）、A12（快速登入表單串接）~~ | 無 | ✅ 已完成 | ✅ DONE |
| **Batch 1** | A1（MatchSection 角色）、~~C1~~ ✅ | 無 | ✅ 可同時 | 🟡 高 |
| **Batch 2** | B2（後端：min_level 欄位） | 無 | ✅ 獨立後端任務 | 🟡 高 |
| **Batch 3** | A13–A19（帳號頁所有無動作按鈕與表單）、A20（通知偏好，待確認端點） | 無 | ✅ 可並行分工 | 🟡 高 |
| **Batch 4** | A2–A7（公會各子 section）、A21（確認建立隊伍）、B3 前端解法、~~B4/B5~~ ✅ | 無 | ✅ 可並行分工 | 🟡 中 |
| **Batch 5** | A8/A9/A10（GuildsClient + GuildDetailClient + Settings）+ B6（Guide UI 重設計） | Batch 2 | ❌ 需後端 min_level 就位 | 🟡 中 |
| **Batch 6** | C3（WebSocket 即時聊天） | 無（後端已就緒） | 獨立 task | 🟢 低 |
| **Batch 7** | C4（建立公會 UI + 表單） | Batch 2 | ❌ 需後端 min_level 就位 | 🟢 低 |
| **Batch 8** | C5（試算/草案生成）、C2（member online 狀態） | 後端新開發 | 獨立 task | 🟢 最低 |
