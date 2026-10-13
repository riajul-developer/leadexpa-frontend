# 0003 — Leadexpa brand, light-only theme

**Context.** The product is called **Leadexpa** ("Every lead. More revenue."). The logo
(`assets/brand/leadexpa-original.png`) has a maroon swoosh and arrow, bronze bars and a gold ring. The UI used to be
blue with a light/dark/system theme switch.

**Decision.**
- **Assets come from one script.** `node scripts/gen-assets.mjs` takes the original logo and builds:
  - `public/brand/leadexpa-logo.png` (the lockup, 720 px wide) and `leadexpa-mark.png` (the mark, 160 px);
  - the favicon (`icons/icon.svg`), the PWA icons (normal and maskable) and `apple-touch-icon.png`, all on ivory.

  The original sits on a light grid. The script drops light, near-grey pixels, since every logo color is saturated.
- **Components.** `shared/ui/brand.tsx` has `BrandLogo` (the auth pages), `BrandMark` (the sidebar) and
  `BrandWordmark` (onboarding). The name and tagline live in `shared/config/brand.ts`.
- **Palette** (`globals.css`). Warm ivory background. Primary is maroon `#7a1a12` (hover `#64140c`). Accent is
  bronze `#a56f29`, with `accent-strong` `#84561c` for small text. Gold is `#ebc07a`. Status colors are retuned to
  sit with these. Every text color reaches at least 4.5:1 on bg, surface and surface-2. Bronze and gold are used
  only for fills, large type and decoration. `--brand-rule` is the maroon → bronze → gold line (card tops, the
  sidebar divider).
- **Light-only.** The theme preference, its menu control and the dark tokens are removed. `<html data-theme="light">`
  is static, so the pre-paint theme script and its CSP nonce are gone. A dark OS preference still gets the light
  theme (e2e `a11y.spec.ts`).
- **What keeps the old name.** Technical identifiers customers already depend on keep "Recov": `X-Recov-*` webhook
  headers, the embed's `data-recov-*` attributes and `window.Recov`, and the `recov-prefs` storage key.

**Consequences.** A new logo means running the script with a new original. Bringing dark mode back would need a dark
token set designed for the maroon/gold palette, not the old blue one.
