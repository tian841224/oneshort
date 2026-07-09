# ADR-0018: 建立隊伍桌機版改為分步 Step Wizard

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend / party
- 相關文件: docs/decisions/0015-guest-standard-immediate-party-interop.md（訪客建隊）

## 背景 (Context)

`/parties/create`（`CreatePartyScreen.tsx`）原本只有手機版走「①隊伍基本資料 ②加入規則 ③職缺設定」的分步 wizard（`useStepFlow` + `.os-mobile-wizard-footer`）；桌機版則是一次把「基本資料欄／規則欄／職缺欄／隊伍預覽」四個區塊全部攤開成 3 欄式版面（`os-create-party-layout` 3 columns），欄位一次全部可見。

這在欄位持續增加後（加入規則、職缺設定的選項越來越多）造成桌機版單頁資訊密度過高、掃視成本高，與 style.md 的「Linear meets MMORPG matchmaking」精簡調性不符；且欄位驗證錯誤發生時，使用者需要在很長的單頁裡自己找到出錯欄位。同時，手機版既有的欄位錯誤定位機制（`failField` → 切換 step → `scrollIntoView`）是寫死在 `CreatePartyScreen.tsx` 內、綁定 `isMobile` 的區域邏輯，訪客建隊畫面（`GuestCreatePartyScreen.tsx`，ADR-0015）需要同樣的欄位驗證/定位機制卻無法重用。

這屬於 `.agent/rules/core.md` §3.1 定義的修正方案評估適用範圍（版面重構 + 邏輯抽出）。

## 考慮過的方案 (Options Considered)

### 方案 1：桌機版維持單頁攤開，只做視覺分組（accordion / 摺疊卡片）收斂密度

- 不引入分步概念，改用可摺疊的區塊分組（如 `CollapsibleSection`）降低單頁資訊密度，欄位錯誤時展開對應區塊並捲動。
- **維護性**：中。不需要新增 step 狀態機，但「哪個區塊該展開」「摺疊狀態如何與驗證錯誤連動」仍需要額外狀態管理，且與手機版既有的 wizard 概念是兩套不同的心智模型，桌機/手機的欄位錯誤定位邏輯依然各自一份，無法共用。
- **效能**：與其他方案相同（純前端渲染切換）。
- **安全性**：無關。
- **代價**：桌機版與手機版維持兩套完全不同的導覽典範（摺疊 vs 分步），未來任一邊調整欄位分組都要分別改兩套邏輯，且沒有解決「訪客建隊畫面重複造一份驗證定位邏輯」的問題。

### 方案 2（採用）：桌機版也改為分步 wizard，抽出裝置無關的共用欄位錯誤/step 機制

- 桌機 `CreatePartyScreen.tsx` 改用與手機版相同的 `useStepFlow` 分步模型，但**只有 3 步**（基本資料／規則／職缺）——隊伍預覽（`PreviewColumn`）在桌機版不是一個獨立 step，而是常駐可見的第二欄（`.os-create-party-layout` 從 3 欄收斂成 2 欄：wizard 欄 + 常駐預覽欄），因為桌機版有足夠寬度讓使用者邊填邊即時看到隊伍組成，這正是桌機版相對手機版的既有優勢，不應該用分步把它藏起來。
- 新增純展示型 `CreatePartyWizardNav`（StepDots + 上一步/下一步按鈕），與手機版既有的 `.os-mobile-wizard-footer` 共用同一套視覺語言（同樣的 `StepDots`、`os-btn` 樣式），但元件本身不含任何 step 切換或驗證邏輯，只接收 `step`/`totalSteps`/`onBack`/`onNext` 呼叫。
- 把手機版原本寫死在 `CreatePartyScreen.tsx` 內的欄位錯誤/捲動定位邏輯抽成裝置無關的共用 hook `useWizardFieldErrors<TField>`（`step`/`setStep`/`fieldStepMap` 皆由呼叫端注入），讓桌機 wizard 與手機 wizard 共用同一套「填錯欄位 → 顯示 toast + inline 錯誤 → 切到對應 step → 捲動到該欄位」機制，不必再各自維護一份。
- `GuestCreatePartyScreen.tsx`（訪客建隊，ADR-0015）同步接上 `useWizardFieldErrors` + `CreatePartyWizardNav`，桌機版展開成 4 步（①你的隊長身分 ②隊伍基本資料 ③加入規則 ④職缺設定；訪客比一般使用者多一步身分收集），手機版維持原本的單頁全部展開（不分步）不變——訪客手機版原本就沒有 wizard chrome，這次沒有理由新增，改動範圍只鎖定桌機。
- **維護性**：最佳。欄位錯誤定位邏輯單一權威來源（`useWizardFieldErrors`），桌機/手機視覺上都是分步 wizard、共用同一套心智模型與 `StepDots`／按鈕樣式，日後新增欄位只需要決定它屬於哪個 step，不必再各自維護兩套「找出錯欄位」邏輯。
- **效能**：純前端 state/渲染切換，桌機版一次渲染的 DOM 節點數量反而下降（同一時間只掛載一個 step 的欄位），對長表單場景是效能改善而非負擔。
- **安全性**：無關（純 UI 呈現與表單驗證流程調整，不涉及權限或資料邊界）。
- **代價**：桌機版原本「所有欄位一眼可見、Ctrl+F 全部找得到」的攤平體驗改變為分步；但配合常駐預覽欄與 `StepDots` 進度指示，可讀性與掃視成本反而下降，符合 style.md 精簡調性。

## 決策 (Decision)

採用方案 2：

1. `src/hooks/useStepFlow.ts`（既有，原本只給手機版用）：不變，桌機版直接重用同一支 hook。
2. `src/hooks/useWizardFieldErrors.ts`（新增）：從 `CreatePartyScreen.tsx` 抽出的裝置無關欄位錯誤/捲動定位機制，`fieldErrors`/`setFieldErrors`/`clearFieldError`/`registerFieldRef`/`scrollToField`/`failField`，供桌機與手機共用。
3. `src/app/parties/create/_components/CreatePartyWizardNav.tsx`（新增）：純展示型 StepDots + 上一步/下一步導覽列，只給桌機版用（`!isMobile &&` 掛載）；`onNext` 在最後一步留空，因為送出交由常駐可見的 `PreviewColumn` 按鈕（或側欄擠窄時的 `.os-create-preview-bar`）負責，不是 wizard nav 的職責。
4. `CreatePartyScreen.tsx`：
   - `DESKTOP_WIZARD_STEP_COUNT = 3`（基本資料／規則／職缺），與手機版 `CREATE_PARTY_STEP_COUNT = 4`（多一步預覽）分開常數管理，因為兩者在桌機/手機下語意不同（見上）。
   - `.os-create-party-layout` 從 3 欄（`globals.css`）收斂為 2 欄：`minmax(0,1fr) minmax(240px,320px)`（wizard 欄 | 常駐預覽欄）。
   - 若視窗在 mobile→desktop 切換時 `step` 停在 4（僅手機合法），加一個 effect 把 `step` 夾回 `DESKTOP_WIZARD_STEP_COUNT`，避免桌機版 wizard 欄「整個空掉」（none of `showBasicCard`/`showRulesCard`/`showSlots` 為真）。
5. `GuestCreatePartyScreen.tsx`（ADR-0015）同步接上 `useWizardFieldErrors` + `CreatePartyWizardNav`，桌機 4 步、手機維持既有單頁攤平不變。
6. `tests/e2e/fixtures.ts` 的 `createPartyViaUi` 與 `guest-party-interop.e2e.ts`／`guild-management.e2e.ts` 既有 E2E 場景，改為明確依序點擊「下一步」推進桌機 wizard 各 step，不再假設所有欄位同時掛載於 DOM。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：與方案 1 無差異，非本次決策的區分因素。
- **維護性**：方案 2 把「欄位錯誤如何定位/捲動」這個原本只服務手機版的邏輯，重構為裝置無關的共用機制，同時服務桌機 wizard 與（現有和未來的）訪客 wizard，避免同一種邏輯在多處各自維護一份副本；`CreatePartyWizardNav` 刻意設計成純展示元件（不含驗證邏輯），維持單一職責，呼叫端仍完全掌控何時可以 `onNext`。
- **效能**：桌機版分步後單一時間點掛載的欄位數量下降，屬於效能上的正向副作用，非決策主因但也不是代價。
- **一致性**：桌機與手機統一採用「分步 + StepDots + 上一步/下一步」的心智模型，只在「隊伍預覽是否獨立成一個 step」這一點上依裝置寬度分流（桌機夠寬、常駐顯示更符合其優勢；手機把預覽當作第 4 步，因為單欄版面沒有多餘寬度同時顯示表單與預覽）。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 1（摺疊卡片收斂密度，不分步）**：沒有解決「訪客建隊畫面需要重造一份欄位驗證/捲動定位邏輯」的重複問題，且讓桌機/手機維持兩套不同的導覽心智模型，長期可維護性低於方案 2，故不採用。

## 影響 (Consequences)

- **前端影響範圍**：`CreatePartyScreen.tsx`、`GuestCreatePartyScreen.tsx`、新增 `CreatePartyWizardNav.tsx`、新增 `useWizardFieldErrors.ts`、`globals.css`（`.os-create-party-layout` 3 欄→2 欄）、`CreatePartyScreen.test.tsx`、`tests/e2e/fixtures.ts`、`tests/e2e/guest-party-interop.e2e.ts`、`tests/e2e/guild-management.e2e.ts`。無 API 契約變更、無新增依賴。
- **測試**：`CreatePartyScreen.test.tsx` 既有斷言改為先推進 wizard 到對應 step 再操作欄位；Playwright `createPartyViaUi` 與相關 E2E 場景同步改為顯式點擊「下一步」推進桌機 wizard。
- **已知後續（未在本次處理，記錄以避免遺失）**：
  1. 手機版走到 step4（隊伍預覽）時，桌機版沿用的 `.os-create-preview-panel` 欄位在 `@container shell-main (max-width: 899px)` 下會被隱藏，而手機版原本設計的替代方案 `.os-create-preview-bar` 又被 `!isMobile` 條件擋住——兩者交集導致手機 step4 內容區空白。此為本次桌機化重構遺留的手機端回歸，已由 [ADR-0020](0020-mobile-step4-preview-visibility.md) 修正。
  2. `GuestCreatePartyScreen.tsx` 手機版目前沒有分步 wizard（維持單頁攤平），與 `CreatePartyScreen.tsx` 手機版的 4 步 wizard 體驗不一致；若未來要統一，需要另外評估。
  3. **跨分支 ADR-0018 內容重複（待處理）**：`docs/create-party-desktop-wizard` 分支（commit e5d3fbc）針對同一支 `feature/create-party-desktop-wizard` 前端分支，獨立提交了另一版措辭與範圍都不同的 `0018-create-party-desktop-wizard.md`（未收斂桌機版基本資料／規則欄，維持 4 步；並記錄了 560px 表單寬度與訪客已存身分自動跳頁等本文未提及的細節）。兩分支合併進 develop 前需人工比對取捨；另外前端分支後續 commit `dc61592`（merge basic-info+rules step，訪客桌機版已改為 3 步）也尚未被任一版本記錄，屬於待補的後續決策缺口。

## Supersedes / Superseded by

不推翻任何既有 ADR；`.os-create-preview-panel`/`.os-create-preview-bar` 的手機端可見性缺口由 [ADR-0020](0020-mobile-step4-preview-visibility.md) 修正並補齊「已知後續」第 1 點。
