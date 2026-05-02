---
trigger: always_on
---

# Git 開發規範

修改 `frontend/` 或 `backend/` 前，必須先詢問使用者本次任務要使用 `BRANCH` 還是 `WORKTREE` 方式開發。**未確認前，不得自行建立 branch / worktree，也不得開始修改目標子專案內容。**

## Repository 邊界

本專案包含三個 Git repository：

- 根目錄 repository：只負責 `.agent/`、`docs/`、`AGENTS.md` 與其他協調性文件。
- `frontend/` repository：負責所有前端程式碼與前端文件。
- `backend/` repository：負責所有後端程式碼與後端文件。

## 啟動前確認規則

1. 修改 `frontend/` 或 `backend/` 前，必須先詢問使用者要採 `BRANCH` 或 `WORKTREE`。
2. 使用者未明確回覆前，不得直接建立 branch / worktree，也不得開始修改目標子專案檔案。
3. 同時修改前後端時，前端與後端必須各自在自己的 repository 內建立對應 branch 或 worktree；禁止用根目錄 repository 代替。
4. 根目錄 repository 僅用於維護 `.agent/`、`docs/`、`AGENTS.md` 等根層協調檔案。
5. 功能、修復與發版開發空間一律以對應子專案的**本機 `develop` branch** 為 base；hotfix 以本機 `main` 為 base。不得使用 `origin/develop` 或 `origin/main` 作為開發基底。

## Base Branch 規範

- 一般功能、修復與發版：以各子專案 repository 內的本機 `develop` 為基底。
- Hotfix：以各子專案 repository 內的本機 `main` 為基底。
- 建立 branch / worktree 前，先檢查目標 repository 狀態；若目前工作區有未提交變更，必須保留並避免覆蓋。
- 不得因為 `origin/develop` 較容易取得就直接以遠端分支為基底；本機 `develop` 可能包含尚未 push、但已是當前工作所需的修復。
- 可以在需要時 `fetch` 檢查遠端狀態，但 `fetch` 不代表改用 `origin/develop` 作為開發基底。
- 若本機 `develop` 或 `main` 不存在、落後情況不明，且任務需要建立開發空間，必須先回報狀態並取得使用者指示；不可改用 `origin/develop` / `origin/main` 作為開發基底。

## 分支命名規範

| 類型 | Branch 格式 | Base Branch | Worktree 目錄建議 |
|------|------|------|------|
| 新功能 | `feature/<功能描述>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\feature-<功能描述>` / `backend`: `..\\oneshort-backend-worktrees\\feature-<功能描述>` |
| 修復 bug | `fix/<問題描述>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\fix-<問題描述>` / `backend`: `..\\oneshort-backend-worktrees\\fix-<問題描述>` |
| 緊急修復 | `hotfix/<問題描述>` | 本機 `main` | `frontend`: `..\\oneshort-frontend-worktrees\\hotfix-<問題描述>` / `backend`: `..\\oneshort-backend-worktrees\\hotfix-<問題描述>` |
| 發版 | `release/<版本號>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\release-<版本號>` / `backend`: `..\\oneshort-backend-worktrees\\release-<版本號>` |

## BRANCH 模式規範

- 使用 `BRANCH` 模式時，必須在實際要修改的 repository 內建立專屬 branch。
- 禁止直接在 `main`、`develop` 或其他共享 branch 上進行功能性修改。
- 同時修改前後端時，前端與後端必須各自在自己的 repository 建立 branch。

```powershell
# Frontend 功能 / 修復
git -C frontend checkout develop
git -C frontend checkout -b feature/party-search
```

```powershell
# Backend 功能 / 修復
git -C backend checkout develop
git -C backend checkout -b fix/party-capacity-bug
```

```powershell
# Backend Hotfix
git -C backend checkout main
git -C backend checkout -b hotfix/login-redirect
```

## WORKTREE 模式規範

- 使用 `WORKTREE` 模式時，必須在實際要修改的 repository 內執行 `git worktree add`。
- 同時修改前後端時，前端與後端必須各自建立一個 worktree，禁止只在根目錄 repository 建一個 worktree 後同時承載兩邊程式碼變更。
- 根目錄 repository 不可拿來承載 `frontend/` 或 `backend/` 的功能開發分支；僅用於維護根層規則、文件與協調性設定。

## Worktree 建立流程

```powershell
# Frontend 功能 / 修復
git -C frontend worktree add ..\oneshort-frontend-worktrees\feature-party-search -b feature/party-search develop

# Backend 功能 / 修復
git -C backend worktree add ..\oneshort-backend-worktrees\fix-party-capacity-bug -b fix/party-capacity-bug develop

# Backend Hotfix
git -C backend worktree add ..\oneshort-backend-worktrees\hotfix-login-redirect -b hotfix/login-redirect main
```

若實際 worktree 或 staging 路徑包含括號等特殊字元，必須改成單引號包住整個字面參數，例如：

```powershell
git -C 'frontend' worktree add '..\staging (frontend)\feature-party-search' -b feature/party-search develop
```

## 核心規則

1. **先詢問再修改**：任何前端或後端任務，必須先確認使用者選擇 `BRANCH` 或 `WORKTREE`。
2. **模式確認後再建立環境**：確認模式後，才可建立對應 branch 或 worktree。
3. **一個任務對應一個開發空間**：每個 branch 或 worktree 只負責單一功能或修改目的。
4. **命名沿用同一套 Git Flow 規則**：不論使用 `BRANCH` 或 `WORKTREE`，branch 名稱都必須採 `feature/*`、`fix/*`、`hotfix/*`、`release/*`。
5. **前後端邊界不得混用**：前端與後端的 branch / worktree 必須建立在各自 repository，不得由根目錄 repository 代替。
6. **合併完成後必須清理**：使用 `WORKTREE` 時清理 worktree 與 branch；使用 `BRANCH` 時至少清理已合併 branch。

## Commit Message 格式（Conventional Commits）

```
<type>(<scope>): <簡短描述>
```

常用 type：`feat`、`fix`、`refactor`、`docs`、`test`、`chore`

## 觸發時機與對應 Workflow

| 情境 | 執行 Workflow / 指令 |
|------|--------------|
| 完成功能或修改，要提交目前 branch / worktree 內未提交的檔案 | `/commit-changes` |
| branch 或 worktree 內的功能分支開發完成，要合併回 `develop` | `/merge-to-develop` |
| 當使用者輸入「功能完成」 | 1. 提交所有未提交變更<br>2. 將分支合併回 `develop`<br>3. 刪除該功能分支（若是 worktree 則需先移除） |
| 任一分支已合併回 dev/develop | 在 `frontend` repository 執行 `npm run test:e2e`；必要時可先執行 `npm run test:e2e:smoke` 快速檢查核心路徑 |
| branch 已合併且不再需要 | `/delete-merged-branch` |
| worktree 已完成且不再需要 | 先執行 `git worktree remove <path>`，再執行 `/delete-merged-branch` |

## 清理流程

清理 branch 或 worktree 前，若本次分支已合併回 dev/develop，必須先確認 E2E 測試已執行且通過。新增或修改功能的分支，必須在合併前同步新增或修改 E2E 測試，覆蓋所有合理使用者情境。

```powershell
git -C frontend branch -d feature/party-search
git -C backend branch -d fix/party-capacity-bug
```

```powershell
git -C frontend worktree remove ..\oneshort-frontend-worktrees\feature-party-search
git -C frontend branch -d feature/party-search
```

```powershell
git -C backend worktree remove ..\oneshort-backend-worktrees\fix-party-capacity-bug
git -C backend branch -d fix/party-capacity-bug
```

若清理目標路徑含特殊字元，也必須加上單引號，例如 `git -C 'frontend' worktree remove '..\staging (frontend)\feature-party-search'`。
