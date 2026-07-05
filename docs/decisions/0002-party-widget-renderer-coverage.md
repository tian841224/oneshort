# ADR-0002: 隊伍前台補齊全部 widget 型別渲染器的架構

- 狀態: Accepted
- 日期: 2026-07-04
- 相關模組: frontend / guide-widgets / party
- 相關文件: docs/frontend-logic.md §1.3、backend/internal/guide/validator.go、admin/frontend/src/views/guides/guideAuthoring.ts

## 背景 (Context)

隊伍詳情頁「小工具」分頁只實作 5 種 widget 渲染器（`checklist`、`counter`、`role_picker`、`answer_lookup`、`jump_box_sync`），但：

- **主後端** `internal/guide/validator.go` 的 `knownWidgetTypes` 接受並儲存 **全部 20 種** widget_type，原樣回傳給前台（`content` 為不透明 JSON）。
- **admin 授權面板** (`guideAuthoring.ts` / `GuideEditView.vue`) 讓管理員設計 17 種遊戲工具。

結果：管理員在 admin 設計的工具，只要不是那 5 種，前台一律顯示「即將推出」占位（`isWidgetTypeSupported` → `UnsupportedWidget`），無法正確顯示。這是前端消費端落後於後端／admin 生產端的雙向同步缺口（core.md §4）。使用者要求前台補齊全部 20 種。

另發現相鄰契約 bug：`answer_lookup` 的題目欄位，後端與 admin 用 `question`，但前端 `parseAnswerLookupConfig` 讀 `prompt`，導致 admin 建立的題目在前台被濾空。

## 考慮過的方案 (Options Considered)

1. **每種型別各寫一個 bespoke 元件（15 個新檔）**
   - 維護性：低。15 個高度相似的元件（多數是「成員認領/勾選/計數 + 成員顏色同步」）會大量重複，狀態模型與渲染邏輯反覆抄寫。
   - 效能：無差異。
   - 安全性：無差異。

2. **少數可複用 generic 元件 + config adapter（選定）**
   - 將 20 種歸納為既有 3 種共用狀態模型（`AssignmentState` 成員↔目標、`ChecklistWidgetState` 項目↔成員、`CounterWidgetState` 數值）＋2 個新增模型（`MultiCounterState` 每項計數、`SequenceState` 有序記錄），對應少數 generic 元件；各 widget_type 只需一個薄 config parser 對映。
   - 維護性：高。單一責任、邏輯集中；新增同類工具僅需新增 parser + dispatch 一行。
   - 效能：無差異（純前端渲染，狀態仍走既有 `useGuideStateMutation` revision-rebase 管線）。
   - 安全性：config 全部經 defensive parser（沿用 `widgetConfigs.ts` 慣例），惡意/破格 config 降級為穩定空狀態而非 crash；`image_marker_board` 圖片 URL 已由後端 `isSafeExternalURL` 限制 http/https，前端另加載入失敗 fallback。

3. **前台不逐一實作，改用通用降級渲染（唯讀顯示 config）**
   - 維護性：高但功能不足——多數工具是「即時同步互動」，唯讀顯示不符合 admin 設計意圖。
   - 使用者明確要求「全部 20 種都要」互動顯示，故不採用為最終方案（僅作為 fallback 保留給未知型別）。

## 決策 (Decision)

採方案 2：

- **狀態模型**：沿用 `assignmentOps.ts`（`AssignmentState`：`toggleMulti/SingleAssignment`）、`widgetStateOps.ts`（`ChecklistWidgetState`、`CounterWidgetState`）；新增 `MultiCounterState`（每項計數）與 `SequenceState`（有序 append），皆為純函式 intent，維持 409 rebase 相容。
- **成員顏色**：所有「成員認領」型沿用保留 id `party_member_colors`（`useMemberColors`）。
- **generic 元件對映**：
  - `TallyWidget` ← `gw_ticket_pool` / `gw_phase1_quota` / `rj_guard_tally`
  - `SharedToggleBoardWidget` ← `shared_toggle_board`
  - `ImageMarkerBoardWidget` ← `image_marker_board`
  - `AssignmentBoardWidget` ← `assignment_board` / `toy101_door_assign`（含 suggested 標籤）
  - `SharedProgressWidget` ← `shared_progress`（counter/checklist 雙模式）
  - `SequenceRecorderWidget` ← `sequence_recorder`
  - `PresetSolverWidget` ← `preset_solver`（goddess_400 本地計算器 + 其他 solver 步驟）
  - `PhaseChecklistWidget` ← `rj_perfect_check`（依 phase 分組）/ `gw_reward_handoff`（單一確認）/ `toy101_class_check`（必要職業檢查 + optional flags）
  - `Toy101BoxJumpWidget` ← `toy101_box_jump`（序列步驟顯示）
  - `RjDoorNumbersWidget` ← `rj_door_numbers`（顏色路線認領）
- **契約對齊**：`answer_lookup` 前端欄位由 `prompt` 改為 `question`，對齊後端 validator 與 admin（parser 保留 `prompt` fallback 相容既有資料）。
- **未知型別**：仍保留 `UnsupportedWidget`（「即將推出」）作為 forward-compat fallback。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：安全性上兩方案相同（皆 defensive parse），故以維護性決勝——方案 2 用共用抽象消除 15 份重複邏輯，符合單一責任與邊界清晰；效能無差異。方案 1 的唯一好處是「每個元件可各自客製」，但這些工具的互動語意高度同構，客製差異僅在 config 對映與少量呈現，不足以抵銷重複成本。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（bespoke×15）：重複碼與維護成本過高，被否決。
- 方案 3（純唯讀降級）：不符合「互動同步」設計意圖與使用者需求，僅保留為未知型別 fallback。

## 影響 (Consequences)

- `SUPPORTED_WIDGET_TYPES` 擴為全部 20 種；`WidgetWindowBody` dispatch、`widgetTypeIcon` 同步補齊。
- 新增前端狀態模型（`MultiCounterState`、`SequenceState`）與對應 op，皆為前端內部約定，後端不需改動（state blob 仍不透明）。
- `answer_lookup` 欄位改名為契約對齊，需同步更新型別、parser、既有元件與測試。
- 未來新增 widget_type 時：後端 `knownWidgetTypes`、admin 面板、前端 parser+dispatch 三處需同步（本 ADR 確立三端一致為硬性要求）。
