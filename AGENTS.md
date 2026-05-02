# OneShort - Agent Entry Point

本文件是 OneShort 專案的 Agent 入口。本專案採「規則外掛化」與「自動觸發」管理，所有核心規範均收納於 `.agent/rules/`。

## 1. 核心規則載入 (Essential Rules)

在開始任何任務前，你**必須**確認已加載以下基礎規則：

1.  **全域規範**：[.agent/rules/global-rules.md](.agent/rules/global-rules.md) (邊界、原則、反思機制)
2.  **Git 流程**：[.agent/rules/gitflow.md](.agent/rules/gitflow.md) (開發模式與分支管理)
3.  **文件導航**：[.agent/rules/docs-router.md](.agent/rules/docs-router.md) (關鍵文件索引)

## 2. 前後端隔離規範 (Domain Rules)

當你修改特定專案目錄時，系統會自動根據 `trigger` 載入以下規則：

- **修改 `backend/` 時**：
  - 加載 `backend-rules.md` (架構與技術規範)
  - 加載 `backend-verification.md` (驗證指令與完成條件)
- **修改 `frontend/` 時**：
  - 加載 `frontend-rules.md` (技術棧與狀態管理)
  - 加載 `frontend-verification.md` (驗證指令與 E2E 規範)

## 3. 開發守則

- **先讀規則再動手**：所有開發行為必須符合 `.agent/rules/` 下的定義。
- **規則為唯一準則**：若遇到規則衝突，以本目錄 `.agent/rules/` 下的最新版為準。
- **同步更新文件**：程式碼變更與對應文件更新必須在同一任務內完成。
- **禁止假造前端契約**：開發前端時不得使用假資料、假 API 欄位或後端不存在的格式；若後端能力缺失，先補後端契約與實作，再同步前端 types / API client 與 PRD 或文件。
