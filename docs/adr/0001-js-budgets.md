# 0001 — JS budgets: honest measurement, overlays on demand

**Status:** accepted · 2026-10-11 (revised the same day: the interim ratchet is gone, every route meets §9)

## Context

FRONTEND_PROMPT §9 sets per-route JS budgets (gzipped): inbox ≤ 170 KB, public report ≤ 120 KB, dashboard ≤ 250 KB.
F4 requires them to be enforced. `pnpm size` pointed at `size-limit` with no config, so nothing was checked.

Next's "First Load JS" column under-reports App Router routes: it leaves out route-group layout chunks
(`(app)/layout`: shell, React Query, intl), which every phone still downloads. Measured honestly, the inbox
shipped ~232 KB, about 100 KB of which is the React/Next runtime.

## Decision

- `scripts/check-budgets.mjs` (`pnpm size`, run after `pnpm build`) measures each route as the union of its
  page and ancestor layout chunks, gzipped at level 9, plus the embed script (≤ 5 KB, §11). Routes §9 doesn't
  name get the 250 KB dashboard figure. Over budget fails the build.
- What brought the inbox from 232 KB to 168 KB:
  - **Overlays load on first use.** Header menus (account, client filter, notifications) render a look-alike
    button and fetch their Radix code on hover or focus, then mount already open on the first click
    (`useDeferredOverlay`). Controlled sheets and dialogs use `LazySheet`/`LazyDialog` (`shared/ui/lazy-overlays`).
    The lead side sheet mounts on the first `?lead=`.
  - **`toast` is a lazy wrapper** (`shared/lib/toast`): sonner loads on the first toast.
  - **Precompiled messages** (next-intl `experimental.messages.precompile`): the browser gets a format-only
    runtime without the ICU parser. Message files stay plain ICU JSON.
  - **Read queries are split from mutations** (`features/leads/api/queries.ts`). Webpack keeps every export of a
    shared module that any route uses, so a page that only reads was shipping all mutations and the offline queue.
  - The offline queue loads right after mount (`OfflineBanner`) instead of in the first-load bundle.

## Consequences

- New header/menu UI follows the same pattern: no static Radix import in anything the app shell or the inbox
  renders at first paint. Import primitives from their own module (`shared/ui/dialog`, …), not the `overlays`
  barrel, in first-load code.
- Hooks that only read go in `queries.ts`; anything that mutates stays in `hooks.ts`.
- The inbox has ~2 KB of headroom. The next lever, if it is needed, is `tailwind-merge` (~8 KB, behind every
  `cn()` call).
