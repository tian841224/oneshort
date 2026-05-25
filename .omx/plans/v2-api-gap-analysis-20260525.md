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
| ~~A1~~ | ~~`MatchSection` → `MyPreferencesPanel`~~ | ~~`SAMPLE_CHARACTERS`~~ | ~~`GET /characters`~~ | ~~`useCharacters()`~~ | ✅ 完成 |
| ~~A2~~ | ~~`AnnouncementsSection`~~ | ~~`GUILD_ANNOUNCEMENTS`~~ | ~~`GET /guilds/:id/announcements`~~ | ~~`useGuildAnnouncements(id)`~~ | ✅ 完成：新增/編輯公告 inline form + `useCreateGuildAnnouncementMutation` / `useUpdateGuildAnnouncementMutation`；pin/delete 原已串接 |
| ~~A3~~ | ~~`PartiesSection`~~ | ~~`GUILD_PARTIES`~~ | ~~`GET /guilds/:id/parties`~~ | ~~`useGuildParties(id)`~~ | ✅ 完成：建立隊伍 inline form + `useCreateGuildPartyMutation` |
| ~~A4~~ | ~~`MatchSection` → `ConfigsPanel`~~ | ~~`GUILD_BOSS_CONFIGS`~~ | ~~`GET /guilds/:id/boss-configs`~~ | ~~`useGuildBossConfigs(id)`~~ | ✅ 完成 |
| ~~A5~~ | ~~`MatchSection` → `MatchRunPanel`~~ | ~~`GUILD_BOSS_MEMBER_SETTINGS`~~ | ~~`GET /guilds/:id/match/member-settings?boss_id=X`~~ | ~~`useGuildBossMemberSettings(id, bossId)`~~ | ✅ 完成 |
| ~~A6~~ | ~~`MatchSection` → `MyPreferencesPanel`~~ | ~~`GUILD_MY_PREFERENCES`~~ | ~~`GET /guilds/:id/me/preferences`~~ | ~~`useGuildPreferences(id)`~~ | ✅ 完成 |
| ~~A7~~ | ~~`MatchSection` → `HistoryPanel`~~ | ~~`GUILD_MATCH_HISTORY`~~ | ~~`GET /guilds/:id/me/match-history`~~ | ~~`useGuildMatchHistory(id)`~~ | ✅ 完成 |
| ~~A8~~ | ~~`GuildsClient` (公會列表)~~ | — | — | — | ✅ 完成：已用 `useGuildList()`；C4 補 `s.min_level ?? 0`；`GuildListCard`/`GuildPreview` 均顯示 `guild.minLv` |
| ~~A9~~ | ~~`GuildDetailClient` (公會詳情)~~ | — | — | — | ✅ 完成：已用 `useGuildDetail()`；`GuildDetail extends GuildSummary` 繼承 `min_level` |
| ~~A10~~ | ~~`SettingsSection` (儲存/離開/解散按鈕)~~ | — | — | — | ✅ 完成：三個 mutation 均已接好；補入 `min_level` 至 form init、save payload、reset |

---

### ~~登入頁 `/login`~~ ✅ 完成

| # | 元件 | 狀態 |
|---|------|------|
| ~~A11~~ | `LoginScreen` → Discord 登入按鈕 | ✅ `handleDiscordLogin()` 呼叫 `startDiscordLogin()`，`/auth/discord/callback` 頁面已存在於 v2 worktree |
| ~~A12~~ | `LoginScreen` → 快速登入表單 | ✅ `handleQuickLogin()` 完整實作 `quickLoginCheck` 流程、loading/error 狀態 |

---

### ~~帳號頁 `/me`~~ ✅ 完成（A14–A19）

| # | 元件 | 狀態 |
|---|------|------|
| A13 | `AccountScreen` → 編輯個人資料按鈕 | ⏭ 跳過：後端無 `PUT /actors/me` endpoint |
| ~~A14~~ | ~~`AccountScreen` → 新增角色按鈕~~ | ✅ 完成：inline 表單 + `useCharacterMutations().createMutation` |
| ~~A15~~ | ~~`AccountScreen` → 設為主要角色按鈕~~ | ✅ 完成：`toggleActiveMutation` |
| ~~A16~~ | ~~`AccountScreen` → 編輯角色按鈕~~ | ✅ 完成：inline 表單 + `updateMutation` |
| ~~A17~~ | ~~`AccountScreen` → PIN 更新表單~~ | ✅ 完成：`authApi.updatePin()` |
| ~~A18~~ | ~~`AccountScreen` → Discord 解除綁定按鈕~~ | ✅ 完成：`authApi.unlinkDiscord()` + store 更新 |
| ~~A19~~ | ~~`AccountScreen` → Discord 連結按鈕~~ | ✅ 完成：`startDiscordLogin('link')` |
| A20 | `AccountScreen` → 通知偏好 toggle | ⏭ 跳過：後端 endpoint 未確認 |

---

### ~~配對頁面~~

| # | 元件 | 狀態 |
|---|------|------|
| ~~A21~~ | ~~`MatchSection` → `MatchRunPanel` → 「確認並建立隊伍」按鈕~~ | ✅ 完成：`useCreateGuildPartyMutation`，依 boss config 展開 job_slots 建立隊伍 |

---

## 類型 B — 有相近 API，但需要修改

### ~~B2 — `GET /guilds` 缺少 `min_level` 欄位~~ ✅ 完成

migration `0043_add_min_level_to_guilds`、`domain.go` (`MinLevel *int16`)、`repository_guild.go`（CREATE/UPDATE/SELECT 均更新）、`repository_helpers.go`（`guildSelectSQL` 加入 `g.min_level`）。Branch: `feature/oneshort-v2-api`。

---

### ~~B3 — `GUILD_MEMBERS` → API 缺少 `online` 狀態欄位~~ ✅ 完成（選項 B）

採選項 B：移除 online 分組。`OverviewSection` 改用 `useGuildMembers` 真實資料，`OnlineDot.tsx` 已刪除，線上狀態 UI（綠點、「在線/離線」文字）全部移除。

---

### ~~B4 — `GUILD_SCHEDULE` → calendar API 回傳格式不符~~ ✅ 完成

`OverviewSection` 已改用 `useGuildCalendar(guild.id)` 串接真實 API，並選用選項 A（移除 slot 數顯示）。`whenRel` 由前端 `formatCalendarTime` 函式從 `scheduled_at` 計算。

---

### ~~B5 — `GUILD_CHAT` → API 訊息格式需要 adapter~~ ✅ 完成

`apiToUiGuildChatMessage` adapter 已抽出至 `src/features/guild/chatAdapter.ts`，含 5 個單元測試。`GuildChatUiMessage` UI 型別定義於 `src/features/guild/types.ts`（正確 features→app 相依方向）。`cls` 欄位待後端加入 `job_class` 後再補。

---

### ~~B6 — `QUEST_STRATEGY` → Guide API 回傳格式不符~~ ✅ 完成

`WalkthroughTab` 完整重建，接受 `GuideContent | null | undefined`，渲染所有 10 種 block 型別（heading/text/list/divider/callout/section/image/video/table/widget）。`dangerouslySetInnerHTML` 使用 `DOMPurify.sanitize`；`StrategyTabs` 改用 `useGuide(partyId)` 真實 hook。

---

## 類型 C — 無 API，需要全新開發

### ~~C1 — 登入頁活動牆~~ ✅ 完成

`ActivityItem` 型別移除 `kind` 欄位，`SAMPLE_ACTIVITY` 改為 10 筆純隊伍資料。`FlipItem` 移除 guild 分支，固定顯示隊伍 badge。不再需要公會資料。

> **注意：** 登入頁線上人數與總用戶數仍為假數字（每 2.4 秒隨機變化），屬於 C1-補；短期可直接改用 `GET /stats/online`，總用戶數待後端 expose 後再串。

---

### ~~C2 — GuildMember 線上狀態~~ ✅ 移除（不實作）

採短期替代方案：移除所有線上狀態 UI。`GuildChat` 移除 `online` prop；`GuildDetailClient` 移除 `online={0}`；`OverviewSection` 移除線上指示器；`OnlineDot.tsx` 已刪除。

---

### ~~C3 — Party / Guild 即時聊天 WebSocket 整合~~ ✅ 已完整實作（調查後確認）

`useGuildChat` / `usePartyChat` 均已透過 `wsStore.subscribe(room_id)` 訂閱 WebSocket；`useWebSocketEventHandler` 路由 `guild.chat` / `chat` 事件；斷線重連由 `resubscribeActiveRooms` 處理。無需開發。

---

### ~~C4 — 建立公會~~ ✅ 完成

`GuildsClient` 新增建立公會 modal form（名稱/說明/加入方式/密碼/人數上限/min_level），串接 `useCreateGuildMutation`；`GuildSummary`/`GuildCreateInput`/`GuildUpdateInput` 均加入 `min_level?: number | null`；`summaryToDesignGuild` 使用 `s.min_level ?? 0`。

---

### ~~C5 — MatchRunPanel 試算與草案生成~~ ✅ 完成

`MatchRunPanel` 串接 `useGuildMatchDryRunMutation`（試算預覽）、`useGuildMatchMutation`（產生草案）、`useCurrentGuildMatchDraft`（頁面載入還原草案）、`useGenerateGuildMatchRunMutation`（確認建立隊伍）；loading/error/success 狀態完整；`useEffect` 處理草案初始化。

---

## 摘要統計

| 類型 | 數量 | 工作量 |
|------|------|--------|
| A — 有 API，尚未串接 | **0 項待辦** ✅ A8/A9/A10 全部完成（A13/A20 跳過） | — |
| B — 有相近 API，需修改 | **0 項待辦** ✅ B2/B3/B4/B5/B6 全部完成 | — |
| C — 無 API，需開發 | **0 項待辦** ✅ C1–C5 全部完成或移除 | — |

---

## 建議開發批次（更新）

| 批次 | 內容 | 前置條件 | 可並行 | 優先度 |
|------|------|---------|--------|--------|
| ~~**Batch 0**~~ | ~~A11/A12~~（Discord 登入、快速登入） | — | — | ✅ DONE |
| ~~**Batch 1**~~ | ~~A1（MatchSection 角色）~~、~~C1~~ | — | — | ✅ DONE |
| ~~**Batch 2**~~ | ~~B2（後端：min_level 欄位）~~ | — | — | ✅ DONE |
| ~~**Batch 3**~~ | ~~A14–A19（帳號頁按鈕與表單）~~ | — | — | ✅ DONE |
| ~~**Batch 4**~~ | ~~A2–A7、A3、A21、B3、B4/B5、C2、C3、C4、C5、B6~~ | — | — | ✅ DONE |
| ~~**Batch 5**~~ | ~~A8/A9/A10（GuildsClient + GuildDetailClient + Settings）~~ | — | — | ✅ DONE |
