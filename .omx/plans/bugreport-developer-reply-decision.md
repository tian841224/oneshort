# Bug Report Developer Reply Public List Decision

## Decision

Expose `developer_reply` on the public `GET /api/v1/bug-reports` list payload and render it in the existing bug report modal list when present.

## Rationale

Users submit and later revisit bug reports through the same public modal list, so the reply must travel through that list contract. Keeping the existing endpoint avoids a second public lookup path while preserving the privacy boundary: `contact` and `user_id` remain hidden.

## Alternatives Considered

- Frontend-only rendering: rejected because the current public payload does not contain `developer_reply`.
- New public detail endpoint: rejected because the modal list already fetches the latest reports and a second endpoint would add unnecessary API surface for this read-only summary need.

## Verification Plan

- Backend unit test proves the public list includes `developer_reply` and still omits `contact` and `user_id`.
- Frontend unit test proves the modal displays the reply.
- E2E fixture proves a refreshed modal list can show the reply alongside the report content.
