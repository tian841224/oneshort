# ADR-0021: 建立隊伍桌機側欄擠窄 fallback bar（`.os-create-preview-bar`）的可見性改由 ResizeObserver 驅動

- 狀態: Accepted
- 日期: 2026-07-10
- 相關模組: frontend / party
- 相關文件: docs/decisions/0018-create-party-desktop-wizard.md、docs/decisions/0020-mobile-step4-preview-visibility.md

## 背景 (Context)

`/parties/create`（`CreatePartyScreen.tsx`）桌機版側欄若被拖曳擠窄，`.os-shell__main` 容器寬度會跟著收縮；當收縮到 899px 以下時，畫面需要從「常駐右側預覽欄 `.os-create-preview-panel`」切換成「底部摘要條 `.os-create-preview-bar`」（標題 + 人數 + 一顆「建立隊伍」按鈕），因為此時右側欄已經沒有足夠寬度呈現完整預覽。

`.os-create-preview-bar` 刻意用 `createPortal(..., document.body)` 直接掛到 `<body>`，而不是留在 `.os-shell__main` 底下——這是有意的設計，理由記錄在元件既有註解裡：`.os-shell__main` 帶有 `container-type: inline-size`（供 `@container shell-main` 版面收合使用），依 CSS Containment 規範，這會讓 `.os-shell__main` 同時成為其所有 `position: fixed` 後代的 containing block。若不 portal，這條 fixed bar 的定位與堆疊會被鎖死在 `.os-shell__main` 這個框內，**永遠**無法跟掛在 `.os-shell__main` 外面的 app 層級 `MobileBottomNav`競爭疊層順序——無論把 z-index 設多高都一樣，這不是可以繞過的 CSS 限制，而是規範定義的行為。這部分設計正確，**不在本次變更範圍內、不可回退**。

**實際 bug**：這條 bar 的「要不要顯示」原本完全交給 `globals.css` 的 `@container shell-main (max-width: 899px) { .os-create-preview-bar { display: flex; ... } }` 規則決定。但 CSS `@container <name>` 選擇器只能匹配「帶有該 container-name 元素的**後代**」——`.os-create-preview-bar` 被 portal 到 `document.body` 之後，已經不是 `.os-shell__main` 的後代了，這條規則在任何情況下都**結構性地**永遠無法命中它。結果是這條 bar 的預設 `display: none`（定義在同一個 CSS 檔案、`@container` 區塊之前）永遠生效，即使側欄真的把 `.os-shell__main` 擠到 899px 以下（也就是這條 bar 存在的目的），它依然不會顯示。對照組 `.os-create-preview-panel`（沒有被 portal，是真正的 `.os-shell__main` 後代）用同一條 `@container` 規則能正常隱藏，只有 bar 這一半是死碼。

這屬於 `.agent/rules/core.md` §3.1 定義的修正方案評估適用範圍（CSS 選擇器結構限制與可見性決策權歸屬的取捨）。

**與 ADR-0018/0020 的關係（範圍澄清）**：ADR-0018（桌機分步 wizard）與 ADR-0020（手機 Step4 預覽空白修復）記錄的決策，其程式碼目前落在尚未合併進本分支/`develop` 的 `feature/create-party-desktop-wizard` 分支（見 `docs/decisions/index.md` ADR-0019 索引列已記錄的跨分支協調缺口）。本次修正是在**尚未套用桌機分步 wizard**的現行 `CreatePartyScreen.tsx`（`.os-create-party-layout` 仍是 3 欄、桌機版一次攤平顯示，沒有 `DESKTOP_WIZARD_STEP_COUNT`）上進行的，`.os-create-preview-bar` 的顯示條件是 `!isMobile && portalReady`（而非那兩份 ADR 文字描述情境下會有的 `step !== DESKTOP_WIZARD_STEP_COUNT` 額外閘門）。本 ADR 記錄的「visibility 決策權從 CSS 移到 JS」這個核心取捨，與 ADR-0018/0020 面對的是同一個元件、同一組 CSS pattern 的類似問題（見下方方案比較），故視為直接的既有先例；但兩者是不同的 bug、不同的根因，本 ADR 不修改也不依賴 ADR-0018/0020 尚未合併的程式碼。待該分支合併進 `develop` 後，需要重新檢視 `shellMainNarrow` 是否還需要與屆時新增的 `step !== DESKTOP_WIZARD_STEP_COUNT` 閘門組合（記錄於下方「影響」段落的已知後續）。

此 bug 已在既有 Playwright 測試中被記錄：`tests/e2e/qa-acceptance-evidence.e2e.ts` 的 `'A6...'` 測試案例（`describe('QA acceptance evidence — 20260709 create-party mobile step4 preview')`）。**但該測試檔案本身也屬於 `feature/create-party-desktop-wizard` 分支尚未合併進 `develop` 的內容**，在本分支（`fix/create-preview-bar-portal-visibility`，base `develop`）的工作樹中不存在（已用 `git log --all` 與 `git merge-base --is-ancestor` 確認：該測試的提交 `bd947e0` 不是本分支 HEAD 的祖先）。因此本次修正**沒有**更新該測試檔案，待兩分支完成人工合併協調（ADR-0019 索引列已記錄的待辦）後，需要一併把該測試的 A6 案例斷言從「KNOWN BUG（`display: none`）」改為「已修復（`display: flex`，內容可見）」。本分支改在既有的 `CreatePartyScreen.test.tsx`（vitest + Testing Library）新增了一則單元測試，直接驗證 ResizeObserver 觸發後 bar 的掛載與內容渲染，見「影響」段落。

## 考慮過的方案 (Options Considered)

### 方案 A（拒絕）：不再 portal，把 bar 留在 `.os-shell__main` 內，改用其他方式解決疊層問題

- 讓 `.os-create-preview-bar` 回到 `.os-shell__main` 的後代位置，使 `@container shell-main` 能重新命中它；疊層問題改用提高 z-index、或重構 shell 結構來解決。
- **不可行**：`.os-shell__main` 的 `container-type: inline-size` 是 `.os-create-party-layout` 版面收合（ADR-0018 的前置條件、本分支現行 3 欄→1 欄收合同樣依賴它）必要的設定；依 CSS Containment 規範，只要它存在，`.os-shell__main` 就無可避免地成為其 `position: fixed` 後代的 containing block，**任何 z-index 值都無法逃脫這個 containing-block 限制**——不 portal 的 fixed bar 永遠只能被限制在 `.os-shell__main` 的框內渲染，不可能成為真正跨越全螢幕寬度、與 `MobileBottomNav` 競爭疊層順序的底部條。這不是「目前實作沒做好」，而是這個 bar 一開始被 portal 出去的根本原因（見既有程式碼在 `portalReady` 宣告前的既有註解）。採用此方案等於重新引入 portal 存在之前就有的疊層 bug，不是修法，是回歸。
- **維護性**：差（重新製造已解決的問題）。**效能**：無差異。**安全性**：無關。

### 方案 B（採用）：維持 portal，只把「要不要顯示」這個決策移到 JS，用 `ResizeObserver` 驅動

- `.os-create-preview-bar` 繼續 portal 到 `document.body`（疊層/containing-block 理由完全不變）。
- 在 `CreatePartyScreen.tsx` 新增 `scrollRootRef`（掛在最外層根節點 `.os-create-party-scroll`）與 `shellMainNarrow` state，用 `ResizeObserver` 觀察 `scrollRootRef.current`，`entry.contentRect.width < BP.bottomNav`（900，與 CSS `max-width: 899px` 等價，即 `BP.bottomNav - 1`）時設為 `true`。**量測目標的選擇必須是零水平 padding 的元素**：`ResizeObserver` 的 `contentRect.width` 依規範回報的是內容框寬度、**排除元素自身的 padding**。內層的 `.os-create-party-layout`（3 欄 grid）帶有 `padding: 24px 32px`（寬態）／`20px 18px`（窄態，`@container shell-main (max-width: 899px)` 內），若掛在它身上，量到的寬度會比 `.os-shell__main` 真正內容寬度少 36–64px，導致 `.os-shell__main` 仍 >899px（CSS `@container` 尚未讓 `.os-create-preview-panel` 隱藏）時 JS 卻已經提早誤判 `shellMainNarrow = true`，讓 portal 出去的 bar 與常駐的 `.os-create-preview-panel` 同時掛載——重新製造出「兩顆送出按鈕」的 bug，只是換了個新機制觸發（此問題在 code review 階段被抓到並修正，見下方「審查修正」）。改掛在 `.os-create-party-scroll`（元件最外層 root div）則沒有這個問題：它在寬態與窄態都沒有任何水平 padding（只有窄態才有 `padding-bottom`），是 `.os-shell__main` content-box inline-size 更乾淨的代理，唯一殘留誤差是 `overflow-y: auto` 出現捲軸時的 ~15–17px 捲軸寬度，遠小於前述 36–64px 的 padding 誤差，可接受。
- Bar 的 portal 渲染條件從 `!isMobile && portalReady` 改為 `!isMobile && portalReady && shellMainNarrow`。
- `globals.css` 對應調整：`.os-create-preview-bar` 的完整視覺樣式（`position: fixed`、`bottom/left/right`、padding、背景、`border-top`、flex 版面、z-index、box-shadow）從 `@container shell-main (max-width: 899px) { ... }` 區塊移出，變成一個永遠生效的頂層規則——因為現在只有 `shellMainNarrow` 為真時，元件才會把這個節點掛進 DOM（透過 portal），CSS 不再需要負責「要不要顯示」，只需要負責「顯示的時候長什麼樣子」。`.os-create-preview-panel` 的 `@container shell-main` 規則完全不動。
- 依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：
  - **安全性**：與方案 A 無差異，純 UI 呈現邏輯，非本次決策的區分因素。
  - **維護性**：最佳。Portal 存在的理由（containing-block/疊層）完全不受觸碰，只新增「可見性判斷」這一個單一權責，符合 ADR-0020 已經驗證過的模式（「CSS 結構性無法表達的可見性條件，收斂成單一 JS 權威來源」）；範圍收得很窄——一個 `ResizeObserver`、一個布林 state，目前只有這一個消費端，不需要抽成共用 hook（若未來有第二個消費端，屆時再依 core.md §3.1 重新評估是否該抽共用）。
  - **效能**：可忽略不計。單一 `ResizeObserver` instance，只在建立隊伍畫面掛載時存在，`disconnect()` 於卸載時清理，不會累積。

### 方案 C（未採用，記錄僅供參考）：改用 `window`/`document.body` 的 resize 事件，而非針對 `.os-create-party-layout` 元素本身的 `ResizeObserver`

- 實作過程中曾考慮直接監聽 `window.resize` 或 `document.body` 的尺寸變化，但這樣量到的是「視窗寬度」而非「`.os-shell__main` 容器寬度」——側欄展開/收合、聊天面板開合等操作只會改變 `.os-shell__main` 的**容器**寬度，不會改變視窗寬度，用 `window.resize` 完全偵測不到這些場景（正是 `@container` 而非 `@media` 存在的原因）。這個方案在語意上就是錯的，不是單純的效能/維護性取捨，故不列入正式比較，僅記錄避免未來重新提出。

## 決策 (Decision)

採用方案 B：

1. `src/app/parties/create/_components/CreatePartyScreen.tsx`：
   - 新增 `scrollRootRef`（`useRef<HTMLDivElement | null>`），掛在最外層根節點 `.os-create-party-scroll`（**不是** `.os-create-party-layout`——後者帶有水平 padding，會讓 `ResizeObserver` 的 `contentRect.width` 少算 36–64px，見上方方案 B 說明）。
   - 新增 `shellMainNarrow` state 與對應 `useEffect`：`if (typeof ResizeObserver === "undefined") return;` 起手（比照 `src/hooks/useInfiniteScroll.ts` 對 `IntersectionObserver` 的既有 SSR/jsdom guard 慣例），建立 `ResizeObserver` 觀察 `scrollRootRef.current`，`entry.contentRect.width < BP.bottomNav` 時更新 state，effect 清理時 `observer.disconnect()`。
   - `.os-create-preview-bar` 的 `createPortal` 渲染條件加上 `&& shellMainNarrow`。
   - 更新三處既有註解（`portalReady` 宣告前、`createPortal` 呼叫前的兩處），說明 portal 理由不變、可見性判斷已改由 JS 負責。
2. `src/app/globals.css`：`.os-create-preview-bar` 的完整視覺樣式從 `@container shell-main (max-width: 899px)` 區塊移出，變成頂層永遠生效的規則，並加註解說明原因與指向本 ADR。`.os-create-preview-panel` 的 `@container shell-main` 規則不動。
3. `src/app/parties/create/_components/CreatePartyScreen.test.tsx`：新增單元測試，stub 全域 `ResizeObserver`，驗證：寬度回報 < 900 時 `.os-create-preview-bar` 掛載且內容（標題、人數、「建立隊伍」按鈕文字）正確渲染；寬度回報 ≥ 900 時卸載。
4. `tests/e2e/qa-acceptance-evidence.e2e.ts`：**未修改**——該檔案屬於尚未合併進 `develop` 的 `feature/create-party-desktop-wizard` 分支內容，本分支工作樹中不存在（已用 `git merge-base --is-ancestor` 確認）。待跨分支合併協調完成後，需要把該測試 A6 案例的斷言從 `expect(diag.barDisplay).toBe('none')`（KNOWN BUG）改為 `toBe('flex')`（已修復），並依 core.md §3 補上文件過期同步。

## 理由 (Rationale)

已於「考慮過的方案」逐項說明；核心理由是：portal 的存在理由（containing-block/疊層）與「可見性怎麼決定」是兩個獨立問題，方案 A 為了修可見性而犧牲已經解決的疊層問題，方案 B 讓兩者各自用最合適的機制處理（portal 留給 DOM 位置/疊層，`ResizeObserver` 留給「這個節點現在該不該存在」），與 ADR-0020 處理同一組元件、同一種「CSS 結構性搆不到」問題時採用的思路（收斂到單一 JS 權威來源）一致。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 A（不再 portal）**：會重新引入 portal 原本要解決的疊層 bug（containing-block 限制對任何 z-index 值都無效），不是修法而是回歸，不採用。
- **方案 C（監聽 `window`/`document.body` resize 而非容器本身）**：語意錯誤——量到的是視窗寬度而非 `.os-shell__main` 容器寬度，偵測不到側欄擠窄這個核心觸發場景，未正式列入比較。

## 審查修正（同日，commit 前）

Reviewer 在審查本決策首版實作時發現：`scrollRootRef`（首版誤命名為 `layoutRef`）原本掛在 `.os-create-party-layout`，但這個元素自己帶水平 padding（寬態 `24px 32px`、窄態 `20px 18px`，見 globals.css）；`ResizeObserver` 的 `contentRect.width` 依規範排除元素自身 padding，所以量到的寬度比 `.os-shell__main` 真正內容寬度少 36–64px。具體後果：`.os-shell__main` 寬度落在 (899px, ~964px) 這個約 65px 的側欄拖曳區間時，JS 已經誤判 `shellMainNarrow = true` 提早掛出 portal bar，但 CSS `@container shell-main (max-width: 899px)` 尚未讓 `.os-create-preview-panel` 隱藏——兩者同時可見，重新製造出「兩顆送出按鈕」的 bug（`.os-create-preview-panel` 內建按鈕 + portal bar 按鈕），只是觸發機制從 CSS 換成了 JS 代理量測誤差。

修正：把量測目標從 `.os-create-party-layout` 改成元件最外層根節點 `.os-create-party-scroll`（`ref` 隨之從 `layoutRef` 重新命名為 `scrollRootRef` 以避免誤導）。這個元素在寬態與窄態都沒有任何水平 padding（只有窄態才有 `padding-bottom`），是 `.os-shell__main` content-box inline-size 更乾淨的代理，唯一殘留誤差是 `overflow-y: auto` 出現捲軸時的 ~15–17px 捲軸寬度，遠小於原本 36–64px 的 padding 誤差，可接受不特別處理。**教訓**：用 `ResizeObserver` 代理量測某個上層容器的寬度時，觀察目標本身必須是零水平 padding 的元素——`contentRect` 天生排除自身 padding，這一點在選擇觀察目標時容易被忽略。此教訓已記錄進全域/專案記憶，供其他 `ResizeObserver` 代理量測場景參考。

方案 B 與「決策」段落已更新為修正後的最終版本（`scrollRootRef` / `.os-create-party-scroll`），上方敘述不再保留原本錯誤的 `layoutRef` / `.os-create-party-layout` 版本描述，僅在本節保留變更歷程以利追溯。

## 影響 (Consequences)

- **前端影響範圍**：`CreatePartyScreen.tsx`、`globals.css`（`.os-create-preview-bar` 規則位置調整，`.os-create-preview-panel` 不變）、`CreatePartyScreen.test.tsx`（新增 1 則單元測試）、`tests/e2e/create-party-preview-bar-squeeze.e2e.ts`（新增，真實瀏覽器回歸測試）。無 API 契約變更、無新增依賴（`ResizeObserver` 是瀏覽器原生 API）、無 DB/schema 變動。未觸碰 `GuestCreatePartyScreen.tsx`（該畫面不使用 `.os-create-preview-bar`，已用 grep 確認無引用）。
- **測試**：`npx tsc --noEmit` 通過；`npx vitest run src/app/parties/create`（5 個測試檔、32 案例，含本次新增）全數通過。**QA 階段已補上真實瀏覽器 Playwright E2E 驗證**：新增 `tests/e2e/create-party-preview-bar-squeeze.e2e.ts`，以真實指標拖曳 `.os-sidebar-resize-handle` 橫跨 899px 門檻（8 個中間取樣點 + 兩端），逐點斷言 `.os-shell__main` 實際寬度、`.os-create-preview-panel`/`.os-create-preview-bar` 可見性、以及「表單層級送出按鈕數量恆為 1」（排除側欄常駐的 `.os-sidebar__create-btn`），並在完全擠窄後驗證 bar 內容（標題、`X/Y 人`、可點擊按鈕）正確渲染；另跑真實手機 viewport（375px）確認未受影響。`node scripts/e2e-local.mjs -- --project=chromium tests/e2e/create-party-preview-bar-squeeze.e2e.ts`：**1 passed**（實測 dx=140 時 `.os-shell__main` 仍 910px、panel 可見、bar 未掛載；dx=160 時降到 888px、乾淨切換到 bar 可見，兩者之間無重疊視窗，證實審查修正確實生效，不只是程式碼推論）。同時重跑 `tests/e2e/party-flow.e2e.ts` 的 `@smoke` 案例（一般建隊流程，非擠窄情境）確認無回歸：1 passed。
- **已知後續（未在本次處理，記錄以避免遺失）**：
  1. `feature/create-party-desktop-wizard` 分支（ADR-0018/0020 的實際程式碼、含 `qa-acceptance-evidence.e2e.ts`）合併進 `develop` 後，需要重新檢視屆時 `.os-create-preview-bar` 的顯示條件是否要與 `step !== DESKTOP_WIZARD_STEP_COUNT` 這個桌機 wizard 專屬閘門組合（目前該分支的條件是 `!isMobile && step !== DESKTOP_WIZARD_STEP_COUNT && portalReady`；本 ADR 只新增了 `&& shellMainNarrow`，尚未與 `step` 閘門互動過，需要屆時人工合併確認邏輯正確）。同一次合併也需要決定 `create-party-preview-bar-squeeze.e2e.ts`（本 ADR 新增）與屆時併入的 `qa-acceptance-evidence.e2e.ts` A6 案例之間是否重複、要不要整併。
  2. `tests/e2e/qa-acceptance-evidence.e2e.ts` 的 A6 案例斷言需要在上述合併完成後同步改為「已修復」（見「決策」第 4 點）——但由於本 ADR 已另外新增等價的真實瀏覽器回歸測試（`create-party-preview-bar-squeeze.e2e.ts`），這個待辦的急迫性降低，不再是「這個 bug class 完全沒有自動化保護」的狀態。

## Supersedes / Superseded by

不推翻任何既有 ADR。解決 `tests/e2e/qa-acceptance-evidence.e2e.ts`（`feature/create-party-desktop-wizard` 分支，尚未合併進 `develop`）A6 測試案例先前記錄並斷言為「KNOWN BUG」的同一根因問題；與 ADR-0018/0020 記錄的手機 Step4 空白修復是不同元件路徑、不同 bug、不同根因（同一元件檔案、同一 CSS pattern 在同一輪 QA 中被一併發現）。
