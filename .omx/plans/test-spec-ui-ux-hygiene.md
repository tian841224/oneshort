# Test Spec: OneShort Frontend UI/UX Hygiene

## Per-Phase Verification
- `npm run lint`
- `npx tsc --noEmit`
- focused Vitest tests for changed behavior
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e:mobile-smoke`
- `npm run test:e2e`

## Targeted Assertions
- Confirm dialog replaces native `window.confirm` in destructive flows.
- Modal closes with Esc, traps focus, restores focus, and locks body scroll.
- Icon-only and destructive controls retain at least 44px hit targets.
- Navbar/dropdowns expose Esc close behavior and active-route state.
- Form submit buttons expose pending text and are disabled while submitting.
- Label text focuses the correct input/control.
- Empty states expose primary action buttons.
- Notification badge caps counts above 99 as `99+`.
- Reduced-motion mode disables marquee/ambient motion where planned.

## Evidence Requirements
- Read command output before marking a phase complete.
- If an E2E failure is unrelated baseline noise, document the exact failure and run a narrower proving test.
- Commit only after phase verification passes.
