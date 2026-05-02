# PRD: OneShort Frontend UI/UX Hygiene

## Goal
Complete the four-phase UI/UX hygiene sweep described in `UI_UX_OPTIMIZATION_PLAN.md` while preserving the existing cyber-noir visual identity.

## Scope
- PR1: P0 critical confirmation/modal/tap-target fixes plus P1.5 z-index and footer reachability.
- PR2: P1.1-P1.4 and P1.6 focus, type scale, label wiring, loading states, active route.
- PR3: P2 icon consistency, tokenized card/chip styling, empty states, hover layout-shift, cursor affordances.
- PR4: P3 skeletons, reduced-motion polish, notification badge cap.
- Final: code review, fix findings, re-verify.

## Out Of Scope
- Light mode.
- Route or information architecture redesign.
- New animation library.
- Visual primary color replacement.

## Acceptance Criteria
- No remaining `window.confirm` in `src`.
- Modal and confirm flows support Esc, focus trap/restore, scroll lock, and usable 44px controls.
- Form fields have visible focus and label/id wiring where applicable.
- Mutation buttons show pending text and prevent double submission.
- Interface emoji listed in the plan are replaced by Lucide-based reusable mapping.
- Empty states use clear primary actions.
- Loading states use skeletons where planned.
- Full verification passes after each phase before commit.
- Code review completes after all phases, review issues are fixed, and verification is rerun.
