# ADR-0022: 訪客建立隊伍畫面新增手機版 step wizard 送出入口

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend-rwd / party / auth
- 相關文件: docs/decisions/0014-guest-party-interop-frontend-ui.md, docs/decisions/0015-guest-standard-immediate-party-interop.md, docs/decisions/0016-guest-party-entry-point-parity.md
- **編號變更記錄**：原編號 ADR-0017，因與另一支同源分支（`docs/guest-party-followup-bugfixes`）已合併進 backend `develop` 的 `0017-job-classes-seed-cleanup.md`（不同主題，純屬同批分叉獨立搶號）撞號，且該側已在 `backend/migrations/0047_prune_stale_job_classes.up.sql` 的 3 處註解中硬編碼引用 `ADR-0017`（已合併入 backend develop，改動成本遠高於本文件），故本文件改編號為 ADR-0022；`GuestCreatePartyScreen.tsx`（分支 `fix/guest-mobile-create-submit`）內 3 處 `ADR-0017` 註解已同步更新為 `ADR-0022`。

## 背景 (Context)

`GuestCreatePartyScreen.tsx`（訪客/未登入建立隊伍畫面）在手機寬度（`@container shell-main (max-width: 899px)`）下完全沒有可觸及的送出按鈕，且此問題在 `develop` 分支上早已存在，不是任何最近改動造成的迴歸：

- 桌面版是單一 3 欄 grid（身分卡+`BasicInfoColumn` | `SlotsColumn` | `PreviewColumn`），完全沒有 `useIsMobile`/`useStepFlow`。
- 手機寬度純靠 CSS `@container shell-main (max-width: 899px)` 把 3 欄收成單欄捲動，但同一條規則也把 `.os-create-preview-panel`（`PreviewColumn` 所在、唯一的送出按鈕）設為 `display:none`。
- 結果：手機版訪客永遠看不到、按不到送出按鈕，無法完成建立隊伍。

同目錄 `CreatePartyScreen.tsx`（登入版）在 `develop` 上已經有完整、經多輪 RWD 硬化過的手機 wizard 機制可以直接參考：`useIsMobile(BP.bottomNav)` + `useStepFlow(4)` 把內容切成逐步顯示（`!isMobile || step === N` gating），並用 `createPortal` 把兩種固定底部列掛到 `document.body`——`.os-create-preview-bar`（桌面容器變窄的直接送出 fallback）與 `.os-mobile-wizard-footer`（真手機視窗的 StepDots + 上一步/下一步/建立隊伍）。這兩組 class 是全域共用、非元件專屬的既有 CSS，不需要新增或修改任何樣式。

### 與另一份未合併決策的關係（`feature/create-party-desktop-wizard` 分支的 ADR-0018 草稿）

另一個尚未合併的分支（`feature/create-party-desktop-wizard`，對應的 ADR 草稿 `0018-create-party-desktop-wizard.md` 目前位於 `oneshort-worktrees/docs-create-party-desktop-wizard` worktree，未進入 `develop`）也修改了 `GuestCreatePartyScreen.tsx`，替它新增了桌面版 4 步 wizard。該草稿在「決策」與「影響」段落明確記錄：「訪客版手機邏輯刻意維持 `isMobile ||` 恆真，不新增 wizard chrome」「手機版零回歸風險」——也就是明確決定**不**修這個 bug，理由是那次改動的範圍刻意限縮在桌面版。

本 ADR **不推翻** 0018 草稿對桌面版分頁方式的決策（雙方對桌面版的處理方式相容：`!isMobile || step === N` 在桌面永遠恆真，兩邊實作等價）。但本 ADR 的決策範圍涵蓋 0018 草稿明確排除的手機版部分，屬於同一份決策空間裡的補充/延伸：**手機版訪客建立隊伍缺乏可觸及的送出入口是一個真實回報的使用者無法完成核心操作的 bug，不應無限期擱置**。若 `feature/create-party-desktop-wizard` 先於本次修法合併，或本次修法先合併，合併方需要對照兩邊 `GuestCreatePartyScreen.tsx` 的改動手動整合（保留桌面 4 步 wizard + 手機 4 步 wizard 兩者），並在合併時重新確認手機版送出按鈕的可達性沒有被對方版本沖掉。

## 考慮過的方案 (Options Considered)

### 方案 1：純 CSS 修正（讓 `.os-create-preview-panel` 在窄容器下改用 sticky/fixed 定位而非 `display:none`）

- 不動 JS 邏輯，只改 CSS 讓預覽欄位在手機版變成可捲動到底部但仍可見的區塊。
- **維護性**：改動面最小。
- **安全性/效能**：無差異。
- **代價**：治標不治本——訪客仍然要捲過身分卡、基本資料、規則、職缺設定四個區塊全部堆疊在一起的超長單頁才能看到送出按鈕；且未解決本頁本就該依 `frontend-rwd-uiux-standards` §6 資訊架構判準拆成分步驟表單的問題（4 種性質不同的資訊群組堆在同一個捲動頁面，屬於該規範明確建議改用 Step Wizard 的情境）。**否決**：只解決「按鈕看不看得到」的表面症狀，沒有解決底層資訊架構問題，且與同一產品內 `CreatePartyScreen.tsx` 已採用的模式不一致，造成兩個高度相似畫面的手機體驗有落差。

### 方案 2：抽出共用的 `MobileWizardFooter`/`DesktopNarrowPreviewBar` 元件，`CreatePartyScreen.tsx` 與 `GuestCreatePartyScreen.tsx` 都改用它

- 徹底消滅兩個畫面之間即將出現的 footer/bar JSX 重複（約 60 行）。
- **維護性**：形式上最佳。
- **代價**：`CreatePartyScreen.tsx` 目前正被另一個未合併分支 `feature/create-party-desktop-wizard` 同步修改（新增桌面 wizard、`useWizardFieldErrors`、`CreatePartyWizardNav`），若本次也去改動 `CreatePartyScreen.tsx` 抽共用元件，會直接增加與該分支的衝突面，且該分支目前的 `CreatePartyScreen.tsx` 內容與 `develop` 差異已經很大，難以確保抽出的共用元件在對方分支合併後仍然適用。**否決（列為 follow-up）**：本次範圍只鎖定在完全不會被對方分支觸碰的 `GuestCreatePartyScreen.tsx`，抽共用元件延後到 `feature/create-party-desktop-wizard` 合併之後、`CreatePartyScreen.tsx` 狀態穩定下來再評估。

### 方案 3（採用）：比照 `CreatePartyScreen.tsx`（develop 版）既有的 `useIsMobile`+`useStepFlow`+`createPortal` 手機 wizard 模式，直接在 `GuestCreatePartyScreen.tsx` 內實作一份等效邏輯（不抽共用元件）

- `GuestCreatePartyScreen.tsx` 新增 `useIsMobile(BP.bottomNav)` + `useStepFlow(4)`，四個內容區塊（身分卡／`BasicInfoColumn`-basic／`BasicInfoColumn`-rules／`SlotsColumn`）以 `!isMobile || step === N` gating；`PreviewColumn` 維持無條件掛載（沒有獨立的「預覽」步驟，跟登入版不同——訪客版第 4 步就是 `SlotsColumn`，送出鈕由 footer 的「建立隊伍」按鈕負責）。
- 新增 `goToStep2Guest`/`goToStep3Guest` 兩個前進前的驗證（沿用既有 `showToast`/`getPartyChannelError`，不新增 inline fieldErrors 系統——訪客畫面本來就是純 toast 驗證風格，維持一致）。
- 新增兩個 `createPortal` 到 `document.body` 的固定列：`.os-create-preview-bar`（桌面窄容器 fallback）與 `.os-mobile-wizard-footer`（真手機 StepDots + 上一步/下一步/建立隊伍）——完全重用既有全域 CSS class，未新增或修改任何樣式。
- **維護性**：與 `CreatePartyScreen.tsx` 的 footer/bar JSX 有重複（見「被拒絕方案」方案 2 的討論），但只觸碰 `GuestCreatePartyScreen.tsx` 一個檔案，零觸碰任何被其他未合併分支同步修改的檔案，衝突面最小。
- **安全性**：純前端 UI 邏輯，無信任邊界變化。
- **效能**：與其他方案無差異。
- **回滾難度**：低——所有新增邏輯集中在單一元件內，回滾只需還原這一個檔案。

## 決策 (Decision)

採用方案 3：

1. `src/app/parties/create/_components/GuestCreatePartyScreen.tsx`：新增 `GUEST_CREATE_PARTY_STEP_COUNT = 4`、`useIsMobile`/`useStepFlow`/`portalReady` 狀態、`showIdentity`/`showBasicCard`/`showRulesCard`/`showSlots` gating、`goToStep2Guest`/`goToStep3Guest`、`filledPreviewCount`，以及兩個 `createPortal` 固定列（`.os-create-preview-bar`、`.os-mobile-wizard-footer`）。
2. 不修改 `globals.css`（沿用既有 class）、不修改 `CreatePartyScreen.tsx`、不修改 `BasicInfoColumn.tsx`（`section` prop 已存在）。
3. 新增 `GuestCreatePartyScreen.test.tsx`（桌面零回歸、手機四步驟驗證擋下、手機四步驟走完送出三案例）；`tests/e2e/guest-party-interop.e2e.ts` 新增 390×844 viewport 的完整訪客建隊 e2e 案例。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：純前端 UI 邏輯變更，`handleSubmit` 呼叫的 API payload 與驗證規則完全不變，無新增攻擊面。
- **維護性**：在「解決真實回報的使用者無法完成核心操作的 bug」與「消滅跨檔案重複」之間，優先選擇不觸碰另一個未合併分支正在改動的檔案——降低合併衝突與回歸風險，比形式上的零重複更重要（與 core.md §3.1「安全性/風險優先於維護性形式一致」的既有判斷原則一致，ADR-0016 方案 3 已採用同樣的排序邏輯）。跨元件共用 footer/bar 元件列為 follow-up，待 `feature/create-party-desktop-wizard` 合併、`CreatePartyScreen.tsx` 狀態穩定後再評估（見「已知後續」）。
- **效能**：三個方案無實質差異，非本次決策的區分因素。
- **與既有規範一致**：`frontend-rwd-uiux-standards` §6 資訊架構判準——本頁本就有身分/基本資料/規則/職缺 4 種性質不同的資訊群組，適合改用 Step Wizard，且 `CreatePartyScreen.tsx` 已對相同的資訊架構做出同樣判斷，本次只是把訪客版補齊到同一個標準。

## 被拒絕方案與原因 (Rejected Alternatives)

- **純 CSS 修正（方案 1）**：只解決按鈕可見性的表面症狀，未解決底層資訊架構問題，且讓訪客版與登入版的手機體驗產生不必要的落差。
- **抽出共用 footer/bar 元件（方案 2）**：形式上維護性最佳，但需要同時觸碰正被另一個未合併分支修改的 `CreatePartyScreen.tsx`，衝突面與回歸風險不成比例地升高；列為 follow-up，非本次否決其價值，只是延後時機。

## 影響 (Consequences)

- **前端影響範圍**：僅 `src/app/parties/create/_components/GuestCreatePartyScreen.tsx`（新增邏輯）、`GuestCreatePartyScreen.test.tsx`（新增）、`tests/e2e/guest-party-interop.e2e.ts`（新增案例）。無 API 契約變更、無新增依賴、無 DB/migration 異動。
- **手機版零回歸範圍外的例外**：這正是本次修法的目的——手機版訪客建立隊伍原本完全無法送出，本次改動是修復而非引入新行為；桌面版（`isMobile===false`）行為完全零回歸（四區塊同時顯示，與修改前一致）。
- **已知重複（未在本次處理，記錄以避免遺失）**：`CreatePartyScreen.tsx` 與 `GuestCreatePartyScreen.tsx` 的手機 wizard footer + 桌面窄容器 fallback bar 這兩段 `createPortal` JSX 現在幾乎逐行相同（約 60 行）。待 `feature/create-party-desktop-wizard` 合併回 `develop`、`CreatePartyScreen.tsx` 狀態穩定後，應評估抽出共用元件（例如 `MobileWizardFooter`/`DesktopNarrowPreviewBar`），讓兩個畫面都改用它，消滅這份重複。
- **已知後續（未在本次處理，記錄以避免遺失）**：
  1. 合併 `feature/create-party-desktop-wizard`（或其對應的 ADR-0018 若之後進入 `develop`）時，需要手動整合兩邊對 `GuestCreatePartyScreen.tsx` 的改動（桌面 4 步 wizard + 本 ADR 的手機 4 步 wizard），並重新驗證手機版送出按鈕可達性未被沖掉。
  2. `.os-create-preview-panel` 內的 `PreviewColumn`（含其自身送出按鈕）目前在所有 4 個 step 都無條件掛載，純靠既有 CSS 隱藏；建議未來补一個 Playwright 斷言直接驗證手機寬度下這顆內建按鈕確實不可見/不可點擊，把目前只靠註解宣稱的假設變成可驗證的迴歸防線。

## Supersedes / Superseded by

不推翻任何已合併入 `develop` 的既有 ADR。與尚未合併的 `feature/create-party-desktop-wizard` 分支之 ADR-0018 草稿在「訪客手機版是否新增 wizard chrome」這個子決策點上方向不同（0018 草稿決定不修、本 ADR 決定修），兩者合併時需要人工整合，見上方「與另一份未合併決策的關係」與「已知後續第 1 點」。
