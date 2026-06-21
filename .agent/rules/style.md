---
trigger:
  - uiux_task
---

# OneShort Design Rules
Version: 2.1

本文件只在修改前端 UI/UX、視覺樣式、互動文案、排版、響應式行為或設計資產時讀取。非 UI 任務不要載入本文件。

## 1. Product Identity

OneShort is a premium Artale real-time party matchmaking platform.

The UI must feel like:
- a premium game utility SaaS
- a modern minimalist dashboard
- a calm collaborative workspace
- warm, cozy, elegant, and functional
- boutique hotel + Notion + Airbnb + Linear inspired
- softly game-aware without becoming a game launcher

OneShort must not feel like:
- a cyberpunk or neon gaming UI
- a flashy RGB launcher
- a fantasy MMORPG marketing homepage
- a glassmorphism demo
- a futuristic dark sci-fi dashboard
- a generic landing page

The target phrase is:

> Linear meets MMORPG matchmaking, softened by warm hospitality design.

## 2. Color System

Use this palette as the product source of truth.

```css
--os-bg: #F3F3F1;
--os-surface: #DDD9C8;
--os-surface-elevated: #EFEBDD;
--os-primary: #D4AA63;
--os-text: #1E1E1A;
--os-text-muted: #5F5A4B;
--os-border: #1E1E1A;
--os-success: #5E9F6E;
--os-warning: #C28B63;
--os-danger: #B36B5E;
```

Rules:
- Use warm beige, warm gray, muted brown, soft olive, muted gold, and muted terracotta.
- Avoid pure black; use `#1E1E1A` for dark text and borders.
- Avoid high saturation.
- Avoid blue/cyan/purple as dominant UI colors unless an external brand requires it.
- Do not invent page-local cream/gold/brown variants when a shared token can be used.
- Illustration colors may be richer than UI colors, but must stay low-saturation and warm.

## 3. Typography

Typography should feel modern, editorial, premium, and readable.

Recommended stack:
- Inter
- Noto Sans TC
- Geist
- SF Pro

Rules:
- Use Traditional Chinese labels and Taiwan terminology.
- Keep product and game terms when natural: `OneShort`, `Artale`, `Discord`, `BOSS`, `Lv.`, `CH`.
- Do not expose technical IDs, DTO names, room status enums, or UUIDs in UI text.
- Use concise UI copy. Avoid explanatory paragraphs inside operational dashboards.
- Reserve hero-scale typography for actual hero surfaces. Dashboards use compact hierarchy.

## 4. Layout System

Use desktop SaaS dashboard composition by default.

Spacing scale:
- 4px
- 8px
- 12px
- 16px
- 24px
- 32px
- 48px
- 64px

Radius scale:

```css
--os-radius-sm: 10px;
--os-radius-md: 16px;
--os-radius-lg: 24px;
--os-radius-xl: 32px;
```

Rules:
- Use high whitespace, but keep data surfaces information-dense.
- Prefer 2-3 column dashboard layouts for desktop workflows.
- Keep sidebars, content lists, detail panels, and action panels visually distinct.
- Do not place cards inside decorative cards unless it is a real repeated item, modal, or framed tool.
- Use stable dimensions for repeated cards, icon buttons, counters, tabs, and slot tiles.
- Mobile should preserve the same visual language with stacked cards and 44px minimum touch targets.

## 5. Card And Surface System

Default dashboard card:

```css
background: var(--os-surface-elevated);
border: 1px solid rgba(30, 30, 26, 0.14);
border-radius: var(--os-radius-lg);
box-shadow: 0 18px 44px -38px rgba(30, 30, 26, 0.62);
```

Use:
- `#F3F3F1` for full page background.
- `#DDD9C8` for warm base surfaces and larger panels.
- `#EFEBDD` for elevated cards, forms, preview panels, chat panels, and modals.
- Thin dark borders with low opacity.
- Soft shadows only.

Avoid:
- heavy shadows
- harsh contrast
- glossy panels
- floating orb or blob decorations
- dark slate/cyan visual systems

## 6. Component Rules

### Navbar

Navbar should be fixed or sticky when the page needs persistent navigation.

Always include:
- OneShort brand
- online status
- notification/message/help affordances when relevant
- account access

Rules:
- Keep it lightweight and utility-focused.
- Do not put long announcements, bug links, or GitHub links in the top navigation.
- Use icon buttons for compact actions.

### Sidebar

Sidebar should contain navigation and filters, not marketing copy.

Rules:
- Group actions by user intent, such as `我的工作區` and `尋找隊伍`.
- Prefer simple binary choices before detailed filters.
- Selected state uses warm accent, not neon color.

### Cards

Cards should:
- use consistent padding rhythm
- have clear title, metadata, and action zones
- avoid excessive badges
- avoid dense paragraph descriptions

Party cards should prioritize:
- title
- party type / target
- member status
- open positions
- channel/time only when useful

### Forms

Forms should:
- use labels above fields
- group related controls into cards
- use two-column layouts when fields are comparable
- keep primary CTA in one predictable action area

Inputs:

```css
border-color: rgba(30, 30, 26, 0.14);
box-shadow: none;
```

Focus:

```css
border-color: #D4AA63;
box-shadow: 0 0 0 3px rgba(212, 170, 99, 0.16);
```

### Buttons

Primary button:
- warm accent background
- dark text
- medium weight
- soft hover
- no glow
- no gradient

Secondary button:
- elevated surface
- thin dark border
- muted hover fill

Danger button:
- muted terracotta treatment
- no saturated red unless the action is destructive and must stand out

### Modals And Floating Layers

Modals should:
- use `#EFEBDD`
- use thin dark border
- preserve the same radius and shadow as dashboard cards
- keep footer actions clear and right-aligned
- use `width: min(Npx, calc(100vw - 32px))` (never a fixed px width), an overlay with padding, and `max-height` + scroll — so they never overflow on narrow phones

Do not use generic dark overlays with bright game colors.

### Detail Panels

Detail panels should:
- summarize the selected item at the top
- keep primary actions in one obvious area
- use sticky positioning on desktop only when helpful
- avoid duplicating the same CTA in multiple columns

### Chat

Chat should:
- feel like a calm utility panel
- use compact message cards
- show readable sender metadata
- avoid decorative avatars when text is more useful
- keep input pinned at the bottom of the chat panel

### Status, Loading, Error, Empty

Status pills:
- rounded
- compact
- low saturation
- meaningful label only

Loading:
- skeleton or muted placeholder blocks
- no flashy spinner as the main visual

Error:
- concise Taiwan Traditional Chinese text
- muted terracotta styling
- recovery action when possible

Empty state:
- calm icon or small illustration
- one clear next action
- no long educational copy

## 7. Icon System

OneShort uses two icon layers.

### Functional UI Icons

Use `lucide-react` for:
- navigation
- search
- filter
- notification
- message
- edit
- share
- back
- close
- submit
- settings
- external links

Rules:
- Do not replace functional UI icons with generated bitmap art.
- Use consistent stroke width, size, and color tokens.
- Icon-only buttons need accessible labels.

### Game Context Icons

Use the shared OneShort asset system for:
- job/class avatars
- job family icons
- party type icons
- status/empty state illustrations
- guild or party atmosphere art

Rules:
- Game-context assets are contextual support, not primary UI controls.
- Do not replace functional icons, status labels, CTAs, navigation, or filters with generated bitmap art.
- All Traditional Chinese labels, status text, counts, room codes, and instructions must be real UI text, not baked into images.
- New or revised assets must follow the `oneshort-asset-generation` skill.

## 8. Design Asset Integration

本文件只定義設計資產在 UI 中的使用規則；產圖流程、prompt template、檔名規範與審查細節放在 `oneshort-asset-generation` skill。

主要產品 surface 在有助於辨識情境時，應至少使用一種 OneShort game-context asset：
- job/class avatar
- party thumbnail
- scene banner
- empty-state illustration
- guild emblem or banner
- boss thumbnail
- status icon

Rules:
- 資產只能輔助情境，不可取代資料結構、狀態顯示或操作文字。
- 所有 UI label、狀態、數字、房間資訊與教學文案都必須是 real HTML text。
- 圖像要使用穩定 aspect ratio，避免列表卡片因圖片載入而跳動。
- 表單、表格、聊天與高密度工作區只使用低干擾資產，不在欄位旁堆裝飾圖。
- 不使用 copyrighted Artale assets 或明顯複製的遊戲原圖。
- 產生、修改、審查或命名新資產時，載入 `oneshort-asset-generation` skill。

### 地圖 Target 圖片顯示規範

`MAP_TARGETS`（`partyArtwork.ts`）內的地圖類圖片是場景實景截圖，以 `'contain'` 完整顯示原圖（卡片背景以 `.os-boss-image` gradient 補白）。

**規則（違反任一項均為 bug）：**

- 地圖 target 的 `fit` 必須為 `'contain'`（完整顯示截圖），禁止使用 `'cover'`（會裁切圖片使部分內容超出可視範圍）。
- 三個 crop 變體（`default`、`square`、`wide`）必須全部指向同一張原始圖片（`label` 本身），不得使用 `-square.png`、`-wide.png` 預裁切版本（地圖不製作裁切版）。
- 地圖圖片統一以 `.png` 存放於 `public/images/party/targets/target-{name}.png`。
- `TARGETS` 與 `MAP_TARGETS` 的 key 是整個系統（含 DB）的 canonical label，不可更改副檔名。
- 非地圖 target（BOSS／冒險場景）的 `fit` 為 `'contain'`，並附帶 `BOSS_BACKGROUNDS` 背景圖，有 `-square.png`、`-wide.png` 裁切版本。

**`targetAsset()` 地圖分支的正確寫法：**

```typescript
crops: isMap ? {
  default: '/images/party/targets/' + label,
  square:  '/images/party/targets/' + label,  // 全指向原圖，不裁切
  wide:    '/images/party/targets/' + label,
} : {
  default: '/images/party/targets/' + label,
  square:  '/images/party/targets/' + base + '-square.png',
  wide:    '/images/party/targets/' + base + '-wide.png',
},
```

### BOSS_BACKGROUNDS 套用範圍（設計決策）

`targetAsset()` 對所有**非 `MAP_TARGETS` 成員**（含 BOSS、GROUP 冒險場景、TRAINING 練功場景等）一律套用 `BOSS_BACKGROUNDS`（`background1/2/3.png`）作為卡片背景圖層。

**這是刻意設計，不是 bug**：非地圖目標圖片以 `fit: 'contain'` 呈現，需要背景圖來填補留白區域；BOSS_BACKGROUNDS 的色調對 BOSS、GROUP、TRAINING 類型的卡片均適用。若未來某類型需要獨立背景色組，才在 `targetAsset()` 內依 party type 分支。

Recommended paths:

```txt
frontend/public/assets/jobs/
frontend/public/assets/scenes/
frontend/public/assets/thumbnails/
frontend/public/assets/empty/
frontend/public/assets/status/
frontend/public/assets/guilds/
frontend/public/assets/bosses/
```

Recommended formats:
- icons / avatars: `webp` or `png` with transparency
- simple status icons: `svg`
- scene banners and large backgrounds: `webp`
- fallback assets: `png`

## 9. Motion

Allowed:
- fade
- soft slide
- opacity transition
- subtle hover lift
- button press scale below 2%

Avoid:
- bounce
- shake
- glow pulse
- aggressive animation
- loading effects that distract from task completion

Timing:

```css
150ms - 250ms
```

Respect `prefers-reduced-motion`.

## 10. Responsive Rules

Desktop:
- use dashboard columns
- keep detail or chat panels sticky when useful
- preserve action visibility

Tablet:
- reduce to two columns where possible
- stack secondary panels below main content

Mobile:
- single-column cards
- bottom-safe action placement when needed
- minimum 44px touch targets
- no horizontal overflow

### Responsive Invariants（違反任一項視為 bug）

這些是從 RWD 審查歸納、最容易被「巧合正確」掩蓋的硬性規則。修改任何版面、觸控或斷點前必讀：

1. **斷點單一來源**：JS 與 CSS 不得各自定義斷點。JS 一律用 `useIsMobile(BP.x)`（`frontend/src/lib/breakpoints.ts`）對齊 `globals.css` 的 `@media`。標準值：`sm 640 / mobile 768 / bottomNav 900 / desktop 1200 / wide 1600`（CSS `max-width` 用「值−1」＝ `639/767/899/1199`、`min-width` 用值本身 ＝ `768/1200/1600`，與 `useIsMobile(X)` ≡ `(max-width: X−1)` 對齊）。新增 viewport 判斷前先確認是否已有對應 `BP`，禁止裸 `innerWidth` 或裸數字斷點。
2. **響應式屬性禁止寫 inline style**：`grid-template-columns`、`flex-direction`、`width/height`、`display` 等「會隨斷點改變」的屬性必須放在 class / `data-*` / CSS 變數，**不可寫成 inline `style`**——inline 特異度高於 `@media`，會靜默壓過手機覆寫。範例：角色列用 `.os-member-row--account` + `data-editing`，而非 inline `gridTemplateColumns`。
3. **觸控目標 ≥44×44**：固定尺寸或圖示型互動元素在觸控（`@media (pointer: coarse)` 或 ≤900px）必須 ≥44×44。用共用 class：`.os-icon-btn`（已 min-44）、`.os-btn--icon`（固定寬 `.os-btn`）、`.os-touch-tall`（可長高的文字鈕／分頁／選項 → min-height:44）、`.os-touch-target`（toggle／小鈕保留視覺、`::before` 擴大命中區）。規則一律用 `min-width/min-height`（非 `width/height`）才壓得過 inline；不要寫 sub-44 的 inline 尺寸。密集 widget（如 TimeSlotPainter 塗格）不硬塞，改以批次/預設大目標替代。
4. **底部固定列清除用 token**：任何位於行動底部導覽列上方的可捲區，底部保留量一律用 `calc(var(--os-bottom-nav-h) + 內距)`（`--os-bottom-nav-h = 56px + safe-area`）或套 `.os-page-scroll--bottom-nav`，禁止寫死 `72/76/80/100` 等魔術數字，且必須含 `env(safe-area-inset-bottom)`。注意：inline `padding` 簡寫會壓過 `.os-shell__main > *` 的清除規則（改用 class 的 `!important` 或 explicit `paddingBottom`）。NO_SHELL 頁（login/home）的手機底部 padding 也須含 safe-area（home-indicator）。
5. **z-index 走既定 scale**：固定／浮動層級用 `--z-*` token（`--z-nav / --z-bottom-nav / --z-overlay / --z-dropdown / --z-modal / --z-toast`），不要寫任意數字。
6. **行動殼與內容單欄共用斷點**：「shell 行動化（收側欄＋出底部導覽，`bottomNav` 900）」與「內容頁／navbar 單欄化／簡化」必須用同一斷點（900），不可讓內容頁停在較低斷點（640/768）— 否則 768–899 會出現「行動殼包桌機內容」死區（hover 預覽在觸控失效、欄寬被擠）。需依容器寬度（非視窗）收合的版面用 `@container`（如 create-party），其顯示／隱藏一律由同一 container query 控制，勿混入 viewport JS gate。
7. **觸控互動 fallback**：依賴拖曳或 hover 的互動必須提供觸控 tap 替代（用 `e.pointerType` 分流，touch 走 `onClick` 切換、mouse/pen 才拖曳）。可捲動表面上的互動格子／控制項**不可**用 `touch-action: none`（會吃掉頁面捲動）— 改用 `manipulation` 或 `pan-y`。任何「唯一操作入口」不可只放在 hover 顯示的元素上。
8. **版面用 CSS 而非 JS 量測**：能用 `@media`／`@container` 表達的版面切換（雙欄／單欄、顯示／隱藏、尺寸階）**不要**用 JS 量測 viewport（`useState`+`useEffect` 讀 `innerWidth/Height`）後切換 — SSR／首載會先以預設值渲染再跳版（CLS）。改用 CSS 讓首次 paint 即正確；靜態裝飾（如插畫 SVG）總是渲染、用 CSS 隱藏。只有 CSS 無法表達時（依資料數量、需 `getBoundingClientRect`）才用 JS，並配 `useIsMobile` 或穩定初值。

## 11. Golden Rules

Before adding or changing any UI:

1. Does it feel like a premium SaaS utility, not a game launcher?
2. Does it use the shared warm neutral palette?
3. Are cards, radius, border, shadow, and spacing consistent?
4. Is the main action obvious and not duplicated?
5. Is copy concise and written in Taiwan Traditional Chinese?
6. Are functional icons from `lucide-react`?
7. Are game-context icons from the shared OneShort asset system?
8. Is there enough whitespace without losing dashboard density?
9. Are empty/loading/error states designed, not left as plain text?
10. Does the page still feel like OneShort?
11. If new visual assets are involved, did they follow `oneshort-asset-generation` and avoid copyrighted game artwork?
12. Are responsive values (breakpoints, grid templates, touch sizes, bottom-nav clearance, z-index) driven by shared tokens/classes (`BP`, `.os-btn--icon`, `--os-bottom-nav-h`, `--z-*`) and never hardcoded inline, so `@media` can still override? (見 §10 Responsive Invariants)
