# Family Travel Coordinator

A mobile-first website for ~30 family groups to register their travel for a 60th-birthday celebration
in Bidar (16–19 Oct 2026). One organiser hires vehicles to fit arrivals/departures, assigns drivers,
and confirms by email. **Guests never pay** — no cost is ever shown to families.

Stack: **Astro (SSR) + TypeScript** on **Netlify** with **Netlify Blobs** (one JSON document per
family). Email via **Resend**. See `PRD.md` (spec), `DEVELOPMENT_PLAN.md` (build order),
`RESUME.md` (current state), `UAT-FINDINGS.md` (UAT issues + fixes).

## Run it

```bash
npm install
npm run dev      # http://localhost:4321  (local-file store under .data/)
npm run build    # verify the Netlify build
npm test         # vitest unit/integration suite
npm run seed     # fill the local file store with fake families
npm run gen-hash -- "passphrase"   # make an ADMIN_PASSWORD_HASH
```

Deploy is **GitHub → Netlify CI/CD**: pushing `main` auto-deploys to https://bidarplan.netlify.app.

## Environment variables

Copy `.env.example` → `.env` for local dev; set the real values in the Netlify dashboard for prod.
Secrets fail closed: in production the app refuses to start if `ADMIN_PASSWORD_HASH` or
`SESSION_SECRET` is missing.

| Var | Purpose |
|---|---|
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the organiser password (never plaintext) |
| `SESSION_SECRET` | signs the admin session cookie + guards the temporary data endpoint |
| `RESEND_API_KEY`, `EMAIL_FROM`, `TEST_EMAIL_RECIPIENT` | email sending (test-mode redirects all mail to the test recipient) |
| `APP_BASE_URL` | base for emailed edit links (the live HTTPS URL in prod) |
| `ORGANISER_NAME`, `ORGANISER_WHATSAPP_E164`, `ORGANISER_EMAIL` | shown to guests; the "Need help?" button + contact fallbacks only appear when WhatsApp or email is set |
| `RETENTION_DAYS` | admin gets a "delete all data" reminder this many days after the event (default 60) |
| event config | `EVENT_TOWN/HUB/START/END`, `BIRTHDAY_NAME/AGE` |

## Backup & restore (restore-tested)

**Backup:** Admin → **Settings → Export all data** downloads `family-travel-backup.json` (every
registration + vehicle booking; **no edit tokens, no health notes**). Do this regularly before the
event and before any delete.

**Restore** (re-import a backup JSON). The data endpoint is guarded by `SESSION_SECRET`:

```bash
# replaces ALL live data with the backup file (wipe, then import)
curl -X POST "$APP_BASE_URL/api/admin/data" \
  -H "x-admin-token: $SESSION_SECRET" -H "content-type: application/json" \
  -d "{\"action\":\"import\",\"confirm\":true,\"dump\":$(cat family-travel-backup.json)}"
```

The export→wipe→import round-trip (counts preserved, a known family reopens) is covered by
`test/backup.test.ts`. To rehearse safely, restore into a local `npm run dev` instance first.

The same endpoint also offers `snapshot` / `restore` / `list-snapshots` (named in-store point-in-time
copies) and `reset` (delete all). Destructive actions require `{"confirm":true}` and auto-save a
`_autosave` snapshot first. This endpoint is a stopgap until a full restore UI lands.

## Privacy & retention (PRD §17)

- Public privacy notice at `/privacy` (discloses the US hosting region, what's collected, who sees it,
  retention, and how to correct/delete).
- Guests can view/change/delete via their private edit link or **Find my registration**.
- Admin can **cancel** (keep, mark withdrawn) or **delete** one family; deleting also scrubs that
  family from any shared vehicle booking — no dangling PII.
- **Delete all data** (Settings) wipes registrations + bookings **and** the login-attempt IP records
  (`purgeOperationalPII`), leaving no residual PII. Because each family's audit + email log live inside
  its document, deleting the document removes them too. Asserted by `test/privacy.test.ts` +
  `test/backup.test.ts`.
- A retention reminder banner appears on the admin home once `EVENT_END + RETENTION_DAYS` has passed.

## Security baseline (Phase 0 cross-cutting Definition-of-Done — verified)

These are always-true rules, checked across every form/endpoint:

- **CSRF on every POST** — double-submit cookie (`csrf.ts`); guest register/edit/find and every admin
  POST verify it server-side (`adminPost` helper). Autosave excludes the CSRF token.
- **Output escaping** — Astro auto-escapes guest data in pages; email templates escape via `esc()`
  (no `set:html` on guest input).
- **Server-side validation** — every field validated + `direction`/`leg_order` re-derived on the
  server (`registration-form.ts`); the client is never trusted.
- **Secrets fail closed** — missing `ADMIN_PASSWORD_HASH`/`SESSION_SECRET` stops a prod boot.
- **Tokens** — only the sha256 **hash** of the edit token is stored; the raw token is never persisted,
  logged, or exported (asserted in `test/backup.test.ts`). Default expiry = event + `EDIT_TOKEN_EXPIRY_DAYS`.
- **Cookies** — admin session is `HttpOnly`, `SameSite=Strict`, `Secure` in prod, with a sliding idle
  timeout; login is rate-limited with the counter in the Blobs `system` store (survives redeploys).
- **No PII in logs / referrer** — `Referrer-Policy: no-referrer` on every page (`Base.astro`); email
  logs store metadata only, never bodies.
- **No money to families, ever** — confirmation/clarification/updated/ack emails, the success/edit
  pages, the confirm preview, the WhatsApp twin, and the run sheet exclude cost/quote/operator
  (regression-tested in `test/email.test.ts`); the run sheet also excludes guest free-text + health
  notes (`test/reports.test.ts`).
