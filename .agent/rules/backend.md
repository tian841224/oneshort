---
trigger:
  - backend/**/*
---

# 後端開發規範與驗證 (Backend Rules)

## 1. 架構規範 (Clean Architecture)

- **分層責任**：
  - `domain`：實體定義與介面（Repository/UseCase Interface）。純領域定義。
  - `usecase`：核心業務邏輯實作。
  - `repository`：資料存取實作（DB、Redis）。
  - `handler`：HTTP 路由、DTO 轉換與請求回應處理。
- **依賴注入**：跨 domain 協作以 interface 注入為準，禁止直接依賴其他 domain 實作層。
- **邊界保護**：不得為了方便而將業務邏輯洩漏至 handler 或 repository。
- **非同步事件 (Outbox)**：發布任何系統事件 (如 WebSocket 通知) 時，必須遵守 Transactional Outbox Pattern，禁止在 Usecase 中直接操作 Redis 廣播，需將事件隨 DB Tx 一起寫入 Outbox 介面。

## 2. 資料庫與 Migration

- 欄位、enum 或 schema 變更必須同步補上 migration 並執行測試驗證。
- Migration 統一置於 `migrations/`，採遞增編號命名（如 `0001_xxx.up.sql`）。
- `database.Tx` 是 `sqlx.Tx` 的別名，必須遵循 `WithTx` callback 簽名。
- 修改持久化欄位的狀態值時，必須執行 integration test 驗證。

## 3. 技術棧

- **語言**：Go (Golang)
- **Swagger**：API 變更後必須更新（執行 `/generate-swagger`）。
- **提醒**：`Air` 只編譯 `cmd/server/`，完整驗證需 `go build ./...`。

## 4. 驗證指令

```powershell
go build ./...                                    # 編譯檢查
go test -tags unit ./...                          # 單元測試
pwsh -File .\scripts\test.ps1 -Suite all -NoCache # 整合驗證
```

## 5. 完成條件

- 所有功能必須涵蓋單元測試 (`*_test.go`)。
- 涉及資料庫時必須執行 integration test。
- API 變更後同步更新 Swagger 文件。
