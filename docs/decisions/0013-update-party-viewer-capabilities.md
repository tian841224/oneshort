# ADR-0013: `UpdateParty`（PATCH /parties/{id}）回應補上 `ViewerCapabilities`

- 狀態: Accepted
- 日期: 2026-07-07
- 相關模組: backend / party
- 相關文件: `backend/internal/party/usecase_party.go`、`backend/internal/party/usecase_helpers.go`、`frontend/src/features/party/mutations/usePartyMutations.ts`、`frontend/tests/e2e/party-flow.e2e.ts`

## 背景 (Context)

E2E `party-flow.e2e.ts` 的「leader can hide and re-show an active party」偶發失敗：隊長按下
「隱藏隊伍」成功後，畫面上除了「分享連結」外，所有隊長專屬按鈕（編輯隊伍／重新顯示隊伍／
解散隊伍）全部消失，導致測試等不到「重新顯示隊伍」按鈕而逾時。

根因（已用失敗當下的 Playwright 截圖與程式碼比對確認，非臆測）：

- `backend/internal/party/usecase_party.go:364-437`（`UpdateParty`，處理 PATCH `/parties/{id}`，
  含隱藏/重新顯示隊伍的 `is_temporarily_closed` 切換）取得 `updated, err := uc.repo.UpdateParty(...)`
  後直接回傳，**從未設定 `updated.ViewerCapabilities`**。對照同檔案 `CreateParty`
  （`party.ViewerCapabilities = standardPartyCapabilities(...)`，第 126 行）與 `GetParty`
  （`party.ViewerCapabilities = caps`，第 189、197 行）都會計算並附上這個欄位，`UpdateParty`
  是唯一遺漏的路徑。
- 前端 `useTogglePartyVisibilityMutation`（`usePartyMutations.ts:220-242`）的 `onSuccess` 把
  這個（缺少 `viewer_capabilities` 的）回應直接整包寫入 party-detail 快取
  （`setPartyDetailForActor`），沒有像同檔案 `useSavePartyMutation`（第 135-141 行）那樣套用
  `preserveStandardViewerCapabilities()`（commit `8ed74df`，專門處理「PATCH/PUT 回應遺漏
  viewer_capabilities，需要用快取裡的舊值補回去」這個已知模式）。
- `PartyDetailScreen.tsx:493` 的 `role` 完全由 `apiParty.viewer_capabilities?.is_host` 決定；
  一旦這個欄位在寫回快取時被清空，隊長會被前端誤判成訪客，`DetailActions.tsx` 內所有
  `role === "leader"` 的按鈕條件全部不成立而消失——與失敗截圖（只剩「分享連結」）完全吻合。

## 考慮過的方案 (Options Considered)

1. **只在前端補防禦性保護**：仿照 `useSavePartyMutation`，讓
   `useTogglePartyVisibilityMutation` 也套用 `preserveStandardViewerCapabilities()`。
   - 維護性：中。範圍最小，但後端這個資料缺口本身沒解決；任何未來新增、直接消費
     `partyApi.update()` 回應（而非透過這兩個既有 mutation hook）的呼叫點都可能重新踩到
     同一個坑，等同把「後端回應不完整」的責任持續下推給每個前端呼叫端記得補洞，違反
     core.md §3「禁止持續堆疊例外」。
   - 效能：無差異。
   - 安全性：無差異。
2. **修後端 `UpdateParty`，比照 `GetParty`／`CreateParty` 的既有模式計算並附上
   `ViewerCapabilities` 再回傳（採用）。**
   - 維護性：好。直接修正資料源頭：PATCH `/parties/{id}` 的回應語意從此與 GET/POST 一致
     （「回傳的 party 一定包含呼叫者當下的 viewer_capabilities」），前端不需要為這個端點
     記憶額外的資料完整性例外。實作上直接重用既有 `standardPartyViewerAccess()`／
     `quickCapabilitiesForParty()`，不新增抽象。
   - 效能：可忽略。`standardPartyViewerAccess` 只是讀取記憶體中已有的 `party`／`actor`
     欄位（`isActorLeader` 用 `LeaderUserID` 直接比對、`actorFilledSlot` 掃描已載入的
     `Slots`），非guild 隊伍甚至不會多打任何 DB/Redis 查詢；guild 隊伍會多一次
     `guildVerifier.IsActorGuildOfficer` 查詢，與 `GetParty` 現有行為一致，非新增熱路徑。
   - 安全性：無差異（純粹補齊既有欄位的計算，不改變任何權限判斷邏輯本身）。
3. **兩者都做**（後端修根因 + 前端保留 `preserveStandardViewerCapabilities` 防禦性 fallback）。
   - 維護性：與方案 2 相近，多一層前端保護；但目前只有一個呼叫點（`useTogglePartyVisibilityMutation`）
     需要，且後端修好後這層防禦性程式碼永遠不會被觸發，屬於「為已解決問題預留的死碼」，
     不符合「不寫用不到的分支」的原則。
   - 效能：無差異。
   - 安全性：無差異。

## 決策 (Decision)

採方案 2：在 `usecase_party.go` 的 `UpdateParty` 回傳前，比照 `GetParty` 的既有寫法：非
quick 隊伍呼叫 `uc.standardPartyViewerAccess(ctx, actor, updated)` 取得 `caps` 並寫入
`updated.ViewerCapabilities`；quick 隊伍（雖然目前前端一律走 `/quick-settings` 端點，理論上
不會進到這條路徑，但比照 `GetParty` 的防禦性分支）呼叫 `quickCapabilitiesForParty(updated,
QuickPartyViewer{Actor: actor})`。前端 `useTogglePartyVisibilityMutation` 與
`useSavePartyMutation` 都不需要改動。

新增 usecase 層迴歸測試 `TestUseCase_UpdateParty_PopulatesViewerCapabilitiesForCaller`：驗證
隊長切換隱藏狀態後，回應的 `ViewerCapabilities.IsHost`／`IsMember` 仍為 `true`；已驗證此測試
在還原修正前會失敗（`ViewerCapabilities` 為 nil），修正後通過，確認測試確實覆蓋此迴歸。

另外，同一輪 E2E 失敗還有兩個案例（`party-flow.e2e.ts` 的「chat works」與「public party can be
joined immediately」測試）在等待聊天室面板出現時逾時；用失敗截圖核對後確認**聊天室面板其實
正常開啟、功能正常**，只是測試斷言的文字 `隊伍聊天室`（`ChatPanel.tsx` 的 loading-state
fallback title）在真實隊伍資料通常很快載入完成的情況下根本不會出現——這是測試斷言本身依賴
一個「不保證會出現」的過場文字，屬於測試設計問題，不是產品行為錯誤，因此**不落地為 ADR
決策**（沒有方案取捨可言，純粹修正斷言選字），只將兩處斷言改為判斷 `ChatSidePanel.tsx`
中不受任何非同步資料影響的靜態文字「即時」，作為「聊天室面板已開啟」的可靠訊號。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能皆無實質差異，故以維護性決勝。
方案 1 只是把資料缺口的責任下推給呼叫端記憶，未來仍可能因新呼叫點而重蹈覆轍；方案 3 在
方案 2 解決根因後留下永遠不會觸發的防禦性死碼。方案 2 直接修正資料源頭、重用既有
`standardPartyViewerAccess`／`quickCapabilitiesForParty` 抽象、不增加熱路徑查詢，維護性
與效能皆最佳，故採方案 2。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（只補前端防禦）：無法消除後端資料缺口本身，未來新呼叫點仍可能重複踩坑，否決。
- 方案 3（後端修根因＋前端也補防禦）：後端修好後前端這層防禦永遠不會被觸發，屬多餘死碼，
  否決。

## 影響 (Consequences)

- `PATCH /parties/{id}`（`UpdateParty`，涵蓋一般欄位編輯與隱藏/重新顯示隊伍的
  `is_temporarily_closed` 切換）回應從此固定包含呼叫者當下正確的 `viewer_capabilities`，
  與 `GET /parties/{id}`、`POST /parties` 的既有回應語意一致。
- 前端不需要任何修改；`useTogglePartyVisibilityMutation`／`useSavePartyMutation` 寫入快取的
  行為不變，但寫入的資料從此正確，不再需要 `preserveStandardViewerCapabilities` 這類補洞
  邏輯來救援本端點（該 helper 仍保留給 `ReplaceParty`／`useSavePartyMutation` 使用，範圍不變、
  未被本次決策影響）。
- 新增的 usecase 層迴歸測試涵蓋此路徑；E2E 層面待下次全套 E2E 執行時確認
  「leader can hide and re-show an active party」不再逾時。

## Supersedes / Superseded by

無。與 commit `8ed74df` 為 `ReplaceParty`／`useSavePartyMutation` 引入
`preserveStandardViewerCapabilities()` 的既有修法屬同一類問題的不同路徑，互不推翻；本 ADR
修正的是該 helper 尚未覆蓋到的 `UpdateParty`／`useTogglePartyVisibilityMutation` 路徑。
