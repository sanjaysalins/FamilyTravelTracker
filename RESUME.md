# RESUME — Family Travel Coordinator

**Last worked:** 2026-06-15 (Phase 8 cutover — imported prod env vars into Netlify; forced a fresh CI/CD build via this commit so the functions pick up the new env). Phases 0–7 complete + UAT round A–F; only cutover smoke-test + dry-run left. **LIVE on Netlify**

---

## ▶▶ SESSION 2026-06-13b — local test + NEW dispatch board (DONE, pushed)

**Ran it locally.** `npm run dev` → http://localhost:4321. Seeded 8 fake families into the dev store
via `POST /api/admin/data` (header `x-admin-token: <SESSION_SECRET, currently "c">`, body
`{"action":"seed","familyCount":8,"confirm":true}`). **Local admin password = `bidar2026`** (set this
session in local `.env` only — Netlify production password is unchanged).

**Found + fixed a real local-dev bug.** Vite's `loadEnv` (in `astro.config.mjs`) runs **dotenv-expand**,
which mangles a bcrypt hash: `$2a$10$XOI…` lost its `$XOI…` segment (read as a `$VAR`) → login always
failed locally. **FIX: escape every `$` as `\$` in local `.env` ONLY** →
`ADMIN_PASSWORD_HASH=\$2a\$10\$XOI…`. Production/Netlify unaffected (no dotenv there). **Documented in
`README.md`** (Environment variables section). The `CLAUDE.md` diff is just a stray-`claude` typo cleanup.

**NEW FEATURE (user request) — `/admin/dispatch` "Pickup Dispatch Board", DONE (commits `4309551` +
`3d10f49`, pushed → live).** A per-day timeline of who needs a pickup, sorted by time. Vertical
mobile-friendly time-list (NOT a Gantt); **arrivals + departures** via `?dir=arrival|departure`; day tabs
built from the dates present; >60-min gap dividers + a "N families within the hour" share hint; colour by
status (🟠 needs driver / 🔵 booked-or-assigned / 🟢 confirmed). Tick the unbooked legs that cluster
together → **"Book selected together"** → one shared vehicle, then assign the driver. Booked rows link
straight to their booking.

- `src/pages/admin/dispatch.astro` — the page. `src/pages/admin/index.astro` — `📅 Pickup timeline` nav
  link. `src/pages/api/admin/vehicles/create.ts` — now accepts MANY `leg_ids` checkbox fields (was a
  single comma-string) via `form.getAll('leg_ids').flatMap((v)=>v.toString().split(','))`, backward
  compatible with the Vehicles "accept suggestion" form. Reuses the existing `createBookingFromLegIds`
  (`vehicles.ts:80`), which rebuilds the cluster + validates same-date+route server-side; endpoint
  redirects to `/admin/vehicles/{id}` to assign the driver.
- `test/dispatch.test.ts` — proves grouping (one booking covers all, back-links each leg), the mixed-route
  guard, and the not-plannable→null case. **118 tests; build clean. Verified live end-to-end** (ticked 2
  → VEH created covering both → rows flipped 🟠→🔵 + became clickable).
- NOTE (seed quirk, not a bug): seeded *duplicate* families reuse leg id `leg-1`, so leg ids collide in
  fake data — real registrations get unique UUIDs, so on the live site each tick maps to exactly one leg.

---

**UAT round (2026-06-12) — DONE, PUSHED, LIVE:** ran a 17-agent multi-persona UAT (live family site +
local admin) → 106 issues (1 blocker, 29 high). Fixed in 6 commits (A–F, see `UAT-FINDINGS.md`): dead
"Need help?" FAB (now WhatsApp/mailto/hidden, never `#`); "you never pay" on landing + transport step;
privacy draft note + jargon removed, contact added; wizard 5-step framing + plainer wording +
review-summary on step 5; admin status-dropdown data bug + "ready to book" count fixed; skip-vs-done;
over-capacity now blocks confirm; post-send "Emailed ✓" banner; real progress bars; forward-safe run
sheet (no guest_notes, per-day grouping). **112 tests; build clean.** Pushed (`7dc14d6..b4be53e`) and
**deploy verified GREEN** on https://bidarplan.netlify.app (cost line, "5 short pages", "How are you
travelling?", privacy link all confirmed live). Later finished **Phase 7** (restore-tested backup,
no-PII delete-all, README + security audit) and added **`/healthz`**. **115 tests; everything committed
+ pushed — `main` in sync; deployed at https://bidarplan.netlify.app (GitHub→Netlify CI/CD).**

**▶ PICK UP HERE:** Phases **0 → 7 are DONE** (guest register + edit +
email + full guided admin + reports/CSV + privacy/delete/retention + restore-tested backup; **115 tests** pass; `npm run build`
clean) **plus a full UAT fix round (A–F) and Phase 7 finished** — all committed and **live**.
**NEXT = Phase 8 (cutover — Netlify env vars + optional custom domain/HSTS + live smoke; `/healthz` already
built) + Phase 9 (dry run with real relatives).**
(Per-phase detail is in the "Then, in order" list below; UAT detail in `UAT-FINDINGS.md`.)

**Resend is now WORKING** locally (real ack + confirmation emails verified to the test inbox).
Still open for the **user, in Netlify env** (local `.env` already has placeholders): set the real
`EMAIL_FROM` (currently the `onboarding@resend.dev` test sender — only reaches the signup address),
`RESEND_API_KEY`, `TEST_EMAIL_RECIPIENT`, `APP_BASE_URL`, `ORGANISER_NAME`. **NOW ALSO IMPORTANT after
the UAT fix:** `ORGANISER_WHATSAPP_E164` and `ORGANISER_EMAIL` — the "Need help?" button + the contact
fallbacks only appear when one of these is set (otherwise hidden, never a dead `#`). Then redeploy.
Admin login password lives in local `.env` (gitignored).

**Live admin token (temporary):** the `/api/admin/data` endpoint is guarded by `SESSION_SECRET`
(value in local `.env` + Netlify env — never commit it). Admin login password is stored in `.env`
locally (gitignored), not here.

For the **why** behind decisions, read `PRD.md`. For the **build order**, read `DEVELOPMENT_PLAN.md`.

---

## Where we are (in one minute)

A mobile-first website for ~30 families to register travel for **Sybil's 60th birthday** in
**Bidar**, **16–19 October 2026**. One organiser hires vehicles to fit arrivals/departures, assigns
drivers, and confirms by email. Guests don't pay — **no cost is ever shown to families**.

- **PRD.md** — the spec. Locked decisions: Astro + TypeScript on **Netlify** + **Netlify Blobs**
  (no SQL, no hosted DB); document-per-family + a cross-family `vehicle_bookings` store; 5-step guest
  wizard; **guided admin** (Action Centre + one-at-a-time job flows + per-family wizard + "Needs you"
  strip); hashed edit tokens; `ADMIN_PASSWORD_HASH` (no plaintext).
- **prototype/** — a clickable static prototype (guest wizard + full guided admin), wired to a shared
  `data.js` localStorage layer. This is the **visual + flow reference** for the real build.
- **Real app (Astro)** — **Phase 0 foundation is DONE and builds.** Files at repo root.

## What's done

| | Status |
|---|---|
| 3 PRDs reviewed + merged (ai-panel) → `PRD.md` | ✅ |
| Plan reviewed (ai-panel) → `ai-panel-run/PLAN-REVIEW.md` (folded into plan) | ✅ |
| Clickable prototype (guest + guided admin + vehicle bookings) | ✅ |
| **Phase 0:** Astro + Netlify + Blobs scaffold | ✅ builds (`npm run build` passes) |
| — `package.json`, `astro.config.mjs`, `netlify.toml`, `tsconfig.json`, `.gitignore`, `.env.example` | ✅ |
| — `src/lib/types.ts` (full data model), `config.ts` (fail-closed), `store.ts` (Blobs + local fallback) | ✅ |
| — `src/layouts/Base.astro`, `src/pages/index.astro`, `src/styles/global.css` (theme) | ✅ |
| — `npm run gen-hash` helper (bcrypt) | ✅ |
| `node_modules` installed (865 pkgs) | ✅ |
| `.env` (local **real** secrets, gitignored) | ✅ |
| **GitHub repo** `sanjaysalins/FamilyTravelTracker` (SSH) → Netlify auto-deploy | ✅ |
| **Phase 0.5:** deployed + live (HTTP 200) | ✅ https://bidarplan.netlify.app |
| — blob-survival proven (wrote a blob, redeployed, it survived) | ✅ |
| — `APP_BASE_URL` set in Netlify | ⬜ (user to add) |
| — one real test email via Resend | ⬜ (needs Resend signup) |
| **Integration tests** (vitest): 27 passing — `npm test` | ✅ store + config + seed/snapshot |
| **Snapshot/restore/reset + fake-family seed** (data safety + UAT) | ✅ built + live |
| — `src/lib/seed.ts`, `store.ts` snapshot fns, `src/pages/api/admin/data.ts` | ✅ |
| — `astro.config.mjs` loads `.env`→`process.env` for local dev | ✅ |
| **Phase 1:** data layer — typed read/write + seed | ✅ done |
| — read-time **missing-field tolerance** (older docs gain new fields' defaults) in `store.ts` | ✅ + tests |
| — seed now includes a **multi-leg journey with an internal side trip** (`BDAY-2026-0009`) | ✅ |
| — `npm run seed [count]` CLI (`scripts/seed.ts` via vite-node) fills the store | ✅ |
| **Phase 2a:** guest form + validation + tokens + success (server-rendered, no-JS) | ✅ done |
| — `lib/`: `csrf`, `tokens`, `phone`, `dates`, `reference`, `registration-form` (pure builder) | ✅ + tests |
| — `register.astro` → `POST /api/register` → `success/[ref].astro`; CSRF + nonce idempotency | ✅ verified live |
| — **52 tests** pass (`npm test`); `npm run build` clean | ✅ |
| **Phase 2b:** wizard JS (`src/scripts/wizard.ts`) — autosave, step nav, dynamic lists, phone | ✅ done |
| — survives back+refresh (excl. CSRF), clears draft on success; no-JS path still works | ✅ verified live |
| **Phase 3:** edit-later flow — shared `RegistrationForm.astro`, `/edit/<ref>?token=`, `/api/edit` | ✅ done |
| — `applyEdit` cascade (confirmed→in_review, only touched legs reset); `/find` generic resend | ✅ + tests |
| — **59 tests** pass; verified live (reopen, bad-token refusal, round-trip). find-email = Phase-4 stub | ✅ |
| **Phase 4:** email — `email-templates.ts` (ack/confirmation/clarification/updated, pure, no-cost, HTML-escaped) | ✅ done |
| — `email.ts` send layer: Resend via `fetch` (no SDK dep), test-mode redirect, logs emails[]+audit, never-throws | ✅ + tests |
| — wired **ack** into `/api/register`; **token-regenerate resend** into `/api/find` (old link only dies once new one sends) | ✅ |
| — **70 tests** pass; `npm run build` clean. Real send awaits user's Resend keys in Netlify | ✅ |

## Run it now

```powershell
# real app (Astro) — local dev, uses .data/ file store (no Netlify needed)
npm run dev            # http://localhost:4321  (landing page works)
npm run build          # verifies the Netlify build

# the prototype (reference for the rest of the screens)
python -m http.server 5000 --bind 0.0.0.0 --directory prototype   # http://localhost:5000
```

---

## NEXT STEP (do this first when you return): finish Phase 0.5

Deploy uses **GitHub → Netlify CI/CD** (push to `main` = auto-deploy). The Netlify CLI route was
dropped. Two small things remain, both needing the user:

1. **Add `APP_BASE_URL`** in Netlify → Site settings → Environment variables →
   `APP_BASE_URL = https://bidarplan.netlify.app` (so emailed edit-links point at the real site).
   Then trigger a redeploy.
2. **Email test:** sign up at https://resend.com (free), verify a sender, set `RESEND_API_KEY`
   + `EMAIL_FROM` + `TEST_EMAIL_RECIPIENT` in Netlify. Then we add a tiny send-test endpoint and
   confirm one real email arrives.

Already proven this session: deploy works, **a blob survives a redeploy**, and the
snapshot/restore/seed data tools work (locally + read-verified live).

### UAT / data-safety tools (built this session)
`/api/admin/data` (token = `SESSION_SECRET`, header `x-admin-token`) — TEMPORARY until the Phase 5
admin UI wraps it behind real login. Actions: `export`, `list-snapshots` (GET); `snapshot`,
`restore`, `seed`, `reset`, `import`, `delete-snapshot` (POST; destructive ones need
`{"confirm":true}` and auto-save a one-step `_autosave` first). Fake families: `src/lib/seed.ts`.
Workflow: **snapshot → test → restore** (same-site, since there's no separate test env). NOTE: a
guardrail blocks running destructive actions against the **live** site without the user's OK; local
`npm run dev` (file store under `.data/`) is the safe place to seed/reset freely.

## Then, in order (DEVELOPMENT_PLAN.md)

- **Phase 1** — ✅ DONE. Data layer: typed read/write to the store, read-time missing-field
  tolerance, varied fake-family seed (incl. an internal-leg journey), `npm run seed` CLI; 27 tests.
- **Phase 2a** — ✅ DONE. Guest form (server-rendered 5 steps, works **without JS**) + server
  validation + leg seeding + edit tokens + success screen. New `lib/`: `csrf`, `tokens`, `phone`,
  `dates`, `reference`, `registration-form` (pure builder). `register.astro` → `POST /api/register`
  → `success/[ref].astro`. CSRF double-submit, nonce idempotency, token-hash-only, handoff cookie.
  Verified live (npm run dev): submit creates doc w/ correct legs, dup-submit = 1 record, errors
  flash inline, CSRF 403. **52 tests pass.**
- **Phase 2b** — ✅ DONE. `src/scripts/wizard.ts` (progressive enhancement over 2a; form still
  works with JS off). Step nav + progress bar + sticky button; localStorage autosave surviving
  back+refresh (excludes CSRF; cleared on the success page); dynamic people list → `people_json`;
  internal trip-2 reveal/remove; WhatsApp-number toggle; `.choice` selection styling; phone
  preview via libphonenumber-js (swapped in for intl-tel-input — no new dep); Enter-key + double-
  submit guards. Build clean; no-JS + people_json paths re-verified live.
- **Phase 3** — ✅ DONE. Edit-later flow. Form extracted to shared `components/RegistrationForm.astro`
  (used by create + edit, and Phase 5 admin-edit). `/edit/<ref>?token=` verifies the token and
  reopens the pre-filled wizard (friendly refusal page on bad/expired/revoked); `POST /api/edit`
  re-verifies, rebuilds, and **merges onto the stored doc preserving admin leg-planning** with the
  edit-after-confirm cascade (`applyEdit`: confirmed→in_review, only *touched* confirmed legs→planned,
  flag + audit). `/find` + `/api/find` give the generic "we've emailed a link" response (never reveal
  data from ref+email). Pure `docToFormValues`/`applyEdit` unit-tested; **59 tests**. Verified live:
  edit reopens prefilled, bad token refused (GET + POST), edit round-trips. **NOTE: the find email
  send + token regenerate is a Phase-4 stub** (lookup works, no email yet — `src/pages/api/find.ts` TODO).
- **Phase 4** — ✅ DONE. Email templates & logic. `src/lib/email-templates.ts` = 4 pure builders
  (ack/confirmation/clarification/updated), each `{subject,text,html}`, HTML-escaped, **never any
  cost/operator** (regression-tested). `src/lib/email.ts` sends via Resend's HTTP API (a single
  `fetch`, no SDK dep), redirects to `TEST_EMAIL_RECIPIENT` in test-mode, appends `emails[]`+audit on
  every attempt (sent OR failed), and **never throws**. Wired: ack on `/api/register` (after save,
  can't block submit); `/api/find` now regenerates the edit token + emails the fresh link, only
  invalidating the old link once the new one actually sends. With no `RESEND_API_KEY` the send logs
  `failed: RESEND_API_KEY not set` and is otherwise a no-op. **70 tests.** confirmation/clarification/
  updated builders exist + are tested but their admin send-triggers land in Phase 5.
- **Phase 5** — ✅ DONE (5 slices, commits `1cf0023 → c8ac296`). Guided admin. `auth.ts` (signed
  HMAC session w/ sliding idle, bcrypt login, IP rate-limit in the `system` Blobs store, `requireSession`
  guard) + `/admin/login`/`logout`. `tasks.ts` computes the 5 Action-Centre job counts; `/admin` is the
  Action Centre; `NeedsYou.astro` strip on advanced pages. `admin-list.ts` + `/admin/registrations`
  (search/filter, New/duplicate/edited/chase flags); `/admin/registrations/[ref]` per-family wizard
  (Review/mark-reviewed, Transport, WhatsApp, audit) + `/edit` admin edit (reuses RegistrationForm +
  `applyEdit`, session-authed). `planner.ts` (pure 60-min clustering → suggested vehicles, smallest-fit,
  `allTransportLegsConfirmed`) + `vehicles.ts` (create/assign/confirm/detach/delete bookings; confirm
  emails each family the Phase-4 cost-free confirmation + a `wa.me` twin, auto-confirms the family).
  `/admin/vehicles` (+`[id]`), one-at-a-time `/admin/assign` + `/admin/confirm` flows (skip via query),
  `/admin/email-log`, `/admin/settings` (JSON export + delete-all). `admin-api.ts` = shared POST guard.
  **NOTE:** clarification email + the `channel:'email'|'whatsapp'` log field were NOT needed — the
  wa.me twin is a plain link, no logging; clarification template exists but has no admin trigger yet
  (could add a "request clarification" action later). Reports hub is a placeholder (Phase 6).
- **Phase 6** — ✅ DONE (commit `89572b4`). `reports.ts` (pure): arrivals/departures schedules,
  **seat demand = sum people not legs**, per-driver run sheet (no health notes), chase list, headcount;
  Excel-safe CSV writer (UTF-8 BOM, CRLF, DD-MM-YYYY text, `+…` phones; export excludes tokens + special
  requirements). `/admin/reports` hub (KPIs + tables + CSV links), `/admin/reports/run-sheet` (print one
  page/driver), `/api/admin/reports/{arrivals,departures,export}.csv`. 9 tests; live-verified BOM + no-token.
- **Phase 7** — ✅ DONE (commits `0724a65` + Phase-7-finish). `privacy.ts` (deleteRegistrationCascade +
  isRetentionDue + `purgeOperationalPII`), `/api/admin/delete-registration` (cancel/delete), per-family
  Danger zone, `/privacy` notice (jargon/draft note removed in UAT), retention reminder on `/admin`.
  **delete-all now also scrubs login-attempt IPs** — no residual PII. **Restore-tested backup:**
  `test/backup.test.ts` proves export→wipe→import round-trips (counts + a known family reopens) and the
  raw edit token never appears in an export. **`README.md`** documents run/env, the backup→restore curl
  procedure, privacy/retention, and a verified **Phase-0 security DoD checklist**. 115 tests. (Open, optional:
  a friendlier in-UI restore button — currently restore is the token-guarded `/api/admin/data` import.)
- **Phase 8** — cutover (mostly user/Netlify): real env vars, custom domain + HSTS, live smoke.
  **`/healthz` DONE** (commit `42f49ef`) — round-trips the Blobs store, returns 200/503; point an uptime
  monitor (e.g. UptimeRobot) at `https://bidarplan.netlify.app/healthz`. Remaining Phase 8 = user/Netlify.
- **Phase 9** — acceptance walk + dry run with 2–3 real relatives on their phones.

## Watch-outs (from the plan review — already baked into the plan)

- **Two local stores!** `npm run dev` (Astro+Netlify adapter) uses the **emulated Netlify Blobs**
  sandbox (`.netlify/blobs-serve/`), while `npm run seed` (vite-node, no adapter) writes the
  **file store** (`.data/`). They are NOT the same data. To seed what `dev` shows, POST the admin
  `seed` action to the running dev server, or seed via the running app — not the CLI.

- Security is **built in from Phase 0**, not bolted on. CSRF on every POST; escape user text.
- Login lockout counter lives in the **`system` Blobs store** (serverless has no memory).
- **No cost/quote/operator** in any family-facing email or page — ever.
- The cluster window for vehicle suggestions is **60 min** (open question — confirm with organiser).
- Check-in buffers used in the prototype: **2 hr international / 1 hr domestic**, **~3 hr** Bidar↔Hyderabad.

## Open questions parked for the organiser

- Cluster window (60 min?) and check-in buffers (2h intl / 1h dom?).
- Allow moving a family into an existing booking with spare seats? (nice-to-have)
- Confirm event details to hardcode (organiser name + WhatsApp number for the help button).
