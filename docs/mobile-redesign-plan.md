# OneShort 手機板 UX 重新設計計畫

> 文件版本：v1.0  ｜ 建立日期：2026-05-03  ｜ 適用分支：`develop`
>
> 目標：以 mobile-first 思維重塑 OneShort 所有面向玩家的頁面，讓使用者用單手在 < 3 秒內完成最常見任務（找隊／開隊／應徵／公會切換）。

---

## 0. TL;DR

- **保留**現有 Cyberpunk / 暗色霓虹品牌（cyan + sky + slate），不更換主色。
- **重點問題**：缺少底部主導覽、`text-[10px]` 過度使用、`xl:` 過晚切換、Modal 在 < 380 px 寬度溢出、OCR 透過 screen-share 在手機上不直覺、固定底部 Footer 佔用稀缺垂直空間。
- **核心改造**：
  1. 引入 **Bottom Nav (Tab Bar)** 取代 Footer 作為手機主導覽；Footer 上的工具按鈕收進「更多」抽屜（Sheet）。
  2. 全部 Modal 改成 **Mobile：底部 Sheet ／ Desktop：Dialog** 的雙形態元件。
  3. 統一 **mobile breakpoint 改為 `md:` (768 px)**，停止 `xl:`-only 的桌面切換邏輯（match 編輯器除外）。
  4. 字級系統重整：取消 `text-[10px]`、`text-xs` 改為 12 px-only-for-meta、body 最低 14 px、表單輸入 16 px（避免 iOS 自動 zoom）。
  5. OCR 在手機端改為「**拍照／相簿上傳**」優先；保留 screen-share 作為桌面 fallback。
- **交付分四階段**（P0 基礎 → P1 導覽 → P2 表單／OCR → P3 細節打磨），預估 4–6 週。

---

## 1. 現況盤點

### 1.1 路由地圖

| 區段 | 路由 | 用途 | 手機優先級 |
|---|---|---|---|
| 主流 | `/` (PartyHome) | 找隊／開隊主入口（Tab：找隊伍／找王／找練功／我的隊伍／應徵） | ★★★★★ |
| 主流 | `/parties/create` | 建立隊伍（含 OCR） | ★★★★★ |
| 主流 | `/parties/[id]` → `/?party=xxx` | 隊伍詳情（同頁切換 Workspace） | ★★★★★ |
| 公會 | `/guilds` | 公會列表／瀏覽 | ★★★★ |
| 公會 | `/guilds/[id]` | 公會首頁 | ★★★★ |
| 公會 | `/guilds/[id]/chat` | 公會聊天 | ★★★★ |
| 公會 | `/guilds/[id]/announcements` | 公告 | ★★★ |
| 公會 | `/guilds/[id]/members` | 成員列表 | ★★★ |
| 公會 | `/guilds/[id]/parties` | 公會隊伍 | ★★★★ |
| 公會 | `/guilds/[id]/me/preferences` | 個人 BOSS 設定 | ★★ |
| 公會 | `/guilds/[id]/match` | 自動配對（幹部） | ★★ desktop-first 可保留 |
| 公會 | `/guilds/[id]/settings` | 公會設定（幹部） | ★★ |
| 個人 | `/me` | 角色管理／登入綁定／PIN | ★★★★ |
| 個人 | `/applications` | 我的應徵歷史 | ★★★ |
| 認證 | `/auth/discord/callback` | OAuth callback | n/a |
| 後台 | `/admin` | 系統管理 | ★ desktop-first 可保留 |

### 1.2 目前已具備的好基礎

- 多數可點擊元素已有 `min-h-[44px] min-w-[44px]`。
- Tailwind v4 + shadcn + Radix，Design tokens (`oklch`) 已分離。
- 已有 `pb-safe`、`scrollbar-none`、`touch-manipulation`、`prefers-reduced-motion` utility。
- `GuildShell` 已示範手機 / 桌面分離 (`GuildMobileTopBar`、`GuildHorizontalTabs`、`xl:hidden`)，是好範例可推廣。
- CSS variable 化的 `--app-nav-height`、`--app-sticky-top`、`--app-viewport-minus-chrome` 已存在。

### 1.3 待解決的主要痛點

| # | 問題 | 影響 | 證據（檔案：行） |
|---|---|---|---|
| P-01 | 沒有持久化底部導覽，主要切換靠 navbar 內 Gadget 與 Tab | 主任務切換需多次點擊、拇指距離長 | `Navbar.tsx:162-262`、`PartyTabBar` 為頁內 tab 非全站 |
| P-02 | `text-[10px]` 大量出現於徽章、tooltip、計數 | 手機可讀性差、A11y 失分 | `Footer.tsx:11,23`、`Navbar` 字元預覽、`PartyChat` |
| P-03 | `xl:` (1280 px) 用作主切換點，導致 768–1279 px 被當「桌面」 | iPad / 折疊機體驗 broken | `GuildShell.tsx:88-145`、`/guilds/[id]/announcements` 等 |
| P-04 | 固定底部 Footer 永遠佔用 64 px，與 keyboard 容易衝突 | 表單體驗差、垂直空間浪費 | `Footer.tsx:22-85`、`layout.tsx:56` (`pb-20`) |
| P-05 | Modal `max-w-lg` (512 px) + `p-4` 在 360 px 寬度仍會 overflow | 視覺破碎、按鈕擠壓 | `LoginDialog`、`Modal.tsx:52` |
| P-06 | OCR 走 `getDisplayMedia` → 手機端必須螢幕錄影才能擷取 | 玩家在手機上幾乎無法用 | `ScreenShareCapture.tsx:95-145` |
| P-07 | NotificationBell / GuildGadget / PartyGadget 在 navbar 並排，超過 360 px 會擠在一起 | 拇指誤觸 | `Navbar.tsx:175-200` |
| P-08 | `GuildHorizontalTabs` 橫向捲動但無視覺漸層提示 | 使用者不會發現可滑動 | `GuildHorizontalTabs.tsx:17-22` |
| P-09 | `tailwind.config.ts` 把 `text-xs/sm` 強制改成 1 rem，與 `globals.css` 的 `--font-size-xs/sm` 衝突 | 字級系統不一致 | `tailwind.config.ts:11-14` vs `globals.css:50-51` |
| P-10 | Party 詳情用 query param (`?party=xxx`) 而非真路由，手機 ↩︎ 返回行為不直覺 | 返回鍵跳出列表 | `PartyHome.tsx:97-117` |
| P-11 | 表單 Grid 多用 `lg:grid-cols-2`、`sm:grid-cols-2`，但欄位太多時手機仍極長 | 滑動疲勞 | `me/page.tsx:441-470`、`parties/create/_components/PartyBasicFields` |
| P-12 | 多 Modal 同時可能堆疊 (`PartyHome.tsx:199-237` 三個 Modal + 密碼) | z-index 競態、手機焦點混亂 | 同上 |

---

## 2. 設計原則 (North Star)

```
單手可達 (Thumb Zone) ＞ 視覺華麗
最少點擊路徑 ＞ 完美對稱
即時回饋 (optimistic UI) ＞ 完美一致性
頁內切換 (Sheet/Tab) ＞ 全頁跳轉
玩家語言 ＞ 開發者語言
```

### 2.1 Mobile Design Tokens（沿用 + 收斂）

| Token | 行動裝置 | 桌面 | 備註 |
|---|---|---|---|
| `--app-page-pad-x` | `1rem` | `1.5rem` | 取代散落的 `px-3 sm:px-4` |
| `--app-page-pad-y` | `1rem` | `1.5rem` | |
| `--app-bottom-nav-height` | `64px` + safe-area | n/a | 新增 |
| `--app-nav-height` (mobile) | `56px` | `74px` 維持 | 手機壓縮 |
| `--app-card-radius` | `1rem` | `1.25rem` | 維持 `arc-card` |
| `--app-touch-min` | `44px` | `40px` | A11y 最低 |

### 2.2 字級系統（修正 P-02、P-09）

```
display    32px / 700  (頁面標題)
title      20px / 700  (區塊標題)
body       16px / 500  (正文、輸入框)
sm         14px / 500  (次要文案、按鈕標籤)
caption    12px / 600  (徽章、時間戳；上限就是這個)
mono-tab   13px / 600  (數值、頻道、等級)
```

行動 → 移除所有 `text-[10px]`、`text-[11px]`；Tailwind `xs/sm` 還原為 `0.75rem/0.875rem`，讓 `globals.css:50-51` 的 token 生效。

### 2.3 斷點策略

```
default → 手機 (< 768)
md:    → 平板直立 (≥ 768)   ← 新主切換點
lg:    → 平板橫／小筆電 (≥ 1024)
xl:    → 桌面 (≥ 1280)        ← 僅供雙欄複雜頁面 (match 編輯器)
```

### 2.4 互動規範

- 所有 hover-only 視覺一律加上 active/pressed 狀態：`active:bg-cyan-500/20 active:scale-[0.98]`。
- transition 範圍 150 – 250 ms（micro），> 300 ms 只用於頁面入場。
- 任何固定元素 (sheet、底部按鈕) 必須加 `pb-safe`。
- 表單 input 一律 `font-size: 16px`（避免 iOS 自動 zoom）+ `inputmode` 屬性。

---

## 3. 新增 / 改造的共用元件

### 3.1 `MobileBottomNav` (新增 ‧ 解決 P-01)

```
位置：layout.tsx <main> 之外，僅 md:hidden 顯示
內容：5 個主分頁 (Home/Guilds/Create/Inbox/Me)
規範：
  - 高度 64 px + safe-area-inset-bottom
  - 中央 "建立隊伍" 為 raised FAB-style 主 CTA
  - 使用 Lucide：Home, Users, Plus, Bell, UserCircle2
  - 未讀數徽章用 dot (8 px) 不放數字
```

### 3.2 `Sheet` (改造 ‧ 解決 P-05)

- 以 `@base-ui/react` 的 Dialog primitive 包裝（已安裝）。
- API 與 `Modal` 對齊，但 mobile 自動以「底部 sheet（圓角頂、80 vh max）」呈現，desktop 為 centered dialog。
- 內含 swipe-down-to-dismiss（呼吸 handle bar）。
- 將 `LoginDialog`、`PasswordPrompt`、`BugReportModal`、`ConfirmDialog`、`NotificationBell` dropdown、`MarkdownModal` 全部遷移。

### 3.3 `MoreSheet`（改造 ‧ 解決 P-04）

- 把 Footer 上的「開發計畫／已知問題／回報 Bug／GitHub」收進主導覽 More Tab 的 sheet，行動裝置不再有固定 footer。
- Desktop ≥ md：保留現有 `Footer` 顯示。
- 行動實作：`<Footer className="hidden md:flex" />` + `MobileBottomNav` 內的 More entry。

### 3.4 `ResponsiveDropdown` （改造 ‧ 解決 P-07）

- 統一 Navbar 上的 `NotificationBell`、使用者選單、`PartyGadget`、`GuildGadget` 在手機呈現方式：點擊 → 打開 Sheet 而非 popover。
- 使用 `useMediaQuery('(min-width: 768px)')` 切換（建議新增該 hook 至 `hooks/`，現專案無此 hook）。

### 3.5 `StickyActionBar` （新增）

- 用於建立／編輯類長表單（建立隊伍、建立公會），把主提交按鈕釘到視窗底部（在 Bottom Nav 之上）。
- `position: sticky; bottom: var(--app-bottom-nav-height)` + 半透明背景 + `pb-safe`。

### 3.6 `MobilePageHeader` （新增）

- 取代散落各頁的標題區塊，提供：返回按鈕、頁面 title、右側 1 個動作。
- 與 `GuildMobileTopBar` 合併為通用版本。

### 3.7 `useMediaQuery` hook（新增 ‧ 通用）

```ts
// src/hooks/useMediaQuery.ts
export function useMediaQuery(query: string): boolean {
  // SSR-safe + matchMedia subscribe
}
```

讓 navbar/sheet/dropdown 等行為差異有單一資料來源，而非靠 Tailwind class 排他渲染。

---

## 4. 頁面逐項重設計

### 4.1 `/` PartyHome（首頁／找隊伍）— P0

**目前**：頂部 Navbar → `PartyTabBar`（橫向滾動 Tab）→ 雙欄 List + Detail
**手機目標**：單欄 List → 點擊進入 Detail（Sheet 從下方滑出，覆蓋 80 vh，背景仍可見列表）

| 改動 | 說明 |
|---|---|
| Tab 列 | 改成 segmented control，置於 sticky 頂端；4 個主 Tab + "更多 Tab" sheet |
| 卡片 | 新增「快速應徵」icon button（單擊不展開，加上 long-press 才展開細節）|
| 篩選 | 點擊右上篩選 icon 開啟 sheet（含 BOSS／地圖／頻道） |
| Detail | 改用 sheet（手機）/ side-panel（桌面 ≥ md）|
| 路由 | 維持 `?party=` 但確保 `popstate` 正確收 sheet（解 P-10） |
| 空狀態 | 圖示 + 「建立隊伍」直達按鈕 |

### 4.2 `/parties/create` 建立隊伍 — P0

**目前**：單一長表單 (`max-w-3xl` arc-card 內全部欄位)
**手機目標**：3 步驟 wizard

```
Step 1: 類型 + 標題 + 目標 (BOSS/地圖)
Step 2: 時間 + 頻道 + 加入規則 (密碼/審核/快速登入)
Step 3: 隊員 (角色選擇 → OCR/手動補位 → 確認送出)
```

| 改動 | 說明 |
|---|---|
| Wizard | Top progress bar (1/3 → 3/3) + 上一步／下一步 sticky bar |
| OCR | **手機改用 `<input type="file" capture="environment" accept="image/*">`**，後端走既有 OCR endpoint；保留 screen-share 給桌面 (P-06) |
| SearchableSelect | 在手機改成 sheet 內的全螢幕搜尋體驗 |
| 頻道輸入 | 改 `inputmode="numeric"` |
| 提交 | StickyActionBar 主按鈕；首次 invalid 自動滾到該欄位並 vibrate(10) |

### 4.3 `/parties/[id]` 隊伍詳情 — P0

當前已內嵌於 `/?party=` 流程；手機作為 Sheet 渲染（4.1 已述）。
獨立路由保留作為深連結 fallback，渲染同一 Workspace 但去掉 list 欄。

### 4.4 `/guilds` 公會列表 — P1

**手機目標**：`grid-cols-1`（不再 `grid-cols-2`），改為大頭卡片：
- 卡片：公會圖示 (64×64) + 名稱 + 一行描述 + 成員數徽章 + 加入模式 chip
- 點擊卡片整塊（不只名字）跳 detail
- 頂部 sticky 搜尋 + filter chips

### 4.5 `/guilds/[id]/...`（公會內頁）— P1

| 子頁 | 改動 |
|---|---|
| 首頁 (`GuildOverviewSegmented` 已存在) | 把 `xl:` 改 `lg:`；segmented 改成 sticky |
| chat | 訊息泡泡左右最大寬 80 %；composer `pb-safe + env(keyboard-inset-height)` 已有，補 send button 永久顯示 |
| announcements | 移除 `md:grid-cols-2`，全部 `grid-cols-1` 直到 `lg:` 才變 2 欄 |
| members | 同上；卡片高度緊縮，把職業 chip 內嵌到名字行 |
| parties | 沿用 PartyHome 的卡片 component |
| me/preferences | BOSS chip 改用 toggle pill，全部 wrap，避免橫向 scroll |
| match | **保留桌面優先**；手機顯示「請使用桌面瀏覽器體驗自動配對」+ link to desktop |
| settings | Tab 化（基本／加入規則／權限／危險區），手機每 Tab 為獨立 view |

### 4.6 `/me` 個人頁 — P1

**目前**：`lg:grid-cols-[minmax(0,1fr)_360px]`（角色清單 + 右側登入／PIN）
**手機目標**：上下兩個 collapse 區塊：
1. 角色（預設展開）：行內編輯改為「點擊 → 開啟 EditCharacterSheet」，避免一張 row 內塞兩個 input + 兩個 button
2. 登入方式 + 更新 PIN（預設折疊）

「新增角色」改為頁面右下角 FAB，點擊開 Sheet 表單。

### 4.7 `/applications` 我的應徵 — P1

- Timeline 風格列表（最近 → 最舊）；狀態用色片：`等待中`（amber）／`已通過`（emerald）／`已拒絕`（rose）／`已取消`（slate）
- 點擊跳到對應 party detail sheet。

### 4.8 認證 / Login Dialog — P0

- `LoginDialog` 改為手機 Sheet：頂部品牌、Discord 大按鈕、PIN 登入折疊區、「需要協助？」連結。
- Discord callback 頁面只是一個讀取狀態，手機優化只需確保字級可讀。

### 4.9 `/admin` — P3 (低優先)

- 維持桌面優先；手機加上「此頁建議於桌面使用」提示，但不阻擋。
- 公告編輯與危險操作（停權）改 sheet 確認。

---

## 5. 其他系統性改動

### 5.1 Tailwind / Token 整理

- 修正 `tailwind.config.ts:11-14` 的 `xs/sm` 覆寫，回到 12 px / 14 px。
- 在 `theme.extend.spacing` 新增 `safe-bottom: env(safe-area-inset-bottom, 0px)` 等別名（簡化 utility）。
- 新增 mobile spacing 預設：`gap-3` 為手機預設、`md:gap-4`、`lg:gap-6`。

### 5.2 全域 Layout (`app/layout.tsx`)

- 把 `pb-20` 改為 `pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-20`。
- 在 `</main>` 後渲染 `<MobileBottomNav className="md:hidden" />`。
- 把 `<Footer />` 加 `className="hidden md:flex"`。
- `AuroraBackdrop` / `GridPattern` 在手機降低不透明度（性能 + 可讀性）。

### 5.3 鍵盤 / Safe Area 支援

- 為 sheet/composer/sticky bar 統一用 `paddingBottom: max(env(safe-area-inset-bottom), env(keyboard-inset-height))` 模式。
- 加入 `viewport-fit=cover` meta（next.js metadata）。

### 5.4 Navbar 收斂（手機）

- 手機 navbar 高度 56 px，僅顯示：左 Logo / 中間目前頁面標題 / 右側通知鈴鐺。
- 把 `OnlineCounter`、`PartyGadget`、`GuildGadget` 在手機隱藏，移至 BottomNav 的 Home / Guild Tab 內。
- Admin 連結改進入 More Sheet。

### 5.5 動畫 / 可達性

- 所有 sheet 採用 spring (`cubic-bezier(0.32, 0.72, 0, 1)`)，但若 `prefers-reduced-motion` 則退化為 opacity fade。
- 確認所有自訂 chip / button 通過 `4.5:1` contrast（用 `oklch` 工具或 https://oklch.com/）。
- 為主要 sheet 新增 `aria-modal="true"` 與 focus trap（`@base-ui/react` 已內建）。

---

## 6. 實施階段與里程碑

| 階段 | 範圍 | 主要 PR | 預估工時 |
|---|---|---|---|
| **P0 基礎建設** | useMediaQuery、Sheet primitive、token 修正、Tailwind 字級還原、layout pb 修正 | `feat/mobile-foundation` | 3–5 d |
| **P0 主導覽** | MobileBottomNav、More Sheet、Footer 隱藏、Navbar 手機壓縮 | `feat/mobile-bottom-nav` | 4–6 d |
| **P0 PartyHome + Create** | Tab segmented、Detail Sheet、Wizard、OCR 拍照入口 | `feat/mobile-party-flow` | 6–8 d |
| **P1 公會內頁** | GuildShell breakpoint 改 `lg:`、各子頁 grid 收斂、chat composer 修正 | `feat/mobile-guild` | 5–7 d |
| **P1 /me /applications** | EditCharacterSheet、FAB、timeline | `feat/mobile-me-applications` | 3–4 d |
| **P2 Modal → Sheet 遷移** | LoginDialog、ConfirmDialog、BugReport、Notification | `refactor/sheets` | 3–5 d |
| **P3 細節** | 微互動、haptic、`text-[10px]` 全面替換、a11y audit、E2E mobile-smoke 擴充 | `polish/mobile-finish` | 3–5 d |

> 建議每階段獨立 PR，可獨立 ship；每個 PR 必須通過 `npm run lint`、`npm run test:unit`、`npm run test:e2e:mobile-smoke` (`playwright.config.ts` 已存在 `mobile-smoke` project)。

---

## 7. 驗收標準 (Definition of Done)

### 7.1 全域
- [ ] iPhone SE (375×667)、Pixel 7 (412×915)、iPad mini (768×1024) 三個視窗皆無水平捲軸。
- [ ] Lighthouse Mobile：Performance ≥ 80、Accessibility ≥ 95、Best Practices ≥ 95。
- [ ] 全站再無 `text-[10px]` 或 `text-[11px]`（grep 為零）。
- [ ] 所有可點擊元素 ≥ 44 × 44 px（保留現狀標準）。
- [ ] `prefers-reduced-motion` 啟用時所有 sheet 退化為 fade。

### 7.2 流程
- [ ] 「找隊伍 → 點開細節 → 應徵」整段不需要返回鍵。
- [ ] 「開隊伍」3 步驟 wizard 中，每步只露出當前必要欄位。
- [ ] OCR 在 Android Chrome ／ iOS Safari 用相機拍照成功率 ≥ 既有桌面值。
- [ ] 鍵盤呼出時，主 CTA 仍可見（不被遮）。
- [ ] iOS 標準回到首頁的「邊緣滑動返回」與 sheet 關閉不衝突。

### 7.3 程式碼品質
- [ ] 所有新元件含 `*.test.tsx`（vitest + RTL）。
- [ ] 新增 `e2e/mobile/*.spec.ts` 至少覆蓋：登入、開隊伍、應徵、切公會。
- [ ] `tailwind.config.ts` 與 `globals.css` token 不再衝突。
- [ ] 不引入 `useMediaQuery` 以外的新 runtime 依賴（盡量 CSS-first）。

---

## 8. 風險與相依

| 風險 | 機率 | 緩解 |
|---|---|---|
| Bottom Nav + 既有 sticky 元素 z-index 競態 | 中 | 既有 `--z-nav/--z-overlay/--z-modal/--z-toast` 已分層；新增 `--z-bottom-nav: 35` 介於 nav 與 overlay 之間 |
| Sheet primitive 在 Next.js 16 + React 19 server component 行為 | 低 | 全部 `'use client'` 包裝，與既有 LoginDialog 一致 |
| OCR 拍照在 Safari 對特殊解析度失敗 | 中 | 以 file fallback (`accept="image/*"` 不加 `capture`) 兜底 |
| `xl:` → `lg:`/`md:` 改動可能讓 1024 px 平板出現 layout 退化 | 中 | 為每個受影響頁加 `lg:` snapshot test (Playwright `--project=chromium-tablet`) |
| 與 `match` 頁的 `xl:grid-cols-[1.1fr_0.9fr]` 邏輯耦合 | 低 | 例外保留，只在該頁停留 `xl:` |

---

## 9. 後續延伸（非本期）

- 安裝為 PWA（manifest + Service Worker）→ 加入主畫面可即時推播。
- 公會頻道支援滑動切換（左右 swipe between tabs）。
- Theme：在現有暗色霓虹之外加入「節能模式」(`prefers-reduced-transparency`) 與 OLED true black。
- 多語：i18n 抽出 zh-TW / en，為東南亞玩家做準備。

---

## 10. 立即可做的 Quick Wins（< 1 d）

1. 修正 `tailwind.config.ts:11-14` → 還原 xs/sm。
2. 把 `Footer.tsx` 的 `text-[10px]` 改 `text-xs`，桌面寬度仍會跟既有一致；手機加 `md:hidden`。
3. `app/layout.tsx:56` 的 `pb-20` 加 mobile-safe padding。
4. `Modal.tsx` 的 `max-w-md` 補 `max-w-[calc(100vw-2rem)]`。
5. 全站 `grep -nE "text-\[10px\]|text-\[11px\]"` 一次替換。

---

> **下一步**：請審閱本計畫並選擇從哪個階段（建議 P0 基礎建設）開始實作。可由 `executor` 代理依各 PR 獨立執行；每個 PR 完成後由 `code-reviewer` + `qa-tester`（mobile-smoke）做雙重驗證。
