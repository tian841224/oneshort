# ADR-0012: 前端 guide-widget 寫入改為單一 widget 序列化佇列，取代逐次獨立 mutate

- 狀態: Accepted
- 日期: 2026-07-07
- 相關模組: frontend / guide-widgets / party
- 相關文件: [ADR-0009](0009-silent-background-guide-state-writes.md)、`frontend/src/hooks/useWidgetStateOp.ts`、`frontend/src/hooks/useGuideStateMutation.ts`

## 背景 (Context)

使用者回報：在高頻率使用小工具時（例如連續快速點擊 Counter 的 +1/-1 按鈕）會跳出
「攻略狀態更新失敗，請重新整理後再試。」錯誤提示。

根因（已用 Explore agent 對照前後端程式碼確認）：

- `useWidgetStateOp.apply(op)`（`frontend/src/hooks/useWidgetStateOp.ts:33-49`）每次呼叫都會
  立刻對 `useGuideStateMutation` 呼叫 `mutate()`，且 `state`／`revision` 是從 render 時的
  closure（`useGuideStateStore` selector）讀取，**沒有任何節流、佇列化或 in-flight 防護**。
- 連續快速點擊會在同一個 revision 尚未回寫 store 前，並行送出多個請求，全部帶著相同的
  `base_revision`。第一個請求成功後，第二個請求會收到 409；`useGuideStateMutation`
  （`useGuideStateMutation.ts:64-74`）目前只允許**一次** rebase 重試（`conflictRetry` 旗標
  防止無限重試）。當同時有 3 個以上請求重疊時，兩個以上的 retry 會彼此競爭同一個
  `base_revision`，其中一個 retry 也會 409——超出單次重試預算，落到
  `UPDATE_ERROR_MESSAGE` 這個通用 fallback（`useGuideStateMutation.ts:17`），與使用者回報的
  文字一致。
- 已對照後端 `backend/internal/guide/handler.go` 與 `repository.go` 確認：guide-state
  update 端點的所有錯誤碼都已在 `frontend/src/lib/api/errorMessages.ts` 對應到中文訊息，
  沒有未對應的 code；問題純粹出在前端沒有限制「同一個 widget 在同一個瀏覽器分頁內」的並行
  寫入數量，而不是後端契約缺陷。
- 已確認 `frontend/src/features/guide/widgetStateOps.ts` 內的 op（`adjustCounter`、
  `toggleChecklistItem`、`toggleRolePick` 等）皆為純函式、冪等、且對其他成員的更新可交換
  （comment 已註明），因此可安全地依序組合（compose）多個排隊中的 op 後一次送出。

## 考慮過的方案 (Options Considered)

1. **在點擊時停用按鈕（`disabled={isPending}`）或加入 debounce，延後送出最後一次點擊
   （拒絕）。**
   - 維護性：差。`isPending` 目前只有 `CounterWidget` 讀取但未使用；要生效需要在全部
     21 個呼叫 `useWidgetStateOp` 的 widget 元件內個別加上停用邏輯，而非共用管線修正，
     違反 core.md §3.1「禁止以最小範圍修正作為預設策略」與「除非正式規格，否則不為單一
     功能撰寫硬編碼特例」。
   - 效能：debounce 會延遲每次點擊的視覺回饋（目前已無 optimistic UI，點擊後要等伺服器
     回應才會更新畫面），高頻連點時體感會更頓；停用按鈕則會讓連續點擊中間幾次點擊直接被
     忽略，不符合「+1 按鈕連點應該全部計入」的既有語意。
   - 安全性：無差異。
   - 根本問題未解：即使停用按鈕，兩個幾乎同時觸發的合法操作（例如使用者快速連點兩下，
     事件還沒被 React 處理成 `disabled` 前）仍可能並行送出，無法真正消除競態。
2. **`useWidgetStateOp` 改為單一 widget 序列化＋合併（coalesce）佇列，並將
   `useGuideStateMutation` 的 409-rebase 重試邏輯從 `onError`（fire-and-forget 遞迴呼叫
   `mutate()`）搬進 `mutationFn`（讓 `mutateAsync` 真正代表「這個邏輯操作已完全結束，含
   重試」）（採用）。**
   - 維護性：好。修改集中在 `useWidgetStateOp.ts`（新增 pending-ops ref + drain 迴圈）與
     `useGuideStateMutation.ts`（重試邏輯內移，`onError`／`onSuccess` 只剩狀態同步與提示
     決策）兩個既有共用 hook，21 個 widget 元件與 `useMemberColors`／
     `useEnsureMemberColors` 完全不需改動，全部透過 `useWidgetStateOp.apply` 自動受惠。
     既有 `useGuideStateMutation.test.tsx` 6 個測試案例（含 ADR-0009 的 silent 雙重衝突
     案例）在重構後行為不變（已驗證：外部可觀察行為——呼叫次數、store 最終狀態、
     toast 訊息——完全相同），可作為重構安全網。
   - 效能：更好。同一 widget 在前一個請求仍在飛行時的後續點擊只會累積成佇列，前一個請求
     結束後才把佇列中所有 op 依序組合（compose）成**一次**請求送出，相較「每次點擊各自
     並行送出＋409 重試」大幅減少高頻連點時的網路請求數與伺服器 409 衝突率。
   - 安全性：無差異（純前端請求排程行為，驗證與寫入內容不變；op 的組合順序等同使用者
     操作的時間順序，不改變業務語意）。
3. **`useWidgetStateOp` 改為 optimistic UI：點擊時立即更新本地 store，背景非同步與伺服器
   對帳、衝突時回滾或重新套用（拒絕）。**
   - 維護性：差。目前所有 widget 元件的 `state` 都直接來自 store 的已提交（server-committed）
     狀態；改成 optimistic 需要重新設計 store 的「本地暫存值 vs 已確認值」分層、所有讀取
     `state` 的元件都要考慮暫存值可能被回滾，影響面遠大於本次回報的問題範圍。
   - 效能：短期互動延遲更低，但需要額外的回滾/對帳邏輯、更多狀態分支。
   - 安全性：無差異。
   - 範疇過大：本次問題的根因是「同一分頁內無節制並行送出」，方案 2 已能完全消除高頻
     連點造成的自我衝突，不需要為了解決這個問題重構整個 widget 狀態顯示模型，違反
     YAGNI；留待未來若真的需要「點擊即時反饋」的產品需求時再獨立評估。

## 決策 (Decision)

採方案 2：

- `useGuideStateMutation` 的 `mutationFn` 改為：先嘗試一次寫入；若失敗且為 409 並帶有
  `latest`，套用 `latest` 到 store，並在 `!payload.conflictRetry && payload.rebaseOnConflict`
  條件成立時，用 `rebaseOnConflict(latest)` 立即重試一次（仍在同一個 `mutationFn` 內，
  重試若又失敗則同樣套用其 `latest` 到 store 後拋出）；`onSuccess`／`onError` 因此簡化為
  單純的「套用最終成功狀態」與「依最終錯誤狀態碼決定 `CONFLICT_SYNC_MESSAGE` 或
  `UPDATE_ERROR_MESSAGE`／`silent`」，不再需要自行遞迴呼叫 `mutate()`。
- `useWidgetStateOp` 新增一個以 `useRef` 維護的 pending-ops 佇列與 `draining` 旗標：
  `apply(op)` 一律先把 `op` 推進佇列，再觸發 `drain()`；`drain()` 若目前無進行中的請求，
  會把佇列中累積的所有 op 依序組合成一個函式，讀取（此刻的、非 closure 快照的）
  `useGuideStateStore.getState()` 最新 `state`／`revision` 作為基準，呼叫一次
  `mutateAsync()`；該次呼叫結束（無論成功或失敗，失敗已由 `useGuideStateMutation` 處理
  提示與 store 同步）後，若佇列在等待期間又累積了新的 op，立即再次 `drain()`。
- 保證同一個 `useWidgetStateOp` 實例（即同一個 widget、同一個瀏覽器分頁）任何時刻最多只有
  一個進行中的請求，徹底消除同一使用者自己連點造成的自我衝突；跨分頁／跨成員的真實併發
  衝突仍會走既有 409-rebase-then-toast（或 ADR-0009 的 silent）路徑，行為不變。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性均無差異。方案 1 維護性最差（需要
改 21 個呼叫點）且無法真正消除競態；方案 3 維護性最差且範疇遠超本次問題所需，違反 YAGNI。
方案 2 集中修改兩個既有共用 hook、對外部呼叫點零改動、且是唯一能真正把「高頻連點」的
效能特性從「N 個並行請求＋級聯 409」改善為「N 次點擊最多對應 1～2 次請求」的方案，效能與
維護性皆最佳，故採方案 2。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（停用按鈕／debounce）：需要在 21 個 widget 元件個別處理，且無法消除事件處理時序
  上仍可能並行觸發的競態，只是降低機率而非根治，否決。
- 方案 3（optimistic UI 全面重構）：範疇遠超本次回報問題，需要重新設計 store 分層與所有
  widget 元件的讀取語意，屬於未來獨立評估的產品需求，非本次 bugfix 範疇，否決。

## 影響 (Consequences)

- 高頻連點同一小工具（Counter、Checklist、RolePicker 等 21 種 widget）時，同一分頁內的
  操作會被合併為序列化請求，不再因為自我競態而跳出「攻略狀態更新失敗，請重新整理後再試」
  錯誤；真正的多人／多分頁同時編輯衝突，提示行為（含 ADR-0009 的 silent 背景寫入）完全
  不變。
- `useGuideStateMutation` 的對外介面（`mutate`／`mutateAsync`／`isPending`、
  `GuideStateMutationPayload` 型別）不變，僅內部重試邏輯搬移；`useWidgetStateOp` 對外介面
  （`apply`／`state`／`revision`／`isPending`）也不變，`useMemberColors`、
  `useEnsureMemberColors` 與所有 widget 元件無需修改。
- 既有 `useGuideStateMutation.test.tsx` 全數案例（含 ADR-0009 silent 雙重衝突）行為不變，
  可直接作為重構回歸測試；`useWidgetStateOp.test.tsx` 需更新 mock 介面（`mutate` →
  `mutateAsync`）並新增佇列合併行為的測試案例。

## Supersedes / Superseded by

無。延續 ADR-0009 對 `silent` 旗標與 409-rebase 行為的既定決策，未推翻其任何決定；本 ADR
只改變「重試邏輯的執行位置」與「同一分頁內請求的排程方式」。
