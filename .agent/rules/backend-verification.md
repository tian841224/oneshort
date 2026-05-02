---
trigger:
  - backend/**/*
---

# 後端驗證與完成條件

## 1. 驗證指令

```powershell
# 執行編譯檢查
go build ./...

# 執行所有單元測試
go test -tags unit ./...

# 資料庫/整合驗證
pwsh -File .\scripts\test.ps1 -Suite all -NoCache
```

## 2. 完成條件

- **測試覆蓋**：所有功能必須涵蓋單元測試 (`*_test.go`)。
- **邊界驗證**：涉及資料庫時必須執行 integration test。
- **文件同步**：API 變更後同步更新 Swagger 文件。
