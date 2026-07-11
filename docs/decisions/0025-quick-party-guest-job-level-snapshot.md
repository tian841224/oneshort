# ADR-0025: 快速隊伍訪客職業/等級快照

- 狀態: Accepted
- 日期: 2026-07-10
- 相關模組: backend / party
- 相關文件: docs/api-reference.md, docs/business-logic.md, docs/decisions/0015-guest-standard-immediate-party-interop.md

## 背景 (Context)

一般即時隊伍（`internal/party` 的排程/公會以外分支）已在 [ADR-0015](0015-guest-standard-immediate-party-interop.md) 支援訪客提供職業+等級，佔位後在 `Slot.FilledByJob`/`FilledByLevel`/`FilledByIsGuest` 留下顯示快照，前端據此渲染訪客成員卡片。**快速隊伍**（`is_quick=true`，`internal/party/usecase_quick.go`）是另一套獨立的訪客優先系統，成員以 `TokenHash` 追蹤，但訪客身分（`QuickGuestIdentity`）從未附帶職業/等級——`quickViewerFromRequest` 只傳 `displayName`，`fillQuickSlotMember` 對訪客一律把 `FilledBy*` 全部清空，只留 `Note` 存暱稱。快速隊伍的訪客成員因此永遠無法在卡片上顯示職業/等級，即便前端已有既有的訪客渲染樣式（沿用 ADR-0015 那一套）可以直接複用。

`quickViewerFromRequestWithProfile`（`internal/party/handler_guest_party.go`，服務一般隊伍訪客建立/申請流程）與其呼叫的 `EnsureQuickGuestProfile`（`internal/party/usecase_quick.go`，已支援讀寫 Redis session 裡的 `job_class_id`/`level`，含 `jobclass.Valid` 與 1-200 等級驗證）**已經完整存在**，只是快速隊伍的 handler（`CreateQuickParty`/`JoinQuickParty`）從未呼叫這個帶 profile 的版本，也沒有把 `QuickGuestIdentity` 的職業/等級傳進 slot 填充鏈。

## 考慮過的方案 (Options Considered)

### A. 快速隊伍佔位者的職業/等級如何落地到 `Slot`

1. **比照 ADR-0015 讓 `slot.FilledBy` 也存訪客 UUID**（`applyGuestLeaderToParty` 的既有寫法）：與一般隊伍完全同構，但快速隊伍的成員追蹤原本就是 `QuickParticipants`/`TokenHash`，`FilledBy` 從未被賦予意義；若現在改賦值，等於為快速隊伍引入第二套佔用追蹤機制，兩者容易失步（例如 `quickMemberCount` 仍只信任 `QuickParticipants`，`FilledBy` 會變成不被任何邏輯讀取的孤兒欄位）。
2. **`FilledBy` 維持 `nil`，只靠 `FilledByIsGuest`+`FilledByName`/`Job`/`Level` 承載顯示快照**（採用此方案）：快速隊伍的佔用真相來源（source of truth）永遠是 `QuickParticipants`/`TokenHash`，`Slot.Filled*` 只是給前端顯示用的快照，語意上與「這格被誰佔用」解耦，維持既有快速隊伍的單一追蹤機制不變。

### B. 訪客缺職業或等級時（只給暱稱）如何處理

1. **半套資料照樣顯示**（例如只顯示職業、等級留空）：前端要多處理一種「不完整訪客卡片」樣式，且容易被誤認為系統錯誤（缺欄位）。
2. **視為未提供，整組 `Filled*` 快照維持舊行為全部清空，只留 `Note` 顯示暱稱**（採用此方案）：與 ADR-0015 標準隊伍訪客快照的驗證邏輯一致（`EnsureQuickGuestProfile` 早已要求兩者都合法才寫入 Redis session），行為可預期，不新增前端條件分支。

### C. APPROVAL 房核准流程如何取得訪客的職業/等級

1. **核准當下重新向訪客索取**：訪客核准時通常已離線或無法即時互動，且 API 設計上核准是 HOST 單方操作，不應反過來要求訪客配合。
2. **申請當下就把訪客 profile 存進 `QuickApplication`（新增 `JobClass`/`Level` 欄位），核准時原封不動套用**（採用此方案）：`QuickApplication.Character` 對訪客永遠是 `nil`（訪客沒有 `characters` 列可查），若不新增欄位，核准流程呼叫 `addQuickMemberToParty` 時完全沒有職業/等級可用，APPROVAL 房的訪客會系統性地拿不到快照，即便 OPEN/PASSWORD 房的訪客已修好——這是必須堵上的資料流缺口，而非可延後的獨立功能。

### D. `QuickParticipant` 是否也要補職業/等級欄位

1. **同步補欄位**：`QuickParticipant` 與 `QuickApplication` 結構相似，look-alike 一致性較高。
2. **不補，只靠 Slot 快照**（採用此方案）：前端渲染快速隊伍成員卡片時以 `slot_order` 對應 `Slot` 為優先資料來源，只有在 slot 找不到對應 `slot_order` 時才 fallback 到 `QuickParticipant`；而 `QuickParticipant.SlotOrder` 與其佔用的 `Slot.SlotOrder` 是在同一段程式碼（`addQuickMemberToParty`）內一起寫入，理論上不會出現「有 Participant 沒有對應 Slot」的情況。額外維護一份重複的職業/等級狀態只會增加兩處資料何時失步的風險，不補欄位維持單一資料來源（single source of truth）。

## 決策 (Decision)

1. 採方案 A-2：`fillQuickSlotMember`/`applyQuickGuestSlotSnapshot` 只設定 `FilledByIsGuest`/`FilledByName`/`FilledByJob`/`FilledByLevel`，`FilledBy` 對快速隊伍訪客維持 `nil`；`Slot.FilledByIsGuest` 的 doc comment 同步更新，說明其在標準隊伍與快速隊伍下 `FilledBy` 語意不同。
2. 採方案 B-2：`applyQuickGuestSlotSnapshot` 僅在 `guestJob != nil && guestLevel != nil` 都成立時寫入快照，任一缺漏則清空全部 `Filled*` 欄位（沿用舊行為）。
3. 採方案 C-2：`QuickApplication` 新增 `JobClass`/`Level` 欄位（`db:"-"`／Redis JSON 專用，比照既有 `Character` 欄位模式），`JoinQuickParty` 建立 pending application 與 `ensureQuickApplication` 合併既有 pending 時都要填入/搬移這兩個欄位；`ReviewQuickApplication` 核准時把 `app.JobClass`/`app.Level` 傳入 `addQuickMemberToParty`。
4. 採方案 D-2：`QuickParticipant` 不新增欄位。
5. **一致性補強（非新決策，屬同一批修正的正確性延伸）**：所有既有的「清空 slot」路徑（`LeaveQuickParty`、`KickQuickSlotMember`、`repository_slot.go` 的 Redis-only `KickSlotMember` 清空段落）新增 `FilledByIsGuest = false` 重置；`preserveQuickSlotRuntimeState`（`ReplaceQuickParty` 用來保留佔用中 slot 的既有 runtime 狀態）新增保留 `FilledByIsGuest`；`fillQuickSlotMember` 的角色分支新增 `FilledByIsGuest = false` 重置。這些是「新引入的 `true` 值狀態」必然要求的清空/保留對稱性，不是獨立功能，但同樣影響正確性，故一併記錄於此決策範圍內。

### 後續修正（2026-07-10，PR #70 code review 第二輪）

第 5 點列舉的「清空 slot」路徑遺漏了第 4 條：`repository_slot.go` 的 `UpdateSlot` Redis-only 分支（一般/排程隊伍透過 `PATCH` slot 直接指定 `FilledBy`/`IsFilled` 的路徑，與快速隊伍的 `LeaveQuickParty`/`KickQuickSlotMember`/`KickSlotMember` 三條路徑不同模組但同一類正確性問題）在 fill 與 unfill 兩個分支都沒有重設 `FilledByIsGuest`，導致真實角色填入「曾是訪客佔用」的空位後，`FilledByIsGuest` 殘留 `true`，使 `syncPartySlotCharacterInfo()` 永久跳過該 slot 的名稱/職業/等級同步。已修正：fill 分支填入真實角色資料時、unfill 分支清空時皆補上 `FilledByIsGuest = false`（新增回歸測試 `TestRepository_UpdateSlot_RedisOnlyBranch_FillResetsGuestSnapshotFlag`／`TestRepository_UpdateSlot_RedisOnlyBranch_UnfillResetsGuestSnapshotFlag`，仿照既有 `TestRepository_KickSlotMember_RedisOnlyBranch_ResetsGuestSnapshotFlag`）。

同批 code review 並延伸抽出三個共用 helper，消除本決策範圍內程式碼的重複：`stampGuestSlotSnapshot`（`repository_slot.go`，被 `applyGuestLeaderToParty` 與 `applyQuickGuestSlotSnapshot` 共用，取代兩處重複的 `FilledByName/Job/Level/IsGuest` 賦值邏輯）、`clearSlotOccupant`（`repository_slot.go`，被 `LeaveQuickParty`／`KickQuickSlotMember`／`KickSlotMember` Redis-only 分支共用，取代三處重複的 7 欄位清空邏輯）、`guestSlotProfile` struct（`usecase_quick.go`，取代 `addQuickMemberToParty`/`fillQuickSlot`/`fillQuickSlotMember` 三層簽章中單純配對傳遞的 `guestJob *jobclass.JobClass`/`guestLevel *int16` 兩個獨立指標參數）。三者皆為對已定案架構的重構完成，不改變本 ADR 已決定的行為，故不另立新 ADR，僅在此補記完整範圍。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：沒有引入新的信任邊界——`GuestJobClassID`/`GuestLevel` 仍是既有 `EnsureQuickGuestProfile` 已在做的驗證（`jobclass.Valid` + 1-200 等級範圍），本次只是把已驗證過的資料多接一條路徑（快速隊伍）到既有 Redis session 快取管線，未新增輸入信任面。
- **維護性**：方案 A-2／D-2 刻意不引入第二套佔用追蹤或重複狀態，維持快速隊伍「唯一真相來源是 `QuickParticipants`/`TokenHash`」的既有設計；`applyQuickGuestSlotSnapshot` 抽成共用函式，被 host slot（`CreateQuickParty`）、直接加入（`JoinQuickParty`）、核准加入（`ReviewQuickApplication`）三條路徑共用，避免三處各自重寫清空/填入邏輯而漂移。
- **效能**：無新增 DB/Redis 往返；`QuickApplication` 新欄位只是既有 JSON payload 多兩個欄位，序列化成本可忽略。

## 被拒絕方案與原因 (Rejected Alternatives)

- **A-1（`FilledBy` 存訪客 UUID）**：會讓快速隊伍多出一個沒有任何讀取邏輯信任的孤兒欄位，且與 `quickMemberCount`/`quickParticipantForViewer` 等既有邏輯（一律以 `TokenHash` 為準）不一致，未來容易被誤用成第二真相來源。
- **B-1（半套資料照樣顯示）**：會讓前端多處理一種「缺職業或缺等級」的中間態卡片樣式，且容易被誤判為系統錯誤，增加不必要的 UI 分支。
- **C-1（核准當下重新向訪客索取）**：APPROVAL 房核准是 HOST 單方操作，訪客當下未必在線，不能反向要求訪客配合，且會讓「加入」與「核准」的資料需求不對等，增加流程複雜度。
- **D-1（`QuickParticipant` 也補欄位）**：前端已有 slot 優先、participant 僅 fallback 的既有讀取順序，且兩者的寫入時機完全同步，重複欄位只會增加日後修改時忘記同步更新其中一處的風險，不補欄位對實際渲染路徑沒有損失。

## 影響 (Consequences)

- **API 契約新增（向後相容，`omitempty`）**：`POST /api/v2/parties/quick`、`POST /api/v2/parties/{id}/quick-join` 的 request body 新增選填欄位 `guest_job_class_id`/`guest_level`；`POST /api/v2/parties/{id}/quick-enter` 刻意不加（enter 純進房看聊天不佔位）。回應 `Slot` 的既有 `filled_by_job`/`filled_by_level`/`filled_by_is_guest` 欄位現在也可能出現在快速隊伍的 payload 上（原本恆為 `null`/`false`）。
- **`QuickApplication` 新增 `JobClass`/`Level` 欄位**：純 Redis-only JSON 結構變動，不涉及 migration；`docs/api-reference.md`／`docs/business-logic.md` 已同步補充說明（見「相關文件」）。
- **前端消費**：前端會比照一般隊伍訪客樣式渲染快速隊伍訪客成員卡片；後端不關心顯示邏輯，只保證資料正確落地。若前端尚未串接對應 UI，這批新增欄位在串接前只是被忽略的多餘欄位，不影響既有渲染（純新增、非破壞性）。
- **`EnsureQuickGuestProfile` 的既有 doc comment 過期並已同步修正**：原註解稱「暱稱對快速隊伍已足夠」，現已不成立（快速隊伍佔位同樣需要職業/等級快照），comment 已改寫以反映現況（core.md §3「文件過期必須同步更新」）。

## Supersedes / Superseded by

不推翻任何既有 ADR；與 [ADR-0015](0015-guest-standard-immediate-party-interop.md) 的訪客快照設計語意保持一致並延伸適用範圍。
