# Quick Party Approval Cancel Decision

## Context

Quick party approval rooms let a guest apply from an open slot before the host reviews the request. After the application is submitted, the UI must show the pending state, prevent applying to another slot, and allow the applicant to cancel their own pending application.

## Options

1. Frontend-only cancel state
   - Rejected: it would hide the pending UI without cancelling the backend `QuickApplication`, leaving the host review list and later joins inconsistent.

2. Reuse the normal party application cancel endpoint
   - Rejected: quick guests are identified by quick guest cookie and do not receive a public application id. The normal endpoint requires authenticated actor context and `{applicationId}`.

3. Add a quick-specific current-viewer cancel endpoint
   - Selected: `DELETE /api/v1/parties/{id}/quick-applications/me` lets the backend resolve the pending application from the quick guest token, cancel it, and return updated viewer capabilities without exposing token hashes or application ids.

## Verification

- Backend: quick usecase and handler tests cover cancellation by quick guest token.
- Frontend: API, mutation, and detail-view tests cover the cancel button and slot re-enable flow.
