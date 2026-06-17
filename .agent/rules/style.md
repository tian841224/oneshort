---
trigger:
  - frontend/**/*
  - uiux_task
---

# OneShort Design Rules
Version: 2.0

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
