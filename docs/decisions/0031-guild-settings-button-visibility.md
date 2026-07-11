# ADR-0031: 公會設定入口改為主分頁列常駐分頁，移除次要選單收合

- 狀態: Accepted
- 日期: 2026-07-11
- 相關模組: frontend / guild
- 相關文件: docs/features/guild.md

## 背景 (Context)

公會幹部（會長／幹部）進入 `/guilds/{id}` 公會詳情頁時，「公會設定」入口原本被排除在主分頁列（`GUILD_NAV`：總覽/公告/成員/公會隊伍/BOSS 配對）之外，改放進一個獨立的 kebab（三點）overflow 選單：`GuildDetailClient.tsx` 需要先點擊一個只有圖示、無文字、顏色極淡（`text-muted` + 透明背景，僅 hover 才有底色）的 `os-icon-btn`，展開下拉選單後才會看到「設定」文字選項，共兩次點擊才能到達設定頁。

使用者回報：即使畫面寬度足夠、有充裕空間可以直接顯示，這顆入口仍被隱藏在選單後面，體感上「不明顯」且操作步驟過多，要求「寬度夠的情況下不該隱藏」。

程式碼內原本有明確的設計意圖註解（`GuildDetailClient.tsx` 第 33–35 行）：「"設定" is intentionally excluded from GUILD_NAV — it never appears in the main tab row (max 5 primary tabs for every role). Officers reach it via the kebab overflow menu instead」。這是一個從未被寫成正式 ADR 的既有決策，本次變更需要正式推翻它。

`docs/decisions/index.md` 索引表確認过去沒有任何 ADR 討論過這顆按鈕的呈現方式；`docs/features/guild.md` 也完全沒有描述過這顆按鈕的 UI 規格，只在程式碼與行內註解中存在。

## 考慮過的方案 (Options Considered)

1. **方案 A — 併入主分頁列，成為官員專屬的第 6 個常駐分頁**：移除 kebab 選單與其專屬 state（`settingsMenuOpen`、outside-click/Escape 監聽、officer 失去身分時關閉選單的 effect），改成在渲染時把 `SETTINGS_NAV_ITEM` 依 `isOfficer` 條件性附加到既有 `GUILD_NAV` 清單尾端，與其他 5 個分頁共用同一個 `.os-guild-detail-tab` 樣式（icon + 文字、底線 active 樣式一致）與同一個 `.os-guild-detail-tabs os-guild-tab-bar` 容器（該容器本身已 `overflow-x: auto` 提供橫向捲動 fallback，見 `globals.css` `.os-guild-tab-bar`）。
   - **維護性**：程式碼量顯著減少（移除約 25 行 state/ref/effect、移除約 45 行 kebab JSX、移除約 60 行專屬 CSS），不再需要維護 outside-click、Escape、officer 身分變化時的選單關閉這三條獨立邏輯；設定分頁與其他分頁共用同一份渲染與樣式路徑，降低未來新增/調整分頁時的分岔。
   - **效能**：移除一組 `useState`/`useEffect`（document 層級 mousedown/keydown 監聽），減少不必要的事件監聽與重渲染分支，效能微幅提升，無負面影響。
   - **安全性**：無安全性影響（純前端呈現邏輯，不涉及權限判斷變更，`isOfficer` 條件式維持不變）。
   - **RWD 風險**：需驗證加入第 6 個分頁後，在 `bottomNav`（900px）斷點附近（此時側欄仍佔 240px、主欄尚未進入行動版單欄）容器寬度是否足夠容納 6 個分頁而不換行/擠壓。已用既有 class 寬度換算估算：6 個分頁（含 icon + padding + 最長標籤「公會隊伍」「BOSS 配對」）合計約 500px，最壞情況（視窗恰為 900px，`.os-guild-detail-main` 實際可用寬度約 628px）仍有約 130px 餘裕；即便估算有誤，`.os-guild-tab-bar` 已有 `overflow-x: auto` 作為無條件 fallback（非僅 899px 以下才啟用），不會造成版面破版或水平溢位頁面（僅分頁列自身可捲動）。
2. **方案 B — 保留 kebab 收合機制，但依斷點切換為寬螢幕常駐按鈕**：窄螢幕維持現有 kebab 選單，`desktop`（1200px）以上改成一個有圖示＋文字、常駐顯示的獨立按鈕，放在 `.os-guild-detail-main` 右側目前未使用的留白空間（該區域因 `.os-app-frame` max-width 1440px 而在寬螢幕下確實有餘裕），用 `@media (min-width: 1200px)` 切換兩種呈現。
   - **維護性**：需要同時維護兩套呈現邏輯（kebab + 常駐按鈕）與其斷點切換，程式碼量比方案 A 更多；且與 `.os-guild-detail-shell` 現有「single content column」設計註解（globals.css 7874 行「Guild detail workspace — single content column」）相衝突——刻意在主欄右側留白處放一個孤立按鈕，會破壞既有單欄閱讀節奏與 `style.md` §5「不使用漂浮裝飾」的精神。
   - **效能**：與方案 A 相近，但多一組斷點判斷邏輯。
   - **安全性**：同方案 A，無影響。
   - **問題**：使用者的訴求是「寬度夠不該隱藏」，但方案 B 在 900–1199px 之間（`bottomNav` 以上但未達 `desktop`）仍然維持 kebab 收合，並未真正解決「有寬度卻隱藏」的核心抱怨，只是把門檻從「一律隱藏」改成「更高的斷點才不隱藏」，治標不治本。
3. **方案 C（未採用）— 圖示不變但加大對比度與加上文字 tooltip**：維持 kebab 收合結構，只加強視覺對比（不透明背景、深色圖示）並加 `title` tooltip。
   - 僅改善「不明顯」的視覺對比問題，完全沒有解決「需要兩次點擊」與「寬度夠仍隱藏」的核心訴求，不符合使用者明確要求，直接淘汰不深入評估。

## 決策 (Decision)

採用**方案 A**：移除 kebab overflow 選單與其專屬 state/CSS，改為在渲染時依 `isOfficer` 條件性把 `SETTINGS_NAV_ITEM` 附加到主分頁陣列尾端，與其他分頁共用相同的 `.os-guild-detail-tab` 樣式與同一個橫向捲動容器。「設定」分頁現在對幹部而言永遠與其他分頁同列可見，不再需要任何額外點擊即可到達；非幹部使用者則完全看不到這個分頁（`isOfficer` 條件不變，權限邏輯零改動）。

具體改動：
- `frontend/src/app/guilds/[id]/_components/GuildDetailClient.tsx`：移除 `settingsMenuOpen`/`settingsMenuButtonRef`/`settingsMenuPanelRef` 與對應的 outside-click/Escape `useEffect`、officer 身分變化時關閉選單的 `useEffect`；nav tabs 渲染改為單一 `.os-guild-detail-tabs os-guild-tab-bar` 容器，`map` 一個由 `GUILD_NAV`（依既有 `isMember` 條件過濾）與 `isOfficer` 時附加的 `SETTINGS_NAV_ITEM` 組成的陣列；同步更新第 33–36 行過期的設計意圖註解，使其反映新行為（依 core.md §3「文件過期必須同步更新或移除」）。
- `frontend/src/app/globals.css`：移除 `.os-guild-detail-tabs-row`、`.os-guild-detail-tabs-overflow`、`.os-guild-detail-tabs-kebab[data-active]`、`.os-guild-detail-tabs-overflow-panel`、`.os-guild-detail-tabs-overflow-item*` 等僅供 kebab 選單使用的 CSS 規則；`.os-guild-detail-tabs`/`.os-guild-detail-tab` 基礎規則不變，繼續被沿用。
- `frontend/src/app/guilds/[id]/_components/GuildDetailClient.test.tsx`：`describe('officer settings overflow menu', ...)` 改寫為 `describe('officer settings tab visibility', ...)`，斷言「設定」分頁與其他 5 個分頁同時直接可見、不存在「更多選項」按鈕與 `menu` role、點擊「設定」分頁可直接切到 `SettingsSection`、非幹部看不到「設定」分頁。
- `docs/features/guild.md`：於 §1 現行範圍補一句「公會詳情頁『設定』分頁僅幹部（含會長）可見，與其他分頁同列常駐顯示，不藏在次要選單後」。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能，衝突時依序權衡）：

- **安全性**：三個方案皆不影響權限判斷（`isOfficer` gating 邏輯完全不變），此軸不構成方案間差異。
- **維護性**：方案 A 淨刪除程式碼與其專屬互動邏輯（outside-click/Escape/officer 身分感知關閉），且與既有 5 個分頁共用同一套渲染與樣式路徑，是三個方案中複雜度最低、最不容易在未來修改時產生分岔或遺漏同步的方案；方案 B 需要維護雙套呈現邏輯且與既有「single content column」設計意圖衝突，維護成本與架構一致性都劣於方案 A。
- **效能**：方案 A 移除一組 document 層級事件監聽，效能略優，但差異在此案中屬次要考量。
- **使用者訴求對齊**：方案 A 是唯一真正做到「寬度夠的情況下不該隱藏」的方案——因為它完全不依賴任何寬度斷點來決定是否隱藏「設定」，只要是幹部就永遠與其他分頁同列可見；方案 B 仍然保留「未達某斷點時隱藏」的行為，只是把門檻上移，並未真正回應訴求。

綜合三項前提與使用者明確訴求，方案 A 全面優於方案 B 與 C。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 B（依斷點切換 kebab／常駐按鈕）**：被拒絕，因為它在 900–1199px 區間仍隱藏「設定」，未解決使用者訴求的核心（「寬度夠不該隱藏」不應該只是把隱藏門檻調高），且需要維護兩套呈現邏輯、與既有 `.os-guild-detail-shell` 單欄設計意圖（globals.css 7874 行註解）相衝突，維護成本更高卻換不到對等的體驗改善。若未來主分頁列因分頁數量持續增加而在窄的桌機寬度出現排列擁擠的體驗問題（非本次範圍），可重新評估屆時是否需要斷點切換式的收合策略。
- **方案 C（僅加強 kebab 視覺對比）**：被拒絕，因為它完全沒有解決「需要兩次點擊」與「寬度夠仍隱藏」兩個核心問題，只是治標不治本的視覺調整，不符合使用者明確提出的訴求。

## 影響 (Consequences)

- 幹部檢視公會詳情頁時，主分頁列在其視角下固定為 6 個分頁（非幹部與非成員仍維持既有 `isMember`/`isOfficer` 過濾後的分頁數量不變）；一般成員與訪客的分頁數量與呈現方式完全不受影響。
- 移除的 kebab 選單無任何其他消費者（已用 grep 確認 `settingsMenuOpen`/`SETTINGS_NAV_ITEM`/`os-guild-detail-tabs-kebab`/`os-guild-detail-tabs-overflow` 僅出現在 `GuildDetailClient.tsx` 與 `globals.css` 兩處，無 e2e 測試依賴 kebab 互動流程），移除不影響其他模組。
- `frontend/tests/e2e/guild-management.e2e.ts` 的 `openGuildSection` 輔助函式（依 accessible name 精準比對點擊分頁按鈕）不需修改即可直接用於「設定」分頁（原本該輔助函式的頂部註解已泛稱「clicking its nav tab button」，本次變更後這句話對「設定」分頁而言終於變成完全準確的敘述，之前需要額外的 kebab 展開步驟）。
- 未來若分頁數量再增加、在 `bottomNav`（900px）附近出現實際擁擠或换行的情況，`.os-guild-tab-bar` 既有的 `overflow-x: auto` 提供無條件 fallback（不限斷點），可作為即時緩解；若體驗仍不理想，才需要重新評估是否引入新的收合策略（不在本 ADR 範圍內）。

## Supersedes / Superseded by

無（本 ADR 推翻的是 `GuildDetailClient.tsx` 程式碼行內註解記錄的既有設計意圖，該意圖從未被寫成正式 ADR，故無正式的 Supersedes 關係）。
