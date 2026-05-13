# 公告 footer 與 DB modal 實作計畫

## 目標

移除 footer 的「開發計畫」與「已知問題」功能，改為「公告」按鈕；公告內容不再讀取前端 `public/docs` 靜態檔，而是透過 DB 公開公告 API 顯示最新一筆公告。公告顯示方式改為與 Bug 回報相同的共用視窗 shell，內容以 Markdown / GFM 格式渲染。

## 已選方案

採用後端契約收斂方案：

- `GET /api/v1/announcement` 代表「最新一筆啟用中的 DB 公告」。
- 最新排序以 `created_at DESC, id DESC` 為準，避免和優先權排序混用。
- `GET /api/v1/announcements` 保留既有列表用途與優先權排序，但 navbar 公告列不再用列表摘要，避免點擊後內容和 modal 不一致。
- 前端 footer、navbar 公告列與自動彈窗共用同一筆 DB latest announcement 與同一個 DB-backed announcement modal。

## 被拒方案

- 前端自行從 `/announcements` 取列表後排序：會讓最新公告規則分散在前端，且 `/announcement` 繼續保留誤導性的 priority-first 語意。
- 保留 `MarkdownModal` 與 `public/docs/announcement.md`：與使用者要求「不再使用讀取前端檔案」衝突，且會讓公告資料來源有兩套。

## 實作步驟

1. 後端
   - 將 singular announcement repository/usecase/handler 語意改為 latest active announcement。
   - 將公告內容長度上限提高到 4000，支援實際 Markdown 公告。
   - 補上 repository/usecase/handler 測試，明確鎖定 `created_at DESC, id DESC`。
   - 更新後端 API 文件與 Swagger 產物。

2. 前端
   - `uiStore` 移除 `roadmap`、`known-issues` modal type。
   - `Footer` 改為只顯示「公告」與「回報 Bug」。
   - Announcement modal 改用共用 `Modal` shell，顯示 DB 最新公告並支援 Markdown / GFM。
   - `AnnouncementManager` 改用 DB 最新公告的 `id + updated_at` seen token，不再使用硬編碼版本字串。
   - 移除 `MarkdownModal`、`docsApi` 與 static docs route 的 runtime 依賴。

3. 文件與驗證
   - 更新 frontend / backend 文件中公告與 footer 語意。
   - 執行前後端單元測試、型別檢查、lint/build（依可用環境）。

## 驗收條件

- footer 不再出現「開發計畫」與「已知問題」。
- footer「公告」按鈕、navbar 公告列點擊、自動彈窗都顯示同一筆 DB 最新公告視窗。
- 公告視窗使用共用 `Modal` shell，外觀與 bug 回報視窗同一類型。
- 公告內容支援 Markdown 標題、列表、連結、程式碼與 GFM 表格。
- 前端公告流程不再讀取 `frontend/public/docs/announcement.md`。
- `GET /api/v1/announcement` 文件與測試都明確描述最新 active announcement。
- Navbar 公告列摘要與 modal 詳情使用同一筆 `/api/v1/announcement` 資料。
