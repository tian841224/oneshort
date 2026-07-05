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
| [ADR-0003](0003-mobile-chat-sheet-close-button.md) | 行動版聊天／小工具 sheet 新增顯式關閉鈕；peek 狀態維持非模態 | Accepted | 2026-07-05 | frontend-rwd / chat |
| [ADR-0009](0009-silent-background-guide-state-writes.md) | 自動背景 guide-state 寫入（成員顏色）在雙重衝突時不彈出使用者錯誤提示 | Accepted | 2026-07-05 | frontend / guide-widgets / party |
