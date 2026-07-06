---
name: learn
description: 擷取一條教訓寫入 .agent/learning/inbox.md，並視情況立即蒸餾進 MEMORY.md。當使用者說「記住」「記錄教訓」「下次注意」「/learn」，或 learning.md §3 擷取觸發命中且要當場完整處理時使用。
---

# Learn — 擷取教訓

依 `.agent/rules/learning.md` 的自我學習迴圈，把本次事件的教訓落地。

## 步驟

1. **讀規則與現況**：讀 `.agent/rules/learning.md`（§3 觸發、§4 去向、§5 格式）與 `.agent/learning/inbox.md`。
2. **釐清事件**：發生了什麼、當時的錯誤假設是什麼、正確做法是什麼。從對話上下文還原；資訊不足時直接問使用者，**不得腦補**。
3. **判斷去向**：
   - 方案取捨／架構決策 → 走 ADR（core.md §3.1），inbox 只記一行指回該 ADR。
   - 行為準則、程序、環境事實 → 寫入 inbox。
4. **寫入 inbox**：依 learning.md §5.1 格式 append 一條（日期、類型、來源、情境、教訓、建議去向）。
5. **立即蒸餾（條件式）**：教訓已明確、可概括、且非一次性瑣事時，直接依 §5.2 格式寫入 `.agent/learning/MEMORY.md` 對應分區並自 inbox 移除；寫入前先檢查是否與既有條目重複（重複則合併並更新日期）。注意 50 條上限與表頭「條目數」同步。
6. **升級判斷**：若這是同類教訓第 ≥2 次出現，依 learning.md §4.2 建議升級成 rule／skill／ADR，並在回報中明確提出。
7. **回報**：記錄了什麼、放在哪個檔案哪個分區、是否建議升級。

## 注意

- 條目不得包含秘密（token、密碼、連線字串、個資）；環境變數只記名稱。
- 不主動 commit；由使用者觸發 `/commit-changes`。
