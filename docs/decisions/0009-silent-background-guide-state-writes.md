# ADR-0009: 自動背景 guide-state 寫入（成員顏色）在雙重衝突時不彈出使用者錯誤提示

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend / guide-widgets / party
- 相關文件: [ADR-0004](0004-widget-member-identity-and-colour-legend.md)、[ADR-0006](0006-party-member-colors-backend-contract-alignment.md)、`frontend/src/hooks/useGuideStateMutation.ts`、`frontend/src/hooks/useWidgetStateOp.ts`、`frontend/src/hooks/useEnsureMemberColors.ts`、`frontend/src/hooks/useMemberColors.ts`

## 背景 (Context)

使用者回報：進入一個已啟用攻略（`strategyEnabled`）的隊伍房間時，畫面立刻跳出
「攻略狀態已更新，已同步最新內容，請再操作一次。」錯誤提示，但使用者當下並未點擊任何小工具。

根因：

- `useGuideStateMutation`（2026-05-20 commit `49e6925`）的既有設計是：guide-state 寫入若遇到
  409（`base_revision` 過期）會先用伺服器回傳的 `latest` 自動 rebase 並重送一次；只有這次重送
  **也**衝突時，才顯示 `CONFLICT_SYNC_MESSAGE` 提示使用者手動重試。這個設計對「使用者主動點擊
  小工具」的情境是合理的（罕見的雙重衝突代表真的有另一位隊員同時修改了同一份共享狀態，值得提示
  使用者重新操作一次）。
- ADR-0004（2026-07-05 commit `60571b2`）新增 `useEnsureMemberColors`：在 `PartyWidgetRuntime`
  掛載時（即「進入房間」，非使用者點擊）自動對缺色成員補寫共享的 `party_member_colors` 狀態；
  `useMemberColors.ensureSelfColor` 也會在使用者操作「其他」小工具（如打勾清單）時，順帶對同一份
  顏色狀態做相同的背景補寫。兩者都透過 `useWidgetStateOp` 共用同一條 `useGuideStateMutation`
  管線，因此也繼承了「雙重衝突彈出錯誤提示」的行為。
- 這兩處寫入都是**冪等、可自我修復**的背景寫入（comment 已註明「idempotent + rebase-safe，多個
  viewer 同時載入會收斂到同一結果」）：即使這次的 rebase 重試也失敗，`applyStateUpdate(latest)`
  仍會把最新狀態寫回 store；`useEnsureMemberColors` 的 `useEffect` 依賴 `entry`，store 更新後會
  自動重新求值並在真的還缺色時再次觸發寫入，等同天然的重試迴圈。因此雙重衝突對這兩處寫入而言
  **不是需要使用者介入的錯誤**，但目前的共用管線仍會無差別彈出「請再操作一次」提示——使用者
  沒有操作任何東西，卻被要求「再操作一次」，造成困惑且並非真實故障。

## 考慮過的方案 (Options Considered)

1. **在 `useGuideStateMutation` / `useWidgetStateOp` 新增 `silent` 旗標，由呼叫端（背景寫入）
   顯式標記，雙重衝突或其他錯誤時跳過 `showToast`（採用）。**
   - 維護性：好。沿用既有共用管線（`useGuideStateMutation` 的 409-rebase 邏輯、`upsertCachedGuideState`、
     store 寫入皆不變），只在 payload 多一個透傳欄位；呼叫端在「不是使用者主動操作」的兩處
     （`useEnsureMemberColors`、`useMemberColors.ensureSelfColor`）顯式加註 `{ silent: true }`，
     邊界清楚、不需要在共用管線內用 widget_id 做隱性特判。
   - 效能：無差異。
   - 安全性：無差異（純前端提示行為，寫入與驗證邏輯不變）。
2. **讓 `useEnsureMemberColors` 改用獨立的 mutation（不經過 `useGuideStateMutation`），自行處理
   409 rebase 且不顯示 toast。**
   - 維護性：差。重複 409-rebase／`parseApiErrorBody`／store 寫入／cache upsert 邏輯，未來
    `useGuideStateMutation` 的行為調整（如上次的 `49e6925`）需要同步改兩處，容易分歧；且與
     ADR-0004 既定的「單一共用抽象」方向相悖。
   - 效能：無差異。
   - 安全性：無差異。
3. **在 `useEnsureMemberColors` 效果內自行加一層有限次數的重試迴圈，繞過提示但不改共用管線。**
   - 維護性：中。無法真正解決問題——`showToast` 是在 `useGuideStateMutation.onError` 內觸發，
     呼叫端的重試迴圈不會阻止它彈出；仍須改共用管線才能真正抑制提示，此方案本身不完整，
     加上去仍需方案 1 才成立，屬多餘的重複重試（`entry` 依賴已提供天然重試）。
   - 效能：略差（額外重試迴圈）。
   - 安全性：無差異。

## 決策 (Decision)

採方案 1：

- `GuideStateMutationPayload` 新增可選欄位 `silent?: boolean`；`useGuideStateMutation` 的
  `onError` 在「雙重衝突後仍失敗」與「非 409 的一般錯誤」兩個分支都改為：`variables.silent`
  為真時直接 `return`，不呼叫 `showToast`（`silent` 本身不送往後端，維持既有
  `stripMutationMetadata` 白名單）。
- `useWidgetStateOp(widgetId, options?: { silent?: boolean })` 新增第二參數，透傳到
  `mutate()` 的初始 payload 與 `rebaseOnConflict` 回傳的重試 payload，確保重試路徑也保留
  `silent` 標記。
- 呼叫端只在兩個「非使用者直接操作」的背景寫入處加註 `{ silent: true }`：
  `useEnsureMemberColors`（房間進入時的整隊補色）與 `useMemberColors.ensureSelfColor`
  （伴隨其他小工具操作的順帶補色）。其餘所有使用者主動點擊觸發的 `useWidgetStateOp` 呼叫
  （checklist、role picker、counter 等）維持預設 `silent` 為 `undefined`／`false`，雙重衝突
  時的提示行為不變。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能皆無實質差異，故以維護性決勝。
方案 1 用一個透傳旗標保留單一共用管線（呼應 ADR-0004「單一共用抽象」的既定方向），且把
「這次寫入是否代表使用者主動操作」的判斷留在呼叫端（該處最清楚寫入的語意），而非在共用管線內
用 widget_id 字串做隱性特判，邊界最乾淨。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 2（獨立 mutation）：重複 409-rebase 與快取寫入邏輯，未來共用管線調整需要同步改兩處，
  違反單一事實來源，否決。
- 方案 3（呼叫端自行重試迴圈）：無法單獨解決 toast 彈出的問題（toast 在共用管線內觸發），
  且與 `entry` 依賴已提供的天然重試重複，否決；即使要做仍需方案 1 才完整。

## 影響 (Consequences)

- 使用者進入已有攻略狀態的房間、或操作小工具時順帶觸發的成員補色寫入，即使遇到雙重 409 衝突
  也不會再彈出「請再操作一次」的錯誤提示；狀態仍會經由 `applyStateUpdate(latest)` 同步到最新，
  且 `useEnsureMemberColors` 的 `entry` 依賴會在下次 store 更新時自動重新嘗試補色。
- 其餘所有使用者主動觸發的 guide-state 小工具寫入（checklist、role picker、assignment 等）
  行為完全不變，雙重衝突仍會提示使用者重新操作。
- `useWidgetStateOp` 新增的第二參數為可選，既有呼叫點（未傳）行為不變，無需批次修改。

## Supersedes / Superseded by

無。延續並補強 [ADR-0004](0004-widget-member-identity-and-colour-legend.md) 的成員顏色預先分配設計，
未推翻其任何決定；也未推翻 `49e6925` 對使用者主動操作維持的 409-rebase-then-toast 行為。
