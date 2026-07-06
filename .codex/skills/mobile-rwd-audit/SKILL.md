---
name: mobile-rwd-audit
description: OneShort 手機版 RWD 實測審查。修改任何行動版版面、觸控行為、斷點、固定元素或表單後，或發版前全站審查時使用。執行靜態掃描（style.md §10 不變式）與 Playwright 實機走訪（375/390/430/768px），產出附證據的 P0–P3 問題報告。
---

# OneShort 手機版 RWD 實測審查

規範依據：`.agent/rules/style.md` §10（Responsive Invariants）、§12（版面實作純度）、§13（手機版實測審查）＋ 全域 skill `frontend-rwd-uiux-standards`（checklist §15/§16）。本 skill 提供可重複執行的工具與判讀準則；規則本文以 style.md 為唯一權威來源。

## 適用時機

- 修改 `frontend/` 任何行動版版面、觸控互動、斷點、fixed/sticky 元素、modal/sheet、表單後的完成驗證（style.md §12.7 第 3 點）。
- 發版前 / 使用者要求「檢查手機版」時的全站審查。

## 前置條件

- dev 前端（port 3000）與後端（port 8080，`main.exe`）運行中。先用 `Get-NetTCPConnection` 確認，不要重複啟動後端。
- **只對 dev 環境執行**。腳本會建立一個 quick-login 測試帳號與臨時隊伍/公會（隊伍/公會結束時自動刪除，帳號會留在 dev DB）。

## 執行步驟

### Step 1：靜態掃描

依 style.md §13.1 的表格逐項 Grep `frontend/src`。每一項回報「違規（檔案:行號）」或「已掃描、無違規」，不可略過。

### Step 2：動態實測

```powershell
node .claude/skills/mobile-rwd-audit/audit.cjs            # 全站走訪
$env:AUDIT_ROUTES='/find,/parties/create'; node .claude/skills/mobile-rwd-audit/audit.cjs   # 只跑指定路由
```

環境變數（皆有預設值）：`AUDIT_BASE`（http://localhost:3000）、`AUDIT_API`（http://localhost:8080/api/v2/）、`AUDIT_OUT`（輸出目錄，預設 skill 目錄下 `audit-out/`，已被 git 忽略，勿提交）、`AUDIT_ROUTES`（逗號分隔，預設全部）、`AUDIT_SKIP_DETAIL=1`（跳過建立臨時 party/guild）、`AUDIT_PERSONA_CODE`／`AUDIT_PERSONA_PIN`（預設 RW1ED78 / 123456，重用既有稽核帳號避免累積新帳號）。

腳本輸出：`results.json`（逐頁量測）＋ 每頁 viewport / full-page 截圖。

### Step 3：判讀

檢查每頁的量測欄位，對照門檻：

| 欄位 | 門檻 | 違規分級 |
|---|---|---|
| `hOverflow` | 必須 false | P0/P1 |
| `smallTargets` | 互動元素 <44×44 | P2（先複核 `.os-touch-target` ::before 擴張與 coarse min-* 補償，rect 量不到） |
| `tinyText` | 渲染字級 <12px | P2 |
| `inputsUnder16` | 輸入框 <16px（iOS 聚焦縮放） | P2 |
| `fixedEls` | 互疊 / 遮擋內容 | 視情況 P1–P3 |
| `viewportMeta` | 必須含 `viewport-fit=cover` | P1（§10 #12） |

**已知誤報，排除不列**：overflow 容器內的跑馬燈（`.os-ticker-inner`）與可捲 tab 列（先確認 `overflow-x: auto`）；Next dev tools 左下黑色「N」圓鈕；快速導航觸發的 rate-limit toast（`請求過於頻繁`）。

**複核義務**：subagent 或腳本報的違規，必須親自讀原始碼確認後才列入報告（歷史誤報案例：`.os-icon-btn` 的 44px 補償在 globals.css 另一個 @media 區塊，掃描 agent 漏看）。

### Step 4：回報

- P0（跑板/不可用）→ P1（違反 §10/§12 硬規）→ P2（HIG/checklist 體驗）→ P3（優化建議）。
- 每條附：頁面、現象、證據（截圖/量測值）、檔案:行號、建議修法（優先引用既有 token/class：`.os-touch-tall`、`--os-bottom-nav-h`、`--z-*`）。
- 結尾附 `frontend-rwd-uiux-standards` checklist §16【RWD 檢查結果】，不適用項標註原因。
- 同時列出「通過項」（附實測依據），避免下次重複審查已確認安全的面向。

## 歷史案例（判讀校準用）

2026-07 全站審查的代表性發現，遇到同模式直接比照分級：

- **P1**：`layout.tsx` 缺 `export const viewport`（`viewportFit: 'cover'`）→ 全站 safe-area 失效；`/find` 篩選列 `flex: 1 1 260px` 在 column 斷點變高度 basis → ~520px 空白（§10 #9 的由來）。
- **P2**：`.os-input` 13–13.5px（iOS 聚焦縮放）；`.os-nav-item` 38px 高無補償；`.os-icon-btn` 補償只綁 `max-width: 899px` 漏 `pointer: coarse`；狀態 pill 10–10.5px；BugReportModal inline 版面屬性。
- **P3**：hover-only tooltip 資訊觸控看不到（有替代入口）；可捲 tab 列無捲動暗示；`--os-text-faint` 於 `--os-surface` 對比 ~2.65:1。
