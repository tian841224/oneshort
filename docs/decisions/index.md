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
| [ADR-0018](0018-create-party-desktop-wizard.md) | 桌面版建立隊伍改為導覽式 wizard：`useWizardFieldErrors`/`CreatePartyWizardNav` 共用件、`.os-create-party-layout` 三欄變兩欄 | Accepted | 2026-07-09 | frontend-rwd / party |
| [ADR-0019](0019-guest-identity-reactivity-and-navbar-parity.md) | 訪客隊長身分跨元件同步（事件+storage 監聽）、Navbar 全站身分藥丸、編輯彈窗 | Accepted | 2026-07-09 | frontend / party / auth |
