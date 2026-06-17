---
trigger: always_on
---

# OneShort 文件導航地圖 (AI Agent 專用)

當你開始執行任務時，先判斷任務類型，再只讀取命中的關聯文件。不要把本表列出的所有文件一次讀完。

## 讀取策略

1. **基線**：所有任務只需要先讀 [core.md](core.md) 與本文件。
2. **路由**：依任務命中的列讀 1-3 個關聯文件；若任務跨前後端，再分別讀對應列。
3. **擴大範圍條件**：只有在實作證據不足、API/狀態流不明、或測試失敗需要追根因時，才繼續讀下一層文件。
4. **停止條件**：找到負責模組、契約與驗證方式後停止讀文件，開始實作或驗證。

## 核心規則與架構

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| 修改核心邏輯 / 狀態轉換 | [docs/business-logic.md](../../docs/business-logic.md) | 理解派對狀態機、演員權限與全域限制 |
| 涉及整體架構變更 | [docs/system-overview.md](../../docs/system-overview.md) | 確保符合 Actor Model 與 Outbox 等架構模式 |
| 修改 API / 資料結構 | [docs/api-reference.md](../../docs/api-reference.md) | 遵循 API 契約、錯誤碼與 WS 訊息格式 |

## 資料流與技術細節

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| 修改後端 Worker / 事件 | [docs/backend-data-flows.md](../../docs/backend-data-flows.md) | 理解請求生命週期與 Outbox 流程 |
| 修改前端 UI / 通知 / WS | [docs/frontend-logic.md](../../docs/frontend-logic.md) | 理解前端頁面邏輯與 WebSocket 呈現 |
| 修改前端 UI/UX / 視覺樣式 / 響應式設計 | [style.md](style.md) + [frontend.md](frontend.md) | 修改任何前端視覺、互動、排版或行動版體驗前，必讀 OneShort 設計語言與 Golden Rules |
| 產生 / 修改 / 審查 OneShort 設計資產 | [style.md](style.md) + `oneshort-asset-generation` skill | UI 中使用資產時先遵循 OneShort 設計規則；實際產圖、命名、格式與審查流程交給 Claude Code skill |
| 修改即時通訊 / Redis | [docs/data-flow/realtime.md](../../docs/data-flow/realtime.md) | 理解 WebSocket 訂閱、推送與重連機制 |

## 開發流程

| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| Git 操作 / Branch / Worktree | [.agent/rules/core.md](core.md) | 遵循 Git Flow 與任務清理流程 |
| 新增功能模組 | [docs/features/](../../docs/features/) | 只讀與功能名稱相符的子文件；不要整包遞迴讀取 |

> [!IMPORTANT]
> 在修改程式碼前，請務必先使用目前環境可用的檔案讀取工具，讀取上述命中的文件。未命中的文件不要預先載入。
