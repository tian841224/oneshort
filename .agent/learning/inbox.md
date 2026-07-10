# OneShort 教訓收件匣 (Learning Inbox)

> 自我學習迴圈的未蒸餾暫存區——**僅限 OneShort 專屬**教訓。命中全域 learning.md §2（`~/.claude/rules/learning.md`）擷取觸發、且判定為 OneShort 特定時，把教訓 append 到下方（格式見全域 learning.md §5.1，`專案:` 欄填 `oneshort`）。
> 跨專案通用教訓改寫入全域 `~/.claude/memory/inbox.md`。
> 由 `learn`／`evolve` skill 蒸餾進 [MEMORY.md](MEMORY.md) 後，條目自此檔移除。**禁止寫入任何秘密**。

---

## 2026-07-10｜類型: 錯誤｜專案: oneshort｜來源: feature/quick-party-ui reviewer 阻斷性問題修正
- 情境：`FindPartyScreen.tsx` 的 `requireQuickGuestProfile` gate 用 `pendingQuickAction.resume: () => void`（零參數閉包）。訪客第一次填職業/等級存檔後，`GuestProfilePrompt.onSave` 呼叫 `resume()`，但 `resume` 綁定的是「舊 render」凍結的 `joinQuickFromPreview`/`openQuickCreate`/`handlePreviewPrimaryAction`，這些函式內部又重新呼叫 `requireQuickGuestProfile`，讀到的還是同一個 render 捕捉到的 `guestProfile` state（存檔前的空值，因為 setState 還沒 re-render）——判定又失敗，彈窗永遠關不掉，對應的 join/create mutation 永遠不會被呼叫。
- 教訓：任何「開彈窗收集資料 → onSave 後 resume 原動作」的 gate pattern，**resume 必須明確接收剛存的值當參數，禁止依賴重新呼叫舊 render 綁定的函式讀取 state closure**。正確做法：把 gate 檢查的目標值（如 profile）當成呼叫方顯式傳入的參數（預設值取當前 state，僅供首次呼叫使用），resume 時由 `onSave(value)` 直接把新值傳給 resume，被 resume 的函式也用「傳入的參數」而非「state closure」去做後續判斷與組 payload。已正確處理的對照案例：`PartyDetailScreen.tsx` 的 `submitQuickJoin`/`submitGuestApply`（`profile` 參數預設 `guestProfile`，呼叫端如 `handleQuickIdentitySave`/`handleGuestApplyIdentitySave` 顯式傳入剛存的 `value`，程式碼並留有註解說明原因）。踩坑案例：修正前的 `FindPartyScreen.tsx`（同一 PR、同一概念 deferred guest identity collection，卻在换一個檔案時重新踩進同樣的坑，即使旁邊就有已修正的參照實作）。
- 建議去向：rule:.agent/rules/core.md（§3.1 修正方案評估準則可補充此 hazard 為既有教訓範例）或 project-MEMORY

## 2026-07-10｜類型: 發現｜專案: oneshort｜來源: feature/quick-party-ui reviewer 第二輪跨 repo 交叉核對
- 情境：前端已送出新欄位（`guest_job_class_id`/`guest_level`）給 quick-party create/join API，但對應後端 struct（`QuickPartyCreateInput`/`QuickJoinInput`）尚未合併進 backend `develop`（實作在另一個未合併的 worktree）。Gin `ShouldBindJSON` 對 JSON body 裡的未知欄位預設不報錯，會靜默忽略。
- 教訓：跨 repo 平行開發（前後端各自 worktree 同步進行）時，前端送出新欄位前，若對應後端 branch 尚未合併到 backend `develop`，該欄位會被 `ShouldBindJSON` 靜默吃掉、不報錯——單元測試（mock API）與 `tsc`/lint 都測不出來，只有跨 repo 交叉核對原始碼或真實整合測試才抓得到。QA 對這類「前後端分別在不同 worktree 開發」的任務做本地驗收時，必須明確確認串接的後端環境是否已包含對應 commit，否則會誤判為前端迴歸。
- 建議去向：project-MEMORY（OneShort 跨 repo 協作流程注意事項）
