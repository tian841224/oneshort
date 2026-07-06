---
name: evolve
description: 執行自我學習迴圈的週期回顧：蒸餾 inbox、驗證與修剪 MEMORY、把重複教訓升級為 rules/skills/ADR。當使用者說「每週回顧」「整理記憶」「/evolve」，或 inbox 未處理 ≥5、MEMORY 逼近 50 條上限時使用。
---

# Evolve — 週期回顧與記憶蒸餾（OneShort 入口）

> 迴圈的**權威定義**在全域 `~/.claude/rules/learning.md` §4／§6（Claude Code 使用者用全域 `evolve` skill）；OneShort 特化見 `.agent/rules/learning.md`。本副本供 Codex 在 OneShort 內使用，聚焦專案記憶層 `.agent/learning/`。

## 步驟

1. **讀取全貌**：讀 `.agent/rules/learning.md`、`.agent/learning/inbox.md`、`.agent/learning/MEMORY.md` 全文；跨專案通用條目的回顧交由全域層處理。
2. **蒸餾 inbox**：每條未處理條目改寫為「可操作的一句話＋適用時機」，併入 MEMORY.md 對應分區（先查重、可合併就合併）；處理完自 inbox 移除，恢復「（目前無未處理條目）」。過程中若發現條目其實跨專案通用，改記全域 `~/.claude/memory/`（或回報使用者代記）。
3. **驗證 MEMORY.md**：逐條檢查引用的檔案／指令／行為是否仍成立——用實際讀檔或指令確認，**不憑印象**。被證偽的刪除；無法驗證的標「待驗證」。
4. **偵測無效教訓**：檢查是否有「記錄後同類錯誤仍再度發生」的條目（比對 git log、inbox 新條目、反思事件）；命中者視為無效，強制升級。
5. **升級**（重複 ≥2 次或結構性教訓）：
   - rule → 編輯 `.agent/rules/` 對應檔案。
   - skill → 更新 `.claude/skills/<name>/`（canonical）並同步 `.codex/skills/<name>/`。
   - ADR → 依 `docs/decisions/index.md` 新增並更新索引。
   升級後把 MEMORY.md 原條目刪除或改為一行指標。
6. **修剪**：確保條目 ≤50；更新表頭「上次蒸餾」「上次回顧」「條目數」。
7. **回顧報告**：蒸餾／合併／升級（到哪些檔案）／刪除幾條、無效教訓清單。
8. **提交**：不主動 commit；提示使用者以 `/commit-changes` 提交。

## 注意

- 驗證步驟（3）是核心，不可省略；沒有驗證的回顧視同未完成。
- 條目不得包含秘密；發現既有條目含敏感值時立即改寫為名稱引用。
