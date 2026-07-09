# OneShort - Agent Entry Point

本檔保留 AI agent 入口索引與讀取策略；詳細規則放在 `.agent/rules/`。不要把所有規則全文複製到這裡。

## 規則載入

| 規則 | 觸發 | 內容 |
|------|------|------|
| [core.md](.agent/rules/core.md) | always_on | 邊界、Git Flow、架構原則、反思機制 |
| [docs-router.md](.agent/rules/docs-router.md) | always_on | 任務導向文件路由；只讀命中的關聯文件 |
| [learning.md](.agent/rules/learning.md) | always_on | 自我學習迴圈：教訓擷取、記憶蒸餾、升級與修剪 |
| [backend.md](.agent/rules/backend.md) | `backend/**/*` | 後端架構、驗證、完成條件 |
| [frontend.md](.agent/rules/frontend.md) | `frontend/**/*` | 前端技術棧、驗證、完成條件 |
| [style.md](.agent/rules/style.md) | UI/UX 任務 | 前端設計語言、視覺樣式與 Golden Rules |

## 強制啟動載入（Codex / Gemini 適用）

> 開始任何任務前，必須先依序讀取以下三個檔案，再繼續：
> 1. `.agent/rules/core.md`
> 2. `.agent/rules/docs-router.md`
> 3. `.agent/rules/learning.md`

讀完後，依 docs-router.md 的路由表，只載入當前任務命中的關聯文件。

## 開發守則

- **先讀規則再動手**：所有開發行為必須符合 `.agent/rules/` 下的定義。
- **按任務讀文件**：先讀 [docs-router.md](.agent/rules/docs-router.md)，只載入與當前任務命中的關聯文件；禁止因為文件存在就大範圍遞迴讀取。
- **前端 UI/UX 必讀樣式規範**：任何修改前端 UI、UX、版面、元件視覺、互動文案或響應式行為前，必須先讀取 [style.md](.agent/rules/style.md)，並依其設計語言與 Golden Rules 實作。
- **同步更新文件**：程式碼變更與對應文件更新必須在同一任務內完成。

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
