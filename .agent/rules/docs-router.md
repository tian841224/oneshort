---
trigger: always_on
---

# OneShort 文件導航地圖 (AI Agent 專用)

當你開始執行任務時，請根據任務類型讀取對應的關鍵文件，以確保符合系統架構與規範。

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
| 修改即時通訊 / Redis | [docs/data-flow/realtime.md](../../docs/data-flow/realtime.md) | 理解 WebSocket 訂閱、推送與重連機制 |

## 開發流程
| 任務類型 | 關鍵文件 | 目的 |
|---|---|---|
| Git 操作 / Branch / Worktree | [.agent/rules/core.md](core.md) | 遵循 Git Flow 與任務清理流程 |
| 新增功能模組 | [docs/features/](../../docs/features/) | 查閱特定功能的詳細設計規格 |

> [!IMPORTANT]
> 在修改程式碼前，請務必先使用目前環境可用的檔案讀取工具，讀取上述對應的文件。
