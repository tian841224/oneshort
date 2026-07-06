---
name: evolve
description: 執行自我學習迴圈的週期回顧：蒸餾 inbox、驗證與修剪 MEMORY.md、把重複教訓升級為 rules/skills/ADR。當使用者說「每週回顧」「整理記憶」「/evolve」，或 inbox 未處理條目 ≥5、MEMORY.md 逼近 50 條上限時使用。
---

# Evolve — 週期回顧與記憶蒸餾

依 `.agent/rules/learning.md` §4／§6，對整個記憶層做一次完整的「蒸餾 → 驗證 → 升級 → 修剪」。

## 步驟

1. **讀取全貌**：讀 `.agent/rules/learning.md`、`.agent/learning/inbox.md`、`.agent/learning/MEMORY.md` 全文。
2. **蒸餾 inbox**：每條未處理條目改寫為「可操作的一句話＋適用時機」，併入 MEMORY.md 對應分區（先查重、可合併就合併）；處理完的條目自 inbox 移除，inbox 恢復為「（目前無未處理條目）」。
3. **驗證 MEMORY.md**：逐條檢查引用的檔案／指令／行為是否仍成立——用 Read／Glob／Grep 或實際指令確認，**不憑印象**。被證偽的條目刪除；暫時無法驗證的標註「待驗證」。
4. **偵測無效教訓**：檢查是否有「記錄後同類錯誤仍再度發生」的條目（比對近期 git log、inbox 新條目、對話中的反思事件）；命中者視為無效，強制進入升級。
5. **升級**：依 learning.md §4.2 的去向表處理重複 ≥2 次或結構性的教訓：
   - rule → 編輯 `.agent/rules/` 對應檔案。
   - skill → 新增／更新 `.claude/skills/<name>/SKILL.md`，並同步複製到 `.codex/skills/<name>/`。
   - ADR → 依 `docs/decisions/index.md` 規則新增 ADR 並更新索引。
   升級後把 MEMORY.md 原條目刪除或改為一行指標。
6. **修剪**：確保條目 ≤50；更新表頭「上次蒸餾」「上次回顧」「條目數」。
7. **回顧報告**：輸出本次結果——蒸餾幾條、合併幾條、升級幾條（到哪些檔案）、刪除幾條、無效教訓清單；有升級動作時逐一列出變更檔案。
8. **提交**：不主動 commit；提示使用者以 `/commit-changes` 提交（或依使用者既有授權處理）。

## 注意

- 驗證步驟（3）是本 skill 的核心，不可省略；沒有驗證的回顧視同未完成。
- 條目不得包含秘密；發現既有條目含敏感值時立即改寫為名稱引用。
