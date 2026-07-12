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

修改 `frontend/` 或 `backend/` 前，**必須先詢問使用者採 `BRANCH` 或 `WORKTREE`**。未確認前，不得建立 branch / worktree 或修改子專案。根目錄協調性文件變更不受此限，見 [§6.1](#61-根目錄協調性文件-worktree)。

## 3. 架構優先原則

> [!NOTE]
> 本節通用原則已實體化至各 repo；本節內容為 ROOT 適用範圍。架構優先、修正方案評估準則（禁止最小範圍修正、方案評估三前提、驗證義務）等通用開發原則，**完整實體化**於 [backend/AGENTS.md](../../backend/AGENTS.md) 與 [frontend/AGENTS.md](../../frontend/AGENTS.md)（各自 §4-5）——這是使用者已知並接受的取捨：三處內容各自獨立維護，修改通用原則時三處都要同步更新，不集中管理。修改 `backend/` 或 `frontend/` 程式碼與文件的任務，直接讀對應 repo 的 `AGENTS.md`，不需要回頭讀本節。

本節只列 ROOT repo 本身（`.agent/`、`docs/`、`AGENTS.md`）適用的部分：

- 先理解 ROOT 文件的協調角色再修改：ROOT 只放導覽、系統簡介、功能總覽，不放前端或後端的實作細節（見 [docs/index.md](../../docs/index.md) 開頭說明）。
- **ROOT 文件過期必須同步更新或移除**：`docs/features/*.md`、`docs/system-overview.md`、ADR 的「已知後續」段落等一旦被新內容取代，必須同步更新或移除過期段落，不得留下與現況矛盾的內容誤導後續讀者。範例見 [docs/features/guest-mode-plan.md](../../docs/features/guest-mode-plan.md)（ADR-0015 推翻部分內容後明確標註並更新現況表）與 [ADR-0014](../../docs/decisions/0014-guest-party-interop-frontend-ui.md)（由 ADR-0016 補註「後續更新」段落）。
- **跨 repo 路徑/版本號變更的文件同步陷阱**：純文字端點路徑或版本號（如 `/api/v2/xxx`）不是 markdown 連結，一般連結完整性檢查抓不到，必須額外對「已知路徑前綴／版本號」做全文 grep 才抓得到，backend/frontend 各自 repo 內同理（見各自 AGENTS.md §4）。反例：backend commit `a37d1dd`（2026-06-15）把路由前綴從 `/api/v1` 改成 `/api/v2`，只改了 `cmd/server/main.go`，未同步任何文件，導致 backend 與 root 兩個 repo 共 400+ 處文件錯誤沿用 `/api/v1` 長達一個月才被發現（見 [.agent/learning/inbox.md](../learning/inbox.md) 2026-07-11 條目）。

### 3.1 修正方案評估準則

> [!NOTE]
> 本節為 ROOT 文件變更適用；程式碼變更見各 repo AGENTS.md §5。

ROOT 本身只放文件，多數變更屬局部修正即可（更新總覽段落、修正連結）。仍涉及方案取捨的決策（例如文件架構本身的重新設計）時：

1. 列舉至少兩個方案並評估維護性/安全性；決策落地強制記錄為 ADR（[docs/decisions/index.md](../../docs/decisions/index.md)）。
2. **修改前必查 ADR**：先檢查 `docs/decisions/index.md` 是否已有相關決策，若有必須先讀取並遵守，不得不知情下重複調整或推翻。需要正式推翻時依該索引文件的「推翻舊決策」流程處理，不得直接覆蓋。

完整版（含三前提評估細節、例外條款、驗證義務）見 [backend/AGENTS.md §5](../../backend/AGENTS.md#5-修正方案評估準則) 或 [frontend/AGENTS.md §5](../../frontend/AGENTS.md#5-修正方案評估準則)，兩者內容一致，ROOT 文件變更可直接套用。

## 4. 前後端同步（跨 repo 協調視角）

本節是**真正跨 repo**的協調規則：只有同時涉及 backend 與 frontend 兩端變更的任務才適用；單一 repo 內的 API 契約責任（後端優先、禁止假契約、類型一致）已分別materialize 到 [backend/AGENTS.md §7](../../backend/AGENTS.md#7-api-契約與前端同步backend-視角) 與 [frontend/AGENTS.md §7](../../frontend/AGENTS.md#7-api-契約與後端同步frontend-視角)。

- **雙向同步檢查**：無論是前端或後端單方調整功能（新增、修改或移除 API、事件、UI 流程），都必須同步確認另一端是否需要對應更新。若確定另一端暫時不會串接／實作，該功能在完成的那一端必須明確停用（如註解路由註冊）並在程式碼與 commit/PR 說明中註明「等待前後端另一端補齊」，不得讓功能長期處於「一端已完成、另一端完全沒有消費」的孤立狀態。
- 協調層（人類或編排多 repo 工作的 agent）在收尾前應檢查兩端 repo 的 commit 是否對齊，避免其中一端遺漏。

## 5. Base Branch 規範

- 功能 / 修復 / 發版：以各子專案本機 `develop` 為基底。
- Hotfix：以本機 `main` 為基底。
- 不得以 `origin/develop` 或 `origin/main` 作為開發基底。
- 若本機 `develop` / `main` 狀態不明，先回報並取得使用者指示。

## 6. 分支命名

| 類型 | Branch 格式 | Base | Worktree 目錄（相對於 oneshort 根目錄） |
|------|------|------|------|
| 新功能 | `feature/<功能>` | `develop` | `oneshort-{frontend\|backend}-worktrees\feature-<功能>` |
| 修復 | `fix/<問題>` | `develop` | `oneshort-{frontend\|backend}-worktrees\fix-<問題>` |
| 緊急修復 | `hotfix/<問題>` | `main` | `oneshort-{frontend\|backend}-worktrees\hotfix-<問題>` |
| 發版 | `release/<版號>` | `develop` | `oneshort-{frontend\|backend}-worktrees\release-<版號>` |
| 根目錄協調性文件 | `docs/<主題>`（或依 [§9](#9-commit-messageconventional-commits) 適用的 type，如 `chore/<主題>`） | `develop` | `oneshort-worktrees\<type>-<主題>` |

> [!NOTE]
> Worktree 目錄是**巢狀於 oneshort 根目錄內、與 `frontend/`／`backend/` 同層**的路徑（例：`oneshort\oneshort-frontend-worktrees\feature-<功能>`），**不是** oneshort 根目錄的 sibling 目錄。這是既有實際慣例（`.claude/launch.json`、`frontend/HANDOFF.md`、`frontend/docs/e2e-scenarios.md` 皆採此路徑），且 Claude Code 的 `preview_start` 工具要求 launch.json 的 `cwd` 必須是 project root 內的相對路徑，無法指向 root 外的目錄。若已誤建於 root 外，用 `git worktree move` 搬到此路徑即可，不需重建。

### 6.1 根目錄協調性文件 Worktree

根目錄協調性文件（`.agent/`、`docs/`、`AGENTS.md`，見 [§1](#1-repository-邊界)）的 branch / worktree 命名沿用上表 `<type>-<主題>` 規則，但巢狀於 oneshort 根目錄下的 `oneshort-worktrees\<type>-<主題>`，**不區分** frontend / backend，因此不套用 §8 `-C frontend`／`-C backend` 的路徑換算，直接在 oneshort 根目錄執行即可：

```powershell
git worktree add oneshort-worktrees\docs-<主題> -b docs/<主題> develop
```

已知先例：分支 `docs/party-approval-visibility`（base `develop`，對應 worktree 目錄 `oneshort-worktrees\docs-party-approval-visibility`）——已完成並合併，worktree 已清理。

此類變更僅限文件、無執行期程式碼，風險與影響範圍低於 frontend/backend，**不受 [§2](#2-啟動前確認) BRANCH／WORKTREE 確認門檻限制**：可直接建立 branch 或 worktree 後開始修改，不需事先詢問使用者採 BRANCH 或 WORKTREE；但仍須遵循 [§3.1](#31-修正方案評估準則) 修正方案評估與 §5 base branch 規範。

## 7. BRANCH 模式

```powershell
git -C frontend checkout develop
git -C frontend checkout -b feature/party-search
```

## 8. WORKTREE 模式

```powershell
git -C frontend worktree add ..\oneshort-frontend-worktrees\feature-party-search -b feature/party-search develop
```

```powershell
git -C backend worktree add ..\oneshort-backend-worktrees\feature-party-search -b feature/party-search develop
```

> [!NOTE]
> 指令中的 `..\` 是相對於 `-C frontend`／`-C backend` 切換後的子目錄，實際落地路徑是 oneshort 根目錄下的 `oneshort-frontend-worktrees\...`／`oneshort-backend-worktrees\...`（見第 6 節），並非 oneshort 根目錄的 sibling 目錄。

若路徑含特殊字元，須以單引號包住。

## 9. Commit Message（Conventional Commits）

> [!IMPORTANT]
> 本專案已導入 **Semantic Release**。團隊成員 **必須** 嚴格遵守 Conventional Commits 規範，否則自動化版本號更迭與變更日誌將無法運作。

```text
<type>(<scope>): <簡短描述>
```

**規範要求：**
- **`feat`**: 新增功能
- **`fix`**: 修復錯誤
- **`refactor`**: 程式碼重構（不影響功能）。
- **`docs`**: 文件更新。
- **`test`**: 測試用例更新。
- **`chore`**: 瑣事、建置流程或輔助工具異動
- **BREAKING CHANGE**: 若在描述中包含此字串，會觸發 Major 版本號升級。

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
2. 依 [§3.1 修正方案評估準則](#31-修正方案評估準則) 比較可行方案後選定最佳解，禁止以最小修補繞過根因。
3. 將避免方式記錄在本次 PR / commit / plan / issue；只有前後端程式錯誤需要長期追蹤時，才另外更新 troubleshooting 文件。
4. 根因若是可概括的錯誤假設，依自我學習迴圈的擷取觸發（[learning.md](learning.md) 專案特化，權威為全域 `~/.claude/rules/learning.md` §2）把教訓寫入對應 inbox：OneShort 特定→`.agent/learning/inbox.md`，跨專案通用→全域 `~/.claude/memory/inbox.md`。
5. 確保未來不重複同樣錯誤。
