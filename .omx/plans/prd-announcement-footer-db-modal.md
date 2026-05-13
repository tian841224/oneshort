# PRD：DB 最新公告視窗與 footer 公告入口

## 背景

目前 footer 同時提供「開發計畫」、「已知問題」與「回報 Bug」，前兩者透過前端靜態 Markdown 檔案顯示。公告自動彈窗也仍使用 `public/docs/announcement.md` 和硬編碼版本號。這會造成公告來源分散、內容更新需要前端部署，且 footer 的功能入口與目前產品需求不一致。

## 目標

- 移除「開發計畫」與「已知問題」前端功能入口。
- 將 footer 按鈕改為「公告」與「回報 Bug」。
- 公告視窗改為與 Bug 回報相同的共用 modal shell。
- 公告內容使用 DB 最新一筆 active announcement，並以 Markdown / GFM 顯示。
- 自動公告彈窗使用 DB 公告 freshness 作為 seen-state，不再使用硬編碼前端版本。

## 非目標

- 不重做後台公告管理 UI。
- 不改變 `/api/v1/announcements` 的列表排序用途。
- 不移除歷史 `public/docs/*.md` 內容檔本身，除非沒有任何 runtime 依賴後另案清理。
- 不在本次改動新增第三方套件。

## 使用者故事

- 作為一般玩家，我可以從頁尾點「公告」看到最新公告，不需要知道開發計畫或已知問題頁。
- 作為回訪玩家，當 DB 有新公告時，登入後會自動看到一次最新公告。
- 作為營運或管理者，我只要更新 DB 公告，就能影響使用者看到的公告內容，不需要改前端靜態檔。

## 功能需求

- `GET /api/v1/announcement` 回傳最新一筆 `is_active = true` 的公告，排序為 `created_at DESC, id DESC`。
- 前端公告 modal 需支援 Markdown / GFM 表格、連結、程式碼、列表與標題。
- 公告 modal 的空狀態、載入狀態與錯誤狀態需可讀且可關閉。
- `#report-bug` 連結仍可導向 / 開啟 bug 回報 modal。
- `AnnouncementManager` seen token 使用公告 `id` 與 `updated_at`，DB 最新公告改變時自動重新顯示。
- Navbar 公告列和 modal 詳情必須使用同一筆 `/api/v1/announcement` 資料，且 singular announcement query 需定期刷新以支援長時間停留頁面。

## 驗收標準

- Footer render 測試證明只有「公告」與「回報 Bug」兩個主要按鈕。
- Announcement modal 測試證明 Markdown 表格可以顯示。
- AnnouncementManager 測試證明 seen token 未命中時會 open announcement，命中時不會重複 open。
- Backend repository / handler / usecase 測試鎖定 singular endpoint 的 latest active 語意。
- 文件不再描述 singular announcement 是 priority-first。
