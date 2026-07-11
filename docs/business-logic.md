# OneShort 商業邏輯文件（已遷移）

> 本文件原本描述後端各功能模組的核心商業規則、狀態機與判斷邏輯（認證流程、隊伍狀態機、席位規則、申請/審核邏輯、閒置 worker 生命週期、通知、管理員、全域欄位範圍等）。這些屬於 backend 實作細節，已依文件重整計畫**全數併入 backend repo 的各模組規格書**（`backend/docs/specs/*.md`），本檔僅保留為導引 stub，避免既有連結失效。請勿在此新增內容，直接維護對應的 backend 規格書。

## 各章節新位置

| 原章節 | 新位置 |
|---|---|
| 一、認證模組（登入流程、Token 機制、中間件驗證） | [`backend/docs/specs/auth.md`](../backend/docs/specs/auth.md) |
| 二、隊伍模組（類型、狀態機、建立、申請/審核、踢出、密碼、閒置 worker、訪客互通） | [`backend/docs/specs/party.md`](../backend/docs/specs/party.md) |
| §2.7A 角色資料同步 | [`backend/docs/specs/user.md`](../backend/docs/specs/user.md)「角色資料同步（CharacterDataSyncer）」 |
| 三、席位管理（席位規則、填充狀態、版本衝突） | [`backend/docs/specs/party.md`](../backend/docs/specs/party.md)「席位規則」「編輯隊伍的版本衝突」 |
| 四、通知模組（觸發事件、生命週期） | [`backend/docs/specs/notify.md`](../backend/docs/specs/notify.md) |
| 五、已移除模組與相關殘留設定 | [`backend/docs/specs/party.md`](../backend/docs/specs/party.md)「已移除與保留」 |
| 六、活動排他鎖（含訪客 Redis 鎖） | [`backend/docs/specs/party.md`](../backend/docs/specs/party.md)「活動排他鎖」「訪客（未登入）互通」 |
| 七、管理員功能 | [`backend/docs/specs/admin.md`](../backend/docs/specs/admin.md) |
| 八、OCR 截圖功能 | [`backend/docs/specs/user.md`](../backend/docs/specs/user.md)「附錄：OCR 截圖輔助」 |
| 九、Bug 回報功能 | [`backend/docs/specs/admin.md`](../backend/docs/specs/admin.md)「Bug 回報來源」 |
| 十、全域欄位範圍規範 §10.1（等級 1～200） | [`backend/docs/specs/field-ranges.md`](../backend/docs/specs/field-ranges.md) |
| 十、全域欄位範圍規範 §10.2（房間名稱全域搜尋） | [`backend/docs/specs/party.md`](../backend/docs/specs/party.md)「列表與搜尋」 |

端點清單見 [`backend/docs/features.md`](../backend/docs/features.md)；quick / guest 端點細節見 [`backend/docs/api-reference/`](../backend/docs/api-reference/)。
