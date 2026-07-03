---
name: commit-changes
description: 依 OneShort core.md §9 Conventional Commits 規範提交變更。當使用者說「提交變更」「commit」，或 workflow 觸發表命中「提交變更」時使用。適用 root／frontend／backend 三個獨立 repo。
---

# Commit Changes

依 `.agent/rules/core.md` §9（Conventional Commits／Semantic Release）提交目前變更。

## 步驟

1. **判斷變更所屬 repo**：root、`frontend/`、`backend/` 是三個獨立 git repo。以 `git -C <repo> status --short` 分別確認；跨 repo 的變更必須分別提交，不可混入同一個 commit。
2. **檢視 diff**：`git -C <repo> diff` 與 `git -C <repo> diff --staged`（含 untracked），歸納變更性質，決定 type（`feat`／`fix`／`refactor`／`docs`／`test`／`chore`）與 scope。
3. **只暫存本次任務相關檔案**：明確列出檔名 `git add <files>`；工作樹存在無關變更時，禁止使用 `git add -A` 或 `git add .`。
4. **提交**：訊息格式 `<type>(<scope>): <簡短描述>`；重大變更須在 body 加入 `BREAKING CHANGE`（會觸發 Major 版號）。
5. **驗證**：`git log -1 --format=%s` 確認訊息符合格式（Semantic Release 依賴此格式產生版號與 changelog）。

## 注意

- Commit message 使用英文，type／scope 依 core.md §9。
- 未經使用者指示，禁止 push。
