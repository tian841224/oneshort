# 公會系統 (Guild System)

> **狀態**：現行功能。Guild 模組已於 2026-04-28 重新導入，後端實作位於 `internal/guild/`，前端入口位於 `/guilds`。本檔僅為高層功能總覽；實作規格一律以下方「深入文件」為準。

---

## 功能總覽

公會是玩家的長期社群單位：任何玩家可瀏覽公開公會列表、建立公會，並透過 OPEN（直接加入）、APPROVAL（幹部審核）、PASSWORD（密碼驗證）三種模式加入，一個帳號同時只能屬於一個公會。公會角色分為 LEADER / OFFICER / MEMBER：成員可使用公會主頁、聊天室、公告、成員列表與個人配對偏好；幹部與會長可審核入會、管理公告、執行自動配對；會長可修改設定、人數上限、升降幹部、踢人、轉讓會長與解散公會。管理員後台可列出公會並強制解散。

公會擁有**公會限定隊伍**：複用既有 party 流程，但只有公會成員可見、可申請、可操作，公開隊伍列表不會出現這些隊伍；幹部與會長可代為管理公會底下的所有隊伍。

**BOSS 自動配對**讓公會以週為單位自動組隊：成員填寫自己偏好的 BOSS、時段與可參戰角色，幹部即可試算（dry-run）、產生配對草案並確認生成公會隊伍，也有排程（cron）自動配對；每位成員可在公會首頁的個人行事曆看到自己被指派的隊伍。

---

## 深入文件

- **後端規格書**：[backend/docs/specs/guild.md](../../backend/docs/specs/guild.md) — 領域實體、角色權限矩陣、加入模式、公會限定隊伍規則、成員偏好、自動配對演算法與週期、行事曆、即時事件與錯誤碼
- **API 參考**：[backend/docs/api-reference/guild.md](../../backend/docs/api-reference/guild.md)
- **後端功能索引**：[backend/docs/features.md](../../backend/docs/features.md)
- **前端文件索引**：[frontend/docs/README.md](../../frontend/docs/README.md)

### 相關 ADR

- [ADR-0011](../decisions/0011-guild-preference-auto-schedule-persistence.md) — 公會成員偏好正規化在無 BOSS/時段選擇時不再誤丟 `auto_schedule`
- [ADR-0031](../decisions/0031-guild-settings-button-visibility.md) — 公會詳情頁「設定」入口改為主分頁列常駐分頁（僅幹部可見，不藏在次要選單後）
