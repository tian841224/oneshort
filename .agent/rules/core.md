---
trigger: always_on
---

# 核心開發規範 (Core Rules)

本文件合併全域規範與 Git 開發流程，為所有任務的基礎規則。

## 1. Repository 邊界

- 根目錄 repository：`.agent/`、`docs/`、`AGENTS.md` 與協調性文件。
- `frontend/` repository：前端程式碼與文件。
- `backend/` repository：後端程式碼與文件。
- 前後端 branch / worktree 必須在各自 repository 內建立，禁止用根目錄代替。

## 2. 啟動前確認

修改 `frontend/` 或 `backend/` 前，**必須先詢問使用者採 `BRANCH` 或 `WORKTREE`**。未確認前，不得建立 branch / worktree 或修改子專案。

## 3. 架構優先原則

- 先理解模組責任與資料流再修改。禁止圖快的低維護方案。
- 除非正式規格，否則不為單一功能撰寫硬編碼特例。
- 商業邏輯或 API 行為異動時，程式碼與文件必須同步更新。
- 若現有架構不適合新需求，應先提出重構方案，不持續堆疊例外。

## 4. 前後端同步

- **後端優先**：API 結構變動時，必須同步更新前端 `lib/api`、types 與錯誤處理。
- **類型一致**：前端 TypeScript interface 應與後端傳輸結構保持高度一致。
- **禁止假契約**：前端不得使用假資料或後端不存在的格式；缺少後端能力時先補後端。

## 5. Base Branch 規範

- 功能 / 修復 / 發版：以各子專案本機 `develop` 為基底。
- Hotfix：以本機 `main` 為基底。
- 不得以 `origin/develop` 或 `origin/main` 作為開發基底。
- 若本機 `develop` / `main` 狀態不明，先回報並取得使用者指示。

## 6. 分支命名

| 類型 | Branch 格式 | Base | Worktree 目錄 |
|------|------|------|------|
| 新功能 | `feature/<功能>` | `develop` | `..\\oneshort-{fe\|be}-worktrees\\feature-<功能>` |
| 修復 | `fix/<問題>` | `develop` | `..\\oneshort-{fe\|be}-worktrees\\fix-<問題>` |
| 緊急修復 | `hotfix/<問題>` | `main` | `..\\oneshort-{fe\|be}-worktrees\\hotfix-<問題>` |
| 發版 | `release/<版號>` | `develop` | `..\\oneshort-{fe\|be}-worktrees\\release-<版號>` |

## 7. BRANCH 模式

```powershell
git -C frontend checkout develop
git -C frontend checkout -b feature/party-search
```

## 8. WORKTREE 模式

```powershell
git -C frontend worktree add ..\oneshort-frontend-worktrees\feature-party-search -b feature/party-search develop
```

若路徑含特殊字元，須以單引號包住。

## 9. Commit Message（Conventional Commits）

```
<type>(<scope>): <簡短描述>
```

常用 type：`feat`、`fix`、`refactor`、`docs`、`test`、`chore`

## 10. Workflow 觸發

| 情境 | 操作 |
|------|------|
| 提交變更 | `/commit-changes` |
| 合併回 develop | `/merge-to-develop` |
| 使用者說「功能完成」 | 提交 → 合併 → 刪除分支 |
| 合併後 | 在 `frontend` 執行 `npm run test:e2e` |
| 清理 worktree | `git worktree remove <path>` → `/delete-merged-branch` |

## 11. 清理與 E2E

- 合併回 develop 前，新增/修改功能必須同步更新 E2E 測試。
- 合併後必須確認 E2E 通過，才視為完成。

## 12. 錯誤反思機制

出現編譯失敗、測試不過或執行異常時：
1. 找出根因，不僅修表面症狀。
2. 記錄避免方式到 [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)。
3. 確保未來不重複同樣錯誤。
