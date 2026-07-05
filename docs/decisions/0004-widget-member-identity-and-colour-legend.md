# ADR-0004: 隊伍小工具成員身分權威化、全員顏色預先分配與顏色對照區

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend / guide-widgets / party
- 相關文件: docs/frontend-logic.md §1.3、[ADR-0002](0002-party-widget-renderer-coverage.md)、frontend `src/features/guide/widgetMembers.ts`、`src/features/guide/memberColors.ts`、`src/app/parties/[id]/_components/MemberColorLegend.tsx`

## 背景 (Context)

ADR-0002 補齊全部 20 種 widget 渲染器後，使用者回報「很多小工具能顯示但點擊沒功能」，
以隊長身分實測：隊伍仍在招募中、按鈕正常、點下去無反應、也沒有錯誤提示。

根因（已用可執行測試證實，非臆測）：

- 前台 `PartyDetailScreen` 的 `widgetMembers` **只由 `apiParty.slots.filter(is_filled)` 建構**，成員 id 用 `slot.filled_by`。
- 後端 `deriveCurrentMembersFromSlots` / `deriveCurrentMembersFromCreateInputs` 證明
  **隊長在未佔用 filled slot 時會被當成獨立成員計數**，因此隊長常常不在 `slots` 內。
- 隊長寫入小工具狀態時用 `apiParty.leader_id`（＝隊長角色 id），但所有 member-referencing 元件
  （role_picker、assignment_board、toy101_door_assign、answer_lookup、jump_box_sync、
  shared_toggle_board、image_marker_board、rj_door_numbers、counter per_member、checklist multi_user）
  的顯示層都用 `members.some(m => m.memberId === id)` / `assignedMembers(..., memberIds)` 過濾。
  隊長不在 `widgetMembers` → 認領/標記被靜默濾掉 → 名稱與顏色永不顯示 → 看起來「點了沒反應」。
  後端授權以 user identity 檢查（隊長經 `LeaderID` 被視為在隊），寫入其實成功（200，無錯誤 toast），
  純屬前端顯示過濾造成的假象。

離散測試結論：members-in-list 的成員互動→顯示管線完全正常（Test A/B pass）；self-not-in-members 才會被濾掉（Test C）。

同時使用者要求：**確保每個玩家（含隊長）都被分配到一個顏色**，並新增一個
**顏色 ↔ 隊員（名稱＋職業）對照區**方便隊員快速分辨。既有顏色機制（`ensureMemberColor`）是
**懶分配**——只在成員首次與 task widget 互動時才給色，無法保證每人有色，隊長更因被排除而常常無色。

## 考慮過的方案 (Options Considered)

### A. 成員身分權威化（widgetMembers 一律含隊長＋acting self）
- 維護性：高。單一 pure helper `mergeWidgetMembers(base, required)` 去重合併，集中修正，
  修一處即修好全部 member-referencing 小工具；不動各元件的過濾邏輯（過濾 stale id 仍是正確行為）。
- 效能：無差異。
- 安全性：無差異（純顯示層；授權仍在後端 `IsActorInParty`）。

### B. 每個元件各自把 self 補回顯示（就地修補）
- 維護性：低。10+ 個元件各自加「self fallback」分支，重複且易漏；違反 ADR-0002 建立的共用抽象精神。
- 效能/安全性：無差異。

### 顏色策略 A. 載入時主動寫入共享 `party_member_colors`（選定）
- 維護性：高。沿用既有 `ensureMemberColor`（idempotent + rebase-safe），新增
  `ensureMembersColors` 對權威成員清單一次補齊；`party_member_colors` 維持**單一同步來源**，
  既有讀色小工具（answer_lookup / jump_box_sync / assignment）零改動即一致。
- 效能：載入時最多一次 guide-state 寫入（僅在真的缺色時），之後冪等跳過；可忽略。
- 安全性：僅成員且非唯讀、且 strategy party 才寫（沿用 widget 寫入 gate）；經後端 `validatePartyMemberColorsState`。

### 顏色策略 B. 前端本地決定性推導（不寫共享狀態）
- 維護性：中。需同時把既有讀 `party_member_colors` 的小工具改用推導色，否則兩套來源分歧，改動面大。
- 效能：最省（零寫入）。
- 安全性：無差異。

## 決策 (Decision)

- **成員身分**：採方案 A。新增 `mergeWidgetMembers`（`src/features/guide/widgetMembers.ts`），
  `PartyDetailScreen` 的 `widgetMembers` = 「filled slots ＋ 隊長(`leader_id`) ＋ acting self(`selfMemberId`)」去重。
  隊長在本機的名稱用 `actorMemberIdentity.name`；其他 viewer 端在隊長無 slot 時暫以「隊長」fallback。
- **顏色**：採顏色策略 A。新增 `ensureMembersColors` / `membersMissingColor`（`memberColors.ts`）與
  `useEnsureMemberColors`（掛在 `PartyWidgetRuntime` 單一實例），載入時對權威成員清單補齊顏色。
- **對照區**：新增 `MemberColorLegend`，渲染於「隊伍資訊」分頁 `MembersList` 之上，顯示
  色票＋名稱（含「你」標記）＋職業標籤；資料以 context 權威 `members`（含隊長）為主、`members_list` 補職業。
- **gate**：新增 `PartyWidgetContextValue.strategyEnabled`（＝ `canUseStrategy`），
  讓顏色預先分配與對照區只在 GROUP 攻略型隊伍生效，不在快速／非攻略隊伍誤觸發。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：三案安全性、效能皆等價，故以維護性決勝。
成員身分方案 A 與顏色策略 A 都用**單一共用抽象/單一同步來源**消除重複與分歧，符合 ADR-0002
既定的「generic 元件 + 集中狀態」方向；被拒方案 B（就地補 self、雙套顏色來源）都會製造重複或分歧。

## 被拒絕方案與原因 (Rejected Alternatives)

- 成員身分方案 B（各元件就地補 self）：重複邏輯、易漏、與共用抽象相悖，否決。
- 顏色策略 B（本地決定性推導）：需連動改所有既有讀色小工具、製造雙來源分歧，否決；保留為未來若要去除同步寫入時的選項。

## 影響 (Consequences)

- 所有 member-referencing 小工具的隊長（及任何非 slot 成員）認領/標記/顏色即時正確顯示並同步。
- 每位成員載入後都有穩定顏色；對照區讓隊員快速對應顏色↔人。
- widget-state blob 契約不變（仍以 party-member 角色 id 為 key），後端無需改動。
- **已知限制／follow-up**：隊長若不佔 slot，其他 viewer 端目前以「隊長」顯示其名（本機顯示真名）。
  完整解法需後端於 party 回應補上 leader 顯示資訊（name/job/level），屆時前端 fallback 可移除；
  此為後端 follow-up，依 core.md §4 雙向同步於實作時評估。

## Supersedes / Superseded by

無。延續並補強 [ADR-0002](0002-party-widget-renderer-coverage.md)（未推翻其任何決定）。
