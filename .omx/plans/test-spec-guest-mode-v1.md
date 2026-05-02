# Test Spec: Guest Mode v1

## Backend Unit Tests

- Guest token sign/verify accepts valid tokens and rejects tampered/expired tokens.
- Guest session usecase creates, reads, touches, and deletes Redis TTL state.
- Guest character validation enforces display name, job class, and level constraints.
- Optional principal resolves actor, guest, and anonymous correctly.
- Migrate helper validates actor token and guest cookie at the same time.
- Guest create validation rejects scheduled, guild, and password payloads.

## Backend Integration Tests

- Anonymous can read public party list/detail where allowed.
- Guest creates immediate public party and Redis contains session/profile/party/owner keys with TTL.
- Guest create does not insert anonymous guest profile or guest-owned party rows into Postgres.
- Actor sees guest-owned party and can apply with an owned/current character.
- Guest applying to actor-owned party returns expected v1 business 403.
- Successful guest migrate rewrites owned parties to actor leader/current character, clears guest Redis keys, and clears guest cookie.
- Existing actor create/apply/review, quick-login restriction, password party, scheduled party, and guild party paths remain unchanged.

## Frontend Unit / Component Tests

- `guestProfileStore` persists and clears guest profile state.
- `useIdentity()` returns actor, guest, or anonymous based on auth and guest state.
- `GuestEnrollDialog` validates required fields, job class, and level.
- Anonymous create flow opens `GuestEnrollDialog` before any party create request.
- Guest create flow omits actor-only fields and disables/hides scheduled/guild/password options.
- Guest attempting to apply to actor-owned party shows login prompt and does not call apply API.
- Login success migration clears local guest state only on success or known expired guest session.

## Frontend E2E / Browser Scenarios

1. Private browser opens `/`; party list/detail load without actor login.
2. Anonymous click create -> guest enroll dialog -> create immediate public party.
3. Guest-owned party appears in public list with player-facing guest badge and no UUID/status leakage.
4. Logged-in actor in another browser can find guest-owned party and apply/join.
5. Guest user logs in and migration changes party leader to actor/current character.
6. Guest localStorage state is cleared after successful migration.
7. Guest applying to actor-owned party is preflighted with login prompt and sends no application request.
8. Guest-owned party detail does not expose chat entry.

## Verification Commands

### Backend

```powershell
go build ./...
go test -tags unit ./...
pwsh -File .\scripts\test.ps1 -Suite all -NoCache
```

### Frontend

```powershell
npx tsc --noEmit
npm run test:api
npm run test:e2e
```

## Exit Criteria

- All planned stories are implemented or explicitly documented as intentionally deferred from v1.
- Fresh verification output is read before completion is claimed.
- Architect review passes after implementation.
- Deslop pass is scoped only to files changed in this Ralph session and followed by re-verification.
