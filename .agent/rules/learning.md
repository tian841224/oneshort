---
trigger: always_on
---

# 自我學習迴圈 — OneShort 專案特化層

> **權威定義在全域 `~/.claude/rules/learning.md`**：迴圈五步（擷取→蒸餾→升級→修剪→驗證）、擷取觸發、蒸餾／升級／修剪規則、格式、誠實與安全邊界，全部以全域檔為準，本檔不重複。
> 本檔只定義 OneShort 的**專案特化**：七層架構如何映射到本 repo、專案記憶存哪、與既有規則的串接。設計取捨見 [ADR-0024](../../docs/decisions/0024-self-learning-loop.md)。

## 1. 七層架構在 OneShort 的落點

| 層 | 全域對應 | OneShort 專案落點 |
|---|---------|------------------|
| 1 核心規則 | `~/.claude/CLAUDE.md`、`~/.claude/rules/` | `CLAUDE.md`／`AGENTS.md` @import → `.agent/rules/` |
| 2 技能 | `~/.claude/skills/`（含全域 `learn`／`evolve`） | `.claude/skills/`（canonical）＋ `.codex/skills/`（Codex 同步副本） |
| 3 精煉記憶 | `~/.claude/memory/`（跨專案通用） | `.agent/learning/MEMORY.md`＋`inbox.md`（**OneShort 專屬**教訓） |
| 4 使用者畫像 | 全域設定與 per-agent 全域記憶 | 專案層協作偏好差異記在 `.agent/learning/` 或全域，視是否通用 |
| 5 對話歷史 | git log／per-agent session | git log、ADR（`docs/decisions/`）、PR 描述 |
| 6 生命週期自動化 | 全域 learning.md §2 擷取觸發 | core.md §12 反思 → inbox；`learn`／`evolve` skills |
| 7 多平台門面 | — | AGENTS.md「各 Agent 讀取路徑」：Claude Code／Codex／Gemini |

## 2. OneShort 的記憶分流

依全域 learning.md §3 分流，套用到本專案：

- **跨專案通用**教訓（Windows 工具鏈、通用方法論等）→ 全域 `~/.claude/memory/`，**不放**本 repo。
- **OneShort 專屬**教訓（前後端 env、E2E 基線、repo 邊界、業務規則陷阱等）→ `.agent/learning/`（inbox.md → MEMORY.md）。
  - OneShort 專案記憶**刻意用 repo 內 `.agent/learning/`**（而非 Claude Code 內建 per-project 記憶），因為要跨 agent（Claude Code／Codex／Gemini）共享且進版控、clone 帶著走——符合本專案既有多 agent 治理架構。
- **方案取捨／架構決策** → ADR（`docs/decisions/`），依 [core.md §3.1](core.md#31-修正方案評估準則)；inbox 只記一行指回該 ADR。

## 3. 串接點

- **擷取**：[core.md §12 錯誤反思機制](core.md#12-錯誤反思機制) 第 4 點 → 寫入 `.agent/learning/inbox.md`。
- **路由**：[docs-router.md](docs-router.md)「記錄教訓／自我學習」列 → 本檔 ＋ `.agent/learning/MEMORY.md` ＋ `learn`／`evolve` skills。
- **決策**：[ADR-0024](../../docs/decisions/0024-self-learning-loop.md) 記錄本迴圈的架構、被拒方案與全域／專案分層取捨。（原編號 ADR-0012，因與已合併進 develop 的 [ADR-0012](../../docs/decisions/0012-guide-widget-write-serialization.md)（guide-widget 寫入序列化）撞號而改編號，見 `docs/decisions/index.md`。）

## 4. 安全邊界（專案層強化）

`.agent/learning/` **進版控**，因此比全域 `~/.claude/memory/` 更嚴格：**禁止寫入任何秘密**（token、密碼、連線字串、個資），環境變數只記名稱、不記值。其餘誠實性規範沿用全域 learning.md §7。
