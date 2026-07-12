# OneShort - Agent Entry Point

本檔保留 AI agent 入口索引與讀取策略；詳細規則放在 `.agent/rules/`。不要把所有規則全文複製到這裡。

## 規則載入

| 規則 | 觸發 | 內容 |
|------|------|------|
| [core.md](.agent/rules/core.md) | always_on | ROOT 邊界、Git Flow、跨 repo 協調規則、反思機制 |
| [docs-router.md](.agent/rules/docs-router.md) | always_on | ROOT 自己的文件路由；backend/frontend 任務改讀對應 repo 的路由表 |
| [learning.md](.agent/rules/learning.md) | always_on | 自我學習迴圈：教訓擷取、記憶蒸餾、升級與修剪 |
| [backend.md](.agent/rules/backend.md) / [frontend.md](.agent/rules/frontend.md) / [style.md](.agent/rules/style.md) | 各自子路徑 | **已遷移為指標**——完整規則見 `backend/AGENTS.md`、`frontend/AGENTS.md`、`frontend/docs/style.md`（各 repo 自足，不依賴本檔） |

## 強制啟動載入（Codex / Gemini 適用）

> 開始任何任務前，必須先依序讀取以下三個檔案，再繼續：
> 1. `.agent/rules/core.md`
> 2. `.agent/rules/docs-router.md`
> 3. `.agent/rules/learning.md`

讀完後，依 docs-router.md 的路由表，只載入當前任務命中的關聯文件。

## 開發守則

- **先讀規則再動手**：修改 `backend/` 或 `frontend/` 前，先讀該 repo 自己的 `AGENTS.md`（自足、不依賴本檔）；只在 ROOT 範圍內工作（`.agent/`、`docs/`、`AGENTS.md`）時才讀本檔與 `.agent/rules/`。
- **按任務讀文件**：先讀 [docs-router.md](.agent/rules/docs-router.md)，只載入與當前任務命中的關聯文件；禁止因為文件存在就大範圍遞迴讀取。
- **前端 UI/UX 必讀樣式規範**：任何修改前端 UI、UX、版面、元件視覺、互動文案或響應式行為前，必須先讀取 `frontend/docs/style.md`，並依其設計語言與 Golden Rules 實作。
- **同步更新文件**：程式碼變更與對應文件更新必須在同一任務內完成（各 repo 對象見該 repo 自己的 `AGENTS.md`）。

## Skill 來源

| Agent | Skills 路徑 |
|-------|------------|
| Claude Code | `.claude/skills/` |
| Codex | `.codex/skills/` |

Project-local skill 以 `.claude/skills/` 為 canonical source；`.codex/skills/` 保留同步副本供 Codex 讀取。

## 各 Agent 讀取路徑

| Agent | Rules | Skills |
|-------|-------|--------|
| Claude Code | `CLAUDE.md` @import → `.agent/rules/` | `.claude/skills/` |
| Codex | `AGENTS.md` → `.agent/rules/` | `.codex/skills/` |
| Gemini | `AGENTS.md` → `.agent/rules/` | — |
