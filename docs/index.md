# OneShort 公開文件目錄

OneShort 是一個為 MMORPG 玩家打造的即時組隊協作平台。本目錄是公開文件的入口，依「產品 → 架構 → 資料流 → API」的順序整理，方便讀者由淺入深理解整個專案。

## 建議閱讀順序

| 順序 | 文件 | 適合誰 | 內容 |
|------|------|--------|------|
| 1 | [系統總覽](./system-overview.md) | 所有人 | 產品定位、核心概念、整體架構圖、技術棧總表 |
| 2 | [功能總覽](./features.md) | 想了解產品能做什麼的人 | 各功能模組的詳細說明（登入、隊伍、公會、通知、管理端…） |
| 3 | [前端架構](./architecture/frontend.md) | 前端工程師 | Next.js / React 技術棧、目錄結構、狀態管理、即時通訊 |
| 4 | [後端架構](./architecture/backend.md) | 後端工程師 | Go / Gin 技術棧、服務拓樸、分層設計、認證模型、資料模型 |
| 5 | [資料流](./data-flow/overview.md) | 想理解系統如何運作的人 | 請求生命週期、事件驅動管線（Outbox → Redis Streams → WebSocket） |
| 6 | [API 總覽](./api/overview.md) | 串接或閱讀 API 的人 | API 分類、代表性端點、認證方式、WebSocket 契約 |

## 快速摘要

- **前端**：Next.js 16（App Router）+ React 19 + TypeScript，TanStack Query 管理伺服器狀態、Zustand 管理本地狀態
- **後端**：Go 1.24 + Gin，PostgreSQL 16 持久化，雙 Redis 實例分離快取與即時事件
- **即時性**：Transactional Outbox → Redis Streams → WebSocket Gateway 的事件驅動管線
- **核心功能**：組隊（建立 / 搜尋 / 申請 / 管理）、公會（成員 / 公告 / BOSS 自動配對）、即時通知與聊天

## 公開文件邊界

- 本目錄只保留可公開的產品與系統資訊。
- 不包含內部開發治理、決策紀錄、敏感設定與部署細節。
- 若後續擴充文件，應維持「高層設計可公開、內部營運細節不公開」的原則。
