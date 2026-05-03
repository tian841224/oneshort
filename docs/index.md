# OneShort 專案文件索引 (Project Documentation Index)

歡迎閱讀 OneShort 專案文件。此目錄旨在提供完整的開發指南、系統架構、以及功能詳情。

---

## 📚 1. 開發規範、流程、架構 (Standards & Architecture)
本節涵蓋了從環境建立、修改前確認 `BRANCH` / `WORKTREE` 的 Git 開發流程，到前後端整體技術架構的定義。

- **[開發流程與 Git 開發模式 (Core Rules)](../.agent/rules/core.md)**：修改前確認 `BRANCH` / `WORKTREE`、分支命名規範、建立方式與清理流程。
- **[疑難排解與最佳實務 (Troubleshooting)](./TROUBLESHOOTING.md)**：記錄已知的踩坑點與解決方案。
- **後端開發規範**：詳見 [.agent/rules/backend.md](../.agent/rules/backend.md)（架構、測試、DB 規範）與 [backend/docs/AGENTS.md](../backend/docs/AGENTS.md)。
- **前端開發規範**：詳見 [frontend/docs/agent/05-conventions.md](../frontend/docs/agent/05-conventions.md) 與 [frontend/docs/AGENTS.md](../frontend/docs/AGENTS.md)。

## ⚙️ 2. 資料流程與狀態管理 (Data Flow & State)
深入了解資料如何在系統不同層次間流動，包含 REST API 生命週期、前端狀態管理與即時通知。

- **[後端資料生命週期 (Backend Life Cycle)](../backend/docs/data_flow.md)**：DTO → Entity → Model 的轉換與依賴反轉實作。
- **[前端狀態與 API 管理 (Frontend State)](../frontend/docs/agent/04-data-flow.md)**：TanStack Query 快取策略、Zustand 全域狀態應用。
- **[即時通訊機制 (Real-time & WS)](./data-flow/realtime.md)**：Outbox Pattern、Redis Streams 與 WebSocket 的連動與轉譯。

## 🧩 3. 各項功能模組說明 (Features)
各個業務領域 (Domain) 的詳細功能定義與其前後端對應關係。

- **[身份驗證 (Auth)](./features/auth.md)**：Actor、Quick Login、Discord OAuth、Cookie session 與 Discord merge。
- **[隊伍管理 (Party)](./features/party.md)**：自定義密碼、審核機制、角色席位、閒置關閉與 Quick Login 限制。
- **[通訊與通知 (Notify)](./features/notify.md)**：全系統事件推送、中心化通知路由。
- **[其他模組 (Others)](./features/others.md)**：OCR、Bug 回報、已移除模組狀態。
- **[公會系統 (Guild)](./features/guild.md)**：公會、成員、公告、聊天室、公會限定隊伍與每週王團自動配對。

## 🛠️ 4. 系統改善與開發規劃 (Maintenance & Planning)
對未來的技術優化與功能擴展進行整理與規劃。若新增 roadmap 或 refactor plan，請先建立對應文件再加入本索引，避免索引指向不存在的路徑。

---

## 📖 5. 系統完整文件 (Comprehensive System Docs)
完整的商業邏輯、前後端資料流程與 API 參考文件。

- **[系統全覽 (System Overview)](./system-overview.md)**：整體架構圖、服務說明、技術棧、關鍵設計模式。
- **[商業邏輯 (Business Logic)](./business-logic.md)**：所有模組的核心商業規則、狀態機、判斷邏輯（認證/隊伍/通知/排他鎖）。
- **[前端邏輯 (Frontend Logic)](./frontend-logic.md)**：各頁面的顯示邏輯、按鈕行為、WebSocket 事件處理、通知規則。
- **[後端資料流程 (Backend Data Flows)](./backend-data-flows.md)**：各 API 端點的詳細處理流程、Worker 機制、事件發布流程。
- **[API 參考 (API Reference)](./api-reference.md)**：完整 API 端點、請求/回應格式、錯誤碼、WebSocket 訊息格式。

---

## 🔧 維護與更新建議
- 本文件應隨系統架構變動持續更新。
- 修改任何業務邏輯或新增 API 時，請務必更新對應的**資料流程**或**功能模組**文件。
- 索引內的連結必須對應實際存在的檔案；功能退場後應移到歷史文件或明確標註非現行流程。
