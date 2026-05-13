# Test Spec：DB 最新公告視窗與 footer 公告入口

## 後端測試

1. Repository latest ordering
   - Given 多筆 active announcement。
   - When 呼叫 `GetLatestActiveAnnouncement`。
   - Then SQL ordering 使用 `created_at DESC, id DESC LIMIT 1`。

2. Usecase forwarding
   - Given mock repository 回傳 latest announcement。
   - When 呼叫 usecase singular announcement 方法。
   - Then 回傳 repository 結果且不改變列表 API。

3. Handler public endpoint
   - Given public `/announcement` request。
   - When usecase 回傳公告、nil、錯誤。
   - Then 維持成功 / 空值 / 500 行為，並使用 latest announcement 方法。

4. Notice endpoint
   - Given 獨立 active notice。
   - When 呼叫 `GET /notice` 或 `PUT /admin/notice`。
   - Then 回傳或更新 `admin_notices`，不讀寫 `admin_announcements`。

## 前端測試

1. Footer buttons
   - Render footer。
   - Expect 不存在「開發計畫」、「已知問題」。
   - Expect 存在「公告」、「回報 Bug」。
   - Click 「公告」後呼叫 `openModal('announcement')`。

2. Announcement modal
   - Given DB announcement content 包含 GFM table。
   - When modal open。
   - Then table、標題、連結可正常 render。
   - Click `#report-bug` link 會關閉公告並開啟 bug 回報流程。

3. AnnouncementManager seen state
   - Given latest announcement token 不存在於 localStorage。
   - Then 自動 open announcement modal。
   - Given localStorage token 已等於 latest announcement。
   - Then 不重複 open。

4. NoticeBar
   - Given latest public notice 有純文字 `content`。
   - Then bar 只顯示 notice content，不可顯示 announcement Markdown。
   - Given latest public notice 沒有內容。
   - Then Navbar 不顯示跑馬燈。
   - NoticeBar 不開啟 announcement modal。

5. AdminPage announcement form
   - Given 公告 `content` 含前後空白、換行與 Markdown 縮排。
   - When 新增公告。
   - Then mutation payload 保留原始 `content`，且不包含 notice。

6. AdminPage NoticeBar form
   - Given 獨立 notice 文字。
   - When 更新 NoticeBar。
   - Then mutation 呼叫獨立 notice API，不送 announcement API。

## 驗證命令

- Backend：`go test -tags unit ./...`
- Frontend：targeted Vitest tests、`npx tsc --noEmit`、`npm run lint -- --max-warnings=0`、`npm run build`

## 手動檢查

- Footer 公告按鈕與自動彈窗顯示同一個 modal shell；NoticeBar 顯示獨立跑馬燈內容。
- 小視窗高度下 modal 仍可滾動與關閉。
