# cms (fe-user plugin)

Renders CMS pages, layouts, and widgets fetched from the backend CMS API.

## Routes

| Path | Component |
|------|-----------|
| `/:slug` | CMS page renderer (dynamic slug at root) |

## Store

`src/stores/useCmsStore.ts` — fetches categories, pages, layouts, styles, and widget assignments.

## Key components

- `CmsLayoutRenderer.vue` — renders a full layout with widget areas
- `CmsWidgetRenderer.vue` — dispatches to html/menu/slideshow/vue-component widgets

## Cookie Consent widget (GDPR/DSGVO)

A `vue-component` widget (`CookieConsent`, registered in `index.ts`) that an admin
drops into any layout area — placement is the mount trigger. The component
**Teleports a full-screen consent overlay to `<body>`**, so its layout area is
irrelevant.

- `src/components/CookieConsent.vue` — the overlay UI. **Layer 1**: equal-prominence
  **Accept all / Reject all / Customize** + a privacy-policy link. **Layer 2**:
  per-category toggles (`necessary` locked on) + **Save my choices**. After a
  decision a persistent **Cookie settings** affordance re-opens it; it also
  listens for a `vbwd:open-cookie-consent` window event (decoupled menu re-open).
- `src/consent/useConsent.ts` — the single source of truth: versioned, withdrawable
  decision persisted to `localStorage` (`vbwd_cookie_consent`). Bump
  `config.consent_version` to re-prompt everyone. This is the upgrade seam to a
  server-side consent record.
- `src/consent/consentMode.ts` — **Google Consent Mode v2** bridge. Emits the
  all-denied default early (queued to `dataLayer` even before `gtag`), then maps
  our four buckets → signals on decision (`statistics→analytics_storage`,
  `marketing→ad_*`, `preferences→functionality/personalization_storage`). Non-gtag
  consumers can read `granted(cat)` or listen for `vbwd:consent-changed`.
- `src/consent/policy.ts` — storage key, category vocabulary, typed record shape.

**Compliance posture:** strictly-necessary flows (login/cart/checkout) are never
gated — consent gates cookies/scripts via Consent Mode, not routes. The admin
"CSS" tab (`config.css`) is injected on mount for per-widget style overrides; the
default UI uses only `vbwd-fe-core` design tokens (`var(--vbwd-*)`).

---

## Related

| | Repository |
|-|------------|
| 🖥 Backend | [vbwd-plugin-cms](https://github.com/VBWD-platform/vbwd-plugin-cms) |
| 🛠 Frontend (admin) | [vbwd-fe-admin-plugin-cms](https://github.com/VBWD-platform/vbwd-fe-admin-plugin-cms) |

**Core:** [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)
