# 身份驗證模組 (Auth Module)

Auth 模組負責 OneShort 全系統的安全邊界，基於 JWT (JSON Web Token) 實作。

---

## 1. 業務功能 (Business Features)

- **使用者登錄與註冊**:
    - Discord OAuth2 登入與 Quick Login 都登入 `actor`。
    - Quick Login：輸入 `character_code + pin`；首次建立時額外填 `display_name`、`job_class_id`、`level`，後端建立 actor 與 primary character。
    - Discord 可直接建立 actor，也可從 `/me` 綁定到既有 Quick Login actor；若 Discord 已綁其他 actor，需走 merge preflight / confirm。
    - Quick Login-only actor 可建立角色、申請隊伍、收通知與建立 WebSocket 連線；隊伍可用 `allow_quick_login_players=false` 限制申請者必須已綁 Discord。
- **JWT 簽發與驗證**:
    - 會話管理：短效 Access Token 與長效 Refresh Token 都透過 HttpOnly Cookie 傳遞。
    - 前端不呼叫顯式 refresh API；受保護 API middleware 會在 access token 過期且 refresh token 仍有效時自動重簽 cookie。
    - Logout 會撤銷 token 並清除 cookie。
- **RBAC 基礎**:
    - 全局角色 (Admin, Member)。
    - 對接 `Character`：一個 actor 下可擁有多個 Character。
    - 管理員權限由 `actors.is_admin` 控制。

---

## 2. 前後端組件對應 (Code Mapping)

### **後端 (Backend)**
- **Domain**: `backend/internal/auth/domain.go` (Entity: `Actor`, `Session`, `TokenPair`).
- **Usecase**: `backend/internal/auth/usecase.go` (核心邏輯: `QuickLogin`, `HandleDiscordCallback`, `LinkDiscord`, `ConfirmDiscordMerge`).
- **Handler**: `backend/internal/auth/handler.go` (`/auth/*`, `/actors/me/*` API).

### **前端 (Frontend)**
- **Page**: `frontend/src/app/(auth)/auth/discord/callback/page.tsx`、`frontend/src/app/(main)/me/page.tsx`。
- **Store**: `useAuthStore`（保存 `actor`、`currentCharacter`、`isAuthenticated`、`hasCheckedSession`）。
- **Hooks**: `frontend/src/hooks/useAuth.ts` 負責 session bootstrap。
- **Navbar / LoginDialog**: 未登入時可切換 Discord 登入與 Quick Login；Quick Login actor 可在 `/me` 綁定 Discord。

---

## 3. 分析與維護性分析 (Analysis)

### 🟢 結構優點 (Pros)
- **無狀態認證**: JWT 減少了後存 Session 的壓力。
- **安全的 Refresh 策略**: 透過 Redis revocation + atomic refresh rotation，避免局部失敗把使用者 session 直接消耗掉。

### 🔴 當前分析 (Current State)
- **依賴 Redis 可用性**: revoke、PIN 防爆破與 Discord merge token 依賴 Redis，營運上需監控 Redis 延遲與錯誤率。
- **Actor merge 風險**: Discord 綁定若涉及兩個 actor 合併，必須維持 preflight blocker 與 confirm 時的二次檢查，避免搬移角色或通知時和隊伍狀態競態。
