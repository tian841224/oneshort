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

4. AnnouncementBar
   - Given latest public announcement。
   - Then bar 顯示同一筆最新公告摘要。
   - Click bar 會開啟共用 announcement modal，而不是 local custom overlay。

## 驗證命令

- Backend：`go test -tags unit ./...`
- Frontend：targeted Vitest tests、`npx tsc --noEmit`、`npm run lint -- --max-warnings=0`、`npm run build`

## 手動檢查

- Footer 公告按鈕、navbar 公告列、自動彈窗都顯示同一個 modal shell。
- 小視窗高度下 modal 仍可滾動與關閉。
