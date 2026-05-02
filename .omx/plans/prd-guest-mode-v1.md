# PRD: Guest Mode v1

## Objective

Enable low-risk guest trial usage without reviving the removed legacy guest architecture. Guest users may browse public parties, create immediate public Redis-backed parties, and migrate owned guest parties into their actor identity after login.

## Non-Goals

- Guest application to actor-owned parties.
- Guest websocket personal rooms, notifications, or chat.
- Guest chat membership/history.
- Scheduled, guild, or password guest party creation.
- Anonymous guest data in Postgres.
- New `allow_guest_players` database behavior.

## User Stories

### US-001 Backend Guest Session Foundation

As an anonymous user, I can create and maintain a short-lived guest session and guest character so that I can try party creation without an actor account.

Acceptance criteria:
- `POST /api/v1/guest/session` sets a signed HTTP-only guest cookie and creates a Redis TTL session.
- `POST /api/v1/guest/character` validates the guest cookie and stores display name, job class, and level in Redis with TTL.
- `GET /api/v1/guest/me` returns guest state or anonymous-safe empty state without global auth errors.
- `DELETE /api/v1/guest/session` clears cookie and guest Redis state.
- Unit tests cover token parsing and Redis/session behavior.

### US-002 Optional Principal

As the backend, I can resolve actor, guest, or anonymous identity for selected public routes while strict actor auth remains unchanged.

Acceptance criteria:
- Introduce `Principal(kind=actor|guest|anonymous)`.
- Actor token wins for normal optional routes; guest cookie is checked only when no valid actor principal exists.
- Migrate route can validate actor token and guest cookie simultaneously.
- Existing actor-only routes still use strict `Auth()` behavior.

### US-003 Public Party Read and Guest-Owned Serialization

As an anonymous or guest user, I can read public party list/detail and see guest-owned parties without technical IDs leaking.

Acceptance criteria:
- `GET /api/v1/parties` and `GET /api/v1/parties/:id` allow anonymous/guest reads where v1 permits.
- Guest-owned Redis party responses include `is_guest_owned: true` and `leader_kind: "guest"`.
- Guest IDs are never exposed in list/detail responses.
- Password/guild/sensitive member-only behavior remains protected.

### US-004 Guest Immediate Party Creation

As a guest, I can create only immediate public non-password non-guild parties backed by Redis TTL.

Acceptance criteria:
- Guest create requires an existing guest character.
- Guest create rejects scheduled, guild, and password payloads with 422 business errors.
- Guest create writes party and owner index to Redis with TTL and no anonymous Postgres rows.
- Actor create behavior remains unchanged.

### US-005 Actor Applies To Guest-Owned Party

As an authenticated actor, I can apply to a guest-owned immediate party using my character.

Acceptance criteria:
- Actor applicant to guest-owned party is allowed.
- Guest applicant to actor-owned party is rejected locally/backend with a business 403.
- Guest applicant to guest-owned party remains unsupported in v1.
- Application/member serialization remains player-facing.

### US-006 Guest Login Migration

As a guest who later logs in, I can migrate my guest-owned parties to my actor current character.

Acceptance criteria:
- `POST /api/v1/guest/migrate` requires both actor token and guest cookie.
- Missing current character returns 409 and preserves guest state.
- Successful migrate changes owned guest parties to actor-owned immediate parties, clears guest Redis/session/profile/owner keys, and clears guest cookie.
- Response includes `migrated_party_ids`.

### US-007 Frontend Guest Identity and Enrollment

As an anonymous user, I can enroll a guest profile and the app can distinguish actor, guest, and anonymous identity.

Acceptance criteria:
- Add persisted `guestProfileStore` using localStorage key `oneshort-guest-profile`.
- Add `useIdentity()` returning actor, guest, or anonymous identity.
- Add `GuestEnrollDialog` using existing job class data and character constraints.
- App boot probes `/guest/me` without global 401/redirect/toast behavior.

### US-008 Frontend Guest Create / Apply / Detail Behavior

As a user, party create/list/detail actions match the current identity.

Acceptance criteria:
- Anonymous create opens guest enrollment first.
- Guest create locks to immediate public mode and hides/disables scheduled/guild/password-only options.
- Party cards/details show a guest-owned badge without technical IDs.
- Guest applying to actor-owned parties shows login prompt without sending the API request.
- Guest-owned parties do not show chat entry.

### US-009 Login Migration Integration

As a guest who signs in, my guest-owned party is migrated and guest local state is cleaned only after safe outcomes.

Acceptance criteria:
- Login success calls `/guest/migrate` when guest session exists.
- Successful migration clears guest store/cookie and shows a concise toast.
- 409 missing current character preserves guest state and prompts character selection.
- Expired guest session clears local guest state and continues normal login.

## Delivery Notes

- Keep backend and frontend branches/worktrees independent.
- Update docs/API references for new `/guest/*` and party response flags.
- Verification must include backend tests, frontend typecheck/unit tests, and browser/E2E coverage where practical.
