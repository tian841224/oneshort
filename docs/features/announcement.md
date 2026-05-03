# 開發文件：公告欄功能（跑馬燈 + 彈窗 + Telegram Bot）

**版本**: 1.0  
**日期**: 2026-04-08  
**狀態**: 設計完成，待實作

---

## 目錄

1. [功能需求](#1-功能需求)
2. [現有架構盤點](#2-現有架構盤點)
3. [整體資料流](#3-整體資料流)
4. [資料庫設計](#4-資料庫設計)
5. [後端實作規格](#5-後端實作規格)
6. [前端實作規格](#6-前端實作規格)
7. [API 規格](#7-api-規格)
8. [Telegram Bot 設定](#8-telegram-bot-設定)
9. [實作順序](#9-實作順序)
10. [設計決策說明](#10-設計決策說明)

---

## 1. 功能需求

| 功能 | 說明 | 位置 |
|------|------|------|
| 跑馬燈公告列 | Navbar 上方獨立欄位，顯示滾動的系統公告文字 | Header（Nav 上方固定列） |
| 多則公告輪播 | 多則有效公告以分隔符串接，連續滾動播放 | 跑馬燈文字區域 |
| 點擊彈窗 | 點擊公告列後彈出視窗，完整列出所有有效公告 | 全頁 Modal overlay |
| Telegram Bot 管理 | 透過 Telegram 指令新增或清除公告，不需登入後台 | Telegram 私訊 / 群組 |

---

## 2. 現有架構盤點

### 已存在且可直接利用

| 現有資源 | 位置 | 說明 |
|---------|------|------|
| `admin_announcements` 資料表 | `migrations/0001_init.up.sql` | 含 `id, content, is_active, created_by, updated_by, created_at, updated_at` |
| 公開公告 API | `GET /api/v1/announcement` | 返回單則有效公告（`{ data: Announcement \| null }`） |
| Admin 公告 API | `PUT /admin/announcement`、`DELETE /admin/announcement` | UpsertAnnouncement（取代全部）、ClearAnnouncement |
| `AdminAnnouncement` 型別 | `frontend/src/lib/api/adminApi.ts` | 含 `id, content, is_active, created_by, updated_by, created_at, updated_at` |
| `useSystemAnnouncement` hook | `frontend/src/hooks/useAdminDashboard.ts` | 拉取單則公告，`queryKey: ['systemAnnouncement']` |
| Navbar 公告列（靜態） | `Navbar.tsx` lines 70-74 | 目前為靜態文字 `系統公告：{content}`，無跑馬燈、無彈窗 |
| Admin 後台公告管理 | `frontend/src/app/admin/page.tsx` | 目前支援「發布公告（取代）」與「清除公告」 |

### 需要新增或修改

| 層次 | 變更內容 |
|------|---------|
| DB | 新增 `priority` 欄位，支援多則公告排序 |
| Backend | 新增複數公告端點（不取代現有單則端點）；新增個別刪除端點；新增 Telegram webhook |
| Frontend | `adminApi.ts`：新增複數端點方法；`useAdminDashboard.ts`：新增複數 hook 與 mutations；新增 `AnnouncementBar.tsx`、`AnnouncementModal.tsx` 元件；更新 `Navbar.tsx`；更新 admin page |

---

## 3. 整體資料流

### 3.1 公告顯示流程

```
後端 DB (admin_announcements)
    └─► GET /api/v1/announcements  (公開，返回 []Announcement)
            └─► useSystemAnnouncements hook (refetchInterval: 60s)
                    └─► AnnouncementBar 元件
                            ├─► 多則公告串接 → CSS 跑馬燈動畫
                            └─► onClick → AnnouncementModal 彈窗
```

### 3.2 管理員操作（後台 Admin Page）

```
管理員進入 /admin
    ├─► GET /api/v1/admin/announcements   → 顯示所有有效公告清單
    ├─► POST /api/v1/admin/announcement  → 新增單則（不清除現有）
    ├─► DELETE /api/v1/admin/announcement/:id → 停用單則
    └─► DELETE /api/v1/admin/announcement    → 清除全部（現有行為保留）
```

### 3.3 Telegram Bot 操作

```
管理員在 Telegram 傳送指令
    └─► Telegram Server
            └─► POST /api/v1/webhook/telegram
                    ├─► 驗證 X-Telegram-Bot-Api-Secret-Token header
                    ├─► 驗證 chat_id 在允許清單中
                    ├─► /announce <文字>  → AddAnnouncement（加法，不清除）
                    ├─► /clear           → ClearAnnouncement（清除全部）
                    └─► /delete <uuid>   → DeleteAnnouncement（停用單則）
```

---

## 4. 資料庫設計

### Migration 檔案

**路徑**：`backend/migrations/0009_multi_announcements.up.sql`

```sql
ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_admin_announcements_active_priority
    ON admin_announcements (is_active, priority DESC, created_at DESC)
    WHERE is_active = TRUE;
```

**Rollback**：`backend/migrations/0009_multi_announcements.down.sql`

```sql
DROP INDEX IF EXISTS idx_admin_announcements_active_priority;
ALTER TABLE admin_announcements DROP COLUMN IF EXISTS priority;
```

### `admin_announcements` 表（更新後）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | Primary Key（gen_random_uuid） |
| `content` | TEXT | 公告文字內容（max 500 chars） |
| `is_active` | BOOLEAN | 是否有效（停用而非刪除） |
| `priority` | SMALLINT | 顯示排序權重，數字越大越前（預設 0）|
| `created_by` | UUID | FK → users.id |
| `updated_by` | UUID | FK → users.id |
| `created_at` | TIMESTAMPTZ | 建立時間 |
| `updated_at` | TIMESTAMPTZ | 更新時間 |

> **排序規則**：`priority DESC, created_at DESC`，即相同權重時新建立的優先顯示。

---

## 5. 後端實作規格

### 5.1 修改檔案清單

| 檔案 | 修改類型 | 說明 |
|------|---------|------|
| `internal/admin/domain.go` | 修改 | 新增 `Priority` 欄位、`AddAnnouncementInput`、3 個 interface 方法 |
| `internal/admin/repository.go` | 修改 | 新增 3 個 repository 方法 |
| `internal/admin/usecase.go` | 修改 | 新增 3 個 delegating 方法 |
| `internal/admin/handler.go` | 修改 | 新增 4 個 handler + 更新路由註冊 |
| `internal/admin/telegram.go` | **新增** | Telegram webhook 處理器 |
| `cmd/server/main.go` | 修改 | 新增 Telegram 相關 env var 讀取與條件性路由注冊 |

### 5.2 `internal/admin/domain.go` 修改

**`Announcement` struct 新增欄位：**

```go
type Announcement struct {
    ID        uuid.UUID `db:"id" json:"id"`
    Content   string    `db:"content" json:"content"`
    IsActive  bool      `db:"is_active" json:"is_active"`
    Priority  int16     `db:"priority" json:"priority"`   // 新增
    CreatedBy uuid.UUID `db:"created_by" json:"created_by"`
    UpdatedBy uuid.UUID `db:"updated_by" json:"updated_by"`
    CreatedAt time.Time `db:"created_at" json:"created_at"`
    UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
```

**新增 Input 型別：**

```go
// AddAnnouncementInput 為加法新增，不取代現有公告
type AddAnnouncementInput struct {
    Content  string `json:"content" binding:"required,max=500"`
    Priority int16  `json:"priority"` // 選填，預設 0
}
```

**`Repository` 與 `UseCase` interface 新增方法：**

```go
ListActiveAnnouncements(ctx context.Context) ([]Announcement, error)
AddAnnouncement(ctx context.Context, adminID uuid.UUID, input AddAnnouncementInput) (*Announcement, error)
DeleteAnnouncement(ctx context.Context, id uuid.UUID) error
```

> 現有 `GetActiveAnnouncement`、`UpsertAnnouncement`、`ClearAnnouncement` **保留不變**，維持向後相容。

### 5.3 `internal/admin/repository.go` 新增方法

```go
func (r *repository) ListActiveAnnouncements(ctx context.Context) ([]Announcement, error) {
    var list []Announcement
    err := r.db.SelectContext(ctx, &list,
        `SELECT id, content, is_active, priority, created_by, updated_by, created_at, updated_at
         FROM admin_announcements
         WHERE is_active = TRUE
         ORDER BY priority DESC, created_at DESC`,
    )
    if err != nil {
        return nil, fmt.Errorf("admin.repository.ListActiveAnnouncements: %w", err)
    }
    return list, nil
}

func (r *repository) AddAnnouncement(ctx context.Context, adminID uuid.UUID, input AddAnnouncementInput) (*Announcement, error) {
    id, err := uuid.NewV7()
    if err != nil {
        return nil, fmt.Errorf("admin.repository.AddAnnouncement: uuid: %w", err)
    }
    var a Announcement
    err = r.db.QueryRowxContext(ctx,
        `INSERT INTO admin_announcements (id, content, is_active, priority, created_by, updated_by)
         VALUES ($1, $2, TRUE, $3, $4, $4)
         RETURNING id, content, is_active, priority, created_by, updated_by, created_at, updated_at`,
        id, input.Content, input.Priority, adminID,
    ).StructScan(&a)
    if err != nil {
        return nil, fmt.Errorf("admin.repository.AddAnnouncement: %w", err)
    }
    return &a, nil
}

func (r *repository) DeleteAnnouncement(ctx context.Context, id uuid.UUID) error {
    _, err := r.db.ExecContext(ctx,
        `UPDATE admin_announcements SET is_active = FALSE WHERE id = $1`,
        id,
    )
    if err != nil {
        return fmt.Errorf("admin.repository.DeleteAnnouncement: %w", err)
    }
    return nil
}
```

### 5.4 `internal/admin/handler.go` 修改

**`RegisterPublicRoutes` 新增：**

```go
func (h *Handler) RegisterPublicRoutes(public *gin.RouterGroup) {
    public.GET("/announcement", h.GetAnnouncement)    // 保留（向後相容）
    public.GET("/announcements", h.ListAnnouncements) // 新增（複數）
}
```

**`RegisterRoutes` admin 群組新增：**

```go
admin.GET("/announcements", h.ListAnnouncementsAdmin)
admin.POST("/announcement", h.AddAnnouncement)
admin.DELETE("/announcement/:id", h.DeleteAnnouncementByID)
// 保留現有：
// admin.GET("/announcement", h.GetAnnouncement)
// admin.PUT("/announcement", h.UpsertAnnouncement)
// admin.DELETE("/announcement", h.ClearAnnouncement)
```

**新增 handler 函式：**

```go
// ListAnnouncements 公開端點，返回所有有效公告陣列
func (h *Handler) ListAnnouncements(c *gin.Context) {
    list, err := h.uc.ListActiveAnnouncements(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get announcements"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": list})
}

// AddAnnouncement 加法新增，不清除現有公告
func (h *Handler) AddAnnouncement(c *gin.Context) {
    var input AddAnnouncementInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    adminID := middleware.GetUserID(c)
    a, err := h.uc.AddAnnouncement(c.Request.Context(), adminID, input)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add announcement"})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"data": a})
}

// DeleteAnnouncementByID 停用單則公告
func (h *Handler) DeleteAnnouncementByID(c *gin.Context) {
    id, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
        return
    }
    if err := h.uc.DeleteAnnouncement(c.Request.Context(), id); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete announcement"})
        return
    }
    c.Status(http.StatusNoContent)
}
```

### 5.5 `internal/admin/telegram.go`（新增檔案）

```go
package admin

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

// TelegramHandler 處理 Telegram Bot webhook 事件
type TelegramHandler struct {
    uc             UseCase
    secret         string
    allowedChatIDs map[int64]struct{}
    systemAdminID  uuid.UUID
}

func NewTelegramHandler(uc UseCase, secret string, allowedChatIDs []int64, systemAdminID uuid.UUID) *TelegramHandler {
    m := make(map[int64]struct{}, len(allowedChatIDs))
    for _, id := range allowedChatIDs {
        m[id] = struct{}{}
    }
    return &TelegramHandler{uc: uc, secret: secret, allowedChatIDs: m, systemAdminID: systemAdminID}
}

// RegisterRoutes 注冊於公開路由群組（不需 JWT，由 secret token header 保護）
func (h *TelegramHandler) RegisterRoutes(r *gin.RouterGroup) {
    r.POST("/webhook/telegram", h.HandleWebhook)
}

func (h *TelegramHandler) HandleWebhook(c *gin.Context) {
    // 1. 驗證 Telegram 發送的 secret token
    if c.GetHeader("X-Telegram-Bot-Api-Secret-Token") != h.secret {
        c.Status(http.StatusUnauthorized)
        return
    }

    var update telegramUpdate
    if err := c.ShouldBindJSON(&update); err != nil || update.Message == nil {
        c.Status(http.StatusOK) // Telegram 要求永遠返回 200
        return
    }

    // 2. 驗證 chat_id 是否在允許清單中
    if _, ok := h.allowedChatIDs[update.Message.Chat.ID]; !ok {
        c.Status(http.StatusOK)
        return
    }

    text := strings.TrimSpace(update.Message.Text)
    ctx := c.Request.Context()

    switch {
    case strings.HasPrefix(text, "/announce "):
        content := strings.TrimSpace(strings.TrimPrefix(text, "/announce "))
        if content != "" {
            h.uc.AddAnnouncement(ctx, h.systemAdminID, AddAnnouncementInput{Content: content})
        }
    case text == "/clear":
        h.uc.ClearAnnouncement(ctx)
    case strings.HasPrefix(text, "/delete "):
        idStr := strings.TrimSpace(strings.TrimPrefix(text, "/delete "))
        if id, err := uuid.Parse(idStr); err == nil {
            h.uc.DeleteAnnouncement(ctx, id)
        }
    }

    c.Status(http.StatusOK)
}

// Telegram Update 最小結構（只解析需要的欄位）
type telegramUpdate struct {
    UpdateID int64            `json:"update_id"`
    Message  *telegramMessage `json:"message"`
}

type telegramMessage struct {
    Text string       `json:"text"`
    Chat telegramChat `json:"chat"`
}

type telegramChat struct {
    ID int64 `json:"id"`
}
```

### 5.6 `cmd/server/main.go` 修改

**新增 Telegram 相關 env var：**

```go
TelegramEnabled        bool   // TELEGRAM_ENABLED
TelegramWebhookSecret  string // TELEGRAM_WEBHOOK_SECRET
TelegramAllowedChatIDs string // TELEGRAM_ALLOWED_CHAT_IDS（逗號分隔 int64）
TelegramSystemAdminID  string // TELEGRAM_SYSTEM_ADMIN_ID（現有管理員 UUID）
```

**條件性注冊 Telegram webhook：**

```go
if cfg.TelegramEnabled {
    systemAdminID, _ := uuid.Parse(cfg.TelegramSystemAdminID)
    chatIDs := parseTelegramChatIDs(cfg.TelegramAllowedChatIDs)
    tgHandler := admin.NewTelegramHandler(adminUC, cfg.TelegramWebhookSecret, chatIDs, systemAdminID)
    tgHandler.RegisterRoutes(publicGroup) // POST /api/v1/webhook/telegram
}

func parseTelegramChatIDs(s string) []int64 {
    var ids []int64
    for _, part := range strings.Split(s, ",") {
        if id, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64); err == nil {
            ids = append(ids, id)
        }
    }
    return ids
}
```

---

## 6. 前端實作規格

### 6.1 新增與修改檔案清單

| 檔案 | 類型 | 說明 |
|------|------|------|
| `frontend/src/lib/api/adminApi.ts` | 修改 | 新增複數公告 API 方法 |
| `frontend/src/hooks/useAdminDashboard.ts` | 修改 | 新增複數 hook 與 add/delete mutations |
| `frontend/src/components/auth/AnnouncementBar.tsx` | **新增** | 跑馬燈公告欄元件 |
| `frontend/src/components/auth/AnnouncementModal.tsx` | **新增** | 點擊後的公告彈窗元件 |
| `frontend/src/app/globals.css` | 修改 | 新增跑馬燈 CSS 動畫 |
| `frontend/src/components/auth/Navbar.tsx` | 修改 | 替換靜態公告列為新元件（約 5 行改動）|
| `frontend/src/app/admin/page.tsx` | 修改 | 更新公告管理 UI 支援多則清單 |

### 6.2 `adminApi.ts` 新增方法

```typescript
// 現有方法全部保留，額外新增：
getPublicAnnouncements: () =>
    client.get('announcements', {
        context: { skipGlobalErrorToast: true, skipAuthRedirect: true },
    }).json<{ data: AdminAnnouncement[] }>(),

addAnnouncement: (content: string, priority = 0) =>
    client.post('admin/announcement', { json: { content, priority } })
          .json<{ data: AdminAnnouncement }>(),

deleteAnnouncementById: (id: string) =>
    client.delete(`admin/announcement/${id}`),

listAnnouncements: () =>
    client.get('admin/announcements').json<{ data: AdminAnnouncement[] }>(),
```

### 6.3 `useAdminDashboard.ts` 新增 hooks

```typescript
// 新增（現有 useSystemAnnouncement 單數版保留）
export function useSystemAnnouncements(enabled = true) {
    return useQuery({
        queryKey: ['systemAnnouncements'],
        enabled,
        refetchInterval: 60_000,
        queryFn: async (): Promise<AdminAnnouncement[]> => {
            const response = await adminApi.getPublicAnnouncements();
            return response.data ?? [];
        },
    });
}

export function useAddAnnouncementMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ content, priority }: { content: string; priority?: number }) =>
            adminApi.addAnnouncement(content, priority),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
            await queryClient.invalidateQueries({ queryKey: ['systemAnnouncements'] });
        },
    });
}

export function useDeleteAnnouncementMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.deleteAnnouncementById(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
            await queryClient.invalidateQueries({ queryKey: ['systemAnnouncements'] });
        },
    });
}
```

### 6.4 `AnnouncementBar.tsx`（新增元件）

```tsx
'use client';

import { useState } from 'react';
import { AnnouncementModal } from './AnnouncementModal';
import type { AdminAnnouncement } from '@/lib/api/adminApi';

interface AnnouncementBarProps {
    announcements: AdminAnnouncement[];
}

export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
    const [modalOpen, setModalOpen] = useState(false);

    if (announcements.length === 0) return null;

    // 多則公告以全形空格 + ✦ 分隔，串成單一跑馬燈字串
    const marqueeText = announcements.map(a => a.content).join('　　✦　　');

    return (
        <>
            <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full border-b border-cyan-300/20 bg-cyan-400/10 px-4 py-2
                           text-left text-sm text-cyan-100 hover:bg-cyan-400/15
                           transition cursor-pointer overflow-hidden"
                aria-label="查看系統公告"
            >
                <div className="flex items-center gap-3">
                    <span className="shrink-0 font-semibold text-cyan-300 text-xs tracking-wider">
                        📢 系統公告
                    </span>
                    <div className="flex-1 overflow-hidden">
                        <p className="whitespace-nowrap announcement-marquee">
                            {marqueeText}
                        </p>
                    </div>
                    <span className="shrink-0 text-cyan-400/50 text-xs">點擊查看</span>
                </div>
            </button>

            <AnnouncementModal
                announcements={announcements}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
```

### 6.5 `AnnouncementModal.tsx`（新增元件）

```tsx
'use client';

import type { AdminAnnouncement } from '@/lib/api/adminApi';

interface AnnouncementModalProps {
    announcements: AdminAnnouncement[];
    open: boolean;
    onClose: () => void;
}

export function AnnouncementModal({ announcements, open, onClose }: AnnouncementModalProps) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center
                       bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="arc-card scanline-overlay relative mx-4 w-full max-w-lg p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="arc-title text-lg font-bold">📢 系統公告</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-cyan-100 transition text-lg"
                        aria-label="關閉"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {announcements.map((a, i) => (
                        <div
                            key={a.id}
                            className="rounded-xl border border-cyan-300/15 bg-slate-900/70 p-4"
                        >
                            {announcements.length > 1 && (
                                <p className="mb-1 text-xs text-cyan-400/60">
                                    公告 {i + 1} / {announcements.length}
                                </p>
                            )}
                            <p className="text-sm text-cyan-100 leading-relaxed whitespace-pre-wrap">
                                {a.content}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                                {new Date(a.updated_at).toLocaleString('zh-TW')}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

### 6.6 `globals.css` 新增動畫

在 `@layer components` 中新增：

```css
/* 跑馬燈動畫 */
.announcement-marquee {
    display: inline-block;
    padding-left: 100%;
    animation: marquee-scroll 30s linear infinite;
}

@keyframes marquee-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-100%); }
}

.announcement-marquee:hover {
    animation-play-state: paused;
}
```

> 現有 `prefers-reduced-motion` 規則會自動套用，無需額外處理。

### 6.7 `Navbar.tsx` 改動（約 5 行）

```tsx
// 新增匯入
import { AnnouncementBar } from '@/components/auth/AnnouncementBar';
import { useSystemAnnouncements } from '@/hooks/useAdminDashboard';

// 替換 hook（true = 所有訪客皆可見，含未登入用戶）
const { data: announcements = [] } = useSystemAnnouncements(true);

// 替換 lines 70-74 的靜態公告 div
{announcements.length > 0 && <AnnouncementBar announcements={announcements} />}
```

### 6.8 `admin/page.tsx` 公告管理區段調整

- 公告清單改為陣列顯示，每則附「刪除」按鈕（`useDeleteAnnouncementMutation`）
- 新增公告按鈕改呼叫 `useAddAnnouncementMutation`（加法，不取代現有）
- 保留「清除全部」按鈕（`useClearAnnouncementMutation`，行為不變）

---

## 7. API 規格

### 7.1 公開端點

#### `GET /api/v1/announcements`

取得所有有效公告（不需認證）。

**Response 200**
```json
{
    "data": [
        {
            "id": "01950c7e-...",
            "content": "伺服器維護將於週六凌晨2點開始",
            "is_active": true,
            "priority": 0,
            "created_by": "...",
            "updated_by": "...",
            "created_at": "2026-04-08T10:00:00Z",
            "updated_at": "2026-04-08T10:00:00Z"
        }
    ]
}
```

> `GET /api/v1/announcement`（單數）**保留不動**，向後相容。

---

### 7.2 Telegram Webhook 端點

#### `POST /api/v1/webhook/telegram`

**Headers**
```
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

**支援指令**

| 指令 | 動作 |
|------|------|
| `/announce <文字>` | 加法新增一則公告 |
| `/clear` | 清除所有有效公告 |
| `/delete <uuid>` | 停用指定單則公告 |

**Response**: 永遠返回 `200 OK`（Telegram 規範）

---

### 7.3 Admin 端點（需 `is_admin: true`）

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/api/v1/admin/announcements` | 列出所有有效公告 |
| `POST` | `/api/v1/admin/announcement` | 加法新增一則 |
| `DELETE` | `/api/v1/admin/announcement/:id` | 停用單則（204） |
| `PUT` | `/api/v1/admin/announcement` | 取代全部（保留現有） |
| `DELETE` | `/api/v1/admin/announcement` | 清除全部（保留現有） |

**`POST /api/v1/admin/announcement` Request Body**
```json
{
    "content": "新公告內容",
    "priority": 0
}
```

---

## 8. Telegram Bot 設定

### 8.1 一次性設定步驟

1. **建立 Bot**：向 [@BotFather](https://t.me/BotFather) 傳送 `/newbot` → 取得 `TELEGRAM_BOT_TOKEN`

2. **產生 Webhook Secret**：
   ```bash
   openssl rand -hex 32
   # 結果存入 TELEGRAM_WEBHOOK_SECRET
   ```

3. **取得 Chat ID**：向 Bot 傳任一訊息後呼叫：
   ```
   GET https://api.telegram.org/bot{TOKEN}/getUpdates
   ```
   從 `message.chat.id` 取得，存入 `TELEGRAM_ALLOWED_CHAT_IDS`

4. **取得 System Admin UUID**：
   ```sql
   SELECT id FROM users WHERE is_admin = TRUE LIMIT 1;
   ```
   存入 `TELEGRAM_SYSTEM_ADMIN_ID`

5. **注冊 Webhook**：
   ```bash
   curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://yourdomain.com/api/v1/webhook/telegram",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
     }'
   ```

6. **設定 Env Vars 並重啟服務**：
   ```env
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN=<token>
   TELEGRAM_WEBHOOK_SECRET=<secret>
   TELEGRAM_ALLOWED_CHAT_IDS=123456,-987654
   TELEGRAM_SYSTEM_ADMIN_ID=<uuid>
   ```

### 8.2 n8n 替代方案（零後端改動）

若不想新增 Telegram webhook 程式碼，可用 **n8n** 或 **Make.com** 作為中介：

```
Telegram 訊息
    └─► n8n Telegram Trigger 節點
            └─► HTTP Request 節點
                    POST /api/v1/admin/announcement
                    Authorization: Bearer <admin JWT>
                    Body: { "content": "{{訊息文字}}" }
```

> **注意**：n8n 方案需要管理員 JWT 且需處理 token 過期問題，建議優先實作後端 webhook 方案。

---

## 9. 實作順序

### Phase 1 — 資料庫與後端

- [ ] 新增 `migrations/0009_multi_announcements.up.sql`（`priority` 欄位）
- [ ] `domain.go`：新增 `Priority` 欄位、`AddAnnouncementInput`、3 個 interface 方法
- [ ] `repository.go`：實作 `ListActiveAnnouncements`、`AddAnnouncement`、`DeleteAnnouncement`
- [ ] `usecase.go`：新增 3 個 delegating method
- [ ] `handler.go`：新增 4 個 handler + 更新路由
- [ ] 驗收：`curl http://localhost:8080/api/v1/announcements` 返回 `{"data":[]}`

---

### Phase 2 — 前端

- [ ] `adminApi.ts`：新增 4 個 API 方法
- [ ] `useAdminDashboard.ts`：新增 `useSystemAnnouncements`、`useAddAnnouncementMutation`、`useDeleteAnnouncementMutation`
- [ ] 新增 `AnnouncementModal.tsx`
- [ ] 新增 `AnnouncementBar.tsx`
- [ ] `globals.css`：新增跑馬燈動畫
- [ ] `Navbar.tsx`：替換靜態公告列
- [ ] `admin/page.tsx`：更新公告管理 UI

**驗收**：
1. Admin 後台新增兩則公告
2. Navbar 出現跑馬燈，兩則以 `✦` 分隔連續滾動
3. 點擊公告列彈出視窗，顯示所有公告
4. 清除全部後，公告列消失

---

### Phase 3 — Telegram Bot

- [ ] `internal/admin/telegram.go`：實作 TelegramHandler
- [ ] `cmd/server/main.go`：新增 env var 讀取與條件性路由注冊
- [ ] 依照 [8.1 設定步驟](#81-一次性設定步驟) 完成 Bot 設定

**驗收**：
1. 向 Bot 傳送 `/announce 測試公告` → 公告出現於網頁
2. 向 Bot 傳送 `/clear` → 所有公告消失

---

## 10. 設計決策說明

| 決策 | 原因 |
|------|------|
| **保留單數端點 `GET /announcement`** | 避免破壞現有整合；Navbar 改用新的複數端點，兩者並存 |
| **`priority` 欄位排序** | 未來調整顯示順序時，直接更新 priority 值即可，不需重排資料 |
| **純 CSS 跑馬燈（非 JS carousel）** | 使用 compositor thread 的 `transform`，不觸發 layout/paint；自動支援 `prefers-reduced-motion` |
| **多則公告串成一條字串** | 避免實作複雜的切換 carousel 狀態機；標準 ticker 模式，視覺上連續自然 |
| **跑馬燈對所有訪客顯示** | 公告多為系統維護通知，未登入用戶也應被告知 |
| **`AnnouncementModal` 不使用 Radix Dialog** | 避免增加依賴；簡單 fixed overlay（z-50）已足夠，不與 Navbar z-40 衝突 |
| **Telegram webhook 不走 JWT 保護路由** | Telegram Server 無法持有 JWT；改以 `X-Telegram-Bot-Api-Secret-Token` header 驗證（Telegram 官方安全機制）|
| **`TELEGRAM_SYSTEM_ADMIN_ID` 使用現有管理員 UUID** | `created_by` 有 FK 約束必須指向 `users.id`；使用現有管理員帳號最簡單，無需建立 bot 假帳號 |
| **`refetchInterval: 60_000` polling** | 公告更新頻率低，無需 WebSocket 即時推送；60 秒 polling 對伺服器負載可忽略 |
