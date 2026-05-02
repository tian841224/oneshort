---
trigger:
  - frontend/**/*
---

# 前端驗證與完成條件

## 1. 驗證指令

```powershell
# 型別檢查
npx tsc --noEmit

# API / 契約整合驗證
npm run test:api

# 構建驗證 (大型改動建議)
npm run build
```

## 2. 完成條件

- **E2E 測試**：合併回 `develop` 後必須在 `frontend` repository 執行 `npm run test:e2e`。
- **情境覆蓋**：新增或修改功能必須同步更新 E2E 測試。
- **類型一致**：確保無型別報錯且與後端契約同步。
