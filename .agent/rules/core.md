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

- 先理解模組責任與資料流再修改。禁止圖快的低維護方案。
- 除非正式規格，否則不為單一功能撰寫硬編碼特例。
- 商業邏輯或 API 行為異動時，程式碼與文件必須同步更新。
- 若現有架構不適合新需求，應先提出重構方案，不持續堆疊例外。
- **文件過期必須同步更新或移除**：任何文件（規格文件、ADR 的「已知後續」段落、README 等）內容一旦被新內容取代或修改，必須同步更新該文件或移除過期段落，不得留下與現況矛盾的內容誤導後續讀者。這比 [docs/decisions/index.md](../../docs/decisions/index.md) 「強制規則」第 3 點（ADR 推翻 ADR 的流程）更廣義，涵蓋「ADR 的已知後續被完成後要回頭補註」「ADR 相關規格文件因新決策過期時要同步修正」等情境。範例見 [docs/features/guest-mode-plan.md](../../docs/features/guest-mode-plan.md)（ADR-0015 推翻部分內容後，該文件明確標註「已由 ADR-0015 推翻」並更新現況表）與 [ADR-0014](../../docs/decisions/0014-guest-party-interop-frontend-ui.md)（由 ADR-0016 補註「後續更新」段落）。

### 3.1 修正方案評估準則

> [!IMPORTANT]
> **禁止以「最小範圍修正」作為預設策略**。任何修正（bugfix、refactor、新功能、規格調整）前，必須先列舉並比較可行方案，採取最佳解。

**評估流程**

1. **列舉至少兩個方案**：包含「就地修補」與「抽出共用 / 重構邊界」兩個極端；必要時加入第三方案（如「換掉錯誤抽象」、「下推/上移責任」）。
2. **以三大前提逐項評估**（同時權衡；衝突時優先順序為 **安全性 > 維護性 > 效能**）：
   - **維護性**：單一責任、邊界清晰、命名與型別一致；是否增加重複碼、例外堆疊或隱性耦合。
   - **效能**：熱路徑、DB 查詢、I/O、前端渲染與 Bundle 大小影響；避免 N+1 與冗餘運算。
   - **安全性**：輸入信任邊界、權限與授權、注入 / XSS / CSRF / SSRF、敏感資料外洩風險。
3. **決策落地（強制記錄為 ADR）**：選定方案的「理由與被拒方案」必須依 [docs/decisions/index.md](../../docs/decisions/index.md) 的規則新增一份 ADR 文件並更新索引表，這是可被下一個 session 讀到的**唯一權威記錄**；PR 描述、commit body 或 `~/.claude/plans/` 計畫文件可以補充細節，但不能取代 ADR。
4. **修改前必查 ADR**：修改任何模組前，先依 [docs-router.md](docs-router.md) 的規則檢查 `docs/decisions/index.md` 是否已有該模組的決策；若有，必須先讀取並遵守，不得在不知情下重複調整或推翻先前決策。需要正式推翻時，依該索引文件的「推翻舊決策」流程（標記 Superseded、新增新 ADR 並註明理由），不得直接覆蓋。

**例外條款**

- 僅限「生產緊急事故 hotfix」或「使用者明確指示 minimal patch」時，可暫採局部修正。
- 須同步建立 follow-up 任務（PR 描述、commit body、`~/.claude/plans/` 計畫文件或 issue tracker），於下一個迭代完成完整重構，不得無限期延後；即便是暫時性局部修正，只要涉及方案取捨仍須依上述規則建立 ADR。

**驗證義務**

- 缺乏對應層級驗證（單元 / 整合 / E2E / 安全掃描）的「最佳方案」視同無效。
- Schema、API、安全邊界變動，必須附自動化測試並同步更新型別契約。

## 4. 前後端同步

- **後端優先**：API 結構變動時，必須同步更新前端 `lib/api`、types 與錯誤處理。
- **類型一致**：前端 TypeScript interface 應與後端傳輸結構保持高度一致。
- **禁止假契約**：前端不得使用假資料或後端不存在的格式；缺少後端能力時先補後端。
- **雙向同步檢查**：無論是前端或後端單方調整功能（新增、修改或移除 API、事件、UI 流程），都必須同步確認另一端是否需要對應更新。若確定另一端暫時不會串接／實作，該功能在完成的那一端必須明確停用（如註解路由註冊）並在程式碼與 commit/PR 說明中註明「等待前後端另一端補齊」，不得讓功能長期處於「一端已完成、另一端完全沒有消費」的孤立狀態。

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
4. 確保未來不重複同樣錯誤。
