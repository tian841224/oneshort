# 身份驗證模組 (Auth Module)

> **狀態**：現行功能。本檔僅為高層功能總覽；實作規格一律以下方「深入文件」為準。

---

## 功能總覽

Auth 模組負責全系統的安全邊界，基於 JWT 實作。支援兩種登入方式，皆登入同一種 `actor` 身分：**Quick Login**（`character_code + pin`，首次使用時一併建立 actor 與主要角色）與 **Discord OAuth2**（可直接建立 actor，也可從 `/me` 綁定到既有 Quick Login actor；若 Discord 已綁其他 actor，走 merge preflight / confirm 二段流程）。Quick Login-only actor 擁有完整功能（建角色、申請隊伍、通知、WebSocket），但隊伍可用 `allow_quick_login_players=false` 要求申請者必須已綁 Discord。

會話管理採短效 Access Token + 長效 Refresh Token，皆走 HttpOnly Cookie；前端不呼叫顯式 refresh API，middleware 會在 access token 過期時自動重簽。管理員權限由 `actors.is_admin` 控制。

營運注意：token 撤銷、PIN 防爆破與 Discord merge token 都依賴 Redis，需監控其延遲與錯誤率；Discord 綁定涉及兩個 actor 合併時，preflight blocker 與 confirm 二次檢查是防止角色/通知搬移與隊伍狀態競態的關鍵，不可繞過。

---

## 深入文件

- **後端規格書**：backend repo `docs/specs/auth.md` — 領域實體、QuickLogin/Discord Callback/Link/Merge 流程、Token 與 PIN 防爆破安全設計、中間件驗證、錯誤碼
- **API 參考**：backend repo `docs/api-reference/auth.md`
- **後端資料流**：backend repo `docs/data_flow.md` §2（Auth Phase 2 資料流）
- **前端行為**：frontend repo `docs/frontend-logic.md` §一（authStore）、§二（登入/登出/認領/`/me` 帳號設定）
