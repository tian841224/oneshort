---
trigger: always_on
---

# 全域開發規範 (Global Development Rules)

本文件定義專案共通的架構原則、邊界規範與錯誤反思機制。

## 1. Repository 邊界規範

- **Repository 邊界**：前端、後端與根目錄是獨立的 Git repository。
- **開發空間**：前端或後端的 branch / worktree 必須建立在各自 repository 內。
- **啟動確認**：修改前必須詢問使用者採 `BRANCH` 還是 `WORKTREE` 模式。

## 2. 架構優先與一致性

- **架構優先**：先理解模組責任與資料流再修改。禁止圖快的低維護方案。
- **禁止特例**：除非正式規格，否則不為單一功能撰寫硬編碼 (Hardcode) 特例。
- **同步更新**：商業邏輯或 API 行為異動時，程式碼與對應文件必須同步更新。

## 3. 前後端同步 (Full-stack Sync)

- **後端優先**：API 結構變動時，必須同步更新前端 `lib/api`、types 與錯誤處理。
- **類型一致**：前端 TypeScript interface 應與後端傳輸結構保持高度一致。

## 4. 錯誤反思機制 (Reflection)

若開發過程中出現編譯失敗、測試不通過或執行異常，必須：
1. **找出根因**：分析為何會發生此錯誤，而不僅是修復表面症狀。
2. **記錄避免方式**：將避免方式補充到 [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) 或對應規則檔案。
3. **持續改進**：確保未來的任務不會重複同樣的錯誤。
