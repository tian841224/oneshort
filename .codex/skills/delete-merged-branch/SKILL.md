---
name: delete-merged-branch
description: 安全刪除已合併回 develop 的分支與對應 worktree。合併完成後的清理階段，或使用者說「刪除分支」「清理 worktree」時使用。
---

# Delete Merged Branch

清理已合併的分支與 worktree（core.md §10「清理 worktree」）。

## 步驟

1. **確認已合併**：`git -C <repo> branch --merged develop` 必須包含目標分支；未列出時停止並回報，禁止以 `-D` 強制刪除未合併分支。
2. **先移除 worktree**（若該分支以 WORKTREE 模式建立）：`git -C <repo> worktree remove <path>`；worktree 內有未提交變更時停止並回報，不使用 `--force`。
3. **刪除分支**：`git -C <repo> branch -d <branch>`。
4. **驗證**：以 `git -C <repo> branch` 與 `git -C <repo> worktree list` 確認分支與 worktree 皆已清除。
