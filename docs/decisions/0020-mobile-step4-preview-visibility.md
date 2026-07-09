# ADR-0020: 手機版建立隊伍隊伍預覽（PreviewColumn）內容區空白 / 送出按鈕消失修復

- 狀態: Accepted
- 日期: 2026-07-09（2026-07-09 更新：擴充涵蓋訪客流程）
- 相關模組: frontend / party
- 相關文件: docs/decisions/0018-create-party-desktop-wizard.md

## 背景 (Context)

手機版 `/parties/create` 的 4 步驟 wizard 走到 Step4（隊伍預覽，`showPreview = isMobile ? step === 4 : true`）時，內容區完全空白，只剩頁首與底部固定的 `.os-mobile-wizard-footer`（StepDots + 上一步/建立隊伍按鈕）。

根因是 [ADR-0018](0018-create-party-desktop-wizard.md) 桌機化重構遺留的手機端回歸：`CreatePartyScreen.tsx` 不論桌機或手機，`showPreview` 為真時一律把 `PreviewColumn` 包在同一個 `.os-create-preview-panel` 內；`globals.css` 對這個 class 有一條 `@container shell-main (max-width: 899px) { .os-create-preview-panel { display: none; } }` 規則——這條規則的原意是「桌機視窗夠寬，但側欄展開把 `.shell-main` 容器擠窄到 899px 以下」的 fallback（此時改用 `.os-create-preview-bar` 底部摘要條），**不是**針對真手機視窗設計的。但 container query 只看容器寬度，不分辨「桌機側欄擠窄」與「手機本身視窗窄」這兩種情境是誰觸發的，所以在真手機（`isMobile === true`）上也一併命中，把 Step4 的內容整個藏起來。

雪上加霜的是替代方案 `.os-create-preview-bar` 的顯示邏輯寫在元件內是 `!isMobile && portalReady && createPortal(...)`——只服務「桌機側欄擠窄」情境，真手機同樣被排除在外。兩條路徑交集後，真手機走到 Step4 時沒有任何一條規則會顯示預覽內容，畫面呈現空白。

這屬於 `.agent/rules/core.md` §3.1 定義的修正方案評估適用範圍（CSS 選擇器與元件可見性邏輯的取捨）。

## 考慮過的方案 (Options Considered)

### 方案 1：把 `@container shell-main (max-width: 899px)` 規則也放行「真手機」情境

- 讓該規則的 `display: none` 只在「桌機側欄擠窄」時生效，真手機時改成顯示 `.os-create-preview-panel` 本身（不切到 bar），或是在該規則內針對 `isMobile` 加一個 JS 傳入的 `data-*` 旗標當作額外選擇器條件。
- **維護性**：差。Container query 天生只感知容器寬度，無法在 CSS 層原生分辨「桌機側欄擠窄」與「手機視窗窄」——這兩種情境目前唯一的分野點是 JS 算出的 `isMobile`（`useIsMobile(BP.bottomNav)`），若要讓 CSS 也認得這個區別，勢必要用 `data-*` 屬性把 JS 狀態注入 DOM 讓 CSS 選取，形同繞了一圈又把「顯示與否」的決策權混合在 CSS 條件與 JS 狀態兩處，日後任一處改動都要同步檢查另一處，違反「單一權威來源」。
- **效能**：與其他方案相同（純 CSS 條件判斷），非決定因素。
- **安全性**：無關。
- **代價**：`.os-create-preview-panel` 與 `@container shell-main` 這組桌機側欄 fallback 邏輯本身要被改動，即使改動看似小，仍然觸碰到「桌機行為零風險」這條線——任何在共用選擇器上動手腳都有機會意外影響桌機側欄擠窄情境的既有行為，回歸測試面必須同時涵蓋桌機與手機。

### 方案 2：讓 `.os-create-preview-bar` 也服務真手機（拿掉 `!isMobile` 限制）

- Step4 沿用桌機側欄擠窄的 fallback bar，不新增手機專屬 wrapper。
- **維護性**：中。`.os-create-preview-bar` 目前的設計語意是「摘要條」（標題 + 人數 + 一顆按鈕），資訊密度遠低於完整的 `PreviewColumn`（含 BOSS/地圖縮圖、規則 pill、逐格職缺清單）——若要讓它在手機 Step4 也顯示完整隊伍組成，需要大幅擴充這個元件的內容，等於是把 `PreviewColumn` 的內容重新塞進一個原本設計成「窄摘要」的容器，變成兩套元件表達同一份資料，重複邏輯難以封裝。
- **效能**：與其他方案相同。
- **安全性**：無關。
- **代價**：驗收清單 A1 要求「手機三種寬度下 Step4 顯示完整隊伍預覽內容⋯欄位數量與內容與桌機版 `.os-create-preview-panel` 呈現的一致」——`.os-create-preview-bar` 目前的摘要式設計無法一步到位滿足這個要求，除非做上述的大幅擴充，風險與工作量都高於方案 3。

### 方案 3（採用）：手機 Step4 改用獨立的 wrapper class，顯示邏輯完全交回既有 JS `step` 狀態

- `CreatePartyScreen.tsx` 的 `showPreview` 區塊，依 `isMobile` 分流包裹 class：手機用新的 `.os-create-mobile-step-preview`，桌機沿用既有 `.os-create-preview-panel` 不變。新 class 不掛任何 `@container`/`@media display:none` 規則，可見性完全由既有的 `showPreview`/`step` JS 條件決定（與 Step1–3 同一套 pattern：`showBasicCard`/`showRulesCard`/`showSlots` 也都是純 JS 條件閘門，沒有額外的 CSS 隱藏規則疊加）。
- `.os-create-preview-panel`／`.os-create-preview-bar`／`@container shell-main (max-width: 899px)` 三條規則完全不動——桌機「常駐兩欄 + 899px 側欄擠窄 fallback」的既有行為零風險。
- 連帶修正：兩個 wrapper 底下渲染的都是同一個 `PreviewColumn`，內容視覺（卡片、padding、圖片）自動與桌機版一致（來自 `PreviewColumn` 自己的 `.os-create-preview` 內部樣式，不受外層 wrapper class 影響），不需要另外複製一套視覺樣式。
- 副作用：`PreviewColumn` 內建的「建立隊伍」按鈕在手機 Step4 情境下會與底部固定 `.os-mobile-wizard-footer` 的「建立隊伍」按鈕重複顯示——新增 `hideSubmitButton?: boolean` prop，手機 Step4 呼叫端傳 `true`；桌機與 `.os-create-preview-bar`（有自己獨立的按鈕）情境不受影響，維持不傳（預設 `false`，顯示按鈕）。
- **維護性**：最佳。可見性決策權完全收斂回單一位置（`CreatePartyScreen.tsx` 的 `showPreview`/`isMobile` 條件），css class 純粹是「掛哪個視覺容器」的標記，不承擔「要不要顯示」的判斷責任，符合「單一權威來源」；`.os-create-mobile-step-preview` 本身不需要任何新樣式（`PreviewColumn` 已經是自帶完整卡片樣式的元件），避免了方案 2 的重複視覺邏輯。
- **效能**：純前端條件渲染與 class 切換，可忽略不計。
- **安全性**：無關（純 UI 呈現）。
- **代價**：多一個 CSS class 需要記住命名慣例（`os-create-mobile-step-preview`），但這是可接受的最小成本。

## 決策 (Decision)

採用方案 3：

1. `src/app/globals.css`：新增 `.os-create-mobile-step-preview { display: block; }`（僅供文件性標記，實際可見性由 JS 控制），緊接在既有 `.os-create-preview-panel`／`.os-create-preview-bar`／`@container shell-main` 區塊之後，並加註解說明與該區塊的關係（不修改該區塊本身任何一行）。
2. `src/app/parties/create/_components/CreatePartyScreen.tsx`：
   - `showPreview` 區塊的 wrapper class 依 `isMobile` 分流：`isMobile ? "os-create-mobile-step-preview" : "os-create-preview-panel"`。
   - 傳入 `PreviewColumn` 新增 `hideSubmitButton={isMobile}`。
   - 額外修正：`.os-create-party-wizard`（wizard 欄，含 `BasicInfoColumn`/`SlotsColumn`/`CreatePartyWizardNav`）在手機 Step4 時不再掛載——原本這個欄位在 Step4 一定是空的（三個 `show*Card`/`showSlots` 條件與 `!isMobile` 的 `CreatePartyWizardNav` 全部為假），未修正前因為預覽面板整個隱藏、使用者看不到這段空白，修正後預覽面板顯示了，若不順手處理會在預覽內容上方多出一段 `.os-create-party-layout` 的 24px grid gap 空隙。
3. `src/app/parties/create/_components/PreviewColumn.tsx`：新增 `hideSubmitButton?: boolean`（預設 `false`），為真時不渲染內建的「建立隊伍」按鈕。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：三方案在此面向無差異，非本次決策的區分因素。
- **維護性**：方案 3 把「顯示與否」的決策權收斂到單一位置（既有的 JS step 狀態，與 Step1–3 用同一套模式），比方案 1（把 JS 狀態透過 `data-*` 混進 CSS 條件、產生雙重權威）與方案 2（在窄摘要元件裡塞入完整預覽內容、產生重複視覺邏輯）都更乾淨；且完全不觸碰 `.os-create-preview-panel`／`@container shell-main` 這組桌機共用規則，把回歸風險完全限制在「新增的手機專屬路徑」，不需要重新驗證桌機側欄擠窄的既有行為。
- **效能**：三方案在此面向無差異。
- **一致性**：手機 Step4 的可見性判斷方式（純 JS 條件，無 CSS 隱藏規則疊加）與 Step1–3 完全一致，維持整個 wizard 單一套心智模型。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 1（改動 `@container shell-main` 規則本身，用 `data-*` 讓 CSS 感知 `isMobile`）**：把可見性判斷拆成 CSS 條件 + JS 狀態雙重來源，且直接觸碰「桌機行為零風險」的共用規則，回歸驗證面必須同時涵蓋桌機側欄擠窄與手機兩種情境，成本與風險都高於方案 3，不採用。
- **方案 2（讓 `.os-create-preview-bar` 服務真手機、擴充其內容）**：`.os-create-preview-bar` 的既有設計語意是窄摘要條，要塞入驗收要求的「完整隊伍預覽內容（欄位數量與桌機版一致）」需要大幅擴充，等同重造一份與 `PreviewColumn` 重疊的內容渲染邏輯，違反「重複邏輯必須封裝」，不採用。

## 後續更新（2026-07-09）：訪客流程有同一根因、更嚴重的缺陷

Reviewer 在第 1 輪審查中發現：上面決議的修法只處理了**已登入使用者**的 `CreatePartyScreen.tsx`。`GuestCreatePartyScreen.tsx`（訪客建立隊伍）存在同一根因、但後果更嚴重的缺陷：

- `GuestCreatePartyScreen.tsx` 把 `PreviewColumn` **無條件**包在 `.os-create-preview-panel` 內（原本完全沒有 `isMobile` 分流），一樣被 `@container shell-main (max-width: 899px) { .os-create-preview-panel { display: none; } }` 這條共用規則命中，在真手機上整個隱藏。
- **關鍵差異**：訪客流程在手機版沒有「step wizard」概念——`showIdentity`/`showBasicCard`/`showRulesCard`/`showSlots` 全部是 `isMobile || step === n`，代表手機版是「單頁連續捲動」佈局，所有卡片（含隊長身分、基本資料、加入規則、職缺、預覽）一次全部顯示，不像已登入流程的 4 步驟分頁。也因為如此，訪客流程**完全沒有** `.os-mobile-wizard-footer` 這種獨立底部固定按鈕（整份檔案唯一引用 `handleSubmit` 的地方就是 `PreviewColumn` 的 `onSubmit`）。
- 結論：訪客在真實手機（<900px）上，`.os-create-preview-panel` 被隱藏 = 連「建立隊伍」按鈕都看不到，**完全無法送出表單**——這比已登入流程原本的「Step4 畫面空白但按鈕還在底部」更嚴重，是功能完全不可用。
- 未被既有測試發現：`guest-party-interop.e2e.ts` 先前沒有任何 `setViewportSize` 呼叫，一律跑在桌機 viewport，從未實際測過訪客手機窄寬情境。

### 是否為同一方案的延伸，或需要重新評估

沿用上面方案 3 的核心思路（獨立 wrapper class、可見性完全交回既有 JS 條件），因為根因與資料流完全相同（`.os-create-preview-panel` 被同一條共用 CSS 規則命中）。差異只在**要不要傳 `hideSubmitButton`**：

- 已登入流程：手機 Step4 的預覽面板與底部固定 `.os-mobile-wizard-footer` 的按鈕會重複，所以要 `hideSubmitButton={isMobile}`。
- 訪客流程：手機版預覽面板**一律顯示**（不是某個 step 才顯示），且整個畫面**沒有其他地方**放了「建立隊伍」按鈕——`PreviewColumn` 內建的按鈕是唯一的送出控制項。因此**不能**傳 `hideSubmitButton`，維持預設 `false`（顯示按鈕）。

不需要重新評估三方案；這是同一決策在第二個消費端的延伸套用，只是依各自消費端的實際佈局差異決定 `hideSubmitButton` 的傳值。

### 追加修改

4. `src/app/parties/create/_components/GuestCreatePartyScreen.tsx`：`PreviewColumn` 的 wrapper class 比照 `CreatePartyScreen.tsx` 依 `isMobile` 分流為 `isMobile ? "os-create-mobile-step-preview" : "os-create-preview-panel"`；**不**傳 `hideSubmitButton`（理由見上）。訪客流程手機版的 wizard 欄（`.os-create-party-wizard`）本來就一律掛載（沒有「Step4 才隱藏」的情境），不需要比照 `CreatePartyScreen.tsx` 額外做「避免空欄位」的修正。
5. `src/app/globals.css`：`.os-create-mobile-step-preview` 上方註解更新為說明它現在由兩個元件共用（已登入 step4-only / 訪客 always-visible 兩種可見性模式），既有 `display: block` 規則不變。
6. `src/app/parties/create/_components/PreviewColumn.tsx`：`hideSubmitButton` 的 doc comment 更新，補上訪客流程「沒有自己的固定 footer、內建按鈕是唯一送出控制項」的說明。

## 影響 (Consequences)

- **前端影響範圍**：`CreatePartyScreen.tsx`、`GuestCreatePartyScreen.tsx`、`globals.css`（僅新增/更新註解，既有規則不動）、`PreviewColumn.tsx`（僅更新 doc comment，行為不變）。無 API 契約變更、無新增依賴、無 DB/schema 變動。
- **測試**：
  - `PreviewColumn.test.tsx` 既有 `hideSubmitButton` 預設顯示／設定後隱藏兩案例維持不變（訪客流程不傳這個 prop，沿用預設值路徑，既有案例已涵蓋）。
  - `tests/e2e/mobile-layout.e2e.ts` 新增 `create-party mobile step4 shows the team preview with a single submit button (ADR-0020) @mobile-smoke`：以 375/390/430 三種手機寬度走完整個 wizard 到 Step4，斷言 `.os-create-mobile-step-preview` 可見且內容與填寫資料一致、畫面上只有一顆「建立隊伍」按鈕、點擊後能成功建立隊伍並導頁。
  - `tests/e2e/mobile-layout.e2e.ts` 新增 `guest create-party mobile view shows the preview panel with a working submit button (ADR-0020 guest coverage) @mobile-smoke`：以 375/390/430 三種手機寬度各自用一個全新的訪客 context（獨立 `quick_guest_token` cookie）填完隊長身分、隊伍類型/目標/標題/頻道，斷言 `.os-create-mobile-step-preview` 可見、預覽內容與填寫資料一致、畫面上只有一顆「建立隊伍」按鈕，點擊後能成功建立隊伍並導頁。**用獨立 context 而非重複使用同一個訪客頁面跑 3 次迴圈**，是因為後端 `usecase_guest_party.go` 的 Redis 鎖強制「同一訪客同時只能有一個進行中的即時活動」，同一 cookie 建立第二個隊伍會回 409，與本測試要驗證的 bug 無關，故隔離之。
  - 兩則測試已在本機以 `node scripts/e2e-local.mjs -- --project=chromium --grep "ADR-0020"`（隔離 docker Postgres/Redis + 真實 Go backend + Next dev）驗證通過（2 passed）；另外重跑 `guest-party-interop.e2e.ts` 全部既有案例（桌機 viewport）確認無回歸（5 passed）。
  - `npx tsc --noEmit` 與既有前端單元測試套件（`src/app/parties/create` 下 5 個測試檔、33 案例）皆通過。
- **回滾難度**：低。全部改動都是新增條件分支/新 class 套用/註解更新，沒有觸碰既有共用規則、既有 API 或既有元件的預設行為，`git revert` 即可完整回滾，不殘留資料、不影響線上使用者。

## Supersedes / Superseded by

不推翻任何既有 ADR；修正 [ADR-0018](0018-create-party-desktop-wizard.md)「已知後續」第 1 點記錄的手機端回歸缺口，並已回頭在該 ADR 補上指向本 ADR 的註記。本 ADR 於 2026-07-09 追加訪客流程的同根因修復，屬於同一決策的延伸套用，不另立新 ADR。
