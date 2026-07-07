# ADR-0014: 訪客帳號建立/申請/管理一般即時隊伍的前端 UI 實作

- 狀態: Accepted
- 日期: 2026-07-07
- 相關模組: frontend / party / auth
- 相關文件: docs/features/party.md, docs/features/guest-mode-plan.md，以及 backend/frontend 資料層決策（見「背景」說明的編號問題）

## 背景 (Context)

後端與前端資料層（型別、`partyApi`、`useViewerIdentity`、登入自動認領）已在分支 `docs/guest-party-interop`（尚未合併回 `develop`）記錄為該分支自己的 `docs/decisions/0012-guest-standard-immediate-party-interop.md`，決定訪客（`quick_guest_token` cookie 識別、無 Postgres 資料列）可以建立/申請/擔任隊長於一般即時公開隊伍。

**編號提醒**：本機 `develop`（da8bf7a）目前的 ADR-0012 是另一個已合併主題（`0012-guide-widget-write-serialization.md`），與 `docs/guest-party-interop` 分支自己標記的「ADR-0012」（訪客整合資料層決策）不是同一份文件——後者尚未合併，合併時需依 index 規則重新編號（很可能變成 0015 或更後）。本文件（實際 UI 落地）在 `develop` 上編號為 ADR-0014，不對外文件的「ADR-0012」引用做任何假設；本文件內文以「訪客資料層決策」指稱該分支的內容，不寫死其編號。

本 ADR 記錄的是該資料層決策遺留的前端 UI 待辦（訪客建隊/申請/隊長管理 UI）的具體實作方案：

1. `QuickGuestIdentityPrompt.tsx` 只收集暱稱，需要擴充成也能收集職業＋等級。
2. 建立隊伍頁未登入時直接導向 `LoginRequiredState`，需要讓訪客能建立即時公開隊伍。
3. 隊伍列表卡片／詳情頁需要正確渲染 `leader_guest_id`/`filled_by_is_guest`，並讓訪客能申請隊伍。
4. （探索後新增範圍）訪客若透過方案 2 建隊成為隊長，`PartyDetailScreen` 既有的隊長操作（踢人、隊伍設定、關閉隊伍、退出）呼叫的是 actor-only mutation，對訪客視角會 401/403——即使 `viewer_capabilities.is_host` 已正確判斷訪客是隊長。訪客資料層決策已提供對應的 guest-only 端點（`guest-settings`/`guest-close`/`guest-slots/{slotId}/kick`/`guest-membership`），本 ADR 決定一併接上，讓訪客建隊後的隊長體驗完整可用。

## 考慮過的方案 (Options Considered)

### A. 訪客身分收集元件（暱稱 vs 暱稱＋職業＋等級）

1. **直接擴充 `QuickGuestIdentityPrompt` 的 `onSave` 簽章**（改成永遠回傳 `{displayName, jobClassId, level}`）：會破壞既有 3 個呼叫點（`FindPartyScreen`／`PartyDetailScreen` 的 quick-party 加入流程／`AppShell`）目前只需要暱稱的呼叫介面，且 quick party 訪客本來就沒有職業/等級概念，強迫它們處理額外欄位是不必要的耦合。
2. **新增獨立 `GuestProfilePrompt` 元件，與 `QuickGuestIdentityPrompt` 共用一個內部「身分卡外殼」子元件（圖示＋標題＋描述＋關閉鈕）**（採用此方案）：兩者的 `onSave` 契約各自表達真正需要的資料（純字串 vs 結構化物件），不必為了共用而扭曲介面；共用的只有純呈現的外殼，不含業務邏輯。

### B. 訪客建立隊伍畫面（延伸既有 wizard vs 新畫面）

1. **在 `CreatePartyScreen` 內加 `if (!auth.isAuthenticated)` 分支，重用整個 4 步驟 mobile wizard（`BasicInfoColumn`/`SlotsColumn`/`PreviewColumn`／`NewSlotConditionModal`／`InviteMemberModal`）＋角色選擇／邀請/條件 modal 全部邏輯**：探索後發現 `SlotsColumn`／`CreateSlotRow` 對 `COND`／`INVITED`／`EMPTY` 三種 slot kind 完全不依賴 auth（`characters` 為空陣列時 `MyCharactersStrip` 自然不渲染），可以重用；但訪客沒有「自己的角色」可選，隊長席位需要用訪客自己的 name/job/level 填入，且排程/公會 UI 需要整段隱藏。
2. **新建 `GuestCreatePartyScreen`，重用 `BasicInfoColumn`（新增 `hideSchedule` prop）＋ `SlotsColumn`（`characters=[]`，只管理「隊長以外」的 slot）＋ `PreviewColumn`，隊長席位以固定的 `INVITED`-kind 物件組進 preview slots，送出時再併回 `slots[0]`**（採用此方案）：不修改 `CreatePartyScreen` 既有的複雜狀態機（wizard step、欄位錯誤捲動、公會路由），降低對已上線功能的風險；付出的代價是 slot→API payload 的映射邏輯（`COND`/`INVITED`/`EMPTY` 三個分支）在兩個檔案中結構相同、各自維護一份（詳見「被拒絕方案」與「已知後續」）。

### C. 訪客申請隊伍（沿用登入導轉 vs 直接訪客申請）

1. **沿用既有「未登入點加入 → 記住 pending slot → 導去登入 → 登入後自動送出申請」流程**：這是修改前就存在的機制，但僅限 `isAnyClassSlot`（不限職業）的空位，因為舊流程假設訪客沒有職業/等級可供資格判斷。
2. **新增 `canApplyAsGuest`（立即、公開、非公會、`allow_quick_login_players!==false`）路徑，訪客可直接以 `partyApi.applyAsGuest` 申請任何符合資格的空位（依真實職業/等級判斷資格），不必登入**（採用此方案，與方案 1 並存）：訪客現在有真實職業/等級，`isSlotEligible` 可以像角色一樣判斷資格，不需要再限制「只能是不限職業空位」；`canApplyAsGuest` 為 false 的情境（排程／公會隊伍，訪客本就不可參與）則維持方案 1 的登入導轉不變。

### D. 訪客隊長操作（本次一併完成 vs 留待下次）

1. **本次只做資料渲染＋申請，隊長操作留給下一個任務**：範圍最小，但訪客建隊後回到詳情頁會看到「壞掉」的踢人/設定/關閉/退出按鈕（因為 `role==="leader"` 判斷正確但底層 mutation 打 actor-only 端點）。
2. **本次在 `usePartyMutations.ts` 與 `PartyDetailScreen` 一併加上 `isGuestActor` 分支，接上 `guest-settings`/`guest-close`/`guest-slots/{slotId}/kick`/`guest-membership`**（採用此方案，使用者於探索後明確選擇）：與既有 `isQuickParty` 三分支模式（quick / guest / actor）同一形狀，不是新機制；`isGuestActor` 定義為 `!isAuthLoading && !isAuthenticated`（需排除 auth 查詢尚未完成的初始渲染窗口，否則真正登入的隊長會在頁面剛載入的瞬間被誤判為訪客，導致操作打到 guest-only 端點而 401/403）。

### E. 訪客成員的顯示身分（reuse `kind:"guest"` vs 新增 `isGuest` 旗標）

1. **重用既有 `PartyMember.kind==="guest"`（quick party 的「無職業/等級訪客」視覺）**：`MembersList`/`PartyPreview` 已經對 `kind==="guest"` 隱藏職業與等級、只顯示「遊客」標籤——但一般隊伍訪客（本決策範圍）**有**真實職業與等級（slot 的 `filled_by_job`/`filled_by_level` 一樣會填），套用這個既有語意會把訪客的職業/等級資訊藏起來，資訊倒退。
2. **新增 `PartyMember.isGuest?: boolean`，`kind` 仍是 `"character"`（職業/等級正常顯示），額外疊加「訪客」標籤**（採用此方案）：`characterMemberFromSlot` 依 `slot.filled_by_is_guest` 分流到新的 `standardGuestMemberFromSlot`，`MembersList`/`PartyPreview`/`ApplicationsPanel`/`MemberColorLegend` 在既有「職業 · 等級」呈現旁加一個「訪客」pill，不影響原本的 `kind==="guest"`（quick party 無職業訪客）路徑。

## 決策 (Decision)

採用方案 A-2、B-2、C-2（與方案 1 並存）、D-2、E-2，具體檔案：

- `src/components/party/QuickGuestIdentityPrompt.tsx`：新增 `GuestProfilePrompt`（暱稱＋`JobClassSelect`＋等級輸入，重用 `IdentityCardChrome`/`DialogOverlay` 內部外殼）；同時把這個檔案原本大量的 inline `style={{...}}`（違反 style.md §12.2）改成 `.os-quick-guest-identity__*` CSS class，因為本次要大幅擴充此檔案，順手修正既有的規範違規，不留下更大的技術債。
- `src/hooks/useQuickGuestProfile.ts` + `src/lib/quickGuestIdentity.ts`：暱稱＋職業＋等級的 localStorage 持久化（與既有純暱稱版 `useQuickGuestDisplayName` 並存，不合併，因為 quick party 本身不需要職業/等級）；新增 `isCompleteQuickGuestProfile()` 作為「訪客資料是否完整（含等級落在合法範圍）」的單一權威判斷，所有呼叫點（`GuestCreatePartyScreen`、`PartyDetailScreen.startGuestApply`、`GuestProfilePrompt.canSubmit`）改為呼叫它，不各自重新實作（原本三處各自 inline 重寫，範圍不含等級邊界檢查，經 code review 抓出後統一修正）。
- `src/app/parties/create/_components/GuestCreatePartyScreen.tsx`（新檔案）＋ `CreatePartyScreen.tsx`（未登入且無 `guildId` 時導向新畫面）＋ `BasicInfoColumn.tsx`（新增 `hideSchedule` prop）。
- `src/app/parties/[id]/_components/PartyDetailScreen.tsx`：新增 `canApplyAsGuest`／`guestSlotUser`／`isGuestActor`（`!isAuthLoading && !isAuthenticated`）／`submitGuestApply`／`startGuestApply`／`handleGuestApplyIdentitySave`／`handleCancelGuestApplication`；`resolveActorMemberIdentity` 新增以 `viewer_capabilities.chat_sender_id`（後端已提供的、訪客與 actor 通用的自身識別 UUID）解析「這一列是不是我自己」，修正訪客隊長原本無法被小工具系統（`selfWidgetMemberId`／顏色小工具）正確識別為自己的問題。
- `src/features/party/mutations/usePartyMutations.ts`：`SavePartyInput`/`KickMemberInput`/`LeavePartyInput`/`DisbandPartyInput`/`TogglePartyVisibilityInput` 新增 `isGuestActor`，比照既有 `isQuickParty` 分支模式接上 guest-only 端點。
- `src/features/party/queries/usePartyApplications.ts` + `ApplicationsPanel.tsx` + `PartyDetailTabs.tsx`：`isGuestActor` 貫穿到申請列表／審核 mutation，讓訪客隊長也能看到並審核待審申請（含訪客申請者的 `guest_applicant` 顯示）。
- `src/lib/partyDisplay.ts` + `src/lib/design/parties.ts`：`PartyMember.isGuest` 旗標；`MembersList.tsx`/`PartyPreview.tsx`/`ApplicationsPanel.tsx`/`MemberColorLegend.tsx` 疊加「訪客」標籤，同時保留職業/等級顯示。
- `MembersList.tsx` 的 `getVisitorSlotState`：未登入分支從「只認不限職業空位」改成「有訪客身分則用 `isSlotEligible` 判斷真實資格，尚未設定身分則視為可點擊（點擊後才收集身分）」。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：`isGuestActor` 明確排除 `isAuthLoading` 視窗，避免真正登入的隊長在頁面剛載入、auth 查詢尚未完成的瞬間被誤判為訪客而把操作打到 guest-only 端點（多輪 code review 抓出的真實 race condition，已修正）。`submitGuestApply`／`handleGuestApplyIdentitySave` 之間曾有 stale closure（`setGuestProfile` 後在同一個 tick 內用舊的 `guestProfile` 送出申請，導致新訪客第一次設定完身分送出的申請帶著空白資料），已改為明確傳入剛儲存的 profile 值，不依賴尚未重新渲染的 state。
- **維護性**：`GuestProfilePrompt`／`QuickGuestIdentityPrompt` 共用外殼但不共用資料契約，避免為了共用硬湊出一個所有呼叫點都要處理額外欄位的介面；`isCompleteQuickGuestProfile` 統一「訪客資料完整」的定義，避免三處分別维护、範圍不一致（已知的維護風險，經 review 抓出並修正）。`isGuestActor`／`isQuickParty` 雙布林分支沿用本檔案既有的三分支模式（quick / guest / actor），不是新發明的機制。
- **效能**：訪客職業/等級的 localStorage 讀寫沿用既有 `useQuickGuestDisplayName` 的 `queueMicrotask` 模式，量級相同，只在使用者主動建隊/申請時觸發，非熱路徑。

## 被拒絕方案與原因 (Rejected Alternatives)

- **`QuickGuestIdentityPrompt.onSave` 統一回傳結構化物件（方案 A-1）**：會強迫 3 個既有 quick-party 呼叫點處理它們用不到的欄位，增加耦合而非減少。
- **`GuestCreatePartyScreen` 直接在 `CreatePartyScreen` 內用大量 `if (!auth.isAuthenticated)` 分支重用整個 wizard（方案 B-1）**：`CreatePartyScreen` 已經有 mobile 4 步驟 wizard、欄位錯誤捲動、公會路由等狀態機，訪客不需要排程/公會且沒有角色選擇，硬塞進去會讓一個已經複雜的元件更難維護；新畫面的代價（slot→payload 映射邏輯與 `CreatePartyScreen.handleSubmit` 結構相同、各自維護一份）已知且可接受，記錄於「已知後續」。
- **重用 `PartyMember.kind==="guest"` 顯示一般隊伍訪客（方案 E-1）**：會隱藏訪客實際擁有的職業/等級資訊，是資訊倒退，不符合 §12.1「資訊保全」（重排版面可以，但不能刪資訊）。
- **訪客隊長操作留待下一個任務（方案 D-1）**：使用者在澄清問題中明確選擇本次一併完成，理由是訪客建隊後回到詳情頁若操作按鈕全部失效，會是一個完整功能中間留下的破損體驗，不符合 core.md §4「雙向同步檢查」的「不得讓功能長期處於一端已完成、另一端完全沒有消費的孤立狀態」精神（此處是「建隊完成但隊長管理沒接上」的孤立狀態）。

## 影響 (Consequences)

- **已知後續（未在本次處理，記錄以避免遺失）**：
  1. `GuestCreatePartyScreen.tsx` 的 slot→API payload 映射（`COND`/`INVITED`/`EMPTY` 三分支）與 `CreatePartyScreen.tsx` 的對應邏輯結構相同但各自維護一份；未抽出共用函式。若未來變更 slot payload 欄位，需要同步修改兩處。
  2. 未執行 Playwright 動態手機版實測（375/390/430/768，`mobile-rwd-audit` skill 的 §13.2 動態走訪部分）——本次開發環境無法連上 Chrome 擴充功能、後端服務未啟動，僅完成靜態掃描（§13.1，`grep` 對照 style.md §10 不變式，無違規）＋ `npx tsc --noEmit` ＋ `npm run build` 全部通過。合併前建議在後端服務可用時補一輪動態實測。
  3. `docs/guest-party-interop` 分支自己的 ADR（訪客資料層決策，前述「編號提醒」）合併回 `develop` 時，其自編的「ADR-0012」需要依照 `docs/decisions/index.md` 規則重新編號（屆時 `develop` 的下一個可用編號會比本文件的 0014 更後），並在該次合併中更新索引；本文件的引用一律以「訪客資料層決策」描述，不寫死其編號，届時不需要回頭修改本文件。
- **API 契約**：無新增後端契約（沿用訪客資料層決策已定義的 `guest-*` 端點）；前端型別已在資料層任務完成，本次未修改 `src/lib/types/party.ts`。
- **前端影響範圍**：`QuickGuestIdentityPrompt.tsx`、`CreatePartyScreen.tsx`（新增分流，不變更既有已登入行為）、`PartyDetailScreen.tsx`（新增訪客分支，`role`/`viewer_capabilities` 既有邏輯不變）、`usePartyMutations.ts`／`usePartyApplications.ts`（新增可選參數，預設值維持既有行為不變）。

## Supersedes / Superseded by

不推翻任何既有 ADR-0001～0013；補齊訪客資料層決策（`docs/guest-party-interop` 分支，尚未合併）標記為「後續 UI 專案」的部分。
