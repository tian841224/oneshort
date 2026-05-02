---
trigger:
  - backend/**/*
---

# 後端開發規範 (Backend Rules)

本文件定義後端開發特定的技術架構、編碼規範與資料處理原則。

## 1. 架構規範 (Clean Architecture)

- **分層責任**：
  - `domain`：實體定義與介面（Repository/UseCase Interface）。純領域定義。
  - `usecase`：核心業務邏輯實作。
  - `repository`：資料存取實作（DB、Redis）。
  - `handler`：HTTP 路由、DTO 轉換與請求回應處理。
- **依賴注入**：跨 domain 協作以 interface 注入為準，禁止直接依賴其他 domain 實作層。
- **邊界保護**：不得為了方便而將業務邏輯洩漏至 handler 或 repository。

## 2. 資料庫與 Migration

- **持久化變更**：欄位、enum 或 schema 變更必須同步補上 migration 並執行測試驗證。
- **Migration 命名**：統一置於 `migrations/`，採遞增編號命名（如 `0001_xxx.up.sql`）。
- **Transaction**：`database.Tx` 是 `sqlx.Tx` 的別名，必須遵循 `WithTx` callback 簽名。
- **狀態值修改**：修改持久化欄位的狀態值（如 `party_status`）時，必須執行 integration test 驗證。

## 3. 技術棧與規範

- **語言**：一律使用 Go (Golang)。
- **Swagger**：API 變更後必須更新 Swagger 文件（執行 `/generate-swagger`）。
- **實作提醒**：`Air` 只會編譯 `cmd/server/`，完整驗證需靠 `go build ./...`。
