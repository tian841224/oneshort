# ADR-0027: 訪客建立隊伍手機版無法送出的修復方式取捨（`fix/guest-mobile-create-submit` 合併決策）

- 狀態: Accepted
- 日期: 2026-07-10
- 相關模組: frontend / party / auth
- 相關文件: docs/decisions/0020-mobile-step4-preview-visibility.md, docs/decisions/0022-guest-create-party-mobile-submit-entry.md

## 背景 (Context)

「訪客手機版無法觸及建立隊伍送出按鈕」這個 bug 被兩個獨立分支各自修過一次：

1. `fix/guest-mobile-create-submit` 分支（base 為尚未套用 ADR-0018 分步 wizard 重構前的舊 develop）：修法是替 `GuestCreatePartyScreen.tsx` 新增一套獨立的 4 步驟手機版 wizard（自己的 `StepDots` + portal 出的 `.os-mobile-wizard-footer`），比照 `CreatePartyScreen.tsx` 既有登入使用者的手機 wizard 機制。對應的 `tests/e2e/guest-party-interop.e2e.ts` 也新增了一個走完整個 4 步驟手機 wizard 的 `@mobile-smoke` 測試。
2. 同一時間，ADR-0020（`docs/decisions/0020-mobile-step4-preview-visibility.md`）已經用更簡單的方式修好了同一個 bug 的等價版本：不隱藏 `.os-create-mobile-step-preview`、手機版停止隱藏 `PreviewColumn` 自身的送出按鈕，讓手機版維持單一連續捲動版面（無額外 step 機制），並補上對應的即時瀏覽器回歸測試（`tests/e2e/mobile-layout.e2e.ts` 的「guest create-party mobile view shows the preview panel with a working submit button (ADR-0020 guest coverage) @mobile-smoke」）。

`fix/guest-mobile-create-submit` 合併回 `develop` 時，此時的 `develop` 已經內含 ADR-0018（桌機分步 wizard 重構）與 ADR-0020（手機單一捲動修復），出現兩個獨立分支各自修好同一個 bug、但採用不同 UI 架構的衝突。合併時需要決定：手機版最終要走「4 步驟獨立 wizard」還是「維持既有的單一連續捲動」。

## 考慮過的方案 (Options Considered)

1. **採用 `fix/guest-mobile-create-submit` 的獨立手機 4 步驟 wizard**：能重用 `CreatePartyScreen.tsx` 既有登入使用者手機 wizard 的既定模式，但會導致「手機 4 步驟 vs. 桌機 3 步驟（ADR-0018 合併後的步數，見 ADR-0023）」的步數不一致，且會重新引入 ADR-0022 自己就已標記為「接受但有風險的取捨」的約 80 行重複 footer/portal JSX（`GuestCreatePartyScreen.tsx` 自己再刻一份，而非重用 `CreatePartyScreen.tsx` 的既有機制）。
2. **維持 ADR-0020 已經上線的單一連續捲動修法，不採用 `fix/guest-mobile-create-submit` 的 wizard**（採用此方案）：bug 本身已經修好，且已有 `tests/e2e/mobile-layout.e2e.ts` 的真實瀏覽器回歸測試覆蓋（375/390/430 寬度，斷言只有一個可觸及的「建立隊伍」按鈕並能真正完成送出）。不需要額外的 step 機制，維持手機版版面單純。

## 決策 (Decision)

合併 `fix/guest-mobile-create-submit` 時，保留 `GuestCreatePartyScreen.tsx` 已上線的單一連續捲動手機版面（方案 2），不採用該分支新增的獨立 4 步驟手機 wizard。`fix/guest-mobile-create-submit` 分支對應在 `tests/e2e/guest-party-interop.e2e.ts` 新增的「a guest creates a standard party through the mobile step wizard @mobile-smoke」測試因此不適用於合併後的 UI（已不存在 `.os-mobile-wizard-footer` 給訪客用），予以移除，並在該處留下合併說明註解，指向本 ADR 與既有的 `tests/e2e/mobile-layout.e2e.ts` 等價覆蓋。

## 理由 (Rationale)

依 core.md §3.1 三大前提：

- **維護性**：避免手機/桌機步數不一致（4 步 vs. 3 步）造成的認知負擔與未來同步成本；避免重新引入 ADR-0022 已標記為風險的重複 footer/portal 實作，改為零額外機制的單一捲動版面。
- **效能**：不涉及效能考量。
- **安全性**：不涉及信任邊界變動。

主要驅動因素是「同一個 bug 已經有更簡單、已上線、已有回歸測試覆蓋的修法」，沒有理由疊加第二套更複雜的修法。

## 被拒絕方案與原因 (Rejected Alternatives)

- **採用 `fix/guest-mobile-create-submit` 的獨立手機 wizard（方案 1）**：步數與桌機不一致、重新引入已知風險的重複 JSX，且解決的是一個已經被 ADR-0020 修好的問題，屬於重複勞動。

## 影響 (Consequences)

- `tests/e2e/guest-party-interop.e2e.ts` 移除了走 4 步驟手機 wizard 的測試，該情境的等價回歸覆蓋由 `tests/e2e/mobile-layout.e2e.ts` 既有測試承接（未新增，本次合併只是確認並記錄該測試仍然涵蓋此 bug）。
- `GuestCreatePartyScreen.tsx` 的 `GUEST_CREATE_PARTY_STEP_COUNT` 維持既有的桌機 3 步驟語意，手機不新增獨立步數機制。
- 本 ADR 記錄的合併決策內容（含詳細取捨理由）已於合併當下寫入 `GuestCreatePartyScreen.tsx`（第 76-96 行一帶）與 `tests/e2e/guest-party-interop.e2e.ts` 的程式碼註解中；本文件是將該推理正式落地為 ADR，兩處程式碼註解原本標註的編號因與另一支並行分支（快速隊伍訪客職業/等級快照工作）已搶先使用 ADR-0025/0026，已同步改為指向本文件的 ADR-0027。

## Supersedes / Superseded by

不推翻任何既有 ADR；是 ADR-0018／ADR-0020／ADR-0022／ADR-0023 既有決策在一次分支合併中的自然延伸與正式記錄。

## 已知後續（2026-07-10，PR #90 code review 第三輪）

第 24 行記錄了 `tests/e2e/guest-party-interop.e2e.ts` 的 e2e 測試已在合併當下清理，但**遺漏了同一次合併留下的另一份孤兒測試**：`src/app/parties/create/_components/GuestCreatePartyScreen.test.tsx`（unit test）當時沒有同步更新，繼續斷言 `fix/guest-mobile-create-submit` 分支已被本決策否決的「獨立 4 步驟手機 wizard」（`StepDots`、`.os-mobile-wizard-footer` 等），而非合併後實際採用的「桌機 3 步驟 wizard + 手機單一連續捲動」（ADR-0018／ADR-0020）版面。這份孤兒測試因為斷言的 DOM 結構不存在而持續失敗，在 GitHub Actions CI 被發現並擋下 PR #90 的合併。已重寫 `GuestCreatePartyScreen.test.tsx` 4 個情境對齊目前實際行為（桌機 3 步驟走完送出、手機單一捲動送出、資料不完整時的欄位驗證），並抽出共用的 `flushGuestProfileHydration()` helper（`src/test/guestProfileHydration.ts`）消除該測試檔與 `FindPartyScreen.test.tsx`／`PartyDetailScreen.test.tsx`／`AppShell.test.tsx` 四處重複的 hydration 等待邏輯。不影響本 ADR 的架構決策，僅補記測試孤兒的完整清理範圍。
