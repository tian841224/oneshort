# ADR-0023: 建立隊伍 wizard 導覽列移至頂端、基本資料與規則合併為單一 step、送出動作併入 wizard nav 最後一步

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: frontend / party
- 相關文件: docs/decisions/0018-create-party-desktop-wizard.md（本次修正的前置決策）、docs/decisions/0020-mobile-step4-preview-visibility.md

## 背景 (Context)

[ADR-0018](0018-create-party-desktop-wizard.md) 把 `/parties/create` 桌機版改成分步 wizard 後，`CreatePartyWizardNav`（StepDots + 上一步/下一步）原本渲染在每個 step 內容的**下方**。實測發現：不同 step 的內容高度差異很大（基本資料卡片 vs 加入規則卡片 vs 職缺編輯區），導致這條導覽列在切換 step 時視覺上會明顯上下跳動，違反使用者對「固定導覽控制項」的預期。

同時，ADR-0018 把「基本資料」「加入規則」拆成兩個獨立 step（登入版 3 步、訪客版 4 步）。這兩張卡片實務上內容量都不大、且使用者通常會連續填完（沒有中途只想填一半就跳走的情境），拆成兩個 step 只增加了一次「下一步」點擊，卻沒有對應的資訊架構效益。

送出動作原本完全由 `PreviewColumn` 自身的「建立隊伍」按鈕負責，`CreatePartyWizardNav` 的 `onNext` 在最後一步刻意留空（見 ADR-0018 決策第 3 點）。但桌機版 wizard 化之後，使用者的操作焦點集中在左側 wizard 欄，最後一步卻要把視線移到右側常駐預覽欄才能找到送出按鈕，動線不連貫。

這屬於 `.agent/rules/core.md` §3.1 定義的修正方案評估適用範圍（既有 wizard 架構下的導覽/資訊架構微調）。**本 ADR 依實際程式碼變更（commit `dc61592`）回溯記錄**：三項變更（nav 移到頂端、合併步驟、送出併入 nav）在同一次 commit 內一併完成，彼此高度相關（都是同一輪「wizard 導覽體驗」打磨），故合併記錄於同一份 ADR；下方「考慮過的方案」針對三個決策點分別說明，而非各自獨立展開三份完整方案比較。

## 考慮過的方案 (Options Considered)

### 決策點 1：wizard nav 位置——內容上方（採用）vs 內容下方（原狀，ADR-0018）

- **內容下方（原狀）**：`padding-top` + `border-top`，視覺上像 footer。不同 step 內容高度不同時，nav 垂直位置會跳動。
- **內容上方（採用）**：`padding-bottom` + `border-bottom` 反轉為 header 分隔線樣式，nav 固定在 wizard 欄頂端，不受下方內容高度影響，位置全程穩定。
- **維護性/效能/安全性**：三方案在此決策點上無差異，純 CSS 屬性調整（`padding-top`/`border-top` 換成 `padding-bottom`/`border-bottom`）與 JSX 渲染順序調整，不影響其他邏輯。

### 決策點 2：基本資料／加入規則是否合併成單一 step——合併（採用）vs 維持兩個獨立 step（原狀，ADR-0018）

- **維持兩個獨立 step（原狀）**：`BasicInfoColumn` 依 `section` prop 拆成 `"basic"`/`"rules"` 兩次渲染，`FIELD_STEP` 把 `type`/`target`/`schedule` 對應到 step 1、`leaderCharacter`/`slots` 對應到 step 3（登入版）。
- **合併成單一 step（採用）**：`BasicInfoColumn` 不再依 `section` 拆分，兩張卡片在同一個 step 一次顯示；登入版桌機 wizard 從 3 步降為 2 步（`DESKTOP_WIZARD_STEP_COUNT` 3→2），訪客版桌機 wizard 從 4 步降為 3 步（`GUEST_CREATE_PARTY_STEP_COUNT` 4→3）。
- **權衡**：兩張卡片本身欄位量不大、填寫時通常連續完成，拆成兩個 step 對這種輕量表單反而增加不必要的點擊次數，且決策點 1 已經解決「nav 跳動」問題後，單一 step 內容變長不再有「nav 位置不穩」的副作用，移除拆分的理由隨之消失。合併後兩者的欄位驗證/錯誤定位邏輯不變（仍由 `useWizardFieldErrors` 統一處理，只是 `FIELD_STEP` 對應的 step 編號跟著全部下移一位）。

### 決策點 3：送出動作歸屬——併入 wizard nav 最後一步（採用）vs 維持只由 `PreviewColumn` 自身按鈕負責（原狀，ADR-0018）

- **維持原狀**：`CreatePartyWizardNav` 最後一步不渲染 `onNext`，送出動作只能在右側常駐預覽欄找到。
- **併入 wizard nav（採用）**：`CreatePartyWizardNav` 新增 `nextIcon` prop（`"arrow_right"` 預設 / `"check"`），最後一步時 `nextLabel` 改為「建立隊伍」、`nextIcon="check"`（圖示放在文字前，比照 `PreviewColumn` 既有送出按鈕的圖示位置慣例），`onNext` 直接接上 `handleSubmit`。`PreviewColumn` 對應新增無條件 `hideSubmitButton`（登入版桌機/手機皆隱藏其內建按鈕，改由 wizard nav 或既有的手機 `.os-mobile-wizard-footer` 負責），避免同畫面出現兩顆「建立隊伍」按鈕。訪客版桌機比照登入版隱藏（`hideSubmitButton={!isMobile}`），但訪客版手機維持不隱藏——訪客手機沒有自己的固定 footer，`PreviewColumn` 內建按鈕仍是手機上唯一的送出入口（見 ADR-0020 記錄的「訪客手機曾經完全沒有送出按鈕」問題，這裡刻意不重蹈覆轍）。
- **權衡**：讓使用者的操作動線全程停留在左側 wizard 欄（填寫→按下一步→…→按建立隊伍），不必在最後一步把視線與滑鼠移到右側欄；`PreviewColumn` 仍保留內建按鈕元件本身（只是被各消費端依情境選擇性隱藏），未來若有新的消費場景需要它，不必重新實作。

## 決策 (Decision)

三個決策點皆採用上方「採用」選項：

1. `globals.css`：`.os-create-wizard-nav` 從 `padding-top`/`border-top` 改為 `padding-bottom`/`border-bottom`；`CreatePartyScreen.tsx`/`GuestCreatePartyScreen.tsx` 的 JSX 渲染順序把 `CreatePartyWizardNav` 移到 step 內容之前。
2. `CreatePartyScreen.tsx`：`DESKTOP_WIZARD_STEP_COUNT` 3→2、`CREATE_PARTY_STEP_COUNT`（手機，含預覽）4→3；`FIELD_STEP` 的 `leaderCharacter`/`slots` 從 3 改對應到 2；`showBasicCard`/`showRulesCard` 合併為單一 `showBasicInfo = step === 1`，`showSlots = step === 2`；`BasicInfoColumn` 不再傳 `section` prop。`GuestCreatePartyScreen.tsx` 同步：`GUEST_CREATE_PARTY_STEP_COUNT` 4→3，`showBasicCard`/`showRulesCard` 合併為 `showBasicInfo = isMobile || step === 2`，`showSlots` 對應位移到 `step === 3`。
3. `CreatePartyWizardNav.tsx`：新增 `nextIcon?: "arrow_right" | "check"`（預設 `"arrow_right"`），`"check"` 時圖示渲染於文字前而非後。`CreatePartyScreen.tsx`/`GuestCreatePartyScreen.tsx` 在最後一步時傳入 `onNext={handleSubmit}`、`nextLabel="建立隊伍"`、`nextIcon="check"`、`nextDisabled={isSubmitting}`。`PreviewColumn.tsx` 的 `hideSubmitButton` 使用方式調整：登入版無條件 `hideSubmitButton`（桌機由 wizard nav 送出、手機由既有 `.os-mobile-wizard-footer` 送出）；訪客版 `hideSubmitButton={!isMobile}`（桌機由 wizard nav 送出，手機維持 `PreviewColumn` 內建按鈕為唯一入口，避免重現 ADR-0020 的手機無送出按鈕問題）。
4. 測試同步更新：`CreatePartyScreen.test.tsx`（step 點擊序列從「2 次下一步到 slots」改為「1 次下一步到 slots」）、`tests/e2e/fixtures.ts`／`guest-party-interop.e2e.ts`／`guild-management.e2e.ts`／`mobile-layout.e2e.ts`（step 點擊次數與按鈕查找邏輯同步調整為新的合併後步數，並改為在最後一步點擊「建立隊伍」而非分開點「下一步」再點右側預覽欄按鈕）。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性**：純前端 UI/表單流程調整，`handleSubmit` 呼叫的 API payload 與驗證規則完全不變，無新增攻擊面。
- **維護性**：三項變更彼此有因果關係——nav 固定在頂端（決策點 1）移除了「合併 step 後單一 step 內容變長會讓 nav 跳動更明顯」的副作用，使決策點 2（合併 step）不會製造新的視覺問題；`PreviewColumn` 的 `hideSubmitButton` 改為更明確的旗標語意（登入版無條件隱藏、訪客版依裝置區分），比原本「多處消費端各自决定要不要傳」更容易追蹤谁负責送出按鈕。`CreatePartyWizardNav` 新增的 `nextIcon` 是可選 prop、預設值維持原行為，不影響其他既有呼叫端。
- **效能**：與其他方案無實質差異，純渲染順序與 state 對應調整。
- **一致性**：`nextIcon="check"` 時圖示放在文字前，刻意比照 `PreviewColumn` 既有送出按鈕的圖示位置慣例，避免同一個「建立隊伍」語意在畫面上有兩種不同的圖示/文字排列方式。

## 被拒絕方案與原因 (Rejected Alternatives)

- **維持 wizard nav 在內容下方**：不同 step 內容高度差異大，nav 位置持續跳動，使用者難以依賴固定位置的導覽控制項，故調整至頂端。
- **維持基本資料／加入規則為兩個獨立 step**：兩張卡片欄位量小、通常連續填寫，拆分只增加點擊次數而無對應的資訊架構效益；決策點 1 解決 nav 跳動問題後，合併已無殘留副作用，故合併。
- **維持送出動作只由 `PreviewColumn` 自身按鈕負責**：桌機 wizard 化後使用者操作焦點集中在左側欄，最後一步仍要求使用者移到右側常駐預覽欄尋找送出按鈕，動線不連貫，故改由 wizard nav 最後一步統一負責，`PreviewColumn` 內建按鈕保留元件本身、依消費端情境選擇性隱藏。

## 影響 (Consequences)

- **前端影響範圍**：`CreatePartyScreen.tsx`、`GuestCreatePartyScreen.tsx`、`CreatePartyWizardNav.tsx`、`PreviewColumn.tsx`、`globals.css`（`.os-create-wizard-nav` 邊框/padding 方向）、`CreatePartyScreen.test.tsx`、`tests/e2e/fixtures.ts`、`tests/e2e/guest-party-interop.e2e.ts`、`tests/e2e/guild-management.e2e.ts`、`tests/e2e/mobile-layout.e2e.ts`。無 API 契約變更、無新增依賴、無 DB/schema 變動。
- **步數對照**（取代 ADR-0018 原始記錄的步數，本 ADR 為最新狀態）：登入版桌機 wizard 3→2 步（基本資料＋規則合併／職缺）、登入版手機（含預覽）4→3 步；訪客版桌機 wizard 4→3 步（身分／基本資料＋規則合併／職缺）、訪客版手機維持原本不分步（單頁攤平）不變。
- **已知後續（未在本次處理，記錄以避免遺失）**：本次是依已提交的 commit `dc61592`回溯撰寫的 ADR（該 commit 完成於 [ADR-0018](0018-create-party-desktop-wizard.md)／[ADR-0020](0020-mobile-step4-preview-visibility.md) 之後，但兩者原文皆記錄的是合併前的步數，尚未更新）；`docs/create-party-desktop-wizard` 分支（e5d3fbc）與 `fix/create-preview-bar-portal-visibility` 分支（ADR-0021）的內容也是基於合併前／未套用 wizard 的步數撰寫，待所有相關分支合併進 `develop` 後，需要統一核對步數與 `DESKTOP_WIZARD_STEP_COUNT` 等常數是否一致。

## Supersedes / Superseded by

不推翻任何既有 ADR；補充並更新 [ADR-0018](0018-create-party-desktop-wizard.md) 記錄的桌機/訪客 wizard 步數（決策點 2 生效後，ADR-0018 原文的步數描述已不是最新狀態，以本 ADR 為準）。
