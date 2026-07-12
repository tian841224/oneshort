# OneShort 專案文件索引 (Project Documentation Index)

歡迎閱讀 OneShort 專案文件。**本 repo（ROOT 協調 repo）只放導覽、系統簡介與功能總覽**——不放前端或後端的實作細節（API 端點細節、後端商業邏輯/狀態機、資料流內部機制、前端元件/頁面實作邏輯）。這些實作內容各自維護在 `backend/` 與 `frontend/` 兩個獨立 repo 自己的文件裡；本頁每個項目會指向對應的權威來源。

---

## 📚 1. 開發規範、流程、架構 (Standards & Architecture)

- **[跨 repo 協調規則 (Core Rules)](../.agent/rules/core.md)**：修改前確認 `BRANCH` / `WORKTREE`、分支命名規範、建立方式、雙向同步檢查。
- **後端開發規範（自足規則入口）**：[backend/AGENTS.md](../backend/AGENTS.md) — 技術棧、Clean Architecture、方案評估準則、驗證指令、完成條件。
- **前端開發規範（自足規則入口）**：[frontend/AGENTS.md](../frontend/AGENTS.md) — 技術棧、UI/UX 任務規則、驗證指令、完成條件。

## ⚙️ 2. 資料流程與即時通訊

- **[即時通訊機制 (Real-time & WS)](./data-flow/realtime.md)**：Outbox Pattern、Redis Streams 與 WebSocket 的前後端契約（本檔刻意保留為跨切文件，同時涵蓋後端發布與前端消費規則）。
- 後端完整資料流程（路由生命週期、Worker、Outbox）：[backend/docs/data_flow.md](../backend/docs/data_flow.md)。
- 前端資料流程（TanStack Query 快取策略、Zustand 狀態）：[frontend/docs/agent/04-data-flow.md](../frontend/docs/agent/04-data-flow.md)。

## 🧩 3. 各項功能模組說明 (Features)

各業務領域的**高層總覽**；每份文件末尾的「深入文件」段會指向 backend/frontend 對應的規格書、API 參考與程式碼位置。

- **[身份驗證 (Auth)](./features/auth.md)**：Actor、Quick Login、Discord OAuth、Cookie session 與 Discord merge。
- **[隊伍管理 (Party)](./features/party.md)**：隊伍類型、審核機制、閒置生命週期、訪客互通。
- **[通訊與通知 (Notify)](./features/notify.md)**：全系統事件推送、中心化通知路由。
- **[其他模組 (Others)](./features/others.md)**：OCR、Bug 回報、已移除模組狀態。
- **[公會系統 (Guild)](./features/guild.md)**：公會、成員、公告、聊天室、公會限定隊伍與每週王團自動配對。
- **[系統公告與 NoticeBar (Announcement)](./features/announcement.md)**：公告 modal 與 Navbar 跑馬燈的公開讀取與管理端點。
- **[線上人數與每日統計 (Online Stats)](./features/online-stats.md)**：即時在線人數顯示與每日流量/峰值落庫。
- **[Telegram Bot](./features/telegram-bot.md)**：管理員 Telegram 指令總覽。
- **[Guest Mode / 訪客模式](./features/guest-mode-plan.md)**：訪客身分建立隊伍、申請與登入認領的現況。

## 📝 4. 設計決策紀錄 (Design Decision Records)

所有涉及架構/方案取捨的決策，皆以 ADR 形式記錄，**集中存放於本 repo**（不論決策內容偏前端、後端或跨切——ADR 記錄的是歷史決策，不是操作規則，backend/frontend repo 可用資訊性參照指向這裡）；修改對應模組前必須先讀取並遵守。

- **[決策索引 (Decisions Index)](./decisions/index.md)**：ADR 命名規則、範本、推翻舊決策流程與完整索引表。

## 🎨 5. 設計資產 (Design Assets)

產生 OneShort 視覺資產（角色圖示、公會徽章等）時使用的產圖提示詞範本；實際產圖/命名/審查流程見 `oneshort-asset-generation` skill（[.agent/rules/docs-router.md](../.agent/rules/docs-router.md) 已路由）。

- **[角色圖示產圖範本 (Character Icon Prompt)](./assets/character.md)**
- **[公會徽章圖示產圖範本 (Icon Prompt)](./assets/icon.md)**

## 🖥️ 6. 系統簡介

- **[系統全覽 (System Overview)](./system-overview.md)**：整體架構圖、服務說明、技術棧、關鍵設計模式。

---

## 🔧 維護與更新建議

- 本文件應隨系統架構變動持續更新；新增功能模組時同步補上第 3 節條目，避免漏列（既往教訓：本索引曾長期漏列數個已實作功能）。
- 索引內的連結必須對應實際存在的檔案；功能退場後應移到歷史文件或明確標註非現行流程。
- **不要把 backend/frontend 的實作細節寫回本頁或 `docs/features/*.md`**——那違反本 repo 的定位（見檔首說明）。新的實作細節一律寫進對應 repo 自己的文件，本頁/功能總覽只加一行指標。
