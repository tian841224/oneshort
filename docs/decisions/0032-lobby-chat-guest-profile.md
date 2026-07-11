# ADR-0032: 大廳聊天訪客職業/等級顯示複用 quick-guest profile 機制

- 狀態: Accepted
- 日期: 2026-07-11
- 相關模組: backend / notify / party；frontend / chat / party
- 相關文件: docs/api-reference.md、docs/specs/notify.md（backend repo）、docs/decisions/0015-guest-standard-immediate-party-interop.md、docs/decisions/0025-quick-party-guest-job-level-snapshot.md

## 背景 (Context)

大廳聊天（`LiveChatRoom.tsx` + `POST /api/v2/lobby/chat`）對訪客（guest）訊息一律顯示成通用「遊客」樣式，不顯示職業/等級 pill，且訪客從未被要求設定角色資訊就能發言。需求：訪客首次送出大廳聊天訊息前，若尚未設定角色資訊（暱稱＋職業＋等級），應彈出「設定角色」畫面；設定完成後，大廳聊天訊息比照登入玩家顯示等級與職業。

實查程式碼後確認，訪客身分解析基礎設施（quick-guest Redis profile session、`identity.Identity.JobClassID`/`Level`、`EnsureQuickGuestProfile`、`ResolveQuickGuestIdentity`、前端 `GuestProfilePrompt` dialog）**已存在且被 ADR-0015/ADR-0025 驗證過**，只是大廳聊天的 POST 送訊息路徑（`SendLobbyChatMessage` 用 `middleware.GetIdentity(c)`，未走 `identityFromRequest`）與訊息渲染短路條件（`lobbyChatSenderFromIdentity`/`Struct` 只要 `Kind==KindGuest` 就一律顯示遊客）從未接上這條既有管線；前端 `useLobbyChat.ts` 送訊息時訪客分支也刻意 `credentials:'omit'`（2026-05-26 commit `229825e` 為保護登入者 access-token cookie 而設，非針對 quick-guest cookie）。

依 `.agent/rules/core.md` §3.1，此變動涉及後端訪客身分解析架構、API request body 契約、前端 cookie 信任邊界與共用渲染函式，判定為大改動，須列舉方案並記錄決策。

## 考慮過的方案 (Options Considered)

1. **方案 A — 複用既有 quick-guest Redis profile 機制**：`SendLobbyChatMessage` actor 解析改為「先試登入身分，否則走 quick-guest cookie 解析，並允許 request body 首次帶 `guest_display_name`/`guest_job_class_id`/`guest_level` 建立或更新 session（呼叫既有 `EnsureQuickGuestProfile`）」，回應設回 `quick_guest_token` cookie；渲染函式短路條件改為「Guest 且職業與等級皆未設定」才顯示通用遊客。維護性高（複用既有函式，無重複邏輯）；效能與 party guest 流程同量級（多一次 Redis HSet/HGetAll）；安全性風險與既有 party guest 流程一致（自報資料僅驗證 enum/範圍，非新增風險面）。
2. **方案 B — 大廳聊天獨立一套訪客身分機制**：不動 quick-guest 相關程式碼，另開一組 cookie 名稱、Redis key namespace、usecase 方法（邏輯高度複製 `EnsureQuickGuestProfile`/`ResolveQuickGuestIdentity`）。維護性明顯違反「重複邏輯必須封裝」；效能上多一組 TTL 治理成本；安全性風險同方案 A，但兩套身分互不同步，容易讓同一訪客在聊天室與隊伍卡片顯示不同職業/等級。
3. **方案 C — 前端 request body 直傳，後端不做身分持久化**：訪客 job/level 只存前端 localStorage，每次送訊息時直接放進 body，後端不呼叫 `EnsureQuickGuestProfile`、不設定/讀取 cookie，`credentials` 維持 `'omit'`。維護性尚可但驗證邏輯與方案 A 重複而未共用；效能最佳（省一次 Redis 寫入）但差異在低頻聊天場景可忽略；安全性風險最高——沒有伺服器端 session 約束同一訪客身分，同一使用者可在短時間內用不同 job/level 連續發言，需額外設計防濫用邏輯才能追平方案 A 的安全基準，等於繞了一圈。

## 決策 (Decision)

採用**方案 A**。

後端：
- `SendLobbyChatMessage` 的 actor 解析改為「先試 `middleware.GetIdentity(c)`；未登入時，若 `h.partyUC` 已注入，呼叫新介面方法 `PartyUseCase.EnsureQuickGuestChatSession`（`party.useCase.EnsureQuickGuestChatSession` 包一層 `EnsureQuickGuestProfile`，回傳 `identity.Identity` 而非 party 領域的 `QuickGuestIdentity`，避免 notify 套件依賴 party 專屬型別）」；`h.partyUC == nil`（僅測試情境）則優雅降級為原本的匿名遊客路徑。
- 新增 `lobbyChatRequest`（獨立於既有 `partyChatRequest`，避免隊伍聊天的 Swagger 契約意外多出訪客欄位）承載可選的 `guest_display_name`/`guest_job_class_id`/`guest_level`，沿用 `EnsureQuickGuestProfile` 既有的 enum/範圍驗證。
- 回應透過 notify 套件自有的 `setQuickGuestCookie` helper（與 `party.Handler.setQuickGuestCookie` 屬性一致：`Path=/`、`MaxAge=86400`、`HttpOnly`、`SameSite=Lax`、正式環境 `Secure`）設回 `quick_guest_token` cookie。
- `lobbyChatSenderFromIdentity`（map，HTTP POST 用）與 `lobbyChatSenderStructFromIdentity`（struct，WebSocket 用）短路條件改為：`actor.IsZero()` 或（`Kind==KindGuest` 且 `Level==0`）才顯示通用「遊客」——完成判斷只看 `Level`（合法值域 `[1,200]`，`0` 是無歧義的未設定哨兵）；`JobClassID` 不論值為何（含 `0`＝`jobclass.Beginner`／初心者，一個合法的職業列舉值）皆不作為判斷依據，避免把訪客的合法職業選擇誤判成「未設定」。
- WebSocket 的 `"chat"` action 已經走 `identityFromRequest`，無需改動。

前端：
- `LiveChatRoom.tsx` 的 `send()`：訪客且 `!isCompleteQuickGuestProfile(getQuickGuestProfile())` 時，先彈出 `GuestProfilePrompt`（dialog variant），儲存成功（`persistQuickGuestProfile`）才送出。
- `useLobbyChat.ts` 的 `sendMessage`：改為一律 `credentials:'include'`（登入者分支本來就是 `'include'`，實際只有訪客分支的值從 `'omit'` 變 `'include'`），並在 body 帶上訪客的 job/level/displayName（由 `getQuickGuestProfile()` 即時讀取）。
- `lobbyChatApi.ts` 的 `sendMessage` 簽名擴充可選 guest 欄位。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：
- **安全性**：方案 A 的風險面與既有 party guest 流程完全一致（ADR-0015/ADR-0025 已驗收過的風險等級），不新增攻擊面；方案 C 若不補防濫用邏輯風險明顯更高。
- **維護性**：方案 A 全面複用既有函式（`EnsureQuickGuestProfile`、`ResolveQuickGuestIdentity` 的識別建構模式、`GuestProfilePrompt`），符合「重複邏輯必須封裝」；方案 B 是明顯的邏輯複製，方案 C 的驗證邏輯與 A 重複但未共用。
- **效能**：三方案在大廳聊天這種低頻寫入場景差異可忽略，非決定性因素。

此外，使用者需求原文「比照一般登入玩家」隱含「訪客身分應該一致」——只有方案 A 讓「聊天室設定的角色」與「建隊時的訪客角色」自然共用同一份 Redis session，符合 ADR-0025 已建立的「訪客 job/level snapshot」設計哲學。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 B（獨立大廳聊天訪客機制）**：明顯重複造輪子（複製一整套 cookie/session/usecase 邏輯），且兩套身分互不同步會讓同一訪客在聊天室與隊伍卡片顯示不一致的職業/等級，直接違背「訪客身分應該一致」的使用者期待；長期維護成本高（未來容易只改一邊忘了改另一邊）。
- **方案 C（前端直傳，無 session）**：沒有伺服器端 session 概念約束「這個訪客是誰」，同一訪客可在短時間內用不同 job/level 連續發言而不受限制，安全/濫用風險最高；且訪客在聊天室設定的角色不會沿用到之後的建隊流程，與 ADR-0025 的 snapshot 設計精神不符。

## 影響 (Consequences)

- `notify.PartyUseCase` 介面新增 `EnsureQuickGuestChatSession` 方法，`party.UseCase` 介面同步新增（`party.useCase` 實作）——任何未來新增的 `party.UseCase`/`notify.PartyUseCase` 手寫 mock（非透過 embedding 取巧）都需補上這個方法才能編譯。
- `POST /api/v2/lobby/chat` 新增 400 錯誤碼 `NOTIFY_CHAT_GUEST_PROFILE_INVALID`（訪客 profile 缺失或驗證失敗時回傳），為後端新增的行為，需同步更新 API 文件（`docs/api-reference.md`、backend `docs/specs/notify.md`、Swagger）。
- 訪客在大廳聊天設定的角色資訊與 party guest 流程共用同一份 Redis session，此後任一端點觸發的 profile 更新都會反映到另一端，屬預期行為（沿用既有 `quick_guest_token` cookie 生命週期，1 天 TTL）。
- 歷史訊息 sender snapshot 在送出當下寫死，訪客事後修改角色資訊不會回填舊訊息（沿用 ADR-0025 慣例，非 bug）。
- 本決策的短路條件於 reviewer 審查後修正為僅依賴 `Level==0`（見上方「決策」段），修正前的原始版本曾誤用 `JobClassID==0 || Level==0` 判斷「未設定」，屬 P1 缺陷：`jobclass.Beginner==0` 是合法職業列舉值，會讓選擇「初心者」的訪客即使完成設定仍永久顯示為通用「遊客」（backend commit `e990a3a`）。教訓：具業務意義的 enum 欄位若合法值包含 `0`，不可用該欄位的零值判斷「未設定」，須改找定義域內真正無歧義的哨兵欄位。

## Supersedes / Superseded by

無（新增決策，不推翻既有 ADR；延伸 ADR-0015/ADR-0025 已建立的 quick-guest profile 機制到大廳聊天場景）。
