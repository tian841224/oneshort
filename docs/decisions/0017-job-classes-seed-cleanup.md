# ADR-0017: `job_classes` 參考表殭屍列清理 —— 一次性 migration + `seedJobClasses()` 自帶清理語意

- 狀態: Accepted
- 日期: 2026-07-09
- 相關模組: backend / party / auth / user / guild
- 相關文件: docs/decisions/0016-guest-party-entry-point-parity.md（本次同批查出的三個問題之一，性質不同故獨立成 ADR）

## 背景 (Context)

使用者實測訪客建立隊伍功能，回報 `POST /parties/guest` 對合理輸入回傳 `400 PARTY_APPLICATION_VALIDATION_FAILED: guest_job_class_id is invalid`。

**根因**：`backend/pkg/jobclass/jobclass.go` 的職業 ID 編碼曾經歷一次改版——由早期的平鋪 `0–13` 編號，改為現行的分支編碼 `1xx`（戰士）/`2xx`（法師）/`3xx`（盜賊）/`4xx`（弓箭手）/`5xx`（海盜），`0`（初心者）在兩制中都存在、其餘 `1–13` 的舊制 id 已從 `jobclass.Names`（現行合法 42 個 id）移除。但 `backend/pkg/database/migrate.go` 的 `seedJobClasses()` 只做 `INSERT ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`，從未刪除已經不在 `jobclass.Names` 內的舊 id——本機 `job_classes` 表因此長年殘留舊制 `1–13` 這 13 筆殭屍列（同名不同 id，例如 id=1 與 id=113 都叫「黑騎士」）。`GET /job-classes` 端點不做任何過濾，把全部 55 筆（42 合法 + 13 殭屍）原樣吐給前端，讓 `useJobClasses`/`GuestProfilePrompt` 等職業選擇器可能讓使用者選到一個之後必定被 `jobclass.Valid()` 拒絕的殭屍 id。

**查證：`jobclass.Valid()` 的 7 個呼叫點**（`auth/usecase.go:105,649`、`user/usecase.go:31`、`guild/usecase.go:1324`、`party/usecase_guest_party.go:103`、`party/usecase_quick.go:1608,1649`）**全部只驗證「新輸入」**（註冊/建角色/改職業/訪客身分等請求體的新值），沒有任何一處會對「已存在角色」的既有 `job_class` 欄位重新驗證。

**查證：實際引用範圍**（直接對本機執行中的 `oneshort_db` 下查詢，非推測）：
- 只有 `parties.leader_guest_job_class`、`party_applications.applicant_guest_job_class`、`party_slots.filled_guest_job_class` 這 3 欄有 FK 指向 `job_classes(id)`（用 `pg_constraint` 直接查得，`0001_init.up.sql` 文字中宣告 `characters.job_class`/`party_slots.job_class` 的 FK 實際上在目前 schema 中並不存在），且截至查證當下這 3 欄引用殭屍 id 的筆數皆為 0。
- **`characters.job_class` 目前沒有 FK**，卻有 **98 筆**既存角色的 `job_class` 落在殭屍 `1–13` 區間（時間戳集中在秒級區間、名稱像自動產生的測試資料，例如「貓系船長582」，推測是某支舊 dev seed script 用舊制編號產生，與本次修正無關、屬於既存資料品質問題，不在本次清理範圍內處理——見「決策」第 4 點）。

## 考慮過的方案 (Options Considered)

### 方案 A：只寫一次性 SQL migration（`DELETE FROM job_classes WHERE id NOT IN (<42 個合法 id>)`）

- 維護性：差——若未來 `jobclass.Names` 再次改編號，同一類殭屍列會再次出現，需要有人記得再手寫一支新 migration；沒有從根本堵住問題模式。
- 安全性：migration 內容固定、可版控 review、up/down 語意明確可回滾。
- 效能：無影響（`job_classes` 僅 42–55 列）。
- 回滾難度：低（down migration 直接把捕捉到的 13 筆舊資料 `INSERT` 回去）。

### 方案 B：只讓 `seedJobClasses()` 自帶清理語意（upsert 迴圈後加 `DELETE FROM job_classes WHERE id NOT IN (目前 jobclass.Names 的 id)`，不新增 migration 檔）

- 維護性：最佳——`seedJobClasses()` 本來就在每次 `cmd/migrator`（對應 docker-compose `migrate` service，每次部署跑一次）、`cmd/seed`、以及 `internal/testutil` 的整合測試環境建置時執行，加上清理後即可自我修復；`jobclass.Names` 未來若再次改編號，下次部署即自動清乾淨，不需要人記得補一支 migration。
- 安全性：影響範圍是每次部署都會執行的路徑，需要更謹慎——若某個環境的 `job_classes` 有本機沒有的殭屍列被 3 個 FK 欄位實際引用，`DELETE` 會被 Postgres FK 約束擋下、整個 seed 步驟失敗（`RunGormAutoMigrate` 回傳 error、`cmd/migrator` 非 0 退出）；這是刻意設計成「失敗要響亮」而非靜默略過，但相對地沒有一次性、可 diff review 的清理紀錄。
- 效能：可忽略。
- 回滾難度：中——沒有版控快照可以直接 revert 回舊狀態，只能改回程式碼再重新部署一次讓它「補插回去」，且若程式碼裡沒保留舊名稱常數就完全回不去。

### 方案 C（採用）：兩者都做——方案 A 的一次性 migration ＋ 方案 B 的 `seedJobClasses()` 防禦性修正

- 維護性：最佳，migration 提供「這次具體清了什麼」的可 review 紀錄；`seedJobClasses()` 的持續清理則保證未來同一類問題不會再靠人工記憶去補救。
- 安全性：migration 是顯式、審查過的一次性動作，且比照既有 0046 的風格加了 `RAISE EXCEPTION` 安全閥（若 3 個有 FK 的欄位仍引用待刪 id 則中止，不靜默刪除）；`seedJobClasses()` 的持續清理則明確记录「部署到有真實使用者資料的環境前，必須重跑本次用的稽核查詢」作為前置條件（見下方「部署前置檢查」），把「不確定其他環境資料長什麼樣」的風險轉成一個可執行的檢查步驟，而非盲目信任。
- 效能：可忽略。
- 回滾難度：低（migration 有 down 可還原；`seedJobClasses()` 之後再跑也是 no-op，不會重複刪除已不存在的列，兩者疊加不衝突）。
- 唯一代價：比單一方案多寫一點程式碼（一支 migration + 一段 seed 函式邏輯），但兩者是同一份修法邏輯的兩層防護，價值大於成本。

## 決策 (Decision)

採用方案 C：

1. 新增 `backend/migrations/0047_prune_stale_job_classes.{up,down}.sql`：
   - `up`：先用 `DO $$ ... RAISE EXCEPTION` 檢查 `parties.leader_guest_job_class`／`party_applications.applicant_guest_job_class`／`party_slots.filled_guest_job_class` 是否仍引用 `1–13` 中任一 id，若是則中止整支 migration；否則 `DELETE FROM job_classes WHERE id = ANY(ARRAY[1..13])`。
   - `down`：把捕捉到的 13 筆舊制名稱（黑騎士、英雄、聖騎士、主教、火毒大法師、冰雷大法師、神箭手、神射手、夜行者、隱月、雙刀客、船長、火砲手）`INSERT ... ON CONFLICT DO UPDATE` 還原。
2. `seedJobClasses()`（`backend/pkg/database/migrate.go`）在既有 upsert 迴圈後新增一步：`DELETE FROM job_classes WHERE id NOT IN (<目前 jobclass.Names 的全部 id，透過同一個 `ids` slice 傳入>)`，讓這個已經在每次部署／整合測試建置時執行的 seed 函式，從「只增不減」變成「與 `jobclass.Names` 保持同步」。
3. **不處理** `characters.job_class` 現存的 98 筆殭屍值——這是獨立、既存的測試資料品質問題（無 FK、非本次症狀成因，`jobclass.Valid()` 不會對既存值重新驗證），任意猜測該幫這些角色改成哪個合法職業屬於武斷的業務決策，不在本次「清理參考表」的範圍內。
4. **部署前置檢查（強制）**：本次的 migration 與 `seedJobClasses()` 修正在合併回 `develop` 並準備部署到任何有真實使用者資料的環境（staging/production）前，**必須**重新對該環境的資料庫執行以下稽核查詢，並在部署記錄／PR 中附上結果：
   ```sql
   -- 1. 確認候選刪除 id 是否被任何有 FK 保護的欄位引用（應為 0，migration 的
   --    RAISE EXCEPTION 會擋下但仍建議部署前先手動確認，避免整個部署卡在
   --    migration 失敗）
   SELECT 'parties.leader_guest_job_class', count(*) FROM parties
     WHERE leader_guest_job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'party_applications.applicant_guest_job_class', count(*) FROM party_applications
     WHERE applicant_guest_job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'party_slots.filled_guest_job_class', count(*) FROM party_slots
     WHERE filled_guest_job_class BETWEEN 1 AND 13;

   -- 2. 資訊性查詢（非阻擋條件）：該環境是否也有 characters.job_class 落在
   --    殭屍區間的既存角色；若有且該環境有真實使用者（非本機測試資料），
   --    需要另外決定是否需要一個獨立的資料修復任務（不在本次範圍內）。
   SELECT count(*) FROM characters WHERE job_class BETWEEN 1 AND 13;
   ```
   若第一組查詢任何一筆 count > 0，**禁止**直接套用本次 migration，必須先另開任務處理該筆真實引用（例如透過應用層邏輯改指到合法 id）後才能重跑。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性優先**：方案 C 的 migration 部分有顯式 `RAISE EXCEPTION` 安全閥，不會在有真實引用時靜默刪資料；`seedJobClasses()` 部分則利用 Postgres 既有的 FK 約束作為第二層防線（若閥門被繞過或未來新增了會引用殭屍 id 的欄位卻忘了更新查詢，FK 仍會擋下 DELETE 並讓整個 seed 步驟明確失敗，而非悄悄留下不一致狀態）；额外要求部署前重跑稽核查詢，把「不確定其他環境資料」的不確定性轉成明確的人工前置檢查動作。
- **維護性**：`seedJobClasses()` 從「只增不減」改為「與 `jobclass.Names` 同步」，才是真正解決「upsert-only 的 reference-table seed 函式，遇到 enum 改編號就必然累積殭屍列」這個一般性模式，不是每次都要有人記得手寫新 migration。
- **效能**：`job_classes` 僅 42–55 列，DELETE 與既有查詢皆可忽略不計。
- 已用 `docker exec oneshort_db psql` 實際查詢驗證（非推測）：清理後 `job_classes` 從 55 筆變為 42 筆，僅殘留 `jobclass.Names` 定義的合法 id；`characters` 表 98 筆殭屍值原樣保留（本次刻意不動）。

## 被拒絕方案與原因 (Rejected Alternatives)

- **只寫一次性 migration（方案 A）**：無法防止未來 enum 再次改編號時同一類問題復發，把「保持參考表與 enum 同步」的責任錯放在人的記憶上而非程式碼裡。
- **只修 `seedJobClasses()`（方案 B）**：雖然能自我修復，但少了一份針對「這次具體清了哪些 id、原本叫什麼名字」的可版控、可 diff review 的變更紀錄，且純程式碼修正的回滾比 SQL migration 的 down 檔更麻煩（依賴程式碼裡是否還留著舊名稱）。
- **順便修正 `characters.job_class` 的 98 筆既存殭屍值（例如改指到最接近的合法 id）**：這是任意猜測業務語意的行為（「暴走騎士292」該對應哪個合法職業是主觀判斷，不是本次「清理參考表」議題該處理的範疇），且這些值目前完全無害（`jobclass.Valid()` 從不重新驗證既存值），貿然「修正」反而可能誤改使用者/測試資料的實際意圖；留給獨立任務視情況處理。

## 影響 (Consequences)

- **後端影響範圍**：`backend/migrations/0047_prune_stale_job_classes.{up,down}.sql`（新增）、`backend/pkg/database/migrate.go`（`seedJobClasses()` 新增清理步驟）。無 API 契約變更，`GET /job-classes` 回傳筆數由 55 降為 42（純粹移除本來就不該被選中的殭屍選項，不影響任何合法使用情境）。
- **已在本機驗證**：套用 migration + 重跑 `seedJobClasses()` 後（`go run ./cmd/migrator`），`job_classes` 僅剩 42 筆合法 id；`POST /parties/guest` 帶殭屍 id（如 `1`）仍正確回傳 400（因為 `jobclass.Valid()` 邏輯本身未變，`1` 本來就不合法，只是現在參考表也不會再誤導使用者選到它）；帶合法 id（`113`，黑騎士）則成功建立（`201`，`leader_guest_job: 113`）。
- **部署義務**：任何要把本次變更部署到有真實使用者資料的環境前，**必須**先執行「決策」第 4 點的稽核查詢，確認 3 個有 FK 保護的欄位皆無殭屍引用；`characters.job_class` 的既存殭屍值是否需要處理留給獨立任務評估，不阻擋本次部署。

## Supersedes / Superseded by

不推翻任何既有 ADR；與 ADR-0016（前端訪客入口一致性）同批查出但性質不同（本 ADR 是後端 seed/migration 資料完整性問題），故獨立成篇。
