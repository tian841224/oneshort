---
trigger: always_on
---

# OneShort 文件導航地圖 (AI Agent 專用— ROOT 協調 repo)

當你開始執行任務時，先判斷任務類型，再只讀取命中的關聯文件。不要把本表列出的所有文件一次讀完。**本表只路由 ROOT repo 自己的內容**（系統總覽、功能總覽、ADR、協調規則）；backend/frontend 內部的實作文件已各自搬到對應 repo，見下方「任務落在 backend 或 frontend 範疇」。

## 讀取策略

1. **基線**：所有任務只需要先讀 [core.md](core.md) 與本文件。
2. **決策紀錄檢查（強制）**：修改任何模組前，先查 [docs/decisions/index.md](../../docs/decisions/index.md) 索引表，若命中相關模組的既有 ADR，**必須先讀取全文並遵守**，不得在不知情下推翻先前決策；需要推翻時依該索引文件的「推翻舊決策」流程處理。
3. **路由**：依任務命中的列讀 1-3 個關聯文件。
4. **停止條件**：找到負責範疇與驗證方式後停止讀文件，開始實作或驗證。

## 任務落在 backend 或 frontend 範疇

若任務是修改 backend 或 frontend 的實作程式碼、API、商業邏輯、頁面/元件行為等，**不要在 ROOT 深入查找對方 repo 內部的檔案路徑**——直接進入對應 repo，讀該 repo 自己的規則入口即可，那份文件是完整、自足的：

| 範疇 | 進入點 |
|---|---|
| backend（Go、API、商業邏輯、資料流、worker） | `backend/AGENTS.md` → `backend/docs/docs-router.md` |
| frontend（頁面、元件、UI/UX、前端狀態） | `frontend/AGENTS.md` → `frontend/docs/docs-router.md` |

## ROOT 自己的文件路由

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| 了解系統整體架構、服務拆分、技術棧 | [docs/system-overview.md](../../docs/system-overview.md) | 高層架構圖、服務說明、關鍵設計模式 |
| 了解某功能的業務範圍（不需要實作細節） | `docs/features/<模組>.md`（見下表） | 功能總覽 + 指向對應 repo 規格書/API 參考的指標 |
| 了解前後端即時通訊契約 | [docs/data-flow/realtime.md](../../docs/data-flow/realtime.md) | Outbox Pattern、Redis Streams 與 WebSocket 的前後端契約（刻意保留為跨切文件） |
| 任何涉及方案取捨的設計決策 | [docs/decisions/index.md](../../docs/decisions/index.md) | 修改前必查既有 ADR 並遵守；做出新決策後必須新增 ADR，不得只寫在 PR/commit |
| 需要橫跨 backend/frontend 的協調（分支策略、worktree、雙向同步檢查） | [core.md](core.md) | Git Flow、BRANCH/WORKTREE 確認門檻、跨端同步檢查 |

## 功能總覽索引

| 任務涉及的功能 | 關鍵文件 |
|---|---|
| 身份驗證 / Auth / Discord OAuth / Quick Login | [docs/features/auth.md](../../docs/features/auth.md) |
| 隊伍 / Party / 席位 / 申請 / 密碼房 | [docs/features/party.md](../../docs/features/party.md) |
| 公會 / Guild / 公會聊天 / 王團配對 | [docs/features/guild.md](../../docs/features/guild.md) |
| 通知 / Notification / 推播事件 | [docs/features/notify.md](../../docs/features/notify.md) |
| 公告 / 跑馬燈 / Announcement / NoticeBar | [docs/features/announcement.md](../../docs/features/announcement.md) |
| 線上人數 / 每日統計 / online-stats | [docs/features/online-stats.md](../../docs/features/online-stats.md) |
| OCR / Bug 回報 / 已移除功能狀態 | [docs/features/others.md](../../docs/features/others.md) |
| Telegram Bot / 管理員 TG 指令 | [docs/features/telegram-bot.md](../../docs/features/telegram-bot.md) |
| Guest Mode / 訪客模式 | [docs/features/guest-mode-plan.md](../../docs/features/guest-mode-plan.md) |

每份功能總覽只描述業務範圍；實作細節一律在該檔「深入文件」段指向 backend/frontend repo 自己的規格書。

## 開發流程

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| Git 操作 / Branch / Worktree | [.agent/rules/core.md](core.md) | 遵循 Git Flow 與任務清理流程 |
| 記錄教訓 / 記憶蒸餾 / 週期回顧 / 自我學習 | [learning.md](learning.md)（專案特化，權威為全域 `~/.claude/rules/learning.md`）+ [.agent/learning/MEMORY.md](../learning/MEMORY.md) + `learn`／`evolve` skills | 依自我學習迴圈擷取教訓、蒸餾記憶、升級為規則／技能／ADR 並修剪過時條目；通用教訓進全域、OneShort 特定進 `.agent/learning/` |

> [!IMPORTANT]
> 在修改程式碼前，請務必先使用目前環境可用的檔案讀取工具，讀取上述命中的文件。未命中的文件不要預先載入。
