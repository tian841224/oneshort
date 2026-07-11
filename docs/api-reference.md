# OneShort API 參考文件 (API Reference) — 已遷移

> 本文件原為完整 API 參考（總覽頁 + 6 個模組子文件 `docs/api-reference/{auth,party,guild,notify,admin,others}.md`，含各端點完整 request/response JSON 範例、共用認證說明、WebSocket 訊息格式與錯誤碼對照）。
> 依文件重整決策（root repo 僅保留導覽/總覽，後端實作細節移入 backend repo），全部內容已遷移至 **backend repo `docs/api-reference/`**，該處為權威版本。

## 現在去哪裡看

| 要找什麼 | 位置（backend repo） |
|---------|---------------------|
| 總覽：共用認證 Cookie 說明、**WebSocket 訊息格式**、**錯誤碼對照表** | `docs/api-reference/README.md` |
| 身份驗證與角色（Quick Login、Discord OAuth、merge、角色 CRUD） | `docs/api-reference/auth.md` |
| 隊伍（含快速隊伍、訪客互通、攻略/小工具、席位、封鎖清單） | `docs/api-reference/party.md` |
| 公會（成員、公告、聊天室、公會隊伍、自動配對） | `docs/api-reference/guild.md` |
| 通知與大廳聊天 | `docs/api-reference/notify.md` |
| 管理員後台與系統公告/NoticeBar | `docs/api-reference/admin.md` |
| 其他（OCR、Bug 回報、公開統計） | `docs/api-reference/others.md` |
| 精簡 endpoint 清單（唯一權威來源，僅列路徑） | `docs/features.md` |
| OpenAPI 規格（自動產生） | `docs/swagger.yaml` |

注：backend 為獨立巢狀 repo（本 repo 工作目錄下的 `backend/`），上表路徑均相對於 backend repo 根目錄。
