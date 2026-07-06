# OneShort 專案記憶 (MEMORY.md)

> 自我學習迴圈第 3 層「便利貼層」——**僅限 OneShort 專屬**教訓，上限 **50 條**。
> 迴圈與格式的權威定義在全域 `~/.claude/rules/learning.md`；本專案特化見 [.agent/rules/learning.md](../rules/learning.md)。
> 跨專案通用的教訓不放這裡（放全域 `~/.claude/memory/`）。條目是「當下觀察」，引用前必須驗證仍成立；`.agent/learning/` 進版控，**禁止寫入任何秘密**。

- 上次蒸餾：2026-07-07
- 上次回顧：2026-07-07（建檔）
- 條目數：6 / 50

> 註：原通用條目（gofmt CRLF 誤報、Windows `npm.cmd`、baseline 比對方法論）已上移全域 `~/.claude/memory/MEMORY.md`（對應全域 M-002～M-004），本檔不再重複。

## 協作偏好

- **[M-001]** 根目錄協調性文件（`.agent/`、`docs/`、`AGENTS.md`）修改不需事先詢問 BRANCH／WORKTREE，直接建 `docs/<主題>` 分支即可；`frontend/`／`backend/` 則必須先問。適用：任何要動檔案前的分支決策。（來源: core.md §2/§6.1 實務確認, 記錄: 2026-07-07）

## 環境與工具陷阱

- **[M-003]** `frontend` 的 `npm run build` 需要 `.env.local` 設 `NEXT_PUBLIC_SITE_URL`，缺少時會在 collect page data 階段失敗——那是環境問題，不是程式碼迴歸。適用：frontend build 失敗歸因。（來源: 既往 session 記憶匯入, 記錄: 2026-07-07）
- **[M-004]** backend 整合測試需要 `TEST_DATABASE_URL` 與 `REDIS_PASSWORD`（值在 `backend/.env`），否則碰 Redis 的測試會以 NOAUTH 失敗。適用：跑 backend 整合測試前。（來源: 既往 session 記憶匯入, 記錄: 2026-07-07）
- **[M-005]** OneShort dev server 慣用 port：frontend 3000、backend 8080，常已常駐佔用；啟動前先查 port（通用的 `npm.cmd`／查 port 準則見全域 M-003）。適用：本專案 preview_start／dev server。（來源: 既往 session 記憶匯入, 記錄: 2026-07-07）

## 流程教訓

- **[M-006]** 本機 frontend E2E 存在約 25/33 的既有失敗（與當前變更無關）；歸因前先做 baseline 比對（通用方法論見全域 M-004）。適用：合併後 `npm run test:e2e` 結果判讀。（來源: 既往 session 記憶匯入, 記錄: 2026-07-07）

## 專案事實

- **[M-007]** `backend/` 是巢狀獨立 repo，root 的 worktree 不含它；backend 工作要在 `backend/` 自己的 `develop` 上做。適用：跨 repo 操作與 worktree 規劃。（來源: 既往 session 記憶匯入, 記錄: 2026-07-07）
