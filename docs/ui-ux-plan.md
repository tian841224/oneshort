# OneShort 前端 UI/UX 全頁面優化計畫

## Context（為什麼要做）

OneShort 是一個遊戲組隊配對系統（Artale，繁中介面），最近剛把「行動版重設計」併入 develop。整體採用 cyber-noir 風格：深色 OKLCH 主題、青色（cyan）漸層、Orbitron 顯示字體、scanline 效果。視覺風格已經很有個性，但在 **互動細節 / 可達性 / 一致性** 上仍有不少阻礙「直覺順手」的小瑕疵。

本計畫不重新設計，而是 **保留現有 cyber-noir 風格**，做一次系統性的 UX 衛生掃除（hygiene sweep）：把所有頁面用同一套規格重新對齊，讓使用者的每個點擊、聚焦、表單送出、刪除都有可預期、即時且明確的回饋。

完成後使用者應該感受到：
- 點擊任何按鈕、卡片都有立即視覺回饋（cursor / hover / pressed）
- 鍵盤 Tab 走得到、看得到目前焦點在哪
- 載入中、送出中、刪除中等狀態都不會「按了沒反應」
- 危險操作（刪除、解散、踢人）有像樣的確認 UI，不是瀏覽器原生 `confirm()`
- 行動裝置上每個觸控目標都 ≥ 44×44 px

---

## 技術棧（已確認）

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + `tw-animate-css` + shadcn/ui (radix-lyra style, 僅少量使用)
- Radix UI、`@base-ui/react`
- React Hook Form + Zod、TanStack Query、Zustand
- Lucide React（icons）
- 主題：僅 dark mode（`:root` 與 `.dark` 都是深色）

---

## 路由地圖（範圍）

```
(main) — AuthGuard 保護
  /                                   PartyHome 組隊首頁
  /applications                       入隊申請
  /me                                 角色管理 / 個人設定
  /guilds                             公會列表 + FAB 建立
  /guilds/create                      建立公會
  /guilds/[id]                        公會總覽
  /guilds/[id]/parties                公會隊伍
  /guilds/[id]/parties/create         公會內建隊
  /guilds/[id]/settings               公會設定
  /guilds/[id]/members                成員管理（含轉讓 / 踢除）
  /guilds/[id]/announcements          公告管理
  /guilds/[id]/me/preferences         個人公會偏好
  /guilds/[id]/chat                   即時聊天
  /guilds/[id]/match                  配對
  /parties/create                     建立隊伍（OCR 截圖辨識）
  /parties/[id]                       隊伍詳情（redirect）

(auth)
  /auth/discord/callback              Discord OAuth 回呼

/admin                                管理後台（admin only）
```

關鍵 Layout：
- `frontend/src/app/layout.tsx` — RootLayout、Navbar、Footer、AuroraBackdrop
- `frontend/src/app/globals.css` — 主題 token 與 `.arc-*` 自訂 class
- `frontend/src/app/providers.tsx` — QueryClient、ToastProvider

---

## 優先順序總覽

| 階段 | 焦點 | 預估影響 |
|---|---|---|
| **P0 Critical** | 改掉 `window.confirm`、Modal 的鍵盤可達性、tap target | 直接影響「能不能用」「會不會誤刪」 |
| **P1 High** | 焦點環、表單 a11y、loading 文字、navbar/footer 對齊 | 直覺順手感的核心 |
| **P2 Medium** | 圖示一致性（移除 emoji）、空狀態 CTA、`arc-card` token 化 | 視覺一致性與專業度 |
| **P3 Low** | 動畫降階、骨架屏、容器查詢 | 體感打磨 |

---

## P0 — Critical（先做，無回頭路類）

### P0.1 用統一 `ConfirmDialog` 取代 `window.confirm`
五處全部走 `Modal` 的 `confirm` variant（已經支援 `confirmText/cancelText`）：

| 檔案 | 行號 | 動作 |
|---|---|---|
| [admin/page.tsx](frontend/src/app/admin/page.tsx#L55) | 55 | 強制解散公會 |
| [guilds/[id]/members/page.tsx](frontend/src/app/(main)/guilds/[id]/members/page.tsx#L85) | 85 | 轉讓會長 |
| [guilds/[id]/members/page.tsx](frontend/src/app/(main)/guilds/[id]/members/page.tsx#L105) | 105 | 移除成員 |
| [guilds/[id]/announcements/page.tsx](frontend/src/app/(main)/guilds/[id]/announcements/page.tsx#L165) | 165 | 刪除公告 |
| [components/guild/MatchDraftEditor.tsx](frontend/src/components/guild/MatchDraftEditor.tsx#L188) | 188 | 配對手動上限 |

建議：在 [components/ui/Modal.tsx](frontend/src/components/ui/Modal.tsx) 旁新增 `ConfirmDialog.tsx` 薄殼（或直接重用 Modal `variant="confirm"`），並在 `lib/` 加 `useConfirm()` hook 包成 Promise 介面：
```ts
const confirmed = await confirm({ title: '確認解散', message: '...', destructive: true });
```

### P0.2 Modal 補齊鍵盤可達性與 tap target
[components/ui/Modal.tsx](frontend/src/components/ui/Modal.tsx) 修改點：
- 增加 Esc 關閉（`useEffect` + `keydown`）
- 開啟時 focus trap（用 `radix-ui` 的 `FocusScope` 或自寫，專案已有 `radix-ui` 依賴）
- 開啟時記錄上一個 active element，關閉時 `restoreFocus`
- 關閉按鈕 [Modal.tsx:61-68](frontend/src/components/ui/Modal.tsx#L61-L68)：把 `<X className="h-5 w-5" />` 改為包在 `min-h-[44px] min-w-[44px]` 的按鈕容器
- [LoginDialog.tsx:70-77](frontend/src/components/auth/LoginDialog.tsx#L70-L77) 同樣處理
- 鎖定背景 scroll（`document.body.style.overflow = 'hidden'`）

### P0.3 行動裝置 tap target 統一 ≥44px
- [PartyCard.tsx:242-250](frontend/src/components/party/PartyCard.tsx#L242-L250) 「離開隊伍」按鈕 `px-2.5 py-1 text-xs` → `min-h-[44px]`
- [LoginDialog.tsx](frontend/src/components/auth/LoginDialog.tsx) 關閉 X (`h-10 w-10` → `min-h-[44px] min-w-[44px]`)
- 全域檢查：grep `h-5 w-5|h-6 w-6` 配合 `<button` 找出所有 icon-only 按鈕，包進 `inline-flex items-center justify-center min-h-[44px] min-w-[44px]`

---

## P1 — High（直覺順手感的核心）

### P1.1 修補 `.arc-input` 焦點環
[globals.css:214-228](frontend/src/app/globals.css#L214-L228) 目前只改 `border-color`，鍵盤使用者完全看不出焦點：
```css
.arc-input:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-color: rgb(56 189 248);
}
```
同步檢查所有 inline `focus:border-sky-500 focus:outline-none` 的地方（如 [PartyEditMetaForm.tsx:81](frontend/src/app/(main)/_components/PartyEditMetaForm.tsx#L81)），統一加上 `focus-visible:ring-2 focus-visible:ring-ring/60`。

### P1.2 修正字體尺寸 token bug
[globals.css:50-51](frontend/src/app/globals.css#L50-L51)：
```css
--font-size-xs: 1rem;   /* 應為 0.75rem */
--font-size-sm: 1rem;   /* 應為 0.875rem */
```
這會使 Tailwind 所有 `text-xs / text-sm` 都變成 `1rem`，造成資訊階層丟失。修為標準 type scale。

### P1.3 表單 `<label htmlFor>` ↔ `<input id>` 配對
所有表單元件統一掃過：
- [QuickLoginForm.tsx:170-235](frontend/src/components/auth/QuickLoginForm.tsx#L170-L235)
- [PartyEditMetaForm.tsx:72-100](frontend/src/app/(main)/_components/PartyEditMetaForm.tsx#L72-L100)
- 各 `guilds/*/settings`、`me`、`parties/create`

技巧：使用 React 19 的 `useId()` 產生 id 配對 `htmlFor`。或直接導入 shadcn/ui 的 `<Label>` 元件（套件已安裝，未充分使用）。

### P1.4 表單 loading 文字 + 防雙送
所有 mutation 表單統一規格：
```tsx
<button disabled={mutation.isPending}>
  {mutation.isPending ? '處理中…' : '建立公會'}
</button>
```
影響檔案：
- [guilds/create/page.tsx:106](frontend/src/app/(main)/guilds/create/page.tsx#L106) — 建立公會
- [guilds/[id]/settings/page.tsx:95-99](frontend/src/app/(main)/guilds/[id]/settings/page.tsx#L95-L99) — 設定儲存
- [QuickLoginForm.tsx:265-273](frontend/src/components/auth/QuickLoginForm.tsx#L265-L273) — 快速登入
- [guilds/[id]/members/page.tsx:140-156](frontend/src/app/(main)/guilds/[id]/members/page.tsx#L140-L156) — 入會審核

### P1.5 Navbar / Footer 對齊
- [Footer.tsx:22](frontend/src/components/layout/Footer.tsx#L22) 與 [Navbar.tsx:115](frontend/src/components/auth/Navbar.tsx#L115) 同為 `z-40`，與 [Modal.tsx:50](frontend/src/components/ui/Modal.tsx#L50) `z-[80]` 之間建立 z-index scale：
  - 在 globals.css 定義 `--z-nav: 40; --z-overlay: 60; --z-modal: 80; --z-toast: 90;`
- 確認 [layout.tsx:56](frontend/src/app/layout.tsx#L56) `pb-16` 在所有 dvh 場景（含 `100dvh` 內容）都不會被 footer 蓋住長表單最後一個欄位
- Navbar dropdown ([Navbar.tsx:142-180](frontend/src/components/auth/Navbar.tsx#L142-L180)) 增加 Esc 關閉

### P1.6 Active route 高亮
Navbar 缺少當前路徑視覺指示。在 Navbar 加入 `usePathname()` → 對 `/admin`、`/guilds`、`/me` 等主導航項加 `data-active` + 視覺底線/光暈。

---

## P2 — Medium（一致性與質感）

### P2.1 移除介面 emoji，改用 Lucide
| 檔案 | emoji | 建議 Lucide |
|---|---|---|
| [PartyCard.tsx:116](frontend/src/components/party/PartyCard.tsx#L116) | ⚔ / 🛡 / 👥 | `Swords` / `Shield` / `Users` |
| [PartyDetailView.tsx:72](frontend/src/app/(main)/_components/PartyDetailView.tsx#L72) | 同上 | 同上 |
| [NotificationBell.tsx:44](frontend/src/components/auth/NotificationBell.tsx#L44) | 👥 | `Users` |

抽出工具函式 `getPartyTypeIcon(type)` 在 `lib/partyType.ts`，所有用到的地方共用一份。

### P2.2 `.arc-card` / `.arc-chip` token 化
[globals.css:181-212](frontend/src/app/globals.css#L181-L212) 改用 CSS 變數：
```css
.arc-card {
  border: 1px solid color-mix(in oklab, var(--primary) 22%, transparent);
  background: color-mix(in oklab, var(--card) 78%, transparent);
  box-shadow: 0 14px 40px -22px color-mix(in oklab, var(--primary) 36%, transparent);
}
```
這樣未來想換主色系（例如紫色節慶版）只要改 `--primary`。

### P2.3 空狀態加上 primary action
- [guilds/page.tsx:94-106](frontend/src/app/(main)/guilds/page.tsx#L94-L106) 「目前沒有符合條件的公會」→ 加「建立公會」按鈕 + 「清除搜尋」按鈕
- [GuildMemberList.tsx:54-58](frontend/src/components/guild/GuildMemberList.tsx#L54-L58) 「沒有符合搜尋條件」→ 加「清除搜尋」
- 在 [components/common/](frontend/src/components/common/) 新增 `EmptyState.tsx`（icon + title + description + primary action）統一使用

### P2.4 hover layout-shift 修正
- [GuildAnnouncementCard.tsx](frontend/src/components/guild/GuildAnnouncementCard.tsx) `hover:-translate-y-0.5` → 改 `hover:shadow-lg hover:border-primary/40`
- 全域 grep `hover:scale-` 與 `hover:-translate-` 檢查

### P2.5 cursor-pointer 全面化
所有 `onClick` 但不是 `<button>`/`<a>` 的元素（卡片、列表 row）加 `cursor-pointer`。重點：
- [GuildCard.tsx](frontend/src/components/guild/GuildCard.tsx)（已是 Link OK）
- 自訂 onClick 的 div（grep `<div[^>]*onClick`）

---

## P3 — Low（打磨）

### P3.1 骨架屏取代純文字 loading
- [guilds/page.tsx:56-62](frontend/src/app/(main)/guilds/page.tsx#L56-L62) 「載入中…」 → 6 張 `<GuildCardSkeleton />`
- [me/page.tsx:371-374](frontend/src/app/(main)/me/page.tsx#L371-L374) 角色列表 → skeleton row
- 在 `components/ui/Skeleton.tsx` 建立 base 元件（Tailwind `animate-pulse bg-muted/40 rounded-md`）

### P3.2 動畫尊重 `prefers-reduced-motion`
[globals.css:300-307](frontend/src/app/globals.css#L300-L307) 已有全域 reduced-motion 規則 ✓。額外確認 `notice-marquee` 在 reduced-motion 下停止滾動（目前 hover 才暫停）。

### P3.3 通知 Bell badge 數字 99+
NotificationBell 顯示具體數字，超過 99 顯示 `99+`（小細節，避免 badge 撐開）。

---

## 重複利用既有元件（避免新造輪子）

| 需求 | 既有檔案 | 動作 |
|---|---|---|
| Modal/Dialog | [components/ui/Modal.tsx](frontend/src/components/ui/Modal.tsx) | 補強，不另建 |
| 按鈕 | [components/ui/button.tsx](frontend/src/components/ui/button.tsx) | 把全站 inline 按鈕改用此 CVA |
| 下拉 | [components/ui/SearchableSelect.tsx](frontend/src/components/ui/SearchableSelect.tsx) | 已有 a11y，沿用 |
| Toast | [components/ui/ToastProvider.tsx](frontend/src/components/ui/ToastProvider.tsx) + [lib/toast.ts](frontend/src/lib/toast.ts) | 沿用 |
| 焦點 | `radix-ui` 已安裝 | 用 `FocusScope` 處理 modal trap |
| Label | shadcn Label（未使用） | 引入 `npx shadcn add label` |

---

## 不在本次範圍

- 新增 light mode（產品定位是 cyber-noir，先不分散）
- 重做頁面資訊架構 / 路由
- 引入新動畫庫
- 視覺主色變更

如使用者要求其中一項，可拆成獨立計畫。

---

## 執行步驟（建議分 4 個 PR）

1. **PR1 — P0 全部 + P1.5 z-index scale**：偏向「不能放著的 bug」，最小擾動最大 a11y 收益
2. **PR2 — P1.1 ~ P1.4 + P1.6**：表單與焦點 hygiene
3. **PR3 — P2 全部**：視覺一致性
4. **PR4 — P3 全部**：打磨

每個 PR 都搭配 Playwright smoke test（專案已有 e2e）跑一輪 `chromium` + `mobile-smoke`。

---

## 驗證計畫

### 自動化
- `npm run test:unit` — 單元測試不能退步
- `npm run test:e2e -- --project=chromium` — 桌面 happy path
- `npm run test:e2e:mobile-smoke` — 行動 happy path
- `npm run lint` — ESLint 不能退步

### 手動 a11y 檢查清單（每頁跑一次）
- [ ] 鍵盤 Tab 走完整頁不卡死，每個焦點都看得見
- [ ] Esc 可以關閉所有 modal / dropdown
- [ ] Modal 開啟時，背景不能 Tab 到
- [ ] 螢幕閱讀器念得出每個 icon-only 按鈕用途（NVDA / VoiceOver）
- [ ] Chrome DevTools → 行動模擬 iPhone 12，點任意按鈕 hit area ≥ 44×44
- [ ] `prefers-reduced-motion` 開啟時，scanline / marquee 停止
- [ ] 任何「送出」按鈕點下後立刻變灰 + 文字改「處理中…」
- [ ] 任何「刪除/解散/踢人」操作都跳出客製化確認框
- [ ] Lighthouse a11y 分數 ≥ 95（重點頁：`/`, `/guilds`, `/guilds/[id]`, `/me`, `/parties/create`）

### 視覺檢查
- 視覺迴歸：`npm run test:e2e` 內若有 screenshot 比對則沿用；否則目視檢查 [`/`, `/guilds`, `/guilds/[id]`, `/me`, `/parties/create`, `/admin`] 在 375 / 768 / 1024 / 1440 寬度。

---

## 風險

1. **`window.confirm` 改 Modal** 會把同步流程改成 async，需要 audit 呼叫端確保 await 正確
2. **`--font-size-xs/sm` 修正** 可能讓某些頁面字體變小，要視覺檢查 chip / badge 是否仍可讀
3. **focus-visible ring** 大量加上後可能在某些深色卡片上對比不足，需驗證 `--ring` 色與卡背景對比 ≥ 3:1
4. **Modal focus trap** 需測試巢狀 modal（如「刪除公告」確認框疊在「公告編輯」modal 上）

---

## 關鍵檔案一覽（執行時要碰到的核心點）

```
frontend/src/app/
├── globals.css                                 ← 修 token、focus、arc-*
├── layout.tsx                                  ← 確認 pb-16 / z-index
├── (main)/
│   ├── guilds/page.tsx                         ← P2.3 空狀態
│   ├── guilds/create/page.tsx                  ← P1.4 loading
│   ├── guilds/[id]/members/page.tsx            ← P0.1 confirm + P1.4
│   ├── guilds/[id]/announcements/page.tsx      ← P0.1 confirm
│   ├── guilds/[id]/settings/page.tsx           ← P1.4 loading
│   ├── _components/PartyEditMetaForm.tsx       ← P1.1 focus + P1.3 label
│   └── _components/PartyDetailView.tsx         ← P2.1 emoji
├── admin/page.tsx                              ← P0.1 confirm
└── (auth)/auth/discord/callback/page.tsx       ← 已 OK，僅補確認
frontend/src/components/
├── ui/Modal.tsx                                ← P0.2 a11y 補強
├── ui/button.tsx                               ← 統一被使用
├── ui/Skeleton.tsx (新)                        ← P3.1
├── common/EmptyState.tsx (新)                  ← P2.3
├── auth/Navbar.tsx                             ← P1.5 z-index + P1.6 active
├── auth/LoginDialog.tsx                        ← P0.2 + P0.3
├── auth/QuickLoginForm.tsx                     ← P1.3 + P1.4
├── auth/NotificationBell.tsx                   ← P2.1 emoji
├── party/PartyCard.tsx                         ← P0.3 tap + P2.1 emoji
├── guild/GuildAnnouncementCard.tsx             ← P2.4 hover
├── guild/MatchDraftEditor.tsx                  ← P0.1 confirm
└── layout/Footer.tsx                           ← P1.5 z-index
frontend/src/lib/
├── partyType.ts (新)                           ← P2.1 共用 icon mapping
└── confirm.ts (新)                             ← P0.1 useConfirm hook
```
