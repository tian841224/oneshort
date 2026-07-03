---
name: merge-to-develop
description: 將功能／修復分支合併回本機 develop，並執行合併後 E2E 驗證。當使用者說「合併回 develop」「merge to develop」，或「功能完成」流程進入合併階段時使用。
---

# Merge to Develop

依 `.agent/rules/core.md` §10–§11 將目前分支合併回本機 `develop`。

## 前置檢查

1. 目前分支所有變更已提交（必要時先執行 `commit-changes` skill）。
2. 新增／修改功能必須已同步更新 E2E 測試（core.md §11）；未更新前不得合併。

## 步驟

1. `git -C <repo> checkout develop`（以本機 `develop` 為準，不得以 `origin/develop` 為基底）。
2. `git -C <repo> merge <branch>`；發生衝突時逐檔解決並回報解法，不可盲目取單邊。
3. 合併後於 `frontend` 執行 `npm run test:e2e`；通過才視為完成（core.md §10–§11）。
4. E2E 失敗時依 core.md §12 錯誤反思機制追根因，禁止以最小修補繞過。
5. 完成後視情境接續 `delete-merged-branch` skill 清理分支與 worktree。
