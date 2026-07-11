# 設計決策紀錄 (Architecture Decision Records)

本目錄記錄專案中所有「非顯而易見」的設計決策：架構選擇、行為取捨、被拒絕的替代方案與理由。目的是避免後續修改在不知情的狀況下推翻先前已權衡過的決定，導致反覆調整、前後不一致。

## 強制規則

1. **修改前必讀**：修改任何模組前，先檢查下方索引表是否有該模組的既有決策；若有，**必須先讀取對應 ADR 全文並遵守**，除非要正式推翻它（見下）。
2. **新決策必記錄**：任何符合 [core.md §3.1](../../.agent/rules/core.md#31-修正方案評估準則) 適用範圍的決策（bugfix、refactor、新功能、規格調整的方案選擇），完成評估後必須在本目錄新增一份 ADR 文件，不得只寫在 PR 描述或 commit body 裡（那些不會被下一個 session 自動讀到）。
3. **推翻舊決策**：若新決策與既有 ADR 衝突，不得直接修改或刪除舊 ADR 內容；應：
   - 將舊 ADR 狀態改為 `Superseded by ADR-NNNN`。
   - 新增新 ADR，並在其中註明 `Supersedes ADR-MMMM` 與推翻理由。
   - 索引表同步更新兩筆記錄的狀態。
4. **索引同步**：新增/推翻 ADR 時，必須同步更新下方索引表，否則視為未完成。
5. **文件過期同步**：本節第 3 點只處理「新 ADR 推翻舊 ADR」；更廣義的「文件過期必須同步更新或移除」規則（涵蓋 ADR 已知後續補註、相關規格文件因決策而過期等情境）見 [core.md §3](../../.agent/rules/core.md#3-架構優先原則)。

## 命名規則

`docs/decisions/NNNN-短標題.md`，NNNN 為 4 位數流水號（依索引表遞增，不得重用已刪除的編號）。

## ADR 範本

```markdown
# ADR-NNNN: <決策標題>

- 狀態: Accepted | Superseded by ADR-XXXX | Deprecated
- 日期: YYYY-MM-DD
- 相關模組: <例如 party / guild / notify / frontend-rwd / backend-worker>
- 相關文件: <例如 docs/features/party.md>

## 背景 (Context)
遇到的問題、限制、為何需要做這個決策。

## 考慮過的方案 (Options Considered)
1. 方案 A — 說明、維護性/效能/安全性評估
2. 方案 B — 說明、維護性/效能/安全性評估
3. (如有) 方案 C

## 決策 (Decision)
選定方案與具體作法。

## 理由 (Rationale)
為何選這個方案，依 core.md §3.1 的三大前提（安全性 > 維護性 > 效能）逐項說明取捨。

## 被拒絕方案與原因 (Rejected Alternatives)
明確寫出被拒絕的方案為何不選，避免未來重新提出同一個已評估過並否決的方案。

## 影響 (Consequences)
對其他模組、API、前端、未來擴充性的影響。

## Supersedes / Superseded by
若取代或被取代，於此標註對應 ADR 編號。
```

## 索引表

| 編號 | 標題 | 狀態 | 日期 | 相關模組 |
|---|---|---|---|---|
| [ADR-0001](0001-overlay-history-dismiss.md) | 行動版浮層（聊天 sheet／導覽抽屜）的關閉與瀏覽器歷史整合方式 | Accepted | 2026-07-04 | frontend-rwd / chat / shell |
| [ADR-0002](0002-party-widget-renderer-coverage.md) | 隊伍前台補齊全部 widget 型別渲染器的架構（generic 元件 + config adapter） | Accepted | 2026-07-04 | frontend / guide-widgets / party |
| [ADR-0003](0003-mobile-chat-sheet-close-button.md) | 行動版聊天／小工具 sheet 新增顯式關閉鈕；peek 狀態維持非模態 | 部分 Superseded by ADR-0007（peek 非模態部分）；關閉鈕決策仍 Accepted | 2026-07-05 | frontend-rwd / chat |
| [ADR-0004](0004-widget-member-identity-and-colour-legend.md) | 隊伍小工具成員身分權威化（含隊長）、全員顏色預先分配與顏色對照區 | Accepted | 2026-07-05 | frontend / guide-widgets / party |
| [ADR-0005](0005-mobile-chat-sheet-dedupe-close-and-dynamic-title.md) | 手機聊天室去除重複關閉鈕（改用既有返回鈕樣式）並顯示實際頻道名稱 | Accepted | 2026-07-05 | frontend-rwd / chat |
| [ADR-0006](0006-party-member-colors-backend-contract-alignment.md) | `party_member_colors` 前後端契約對齊（放棄自創 schema，改用既有後端驗證格式） | Accepted | 2026-07-05 | frontend / guide-widgets / party |
| [ADR-0007](0007-mobile-chat-sheet-peek-becomes-modal.md) | 手機聊天 sheet 的 peek 狀態改為模態（點外自動關閉），推翻 ADR-0003 該部分決策 | Accepted | 2026-07-05 | frontend-rwd / chat |
| [ADR-0008](0008-find-mobile-chat-channel-switcher-parity.md) | `/find` 手機聊天 sheet 改用共用頻道切換內容，與其他頁面行為一致 | Accepted | 2026-07-05 | frontend-rwd / chat |
| [ADR-0009](0009-silent-background-guide-state-writes.md) | 自動背景 guide-state 寫入（成員顏色）在雙重衝突時不彈出使用者錯誤提示 | Accepted | 2026-07-05 | frontend / guide-widgets / party |
| [ADR-0010](0010-character-primary-guard-atomicity.md) | 角色刪除／停用的 primary 保護改為原子化 SQL 條件，並允許唯一角色停用 | Accepted | 2026-07-05 | backend / user |
| [ADR-0011](0011-guild-preference-auto-schedule-persistence.md) | 公會成員偏好正規化在無 BOSS/時段選擇時不再誤丟 `auto_schedule` | Accepted | 2026-07-06 | backend / guild |
| [ADR-0012](0012-guide-widget-write-serialization.md) | 前端 guide-widget 寫入改為單一 widget 序列化佇列，取代逐次獨立 mutate | Accepted | 2026-07-07 | frontend / guide-widgets / party |
| [ADR-0013](0013-update-party-viewer-capabilities.md) | `UpdateParty`（PATCH /parties/{id}）回應補上 `ViewerCapabilities`，修正隱藏隊伍後隊長按鈕消失 | Accepted | 2026-07-07 | backend / party |
| [ADR-0014](0014-guest-party-interop-frontend-ui.md) | 訪客帳號建立/申請/管理一般即時隊伍的前端 UI 實作（身分收集元件、建隊畫面、申請流程、隊長操作、成員訪客標籤） | Accepted | 2026-07-07 | frontend / party / auth |
| [ADR-0015](0015-guest-standard-immediate-party-interop.md) | 訪客帳號與登入帳號整合：訪客可建立/申請/擔任一般即時隊伍隊長，登入時自動認領 | Accepted（部分推翻 guest-mode-plan.md Locked Decisions） | 2026-07-07 | backend / party / auth；frontend / party / auth |
| [ADR-0016](0016-guest-party-entry-point-parity.md) | 訪客一般隊伍入口一致性修正：Sidebar/MobileBottomNav 建隊選單、/find 申請入口比照 `canApplyAsGuest`（抽出共用判斷函式，補齊 ADR-0014/0015 遺留缺口） | Accepted | 2026-07-09 | frontend / party / auth |
| [ADR-0017](0017-job-classes-seed-cleanup.md) | `job_classes` 參考表殭屍列清理：一次性 migration 清除舊制 1-13 id ＋ `seedJobClasses()` 改為自帶同步清理語意，附部署前置稽核查詢 | Accepted | 2026-07-09 | backend / party / auth / user / guild |
| [ADR-0018](0018-create-party-desktop-wizard.md) | 建立隊伍桌機版改為分步 Step Wizard：抽出裝置無關的 `useWizardFieldErrors`/`CreatePartyWizardNav`，`.os-create-party-layout` 從 3 欄收斂為 2 欄（wizard | 常駐預覽）。與 `docs/create-party-desktop-wizard` 分支獨立撰寫的同編號 ADR-0018 撞號後已合併對方獨有細節（`CreatePartyFieldName`/`CreatePartyGuestFieldName` 泛型參數、`isMobile` 從 `scrollToField` 移除、560px 表單寬度理由、訪客已有身分時桌面自動跳頁邏輯），本檔為唯一權威版本，對方分支的重複檔案已移除。 | Accepted | 2026-07-09 | frontend / party |
| [ADR-0019](0019-guest-identity-reactivity-and-navbar-parity.md) | 訪客隊長身分跨元件同步（事件+storage 監聽）、Navbar 全站身分藥丸、編輯彈窗 | Accepted | 2026-07-09 | frontend / party / auth |
| [ADR-0020](0020-mobile-step4-preview-visibility.md) | 手機版建立隊伍 Step4（隊伍預覽）內容區空白修復：改用獨立 wrapper class，不再套用被 `@container shell-main` 隱藏的 `.os-create-preview-panel`，並新增 `hideSubmitButton` 避免按鈕重複 | Accepted | 2026-07-09 | frontend / party |
| [ADR-0021](0021-create-preview-bar-portal-visibility.md) | 桌機側欄擠窄 fallback bar（`.os-create-preview-bar`）可見性修復：portal 到 `<body>` 後 `@container shell-main` 結構性搆不到該節點，改用 `ResizeObserver` 驅動的 `shellMainNarrow` state 決定顯示 | Accepted | 2026-07-10 | frontend / party |
| [ADR-0022](0022-guest-create-party-mobile-submit-entry.md) | 訪客建立隊伍畫面新增手機版 step wizard 送出入口（比照 `CreatePartyScreen.tsx` 既有手機 wizard 機制，修正手機版無法觸及送出按鈕的問題）——原編號 ADR-0017，因與已合併進 backend develop 的 `job_classes` 清理 ADR 撞號而改編號 | Accepted | 2026-07-09 | frontend-rwd / party / auth |
| [ADR-0023](0023-create-party-wizard-step-merge-and-nav-reposition.md) | 建立隊伍 wizard 導覽列移至頂端、基本資料與規則合併為單一 step、送出動作併入 wizard nav 最後一步（依前端分支既有 commit `dc61592` 回溯記錄，更新 ADR-0018 步數） | Accepted | 2026-07-09 | frontend / party |
| [ADR-0024](0024-self-learning-loop.md) | 自我學習迴圈的架構、全域／專案分層與記憶儲存位置（全域 `~/.claude/` 機制 ＋ OneShort `.agent/learning/` 特化層）——原編號 ADR-0012，因與 [ADR-0012](0012-guide-widget-write-serialization.md)（guide-widget 寫入序列化，主題不同）撞號而改編號 | Accepted | 2026-07-07 | agent-governance / rules / skills / memory |
| [ADR-0025](0025-quick-party-guest-job-level-snapshot.md) | 快速隊伍訪客職業/等級快照：`FilledBy` 對快速隊伍訪客維持 nil（沿用 `TokenHash` 為唯一佔用真相來源，僅 `FilledByIsGuest`/`Name`/`Job`/`Level` 承載顯示快照）、`QuickApplication` 新增 `JobClass`/`Level` 補上 APPROVAL 房核准流程缺口、`QuickParticipant` 不重複補欄位 | Accepted | 2026-07-10 | backend / party |
| [ADR-0026](0026-quick-create-preview-removal.md) | 移除建立快速隊伍精靈的「隊伍預覽」面板（使用者明確產品決策：精靈簡化優先於預覽資訊量），連帶移除死 CSS 與原本專為預覽面板保留的 768px 兩欄 grid | Accepted | 2026-07-10 | frontend / party |
| [ADR-0027](0027-guest-mobile-create-submit-merge-resolution.md) | `fix/guest-mobile-create-submit` 合併 `develop` 時的決策：保留 ADR-0020 已上線的手機單一連續捲動修法，不採用該分支新增的獨立 4 步驟手機 wizard（避免手機/桌機步數不一致與重複 footer/portal JSX）。編號原訂 0025，因與另一支並行分支（快速隊伍訪客職業/等級快照工作）已搶先使用 ADR-0025/0026 撞號而改編號 | Accepted | 2026-07-10 | frontend / party / auth |
| [ADR-0028](0028-toast-severity-classification.md) | Toast 通知新增 `warning` 樣式（阻擋前提／狀態衝突，區別於 `error` 真失敗），統一 `lib/toast.ts`/`Toast.tsx` 型別系統並修正 3 處裸字串 toast state 靜默顯示綠色成功的既有 bug，新增 `API_ERROR_SEVERITY` 集中表 + `getApiErrorSeverity` 取代逐點硬寫 `type: 'error'` | Accepted | 2026-07-10 | frontend / party / guild / auth |
| [ADR-0029](0029-party-card-type-chip-reinstated.md) | 尋找隊伍卡片／預覽面板的「目標」旁重新加回隊伍類型 chip（抽出共用 `PartyTypeChip` 元件），推翻 `docs/frontend-logic.md` 一條早於 ADR 制度、無正式編號的既有決策（類型改由左側 Logo 傳達） | Accepted | 2026-07-11 | frontend / party |
| [ADR-0030](0030-guest-standard-party-my-party-visibility.md) | 訪客建立的一般隊伍加入「我的隊伍」可見範圍：沿用既有單一快速隊伍 session 機制（移除 `isConfirmedQuickGuestSession` 的 `is_quick` 硬性限制、`GuestCreatePartyScreen` 建立成功後補呼叫 `rememberQuickPartySession`），不新增後端契約；明確排除訪客以成員身分加入的情境（留作已知後續） | Accepted | 2026-07-11 | frontend / party / auth |
