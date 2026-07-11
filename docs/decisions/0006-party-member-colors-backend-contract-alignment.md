# ADR-0006: `party_member_colors` 前後端契約對齊（放棄自創 schema，改用既有後端驗證格式）

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: frontend / guide-widgets / party
- 相關文件: [ADR-0004](0004-widget-member-identity-and-colour-legend.md)、backend/internal/guide/validator.go、frontend repo `docs/frontend-logic.md` §1.3

## 背景 (Context)

使用者回報隊伍詳情頁「顏色對照」區沒有顯示正確顏色（色票呈現空心／未分配狀態）。

根因（已讀原始碼＋git log 確認，非臆測）：

- 前端 ADR-0004（commit `60571b2`，2026-07-05）實作的 `memberColors.ts` 自訂了一套 wire 格式：`{ v: 1, colors: { [memberId]: "#RRGGBB" } }`，寫入時直接把 `MEMBER_COLOR_PALETTE`（8 組自訂 hex）當作值。
- 後端 `backend/internal/guide/validator.go` 的 `validatePartyMemberColorsState`（**2026-05-20 commit `45c6745` 即已存在，早於前端這次實作超過一個月**）用 `json.Decoder.DisallowUnknownFields()` 嚴格驗證，實際要求的格式是：
  ```json
  { "version": 1, "assignments": { "<memberId>": { "color_key": "guide-red", "assigned_at": "<非空字串>" } } }
  ```
  且 `color_key` 必須是 `knownPartyMemberColorKeys` 這 10 個固定值之一（`guide-red/orange/yellow/green/cyan/blue/violet/pink/stone/lime`），不接受任意 hex。
- 兩者完全不相容（欄位名 `v` vs `version`、`colors` vs `assignments`、值型別「原始 hex 字串」vs「`{color_key, assigned_at}` 物件」）。`DisallowUnknownFields()` 代表**前端目前的每一次寫入都會被後端擋下**（`ErrGuideValidation`），顏色永遠無法真正持久化——每次重新整理都會讀回空狀態，所有色票顯示為未分配。這正是 ADR-0002 已記錄過的同一類「相鄰契約 bug」（`answer_lookup` 的 `question`/`prompt` 欄位不一致），差別在於這次整個 wire 格式都沒對齊，而非單一欄位。
- 全域搜尋確認：`guide-red`／`color_key` 等後端既定的語意色鍵，在前端／admin 任何檔案都**不存在對應的 hex 映射**——這套後端 schema在前端從未被實作過，ADR-0004 是在不知情下自創了一套平行格式，違反 core.md §4「前端不得使用...後端不存在的格式」與「禁止假契約」。

## 考慮過的方案 (Options Considered)

1. **修改後端驗證邏輯，放寬成接受前端目前的 `{v, colors}` 格式。**
   - 維護性：差——後端這支驗證邏輯自 2026-05-20 起穩定超過一個月，`knownPartyMemberColorKeys` 這套語意色鍵的設計意圖（固定調色盤、可讓後續 admin／其他消費端統一引用色鍵而非各自定義 hex）沒有理由因為前端一次性的實作疏漏而放棄；且尚不確定是否有其他（未來）消費端依賴這個既定格式。
   - 效能：無差異。
   - 安全性：中——放寬 schema 等於放棄「只接受白名單色鍵」的輸入驗證，允許前端寫入任意字串當顏色值，擴大攻擊面（雖然目前只是視覺顯示用途，風險有限，但仍是不必要的放寬）。
2. **前端 `memberColors.ts` 改為輸出後端既有 schema，新增一份 `color_key → hex` 的顯示對照表（採用）。**
   - 維護性：好——契約回歸「後端優先」單一事實來源（core.md §4），未來其他消費端（如 admin 若要顯示/管理隊員顏色）可以直接複用同一組 `color_key` 語意常數，不需要各自發明 hex。
   - 效能：無差異（純資料形狀改變，讀寫路徑、409 rebase 機制不變）。
   - 安全性：好——沿用後端既有白名單驗證（僅 10 個固定 `color_key`），不擴大輸入面。

## 決策 (Decision)

採方案 2：

- `memberColors.ts` 的 `MemberColorsState` 改為 `{ version: 1, assignments: Record<memberId, { color_key: GuideMemberColorKey; assigned_at: string }> }`，`GuideMemberColorKey` 為後端 `knownPartyMemberColorKeys` 的 10 個固定值（TS 字面量聯合型別）。
- 新增 `GUIDE_MEMBER_COLOR_HEX`：10 個 `color_key` 對應到符合 style.md §2 暖色調、低飽和度的 hex（沿用可用的既有 brand token，其餘幾個延伸自訂但維持同一美術方向，因為 10 個並存顏色超出核心品牌色數量，與 ADR-0004 原本 8 色調色盤面臨同樣的必要延伸）。
- `ensureMemberColor`/`ensureMembersColors` 簽名新增 `now: string`（呼叫端傳入 `new Date().toISOString()`）以填入後端要求的 `assigned_at`，維持函式本體是純函式、可測試（時間來源留在呼叫端，不內嵌 side effect）。
- `parseMemberColorsState` 嚴格只接受合法 `color_key`（比對 `GUIDE_MEMBER_COLOR_KEYS`），格式不符或欄位缺漏一律降級為空狀態（沿用既有 defensive-parse 慣例，見 ADR-0002）。
- `useMemberColors`/`useEnsureMemberColors` 呼叫端同步改參數；`memberColor()` 回傳值仍是可直接套用的 hex 字串，所有既有小工具（`AssignmentSlotList`、`AnswerLookupWidget` 等）透過 `colorOf()` 消費，**不需要改動**（讀取介面契約不變，只有底層儲存格式修正）。
- 同步更新 frontend repo `docs/frontend-logic.md` §1.3 的 `party_member_colors` 說明，移除文件中對舊 `{v, colors}` 格式的隱性描述。

## 理由 (Rationale)

依 core.md §3.1「安全性 > 維護性 > 效能」：安全性上方案 2 更好（維持既有輸入白名單），維護性上方案 2 回歸「後端優先」單一事實來源、避免未來重複踩到同一個契約分歧，效能兩案無差異。核心依據是 core.md §4「後端優先：API 結構變動時必須同步更新前端」與「禁止假契約」——本案是前端在不知情下建立假契約（自創格式），理應修正前端以對齊已存在超過一個月的後端契約，而非反過來要求穩定的後端驗證讓步。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（放寬後端驗證）：會讓後端放棄既有色鍵白名單、擴大不必要的輸入面，且沒有證據顯示後端這支驗證需要改變——問題出在前端未對齊，不在後端設計不合理，否決。

## 影響 (Consequences)

- `party_member_colors` 寫入現在會被後端接受並真正持久化；`MemberColorLegend` 與所有 member-referencing 小工具（`AssignmentSlotList`／`AnswerLookupWidget`／`ImageMarkerBoardWidget`／`JumpBoxSyncWidget`／`SharedToggleBoardWidget`／`MiscTaskWidgets`）在下一次載入時即可看到正確、持久化的顏色。
- `memberColors.ts` 的公開函式簽名變更（`ensureMemberColor`/`ensureMembersColors` 新增 `now` 參數；`MemberColorsState` 形狀改變），呼叫端（`useMemberColors.ts`、`useEnsureMemberColors.ts`）與單元測試（`memberColors.test.ts`、`assignmentOps.test.ts` 中誤植的重複測試區塊）已同步更新。
- **已知限制／follow-up**：`GUIDE_MEMBER_COLOR_HEX` 的 10 色映射目前只存在於前端；若後端或 admin 未來需要顯示同一組顏色（例如管理後台檢視隊伍顏色分配），應考慮把這份映射表下沉為跨端共享常數或後端回傳的中介資料，避免多端各自維護一份對照表而再次分歧。

## Supersedes / Superseded by

無。修正並補強 [ADR-0004](0004-widget-member-identity-and-colour-legend.md) 的實作（未推翻其「成員身分權威化」與「載入時預先分配」的核心決策，僅修正其 wire schema 選擇）。
