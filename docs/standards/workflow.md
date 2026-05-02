# 開發流程與 Git 開發模式

修改 `frontend/` 或 `backend/` 前，必須先詢問使用者本次任務要採用 `BRANCH` 還是 `WORKTREE` 方式開發。確認模式後，才可建立對應 branch 或 worktree 並開始修改。

## Repository 邊界

本專案的 Git 邊界分為三層：

- 根目錄 repository：管理 `.agent/`、`docs/`、`AGENTS.md` 與其他跨專案協調檔案。
- `frontend/` repository：管理前端應用程式碼與前端文件。
- `backend/` repository：管理後端服務程式碼與後端文件。

**建立 branch 或 worktree 時，必須在實際修改的 repository 內操作：**

- 前端任務：在 `frontend/.git` 建立 branch 或 worktree。
- 後端任務：在 `backend/.git` 建立 branch 或 worktree。
- 前後端同步任務：前端與後端各自建立 branch 或 worktree，分別開發、驗證與提交。
- 禁止只在根目錄 repository 建立 branch 或 worktree 後，直接修改 `frontend/` 或 `backend/` 內容。

## 核心原則

1. 修改前先確認 `BRANCH` 或 `WORKTREE`，未確認前不得開始修改。
2. 每個任務對應一個 branch；若採 `WORKTREE`，再額外對應一個獨立 worktree。
3. 功能、修復與發版從對應子專案的本機 `develop` 建立；hotfix 從本機 `main` 建立。不得使用 `origin/develop` 或 `origin/main` 作為開發基底。
4. 任務完成並合併後，清理已合併 branch；若採 `WORKTREE`，需一併移除 worktree。
5. 前端與後端 branch / worktree 必須由各自 repository 建立，不得以根目錄 repository 取代。
6. 任何修改前，必須先理解對應模組的架構、責任邊界、資料流與既有模式，避免在未理解上下文前直接修補。
7. 修改必須優先維持一致性與高可維護性，不可為了省事引入重複邏輯、硬編碼、跨層繞路、效能退化或語意混亂的權宜寫法。
8. 開發或修改功能時，方案選擇應以最適合目前產品目標、架構一致性與長期維護的做法為優先，不以最簡單實作或為單一情境持續加特例為預設，避免例外流程、介面與程式碼持續碎片化。
9. 禁止為單一功能或條件撰寫專屬特例；除非該需求已納入正式規格，否則應優先透過既有契約、通用規則與一致抽象維持相容性，而不是新增只服務單一路徑的硬編碼分支。
10. 若現有架構已不適合承接新需求，必須適時提出重構計畫；不得把需求硬塞進既有分層或資料流，應先說明重構目標、影響範圍、相容策略、風險與分階段落地方式。
11. 新增或修改功能時，必須同步新增或修改 E2E 測試，並覆蓋所有合理使用者情境。
12. 任一分支合併回 dev/develop 後，必須執行 E2E 測試並確認通過，才可視為合併後驗證完成。
13. 開發前端時禁止使用假資料、假 API 欄位或後端不存在的格式；若缺少後端能力，必須先補後端契約與實作，再同步前端 types、API client 與 PRD / 文件。

## Base Branch 規範

- 一般功能、修復與發版：以各子專案 repository 內的本機 `develop` 為基底。
- Hotfix：以各子專案 repository 內的本機 `main` 為基底。
- 建立 branch / worktree 前，先檢查目標 repository 狀態；若目前工作區有未提交變更，必須保留並避免覆蓋。
- 不得因為 `origin/develop` 較容易取得就直接以遠端分支為基底；本機 `develop` 可能包含尚未 push、但已是當前工作所需的修復。
- 可以在需要時 `fetch` 檢查遠端狀態，但 `fetch` 不代表改用 `origin/develop` 作為開發基底。
- 若本機 `develop` 或 `main` 不存在、落後情況不明，且任務需要建立開發空間，必須先回報狀態並取得使用者指示；不可改用 `origin/develop` / `origin/main` 作為開發基底。

## 架構優先原則

- 修改前需先閱讀對應文件與程式碼入口，確認現有分層、資料流、事件流與狀態管理方式。
- 修改時應沿用既有抽象與模組邊界，不可把本應在不同層處理的責任硬塞進單一函式、元件或 handler。
- 方案選擇應優先考慮適切性與長期一致性，不因短期省事或單一情境需求而引入持續擴散的例外分支與碎片化設計。
- 需要保持相容性時，應優先調整通用規則、抽象邊界或資料契約，不以單點特判作為主要手段。
- 若新需求與現有架構明顯衝突，應主動提出重構方案，而不是持續在既有結構上堆疊例外處理。
- 若確實只能採用暫時方案，必須先說明與現有架構的差異、風險、可維護性影響與後續補強計畫，再取得確認。

## Branch 與 Worktree 命名

| 類型 | Branch 格式 | Base Branch | Worktree 路徑範例 |
|------|------|------|------|
| 新功能 | `feature/<功能描述>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\feature-<功能描述>` / `backend`: `..\\oneshort-backend-worktrees\\feature-<功能描述>` |
| 修復 bug | `fix/<問題描述>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\fix-<問題描述>` / `backend`: `..\\oneshort-backend-worktrees\\fix-<問題描述>` |
| 緊急修復 | `hotfix/<問題描述>` | 本機 `main` | `frontend`: `..\\oneshort-frontend-worktrees\\hotfix-<問題描述>` / `backend`: `..\\oneshort-backend-worktrees\\hotfix-<問題描述>` |
| 發版 | `release/<版本號>` | 本機 `develop` | `frontend`: `..\\oneshort-frontend-worktrees\\release-<版本號>` / `backend`: `..\\oneshort-backend-worktrees\\release-<版本號>` |

> `branch` 名稱使用 Git Flow 格式；`worktree` 目錄名稱請將 `/` 轉為 `-`，避免路徑層級混淆。以下路徑範例皆指「在對應子專案 repository 內執行」。
>
> 若在 PowerShell 中使用的 worktree、staging 或其他字面路徑包含 `(`、`)`、`[`、`]`、`&` 或空白，必須以單引號包住；若使用 PowerShell cmdlet，優先使用 `-LiteralPath`。

## 標準流程

### 1. 先確認開發模式

- 開始修改 `frontend/` 或 `backend/` 前，先詢問使用者本次任務要採 `BRANCH` 或 `WORKTREE`。
- 若同時修改前後端，兩邊都必須在各自 repository 內建立對應開發空間。

### 2. 使用 BRANCH 模式

```powershell
git -C frontend checkout develop
git -C frontend checkout -b feature/party-search
```

```powershell
git -C backend checkout develop
git -C backend checkout -b fix/party-capacity-bug
```

若為 hotfix，請改從本機 `main` 建立 branch。

### 3. 使用 WORKTREE 模式

```powershell
git -C frontend worktree add ..\oneshort-frontend-worktrees\feature-party-search -b feature/party-search develop
```

```powershell
git -C backend worktree add ..\oneshort-backend-worktrees\fix-party-capacity-bug -b fix/party-capacity-bug develop
```

若路徑本身含特殊字元，請改成：

```powershell
git -C 'frontend' worktree add '..\staging (frontend)\feature-party-search' -b feature/party-search develop
```

### 4. 建立 hotfix worktree

```powershell
git -C backend worktree add ..\oneshort-backend-worktrees\hotfix-login-redirect -b hotfix/login-redirect main
```

### 5. 在 branch 或 worktree 內開發與驗證

```powershell
Set-Location ..\oneshort-frontend-worktrees\feature-party-search
git status
```

若採 `WORKTREE` 模式且切換的目錄包含特殊字元，請改用 `Set-Location -LiteralPath '..\staging (frontend)\feature-party-search'`。

在對應 branch 或 worktree 內進行開發、執行測試、提交 commit。不得在未確認模式的情況下直接開始修改，也不得回到共享穩定分支持續承載功能性變更。

若任務同時涉及前後端，請分別切換到前端與後端各自的 branch / worktree 進行修改，不得在任一單一 repository 中承載另一側的程式碼變更。

新增或修改功能時，必須同步新增或修改 E2E 測試。E2E 應覆蓋所有合理使用者情境，至少包含主要成功路徑、失敗或拒絕路徑、權限/身分差異、空資料或邊界條件，以及受影響的通知、WebSocket 或跨頁流程。既有 E2E coverage map 以 [frontend/docs/e2e-scenarios.md](../../frontend/docs/e2e-scenarios.md) 為準。

### 6. 合併後清理

任一分支合併回 dev/develop 後，必須在 `frontend` repository 執行完整 E2E 測試：

```powershell
git -C frontend status
Push-Location frontend
npm run test:e2e
Pop-Location
```

必要時可先執行 `npm run test:e2e:smoke` 快速確認核心路徑，但 smoke 不得取代完整 `npm run test:e2e`。

```powershell
git -C frontend branch -d feature/party-search
```

```powershell
git -C frontend worktree remove ..\oneshort-frontend-worktrees\feature-party-search
git -C frontend branch -d feature/party-search
```

若清理的 worktree 路徑包含特殊字元，請改用 `git -C 'frontend' worktree remove '..\staging (frontend)\feature-party-search'`。

若 branch 尚未合併，`git branch -d` 會拒絕刪除；此時先完成合併，再清理 branch。

## Workflow 對應

| 情境 | 建議操作 |
|------|------|
| 提交目前 branch / worktree 內變更 | `/commit-changes` |
| branch 或 worktree 內功能完成，要合併回 `develop` | `/merge-to-develop` |
| 當使用者輸入「功能完成」 | 1. 提交所有未提交變更<br>2. 將分支合併回 `develop`<br>3. 刪除該功能分支（若是 worktree 則需先移除） |
| 任一分支合併回 dev/develop 後 | `npm run test:e2e` |
| 合併後清理 branch | `/delete-merged-branch` |
| 清理本機 worktree 目錄 | `git worktree remove <path>` |

## 禁止事項

- 禁止在未詢問並確認 `BRANCH` / `WORKTREE` 前直接開始修改。
- 禁止直接在目前主工作目錄的 `main`、`develop` 或其他共享穩定 branch 上承載功能開發。
- 禁止在同一個 worktree 混入多個任務。
- 禁止同一 branch 被多個 worktree 同時使用。
- 禁止在根目錄 repository 建立 branch 或 worktree 後直接修改 `frontend/` 或 `backend/` 程式碼。
