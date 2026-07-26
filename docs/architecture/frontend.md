# OneShort 前端架構

本文件描述 OneShort 前端的技術框架、專案結構、狀態管理與即時通訊設計。

## 1. 前端定位

前端負責網站畫面、互動流程與使用者操作體驗，承接隊伍、公會、通知與登入相關的所有使用者介面，並透過 WebSocket 讓畫面與後端狀態保持同步。

## 2. 技術框架

| 分類 | 技術 |
|------|------|
| 核心框架 | Next.js 16（App Router）、React 19、TypeScript 5 |
| 樣式 | Tailwind CSS 4、Radix UI / shadcn、lucide-react 圖示 |
| 伺服器資料狀態 | TanStack Query（React Query 5） |
| 本地 UI 狀態 | Zustand |
| 表單與驗證 | React Hook Form + Zod |
| HTTP 客戶端 | ky（統一 Cookie session 與錯誤處理） |
| 即時通訊 | 原生 WebSocket（單一共享連線） |
| 富文字 | Tiptap（公告等編輯場景） |
| 測試 | Vitest + Testing Library（單元）、Playwright（E2E） |

## 3. 專案結構

```text
frontend/src/
├── app/         # Next.js App Router 路由
│   ├── (auth)/      # OAuth 登入流程
│   ├── find/        # 搜尋隊伍
│   ├── parties/     # 隊伍建立、詳情與管理
│   ├── applications/ # 我的申請
│   ├── guilds/      # 公會
│   ├── history/     # 歷史紀錄
│   ├── me/          # 帳號設定（角色、PIN、Discord 綁定）
│   └── login/       # 登入頁
├── features/    # 依領域切分的功能模組（auth、party、guild、notifications、realtime、admin…）
├── components/  # 共用 UI 元件
├── hooks/       # 共用 hooks（useAuth、useParties、useWebSocket…）
├── store/       # Zustand 全域 store（auth、ws、聊天未讀數…）
├── contexts/    # React Context
└── lib/         # API 客戶端與型別定義
```

### 分層原則

- **路由層（app/）**：頁面進入點與區段 layout
- **Hook 層**：封裝查詢、mutation 與頁面行為，是頁面與資料層之間的介面
- **API 層（lib/api）**：唯一的 HTTP 入口，統一 session 與錯誤處理
- **Feature 層**：依領域組織元件與邏輯，避免跨領域耦合

## 4. 狀態管理

- **伺服器資料狀態（TanStack Query）**：隊伍列表、隊伍詳情、通知、公會資料等，以 query key 管理快取與失效
- **本地 UI 狀態（Zustand）**：登入狀態、WebSocket 連線狀態、聊天未讀數、面板開關等
- 收到即時事件時優先做「針對性 invalidate + 局部更新」，避免整頁重新載入

## 5. 即時通訊

前端維持**單一共享 WebSocket 連線**，所有需要即時性的功能共用：

```text
useWebSocket
  ├─ 建立連線，斷線採指數退避重連
  ├─ 認證成功後自動訂閱個人房間（actor:{id}）與全域列表（parties:global）
  ├─ 隊伍房間（party:{id}）採引用計數訂閱——多個元件共用同一訂閱
  └─ 事件處理層負責 TanStack Query invalidate 與 toast 提示
```

- 開啟隊伍詳情即訂閱該隊伍房間，非成員的唯讀頁也能收到席位與狀態更新
- 通知鈴鐺以帳號 id 隔離個人通知快取
- 快速登入與 Discord 登入共用同一套個人房間機制
- 連線錯誤只做診斷紀錄，斷線與重連統一由關閉事件處理，避免誤報

## 6. 響應式與 UI 原則

- 桌機與行動裝置採響應式設計，行動版有獨立的互動考量（面板、抽屜、觸控目標）
- 表單以 React Hook Form + Zod 做即時驗證
- 使用者輸入的富文字內容經過 sanitize 後才渲染

## 7. 測試策略

- **單元測試**：Vitest + Testing Library，覆蓋 hooks 與元件邏輯
- **E2E 測試**：Playwright，涵蓋桌機（chromium）與行動裝置視口的關鍵使用者流程
- **API smoke 測試**：以腳本直接驗證前後端契約
