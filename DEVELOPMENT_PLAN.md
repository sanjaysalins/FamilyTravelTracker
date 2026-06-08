# Development Plan — Family Travel Coordinator (v2: Netlify + Blobs)

Source of truth: `C:\Users\sanjay\PycharmProjects\FamilyTravelTracker\PRD.md`
Plan review that shaped this version: `C:\Users\sanjay\PycharmProjects\FamilyTravelTracker\ai-panel-run\PLAN-REVIEW.md`
Old PRD drafts: `C:\Users\sanjay\PycharmProjects\FamilyTravelTracker\archive\prd-versions\`

This is v2. It changes the **stack and storage** (locked 2026-06-08) and folds in the AI panel's
plan review (7 blockers fixed). Build in order — each phase ends with something you can run and check.

---

## What changed from v1, and why

| | v1 (old) | v2 (now) | Why |
|---|---|---|---|
| Host | Render/Fly.io + disk | **Netlify** (free) | Your choice; free, no card |
| Storage | SQLite file | **Netlify Blobs** | Netlify is serverless — a SQLite *file* gets wiped. Blobs is built-in, free, persists. |
| Language | Python / Flask | **TypeScript / Astro** | Python isn't first-class on Netlify; Astro fits it cleanly |
| Data shape | 4 SQL tables | **1 JSON document per family** (legs/audit/emails embedded) | No SQL needed at 30 records; one atomic write per family |
| Backup | `VACUUM INTO` | **"Export all" JSON download** | No DB file to vacuum |

Everything *else* in the PRD is unchanged: the multi-leg model, people-per-leg, 5-step wizard,
hashed edit tokens, IST/DD-MM-YYYY, Excel-safe CSV, consent, retention.

---

## How the plan review reshaped this plan (the 7 blockers)

1. **Security is built in from Phase 0**, not bolted on at the end (CSRF, output escaping, cookie flags, fail-closed secrets).
2. **New Phase 0.5 "walking skeleton"** — deploy to Netlify and prove Blobs survives a redeploy **and** send one real test email, on day one. This is the single biggest risk; we retire it first.
3. **Edit tokens move into Phase 2** so the success screen actually has a link to show.
4. **A test suite (vitest) starts in Phase 0**; every phase's "Done when" includes "tests pass."
5. **Login lockout lives in Blobs**, never in function memory (serverless has no memory between calls).
6. **Backup is restore-tested**, not just "export exists."
7. **Phase 2 is split (2a/2b)** because it was the most overloaded estimate.

The document model also quietly fixed two old findings: deleting a family's document deletes its
embedded audit + email log too (no residual PII), and there are no SQL joins/migrations to get wrong.

---

## The architecture in one picture

```
Guest phone ─┐
             ├─►  Astro pages (SSR) on Netlify  ──►  Netlify Functions (TypeScript)
Admin phone ─┘                                          │
                                                        ├─► store.ts  ─►  Netlify Blobs
                                                        │     store "registrations": 1 doc per family
                                                        │     store "system": login_attempts, settings
                                                        └─► email (Resend) + signed cookie auth
```

- **Reads/reports:** `store.list()` → load all ~30 docs → filter/sort/sum in memory. Trivially fast.
- **Writes:** one family = one document = one atomic `setJSON`. Families never collide.
- **No server memory:** admin session = signed stateless cookie; lockout counter = a Blobs key.

---

## Project structure (target)

```
family-travel-coordinator/
├── package.json
├── netlify.toml                 # build + functions config
├── astro.config.mjs             # output: 'server', @astrojs/netlify
├── tsconfig.json
├── .env.example
├── README.md
├── vitest.config.ts
├── src/
│   ├── lib/
│   │   ├── types.ts             # Registration / TransportLeg / Audit / EmailLog (PRD §6)
│   │   ├── store.ts             # typed Netlify Blobs data layer (get/put/list/seed/export)
│   │   ├── tokens.ts            # generate, sha256-hash, verify, revoke, regenerate
│   │   ├── auth.ts              # signed cookie session, login, lockout-in-Blobs, CSRF
│   │   ├── phone.ts             # libphonenumber-js, DEFAULT_PHONE_REGION=IN
│   │   ├── email.ts             # send via Resend, test-mode, log to doc, never break submit
│   │   ├── reports.ts           # report builders + Excel-safe CSV writer
│   │   ├── reference.ts         # BDAY-2026-NNNN generator
│   │   ├── config.ts            # load + fail-closed validation of env secrets
│   │   └── dates.ts             # IST + DD-MM-YYYY helpers
│   ├── pages/
│   │   ├── index.astro          # landing
│   │   ├── register.astro       # wizard shell (5 steps)
│   │   ├── success/[ref].astro
│   │   ├── edit/[ref].astro
│   │   ├── find.astro
│   │   ├── privacy.astro
│   │   ├── api/                 # form POST endpoints (register, edit, find)
│   │   └── admin/               # login, dashboard, [ref], assign, reports, settings
│   ├── components/              # form sections, leg card, summary card, KPI card
│   ├── layouts/Base.astro       # layout + floating WhatsApp help button
│   └── scripts/wizard.ts        # localStorage autosave/restore/clear, step nav, phone widget
├── public/                      # static assets, print stylesheet
└── tests/                       # vitest unit tests (grow each phase)
```

---

## Cross-cutting rules (Definition of Done on EVERY phase)

These are not a phase. They are always true. (Blocker #1.)

- **Never build HTML from user input.** Astro auto-escapes — never `set:html` on guest data.
- **CSRF token on every POST** (guest register, guest edit, every admin action). Issued in a cookie,
  echoed in a hidden field, checked server-side. The localStorage autosave **excludes** the CSRF token.
- **Validate and type every field server-side.** Never trust the client; re-derive `direction` and
  `leg_order` on the server.
- **Secrets fail closed.** If `SESSION_SECRET` or `ADMIN_PASSWORD_HASH` is missing in production, the
  app refuses to start (not "boots insecurely").
- **No PII in logs.** Never log the `/edit?token=` query string; scrub `token=` from any logged URL;
  `Referrer-Policy: no-referrer` on edit + success pages. Log email *metadata* only, never bodies.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Strict` for the admin session.
- **The phase's vitest tests pass.**

---

## Phase 0 — Skeleton, secure baseline, test harness  *(1 day)*

**Goal:** the app boots locally, security primitives exist, tests run.

1. `npm create astro`, add `@astrojs/netlify`, Tailwind, `vitest`, `libphonenumber-js`,
   `@netlify/blobs`, an argon2/bcrypt lib, the Resend SDK.
2. `astro.config.mjs`: `output: 'server'`, Netlify adapter. `netlify.toml`.
3. `config.ts`: load env, **throw on missing required secrets in prod**. Dev/prod split for
   Secure-cookie/HSTS vs local.
4. `auth.ts` skeleton: signed-cookie helper + CSRF issue/verify. A tiny `gen-hash` script to make the
   `ADMIN_PASSWORD_HASH`.
5. `Base.astro` with the floating WhatsApp help button + CSRF wiring.
6. `vitest` set up; first tests: config fails closed; CSRF round-trips; reference-number format.

**Done when:** `netlify dev` serves a page, `npm test` is green, missing secrets stop a prod build.

---

## Phase 0.5 — Walking skeleton: prove the scary stuff  *(½ day)* ← do this before anything else big

**Goal:** retire the two risks you can't control — does Blobs survive a redeploy, and does email arrive.

1. Deploy the hello-world app to **real Netlify**.
2. Add a temporary route that writes one blob (`{hello: 'world', at: now}`) and one that reads it.
3. **Redeploy. Confirm the blob is still there.** (This is the whole reason we picked Blobs — prove it.)
4. Set up the Resend sender (verify domain/sender — DNS can take hours, so start now).
5. Send **one real test email** from the deployed site to yourself.

**Done when:** a value written before a redeploy is readable after it, and a real email lands in your
inbox (check spam). If either fails, we find out on day one — not in week three.

---

## Phase 1 — Data layer  *(1 day)*

**Goal:** typed read/write to Blobs, with realistic seed data.

1. `types.ts` — the `Registration` document shape from **PRD §6** (legs/audit/emails embedded).
2. `store.ts` — `getRegistration(ref)`, `putRegistration(doc)`, `listRegistrations()`,
   `deleteRegistration(ref)`, `exportAll()`. Stores: `registrations` (key = reference) + `system`.
   Centralise all Blobs access here so nothing else touches Blobs directly.
3. Missing-field tolerance: reading an older doc fills new fields with safe defaults (our "migration"
   story — additive, no destructive rewrite).
4. `seed.ts` — 4–5 sample families incl. a multi-leg journey (Hyderabad→Bidar→side trip→back) **and**
   half-filled cases (TBC date, missing flight number) so later screens and the chase list have data.

**Done when:** `npm run seed` fills Blobs; tests round-trip a document and list/sort it.

---

## Phase 2 — Guest wizard + tokens + success  *(4–5 days)* ← the big one, split in two

**[2a] Form, validation, leg seeding, submit → Blobs  *(2–3 days)*** — testable without JS state.

1. `Base` theme (teal/gold/cream), landing page (Register · Edit · Find).
2. The 5 steps (PRD §7.3) as server-rendered sections. Server owns the field list.
3. **Wire format (the bug-prone seam):** the form posts flat scalars + **one hidden `legs` JSON
   field**. The server **re-derives** `direction` and `leg_order` — never trusts client values.
4. Map the 3-way transport answer: **"Not sure" → `transport_needed = true` + leg `status = requested`**
   (the model doesn't distinguish "not sure" from "yes" — that's intended).
5. Server validation (PRD §14): only name/email/phone/country/consent/party_size + arrival & departure
   from/to/transport-answer **block**. Missing dates/times/carrier **never block** (feed the chase list).
   `people_on_this_leg` defaults to `party_size` when blank.
6. On submit: create the document, **seed exactly one arrival + one departure leg + any internal legs**.
7. **Tokens here (moved up):** `tokens.ts` generates `token_urlsafe(32)`, stores **sha256 hash only**,
   builds the link. (Blocker #3 — the success screen needs it.)
8. **Double-submit guard:** disable the button on first tap **and** a server-side submission nonce;
   reject the second. Clear the localStorage draft **on the server-confirmed redirect** to
   `/success/<ref>`, not on click.
9. Success page: reference code + edit link **on screen** (copyable) and queued for email.

**[2b] Make it feel magical on a phone  *(1–2 days)*** — `scripts/wizard.ts`.

10. localStorage autosave on every change; **survive back AND refresh**; "Step N of 5" + progress bar;
    sticky primary button; "Start a new registration" wipes local state. Autosave **excludes** CSRF token.
11. Phone widget: `intl-tel-input` (default India) + `phone.ts` normalise to E.164; store raw + E.164;
    **never reject** messy input.

**Email doesn't break submit:** render success first, then attempt the ack email, catching failure into
the doc's `emails[]` (status `failed`) + an `email_failed` audit entry — no user-facing error.

**Done when:** on a 360px screen you complete the wizard, refresh mid-way without losing data, submit
once (double-tap creates one record), and see the document + its legs + a token hash in Blobs.

---

## Phase 3 — Edit-later flow  *(1 day)*

**Goal:** a guest reopens and changes their registration by link, safely.

1. `GET /edit/<ref>?token=` → verify hash + not revoked + not expired → reopen the pre-filled wizard.
2. `POST` saves. Reuse Phase 2 validation + wire format.
3. **Edit-after-confirm cascade:** if the doc was `confirmed`, set `edited_after_confirm = true`, drop
   registration to `in_review`, reset **only touched** confirmed legs to `planned` (untouched stay
   confirmed), add an audit entry. **Unit-tested against a hand-seeded confirmed document** (so we don't
   wait for Phase 5 admin-confirm to exist — Blocker, fixed).
4. Expiry + revoke + regenerate.
5. "Find my registration": email in → generic "if a match exists we've emailed a link" → resend. **Never
   reveal data from reference + email alone.**

**Done when:** the link reopens the pre-filled form; a bad/expired/revoked token is refused; editing a
confirmed doc flags it and resets the right legs (test proves untouched legs stay confirmed).

---

## Phase 4 — Email templates & logic  *(1 day)*

**Goal:** the four emails, assembled from data. (The *channel* was already proven in Phase 0.5.)

1. `email.ts`: send via Resend, **test-mode** (`TEST_EMAIL_RECIPIENT` → all mail goes there), append a
   metadata entry to the doc's `emails[]` + an audit entry on every send (incl. failures).
2. Templates (PRD §11): acknowledgement, confirmation (per-leg lines), clarification, updated.
3. Admin **preview before send**.

**Done when:** in test mode, a submit sends an ack to the test inbox and the doc's `emails[]` shows it;
a forced failure is logged as `failed` and never blocks the user.

---

## Phase 5 — Admin area (guided, not a spreadsheet)  *(3–4 days)*

**Goal:** the organiser logs in and is **guided** — "what needs you, one thing at a time" — never faced
with a wall of data (PRD §9.1). The prototype (`prototype/admin*.html`) is the reference for look + flow.

1. `auth.ts`: verify password against `ADMIN_PASSWORD_HASH` (argon2/bcrypt — **no plaintext**).
   **Lockout counter in the `system` Blobs store** (IP + time window) so it survives redeploys
   (Blocker #5). Signed-cookie session, idle timeout, logout. CSRF on every POST.
2. Route guard: every `/admin/*` page and endpoint re-checks the session.
3. **Action Centre** (`/admin`, PRD §9.1 A0): a `tasks.ts` that computes live job counts (to review /
   to book / need driver / to confirm / to chase) over registrations + `vehicle_bookings`. Render as a
   tappable job list; 0-count jobs show done.
4. **One-at-a-time job flows:** `/admin/assign` (one booking per screen → driver/phone/reg, Save &
   next) and `/admin/confirm` (one family per screen → cost-free email preview, Send & next). Progress
   count; "Skip" advances. **No cost field in either** (cost stays on the booking).
5. **Per-family wizard** (`/admin/registrations/<id>`, A3): Review → Transport → Assign → Confirm;
   one-click `wa.me`; audit trail; "mark reviewed" (status `submitted → in_review`).
6. **'Needs you' strip** shared component on the advanced pages (A2 list, A5 vehicles, reports).
7. Advanced views: All-registrations table (A2, search/filter, duplicate + edited-since-confirm flags);
   Vehicles & bookings (A5) — the full hire workflow the flows write into. Admin edit (A4) = the guest
   form. Auto-flip a registration to `confirmed` when every transport-needed leg is confirmed.

**Done when:** the Action Centre shows correct live counts; you can clear "need a driver" and "to
confirm" entirely through the one-at-a-time flows (each with a progress count); a confirmation email
sends in test mode and shows **no cost**; lockout survives a redeploy.

---

## Phase 6 — Reports & export  *(1–2 days)*

**Goal:** the screens the organiser runs the event from.

1. `reports.ts` (all in-memory over `listRegistrations()`): arrivals schedule, departures schedule,
   **seat demand by people-per-date** (sum `people_on_this_leg` where `transport_needed`, **not** leg
   count), **per-driver run sheet** (printable, one page per driver), chase list (`date_tbc` or missing
   carrier ref), headcount.
2. CSV writer: **UTF-8 with BOM**, dates `DD-MM-YYYY` as text, phones as `+…` text. Byte-level test.
3. Print stylesheet for arrivals/departures/run sheets.
4. **Exports exclude tokens; run sheet + general export exclude health/mobility notes** (PRD §10).

**Done when:** each report renders from seed data; the CSV opens clean in Excel (BOM test passes); the
run sheet prints one page per driver with no health notes.

---

## Phase 7 — Privacy, retention & backup hardening  *(1 day)* (verify, not build)

**Goal:** confirm the always-on rules held, and finish the genuinely-new privacy artifacts.

1. Verify the Phase-0 baseline held on every form (CSRF, escaping, cookie flags, no token in logs).
2. Privacy notice page + consent wording (DPDP-first, GDPR-aware; **disclose US Blobs region**).
3. Per-registration delete/cancel + "delete all data N days after event". Because audit + emails are
   embedded, deleting the document removes them too — **add a test asserting no PII remains** in any
   store (incl. scrubbing IPs from `login_attempts`). Show a dashboard banner once `EVENT_DATE + N` passes.
4. **Backup is restore-tested:** "Export all" → JSON file → re-import into a scratch deploy/store →
   confirm counts + a known family opens. Document the restore steps in the README.

**Done when:** every box in PRD §17 is true; a deleted family leaves no trace; an exported backup
restores and opens.

---

## Phase 8 — Production cutover  *(½ day)* (mostly a re-run of 0.5)

1. Real env vars in Netlify (real `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, Resend key, event config).
2. Custom domain (optional) + HTTPS/HSTS on.
3. `/healthz` endpoint (Blobs reachable + writable) for an uptime check.
4. Final smoke test on the live site: register → edit link → admin confirm → email arrives.

**Done when:** a real registration on the live URL survives a redeploy and a confirmation email arrives.

---

## Phase 9 — Acceptance + dry run  *(½–1 day)*

1. Walk the **PRD §19 acceptance checklist** top to bottom on a real phone.
2. **Dry run with 2–3 real relatives** on their own phones before go-live — the truest test for the
   elderly-mobile UX.
3. Confirm the open items in **PRD §20** (internal-leg cap, event details to hardcode, language).
4. Buffer for fixes found here.

---

## Test suite (grows each phase) — the highest-value targets

| Area | What the test pins |
|---|---|
| Tokens | hash stored not raw; verify rejects revoked/expired; regenerate; raw token never in any doc/CSV |
| Leg seeding | exactly 1 arrival + 1 departure + internals; `leg_order` 1..N; `people_on_this_leg` default + override |
| Edit-after-confirm | touched leg → planned, untouched stays confirmed, reg → in_review, flag set, audit row |
| Auto-confirm | flips only when all transport-needed legs confirmed; `not_required` doesn't block |
| Seat demand | sums **people**, not legs, grouped by date |
| CSV | byte-level BOM; DD-MM-YYYY text; `+…` phones; no token/health columns |
| Phone | messy input normalises to E.164, never rejects; one `DEFAULT_PHONE_REGION=IN` |
| Email | builds + sends against a fake; failure path logs `failed` and never throws to the user |
| Delete | deleting a family leaves no PII in any store |

---

## Risks (updated for Netlify)

| Risk | Guard | Retired in |
|---|---|---|
| Blobs doesn't persist across redeploy | Prove it with a real write+redeploy | **Phase 0.5** |
| Email lands in spam / sender not verified | Verify sender + real test email early; link also on screen | **Phase 0.5** |
| Security retrofitted and a form missed | Security is a standing Definition-of-Done | Phase 0 |
| Lockout resets (serverless has no memory) | Counter in Blobs `system` store | Phase 5 |
| Two families' writes collide | One document per family = no shared key | by design |
| Guest + admin edit same doc at once | Rare at 30 families; optional Blobs etag guard | note |
| Lost form data on a phone | localStorage survives back **and** refresh; tested | Phase 2b |
| Wrong vehicle size | Seat demand sums **people**, not legs | Phase 6 |
| PII leak via export/logs | Tokens + health notes excluded; token scrubbed from logs | Phase 0/6 |
| Backup that doesn't restore | Export → restore → open, tested | Phase 7 |

---

## Timeline

Roughly **3 – 3.5 weeks** of focused solo work, plus an acceptance-fixes buffer after Phase 9.
Phases 2 and 5 are the big ones.

```
0 Skeleton+security → 0.5 Walking skeleton (DE-RISK) → 1 Data layer
→ 2 Wizard+tokens (2a/2b) → 3 Edit flow → 4 Email → 5 Admin
→ 6 Reports → 7 Privacy/backup → 8 Cutover → 9 Acceptance+dry-run
```

---

## First concrete step

**Phase 0 + 0.5 together:** scaffold the Astro + Netlify + Blobs skeleton with the security baseline
and test harness, then deploy it and **prove a blob survives a redeploy + a real email arrives**. That
single step kills the project's two biggest risks before we build any features.

Say the word and I'll scaffold Phase 0 (and prep the Phase 0.5 deploy checklist).
