# ADR-0015: 訪客帳號與登入帳號整合——一般即時隊伍互通

- 狀態: Accepted（部分推翻 [docs/features/guest-mode-plan.md](../features/guest-mode-plan.md) 的 Locked Decisions）
- 日期: 2026-07-07
- 相關模組: backend / party / auth；frontend / party / auth
- 相關文件: docs/business-logic.md, docs/api-reference.md, docs/backend-data-flows.md, docs/frontend-logic.md, docs/features/party.md, docs/features/guest-mode-plan.md

## 背景 (Context)

使用者要求：未登入訪客（quick guest，僅存在於 Redis、無 Postgres 資料列）應能與登入帳號共同使用「一般隊伍」，訪客可以建立、申請、加入、甚至擔任隊長；訪客登入後，原本以訪客身分建立/加入的隊伍應自動轉移到登入帳號，不得遺失。

現有系統已有兩套平行機制：

1. **一般隊伍**（`internal/party` 的 `CreateParty`/`Apply`/`ReviewApplication` 等）：`scheduled_at`／`guild_id` 有值時落 Postgres（`parties`/`party_slots`/`party_applications`），**`scheduled_at IS NULL && guild_id IS NULL`（即時公開隊伍）時完全只存 Redis**（`repository_party_write.go` 的 `CreateParty` 分支）。這與最初提出需求時「一般隊伍是 DB-backed」的假設不同——即時一般隊伍本就是 Redis-only，只有排程/公會隊伍才落 DB。
2. **quick party（快速隊伍）**：獨立的訪客優先系統，成員以 `TokenHash`（訪客為 SHA256(token)，登入者為 `"actor:"+actorID`）識別，Redis JSON 儲存於 `party:data:{id}`。

`pkg/identity` 已有統一的 `Identity{Kind: actor|discord|guest}` 抽象，訪客身分鏈為：`quick_guest_token` cookie（24h HttpOnly）→ Redis `quick:guest:{sha256(token)}` hash → deterministic UUIDv5 `quickGuestIdentityID(tokenHash)`。但 quick party 與一般隊伍是兩套獨立資料模型，訪客先前完全不能碰一般隊伍；且**quick party 本身也沒有「訪客登入後轉移身分」的機制**——`quickParticipantForViewer` 嚴格比對 `TokenHash`，登入後 hash 變成 `"actor:"+id`，舊紀錄直接比對不到，訪客身分即刻丟失。

## 考慮過的方案 (Options Considered)

### A. 訪客參與一般隊伍的資料落點

1. **在 `parties`/`party_slots`/`party_applications` 新增訪客欄位**（原始需求假設的方案）：新增 `leader_guest_id`、`filled_by_is_guest` 等欄位與對應 migration。
   - 維護性：需要 migration、schema 變更、DB 端訪客資料生命週期管理（TTL 由誰清理）。
   - 安全性：訪客帳號進入 Postgres，即便只存 UUID + 暱稱快照，仍違反「訪客帳號完全不落 DB」的原始前提精神。
   - 適用性：**即時一般隊伍本就不落 DB**，此方案實際上無資料列可加；只有排程/公會隊伍才有 DB 列，而訪客明確不開放排程/公會隊伍。
2. **訪客快照欄位只存在於 Redis-only 即時隊伍的 JSON snapshot 內**（採用此方案）：`Party`/`Slot`/`Application` 新增 `db:"-"` 的訪客欄位（`LeaderGuestID`/`LeaderGuestName`/`LeaderGuestJob`/`LeaderGuestLevel`、`FilledByIsGuest`、`ApplicantIsGuest`/`GuestApplicant`），DB 寫入路徑（排程/公會隊伍）明確禁止攜帶這些欄位。
   - 維護性：不需要 migration；欄位與既有 `Slots`/`QuickParticipants` 等 `db:"-"` 欄位模式一致。
   - 安全性：訪客帳號 100% 不落 Postgres，比原始前提更嚴格。
   - 效能：無額外 DB 負擔。

### B. 訪客的「一人一場即時活動」互斥

1. **沿用 DB 的 `activity_presence_locks` 表**：`character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE`，訪客 UUID 無對應 characters 列，`INSERT` 會 FK 違反。
2. **新增 Redis-only 訪客互斥鎖 `quick:guest:activity:{guestID}`**（採用此方案）：`SET NX`，值為目前佔用的 partyID，TTL 2 小時（比照 `activity_presence_locks.expires_at` 預設）；鎖衝突時檢查所持有的 party 是否仍開啟，已關閉/不存在則視為過期並接管。

### C. 訪客權限旗標（隊長是否可拒收訪客申請者）

1. **新增 `allow_guest_players` 欄位**：語意最精確，但需要 migration，且與既有 `allow_quick_login_players`（「允許未綁 Discord 的參與者」）語意高度重疊。
2. **擴張既有 `allow_quick_login_players` 語意為「允許未綁 Discord 的參與者（quick-login actor + 訪客）」**（採用此方案）：不需要 migration，訪客與 quick-login-only actor 是同一類「非 Discord 綁定」風險等級的參與者。

### D. 訪客登入後的身分轉移（claim）觸發點

1. **`internal/auth` 登入 handler 內直接呼叫 party 模組的 claim 邏輯**：`internal/party → pkg/middleware → internal/auth` 已存在依賴鏈，`auth` 反向 import `party` 會成環；即便改用 interface 注入解環，也讓 auth 模組承擔它本不該知道的 party 業務邏輯。
2. **前端登入成功後主動呼叫新端點 `POST /parties/guest-claim`**（採用此方案）：`quick_guest_token` 是 HttpOnly，前端讀不到內容，但可以在登入成功的當下打一支已登入態的 API，由後端 server-side 讀 cookie 執行 claim；避免模組間反向依賴，且前端可以取得 claim 結果（成功/略過清單）並提示使用者。

### E. 登入認領時如何找出訪客名下的隊伍

1. **一般即時隊伍**：沿用既有 `character:member_party_refs:{characterID}`／`actor:app_refs:{characterID}` 反查索引——這兩個索引在 Phase 1 已確認會自動把訪客 UUID 一併收錄（`partyMemberCharacterIDs`／`CreateApplication` 寫入時未區分 guest/character），**不需要新增訪客專屬索引**。
2. **quick party**：quick party 的成員/申請追蹤是 `QuickParticipants`/`QuickApplications`（以 `TokenHash` 比對），從未寫入 `character:member_party_refs`，故沒有反查索引可用；改為掃描 `party:list:immediate` zset（所有目前開啟的即時隊伍）後以 `GetQuickPartiesByIDs` 批次 MGET，逐一比對 `TokenHash`。

## 決策 (Decision)

1. **資料表示**：採方案 A-2。`Party`/`Slot`/`Application` 新增 `db:"-"` 訪客欄位；不變式——guest 欄位只可能出現在 `!IsQuick && ScheduledAt == nil && GuildID == nil` 的 Redis snapshot 上，DB 寫入路徑（`buildPartyBase`、`repository_party_write.go` 的排程/公會分支）明確拒絕帶有 `LeaderGuest` 的輸入（回傳 `ErrGuestImmediateOnly`）。
2. **活動互斥**：採方案 B-2。`quick:guest:activity:{guestID}` Redis 鎖，`SET NX`，TTL 2h，衝突時檢查持鎖 party 是否已關閉來判斷是否接管。
3. **權限旗標**：採方案 C-2。`allow_quick_login_players == false` 同時阻擋 quick-login-only actor 與訪客申請；不新增欄位。
4. **訪客聊天**：v1 納入標準即時隊伍聊天——`usecase_lookup.go` 的 `CanActorAccessParty`/`IsActorInParty`/`ResolveChatSender` 新增訪客分支，純粹從已載入的 Redis snapshot（`LeaderGuestID`/`FilledByIsGuest` slots）判斷，不需要額外 DB/Redis 往返；沿用 quick party 已驗證過的「guest sender」訊息格式。
5. **登入認領觸發**：採方案 D-2。新增 `POST /parties/guest-claim`（Auth 群組，登入後呼叫；server-side 讀 `quick_guest_token` cookie）。
6. **登入認領掃描**：採方案 E-1/E-2 併行——一般隊伍用既有反查索引（免新增索引維護成本），quick party 用全量即時隊伍掃描。
7. **登入認領語意**：per-party best-effort、部分成功、冪等可重試：
   - 訪客為一般隊伍隊長且登入者有目前角色 → 通過 DB `exclusion.JoinActivity` 檢查後，`LeaderID`/`LeaderUserID` 改為登入角色，清空 `LeaderGuest*`，隊長 slot 快照改寫；無目前角色則 skip（`NO_CHARACTER`），活動衝突則 skip（`ACTIVITY_CONFLICT`）且不動原資料。
   - 訪客為一般隊伍成員（非隊長）→ 同上檢查與改寫；若角色不符合該 slot 的職業/等級限制，**不逐出**，只在回應中標記 `SLOT_REQUIREMENT_MISMATCH` 警告，交由隊長之後自行決定。
   - 訪客有待審申請（不論一般隊伍隊長是訪客或登入者）→ 直接改寫 Redis 申請項目的 `ApplicantID`/`ApplicantIsGuest`/`Character`/`GuestApplicant`，並搬移 `actor:app_refs` 索引；不需要活動鎖檢查（申請當下未持有活動鎖，鎖只在 Accept 時才取得）。
   - quick party 的 `TokenHash` 由 guest hash 改寫為 `"actor:"+actorID`；若登入者已用自己身分獨立存在於同一 party（例如曾同時以訪客與登入身分互動），去重時保留登入者身分、捨棄訪客重複項目。
   - 單一隊伍認領失敗（lock busy／party 已關閉／找不到）只計入該隊的 `skipped`，不影響其他隊伍；同一 guest token 重複呼叫此端點是安全的（已認領的隊伍第二次掃描時已比對不到訪客身分，自然略過）。
8. **申請/接受流程的活動鎖分支**（Phase 3 修正，屬本決策整體範圍）：`joinOngoingActivity`/`leaveOngoingActivity(ForApplicant)`/`cancelCompetingPendingApplications` 一律依申請人**自身**的 `ApplicantIsGuest`（而非隊伍領導者是誰）決定走 DB `exclusion` 服務或 Redis 訪客鎖——訪客可以申請登入者的隊伍、登入者也可以申請訪客的隊伍，兩種組合都必須各自正確處理，不可用「隊伍是否訪客建立」來判斷。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性優先**：方案 A-2 讓訪客帳號完全不落 Postgres，滿足使用者最初「訪客不進 DB」的硬性要求，比原始允許落 DB 的前提更嚴格；`ReplacePartyAsGuest` 的成員異動限制為「必須已是隊伍現有成員」（不透過 pending-check，因為該檢查對即時隊伍本就是 DB-only 的無效檢查），避免訪客隊長偽造任意角色 ID 進入 slot。
- **維護性**：不新增 migration；重用既有反查索引、既有 `personalRoomForPartyLeader`/`quickCapabilitiesForParty` 等函式的 guest fallback 模式；`reviewApplicationCore`/`loadApplicationAndParty` 抽出共用邏輯讓 actor 與 guest 審核路徑不重複實作，且天然保證兩者的活動鎖分支修正同時生效。
- **效能**：quick party 掃描雖是全量即時隊伍列表，但僅在登入當下觸發一次（非高頻路徑），且已用 `GetQuickPartiesByIDs` 批次 MGET 取代逐筆查詢；一般隊伍沿用既有反查索引，無額外查詢成本。

## 被拒絕方案與原因 (Rejected Alternatives)

- **DB guest 欄位（方案 A-1）**：即時一般隊伍本就不落 DB，此方案無資料列可加；即便未來訪客要開放排程隊伍才需要重新評估。
- **新增 `allow_guest_players` 欄位（方案 C-1）**：與既有 `allow_quick_login_players` 語意重疊，徒增一個等價但獨立維護的旗標。
- **auth handler 內直接呼叫 party claim 邏輯（方案 D-1）**：造成模組間反向依賴（`party → middleware → auth`，`auth → party` 會成環），且讓 auth 模組承擔它不該知道的業務邏輯。
- **claim 失敗時全量 rollback（all-or-nothing）**：與「每個隊伍各自獨立、互不影響」的使用情境不符——訪客可能同時持有多個隊伍身分，其中一個因活動衝突失敗不該連累其他已成功的隊伍。
- **guest → quick-party 反查索引**：quick party 從未寫入 `character:member_party_refs`，若新增索引維護需要在 quick party 每次成員異動都額外寫入該索引，維護成本高於「登入時才做一次全量掃描」。
- **訪客申請一般隊伍時比照 actor 檢查黑名單（`party_blocklist`）**：訪客無 character，黑名單本以角色 ID 為鍵，訪客身分無法比對，v1 略過此檢查（訪客申請的隊伍其隊長仍可透過踢人/拒絕申請人工把關）。

## 影響 (Consequences)

- **API 契約新增**：`POST /parties/guest`、`POST/GET/DELETE /parties/{id}/guest-applications(...)`、`POST /parties/{id}/guest-slots/{slotId}/kick`、`DELETE /parties/{id}/guest-membership`、`POST /parties/{id}/guest-close`、`POST /parties/{id}/guest-liveness`、`PATCH|PUT /parties/{id}/guest-settings`、`POST /parties/guest-claim`。既有 `Party`/`Slot`/`Application` JSON 回應新增訪客欄位（`omitempty`，向後相容既有前端）。
- **[docs/features/guest-mode-plan.md](../features/guest-mode-plan.md) 的 Locked Decisions 部分被推翻**：該文件鎖定「v1 只支援 actor 申請/加入 guest-owned party，guest 不能申請 actor-owned party」「不新增 guest websocket/notification/chat」。本決策推翻為：訪客可建立/申請/擔任隊長於一般即時公開隊伍（雙向皆可，訪客與登入者互相申請對方的隊伍皆合法），且 v1 即納入訪客聊天。該文件需同步校正現況（見文件更新清單）。
- **`allow_quick_login_players` 語意擴張**：既有依賴此欄位語意為「只擋 quick-login-only actor」的呼叫端，行為上會多擋訪客申請——這是預期內的擴張，非破壞性變更（原本訪客本就不能申請一般隊伍，現在「新增的能力」直接受此旗標約束是正確行為）。
- **`ReplacePartyAsGuest` 的成員異動限制**：訪客隊長透過 PUT 整份取代隊伍設定時，`filled_by` 只能設為「隊伍現有成員」，無法透過此端點加入新成員（新成員必須走申請/接受流程）。這比 actor 版本的 `ReplaceParty`（可用「該角色本人擁有」或「有 pending 申請」放行）更嚴格，因為訪客沒有「本人擁有其他角色」的概念可驗證。
- **前端**：`useViewerIdentity` hook 與 API/型別層已就緒，但訪客建立/申請一般隊伍的實際 UI（`QuickGuestIdentityPrompt` 擴充職業/等級、建隊頁訪客模式、隊伍卡片/詳情頁的訪客渲染）為後續 UI 專案（已標記待辦），本決策的前端落地目前僅涵蓋登入自動認領（呼叫 `POST /parties/guest-claim`）。

## Supersedes / Superseded by

推翻 [docs/features/guest-mode-plan.md](../features/guest-mode-plan.md) 的 Locked Decisions 部分內容（非 ADR，故不使用「Superseded by」標記，改於本節與該文件本身註明）；不推翻任何既有 ADR-0001～0011。
