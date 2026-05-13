# 公告 footer 與 DB modal 實作計畫

## 目標

移除 footer 的「開發計畫」與「已知問題」功能，改為「公告」按鈕；公告內容不再讀取前端 `public/docs` 靜態檔，而是透過 DB 公開公告 API 顯示最新一筆公告。公告顯示方式改為與 Bug 回報相同的共用視窗 shell，內容以 Markdown / GFM 格式渲染。

## 修正方案評估

### 方案 A：跑馬燈繼續顯示公告 `content` 的摘要

- 維護性：低，Markdown 全文與短 notice 的責任混在同一欄位，後續很容易再次出現 modal 內容與跑馬燈文字互相污染。
- 效能：高，不需新欄位或新查詢。
- 安全性：中，仍走現有 Markdown renderer，但把全文塞入 Navbar 增加非預期顯示面。
- 結論：拒絕。這正是本次回歸根因。

### 方案 B：建立完全獨立 `admin_notices` 表與 `/notice` API

- 維護性：中高，notice 生命週期完全獨立。
- 效能：中，需要額外 API/query，Navbar 與公告 modal 也要各自輪詢。
- 安全性：高，NoticeBar 只顯示純文字，且不會把公告 Markdown 推進頁首。
- 結論：採用。使用者已明確要求跑馬燈是獨立功能與獨立內容，不可依附公告記錄。

### 方案 C：在公告記錄新增獨立 `notice` 欄位

- 維護性：高，公告 modal 使用 `content`，Navbar 跑馬燈使用 `notice`，資料責任清楚且仍沿用既有公告管理流程。
- 效能：高，沿用 `/api/v1/announcement` 單次查詢，無額外網路請求。
- 安全性：高，`notice` 以純文字顯示，`content` 繼續只在 Markdown modal 中渲染。
- 結論：拒絕。雖然欄位分工清楚，但 NoticeBar 生命週期仍被公告記錄綁住，違反「跑馬燈是獨立功能」的邊界。

## 已選方案

採用後端契約收斂方案：

- `GET /api/v1/announcement` 代表「最新一筆啟用中的 DB 公告」。
- 最新排序以 `created_at DESC, id DESC` 為準，避免和優先權排序混用。
- `GET /api/v1/announcements` 保留既有列表用途與優先權排序，但 navbar 公告列不再用列表摘要，避免點擊後內容和 modal 不一致。
- `GET /api/v1/notice` 代表「最新一筆啟用中的獨立 NoticeBar 內容」，Navbar 只讀此端點。
- 前端 footer 與自動彈窗共用 DB-backed announcement modal；Navbar `NoticeBar` 不開啟公告 modal，也不讀公告內容。
- 公告 `content` 寫入 DB 時必須保留原始空白與縮排；只能用 trim 判斷是否為空，不可將 trim 後內容送出。

## 被拒方案

- 前端自行從 `/announcements` 取列表後排序：會讓最新公告規則分散在前端，且 `/announcement` 繼續保留誤導性的 priority-first 語意。
- 保留 `MarkdownModal` 與 `public/docs/announcement.md`：與使用者要求「不再使用讀取前端檔案」衝突，且會讓公告資料來源有兩套。
- 使用公告 `content` 產生 Navbar 跑馬燈摘要：會讓 Markdown 全文中的表格、縮排與長內容出現在頁首，違反 notice 應獨立於公告內容的需求。
- 將 notice 欄位掛在 `admin_announcements`：NoticeBar 生命週期仍依賴公告，會讓「最新公告」和「頁面跑馬燈」再次互相污染。

## 實作步驟

1. 後端
   - 將 singular announcement repository/usecase/handler 語意改為 latest active announcement。
   - 將公告內容長度上限提高到 4000，支援實際 Markdown 公告。
   - 新增 `admin_notices` table 與 `/api/v1/notice`、`/api/v1/admin/notice`，將跑馬燈文字生命週期和公告完全分離。
   - 補上 repository/usecase/handler 測試，明確鎖定 `created_at DESC, id DESC`。
   - 更新後端 API 文件與 Swagger 產物。

2. 前端
   - `uiStore` 移除 `roadmap`、`known-issues` modal type。
   - `Footer` 改為只顯示「公告」與「回報 Bug」。
   - Announcement modal 改用共用 `Modal` shell，顯示 DB 最新公告並支援 Markdown / GFM。
   - 移除舊公告列元件，新增 `NoticeBar`，只顯示 `/api/v1/notice` 的獨立純文字內容。
   - 後台新增獨立 NoticeBar 管理區；公告管理只送公告 Markdown `content` 與 `priority`。
   - `AnnouncementManager` 改用 DB 最新公告的 `id + updated_at` seen token，不再使用硬編碼版本字串。
   - 移除 `MarkdownModal`、`docsApi` 與 static docs route 的 runtime 依賴。

3. 文件與驗證
   - 更新 frontend / backend 文件中公告與 footer 語意。
   - 執行前後端單元測試、型別檢查、lint/build（依可用環境）。

## 驗收條件

- footer 不再出現「開發計畫」與「已知問題」。
- footer「公告」按鈕與自動彈窗顯示 DB 最新公告視窗；Navbar NoticeBar 不開啟公告 modal。
- Navbar 跑馬燈內容來自獨立 `/api/v1/notice`，不顯示公告 Markdown `content`。
- 後台送出公告時，`content` 的前後空白、換行與縮排會原樣進入 API/DB。
- 公告視窗使用共用 `Modal` shell，外觀與 bug 回報視窗同一類型。
- 公告內容支援 Markdown 標題、列表、連結、程式碼與 GFM 表格。
- 前端公告流程不再讀取 `frontend/public/docs/announcement.md`。
- `GET /api/v1/announcement` 文件與測試都明確描述最新 active announcement。
- NoticeBar 與公告 modal 使用不同資料來源：`/api/v1/notice` 只服務跑馬燈，`/api/v1/announcement` 只服務公告視窗。
