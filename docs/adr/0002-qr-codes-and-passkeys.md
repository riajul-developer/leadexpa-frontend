# 0002 — QR codes and passkeys in the browser (17.6)

**Context.** Setting up an authenticator app needs a QR code of an `otpauth://` link. Passkeys need
`navigator.credentials` plus a conversion between the API's JSON (base64url) and the browser's `ArrayBuffer`s.
The settings route has room in its budget (250 KB), but the app shell feeds the inbox, which has almost none
(≈167/170 KB).

**Decision.**
- **QR: `uqr` 0.1.3** (unjs, MIT, no dependencies, ~8 KB gzipped). We call its `encode()` for the module matrix
  and draw our own React `<svg>`, always dark on white so scanners can read it in dark mode too. We don't use its
  SVG string renderer, so there's no `dangerouslySetInnerHTML`. It is loaded with `import()` when a setup dialog
  opens. Alternatives:
  - `qrcode`: larger, and brings canvas/PNG code we don't need.
  - Server-rendered images: these would put the TOTP secret into an image URL or cache.

  Exit cost: one component.
- **WebAuthn: no library.** `shared/lib/webauthn.ts` uses `PublicKeyCredential.parse*OptionsFromJSON` and
  `toJSON()` when the browser has them. Otherwise it converts by hand (~40 lines). `@simplewebauthn/browser`
  would do the same for ~5 KB more. A dismissed prompt becomes `PasskeyCancelled`, which is not shown as an
  error.
- **Bundle placement.**
  - The agency gate (`MFAGate`) is `next/dynamic` from the app shell, so the inbox only pays for it when an
    agency withholds access.
  - The sign-in second step lives in `features/auth`: login budget, not the shell.
  - The lite app's second step is inline and code-only (no passkeys), to stay under the lite route's 120 KB.

**Consequences.** Passkeys can't be exercised in the MSW mock app (no real relying party). The Go integration
suite covers them with a software authenticator. Playwright's virtual authenticator could cover them against the
live backend later.
