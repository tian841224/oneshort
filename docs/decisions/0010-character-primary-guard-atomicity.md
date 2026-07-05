# ADR-0010: 角色刪除／停用的 primary 保護改為原子化 SQL 條件，並允許唯一角色停用

- 狀態: Accepted
- 日期: 2026-07-05
- 相關模組: backend / user (characters)
- 相關文件: docs/api-reference.md, docs/business-logic.md

## 背景 (Context)

backend PR #65（`fix(user): prevent deactivating or deleting the actor's primary character`，develop→master release PR）在 `internal/user/usecase.go` 的 `UpdateCharacter`／`DeleteCharacter` 新增規則：禁止停用或刪除 actor 目前的主要角色（`is_primary`）。Code review（4 個獨立 finder + 驗證）發現原始實作有兩個問題：

1. **TOCTOU 競態**：guard 是先呼叫 `GetCharacter` 讀出 `is_primary`（獨立一次 SELECT），檢查通過後才呼叫 `repo.UpdateCharacter` / `repo.SoftDeleteCharacter` 寫入（另一個獨立交易），中間沒有共用鎖或交易。`internal/auth.UpdateCurrentCharacter`（切換主要角色）會對 actor 的所有 character rows 下 `SELECT ... FOR UPDATE` 鎖，但 `user` 套件的讀取是不上鎖的 plain SELECT，兩者之間存在讀取與寫入不同步的視窗，理論上可能讓「寫入當下已是主要角色」的角色被停用。
2. **唯一角色永久卡死**：guard 對 `is_primary == true` 一律擋下，沒有檢查「actor 是否還有其他可設為主要的啟用中角色」。只有 1 個角色的 actor（依 `idx_characters_primary_per_actor` 與帳號建立流程，該角色必為 primary）會永遠無法停用或刪除自己唯一的角色，錯誤訊息「請先設定其他角色為主要角色」對這類使用者是無法達成的指示，且 `docs/business-logic.md`、`docs/features/*` 都沒有記載這是刻意的產品規則。

## 考慮過的方案 (Options Considered)

1. **維持 usecase 層 pre-check，改用 `SELECT ... FOR UPDATE` 鎖住 actor 全部 character rows**（模仿 `auth.UpdateCurrentCharacter` 的作法）：在 `user.usecase` 內開一個交易，鎖點所有角色列，讀 `is_primary`／統計其他啟用中角色數，通過後在同一交易內完成寫入。
   - 維護性：與 `auth` 套件現有模式一致，但需要把交易管理下推進 usecase 層，`Repository` 介面的交易邊界會變得不一致（部分方法自帶交易、部分由呼叫端管理）。
   - 效能：多一次全量鎖定 SELECT（涵蓋 actor 全部角色列），比只鎖目標列更悲觀。
   - 安全性：可正確關閉競態視窗。
2. **把 guard 條件折入既有 UPDATE 陳述式的 WHERE 子句，讓「檢查」與「寫入」變成同一個原子陳述式**（採用此方案）：`UPDATE ... WHERE id=$1 AND actor_id=$2 AND NOT (is_primary AND <正在停用> AND EXISTS(其他啟用角色))`，寫入本身已經隱含用該列的 row lock 序列化，只有在 0 rows affected 時才額外查一次區分「不擁有／不存在」vs「被 guard 擋下」。
   - 維護性：改動集中在 `repository.go` 既有的 `UpdateCharacter`／`SoftDeleteCharacter`，`usecase.go` 只需移除失效的前置檢查，介面與交易邊界維持原樣（`UpdateCharacter` 已有 `WithTx`，`SoftDeleteCharacter` 維持單一陳述式）。
   - 效能：happy path 不需要額外查詢；guard 觸發時才多一次診斷讀取。
   - 安全性：`UPDATE` 陳述式對目標列的鎖與 `auth.UpdateCurrentCharacter` 的 `FOR UPDATE` 鎖是同一張表同一列，Postgres 會自然序列化兩者，寫入時一定讀到最新已提交的 `is_primary`／其他角色狀態，不需要額外的跨套件鎖協議。
3. **拒絕方案：一律允許停用/刪除主要角色，交由前端或使用者自行承擔「暫時沒有主要角色」的狀態**：維護性最簡單，但違反 `idx_characters_primary_per_actor` 想維持的「至少要有明確主要角色可用」意圖，且會讓 `auth.SelectCurrentCharacter` 的容錯排序邏輯（`ORDER BY is_primary DESC`）長期依賴隱性 fallback，不建議。

## 決策 (Decision)

採用方案 2：

- `internal/user/repository.go` 的 `UpdateCharacter`／`SoftDeleteCharacter` 在 SQL `WHERE` 子句中加入 `NOT (is_primary AND <本次操作會停用> AND EXISTS(該 actor 其他 is_active=TRUE 的角色))`，使「是否阻擋」與「實際寫入」成為同一個原子陳述式。
- guard 只在「操作會讓角色從啟用變停用」且「actor 還有其他啟用中角色可接手 primary」時才擋下；若 actor 只有這一個啟用中角色，允許停用/刪除（不會被永久卡死）。
- 0 rows affected 時，用一次額外的 `EXISTS` 查詢（`diagnoseCharacterWriteBlock`）區分回傳 `ErrCharacterNotOwned` 還是 `ErrCharacterIsPrimary`，維持既有 API 錯誤碼语意不變。
- `internal/user/usecase.go` 移除呼叫端的 `is_primary` 前置檢查，改為單純轉發 repository 回傳的 sentinel error。
- 新增 `internal/user/repository_integration_test.go`（`//go:build integration`），以真實 DB 驗證：(a) 有替代角色時擋下停用/刪除、(b) 唯一角色時允許、(c) 只改其他欄位不受影響、(d) 與 `auth.UpdateCurrentCharacter` 併發競態下，actor 的主要角色永遠不會被停用（20 次迭代）。
- `docs/api-reference.md` 與 `internal/user/handler.go` 的 swagger 註解同步補上 `409 character_is_primary`，並重新執行 `swag init` 產生 `docs/docs.go`／`docs/swagger.json`／`docs/swagger.yaml`。

## 理由 (Rationale)

依 core.md §3.1 三大前提（安全性 > 維護性 > 效能）：
- **安全性優先**：方案 2 讓「檢查」與「寫入」在同一個陳述式內對同一列求值，天然利用 Postgres 的列鎖與 `auth.UpdateCurrentCharacter` 既有的 `FOR UPDATE` 鎖序列化，不需要新增跨套件鎖協議即可關閉原始 TOCTOU 視窗，安全性等同方案 1 但複雜度更低。
- **維護性**：改動範圍侷限在 repository 既有函式內，不需要調整 `Repository` 介面的交易邊界慣例；同時修正「唯一角色卡死」問題後，不需要另外設計「允許例外」的旁路 API。
- **效能**：happy path（未觸發 guard）不增加查詢；只有在 guard 擋下時才多一次診斷查詢，成本可接受。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 1（usecase 層鎖全部角色列）：安全性等價但需要重新設計交易邊界慣例、且鎖定範圍更大，維護成本高於方案 2，故不採用。
- 方案 3（一律允許停用/刪除主要角色）：放棄「actor 應隨時有明確主要角色」的不變量，可能讓 `auth` 端的 fallback 邏輯長期悄悄兜底真正的產品需求，不採用。

## 影響 (Consequences)

- API 契約新增 `409 character_is_primary`（僅在停用/刪除操作、且存在其他可替代角色時觸發），已同步更新 `docs/api-reference.md` 與 swagger 產物。
- 唯一角色的 actor 現在可以正常停用/刪除自己唯一的角色；若未來要禁止「actor 完全沒有角色」這個終態，需要另外設計（例如串接帳號刪除流程），不在本次決策範圍內。
- `internal/auth` 的 primary 切換行為未變動，本次修正只是讓 `internal/user` 端正確地與其序列化，不影響 `auth` 既有 API。

## Supersedes / Superseded by

無。
