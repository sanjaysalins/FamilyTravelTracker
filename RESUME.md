# RESUME — Family Travel Coordinator

**Last worked:** 2026-06-08. **LIVE on Netlify** at https://bidarplan.netlify.app (GitHub→Netlify CI/CD).
Phase 0.5 mostly done. Pick up from "Next step" below.

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
- **Phase 2** — guest 5-step wizard (port `prototype/register.html`) + tokens + success screen. ← NEXT
- **Phase 3** — edit-later flow. **Phase 4** — email.
- **Phase 5** — guided admin (port `prototype/admin*.html`: Action Centre, assign/confirm flows,
  per-family wizard, needs-you strip).
- **Phase 6** — reports + hire list + run sheet (port `prototype/admin-reports.html`).
- **Phase 7** — privacy/retention + restore-tested backup. **Phase 8** — cutover. **Phase 9** — dry run.

## Watch-outs (from the plan review — already baked into the plan)

- Security is **built in from Phase 0**, not bolted on. CSRF on every POST; escape user text.
- Login lockout counter lives in the **`system` Blobs store** (serverless has no memory).
- **No cost/quote/operator** in any family-facing email or page — ever.
- The cluster window for vehicle suggestions is **60 min** (open question — confirm with organiser).
- Check-in buffers used in the prototype: **2 hr international / 1 hr domestic**, **~3 hr** Bidar↔Hyderabad.

## Open questions parked for the organiser

- Cluster window (60 min?) and check-in buffers (2h intl / 1h dom?).
- Allow moving a family into an existing booking with spare seats? (nice-to-have)
- Confirm event details to hardcode (organiser name + WhatsApp number for the help button).
