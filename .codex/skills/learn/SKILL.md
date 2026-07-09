---
name: learn
description: 擷取一條教訓並依 OneShort 記憶分流寫入對應層。當使用者說「記住」「記錄教訓」「下次注意」「/learn」，或自我學習迴圈擷取觸發命中且要當場處理時使用。
---

# Learn — 擷取教訓（OneShort 入口）

> 迴圈與格式的**權威定義**在全域 `~/.claude/rules/learning.md`（Claude Code 使用者用全域 `learn` skill）；OneShort 專案特化見 `.agent/rules/learning.md`。本副本供 Codex 在 OneShort 內使用。

## 步驟

1. **讀規則**：讀 `.agent/rules/learning.md`（OneShort 分流與串接）。判斷格式與去向時參照全域 learning.md §3–§5（讀不到全域檔時，格式見下方「格式」）。
2. **釐清事件**：發生了什麼、錯誤假設是什麼、正確做法是什麼。資訊不足直接問使用者，不得腦補。
3. **分流**（`.agent/rules/learning.md` §2）：
   - 跨專案通用 → 全域 `~/.claude/memory/inbox.md`（Codex 環境讀不到時，回報使用者代記於全域）。
   - OneShort 專屬 → `.agent/learning/inbox.md`。
   - 方案取捨／架構決策 → ADR（`docs/decisions/`），依 core.md §3.1；inbox 只記一行指回。
4. **寫入 inbox**：依下方格式 append 一條。
5. **立即蒸餾（條件式）**：教訓明確可概括時，直接寫入對應 `MEMORY.md` 分區並自 inbox 移除（先查重、注意 50 條上限與表頭條目數）。
6. **升級判斷**：同類教訓第 ≥2 次出現時，建議升級為 rule／skill／ADR 並在回報中提出。
7. **回報**：記錄了什麼、放哪一層哪個分區、是否建議升級。

## 格式

- inbox：`## YYYY-MM-DD｜類型: 糾正/錯誤/發現/指示｜專案: oneshort｜來源: <事件>` ＋ `情境`／`教訓`／`建議去向` 三行。
- MEMORY：`- **[M-NNN]** 教訓一句話。適用：時機。（來源: <事件>, 記錄: YYYY-MM-DD）`

## 注意

- 不得寫入秘密（token／密碼／連線字串／個資）；環境變數只記名稱。`.agent/learning/` 進版控尤須嚴守。
- 不主動 commit；由使用者觸發 `/commit-changes`。
