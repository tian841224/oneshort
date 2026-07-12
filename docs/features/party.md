# 隊伍管理模組 (Party Management)

> **狀態**：現行功能，OneShort 的核心模組。本檔僅為高層功能總覽；實作規格一律以下方「深入文件」為準。

---

## 功能總覽

玩家可建立三種類型的隊伍——**BOSS**（討伐目標取自 `raid_boss_options`）、**GROUP**（組隊任務，同樣取自 `raid_boss_options`）、**TRAINING**（團練，目標為地圖）——並自訂席位職業/等級限制、密碼保護與加入審核模式。搜尋支援全量篩選（職業/等級/可加入）、房號直達與房間名稱全域搜尋。申請以角色（character）為單位：隊長可審核、直接指定自有角色入席、踢人；成員可主動離隊；一個角色同一時間只能參與一場即時活動（排他鎖）。

隊伍有完整的**閒置生命週期**：閒置一段時間先自動隱藏並通知，持續閒置則自動關閉（`CLOSED` 為最終唯讀狀態）；任一成員可確認存活以重置計時。`GROUP` 隊伍另有**攻略與小工具**：管理員撰寫攻略模板綁定目標，隊員可開啟同步小工具（桌機浮動視窗／手機底部抽屜），狀態透過 WebSocket 即時同步。

**訪客互通**（ADR-0015）：未登入訪客可建立、申請、管理一般即時公開隊伍，與登入使用者雙向互通；登入後自動認領名下隊伍。快速隊伍（quick party）為訪客導向的輕量系統，詳見 [guest-mode-plan.md](guest-mode-plan.md)。

---

## 深入文件

- **後端規格書**：backend repo `docs/specs/party.md` — 隊伍類型與目標參照、狀態機、建立/申請/審核/踢出流程、席位規則、版本衝突、閒置 worker、訪客互通、排他鎖、列表與搜尋、聊天
- **API 參考**：backend repo `docs/api-reference/party.md`（含攻略/guide-state 端點與 widget 同步協定）
- **後端資料流**：backend repo `docs/data_flow.md` §3（各端點處理步驟）
- **前端行為**：frontend repo `docs/frontend-logic.md` §一/§三～§五（頁面/卡片/建立/編輯）、§1.3–1.4（攻略浮動視窗與小工具同步）、§六（WS 事件處理）
- **欄位範圍**：backend repo `docs/specs/field-ranges.md`（等級 1–200 等全域範圍）

### 相關 ADR

- [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md) — 訪客與登入帳號在一般即時隊伍的雙向互通與登入認領
- [ADR-0025](../decisions/0025-quick-party-guest-job-level-snapshot.md) — 快速隊伍訪客職業/等級快照
- [ADR-0029](../decisions/0029-party-card-type-chip-reinstated.md) — 隊伍卡片類型 chip
- [ADR-0030](../decisions/0030-guest-standard-party-my-party-visibility.md) — 訪客建立隊伍在「我的隊伍」的可見範圍
