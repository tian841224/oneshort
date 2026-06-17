---
trigger:
  - frontend/**/*
---

# 前端開發規範與驗證 (Frontend Rules)

## 1. 技術棧與 API

- **API 呼叫**：所有 HTTP 呼叫必須走 `src/lib/api/*`；禁止直接裸寫 `fetch`。
- **狀態管理**：
  - **TanStack Query**：管理 Server State。
  - **Zustand**：管理跨頁 Client State。
  - 禁止將 Query 資料重複存入 Store。
- **快取規範**：`queryKey` 必須包含 `user.id` 等識別符，避免帳號切換快取污染。

## 2. 實作架構

- 頁面負責組裝，元件負責呈現，業務邏輯收斂於 hooks / service-style abstraction。
- 若現有結構不適合新需求，應先提出重構，不以單點特判為手段。
- UI/UX 邏輯、按鈕行為、通知系統、WebSocket 呈現請參考 [docs/frontend-logic.md](../../docs/frontend-logic.md)。
- API 契約、型別一致與禁止假資料規範以 [core.md §4](core.md#4-前後端同步) 為準。

## 3. 型別檢查

- `next dev` 不做型別檢查；必須靠 `npx tsc --noEmit` 或 `npm run build` 抓錯。
- 前端 TypeScript interface 應與後端傳輸結構保持高度一致。

## 4. 驗證指令

```powershell
npx tsc --noEmit         # 型別檢查
npm run test:api         # API / 契約整合驗證
npm run build            # 構建驗證（大型改動建議）
```

## 5. 完成條件

- 合併回 `develop` 後必須執行 `npm run test:e2e`。
- 新增或修改功能必須同步更新 E2E 測試。
- 確保無型別報錯且與後端契約同步。
