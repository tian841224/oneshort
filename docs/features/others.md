# 其他模組 (Other Modules)

> 包含 OCR、Bug 回報與已移除模組的維護狀態。本檔僅為高層總覽；實作規格以下方「深入文件」為準。

---

## 1. OCR 影像辨識

使用者上傳遊戲截圖，後端解析成員/BOSS/頻道資訊協助填寫隊伍表單。目前以 dummy scanner 佈線（回傳固定假資料，功能實質停用），保留 service boundary 供未來替換真實 OCR 引擎（Google Vision / Tesseract）；屆時需維持圖片儲存、OCR 分析與 API handler 解耦，並評估改為「上傳回傳 JobID + 完成通知」的非同步模式。

- 規格：backend repo `docs/specs/user.md` 附錄「OCR 截圖輔助」；端點見 `docs/api-reference/others.md`

## 2. Bug 回報

公開表單（不要求登入）供使用者回報問題，管理員透過後台 API 與 Telegram 指令查詢、更新狀態（`open`/`in_progress`/`completed`）與回覆；公開列表只回摘要，不洩漏 `user_id`、`contact`、`description`、`developer_reply`。若回報量增加，需補管理端分頁。

- 規格：backend repo `docs/specs/admin.md`「Bug 回報來源」與 Telegram 指令表；端點與欄位見 `docs/api-reference/others.md`
- 前端：frontend repo `docs/frontend-logic.md` §十七（Bug 回報表單入口與程式碼對應）

## 3. 已移除模組與相關殘留設定

- `raid` 模組已從正式前後端流程移除；不要在新文件中描述為現行功能。
- `raid_boss_options` 仍保留，作為 `BOSS` 與 `GROUP` 隊伍的目標選項資料來源，不代表 Raid 模組仍存在（見 [party.md](party.md)）。
- `guild` 模組已於 2026-04-28 重新導入，**為現行功能**，不適用本節「已移除」狀態；詳見 [guild.md](guild.md)。
