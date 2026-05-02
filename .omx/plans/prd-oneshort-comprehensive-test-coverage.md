# PRD: OneShort Comprehensive Test Coverage

## Goal

以測試補強降低手動回歸成本，最大化覆蓋使用者在 OneShort 前後端會遇到的主要操作情境、失敗路徑、權限差異、即時通知與跨頁狀態。

## Non-Goals

- 不修改產品行為。
- 不修改公開 API contract。
- 不新增測試依賴或測試框架。
- 不用真實 Discord OAuth 第三方流程做外部 E2E。

## User Stories

### US-001: 玩家能安全登入、回訪與管理個人資料

Acceptance:
- quick-login 成功、回訪、登出有 unit/E2E 覆蓋。
- PIN 錯誤與成功都有 E2E 覆蓋。
- 角色新增、編輯、停用、刪除有 E2E 覆蓋。
- current-character 更新至少有 API smoke 覆蓋。

### US-002: 玩家能建立與尋找不同類型隊伍

Acceptance:
- BOSS / GROUP / TRAINING 建隊 model 或 E2E 覆蓋。
- 首頁 tab、搜尋、時間、條件、狀態、類型篩選有 E2E 覆蓋。
- 密碼隊伍錯誤、正確、跨入口快取有 E2E 覆蓋。
- 公開隊伍直接加入與審核隊伍申請/接受/拒絕/取消有 E2E 覆蓋。

### US-003: 隊長與隊員能在隊伍生命週期中收到一致回饋

Acceptance:
- NotificationBell 至少覆蓋申請通知、接受/拒絕結果、導頁與已讀。
- 聊天室核心收訊有 E2E 覆蓋。
- 隊伍隱藏、重新顯示、解散或關閉唯讀有 E2E 覆蓋。
- 後端 worker / repository 針對 idle、outbox、Redis immediate 狀態有 unit/integration 覆蓋。

### US-004: Admin 能管理公告與封鎖資料

Acceptance:
- 非 admin 被擋、admin 進 dashboard 有 E2E 覆蓋。
- 公告 CRUD 至少有 unit/API smoke 或 E2E 覆蓋。
- blocklist handler/usecase/repository roundtrip 有後端測試。

### US-005: Bug 回報能被使用者提交且錯誤可被看見

Acceptance:
- BugReportModal 成功、失敗、表單驗證有 unit/component 覆蓋。
- API smoke 覆蓋 public bug report submit。
- 如 UI 入口穩定，補 E2E 成功/失敗。

## Quality Gates

- Backend: `go build ./...`, `go test -tags unit ./...`, integration with explicit `TEST_DATABASE_URL` and `REDIS_URL`.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run test:api:e2e`, `npm run test:e2e`, `npm run test:e2e:mobile-smoke`.
- Diff hygiene: `git diff --check`.
- Document coverage updates in `frontend/docs/e2e-scenarios.md`.

## Risks

- Full cross-product E2E can become slow or flaky; use desktop full suite plus mobile smoke instead of full mobile suite.
- Rate limits may appear during full E2E; tests should prefer deterministic API seeding and stable locators.
- `gcc` may be missing on Windows, blocking race test.

