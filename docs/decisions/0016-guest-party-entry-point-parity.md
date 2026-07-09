# ADR-0016: 訪客一般隊伍入口一致性修正（Sidebar/MobileBottomNav 建隊選單、/find 申請入口）

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend / party / auth
- 相關文件: docs/decisions/0014-guest-party-interop-frontend-ui.md, docs/decisions/0015-guest-standard-immediate-party-interop.md, docs/features/guest-mode-plan.md

## 背景 (Context)

ADR-0014/ADR-0015 已經讓 `PartyDetailScreen.tsx`（隊伍詳情頁）與 `CreatePartyScreen.tsx`（建隊頁）正確支援未登入訪客建立/申請一般即時公開隊伍。但實測發現周邊的導覽/列表入口從未接上這個能力，訪客點擊後仍被攔下跳登入，與終點畫面的實際能力不一致：

1. `src/components/shell/Sidebar.tsx`／`src/components/shell/MobileBottomNav.tsx` 的「建立隊伍 › 一般隊伍」選單項目：一律 `disabledHint="登入後使用"` + `onClick` 內 `if (!isAuthenticated) { requireLogin(...); return; }`，即使這個選單項目從未帶 `guild_id`（理論上應該永遠可以放行到 `/parties/create`，讓 `CreatePartyScreen` 自己的訪客分流生效）。
2. `src/app/find/_components/FindPartyScreen.tsx` 的 `handleApply`（隊伍預覽面板「申請加入」按鈕）與 `handlePickCharacter`（`CharacterPickerModal` 選角送出）：對非 quick 隊伍一律 `if (!isAuthenticated) { requireLogin(...); return; }`，完全沒有比照 `PartyDetailScreen.tsx` 既有的 `canApplyAsGuest` 判斷式（`!isQuick && !isPartyReadOnly && recruiting && allow_quick_login_players!==false && role==="visitor" && !scheduled_at && !guild_id`）。

這個 bug 的本質是「訪客資格判斷邏輯只存在於 `PartyDetailScreen.tsx` 一處，沒有被其他入口點消費」，屬於 `.agent/rules/core.md` §3.1 定義的修正方案評估適用範圍。

### 額外查證：`FindPartyScreen.tsx` 的 `openPartyDetail` 鎖定隊伍分支

使用者要求查證 `openPartyDetail`（`FindPartyScreen.tsx:431-458`）對「鎖定（有密碼）非 quick 隊伍 + 未登入訪客」是否也該修正——該函式目前對這個組合仍呼叫 `requireLogin`，看起來像是同一種遺漏。實際追查後端程式碼（非本次修改範圍，僅讀取查證）發現這**不是**前端遺漏，而是後端尚未提供訪客可用的路徑：

- `backend/internal/party/usecase_guest_party.go` 的 `GetPartyForViewer`（guest-aware 的隊伍詳情讀取）：當訪客不是隊伍參與者/管理者、且 `party.JoinRequiresPassword` 為真時，直接回傳 `ErrPartyPasswordRequired`（`handler_party.go` 轉譯為 403），沒有任何「訪客提供密碼後放行」的分支。
- 唯一的密碼驗證端點 `POST /parties/{id}/verify-password`（`VerifyPartyPassword`）註冊在 `backend/internal/party/handler.go` 的 `RegisterRoutes`（嚴格 `Auth()` 群組），要求 `actorFromContext` 成功——對訪客（無 actor token）一律回 401。前端 `usePartyDetail.ts` 在收到 403 且有快取密碼時會嘗試呼叫這支端點，但訪客呼叫必定 401，不會拿到隊伍資料。
- 換言之，一個尚未加入的訪客，**目前完全沒有辦法**讓 `GET /parties/{id}` 或任何密碼驗證流程放行一個鎖定的一般即時隊伍——不管有沒有密碼、有沒有快取密碼都一樣。`PartyDetailScreen.tsx` 自己的 `canApplyAsGuest` + `party.locked` 分支（見該檔案 `startGuestApply`/`submitGuestApply`）雖然寫了處理鎖定隊伍密碼輸入的邏輯，但實際上*目前無法被觸發*：訪客連隊伍詳情頁本身都載入不了（會落入 `passwordRequired` 空狀態，其文案本身就寫著「登入後開始使用，才能輸入隊伍密碼與申請加入」）。

結論：`FindPartyScreen.tsx` 對「鎖定隊伍 + 未登入訪客」維持 `requireLogin` 是**如實反映目前後端能力缺口**，不是前端該修的不一致；本次不修改這個分支，只在程式碼加註解說明原因並指向本 ADR。後端若要補齊（例如讓 `GuestApply` 之外也開放一個訪客可用的「用密碼換取隊伍詳情」路徑），需要另開後端任務評估，不在本次 frontend-only 修正範圍內。

## 考慮過的方案 (Options Considered)

### 方案 1：逐點就地修補（4 個入口各自加一段判斷）

- Sidebar/MobileBottomNav：拿掉登入攔截（這部分本來就只是刪除多餘判斷，兩個方案都一樣做）。
- `FindPartyScreen.handleApply`/`handlePickCharacter`：各自內聯複製 `PartyDetailScreen.tsx` 的 4 個條件（`!isQuick && !isPartyReadOnly && recruiting && allow_quick_login_players!==false && role==="visitor" && !scheduled_at && !guild_id`），並各自內聯複製整套訪客身分收集 + 密碼 modal 的互動流程（`GuestProfilePrompt`、`useQuickGuestProfile`、`partyApi.applyAsGuest` 呼叫、密碼快取判斷）。
- **維護性**：差。這正是本次 bug 的根因重演——同一份規則/流程分散在多處，任何一處未來調整（例如 ADR-0015 若擴充/緊縮資格條件）都必須手動同步多份拷貝，容易再次出現「一處改了、其他處忘了改」的漂移。
- **效能**：與其他方案相同（純前端條件判斷），非決定因素。
- **安全性**：與其他方案相同（判斷邏輯本身若寫對，安全性無差異），但「多份拷貝」提高了未來某一份被錯改而放寬資格判斷的風險。
- **回滾難度**：低（純前端 diff），但這不是本次的關鍵評估點。

### 方案 2：抽出共用判斷函式 + 抽出共用互動 hook（`useGuestStandardPartyApply`），兩者都重用

- 資格判斷抽成 `computeCanApplyAsGuest`（純函式）。
- 額外把 `PartyDetailScreen.tsx` 現有的訪客申請互動狀態機（`guestProfile`／`guestApplyIdentityOpen`／`startGuestApply`／`submitGuestApply`／`handleGuestApplyIdentitySave` 等）整個抽成共用 hook，`FindPartyScreen.tsx` 也接上同一個 hook，讓 `/find` 也能在原地（不跳轉）完成訪客申請。
- **維護性**：資格判斷部分最佳；但互動狀態機部分風險高——`PartyDetailScreen.tsx` 這段程式碼是 ADR-0014 多輪 code review 才抓出並修正 race condition（`isGuestActor` 需排除 `isAuthLoading` 視窗）與 stale closure（`submitGuestApply` 需明確傳入剛存的 profile 值，不能依賴尚未重新渲染的 state）的敏感邏輯；貿然抽成通用 hook 重新配線，有重新引入這些已修正過的細節錯誤的風險。
- **效能**：與其他方案相同。
- **安全性**：與其他方案相同，前提是抽出過程沒有遺漏上述已修正的細節——但這正是風險所在。

### 方案 3（採用）：只抽出「資格判斷」純函式（`computeCanApplyAsGuest`），互動流程不重造，改為導頁到既有詳情頁

- 把 `canApplyAsGuest` 的純布林判斷抽到 `src/lib/partyDisplay.ts` 的 `computeCanApplyAsGuest()`，在 `toDisplayParty()` 內計算一次、附加為 `Party.canApplyAsGuest` 欄位（`src/lib/design/parties.ts`），作為所有入口共用的單一權威來源。
- `PartyDetailScreen.tsx` 改為讀 `party.canApplyAsGuest`（純粹的重構替換，行為完全不變，不動任何互動狀態機）。
- `FindPartyScreen.tsx` 的 `handleApply`：未登入且 `party.canApplyAsGuest && !party.locked` 時，改為 `router.push('/parties/{id}')`——直接導去隊伍詳情頁，讓已經存在、已經過多輪 review 驗證過的訪客申請 UI（身分收集 + 密碼流程 + `partyApi.applyAsGuest`）接手，不在列表頁重造一份。`handlePickCharacter` 因此變成防禦性程式碼（`picker` 狀態不會再被未登入使用者觸發），保留原本的 `!isAuthenticated` guard 並加註解說明。
- Sidebar/MobileBottomNav 部分兩個方案做法相同（純刪除多餘的登入攔截）。
- **維護性**：資格判斷單一權威來源（與方案 2 同等好）；互動流程完全不動、零重複——比方案 2 更好，因為訪客申請 UI 永遠只存在一個地方（`PartyDetailScreen.tsx`），未來要改也只需要改一處。
- **效能**：純前端條件判斷 + 一次額外導頁，可忽略不計。
- **安全性**：資格判斷邏輯與 `PartyDetailScreen.tsx` 完全一致（同一個函式），不會產生「列表頁允許但詳情頁拒絕」或反向的資格判斷分歧；且完全不觸碰 ADR-0014 已修正過的敏感 race-condition/stale-closure 邏輯，回歸風險最低。
- **代價**：訪客從 `/find` 列表頁點「申請加入」時，體驗上會多一次頁面跳轉（先進詳情頁，才看到訪客身分收集表單），不像已登入使用者可以直接在列表頁彈出角色選擇 modal。此代價可接受，理由見下方「理由」段落。
- **回滾難度**：低（新增一個欄位 + 幾行入口路由邏輯的 diff，無 schema/API 變更）。

## 決策 (Decision)

採用方案 3：

1. `src/lib/design/parties.ts`：`Party` 型別新增 `canApplyAsGuest?: boolean`。
2. `src/lib/partyDisplay.ts`：新增匯出函式 `computeCanApplyAsGuest(apiParty, viewerRole, isFull)`，`toDisplayParty()` 呼叫它並附加到回傳的 `Party` 物件（`viewerRole`/`isFull` 皆為該函式既有的區域變數，原樣重用）。
3. `src/app/parties/[id]/_components/PartyDetailScreen.tsx`：`canApplyAsGuest` 改為 `!isAuthenticated && party.canApplyAsGuest === true`（純重構，行為不變；`canUnauthenticatedQuickJoinStandardSlot`——用於「記住待申請空位、登入後自動送出」機制——維持原樣，因為它的適用範圍比 `canApplyAsGuest`更廣，涵蓋排程/公會隊伍，是不同概念）。
4. `src/components/shell/Sidebar.tsx`／`src/components/shell/MobileBottomNav.tsx`：「一般隊伍」建隊選單項目移除 `disabledHint`／`if (!isAuthenticated)` 登入攔截，一律直接導向 `/parties/create`。
5. `src/app/find/_components/FindPartyScreen.tsx`：
   - `handleApply`：未登入時，若 `party.canApplyAsGuest && !party.locked` 則 `router.push('/parties/{id}')`；否則維持 `requireLogin(...)`。
   - `handlePickCharacter`：保留既有 `!isAuthenticated` 防禦性 guard（理論上已不可達，因為 `handleApply` 不會再讓未登入使用者進到 `picker` 狀態），加註解說明。
   - `openPartyDetail` 的鎖定隊伍分支：不修改，加註解說明查證結論（見「背景」段落）並指向本 ADR。
6. `src/app/find/_components/PartyPreview.tsx`：新增 `isAuthenticated` prop，非 quick 隊伍的 `canApply` 依此分流——已登入沿用 `hasEligibleSlot(party, currentUser)`，未登入改用 `party.canApplyAsGuest === true`，不再用訪客的假身分（`GUEST_CHARACTER`）判斷是否啟用申請按鈕（見下方「已知後續第 3 點的修正」，此為 reviewer 審查抓出、同批修正的問題，不是原始三方案分析涵蓋的範圍）。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：方案 3 的資格判斷與 `PartyDetailScreen.tsx` 使用同一個函式（`computeCanApplyAsGuest`），不存在「列表頁 vs 詳情頁判斷不一致」的風險；且完全不改動 ADR-0014 已由多輪 review 修正過的 `isGuestActor`/stale-closure 相關邏輯，避免重新引入那些已修正的錯誤——這是方案 3 優於方案 2 的關鍵理由（安全性優先於維護性的極致最佳化）。
- **維護性**：訪客申請的互動 UI 永遠只存在一份（`PartyDetailScreen.tsx`），符合「重複邏輯必須封裝」，但選擇「導頁複用既有畫面」而非「抽出可重用 hook 兩處配線」，是因為前者的維護面積更小、風險更低，在「資格判斷」與「互動流程」兩個子問題上分別選了風險最小的封裝方式，而非為了追求形式上的完全一致而承擔不必要的回歸風險。
- **效能**：三個方案在效能面向無實質差異，非本次決策的區分因素。
- **一致性驗證**：本次額外查證「鎖定隊伍 + 訪客」在 `PartyDetailScreen.tsx` 是否真的可行，發現是後端能力缺口（`GetPartyForViewer`/`VerifyPartyPassword`）而非前端遺漏，避免了誤判並貿然「修正」一個實際上會導向死路（訪客導去詳情頁卻仍然看到「請登入」訊息）的假修復。

## 被拒絕方案與原因 (Rejected Alternatives)

- **逐點就地修補，四處各自複製資格判斷與互動流程（方案 1）**：正是本次 bug 的根因模式重演，任何未來的資格條件調整都需要手動同步多份拷貝，違反核心規範「重複邏輯必須封裝」。
- **抽出共用互動 hook，讓 `/find` 也能原地完成訪客申請（方案 2）**：維護性形式上最佳，但需要重新配線 ADR-0014 已修正過的敏感 race-condition（`isGuestActor` 排除 `isAuthLoading` 視窗）與 stale-closure（`submitGuestApply` 明確傳入剛存的 profile）邏輯，安全性/回歸風險高於方案 3 帶來的維護性增量，依「安全性 > 維護性」的優先順序判斷不採用。若日後 `/find` 列表頁的訪客申請體驗（避免多一次跳轉）成為明確需求，可以另開任務、在有完整回歸測試覆蓋的前提下再評估此方案。
- **同步修正 `openPartyDetail` 的鎖定隊伍分支，讓訪客直接繞過密碼驗證進入詳情頁**：查證後發現這是後端能力缺口（訪客沒有可用的密碼驗證路徑），不是前端可以片面修正的問題；勉強繞過只會讓訪客導頁後看到「請登入」的空狀態，體驗更差且掩蓋真正的後端缺口。

## 影響 (Consequences)

- **前端影響範圍**：`src/lib/design/parties.ts`、`src/lib/partyDisplay.ts`、`src/app/parties/[id]/_components/PartyDetailScreen.tsx`（純重構，行為不變）、`src/components/shell/Sidebar.tsx`、`src/components/shell/MobileBottomNav.tsx`、`src/app/find/_components/FindPartyScreen.tsx`、`src/app/find/_components/PartyPreview.tsx`、`src/app/guilds/[id]/_components/GuildDetailClient.tsx`（新增 `isAuthenticated` prop傳遞，見下方「已知後續第 3 點的修正」）。無 API 契約變更、無新增依賴。
- **測試**：新增 `computeCanApplyAsGuest`/`Party.canApplyAsGuest` 的單元測試（`src/lib/partyDisplay.test.ts`）；`FindPartyScreen.test.tsx` 新增「訪客申請合格一般隊伍時導向詳情頁而非跳登入」「公會/鎖定隊伍仍維持登入攔截」案例；`src/components/shell/authControls.test.tsx` 既有斷言「建隊選單顯示登入後使用提示」的測試已更新為「不再顯示提示、直接導頁」，並新增已登入使用者的對照案例；新增 `PartyPreview.guestEligibility.test.tsx`，刻意不 mock `hasEligibleSlot`/`isSlotEligible`（`PartyPreview.test.tsx` 既有測試把它們整組 mock 成恆真/簡化版，會掩蓋真實資格判斷的迴歸），驗證訪客對指定職業/等級門檻隊伍的真實可點擊行為。
- **已知後續（未在本次處理，記錄以避免遺失）**：
  1. 後端若要讓訪客也能瀏覽/申請鎖定的一般即時隊伍，需要新增一個訪客可用的密碼驗證路徑（例如擴充 `GetPartyForViewer` 接受一次性密碼參數，或新增類似 `GuestApply` 已支援的「密碼隨請求一起送」模式的訪客專用 verify 端點）；這是後端任務，不在本次 frontend-only 修正範圍內。
  2. `/find` 列表頁訪客申請目前是「導頁到詳情頁」而非原地完成；若未來要做成原地完成（如方案 2 所述），需要在有完整回歸測試覆蓋 ADR-0014 已修正過的 race-condition/stale-closure 案例的前提下再評估。

### 已知後續第 3 點的修正（2026-07-09，reviewer 抓出並同批修正）

原「已知後續」第 3 點記錄的落差——`PartyPreview.tsx` 用 `hasEligibleSlot(party, currentUser)` 判斷「申請加入」按鈕是否可點擊，未登入訪客的 `currentUser` 卻是固定的 `GUEST_CHARACTER`（`cls:"guest", lv:1`）——經 reviewer 審查指出，這其實與本次任務要解決的症狀是同一類問題：真實瀏覽器情境下，只要隊伍有任何指定職業或 `lvMin > 1` 的空位（絕大多數一般隊伍皆是如此），`isSlotEligible` 就會判定不合格，按鈕會被 `disabled` 且 `onClick` 設為 `undefined`——訪客實質上仍然點不到，`handleApply` 的導頁修正永遠不會被觸發。已在同一輪修正：

- `PartyPreview.tsx` 新增 `isAuthenticated: boolean` prop；`canApply` 對非 quick 隊伍改為：已登入時沿用 `hasEligibleSlot(party, currentUser)`（不變）；未登入時改用 `party.canApplyAsGuest === true`（即本 ADR 抽出的 `computeCanApplyAsGuest`），完全不再讀 `currentUser`/`hasEligibleSlot`，因此訪客是否有設定真實職業/等級與此按鈕的可點擊性無關（申請時的實際資格驗證仍在導頁後的詳情頁 `partyApi.applyAsGuest` 完成）。
- 未合格時的 disabled 文案與 tooltip 依 `isAuthenticated` 分流：已登入沿用「無符合角色」；未登入改為「此隊伍暫不開放訪客申請」，不再誤導成「角色不符」。
- 呼叫端（`FindPartyScreen.tsx` 兩處 `<PartyPreview>`、`GuildDetailClient.tsx` 一處）新增傳入 `isAuthenticated`（皆已有現成的 `useAuth().isAuthenticated`，guild 隊伍必屬公會、`canApplyAsGuest` 恆為 false，故該處新增此 prop 不影響其既有的已登入資格判斷行為）。
- 新增測試 `PartyPreview.guestEligibility.test.tsx`：不 mock `hasEligibleSlot`/`isSlotEligible`，用一個限定「戰士職業 + `lvMin:150`」的隊伍分別驗證「`canApplyAsGuest:true` 時未登入訪客按鈕可點擊」「`canApplyAsGuest:false` 時未登入訪客按鈕停用且文案正確」「已登入 actor 的真實角色資格判斷不受 `canApplyAsGuest` 影響」。既有 `PartyPreview.test.tsx`（`hasEligibleSlot` 整組 mock 成恆真）的測試訊號本身無法證明修正有效——因為即使程式碼仍是修正前的版本，該檔案的 mock 也會讓斷言通過；這正是本次新增獨立測試檔、刻意不 mock 的原因。

此點已解決，行為與 `PartyDetailScreen.tsx` 的資格判斷完全一致（同一個 `computeCanApplyAsGuest`），不再是已知落差。

## 後續追蹤：`/find` 建立隊伍 CTA 的登入攔截（2026-07-09，使用者實測回報）

使用者實測目前訪客建隊/找隊流程後，回報 `src/app/find/_components/FindPartyScreen.tsx` 的 `onNavigateCreate`（供頁面右上角與空狀態「建立隊伍」CTA 使用，非快速隊伍分頁）點擊後仍會跳登入，即使目的頁 `CreatePartyScreen.tsx` 早已透過 `!auth.isAuthenticated && !guildId` 分流到完整支援訪客建立的 `GuestCreatePartyScreen`。

這與本 ADR 修正 Sidebar/MobileBottomNav「一般隊伍」建隊選單項目是**同一種遺漏模式**（訪客資格判斷/入口能力沒有同步套用到所有消費端），不是新的方案取捨，故不另開三方案分析，直接沿用本 ADR 決策模式修正：

- `createPartyHrefForTab(tab)` 產生的網址一律不帶 `guild_id`（`PartyTab` 型別本身也沒有任何公會限定分頁，`createTab` 只會是 `FIND_PARTY`/`FIND_QUICK`/`FIND_BOSS`/`FIND_TRAINING`），已查證過 quick 分頁本就走 `openQuickCreate()`（另一支函式，已支援訪客），故 `onNavigateCreate` 只會被非 quick 分頁呼叫，移除這裡的 `requireLogin` 攔截不會誤放行公會隊伍建立。
- 修法：`onNavigateCreate` 移除 `if (!isAuthenticated) { requireLogin(...); return; }` 分支，一律 `router.push(createHref)`，未登入時目的頁的既有訪客分流會接手。
- 測試：`FindPartyScreen.test.tsx` 既有斷言「非 quick 分頁建立隊伍會 requireLogin」的案例已更新為「直接導頁、不呼叫 requireLogin」。

此修正範圍與本 ADR 決策 4（Sidebar/MobileBottomNav）同性質，記錄於此以避免未來重複踩坑，不影響本 ADR 已記錄的其他決策與已知後續。

## Supersedes / Superseded by

不推翻任何既有 ADR；補齊 ADR-0014/ADR-0015 遺留的入口一致性缺口。ADR-0014 已加註後續更新，指向本 ADR。
