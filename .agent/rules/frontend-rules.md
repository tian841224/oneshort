---
trigger:
  - frontend/**/*
---

# 前端開發規範 (Frontend Rules)

本文件定義前端開發特定的技術棧、狀態管理與實作規範。

## 1. 技術棧與規範

- **API 呼叫**：所有 HTTP 呼叫必須走 `src/lib/api/*`；禁止直接裸寫 `fetch`。
- **狀態管理**：
  - **TanStack Query**：管理伺服器狀態 (Server State)。
  - **Zustand**：管理跨頁面客戶端狀態 (Client State)。
  - **原則**：禁止將 Query 資料重複複製一份到 Store。
- **快取規範**：個人或敏感資料的 `queryKey` 必須包含 `user.id`，避免帳號切換快取污染。

## 2. 實作架構

- **分層責任**：頁面負責組裝，元件負責呈現，業務邏輯收斂於 hooks / service-style abstraction。
- **重構時機**：若現有結構不適合新需求，應先提出重構，不以單點特判 (Hardcoding) 為手段。
- **UI/UX 邏輯**：按鈕行為、通知系統、WebSocket 呈現請參考 `docs/frontend-logic.md`。
- **禁止假契約**：開發前端時禁止使用假資料、假 API 欄位或後端不存在的資料格式。若需求缺少後端能力，必須先補後端契約與實作，再同步前端 types、API client 與 PRD / 文件。

## 3. 型別檢查與編譯

- **型別檢查**：`next dev` 不會檢查型別，必須執行 `npx tsc --noEmit`。
- **契約一致性**：前端 TypeScript interface 應與後端傳輸結構保持高度一致。
