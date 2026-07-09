# ADR-0019: 訪客隊長身分跨元件同步、Navbar 全站身分藥丸、編輯彈窗

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend / party / auth
- 相關文件: docs/decisions/0015-guest-standard-immediate-party-interop.md, docs/decisions/0018-create-party-desktop-wizard.md

## 背景 (Context)

訪客（未登入）建立隊伍時填寫的「隊長身分」（姓名/職業/等級，`useQuickGuestProfile`/`quickGuestIdentity.ts`，ADR-0015）已經存進 localStorage、下次會自動帶入，但存在三個缺口：

1. `useQuickGuestProfile` 只在掛載時 `queueMicrotask` 讀一次，之後不再更新——若 Navbar 和建立隊伍頁同時掛載，其中一處改了身分，另一處要重整頁面才會反映。
2. 全站 Navbar 的「登入」按鈕沒有比照已登入帳號的操作方式，呈現訪客目前身分。
3. 沒有「修改訪客身分設定」的入口（只能在建立隊伍/申請加入的當下順便改）。

以上三點與 [ADR-0018](0018-create-party-desktop-wizard.md) 的桌面 wizard 同批處理，因為 wizard 新增了「已有身分時自動跳過導覽第一頁」的需求，必須先有可靠的跨元件同步機制才能判斷「這是不是載入當下就讀到的既有資料」。

## 考慮過的方案 (Options Considered)

### 方案 1：`useQuickGuestProfile` 改用 `useSyncExternalStore`

- React 18+ 官方建議的外部 store 訂閱 API，理論上是「正確答案」。
- **維護性**：專案內其他跨元件 localStorage 同步（`quickPartySession.ts` / `useQuickGuestPartySession.ts`）都是用「自訂事件 + `storage` 事件監聽 + `useEffect` 內 `setTimeout(refresh, 0)` 首讀」的 pattern，且已經過 code review 驗證穩定運作。改用 `useSyncExternalStore` 會讓這個 hook 的實作方式與同專案其他兩個高度相似的 hook（`useQuickGuestPartySession`、以及即將新增的訂閱邏輯）不一致，未來讀這三個檔案的人需要在腦中切換兩種不同的心智模型，維護一致性反而變差。
- **效能**：`useSyncExternalStore` 理論上能避免額外一次 re-render（讀取與訂閱合併在同一次 commit），但這裡的資料量極小（3 個 string/number 欄位），效能差異可忽略不計。
- **安全性**：與其他方案相同，純前端 state 同步，無信任邊界。
- **回滾難度**：中——若之後要統一改回 `useEffect` pattern，需要重新設計 `getSnapshot`/`subscribe` 的邊界。

### 方案 2（採用）：延續 `quickPartySession.ts` 既有的「自訂事件 + storage 事件監聽」pattern

- `quickGuestIdentity.ts` 新增 `quickGuestProfileChangedEvent`、`emitQuickGuestProfileChanged()`、`subscribeQuickGuestProfile(listener)`，逐字比照 `quickPartySession.ts` 的 `subscribeQuickPartySession` 寫法：監聽自訂事件（同分頁內其他呼叫者寫入時觸發）+ 原生 `storage` 事件（其他分頁寫入時觸發），事件觸發條件為三個 guest storage key 任一變動。
- `useQuickGuestProfile` 改成掛載時 `setTimeout(refresh, 0)` 讀一次（SSR-safe），並在整個掛載期間持續訂閱，卸載時取消——逐字比照 `useQuickGuestPartySession.ts` 已驗證過的寫法。
- **維護性**：與專案既有的兩個同類 hook（`quickPartySession.ts`/`useQuickGuestPartySession.ts`）完全同構，新加入這個領域的開發者只需要認得一種 pattern。
- **效能**：與方案 1 無實質差異（資料量小）。
- **安全性**：與方案 1 相同。
- **回滾難度**：低——純新增函式與 hook 內部實作调整，呼叫端介面（`[profile, setProfile]` 陣列解構）維持相容（見下方「決策」第 3 點）。

## 決策 (Decision)

1. `frontend/src/lib/quickGuestIdentity.ts`：新增 `quickGuestProfileChangedEvent`、`emitQuickGuestProfileChanged()`、`subscribeQuickGuestProfile(listener)`。在 `persistQuickGuestDisplayName`/`persistQuickGuestJobClassId`/`persistQuickGuestLevel` 三個底層 setter 的**每個分支**（含清除分支）都呼叫 `emitQuickGuestProfileChanged()`——刻意在最底層 setter 觸發，而非只在 `persistQuickGuestProfile` 觸發：`persistQuickGuestDisplayName` 還有其他獨立呼叫點（`FindPartyScreen.tsx`、`PartyDetailScreen.tsx`、`AppShell.tsx`、`claimGuestParties.ts`，走同一把 quick-party 名稱 key），這些呼叫點原本就有一模一樣的跨元件不同步問題，在底層修就順便一起修好。
2. `frontend/src/hooks/useQuickGuestProfile.ts`：訂閱 `subscribeQuickGuestProfile`，掛載時 `setTimeout(refresh, 0)` 讀一次，卸載時取消訂閱。額外回傳一個 `isHydrated: boolean`（初始 `false`，第一次讀取完成後翻 `true`），供 [ADR-0018](0018-create-party-desktop-wizard.md) 訪客 wizard「已有身分時自動跳過第一頁」判斷用。Hook 簽名從 `[profile, setProfile]` 擴充為 `[profile, setProfile, isHydrated]`；已 grep 確認全部既有呼叫點（`GuestCreatePartyScreen.tsx`、`PartyDetailScreen.tsx`）皆用陣列解構只取前兩個值，擴充後相容不受影響。
3. 新增 `frontend/src/hooks/useCloseOnOutsideClick.ts`：把 `Navbar.tsx` 既有「點外面關掉選單」的 effect 抽成共用 hook——新增訪客身分選單後同一份邏輯要用兩次（已登入使用者選單、訪客身分選單），依專案規範重複邏輯要封裝。
4. `frontend/src/components/shell/Navbar.tsx`：原本 `isAuthenticated ? 使用者選單 : 登入按鈕` 兩分支，改三分支：
   - `isAuthenticated` → 完全不動。
   - `!isAuthenticated && isCompleteQuickGuestProfile(guestProfile)` → 新的訪客身分藥丸，**直接沿用**（不新增樣式）`os-navbar__user-wrap`/`os-navbar__user-button`/`os-navbar__user-menu`/`os-navbar__user-menu-footer`/`os-nav-item` 這幾個既有 class，確保視覺與已登入使用者按鈕完全一致；下拉選單內容為「訪客身分」資訊列（頭像+姓名+職業+等級）+「編輯訪客身分」（開啟 `GuestProfilePrompt` dialog）+「登入帳號」（呼叫既有 `showLogin()`），不放角色切換清單、不放登出。
   - `!isAuthenticated && !isCompleteQuickGuestProfile(guestProfile)` → 維持現有純「登入」按鈕，不新增空狀態 UI。
   - 分支條件直接用 `isCompleteQuickGuestProfile(guestProfile)`（型別謂詞函式）而非另存一個 `hasGuestIdentity: boolean` 變數，讓 TypeScript 能在該分支內把 `guestProfile.jobClassId`/`level` 從 `number | null` 窄化為 `number`，不需要額外的非空斷言。
   - 新增 `GuestProfilePrompt`（`variant="dialog"`）渲染，`onSave` 呼叫 `setGuestProfile` 並關閉 dialog。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **維護性**：方案 2（延續既有 pattern）優於方案 1（改用更「現代」的 API）——因為本專案已經有兩個同構的 hook 作為先例，維護一致性比追求單一 hook 內部實作的理論最優解更重要。這與 [ADR-0016](0016-guest-party-entry-point-parity.md) 的一貫立場一致：優先選擇風險更低、與既有模式一致的封裝方式。
- **效能**：兩個方案在效能面向無實質差異（資料量小），非本次決策的區分因素。
- **安全性**：純前端 state 同步與 UI 呈現，無信任邊界變化。
- **Navbar 藥丸沿用已登入使用者選單的 class**：而非另開一套樣式——避免視覺語言分裂（訪客與登入使用者的帳號操作入口應該長得一樣，只是內容不同），也降低維護面積（樣式異動只需要改一處）。
- **「已有身分時自動跳過導覽第一頁」只在 hydrate 當下判斷一次**：避免「使用者在第一頁填完當下突然被推走」的意外感，也保留使用者可以按「上一步」回到第一頁檢視/修改身分——這是使用者體感層面的決策，記錄於此因為它與 `isHydrated` 旗標的設計目的直接相關。

## 被拒絕方案與原因 (Rejected Alternatives)

- **`useSyncExternalStore`（方案 1）**：技術上更「正確」，但與專案既有兩個同類 hook 的 pattern 不一致，維護一致性優先於單點的理論最優解，故不採用；若日後 `quickPartySession.ts`/`useQuickGuestPartySession.ts` 也要整體遷移到 `useSyncExternalStore`，應該三者一起做，不在本次單獨處理。

## 影響 (Consequences)

- **前端影響範圍**：`frontend/src/lib/quickGuestIdentity.ts`、`frontend/src/hooks/useQuickGuestProfile.ts`、`frontend/src/hooks/useCloseOnOutsideClick.ts`（新增）、`frontend/src/components/shell/Navbar.tsx`。無 API 契約變更、無新增依賴。
- **`persistQuickGuestProfile` 一次呼叫會觸發 3 次事件**：因為它依序呼叫三個底層 setter，每個 setter 都各自 emit 一次——這是刻意的權衡（見決策第 1 點），換取「在底層修一次、所有既有呼叫點一起受益」，代價是訂閱端會多收到 2 次冗餘通知（重新讀取 localStorage 並 `setState` 相同的最終值，非破壞性，只是略為浪費）。
- **測試**：`GuestCreatePartyScreen.tsx`、`PartyDetailScreen.tsx` 既有呼叫點的陣列解構相容，不需要修改；`Navbar.tsx`/`authControls.test.tsx` 既有測試在無訪客身分（預設 localStorage 清空）情境下行為不變（仍顯示「登入」按鈕）。

## Supersedes / Superseded by

不推翻任何既有 ADR；補齊 ADR-0015 訪客身分機制遺留的跨元件同步與 Navbar 呈現缺口。
