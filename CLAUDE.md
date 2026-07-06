@AGENTS.md

@.agent/rules/core.md

@.agent/rules/docs-router.md

@.agent/rules/learning.md

## Agent 行為規範

執行多階段任務時：
- 自行拆分成 subagents 平行執行，不需要逐步確認
- phase 之間自行判斷完成條件，自動推進
- 只有遇到 ambiguous 的需求或破壞性操作才中斷問使用者
- **例外**：修改 `frontend/`／`backend/` 前的 BRANCH／WORKTREE 選擇，依 `.agent/rules/core.md` §2 **必須**中斷詢問使用者，不受上述「不需逐步確認」約束