# Plan: 擴充 Telegram Bot — 跑馬燈、Bug 管理、雙向回覆

**Status:** ✅ 已實作（文件於 2026-06-25 校正；原標 Draft 已過期）。指令實作於 `backend/internal/admin/telegram.go`（`/announce`、`/notice`、`/bugs`、`/bug`、`/bug-status`、`/bug-reply`、`/help`），outbound 走 `backend/internal/telegram/sender.go`（含 deduper）。下方驗收清單視為已完成。
**Owner:** Tian
**Created:** 2026-05-18
**Scope:** Backend (Go), Telegram webhook + outbound sender

---

## 1. Requirements Summary

擴充現有的 Telegram webhook ([backend/internal/admin/telegram.go](../../backend/internal/admin/telegram.go))，讓管理員可以透過 Telegram Bot 完成以下動作，並在群組中收到操作結果：

| 領域 | 目前狀態 | 本次新增 |
|------|---------|---------|
| 公告 (Announcement) | `/announce`、`/clear`、`/delete` 已可用 | 加上「回傳成功訊息」 |
| 跑馬燈 (Notice) | 僅 HTTP API ([handler.go:225](../../backend/internal/admin/handler.go#L225)) | `/notice <text>`、`/notice-clear` |
| Bug 列表 | 僅 HTTP API ([handler.go:81](../../backend/internal/bugreport/handler.go#L81)) | `/bugs`、`/bugs all`、`/bugs done`、`/bug <id>` |
| Bug 狀態 | 僅 HTTP API ([handler.go:112](../../backend/internal/bugreport/handler.go#L112)) | `/bug-status <id> <status>` |
| Bug 回覆 | 僅 HTTP API | `/bug-reply <id> <text>` |
| 說明 | 無 | `/help` |

**訪談結論：**
- 雙向：新增 outbound Bot Sender 客戶端（呼叫 Telegram Bot API `sendMessage`）
- 審核：所有 TG 觸發的操作 `updated_by` 一律寫入 `TELEGRAM_SYSTEM_ADMIN_ID`（與現行 `/announce` 一致）
- `/bugs` 預設列「未完成」（`open` + `in_progress`）最新 10 筆摘要
- 指令風格：離散指令，內容支援多行原樣保留

---

## 2. Acceptance Criteria

### A. Bot Sender 客戶端
- [ ] 新增 `backend/internal/telegram/sender.go`，提供介面 `Sender { SendMessage(ctx, chatID int64, text string) error }`
- [ ] 實作 `httpSender`：POST `https://api.telegram.org/bot<TOKEN>/sendMessage`，body 為 `{chat_id, text, parse_mode: "HTML", disable_web_page_preview: true}`
- [ ] 文字內容呼叫 `html.EscapeString` 防 HTML 注入（user-supplied bug content 必須 escape）
- [ ] 任何 4096 字以上的回應自動截斷至 4000 字並附上 `…（已截斷）`
- [ ] 提供 `noopSender` for test/dev when `TELEGRAM_BOT_TOKEN` 未設定
- [ ] HTTP timeout 5s；失敗時 `zap.L().Warn(...)` 不影響 webhook 200 回應

### B. 指令解析重構
- [ ] 將 [telegram.go:71-92](../../backend/internal/admin/telegram.go#L71-L92) 的 `switch` 替換為 `commandTable map[string]commandHandler`
- [ ] 解析規則：第一個 token = 指令，剩餘字串原樣保留（含 newline）
- [ ] `/bug-reply <uuid> <body>` 解析時：去掉指令後，第一個 space 前為 id，space 後（含 newline）整段為 reply 內容
- [ ] 未知指令 + 白名單 chat → 回覆 `❓ Unknown command. Try /help`（避免增加噪音，未知指令不再 silently drop）
- [ ] 既有 `/announce`、`/clear`、`/delete` 指令的測試簽章不變（5 個既有 telegram_test.go 測試必須仍綠）

### C. 新增公告類成功回覆
- [ ] `/announce <text>` 成功 → 回 `✅ Announcement added: <id前8>`
- [ ] `/clear` 成功 → 回 `✅ All announcements cleared`
- [ ] `/delete <id>` 成功 → 回 `✅ Announcement <id前8> deleted`；找不到 → `⚠️ Announcement not found`
- [ ] 內容為空 → `⚠️ Content required`

### D. 跑馬燈 (Notice) 指令
- [ ] `/notice <text>` → 呼叫 `adminUC.UpsertNotice(ctx, systemAdminID, UpsertNoticeInput{Content: text})`；成功回 `✅ Notice updated`
- [ ] `/notice-clear` → 呼叫 `adminUC.ClearNotice(ctx)`；成功回 `✅ Notice cleared`
- [ ] 內容超過 240 字（domain 限制）→ binding fail → 回 `⚠️ Notice content must be ≤ 240 chars`
- [ ] 內容空白 → 回 `⚠️ Content required`

### E. Bug 列表指令
- [ ] `/bugs` → 列 `status IN (open, in_progress)` 最新 10 筆
- [ ] `/bugs all` → 列最新 10 筆（不分狀態）
- [ ] `/bugs done` → 列 `status = completed` 最新 10 筆
- [ ] 輸出格式（每筆一行）：`<emoji> <id前8> · <status> · <title截60字>`
  - emoji：open=🔴 / in_progress=🟡 / completed=🟢
- [ ] 無結果 → 回 `📭 No bug reports`
- [ ] 標題尾端加：`Use /bug <id前8|full-uuid> to view details`

### F. Bug 詳情指令
- [ ] `/bug <id-or-prefix>` → 顯示完整資訊（id、status、title、description、contact mask、developer_reply、created_at）
- [ ] 支援 `id` 前 8 碼縮寫：若 prefix 唯一對應一筆則接受；多筆對應則回 `⚠️ Multiple matches, use full UUID`
- [ ] 找不到 → 回 `⚠️ Bug not found`
- [ ] description 超過 1500 字截斷加 `…`

### G. Bug 狀態變更
- [ ] `/bug-status <id> <open|in_progress|completed>` 透過 `bugUC.UpdateAdmin(ctx, id, UpdateAdminInput{Status: &status})`
- [ ] 成功 → 回 `✅ Bug <id前8> → <new-status>`
- [ ] 無效狀態 → 回 `⚠️ Status must be one of: open, in_progress, completed`
- [ ] 找不到 → 回 `⚠️ Bug not found`

### H. Bug 開發者回覆
- [ ] `/bug-reply <id> <body>` 透過 `bugUC.UpdateAdmin(ctx, id, UpdateAdminInput{DeveloperReply: &body})`
- [ ] body 保留 newline；經 `middleware.SanitizeTextPtr` 處理（usecase 內已有）
- [ ] 成功 → 回 `✅ Reply saved to bug <id前8>`
- [ ] body 空白 → 回 `⚠️ Reply body required`
- [ ] 找不到 → 回 `⚠️ Bug not found`

### I. 說明指令
- [ ] `/help` 列出所有指令、語法、範例（單則訊息 < 1500 字）

### J. 配線與設定
- [ ] 新增 env：`TELEGRAM_BOT_TOKEN`（outbound 才需要；未設定時用 noopSender + warn log）
- [ ] [main.go:435](../../backend/cmd/server/main.go#L435) `NewTelegramHandler` 簽章增加 `bugUC bugreport.UseCase` 與 `sender telegram.Sender`
- [ ] 在 main.go 內依 `cfg.TelegramEnabled && cfg.TelegramBotToken != ""` 建立 httpSender；否則建立 noopSender
- [ ] `.env.example` 補上 `TELEGRAM_BOT_TOKEN=`
- [ ] Swagger 標籤 (`@Tags Admin`) 在 webhook handler 上更新註解列出所有支援指令

### K. 測試
- [ ] 既有 5 支 telegram_test.go 全綠（不修改測試碼，只透過新建構式重新 wire 額外 mock）
- [ ] 新增單元測試 — 每個新指令至少 2 條：success path + 1 個錯誤路徑（未找到 / 無效狀態 / 內容空白）
- [ ] 新增 `mockSender` 攔截 outbound 訊息，assert `chatID + text` 一致
- [ ] 多行 reply 測試：body 含 `\n\n` 必須完整保留進 `UpdateAdminInput.DeveloperReply`
- [ ] HTML escape 測試：title 含 `<script>` 不能原樣回到 TG

---

## 3. Implementation Steps

### Step 1 — Telegram Sender 套件（30 min）
1. 新增資料夾 `backend/internal/telegram/`
2. 新增 [sender.go](../../backend/internal/telegram/sender.go)：`Sender` interface + `httpSender` + `noopSender`
3. 新增 [sender_test.go](../../backend/internal/telegram/sender_test.go)：用 `httptest.NewServer` 驗證 POST body / header / escape / 截斷
4. 無 DB / 無 webhook 依賴，可獨立 commit

### Step 2 — 指令路由重構（45 min）
1. 在 [telegram.go](../../backend/internal/admin/telegram.go) 新增 `commandHandler func(ctx, chatID, args string) string`，回傳的字串會被 sender 發出
2. 把 `/announce`、`/clear`、`/delete` 三條既有指令搬到 table
3. 新增成功回覆訊息（A.C. §C）
4. 跑既有 5 支單元測試確保不破壞

### Step 3 — 注入 BugUseCase 與 Sender（30 min）
1. `NewTelegramHandler` 簽章擴充 `bugUC bugreport.UseCase, sender telegram.Sender`
2. 修改 [main.go:435](../../backend/cmd/server/main.go#L435) 配線
3. 更新 5 支既有 telegram_test.go：把 `nil` 傳入新參數 — **不能修改測試邏輯**，所以採用 noopSender + nil bugUC（既有指令不會碰到 bugUC）
4. 確認 `go test -tags=unit ./internal/admin/...` 仍綠

### Step 4 — Notice 指令（30 min）
1. 在 commandTable 加 `/notice`、`/notice-clear`（A.C. §D）
2. 新增 2 條單元測試（成功 / 內容空白）

### Step 5 — Bug 列表與詳情（90 min）
1. **Repository 擴充**：[bugreport/domain.go](../../backend/internal/bugreport/domain.go) Repository 介面加 `ListByStatuses(ctx, statuses []string, limit int)` 與 `GetByIDPrefix(ctx, prefix string)`；現有 `List()` 維持公開 50 筆
2. **Repository 實作**：在 [bugreport/repository.go](../../backend/internal/bugreport/repository.go) 加新 method（注意 `id::text LIKE $1 || '%'` 並驗證 prefix ≥ 4 字元防 collision）
3. **UseCase 擴充**：加 `ListByFilter(ctx, filter)` 與 `GetByIDPrefix(ctx, prefix)`；確保 prefix < 4 字元時回 error
4. 在 commandTable 加 `/bugs`、`/bugs all`、`/bugs done`、`/bug <id>`（A.C. §E、§F）
5. 新增 4 條單元測試（每組指令 success + empty/not-found）

### Step 6 — Bug 狀態 + 回覆指令（45 min）
1. 在 commandTable 加 `/bug-status`、`/bug-reply`（A.C. §G、§H）
2. 共用 `resolveBugID(prefix)` helper（步驟 5 已建）
3. 新增 4 條單元測試（success / 無效狀態 / 找不到 / body 空白）

### Step 7 — `/help` 與 unknown command（15 min）
1. 在 commandTable 加 `/help`
2. switch fallthrough 改為「白名單 chat 且指令以 `/` 開頭」才回 unknown，避免一般訊息也被回應
3. 1 條單元測試

### Step 8 — 文件與 env（15 min）
1. 更新 [.env.example](../../backend/.env.example) 加 `TELEGRAM_BOT_TOKEN`
2. 更新 [docs/specs/admin.md](../../backend/docs/specs/admin.md) 補上完整指令列表
3. 更新 [docs/features.md](../../backend/docs/features.md) 補上 Telegram 章節

---

## 4. Risks & Mitigations

| 風險 | 影響 | 緩解 |
|------|------|------|
| Telegram API rate limit (1 msg/sec/chat, 30 msg/sec global) | 高頻指令會被 429 | sender 失敗只 warn log，不影響 webhook 200；同步發送，依賴 TG 端 backoff |
| 使用者輸入含 HTML 標籤（XSS 反射回 TG） | 中 | sender 統一 `html.EscapeString`；使用 `parse_mode: HTML` 但只信任 emoji 與固定模板字 |
| 4096 字限制 | 中 | sender 統一截斷至 4000；`/bugs` 預設 limit 10、description 截 1500 字 |
| ID prefix 衝突 | 中 | prefix 至少 4 字元；多筆對應時要求完整 UUID |
| `bugUC` nil 傳入既有 5 支測試 | 低 | 既有指令不會碰到 bugUC，安全；新指令測試需傳 mock bugUC |
| Webhook secret token 仍是 chat allowlist 控管，bot 被踢出群仍可繼續呼叫 | 低 | `allowedChatIDs` 已是強約束；不擴大攻擊面 |
| TG outbound 失敗導致 user 不知道指令是否成功 | 中 | 不影響資料一致性（DB 已寫入）；warn log 可用 Prometheus 監控（不在本次 scope） |

---

## 5. Verification Steps

1. `go test -tags=unit ./internal/admin/... ./internal/bugreport/... ./internal/telegram/...` 全綠
2. `go build ./...` 通過
3. 手動 E2E（dev 環境）：
   - 啟動後端，設定 `TELEGRAM_ENABLED=true`、`TELEGRAM_BOT_TOKEN=<dev-token>`、`TELEGRAM_ALLOWED_CHAT_IDS=<my-chat>`、`TELEGRAM_SYSTEM_ADMIN_ID=<seed-uuid>`
   - 在群組依序測試：`/help` → `/announce 測試` → `/notice 跑馬燈` → `/bugs`（先用 HTTP API POST 一筆 bug）→ `/bug-status <id> in_progress` → `/bug-reply <id> 多行\n回覆` → 回到前端確認跑馬燈、bug 狀態與回覆都生效
4. Swagger UI 確認 `/api/v2/webhook/telegram` 註解列出完整指令

---

## 6. Out of Scope

- Telegram inline keyboard / callback button（暫不引入互動式 UI）
- Bug 圖檔上傳（telegram photo handling）
- 多語系（指令訊息僅英文 + emoji）
- TG user → system user 對應表（未來若需更細審核可單獨開 plan）
- Rate-limiting / metrics dashboard（依賴既有 Prometheus 設定即可監控 `telegram.sender.error`）

---

## 7. File Touch Map

**新增**
- `backend/internal/telegram/sender.go`
- `backend/internal/telegram/sender_test.go`

**修改**
- [backend/internal/admin/telegram.go](../../backend/internal/admin/telegram.go) — 指令路由重構、新指令、注入 bugUC + sender
- [backend/internal/admin/telegram_test.go](../../backend/internal/admin/telegram_test.go) — 新建構式參數 + 新指令測試
- [backend/internal/bugreport/domain.go](../../backend/internal/bugreport/domain.go) — Repository/UseCase 介面加 `ListByFilter`、`GetByIDPrefix`
- [backend/internal/bugreport/repository.go](../../backend/internal/bugreport/repository.go) — 新 SQL 實作
- [backend/internal/bugreport/usecase.go](../../backend/internal/bugreport/usecase.go) — 新 method 與 prefix 長度驗證
- [backend/cmd/server/main.go](../../backend/cmd/server/main.go) — 注入 bugUC + sender，新 env 解析
- [backend/.env.example](../../backend/.env.example) — `TELEGRAM_BOT_TOKEN=`
- [backend/docs/specs/admin.md](../../backend/docs/specs/admin.md) — 指令文件
- [backend/docs/features.md](../../backend/docs/features.md) — 補 Telegram 章節

**不變**
- `migrations/`（無需新 schema）
- `internal/bugreport/handler.go`、`usecase.go` 的 HTTP 路由
- 既有 `/announce` `/clear` `/delete` 行為（只多了成功回覆）

---

## 8. Estimated Effort

| Step | 估時 |
|------|------|
| 1 — Sender 套件 | 30 min |
| 2 — 指令路由重構 | 45 min |
| 3 — 注入配線 | 30 min |
| 4 — Notice 指令 | 30 min |
| 5 — Bug 列表/詳情 | 90 min |
| 6 — Bug 狀態/回覆 | 45 min |
| 7 — Help + unknown | 15 min |
| 8 — Docs/env | 15 min |
| **合計** | **~5 hours** |
