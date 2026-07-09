# ADR-0017: `job_classes` 參考表殭屍列清理 —— 一次性 migration + `seedJobClasses()` 自帶清理語意

- 狀態: Accepted
- 日期: 2026-07-09（2026-07-09 reviewer 第一輪修正：FK 範圍更正為 6 條、殭屍角色資料處理方式定案）
- 相關模組: backend / party / auth / user / guild
- 相關文件: docs/decisions/0016-guest-party-entry-point-parity.md（本次同批查出的三個問題之一，性質不同故獨立成 ADR）

## 背景 (Context)

使用者實測訪客建立隊伍功能，回報 `POST /parties/guest` 對合理輸入回傳 `400 PARTY_APPLICATION_VALIDATION_FAILED: guest_job_class_id is invalid`。

**根因**：`backend/pkg/jobclass/jobclass.go` 的職業 ID 編碼曾經歷一次改版——由早期的平鋪 `0–13` 編號，改為現行的分支編碼 `1xx`（戰士）/`2xx`（法師）/`3xx`（盜賊）/`4xx`（弓箭手）/`5xx`（海盜），`0`（初心者）在兩制中都存在、其餘 `1–13` 的舊制 id 已從 `jobclass.Names`（現行合法 42 個 id）移除。但 `backend/pkg/database/migrate.go` 的 `seedJobClasses()` 只做 `INSERT ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`，從未刪除已經不在 `jobclass.Names` 內的舊 id——`job_classes` 表因此長年殘留舊制 `1–13` 這 13 筆殭屍列（同名不同 id，例如 id=1 與 id=113 都叫「黑騎士」）。`GET /job-classes` 端點不做任何過濾，把全部 55 筆（42 合法 + 13 殭屍）原樣吐給前端，讓 `useJobClasses`/`GuestProfilePrompt` 等職業選擇器可能讓使用者選到一個之後必定被 `jobclass.Valid()` 拒絕的殭屍 id。

**查證：`jobclass.Valid()` 的 7 個呼叫點**（`auth/usecase.go:105,649`、`user/usecase.go:31`、`guild/usecase.go:1324`、`party/usecase_guest_party.go:103`、`party/usecase_quick.go:1608,1649`）**全部只驗證「新輸入」**（註冊/建角色/改職業/訪客身分等請求體的新值），沒有任何一處會對「已存在角色」的既有 `job_class` 欄位重新驗證。

## FK 範圍更正（reviewer 第一輪審查抓出，本次修正）

**原始查證方法有瑕疵**：本 ADR 初版只對本機長駐的 `oneshort_db` container 執行 `pg_constraint` 查詢，得出「只有 3 欄有 FK 指向 `job_classes(id)`」的結論。reviewer 用一個全新的 Postgres 16 throwaway container，從零 `go run ./cmd/migrator` 重放全部 47 支 migration 後重新查 `pg_constraint`，發現**實際有 6 條 FK**：

| FK 名稱 | 欄位 | 本機 `oneshort_db`（drift 環境） | 全新重放環境（正確基準） |
|---|---|---|---|
| `parties_leader_guest_job_class_fkey` | `parties.leader_guest_job_class` | 存在 | 存在 |
| `party_applications_applicant_guest_job_class_fkey` | `party_applications.applicant_guest_job_class` | 存在 | 存在 |
| `party_slots_filled_guest_job_class_fkey` | `party_slots.filled_guest_job_class` | 存在 | 存在 |
| `characters_job_class_fkey` | `characters.job_class` | **缺失** | 存在 |
| `party_slots_job_class_fkey` | `party_slots.job_class`（注意：與 `filled_guest_job_class` 是不同欄位） | **缺失** | 存在 |
| `raid_registrations_job_class_fkey` | `raid_registrations.job_class` | **缺失** | 存在 |

**本機 `oneshort_db` 有無法解釋的 schema drift**：對全部 `migrations/*.sql` 逐檔 grep `DROP CONSTRAINT`，沒有任何一支 migration 檔案曾經刪除過這 3 條 FK（`characters_job_class_fkey`／`party_slots_job_class_fkey`／`raid_registrations_job_class_fkey`）；也查了 `0023_unify_character_profile_constraints`、`0024_actor_identity_phase1`（改動 `characters` 表最多的兩支 migration）的完整內容，均無相關線索。也確認 docker-compose 的 `migrate` service 呼叫的是同一支 `./migrator` 二進位、同一套 `RunGormAutoMigrate`，理論上不該產生差異。**成因目前不明**——可能是這個長駐 container 的資料卷（`backend_pgdata`）曾在某個時間點被人工介入（例如手動 `ALTER TABLE ... DROP CONSTRAINT` 做過某種操作但未寫進 migration、或用非本專案 migration 流程的方式初始化過），不影響本次任務判斷（已改依全新重放環境的 6 條 FK 為準），但值得另外排查，已記錄進專案記憶供未來調查（見 `~/.claude/projects/.../memory/`）。

**教訓**：驗證「這個變更是否安全」時，若只查一個長期存活、經歷過大量手動操作史的本機/開發環境，其 schema 可能已經偏離「照 migration 從零建置」的正確基準而不自知；比對結論務必至少用一個從零重放全部 migration 的乾淨環境交叉驗證，尤其是牽涉 FK／schema 完整性的判斷。

**查證：實際引用範圍（依全新重放環境的 6 條 FK 為準）**：
- 3 個「guest」欄位（`leader_guest_job_class`／`applicant_guest_job_class`／`filled_guest_job_class`）截至查證當下引用殭屍 id 的筆數皆為 0。
- `party_slots.job_class`、`raid_registrations.job_class`：本機截至查證當下引用殭屍 id 的筆數皆為 0。
- `characters.job_class`：**有 98 筆**既存角色的 `job_class` 落在殭屍 `1–13` 區間（時間戳集中在秒級區間、名稱像自動產生的測試資料，例如「貓系船長582」，推測是某支舊 dev seed script 用舊制編號產生）。**這 3 個欄位（`characters.job_class`／`party_slots.job_class`／`raid_registrations.job_class`）在乾淨環境確實有 FK 保護**，故不能再視為「無 FK、無需檢查」——本 ADR 初版對這點的判斷是錯的，已在下方「決策」更正。

## 考慮過的方案 (Options Considered)

### 方案 A：只寫一次性 SQL migration（`DELETE FROM job_classes WHERE id NOT IN (<42 個合法 id>)`）

- 維護性：差——若未來 `jobclass.Names` 再次改編號，同一類殭屍列會再次出現，需要有人記得再手寫一支新 migration；沒有從根本堵住問題模式。
- 安全性：migration 內容固定、可版控 review、up/down 語意明確可回滾。
- 效能：無影響（`job_classes` 僅 42–55 列）。
- 回滾難度：低（down migration 直接把捕捉到的 13 筆舊資料 `INSERT` 回去）。

### 方案 B：只讓 `seedJobClasses()` 自帶清理語意（upsert 迴圈後加 `DELETE FROM job_classes WHERE id NOT IN (目前 jobclass.Names 的 id)`，不新增 migration 檔）

- 維護性：最佳——`seedJobClasses()` 本來就在每次 `cmd/migrator`（對應 docker-compose `migrate` service，每次部署跑一次）、`cmd/seed`、以及 `internal/testutil` 的整合測試環境建置時執行，加上清理後即可自我修復；`jobclass.Names` 未來若再次改編號，下次部署即自動清乾淨，不需要人記得補一支 migration。
- 安全性：影響範圍是每次部署都會執行的路徑，需要更謹慎——若某個環境的 `job_classes` 有本機沒有的殭屍列被有 FK 的欄位實際引用，`DELETE` 會被 Postgres FK 約束擋下、整個 seed 步驟失敗（`RunGormAutoMigrate` 回傳 error、`cmd/migrator` 非 0 退出）；這是刻意設計成「失敗要響亮」而非靜默略過，但相對地沒有一次性、可 diff review 的清理紀錄。
- 效能：可忽略。
- 回滾難度：中——沒有版控快照可以直接 revert 回舊狀態，只能改回程式碼再重新部署一次讓它「補插回去」，且若程式碼裡沒保留舊名稱常數就完全回不去。

### 方案 C（採用）：兩者都做——方案 A 的一次性 migration ＋ 方案 B 的 `seedJobClasses()` 防禦性修正

- 維護性：最佳，migration 提供「這次具體清了什麼」的可 review 紀錄；`seedJobClasses()` 的持續清理則保證未來同一類問題不會再靠人工記憶去補救。
- 安全性：migration 是顯式、審查過的一次性動作，且比照既有 0046 的風格加了 `RAISE EXCEPTION` 安全閥（若有 FK 的欄位仍引用待刪 id 則中止，不靜默刪除）；`seedJobClasses()` 的持續清理則明確记录「部署到有真實使用者資料的環境前，必須重跑本次用的稽核查詢」作為前置條件（見下方「部署前置檢查」），把「不確定其他環境資料長什麼樣」的風險轉成一個可執行的檢查步驟，而非盲目信任。
- 效能：可忽略。
- 回滾難度：低（migration 有 down 可還原；`seedJobClasses()` 之後再跑也是 no-op，不會重複刪除已不存在的列，兩者疊加不衝突）。
- 唯一代價：比單一方案多寫一點程式碼（一支 migration + 一段 seed 函式邏輯），但兩者是同一份修法邏輯的兩層防護，價值大於成本。

## 決策 (Decision)

採用方案 C，內容依 reviewer 第一輪修正更新如下：

1. `backend/migrations/0047_prune_stale_job_classes.{up,down}.sql`：
   - `up`：`DO $$ ... RAISE EXCEPTION` 安全閥檢查**全部 6 個**有 FK 指向 `job_classes(id)` 的欄位是否仍引用 `1–13` 中任一 id——`parties.leader_guest_job_class`、`party_applications.applicant_guest_job_class`、`party_slots.filled_guest_job_class`、`characters.job_class`、`party_slots.job_class`、`raid_registrations.job_class`；任一命中則中止整支 migration，否則 `DELETE FROM job_classes WHERE id = ANY(ARRAY[1..13])`。
   - `down`：把捕捉到的 13 筆舊制名稱（黑騎士、英雄、聖騎士、主教、火毒大法師、冰雷大法師、神箭手、神射手、夜行者、隱月、雙刀客、船長、火砲手）`INSERT ... ON CONFLICT DO UPDATE` 還原。
2. `seedJobClasses()`（`backend/pkg/database/migrate.go`）在既有 upsert 迴圈後新增一步：`DELETE FROM job_classes WHERE id NOT IN (<目前 jobclass.Names 的全部 id>)`，讓這個已經在每次部署／整合測試建置時執行的 seed 函式，從「只增不減」變成「與 `jobclass.Names` 保持同步」。若刪除觸發任一 FK 違反，Postgres 會擋下並讓整個 seed 步驟明確失敗（第二層防線，見「理由」）。
3. **殭屍角色資料（`characters.job_class` 98 筆）的處理方式（本次定案，取代初版「不處理」的錯誤判斷）**：
   - **不在 migration 0047 內自動修復**——舊制 id 對應到現行 id 需要驗證「這個角色原本代表哪個職業」，這是業務資料語意判斷，不是 schema 變更；且部分舊制 id（`11`＝雙刀客/Dual Blade）在現行 42 個合法 id 裡**完全沒有對應職業**（現行分支編碼已不包含雙刀客這個分支），任何自動對應都是猜測，不應該放進每次部署都會自動執行的 migration。
   - 新增獨立、**不會被自動執行**的手動補救腳本 `backend/scripts/repair-stale-character-job-classes.sql`（不符合 golang-migrate 的 `*.up.sql`/`*.down.sql` 命名慣例，也不在 embed glob `*.up.sql` 範圍內，確保不會被 `seedJobClasses()`/`RunGormAutoMigrate` 意外撿到）：
     - 預設動作（保守、無需猜測）：把受影響角色的 `job_class` 重設為 `0`（初心者/Beginner）——這是唯一在新舊兩制下都保證合法的值。
     - 附錄提供「推測但未驗證」的舊制→現行 id 對應表（依名稱相似度與分支消去法推理，**非查證過的權威事實**，需要有 MapleStory 職業知識的人工複核後才建議採用），並明確標註 id=11（雙刀客）無對應目標。
     - 腳本頭部註解明確要求：先人工 `SELECT` 檢視受影響列，確認這批資料的實際性質（測試資料 vs 真實使用者）後再決定用保守預設還是自訂對應，才執行 `UPDATE`。
   - **本機 `oneshort_db` 目前仍未執行這支補救腳本**——本次驗證時我準備直接對本機這 98 筆執行保守預設（重設為 0）以便完整驗證 migration 0047 在本機也能跑通，但這個動作被 Claude Code 的自動模式分類器擋下（判定為「不可逆的本機資料變更，腳本本身要求先由人工審閱再執行，agent 不應自行執行」），故本機目前仍是「migration 0047 若重新對本機這 98 筆資料重放，會被新版安全閥擋下」的狀態——這是**正確且預期**的行為（見下方驗證段落），只是尚未執行補救。是否要對本機這 98 筆測試資料執行保守重設，或改用附錄的推測對應表，由使用者決定並自行執行 `backend/scripts/repair-stale-character-job-classes.sql`。
4. **部署前置檢查（強制，本次更新為完整 6 欄且部分改列為阻擋條件）**：本次的 migration 與 `seedJobClasses()` 修正在合併回 `develop` 並準備部署到任何有真實使用者資料的環境（staging/production）前，**必須對目標部署環境自己的資料庫**重新查一次 `pg_constraint`（不能沿用本機 `oneshort_db` 這個已知有 drift 的 container 的查詢結果——見上方「FK 範圍更正」），並執行以下稽核查詢：
   ```sql
   -- 0. 先確認目標環境實際的 FK 集合（不要假設等於本 ADR 列出的 6 條，
   --    每個環境都可能有自己的 drift）：
   SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS def
   FROM pg_constraint
   WHERE confrelid = 'job_classes'::regclass;

   -- 1. 阻擋條件：確認候選刪除 id 是否被任何有 FK 保護的欄位引用（應為 0）。
   --    這 3 個 guest 欄位過去查證皆為 0，但每個環境仍須重新確認：
   SELECT 'parties.leader_guest_job_class', count(*) FROM parties
     WHERE leader_guest_job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'party_applications.applicant_guest_job_class', count(*) FROM party_applications
     WHERE applicant_guest_job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'party_slots.filled_guest_job_class', count(*) FROM party_slots
     WHERE filled_guest_job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'party_slots.job_class', count(*) FROM party_slots
     WHERE job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'raid_registrations.job_class', count(*) FROM raid_registrations
     WHERE job_class BETWEEN 1 AND 13
   UNION ALL
   SELECT 'characters.job_class', count(*) FROM characters
     WHERE job_class BETWEEN 1 AND 13;
   ```
   **`characters.job_class` 現在也是阻擋條件**（本 ADR 初版誤判為「資訊性、非阻擋」，已更正）：若任一欄位 count > 0，**禁止**直接套用 migration 0047——它會被 migration 自己的 `RAISE EXCEPTION` 安全閥擋下（若 FK 存在，Postgres 原生 FK violation 也會擋，但沒有本次安全閥的訊息友善）。必須先審閱 `backend/scripts/repair-stale-character-job-classes.sql`、決定實際處理方式（保守重設或人工核實對應）並執行，確認上述查詢全部歸零後，才能重跑 migration 0047。
   - **golang-migrate 失敗後的操作備忘**：實測發現 migration 0047 若因安全閥 `RAISE EXCEPTION` 中止，`schema_migrations` 會被 golang-migrate 標記為 `version=47, dirty=true`（即使 Postgres 端 `DO $$` 區塊本身已正確 rollback、沒有殘留任何 partial 變更），需要用 `migrate force 46`（或程式內等效呼叫）先清除 dirty 旗標，才能在補救資料後重新嘗試。這是 golang-migrate 對「遷移執行失敗」的既有標準行為，非本次改動引入的問題，但建議寫進實際部署 runbook 以免臨場不知所措。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：

- **安全性優先**：方案 C 的 migration 部分有顯式 `RAISE EXCEPTION` 安全閥（現已涵蓋全部 6 個有 FK 的欄位），不會在有真實引用時靜默刪資料；`seedJobClasses()` 部分則利用 Postgres 既有的 FK 約束作為第二層防線；額外要求部署前對**目標環境自己**重跑稽核查詢（不信任任何單一長駐環境的歷史查詢結果），把「不確定其他環境資料／schema 是否已經偏移」的不確定性轉成明確的人工前置檢查動作。殭屍角色資料的修復刻意留在一支獨立、非自動執行的腳本，避免把未經驗證的業務語意猜測（尤其是 id=11 這種無合法對應目標的情況）悄悄烙進每次部署都會執行的路徑。
- **維護性**：`seedJobClasses()` 從「只增不減」改為「與 `jobclass.Names` 同步」，才是真正解決「upsert-only 的 reference-table seed 函式，遇到 enum 改編號就必然累積殭屍列」這個一般性模式，不是每次都要有人記得手寫新 migration。
- **效能**：`job_classes` 僅 42–55 列，DELETE 與既有查詢皆可忽略不計。
- **驗證方法論**：已用一個全新 Postgres 16 throwaway container 從零重放全部 47 支 migration，確認清理後 `job_classes` 從 55 筆變為 42 筆、6 條 FK 全部存在、`schema_migrations` 停在 `version=47, dirty=false`；另外在第二個 throwaway container 上模擬「`characters.job_class` 有既存殭屍引用」的真實情境，確認新版安全閥會正確中止 migration（`dirty=true`，需要 `force` 清除）、跑補救腳本後重試才成功——完整走過「阻擋→補救→成功」三個階段，而不只驗證「無違規時能跑通」的單一路徑。

## 被拒絕方案與原因 (Rejected Alternatives)

- **只寫一次性 migration（方案 A）**：無法防止未來 enum 再次改編號時同一類問題復發，把「保持參考表與 enum 同步」的責任錯放在人的記憶上而非程式碼裡。
- **只修 `seedJobClasses()`（方案 B）**：雖然能自我修復，但少了一份針對「這次具體清了哪些 id、原本叫什麼名字」的可版控、可 diff review 的變更紀錄，且純程式碼修正的回滾比 SQL migration 的 down 檔更麻煩（依賴程式碼裡是否還留著舊名稱）。
- **在 migration 0047 內自動修復 `characters.job_class` 的 98 筆既存殭屍值（例如自動改指到推測的對應 id）**：id=11（雙刀客）在現行 42 個合法 id 裡完全沒有對應職業，其餘對應也僅是依名稱相似度與分支消去法的推理、未經驗證，貿然自動套用有猜錯業務語意的風險；且把「猜測式資料修復」放進每次部署都自動執行的 migration，一旦猜錯會在不知情的情況下悄悄污染真實使用者資料。改採「獨立、非自動執行、需人工先審閱」的補救腳本，把最終判斷權留給人。
- **agent 直接對本機 `oneshort_db` 執行補救腳本，完整跑通本機驗證**：被 Claude Code 自動模式分類器擋下（判定為未經授權的不可逆本機資料變更），與腳本本身「需人工審閱後才執行」的設計意圖一致，故不強行繞過；改用兩個獨立 throwaway container 完整驗證整個「阻擋→補救→成功」流程，驗證強度不受影響，本機的實際補救留給使用者自行決定執行時機。

## 影響 (Consequences)

- **後端影響範圍**：`backend/migrations/0047_prune_stale_job_classes.{up,down}.sql`（安全閥範圍由 3 欄更正為 6 欄）、`backend/pkg/database/migrate.go`（`seedJobClasses()` 新增清理步驟，本輪未變）、新增 `backend/scripts/repair-stale-character-job-classes.sql`（獨立補救腳本，不自動執行）。無 API 契約變更，`GET /job-classes` 回傳筆數由 55 降為 42（純粹移除本來就不該被選中的殭屍選項，不影響任何合法使用情境）。
- **已驗證（兩個 throwaway container，皆非本機長駐 `oneshort_db`）**：
  1. 全新環境、無殭屍引用：`go run ./cmd/migrator` 全流程（47 支 migration + 3 個 seed 函式）成功，`job_classes` 42 筆，6 條 FK 全部存在，`schema_migrations` 為 `47/false`。
  2. 全新環境、模擬 `characters.job_class` 有既存殭屍引用（重現本機 98 筆的真實情境）：migration 0047 正確被新版安全閥擋下（`RAISE EXCEPTION`，訊息指向補救步驟），`schema_migrations` 變 `47/true`（golang-migrate 既有行為，非本次引入的問題）；`migrate force 46` 清除 dirty 後，跑 `repair-stale-character-job-classes.sql` 補救、再重試 migration，成功完成（`47/false`）。
  3. 對本機 `oneshort_db` 的真實 98 筆資料手動重放新版 `0047.up.sql`：確認會被 `characters.job_class` 安全閥正確擋下（證實新版安全閥對本機真實情境同樣有效）；**未**對本機執行補救腳本本身（見「決策」第 3 點）。
- **部署義務**：任何要把本次變更部署到有真實使用者資料的環境前，**必須**先對該環境自己執行「決策」第 4 點列出的完整 6 欄稽核查詢（不得沿用本機或本 ADR 列出的既有查詢結果）；`characters.job_class`（以及 `party_slots.job_class`／`raid_registrations.job_class`，若該環境也有既存引用）現在是**阻擋條件**，必須先執行 `backend/scripts/repair-stale-character-job-classes.sql`（審閱後決定實際處理方式）並確認歸零後，才能套用 migration 0047。
- **待辦（不阻擋本次任務，已記錄進專案記憶）**：本機 `oneshort_db` container 的 schema drift（3 條 FK 缺失、成因不明）值得獨立排查根因；本機 98 筆殭屍角色資料仍待使用者決定是否／如何執行補救腳本。

## Supersedes / Superseded by

不推翻任何既有 ADR；與 ADR-0016（前端訪客入口一致性）同批查出但性質不同（本 ADR 是後端 seed/migration 資料完整性問題），故獨立成篇。
