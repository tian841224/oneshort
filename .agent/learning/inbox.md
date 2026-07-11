# OneShort 教訓收件匣 (Learning Inbox)

> 自我學習迴圈的未蒸餾暫存區——**僅限 OneShort 專屬**教訓。命中全域 learning.md §2（`~/.claude/rules/learning.md`）擷取觸發、且判定為 OneShort 特定時，把教訓 append 到下方（格式見全域 learning.md §5.1，`專案:` 欄填 `oneshort`）。
> 跨專案通用教訓改寫入全域 `~/.claude/memory/inbox.md`。
> 由 `learn`／`evolve` skill 蒸餾進 [MEMORY.md](MEMORY.md) 後，條目自此檔移除。**禁止寫入任何秘密**。

---

## 2026-07-10｜類型: 錯誤｜專案: oneshort｜來源: feature/quick-party-ui reviewer 阻斷性問題修正
- 情境：`FindPartyScreen.tsx` 的 `requireQuickGuestProfile` gate 用 `pendingQuickAction.resume: () => void`（零參數閉包）。訪客第一次填職業/等級存檔後，`GuestProfilePrompt.onSave` 呼叫 `resume()`，但 `resume` 綁定的是「舊 render」凍結的 `joinQuickFromPreview`/`openQuickCreate`/`handlePreviewPrimaryAction`，這些函式內部又重新呼叫 `requireQuickGuestProfile`，讀到的還是同一個 render 捕捉到的 `guestProfile` state（存檔前的空值，因為 setState 還沒 re-render）——判定又失敗，彈窗永遠關不掉，對應的 join/create mutation 永遠不會被呼叫。
- 教訓：任何「開彈窗收集資料 → onSave 後 resume 原動作」的 gate pattern，**resume 必須明確接收剛存的值當參數，禁止依賴重新呼叫舊 render 綁定的函式讀取 state closure**。正確做法：把 gate 檢查的目標值（如 profile）當成呼叫方顯式傳入的參數（預設值取當前 state，僅供首次呼叫使用），resume 時由 `onSave(value)` 直接把新值傳給 resume，被 resume 的函式也用「傳入的參數」而非「state closure」去做後續判斷與組 payload。已正確處理的對照案例：`PartyDetailScreen.tsx` 的 `submitQuickJoin`/`submitGuestApply`（`profile` 參數預設 `guestProfile`，呼叫端如 `handleQuickIdentitySave`/`handleGuestApplyIdentitySave` 顯式傳入剛存的 `value`，程式碼並留有註解說明原因）。踩坑案例：修正前的 `FindPartyScreen.tsx`（同一 PR、同一概念 deferred guest identity collection，卻在换一個檔案時重新踩進同樣的坑，即使旁邊就有已修正的參照實作）。
- 建議去向：rule:.agent/rules/core.md（§3.1 修正方案評估準則可補充此 hazard 為既有教訓範例）或 project-MEMORY

## 2026-07-10｜類型: 發現｜專案: oneshort｜來源: feature/quick-party-ui reviewer 第二輪跨 repo 交叉核對
- 情境：前端已送出新欄位（`guest_job_class_id`/`guest_level`）給 quick-party create/join API，但對應後端 struct（`QuickPartyCreateInput`/`QuickJoinInput`）尚未合併進 backend `develop`（實作在另一個未合併的 worktree）。Gin `ShouldBindJSON` 對 JSON body 裡的未知欄位預設不報錯，會靜默忽略。
- 教訓：跨 repo 平行開發（前後端各自 worktree 同步進行）時，前端送出新欄位前，若對應後端 branch 尚未合併到 backend `develop`，該欄位會被 `ShouldBindJSON` 靜默吃掉、不報錯——單元測試（mock API）與 `tsc`/lint 都測不出來，只有跨 repo 交叉核對原始碼或真實整合測試才抓得到。QA 對這類「前後端分別在不同 worktree 開發」的任務做本地驗收時，必須明確確認串接的後端環境是否已包含對應 commit，否則會誤判為前端迴歸。
- 建議去向：project-MEMORY（OneShort 跨 repo 協作流程注意事項）

## 2026-07-10｜類型: 發現｜專案: oneshort｜來源: fix/party-list-guest-chat-fixes 實作三項前端修正
- 情境：核准方案文件描述 `LiveChatRoom.tsx` 的 guest 判斷應比照 `partyChatMessage.ts` 用 `msg.sender.kind === "guest" || (job_class_id == null && lv == null)`，但 `LobbyChatMessage.sender`（`lib/api/lobbyChatApi.ts`）型別與後端 `lobbyChatSender` struct（`backend/internal/notify/handler.go`）皆無 `kind` 欄位——大廳聊天後端從不送這個欄位（只有隊伍聊天的 `identity.Sender` 才有），這行會編譯失敗。另外，方案文件要求為 `showTransientToast` 呼叫加 id 讓「既有的 `ToastContainer` id-based dedup」生效，但 `FindPartyScreen.tsx` 的 toast 其實是自己的 local single-slot state + 直接渲染 `<Toast>`，完全沒有走 `@/lib/toast` 的 `showToast`/`ToastContainer` window-event 匯流排（那是另一條完全獨立的 toast 機制）。
- 教訓：規劃文件裡「比照某某既有正確實作」的描述，落地前務必逐欄位/逐型別核對來源與目標是否真的同構——同名概念（sender kind、toast 系統）在不同模組可能是不同型別或不同機制，不能只憑描述文字直接套用會編譯失敗或無效的程式碼。發現這類落差時，改用「與該模組實際可用資料/機制等價的最小修正」達成同樣意圖（例如用已 resolve 的 class/level 值判斷 isGuest、在 local state 內自建 id-based dedup），並在交付時明確記錄為對計畫的偏離與理由。
- 建議去向：project-MEMORY（規劃文件落地前的型別/機制核對提醒）

## 2026-07-10｜類型: 發現｜專案: oneshort｜來源: fix/party-list-guest-chat-fixes 實作前 ADR 核對
- 情境：`docs/decisions/index.md` 已有 Accepted 的 [ADR-0028](../../docs/decisions/0028-toast-severity-classification.md)（toast 新增 warning 樣式、統一型別系統、`FindPartyScreen.tsx`/`PartyDetailScreen.tsx` 等多處 toast 呼叫點與 state 型別的重構），但 frontend repo 目前程式碼（`lib/toast.ts` 的 `ToastType` 仍含 `party-boss`/`party-training`/`party-group`、`PartyDetailScreen.tsx` 的 `toast` state 仍是裸 `string | null`）尚未套用該 ADR 的任何程式碼變更——ADR 文件本身已在 root repo 記錄完成，但對應的 frontend 程式碼改動顯然是獨立、尚未落地的工作。
- 教訓：「ADR 狀態為 Accepted」不代表對應程式碼已經合併進當前分支——修改任何模組前除了讀 ADR 全文，還要實際去看程式碼現況是否已反映該決策；若尚未反映，除非任務範圍明確涵蓋該 ADR 的實作，否則不要在不相關的任務裡順手把它做掉（範圍蔓延），只需確認自己的改動與該 ADR 未來落地不衝突（本例：新增 `showTransientToast` 的 `id` 參數是可相容的擴充，不影響日後把 `type` 從 `"info"` 改成 `"warning"`），並在回報中提醒使用者這個落差。
- 建議去向：project-MEMORY（ADR「已決策」與「已落地」需分開驗證）

## 2026-07-11｜類型: 錯誤｜專案: oneshort｜來源: fix/find-party-guest-ux reviewer 阻斷性問題修正（issue 1）
- 情境：`PartyStatusPills` 的 `hideOpenStatus` 新增預設值 `true`（find-party 公開清單這樣才對，因為後端該清單只回傳 RECRUITING/ACTIVE），但公會頁面（`PartiesSection.tsx`/`OverviewSection.tsx`/`GuildDetailClient.tsx`）呼叫 `PartyListCard`/`PartyPreview` 時沒有跟著補上 `hideOpenStatus={false}`，於是連帶吃到新預設值。實際查 `backend/internal/guild/repository_parties.go` 的 `ListGuildParties`，沒帶 status filter 時只排除 `CLOSED`/`EXPIRED`，`HIDDEN` 隊伍仍會出現在公會隊伍清單——因此公會清單其實跟「我的隊伍」一樣需要保留「開放」標籤才能分辨招募中 vs 隱藏，這個預設值翻轉讓公會清單靜默失去這個資訊。
- 教訓：共用元件的 prop 拿到「新預設值」（default flip）時，必須逐一稽核每個既有呼叫端的**實際資料語意**（例如對應的後端查詢範圍會不會回傳這個新預設值假設之外的狀態），不能只憑資料夾/元件命名判斷「這裡應該也適用同一個預設」；純讀 code 或看命名容易漏掉隱藏在後端 query 條件裡的例外情況，務必實際去讀對應的 repository/query 程式碼確認回傳範圍。
- 建議去向：project-MEMORY（共用元件 default flip 需稽核所有呼叫端資料語意）

## 2026-07-11｜類型: 發現｜專案: oneshort｜來源: feature/guest-lobby-chat-profile 實作大廳聊天訪客 profile
- 情境：需要在 `internal/notify` 套件的測試裡驗證「訪客第二則訊息不帶 body 欄位、只靠 cookie，仍能從 Redis session 讀回 job/level」這種需要真實持久化的場景，`stubPartyUseCase`（無狀態手寫 stub）無法重現這行為。改用 `party.NewUseCase(nil, nil, realtimeRDB, nil, nil)`（`repo`/`charVerify`/`exclusion`/`outboxStore` 全傳 `nil`）建構一個「真」`party.UseCase`，只要測試只呼叫 `EnsureQuickGuestProfile`/`EnsureQuickGuestChatSession`/`ResolveQuickGuestIdentity` 這類只碰 `uc.rdb` 的方法，就完全可用，且能與 `notify.Handler` 共用同一個 `*pkgredis.Client`（miniredis）驗證跨端點的 Redis session 一致性。
- 教訓：`party.useCase` struct 的方法不是每個都依賴全部建構參數；只碰 Redis 的訪客/quick-guest 相關方法（`EnsureQuickGuest*`、`ResolveQuickGuestIdentity`）可以用 `party.NewUseCase(nil, nil, rdb, nil, nil)` 建構「輕量真實例」做整合測試，不需要 mock 整個 `Repository`/`character.Verifier`/`ExclusionService` 介面，也不需要退化成無狀態 stub（stub 測不出 Redis 持久化行為）。另外：對 `notify.PartyUseCase`（介面）新增方法時，若要讓 `party.NewUseCase(...)` 回傳的 `party.UseCase` 介面值可以直接指派進去，**該方法必須同時加進 `party.UseCase` 介面宣告本身**（不只是 `party.useCase` 具體型別的方法）——Go 的 interface-to-interface 賦值是靜態檢查來源介面的宣告方法集，不會往下看底層具體型別實際實作了什麼。
- 建議去向：project-MEMORY（quick-guest Redis 測試模式）＋若日後同類需求重複出現，考慮蒸餾進技術 playbook

## 2026-07-11｜類型: 錯誤｜專案: oneshort｜來源: feature/guest-lobby-chat-profile reviewer 審查後 P1 修正（ADR-0032）
- 情境：`lobbyChatSenderFromIdentity`/`lobbyChatSenderStructFromIdentity` 的「訪客是否已完整設定角色」短路判斷原本同時看 `JobClassID==0` 與 `Level==0`，但 `jobclass.Beginner==0` 是合法且可被使用者主動選擇的職業列舉值，不是「未設定」的哨兵——訪客誠實選擇「初心者」並設定合法等級後，仍會被永久誤判成未完成設定、顯示為通用「遊客」，且訪客端無法自行修正（AC 違反）。reviewer 審查後改為只依賴 `Level==0`（`level` 合法值域 `[1,200]`，`0` 才是無歧義的未設定哨兵），backend commit `e990a3a`。
- 教訓：具業務意義的 enum 欄位若合法值域包含 `0`（本例 `jobclass.Beginner==0`），不可用該欄位的零值判斷「是否未設定」，會讓使用者做出合法選擇卻被系統永久誤判成「未完成」；應改找該欄位定義域內真正無歧義的哨兵欄位（本例 `Level`，因為 level 合法值域是 `[1,200]`，`0` 從不是合法值）。設計任何「XX 欄位是否已設定」的短路/完成度判斷前，先確認該欄位的零值是否落在合法值域內；若落在合法值域內，一律改用其他欄位或額外的「已設定」旗標判斷，不能用零值當哨兵。
- 建議去向：project-MEMORY（enum 零值語意重載陷阱）；ADR-0032「影響 (Consequences)」段已補記此修正

## 2026-07-11｜類型: 發現｜專案: oneshort｜來源: 全專案文件整合任務（reviewer 交叉核對）
- 情境：backend commit `a37d1dd`（2026-06-15，"feat(api): upgrade route prefix and version header from v1 to v2"）把 `cmd/server/main.go` 的三個路由 group（`public`/`protected`/`optional`）前綴從 `/api/v1` 全面改成 `/api/v2`，但只改了程式碼，未同步更新任何文件。導致 backend `docs/specs/*.md`（19 處）、`docs/features.md`（113 處），以及 root `docs/api-reference/*.md`（160 處）、`docs/business-logic.md`（13 處）、`docs/backend-data-flows.md`（95 處）共 400+ 處文件仍寫著已不存在的 `/api/v1/...` 端點路徑，且維持了近一個月都沒被發現。
- 教訓：這類「純文字端點路徑描述」（非 markdown 連結）不會被一般的連結完整性檢查抓到——`docs/frontend-logic.md:241` 那種 `[text](path)` 斷鏈可以靠掃描連結語法抓，但 `/api/v1/parties` 這種寫死在 prose/程式碼範例裡的字串不行，需要另外對「已知的路徑前綴／版本號」做全文 grep 才抓得到。修改後端路由 group 前綴（或任何全域路徑常數、版本號）時，除了 core.md §4「API 結構變動時必須同步更新前端」，還必須額外 grep 全部 `docs/specs/*.md`、`docs/api-reference*`、`docs/features.md`、`docs/business-logic.md`、`docs/backend-data-flows.md` 做批次替換，不能只滿足於前端程式碼層面的同步。
- 建議去向：project-MEMORY；已用 spawn_task 開一個獨立任務全面修正 `/api/v1` → `/api/v2`（範圍太大，不在本次文件整理任務內處理）

## 2026-07-11｜類型: 發現｜專案: oneshort｜來源: fix/api-v1-dead-prefix-checks（上一條 spawn_task 的第一批修正）
- 情境：修正 `pkg/middleware/primary_read_stickiness.go`（read-your-write primary DB 黏性）與 `internal/stats/middleware.go`（HTTPRequestCounter 請求計數）這兩處真正的「production 行為被靜默失效」regression 後，`grep -rln "api/v1" --include="*.go" .` 仍命中 13 個檔案（`internal/{auth,guild,guide,party,stats}/*_test.go`、`pkg/middleware/{api_version,idempotency,security_headers}_test.go`）。逐一 spot-check 後發現：這些都是測試自建 `gin.New()` router、註冊路徑與請求路徑用同一組 `/api/v1` 字串（內部自洽），且不呼叫任何被本次修正影響的函式（`grep` 確認未引用 `shouldTrackRequest`/`isActorStickyWrite`/`resourceWriteStickyResource`/`resourceReadStickyResource`/`PrimaryReadStickiness`/`HTTPRequestCounter`）——這些只是「命名慣例過時」的美觀問題，不是「production 行為被靜默失效」的 regression。
- 教訓：全域 grep `/api/v1` 命中的檔案不能一律視為同一類 bug 直接無腦取代。要先判斷該處字串是（a）**production 程式碼**用來比對真實請求路徑做行為判斷（如 middleware 的 `strings.HasPrefix(c.FullPath(), ...)`）——這種若前綴與 `cmd/server/main.go` 實際註冊的路由不符，就是真正的「dead code / 靜默失效」regression；還是（b）**測試自建路由**只要註冊路徑、請求路徑、斷言路徑三者互相一致，就算前綴字串過時也不影響測試正確性，只是命名不夠新。下一批全面修正任務處理剩下 13 個檔案時，仍應逐一確認同構、但可預期它們多半只是（b）類的命名一致性清理，不必當成 regression 等級處理。
- 建議去向：project-MEMORY（api/v1→v2 全面清理任務的分類方法，供下一批處理時參考）

## 2026-07-12｜類型: 發現｜專案: oneshort｜來源: docs 重整（ROOT backend-data-flows.md 合併進 backend/docs/data_flow.md）
- 情境：把 ROOT `docs/backend-data-flows.md` 合併進 backend `docs/data_flow.md` 時，逐數值對照程式碼發現 ROOT 文件多處具體數值/機制早已過時：(1) Relay Worker 輪詢實為 100ms、重試上限 `DefaultMaxAttempts=12`+指數退避（文件寫 500ms、3 次）；(2) Primary Read Stickiness 視窗預設 5 秒 `READ_STICKY_WINDOW`（文件寫 5 分鐘）；(3) rate limit 實為 query=100/write=20/login=5/bug_report=3 per min 的 Redis Lua bucket（文件寫「一般 60、auth 10、admin 無限制、開發環境記憶體限流」，全不存在）；(4) 在線人數是連線註冊/註銷時事件驅動廣播到 `public:broadcast`（文件寫 30 秒 worker 發到 `parties:global`，且同一份文件另一節又寫 `public:broadcast`，自相矛盾）；(5) cache warmup 間隔 30 秒（文件寫 5 分鐘）。
- 教訓：搬移/合併「描述程式行為的文件」時，不能把來源文件當事實照抄——凡是具體數值（間隔、TTL、上限、房間名）都要 grep 對應程式碼驗證後再寫入目的檔；同一份文件內兩節對同一機制描述矛盾，是「至少一節過時」的強訊號，優先用程式碼裁決。
- 建議去向：project-MEMORY（文件合併/搬移的數值驗證紀律）

## 2026-07-12｜類型: 發現｜專案: oneshort｜來源: docs 重整——business-logic.md 併入 backend specs
- 情境：把 ROOT `docs/business-logic.md` 逐條併入 `backend/docs/specs/*.md` 時，逐條與程式碼查證發現多處 ROOT 文件已過時：(1) 公會 LEADER/OFFICER 管理公會隊伍的放寬，ROOT 寫「僅限 `generated_by_match=true` 的自動配對隊伍」，但 `internal/party/usecase_helpers.go` 的 `canGuildOfficerManageGuildParty` 完全不檢查 `GeneratedByMatch`（unit test 也以 `false` 通過 update/review/delete），guild.md 的「所有 GUILD 隊伍」才正確；(2) ROOT 寫 admin 隊伍列表用 `include_closed=true`，實際 `GET /admin/parties` 無此參數、直接列出全部，`include_closed` 是一般 `GET /parties`（我的隊伍 72h 內 CLOSED）的參數；(3) 舊 specs/party.md「guest 專用流程已移除」與 notify.md「guild 通知事件已移除」皆與現行 ADR-0015 訪客互通、guild.md 現行事件矛盾。
- 教訓：搬移/合併舊規格文件前，對每一條「限制條件、參數名、已移除聲明」先 grep 程式碼查證再落地，不可假設較長較詳細的那份文件比較新；兩份文件互相矛盾時以程式碼為準，並在報告中列出被判定過時的條目與證據。
- 建議去向：project-MEMORY（OneShort 文件維護注意事項）
