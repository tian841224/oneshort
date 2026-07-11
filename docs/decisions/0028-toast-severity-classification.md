# ADR-0028: Toast 通知新增 warning 樣式並集中化錯誤嚴重度分類

- 狀態: Accepted
- 日期: 2026-07-10
- 相關模組: frontend / party / guild / auth
- 相關文件: frontend repo `docs/frontend-logic.md` §16

## 背景 (Context)

使用者要求評估全站提示訊息（toast）的樣式：像「已在其他快速隊伍中，請先離開目前隊伍。」這種**「目前狀態阻擋了操作，需要使用者先處理」**的訊息，應該用**警示樣式**（驚嘆號／琥珀色），不應該跟真正的系統錯誤（紅色）或操作成功（綠色）混用。

實際探查後發現這不只是「重新分類文案顏色」，而是牽涉三個既有架構缺陷：

1. **`warning` 樣式從未存在**：`Toast.tsx` 的 `TYPE_CONFIG` 只定義了 `success`/`error`/`info` 三種，`--os-warning`（`#C28B63`，已在 `globals.css` 定義）從未被 Toast 元件使用過。
2. **型別系統兩套不一致且會靜默吃錯訊息**：`lib/toast.ts` 的 `ToastType` 多了 `'party-boss' | 'party-training' | 'party-group'`，但 `Toast.tsx`／`ToastContainer.tsx` 完全不認得這些值——`ToastContainer.tsx` 的 `resolveType()` 遇到不認得的值一律 fallback 成 **`success`（綠色）**。實查全 repo，這三個值只有 `hooks/websocket/idleWarnings.ts` 的「閒置提醒」（隊伍即將被關閉的警示）在用作 toast type，其餘同名字串是測試用的 party id，無關——結果閒置提醒被系統誤判成綠色「操作成功」。
3. **三個畫面的 toast state 是裸 `string`，完全遺失 type**：`PartyDetailScreen.tsx`（`toast: string | null`）、`GuildsClient.tsx`、`AppShell.tsx` 三處都是這樣宣告，`<Toast>` 元件的 `type` prop 預設值是 `"success"`，代表這三個畫面**所有 toast（包含明確的失敗訊息，例如「解散隊伍失敗，請稍後再試」）畫面上都顯示綠色打勾成功樣式**。這是既有 bug，不是本次分類任務的副產品。

## 考慮過的方案 (Options Considered)

1. **只改文案分類，不動架構**——把使用者舉例的訊息硬改成看起來像警示的措辭，維持 `error`/`info` 二選一。
   維護性：差，無法區分「真失敗」與「阻擋前提」，未來新增類似訊息時判斷準則不明確。
   效能：無影響。
   安全性：無影響。
2. **新增 `warning` 變體 + 統一型別系統 + 修正 3 處字串 state bug + 每個呼叫點各自硬寫 `type`**——只解決樣式與型別問題，不做集中化 severity 判斷。
   維護性：中——修好了現有 bug，但 `API_ERROR_MESSAGES` 有約 90 個後端錯誤碼，各呼叫點各自判斷是否該顯示 `warning` 極易在日後新增 code 時遺漏或不一致。
   效能：無影響。
   安全性：無影響。
3.（採用）**新增 `warning` 變體 + 統一型別系統 + 修正 3 處字串 state bug + `API_ERROR_SEVERITY` 集中表**——後端錯誤碼的 severity 統一由 `errorMessages.ts` 的 `API_ERROR_SEVERITY: Partial<Record<string, 'warning'>>` 集中維護（未列出的 code 一律預設 `error`），`errors.ts` 提供 `getApiErrorSeverity(code)` 同步 helper；`decorateHttpError`（ky 全域 `beforeError` hook）額外把解析出的 `code` 同步掛在 `DecoratedHTTPError.code` 上，讓下游 `catch` 區塊不需要重新非同步解析 response body 就能查出 severity。
   維護性：優——新增後端錯誤碼時，severity 判斷只需要在一個地方（`API_ERROR_SEVERITY`）新增一行；呼叫端一律用同一個 pattern `showToast({ message: await getApiErrorMessage(error, fallback), type: getApiErrorSeverity((error as DecoratedHTTPError)?.code) })`。
   效能：`decorateHttpError` 本來就會解析一次 response body 取得 `displayMessage`，多存一個 `code` 欄位無額外網路/IO 成本。
   安全性：無影響——`code` 只是既有 `extractApiErrorCode` 邏輯的產出，沒有新增信任邊界。

## 決策 (Decision)

採用方案 3。具體作法：

- `frontend/src/lib/toast.ts`：`ToastType` 改為 `'info' | 'success' | 'warning' | 'error'`，移除臨時借用的 `'party-boss' | 'party-training' | 'party-group'`。
- `frontend/src/components/party/Toast.tsx`：`ToastType` 加入 `"warning"`，`TYPE_CONFIG` 新增 `warning: { icon: "alertTriangle", iconBg: "var(--os-warning)", iconColor: "white" }`；`frontend/src/components/design/icons.ts` 新增 `alertTriangle`（lucide `triangle-alert` path）。
- `frontend/src/components/party/ToastContainer.tsx`：`resolveType()` 改成 4 分支顯式判斷，未知值一律 fallback 成中性的 `info`（不再靜默變成 `success`）。
- `frontend/src/lib/api/errorMessages.ts`：新增 `API_ERROR_SEVERITY` 集中表，標記狀態衝突／阻擋前提類後端 code（如 `PARTY_ALREADY_IN_PARTY`、`PARTY_FULL`、`PARTY_REVISION_CONFLICT`、`GUIDE_STATE_CONFLICT` 等）為 `warning`；`PARTY_PASSWORD_REQUIRED`／`GUILD_PASSWORD_REQUIRED` 刻意不列入（維持既有紅字表單驗證慣例）。
- `frontend/src/lib/api/errors.ts`：新增 `getApiErrorSeverity(code?: string): 'error' | 'warning'`；`DecoratedHTTPError` 新增 `code?: string` 欄位，由 `decorateHttpError` 同步掛上，讓呼叫端不必再次 `await` 解析 body 才能查 severity。
- `PartyDetailScreen.tsx`／`GuildsClient.tsx`／`AppShell.tsx`（含 `AppShellContext`）三處 toast state 從裸 `string | null` 改為 `{ message: string; type: ToastType } | null`，所有 `setToast`/`setAppToast` 呼叫點依訊息語意明確指定 `type`。
- 全 repo（`FindPartyScreen`／`CreatePartyScreen`／`GuestCreatePartyScreen`／`useCreatePartyPageModel`／`useGuideStateMutation`／guild 各 section／`LoginEntryPanel`／`AccountScreen`／`claimGuestParties`／`httpErrorPolicy` 等）所有「操作沒壞掉但被目前狀態擋住」的訊息改為 `warning`（如 `quickPartyBlockedMessage`、樂觀鎖衝突自動同步提示、「隊伍欄位已滿」、「此角色已在同一隊伍中」），並統一改用 `getApiErrorSeverity` 取代逐點硬寫 `type: 'error'`。

## 理由 (Rationale)

- **安全性**：三個選項對安全邊界均無影響，非決策因素。
- **維護性**（優先順位次高，本案主要考量）：集中表比逐點硬寫更能長期維持一致性——後端新增錯誤碼時，前端只需要在 `API_ERROR_SEVERITY` 一處新增映射，不必逐一巡查所有呼叫點；`code` 同步掛在 decorated error 上也避免了「每個呼叫點各自重新 `await` 解析 body」的重複邏輯。
- **效能**：`decorateHttpError` 本就解析一次 body，新增 `code` 欄位是免費的；相較於方案 2 每個呼叫點各自 `await getApiErrorCode(error)`（重新 `.clone()` + `.text()` + `JSON.parse`），方案 3 少了不必要的重複 I/O。

## 被拒絕方案與原因 (Rejected Alternatives)

- **方案 1（只改文案）**：否決，因為無法解決「真失敗 vs 阻擋前提」的根本混淆，且不修正既有的 3 處字串 state bug（用戶回報的具體案例本身就是這個 bug 的受害者之一）。
- **方案 2（分類但不集中判斷 severity）**：否決，`API_ERROR_MESSAGES` 已有約 90 個 code，分散判斷極易在日後新增 code 時忘記標記或前後不一致，集中表 + 同步 helper 更利於長期維護。

## 影響 (Consequences)

- 所有透過 `showToast`／`Toast` 元件顯示的訊息現在有 4 種明確樣式，`ToastContainer` 不再有「未知值＝綠色成功」的靜默錯誤路徑。
- `DecoratedHTTPError` 新增 `code` 欄位是向後相容的擴充（原有消費者只讀 `displayMessage` 不受影響）。
- 新增後端錯誤碼時，若該碼屬於「阻擋前提／狀態衝突」語意，前端需要記得在 `API_ERROR_SEVERITY` 補登記，否則預設仍是 `error`（安全預設，不會誤判成過度樂觀的 `warning`）。
- frontend repo `docs/frontend-logic.md` §16 同步更新為 4 類型表格，並修正「`info` 是藍色」的既有文件錯誤（`info` 實際使用 `--os-primary` 金色，符合 `style.md §2` 禁止藍/青/紫當主色的規範）。

## Supersedes / Superseded by

無。
