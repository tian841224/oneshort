---
trigger: always_on
---

# OneShort 文件導航地圖 (AI Agent 專用)

當你開始執行任務時，先判斷任務類型，再只讀取命中的關聯文件。不要把本表列出的所有文件一次讀完。

## 讀取策略

1. **基線**：所有任務只需要先讀 [core.md](core.md) 與本文件。
2. **決策紀錄檢查（強制）**：修改任何模組前，先查 [docs/decisions/index.md](../../docs/decisions/index.md) 索引表，若命中相關模組的既有 ADR，**必須先讀取全文並遵守**，不得在不知情下推翻先前決策；需要推翻時依該索引文件的「推翻舊決策」流程處理。
3. **路由**：依任務命中的列讀 1-3 個關聯文件；若任務跨前後端，再分別讀對應列。
4. **擴大範圍條件**：只有在實作證據不足、API/狀態流不明、或測試失敗需要追根因時，才繼續讀下一層文件。
5. **停止條件**：找到負責模組、契約與驗證方式後停止讀文件，開始實作或驗證。

## 核心規則與架構

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| 修改核心邏輯 / 狀態轉換 | [docs/business-logic.md](../../docs/business-logic.md) | 理解派對狀態機、演員權限與全域限制 |
| 涉及整體架構變更 | [docs/system-overview.md](../../docs/system-overview.md) | 確保符合 Actor Model 與 Outbox 等架構模式 |
| 修改 API / 資料結構 | [docs/api-reference.md](../../docs/api-reference.md) | 遵循 API 契約、錯誤碼與 WS 訊息格式 |
| 任何涉及方案取捨的設計決策 | [docs/decisions/index.md](../../docs/decisions/index.md) | 修改前必查既有 ADR 並遵守；做出新決策後必須新增 ADR，不得只寫在 PR/commit |

## 資料流與技術細節

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| 修改後端 Worker / 事件 | [docs/backend-data-flows.md](../../docs/backend-data-flows.md) | 理解請求生命週期與 Outbox 流程 |
| 修改前端 UI / 通知 / WS | [docs/frontend-logic.md](../../docs/frontend-logic.md) | 理解前端頁面邏輯與 WebSocket 呈現 |
| 修改前端 UI/UX / 視覺樣式 / 響應式設計 | [style.md](style.md) + [frontend.md](frontend.md) + `frontend-rwd-uiux-standards` skill | 修改任何前端視覺、互動、排版或行動版體驗前，必讀 OneShort 設計語言與 Golden Rules；並依 `frontend-rwd-uiux-standards` skill（全域）檢查斷點、熱區、對比度、狀態設計等通用 RWD/無障礙基準 |
| 手機版審查 / RWD 驗證 / 行動版修改後完成檢查 | [style.md §13](style.md) + `mobile-rwd-audit` skill（專案） | 行動版版面、觸控、斷點、固定元素、表單修改完成後，依 §13 執行靜態掃描＋Playwright 實測走訪，產出附證據的 P0–P3 報告 |
| 產生 / 修改 / 審查 OneShort 設計資產 | [style.md](style.md) + `oneshort-asset-generation` skill | UI 中使用資產時先遵循 OneShort 設計規則；實際產圖、命名、格式與審查流程交給 Claude Code skill |
| 修改即時通訊 / Redis | [docs/data-flow/realtime.md](../../docs/data-flow/realtime.md) | 理解 WebSocket 訂閱、推送與重連機制 |

## 功能模組文件

| 任務涉及的功能 | 關鍵文件 | 目的 |
|---|---|---|
| 身份驗證 / Auth / Discord OAuth / Quick Login | [docs/features/auth.md](../../docs/features/auth.md) | 功能範圍、驗證流程、程式碼對應 |
| 隊伍 / Party / 席位 / 申請 / 密碼房 | [docs/features/party.md](../../docs/features/party.md) | 功能範圍、隊伍生命週期、程式碼對應 |
| 公會 / Guild / 公會聊天 / 王團配對 | [docs/features/guild.md](../../docs/features/guild.md) | 功能範圍、公會限定隊伍、自動配對規則 |
| 通知 / Notification / 推播事件 | [docs/features/notify.md](../../docs/features/notify.md) | 通知路由規則、事件種類與中心化處理 |
| 公告 / 跑馬燈 / Announcement / NoticeBar | [docs/features/announcement.md](../../docs/features/announcement.md) | 公告系統與 NoticeBar 規格（已實作） |
| 線上人數 / 每日統計 / online-stats | [docs/features/online-stats.md](../../docs/features/online-stats.md) | 即時人數顯示與每日統計落庫規格（已實作） |
| OCR / Bug 回報 / 已移除功能狀態 | [docs/features/others.md](../../docs/features/others.md) | OCR、Bug 回報與退場模組現況 |
| Telegram Bot / 管理員 TG 指令 | [docs/features/telegram-bot.md](../../docs/features/telegram-bot.md) | Bot 指令擴充計畫與驗收條件（已實作） |
| Guest Mode / 訪客模式 | [docs/features/guest-mode-plan.md](../../docs/features/guest-mode-plan.md) | Guest mode v1 架構決策與規格 |

## 開發流程

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| Git 操作 / Branch / Worktree | [.agent/rules/core.md](core.md) | 遵循 Git Flow 與任務清理流程 |
| 記錄教訓 / 記憶蒸餾 / 週期回顧 / 自我學習 | [learning.md](learning.md) + [.agent/learning/MEMORY.md](../learning/MEMORY.md) + `learn`／`evolve` skills | 依自我學習迴圈擷取教訓、蒸餾記憶、升級為規則／技能／ADR 並修剪過時條目 |

> [!IMPORTANT]
> 在修改程式碼前，請務必先使用目前環境可用的檔案讀取工具，讀取上述命中的文件。未命中的文件不要預先載入。
