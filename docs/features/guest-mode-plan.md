# 訪客模式 (Guest Mode)

**狀態**: 已實作（現況文件；2026-07-11 重寫整併歷史校正段落）

---

## 1. 現況總覽

OneShort 的訪客（未登入使用者）可在**不建立 Postgres 帳號**的前提下瀏覽、建立與參與即時公開隊伍。訪客身分完全以 `quick_guest_token` HttpOnly cookie + Redis TTL session 識別，不寫入任何匿名 PII 到 Postgres。

實際落地路線與最初 v1 規劃書（`internal/guest` package、`Principal{kind: actor|guest|anonymous}`、`guestProfileStore.ts`、`useIdentity()`）**不同**：那一版設計從未實作，`internal/guest`、`guestProfileStore.ts` 等命名也從未進入 git 歷史。實際上線的是既有的 **quick-guest（quick party）系統**，並由 [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md) 把同一套訪客身分機制擴展到「一般即時公開隊伍」。本文件只描述目前實際運作的行為。

---

## 2. 兩套隊伍情境下的訪客能力

訪客身分（`quick_guest_token` cookie）在兩種隊伍情境下運作方式不同：

| 隊伍情境 | 說明 | 主要端點前綴 |
|---|---|---|
| 快速隊伍（Quick Party，`is_quick=true`） | 原生訪客導向的輕量隊伍系統，自始支援訪客建立/加入/管理 | `POST /parties/quick`、`/parties/:id/quick-*` |
| 一般即時公開隊伍（Standard Immediate Party，`scheduled_at=null && guild_id=null && is_quick=false`） | 原本僅限登入 actor 使用；[ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md) 起訪客可建立、擔任隊長、申請、雙向互通 | `POST /parties/guest`、`/parties/:id/guest-*` |

兩者共用**同一個** `quick_guest_token` cookie 與訪客顯示資料快照機制（`guest_display_name`/`guest_job_class_id`/`guest_level`），只是端點與 Redis 資料結構分屬兩個系統；已登入使用者呼叫 `guest-*` 端點時會直接委派給對應的一般 actor 端點，行為等價。完整端點清單見 backend repo `docs/api-reference/party.md` 訪客一般即時隊伍互通章節。

---

## 3. 訪客身分與生命週期

- **識別**：`quick_guest_token` cookie（HttpOnly，24 小時有效，簽章），帳號不落 Postgres；資料以 Redis snapshot 呈現。
- **顯示快照**：`guest_display_name`（暱稱，必填）、`guest_job_class_id`/`guest_level`（選填，用於在隊伍卡片顯示職業/等級 pill，`level==0` 視為未設定）。
- **活動鎖**：訪客一次只能持有一場進行中的即時活動，Redis 鎖 `quick:guest:activity:{guestID}`，衝突回 `409`。
- **即時通知**：訪客的個人房通知可正常送達，沿用 quick party 既有的「以 token hash 導出 deterministic UUID」機制作為 WebSocket personal room id；訪客可讀取聊天室（`viewer_capabilities.can_read_chat`），但 visitor / pending guest 不可讀取或發言。
- **登入後認領**：`POST /api/v2/parties/guest-claim`（需認證）讀取 `quick_guest_token` cookie，把訪客名下的隊伍（一般即時隊伍與 quick party）身分改寫為目前登入使用者；每筆隊伍 best-effort、整體冪等可重試，成功後清除 cookie。前端於登入成功流程自動呼叫（`frontend/src/lib/auth/claimGuestParties.ts`）。

---

## 4. 一般即時隊伍訪客能力（ADR-0015 起）

| 能力 | 現況 |
|---|---|
| 訪客建立一般即時隊伍並自動擔任隊長 | `POST /parties/guest`；後端強制 `scheduled_at=null`、`guild_id=null`、`visibility=PUBLIC`、`is_quick=false` |
| 訪客申請一般即時隊伍（含申請登入者建立的隊伍） | `POST /parties/{id}/guest-applications`；雙向互通，訪客與 actor 互相皆可申請對方建立的隊伍 |
| 訪客申請有密碼保護的隊伍 | 支援，需正確 `join_password` |
| 訪客隊長管理（審核/踢人/關團/閒置確認/設定） | `/parties/{id}/guest-*` 系列端點，等價於對應的 actor 隊長端點 |
| 訪客聊天 | 支援（隊長與已加入成員；visitor / pending guest 不可讀取或發言） |
| 登入後自動認領 | `POST /parties/guest-claim` |
| `allow_quick_login_players` | 語意擴張為「允許未綁 Discord 的參與者（quick-login actor + 訪客）」，未新增獨立欄位 |
| 職業/等級顯示快照 | `guest_job_class_id`/`guest_level` 隨建立/申請一併保存，核准時原封不動套用到最終佔用的空位；不影響加入判斷 |
| 全站入口一致性 | Sidebar／MobileBottomNav 建隊選單、`/find` 申請入口一律比照共用判斷函式 `canApplyAsGuest`（`frontend/src/lib/partyDisplay.ts`），不各自維護判斷邏輯 |
| 「我的隊伍」可見範圍 | 訪客以隊長身分建立的一般隊伍，沿用既有單一 quick party session 機制記錄（`rememberQuickPartySession`），出現在 `MY_PARTY` 分頁；**訪客以成員身分加入他人隊伍時的可見範圍仍是已知後續，未涵蓋**（見 §6） |

仍維持的限制：guest 不建立 scheduled party / guild party；不新增匿名 Postgres 資料；未新增 `allow_guest_players` 欄位（語意改由既有 `allow_quick_login_players` 涵蓋）。

---

## 5. 程式碼對應 (Code Mapping)

程式碼位置已隨文件重整移至各 repo 自己的文件維護：

- **後端**：backend repo `docs/specs/party.md` 檔頭「路徑」段（訪客互通/快速隊伍相關檔案）與「訪客（未登入）互通」章節
- **前端**：frontend repo `docs/frontend-logic.md` §2.2A「訪客（quick-guest）相關程式碼對應」段

---

## 6. 目前範圍限制與已知後續

- 訪客不建立 scheduled party、guild party。
- 訪客不新增匿名 Postgres 資料（no PII persistence）。
- 未新增 `allow_guest_players` DB 欄位（語意併入既有 `allow_quick_login_players`）。
- 跨裝置還原訪客資料、訪客頭像、訪客資料長期保存、TTL 延長 UI：仍非目前範圍。
- **已知後續（[ADR-0030](../decisions/0030-guest-standard-party-my-party-visibility.md)）**：訪客以**成員**（非隊長）身分加入一般隊伍時，「我的隊伍」分頁的可見範圍尚未涵蓋，留待後續處理。

---

## 7. 決策依據

- [ADR-0014](../decisions/0014-guest-party-interop-frontend-ui.md)：訪客建立/申請/管理一般即時隊伍的前端 UI 實作（身分收集元件、建隊畫面、申請流程、隊長操作、成員訪客標籤）。
- [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md)：訪客帳號與登入帳號整合的核心決策——訪客可建立/申請/擔任一般即時隊伍隊長，登入時自動認領；推翻本文件原始 v1 規劃書的 Locked Decisions（互通性、聊天、`allow_guest_players` 相關條目）。
- [ADR-0016](../decisions/0016-guest-party-entry-point-parity.md)：訪客一般隊伍入口一致性修正，抽出共用判斷函式 `canApplyAsGuest`。
- [ADR-0025](../decisions/0025-quick-party-guest-job-level-snapshot.md)：快速隊伍訪客職業/等級快照的儲存決策（`FilledBy` 維持 nil、`TokenHash` 為唯一佔用真相來源、`QuickApplication` 補齊職業/等級欄位）。
- [ADR-0027](../decisions/0027-guest-mobile-create-submit-merge-resolution.md)：訪客手機版建立隊伍送出入口的分支合併決策（保留既有單一連續捲動修法，不採用獨立 4 步驟手機 wizard）。
- [ADR-0030](../decisions/0030-guest-standard-party-my-party-visibility.md)：訪客建立的一般隊伍加入「我的隊伍」可見範圍，沿用既有單一 quick party session 機制；明確排除訪客以成員身分加入的情境（留作已知後續）。
