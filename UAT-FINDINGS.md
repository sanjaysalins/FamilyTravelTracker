# UAT findings & incremental fix plan

**Run:** 2026-06-12, multi-agent UAT (17 agents — 9 family personas on the **live** site, 7 admin
personas on a **local** identical instance, 1 synthesis). **106 issues** found: 1 blocker · 29 high ·
43 medium · 33 low. Deploy verified green (`/privacy`, `/register`, `/admin` login gate all OK).

**Good news (verified):** the **no-cost HARD RULE holds everywhere** — the confirm preview and the
WhatsApp twin are free of cost/operator/quote across every admin scenario.

---

## Themes

1. **Dead "Need help?" lifeline** — the floating button falls back to `href="#"` on every page when
   `ORGANISER_WHATSAPP_E164` is unset. The one escape hatch for a stuck elderly guest goes nowhere.
2. **"Guests never pay" is buried** — the no-cost line lives only on `/privacy`, never on the landing
   page or beside the pickup/drop-off questions where the worry surfaces.
3. **Privacy/trust chain unfinished** — a visible "review before go-live (DPDP/GDPR)" draft note
   shipped to production; no named organiser/contact; jargon ("Netlify Blobs"); no privacy link on landing.
4. **Recovery loop fragile** — `/find` + broken-edit page depend on email (Resend not yet live in prod),
   need the exact registration email with no fallback, and never warn the old link will die.
5. **Wizard orientation/jargon** — no "5 short steps" framing; "Mode", "airport hub", "legs"; bare
   asterisks; group-oriented steps forced on solo guests.
6. **Admin count + a data bug** — badge counts disagree with the page they open; "suggested" pickups
   double-count; the booking status dropdown omits `suggested` and silently rewrites status on Save.
7. **Admin feedback/safety gaps** — hardcoded 8% progress bar; skip-all looks identical to done; no
   post-send confirmation; non-blocking over-capacity; a delete "undo" promise with no UI.

---

## Incremental fix plan (small, independently shippable)

### Phase A — Help lifeline + cost reassurance (config/copy only) · ~half day
- Set `ORGANISER_WHATSAPP_E164` (+ organiser email) in Netlify so the FAB renders a real `wa.me` link.
- In `Base.astro`, when no contact is configured, **hide the FAB or use `mailto:`/`tel:` — never `#`**;
  also show the organiser name+number as readable text.
- Add one plain cost line to the landing hero (`index.astro`) and beside the pickup/drop-off questions
  in `RegistrationForm.astro`: *"The family arranges and pays for all transport — you never pay."*
- Add a real organiser name + contact to `/privacy`, the `/find` success card, and the broken-edit page
  as a fallback recovery route.

### Phase B — Privacy/landing trust leaks (content) · ~2 hours
- Delete the internal *"please review the exact wording before go-live (DPDP/GDPR)"* note from `/privacy`.
- Replace "Netlify Blobs" → "a secure hosting service (servers in the US)"; drop/spell out raw acronyms.
- Add a visible **Privacy** link on the landing page.
- Collapse the two duplicate `/find` buttons on the landing into one "Already registered? Edit your details".

### Phase C — Wizard orientation + wording for low-literacy guests · ~half day
- One-line upfront map before step 1 ("5 short pages… you can stop and finish later").
- "Already registered? Edit instead" link at the top of step 1 (prevents duplicates).
- Rename "Mode" → "How are you travelling?"; real airport name instead of "airport hub"; "trips/journeys"
  not "legs".
- "* means we need this" legend; name the field in validation messages; reassurance under date/time
  fields + a "Don't know yet" escape for times; phone format example matching the selected country.

### Phase D — Admin count + flow correctness bugs · ~half day
- Add `suggested` to the STATUSES array on `/admin/vehicles/[id]` so opening a suggested booking can't
  silently rewrite its status on Save.
- Fix the "Pickups ready to book" job: it counts `suggested`-status **bookings** (never created) instead
  of live planner suggestions — make the badge match the page (`suggestClusters` count).
- Distinguish "skipped all" from "all done" on `/admin/assign` + `/admin/confirm` (don't show the green
  "Confirm & email" success when jobs were only skipped).
- NeedsYou strip: insert the missing space ("9to review" → "9 to review").

### Phase E — Admin feedback, capacity guard, review summary · ~1 day
- Read-only **review summary** card on register step 5 with inline "Edit" links back to each step.
- Make **over-capacity loud and blocking** (red banner + override) so a 14-in-12 vehicle can't email a
  promise that can't be kept.
- Post-send confirmation banner on `/admin/confirm` ("Emailed the Pereira family ✓") using `{emailed}`.
- Pre-fill the family-page WhatsApp link with a cost-free opener (currently opens an empty chat); run
  booking dates through `humanDate` in `bookingFamilyMessage`.
- Real progress bars in assign/confirm (done/total, not hardcoded 8%).
- Either add a working "Undo last delete" button on `/admin/settings` or change the copy to admit it
  can't be undone from the UI.

### Phase F — Email dependency + run-sheet safety · ~half day
- Until prod email is live, make `/find` + broken-edit honest (only promise email if it sends; surface
  the organiser contact as the working fallback); tell guests the old link dies once the new one arrives.
- Keep `guest_notes` **off** the printable run sheet (or mark "guest-written — check before forwarding")
  so health/mobility info can't leak to a hired driver.
- Add per-day grouping (a `travel_date` on `RunStop`) so a multi-day driver gets a usable per-day plan.

---

*Full per-scenario findings (106 issues with evidence + suggestions) are in the workflow result; this
file is the deduped, prioritised plan.*
