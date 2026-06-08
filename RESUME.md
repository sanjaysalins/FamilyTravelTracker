# RESUME — Family Travel Coordinator

**Last worked:** 2026-06-08. Paused cleanly. Pick up from "Next step" below.

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
| `.env` (local dummy secrets, gitignored) | ✅ |

## Run it now

```powershell
# real app (Astro) — local dev, uses .data/ file store (no Netlify needed)
npm run dev            # http://localhost:4321  (landing page works)
npm run build          # verifies the Netlify build

# the prototype (reference for the rest of the screens)
python -m http.server 5000 --bind 0.0.0.0 --directory prototype   # http://localhost:5000
```

---

## NEXT STEP (do this first when you return): Phase 0.5 — de-risk on Netlify

This needs **your** free Netlify login (only you can do it). It proves the two scary things early:
**does data survive a redeploy, and does email arrive.**

1. Create a free Netlify account at https://app.netlify.com (no card).
2. In the prompt, log in the CLI (interactive):
   ```
   ! npx netlify login
   ```
3. Then tell me "logged in" and I will:
   - `netlify init` / link the site, set env vars (real `ADMIN_PASSWORD_HASH` via `npm run gen-hash`,
     `SESSION_SECRET`, Resend key),
   - deploy, write a test blob, **redeploy, confirm it survived**,
   - verify a sender + send **one real test email**.

If email/DNS is slow, that's fine — it's exactly why we test it first.

## Then, in order (DEVELOPMENT_PLAN.md)

- **Phase 1** — port `data.js` → real `store.ts` data + a seed; unit tests start (vitest).
- **Phase 2** — guest 5-step wizard (port `prototype/register.html`) + tokens + success screen.
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
