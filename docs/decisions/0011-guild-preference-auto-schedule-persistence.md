# ADR-0011: 公會成員偏好 auto_schedule 於無 BOSS/時段選擇時遭靜默丟棄的修正

- 狀態: Accepted
- 日期: 2026-07-06
- 相關模組: backend / guild
- 相關文件: docs/features/guild.md

## 背景 (Context)

會員在 `/guilds/:id/me/preferences`（前端 `MyPreferencesPanel.tsx` 的「每週配對模式」切換）將某角色切換為「手動確認」（`auto_schedule=false`）後儲存，若當下該角色**尚未勾選任何 BOSS、也尚未勾選任何時段**（例如新加入的角色，或使用者只想先關閉自動配對、之後再選 BOSS/時段），該次儲存實際上不會生效：離開頁面再回來，設定會跳回「自動」。

根因定位於 `backend/internal/guild/usecase.go` 的 `normalizeCharacterPreferenceInput`：

```go
bossIDs := uniqueUUIDs(draft.bossIDs)
timeSlots := uniqueInt16s(draft.timeSlots)
if len(bossIDs) == 0 && len(timeSlots) == 0 {
    continue // 整筆角色偏好（含剛設定的 AutoSchedule）被丟棄
}
```

這段判斷原意是避免把「完全未觸碰過的角色」寫入一筆空白的 `character_preferences` 記錄，但沒有考慮到「使用者只改了 `auto_schedule`、未選 BOSS/時段」這個合法情境，導致整筆記錄（含剛設定的手動模式）在寫入 DB 前就被捨棄。前端讀取時對找不到記錄的角色套用 `pref?.auto_schedule ?? true`（opt-out 語意，預設自動），因此使用者觀察到的現象就是「手動模式儲存後跳回自動」。

前端 Save 流程與 SQL upsert 層本身沒有問題：`auto_schedule` 確實有包含在 PUT payload 中送達後端，`repository_preferences.go` 的 `UpsertPreference` 也正確地將 `character_preferences` JSONB 整欄寫入；問題純粹發生在 SQL 執行之前的 usecase 正規化階段。

## 考慮過的方案 (Options Considered)

1. **調整正規化的跳過條件，改為僅在「完全沒有任何欄位」時才跳過**（本次採用）
   - 具體作法：`if len(bossIDs) == 0 && len(timeSlots) == 0 && draft.autoSchedule == nil { continue }`，即只有當 BOSS、時段、`auto_schedule` 三者都缺席（代表這個角色從未被觸碰）時才捨棄；只要 `auto_schedule` 有明確值（true 或 false），即使 BOSS/時段皆空也保留該筆記錄。
   - 維護性：改動集中在單一守門條件，語意清楚（「完全空白才丟棄」），不需要新增欄位或改變資料結構。
   - 效能：無影響，純邏輯判斷。
   - 安全性：無影響；`requireOwnedPreferenceCharacters` 仍會驗證角色歸屬。

2. **前端在儲存時為每個角色的 payload 帶入 sentinel 值（例如強制帶一個假的 boss/時段）以避免被判斷為空**
   - 維護性：這是治標不治本的解法，把後端邏輯缺陷轉嫁成前端要記得填充假資料，未來任何呼叫此 API 的用戶端都要重複繞開同一個陷阱，屬於隱性耦合。
   - 效能：無顯著差異。
   - 安全性：無直接風險，但假資料可能污染實際的 BOSS/時段清單語意，需要後端額外過濾，反而增加複雜度。
   - 判定：拒絕。治標不治本，且會讓「假資料 vs 真實選擇」的邊界變得模糊。

3. **移除跳過邏輯，一律持久化所有角色的偏好記錄（即使三個欄位都空）**
   - 維護性：語意最單純，但會讓從未設定過任何偏好的角色也產生一筆全空記錄，污染 `character_preferences` JSONB 與後續配對邏輯需要額外處理「全空記錄」的情境。
   - 效能：略增加儲存的記錄數量（可忽略）。
   - 安全性：無影響。
   - 判定：拒絕。沒有必要為了修正這個 bug 而放寬既有「避免空白角色記錄」的設計意圖，方案 1 已能精準修正、不影響原意圖。

## 決策 (Decision)

採方案 1：在 `normalizeCharacterPreferenceInput` 的跳過條件加入 `draft.autoSchedule == nil` 檢查，只有當 BOSS、時段、`auto_schedule` 三者皆缺席時才捨棄該角色的偏好記錄。

## 理由 (Rationale)

依 core.md §3.1 三大前提：
- **安全性**：無變動，角色歸屬驗證（`requireOwnedPreferenceCharacters`）邏輯未受影響。
- **維護性**：修正範圍最小且語意精確對應原設計意圖（避免完全空白的角色記錄），不需要新增資料結構或前端配合行為。
- **效能**：無影響。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 2（前端 sentinel 值）：把後端邏輯缺陷轉嫁給前端，屬於治標不治本且會製造假資料語意混淆，見上方判定。
- 方案 3（移除跳過邏輯）：放寬過頭，會讓從未設定過偏好的角色也產生空白記錄，增加下游（配對邏輯、前端顯示）需要額外處理「全空記錄」的負擔。

## 影響 (Consequences)

- `backend/internal/guild/usecase.go` 的 `normalizeCharacterPreferenceInput` 修改一行判斷條件。
- 新增單元測試 `TestUseCaseGuildRuntimeInputs/preference_update_persists_auto_schedule_toggle_with_no_boss_or_time-slot_selected`（`backend/internal/guild/usecase_flow_test.go`），驗證只設定 `auto_schedule`、未選 BOSS/時段時仍會被持久化。
- 不影響 API 契約（欄位、路由皆未變動），不需更新 Swagger。
- 前端無需修改；`MyPreferencesPanel.tsx` 的讀取邏輯（`pref?.auto_schedule ?? true`）維持不變即可正確反映後端持久化後的狀態。

## Supersedes / Superseded by

無。
