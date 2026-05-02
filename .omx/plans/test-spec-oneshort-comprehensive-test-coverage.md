# Test Spec: OneShort Comprehensive Test Coverage

## Coverage Strategy

Layer tests by risk:

- Unit/API shape: fast validation of request payloads, hooks, state transitions, handler validation, usecase permissions.
- Integration: database/Redis/outbox/blocklist/application lifecycle invariants.
- E2E: user-visible flows that combine auth, pages, API, realtime, navigation, and UI state.

## P0 Tests

Frontend E2E:
- quick-login return/logout.
- create approval party -> applicant apply -> leader accept -> chat works.
- public party direct join.
- applicant cancel pending request -> leader reject later request.
- password party wrong/right password -> cached password across direct/list entry.
- home filters: tab/search/time/password/status/type.
- notification application unread -> bell -> party route -> read.
- party edit, close/read-only, hide/re-show.

Backend:
- blocklist handler validation and delegation.
- blocklist repository roundtrip.
- apply blocked by leader blocklist.
- partytarget SQL helper for BOSS/GROUP/TRAINING target parsing.
- activity exclusion tests use valid FK setup.

API Smoke:
- health, announcements, bug report, dev token, auth/me.
- quick-login leader/applicant.
- current-character update reflected by auth/me.
- create party, apply, review, notifications, blocklist, close party.

## P1 Tests To Add Next

Frontend E2E:
- NotificationBell accepted/rejected applicant result and click-through where UI supports it.
- Admin announcement create/update/delete and public announcement visibility.
- Bug report modal success and failure from UI if stable selector exists.
- Create-party UI pairwise for BOSS/GROUP/TRAINING if not already unit-covered enough.

Frontend Unit / Component:
- NotificationBell action/result rendering around accepted/rejected notifications.
- AdminPage announcement CRUD and blocklist unblock flows.
- BugReportModal validation/success/failure.
- `useCreatePartyPageModel` pairwise type/target/password/approval paths.

Backend:
- auth refresh / token rotation if implemented.
- duplicate create/apply idempotency where repository/usecase exposes deterministic behavior.
- outbox multi-consumer or worker lifecycle tests if uncovered by existing worker tests.

## P2 / Backlog

- Full mobile E2E for party creation/application if mobile selectors are stable and runtime budget allows.
- current-character UI selector E2E only after product exposes a switching control.
- External Discord OAuth E2E excluded; cover with backend usecase/integration and mocked UI/component tests.

## Verification Matrix

Backend:

```powershell
go build ./...
go test -tags unit ./...
$env:TEST_DATABASE_URL='postgres://oneshot:oneshot_e2e_password@127.0.0.1:15432/oneshort_e2e?sslmode=disable'
$env:REDIS_URL='redis://:oneshot_e2e_redis_password@127.0.0.1:16379'
go test -count=1 -p 1 -tags integration ./...
```

Frontend:

```powershell
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:api:e2e
npm run test:e2e
npm run test:e2e:mobile-smoke
```

Diff:

```powershell
git diff --check
```

