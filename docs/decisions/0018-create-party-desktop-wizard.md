# ADR-0018: 桌面版建立隊伍改為導覽式 wizard（`.os-create-party-layout` 三欄變兩欄）

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend-rwd / party
- 相關文件: docs/decisions/0016-guest-party-entry-point-parity.md, docs/decisions/0015-guest-standard-immediate-party-interop.md

## 背景 (Context)

`/parties/create` 桌面版原本是三欄一次全顯（隊伍基本資料+加入規則 | 職缺設定 | 隊伍預覽）：`CreatePartyScreen.tsx`（登入版）用 `!isMobile || step === N` 的 gating 讓桌面版繞過分頁機制，`GuestCreatePartyScreen.tsx`（訪客版）則完全沒有 wizard，三欄（身分卡+基本資料 | 職缺 | 預覽）直接全顯。手機版已有一套完整的 4 步驟導覽 wizard（`useStepFlow` + `StepDots` + `useWizardFieldErrors` 前身的逐欄位驗證邏輯）。

使用者要求桌面版左側輸入區也改成「填完一段、按下一步、換下一段」的導覽模式，右側預覽維持現狀（常駐、即時更新、不分頁）。這牽涉：

1. `CreatePartyScreen.tsx` 現有的 `fieldErrors`/`fieldRefs`/`pendingScrollField`/`scrollToField`/`failField` 邏輯目前寫死在單一元件內，且 `scrollToField` 對 `isMobile` 有分支判斷（僅手機才切步驟）——桌面 wizard 上線後這個判斷必須拿掉，兩個畫面（登入版、訪客版）都需要共用同一套機制。
2. `.os-create-party-layout` 的 grid 欄位數需要從 3 欄變 2 欄（wizard 欄｜預覽欄）。

## 考慮過的方案 (Options Considered)

### 方案 1：只加桌面 CSS/JS gating，不抽共用 hook（各自複製一份 wizard 邏輯到兩個畫面）

- `CreatePartyScreen.tsx` 拿掉 `isMobile` 分支即可讓桌面吃到既有分頁機制；`GuestCreatePartyScreen.tsx` 則在檔案內部另外複製一份 `fieldErrors`/`scrollToField`/`failField` state 機器。
- **維護性**：差。兩份幾乎相同的 state machine 分散在兩個檔案，未來欄位驗證規則調整（例如新增欄位、改變錯誤訊息時機）需要同步修改兩處，容易漂移（本專案已在 ADR-0016 因類似「同一邏輯多處拷貝」踩過坑）。
- **效能**：與其他方案相同（純前端 state 操作），非決定因素。
- **安全性**：無差異（純 UI 驗證，不涉及信任邊界）。
- **回滾難度**：低，但不是本次評估重點。

### 方案 2：抽出一個吃掉全部驗證邏輯的巨型共用 hook（含 handleSubmit 的完整欄位驗證規則）

- 把 `goToStep2`/`goToStep4`/`handleSubmit` 內所有欄位檢查邏輯（type/target/channel/schedule/leaderCharacter/slots）都收進同一個共用 hook，登入版與訪客版都呼叫它，內部用 flag 區分兩種模式（例如 `hideSchedule`、`hasCharacterPicker`）。
- **維護性**：形式上「完全不重複」，但登入版與訪客版的驗證欄位本質不同——登入版有 `leaderCharacter`（選角色）、訪客版有 `identity`（訪客身分卡，且欄位對應到不同 step 編號：登入版 3 步、訪客版 4 步），若硬塞進同一個 hook，會產生大量 `if (isGuest) {...} else {...}` 分支，本質上只是把「重複的驗證邏輯」換成「集中的條件地獄」，並未真的降低耦合——這正是 [ADR-0016](0016-guest-party-entry-point-parity.md) 明確評估並避開過的 leaky abstraction 模式（該 ADR 拒絕了「抽出共用互動 hook」方案，理由是訪客申請與登入申請的互動狀態機本質不同，硬共用會提高回歸風險）。
- **效能**：與其他方案相同。
- **安全性**：與其他方案相同，前提是條件分支沒有遺漏——但條件越多，遺漏風險越高。
- **回滾難度**：中（一旦兩個畫面都依賴同一個巨型 hook，未來要拆開需要同時改動兩個呼叫點）。

### 方案 3（採用）：只抽出「欄位錯誤 + 捲動導覽」這個純機制的共用 hook（`useWizardFieldErrors`）與純展示型導覽列元件（`CreatePartyWizardNav`），驗證邏輯（哪個欄位何時檢查、檢查什麼）留在各自畫面

- `useWizardFieldErrors<TField>({ step, setStep, fieldStepMap })` 只負責「記錄某欄位的錯誤訊息」「捲動到該欄位」「切換到該欄位所在的 step」這三件事，欄位名稱是泛型參數（`CreatePartyFieldName` for 登入版、新增的 `CreatePartyGuestFieldName` for 訪客版），完全不知道「這個欄位具體要檢查什麼規則」。
- `CreatePartyWizardNav({ step, totalSteps, onBack, onNext?, nextDisabled?, nextLabel? })` 是純展示元件，只負責畫 StepDots + 上一步/下一步按鈕，`onNext` 由呼叫端自己組裝（登入版的 `goToStep2`/`next`、訪客版的 `goToStep2Guest`/`goToStep3Guest`/`next`），驗證規則差異完全留在各自元件內，不進共用層。
- **關鍵改動**：拿掉 `scrollToField` 對 `isMobile` 的判斷，改成無條件 `if (step !== targetStep) setStep(targetStep)`——這個判斷過去只因為桌面版不分頁才需要跳過，現在桌面版也分頁了，判斷必須對兩種裝置一致生效，所以這個 hook 完全不需要 `isMobile` 參數。
- **維護性**：欄位驗證規則（方案 2 想集中的部分）留在各自畫面，符合「登入版與訪客版驗證欄位本質不同」的事實，不製造虛假的共用；「捲動+切步驟」這個純機制部分（真正跨兩個畫面完全一致的部分）確實只有一份實作。
- **效能**：與其他方案相同。
- **安全性**：與其他方案相同；且因為驗證邏輯保留在各自畫面、沒有新增條件分支，不會意外遺漏或混淆兩種流程的驗證規則。
- **回滾難度**：低——`useWizardFieldErrors`/`CreatePartyWizardNav` 都是新增檔案，若要回滾只需要讓兩個畫面各自 inline 回原本的邏輯，不影響其他模組。

## 決策 (Decision)

採用方案 3：

1. 新增 `frontend/src/hooks/useWizardFieldErrors.ts`：泛型欄位錯誤 + 捲動導覽 hook，回傳 `{ fieldErrors, setFieldErrors, clearFieldError, registerFieldRef, scrollToField, failField }`；`scrollToField` 無條件切換 step（不分裝置）。
2. 新增 `frontend/src/app/parties/create/_components/CreatePartyWizardNav.tsx`：純展示型桌面導覽列，複用既有 `StepDots` + `.os-btn` class；最後一步不傳 `onNext`（不渲染下一步按鈕），因為預覽/送出永遠是 `PreviewColumn` 自己的按鈕或既有的 `.os-create-preview-bar` 負責。
3. `CreatePartyScreen.tsx`（登入版）：`showBasicCard`/`showRulesCard`/`showSlots` 三個 gating 拿掉 `!isMobile ||`，改成純 `step === N`；`showPreview` 改成 `isMobile ? step === 4 : true`（桌面預覽常駐、不分頁）；新增 `DESKTOP_WIZARD_STEP_COUNT = 3` 常數（桌面 wizard 只認 1-3，因為預覽不是桌面的一個 step）；新增邊界修正 effect：手機停在 step 4（預覽）時若視窗被拉寬跨過斷點，`if (!isMobile && step > 3) setStep(3)`，避免桌面 wizard 顯示空白欄位。
4. `GuestCreatePartyScreen.tsx`（訪客版）：只改桌面版，新增 4 步 wizard（身分→基本資料→規則→職缺），手機版維持現狀（一次全部捲動顯示、不新增 wizard chrome）——gating 一律 `isMobile || step === N`，讓手機在任何 step 值下四個區塊都同時顯示。額外新增「已有身分時桌面自動跳過第一頁」：`useQuickGuestProfile` 的 `isHydrated` 旗標配合一個只觸發一次的 `useRef` guard，僅在「載入當下讀到的已存身分」判斷一次是否 `setStep(2)`，之後不論身分怎麼變都不會再被強制跳頁。
5. `.os-create-party-layout`（`globals.css`）：`grid-template-columns` 從三欄 `minmax(240px,320px) minmax(0,1fr) minmax(240px,320px)` 改兩欄 `minmax(0,1fr) minmax(240px,320px)`（wizard｜preview），登入版/訪客版共用同一個 CSS 定義（欄數不因步驟數不同而不同，那是 JS 層的事）。新增 `.os-create-party-wizard`（flex column）、`.os-create-party-wizard__form-bounds`（`max-width: 560px`，限制表單閱讀寬度，避免超寬桌機螢幕下輸入欄位/欄位列拉得過寬）、`.os-create-wizard-nav`（flex space-between + 上邊框分隔線）；並在既有 `@container shell-main (max-width: 899px)` 收合區塊內加一條 `.os-create-party-wizard__form-bounds { max-width: none; }`，避免手機版表單卡片被意外限制寬度。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **維護性**：把「純機制」（欄位錯誤記錄、捲動、切步驟）與「驗證規則」（哪個欄位何時檢查什麼）明確分層，是本次決策的核心。方案 2 想追求形式上的完全零重複，但驗證規則本身就是兩個畫面天生不同的部分，硬要共用只會製造更難讀的條件分支——這與 [ADR-0016](0016-guest-party-entry-point-parity.md) 拒絕「共用互動 hook」的理由完全一致：在「有本質差異的兩份邏輯」與「零重複」之間，優先選擇風險更低、邊界更清楚的封裝方式，而非為了追求形式一致而承擔不必要的耦合。
- **安全性**：純前端 UI 驗證，無信任邊界變化；三個方案在安全性上無實質差異，此處以維護性作為主要決定因素。
- **效能**：三個方案在效能面向無實質差異，非本次決策的區分因素。
- **`max-width: 560px` 而非規劃初期估計的 480px**：`SlotsColumn` 的 slot 列（`.os-create-slots__row--*`）內含大頭貼、姓名、等級、1-2 個操作按鈕，480px 在密集內容下略嫌侷促；560px 與 codebase 既有幾個 modal/card 寬度（如 `.os-quick-guest-identity` 相關 dialog）同一量級，兼顧可讀性與 slot 列的呼吸空間。

## 被拒絕方案與原因 (Rejected Alternatives)

- **各自複製一份 wizard 邏輯（方案 1）**：與本次要解決的「重複邏輯分散、未來調整需要多處同步」問題本質相同，違反核心規範「重複邏輯必須封裝」。
- **巨型共用 hook 吃掉全部驗證規則（方案 2）**：形式上零重複，但用大量 `if (isGuest)` 分支換取「共用」的假象，實際上提高了耦合與遺漏風險，且與 ADR-0016 已建立的判斷原則（安全性/維護性優先於形式一致）相悖。

## 影響 (Consequences)

- **前端影響範圍**：`frontend/src/hooks/useWizardFieldErrors.ts`（新增）、`frontend/src/app/parties/create/_components/CreatePartyWizardNav.tsx`（新增）、`CreatePartyScreen.tsx`、`GuestCreatePartyScreen.tsx`、`globals.css`（`.os-create-party-layout` 欄數變更 + 新增 wizard/nav class）。無 API 契約變更、無新增依賴。
- **手機版零回歸風險**：登入版手機邏輯代數等價（`!isMobile || step===1` 在手機端本就等於 `step===1`）；訪客版手機邏輯刻意維持 `isMobile ||` 恆真，不新增 wizard chrome。
- **測試**：既有 `CreatePartyScreen.test.tsx` 因桌面版現在也分頁，測試互動順序需要改成「先完成 step1 欄位、點『下一步』兩次進入 step3、再操作角色/欄位」，不能再假設三欄同時存在於 DOM。

## Supersedes / Superseded by

不推翻任何既有 ADR；沿用 ADR-0015/ADR-0016 已建立的訪客/登入雙軌顯示模式，僅調整桌面版的分頁呈現方式。
