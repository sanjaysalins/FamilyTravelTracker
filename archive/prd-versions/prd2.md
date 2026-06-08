# Family Trip Registration Website — Build Spec (v2, consolidated)

**Purpose:** A simple, professional, mobile-first website where family members travelling from around the world to a 60th birthday celebration register their trip and transport needs. One organiser reviews each registration in a private admin area, assigns drivers, and sends a confirmation. Data lives in a server-side SQLite database.

**Audience filling the form:** Non-technical people, many elderly, on mobile phones, some travelling internationally. It must feel like a guided form, not a database.

> **How to use this document:** Hand it to an AI code generator as the full spec.
> - **[BUILD CONSTRAINT]** = non-negotiable; the most common things AI builders get wrong.
> - **[DECISION NEEDED]** = an open choice for the organiser to confirm. Each has a recommended default.
>
> This v2 already incorporates a design review. The fixes are part of the spec below, not a separate list.

---

## 1. Critical build constraints (read first)

These exist because the obvious default choices break this exact project.

| # | Constraint | Why |
|---|---|---|
| C1 | **Deploy to a host with a persistent disk** (Render, Railway, Fly.io, or a VPS). **Do NOT target Vercel/Netlify/Cloudflare Pages defaults.** | SQLite is a file on disk. Serverless platforms wipe it on every redeploy/restart, silently losing all registrations. |
| C2 | **Guest edits use a magic link, not a password.** And the **admin can fully edit any registration** (see C3). | Elderly users won't remember passwords. |
| C3 | **Admin must have full edit rights on every registration**, identical to the guest form. | Guests will phone/WhatsApp you to change things rather than use the link. Without this you become a bottleneck with no tool. |
| C4 | **Show the edit link on the success screen** (to save/screenshot), not only by email. | The magic-link email is the same channel that lands in spam. If it's the *only* way to edit, locked-out users can't get back in. |
| C5 | **Mobile-first.** Test at 360px width before desktop. Big tap targets, large legible type. | The audience is on phones, often elderly, on patchy connections. |
| C6 | **International phone capture** with a country-code selector, stored in E.164 (`+91…`, `+44…`). Default country: India. | Guests come from abroad and within India. |
| C7 | **Form state survives navigation and refresh.** Back never loses data; refresh never loses data. | Long form on a phone — people will fumble. |
| C8 | **All dates display/input as DD-MM-YYYY. Timezone IST (Asia/Kolkata).** Label every time with what it means and its zone. | Event is in India; mixed-origin travellers. Prevents drivers sent at the wrong hour. |
| C9 | **Transactional email needs a real sending setup** (provider + verified sender). Plan for it; raw `mail()` will spam-folder. | Confirmation + magic-link emails must arrive. |
| C10 | **Collect and store the minimum.** Add a consent checkbox + privacy note. Provide delete actions and a delete-after-event plan. | "Special requirements" will contain health/mobility data — special-category data under UK/EU GDPR. See §11. |
| C11 | **Vehicle sizing is by people-per-leg, not by guess.** The guest only says "need transport yes/no"; the admin assigns the vehicle from the seat count. | A family of 6 on one leg is not "1 car." |
| C12 | **SQLite backup must use `VACUUM INTO` or the online backup API**, never a raw copy of the live file. | A file copy of a mid-write DB can be corrupt — broken exactly when you need it. |

---

## 2. The problem model (get this right)

The destination is a town — **Bidar** (example). A guest's journey is **multi-leg**, not a single pickup/dropoff:

> Fly into **Hyderabad** → car to **Bidar** → later, car to **another town** → return to **Hyderabad** → fly home.

So per registration there is a **list of travel legs**. Each leg may or may not need transport, and **each leg carries its own people count** (defaulting to the party size, editable — not everyone travels every leg together).

**[BUILD CONSTRAINT]** Model legs as a repeatable list. Default to arrival + departure, and **actively prompt** for in-between travel — don't bury it as "advanced."

---

## 3. Roles

| Role | Access | Auth |
|---|---|---|
| **Guest** (registers for their own family group) | Public: fill the form, submit, edit via magic link | None to start; magic link to edit |
| **Admin** (you) | Private dashboard: view/edit all, assign drivers, confirm, send emails, run reports, export, delete | Single shared login from env vars |

One admin only. No user management. Credentials from env (`ADMIN_USER`, `ADMIN_PASSWORD_HASH`), never hardcoded.

---

## 4. Data model (SQLite)

### 4.1 `registrations`

| Field | Type | Required | Notes |
|---|---|---|---|
| id | TEXT (uuid) | yes | PK |
| created_at / updated_at | DATETIME | yes | |
| status | TEXT | yes | `submitted` \| `confirmed` \| `cancelled` |
| confirmed_at | DATETIME | no | Set when confirmed |
| edited_after_confirm | BOOLEAN | yes | True if guest/admin edits after a confirmation (R12) |
| edit_token | TEXT | yes | Long random, unguessable; for the magic link |
| main_contact_name | TEXT | yes | |
| email | TEXT | yes | Magic link + confirmation |
| phone_e164 | TEXT | yes | e.g. `+447700900000` |
| whatsapp_e164 | TEXT | no | Offer "same as phone" |
| home_city | TEXT | yes | |
| home_country | TEXT | yes | |
| address | TEXT | no | Optional; only if needed to identify people |
| party_size | INTEGER | yes | Total in this group, incl. main contact |
| special_requirements | TEXT | no | Diet, mobility, elderly, infant, child seat, etc. |
| consent_given | BOOLEAN | yes | Must be true to submit |
| consent_at | DATETIME | yes | |
| admin_notes | TEXT | no | Private |

### 4.2 `party_members` — **[DECISION NEEDED]** (default: don't build; keep a headcount)

Only build this if you need names/ages for seating or child seats. If so, use a real table (not a JSON blob — JSON can't be queried for reports).

| Field | Type | Notes |
|---|---|---|
| id | TEXT | |
| registration_id | TEXT | FK |
| name | TEXT | |
| age_band | TEXT | `adult` \| `child` \| `infant` (for car seats) |

### 4.3 `travel_legs` (many per registration)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | TEXT | yes | |
| registration_id | TEXT | yes | FK |
| leg_order | INTEGER | yes | 1, 2, 3… |
| direction | TEXT | yes | `arrival` \| `departure` \| `internal` |
| from_location | TEXT | yes | e.g. Hyderabad |
| to_location | TEXT | yes | e.g. Bidar |
| travel_date | DATE | no | Nullable for early registrations |
| date_tbc | BOOLEAN | yes | True = "not booked yet" (R7) |
| time_local | TEXT | no | e.g. "10:30" or "approx morning" |
| time_meaning | TEXT | no | `arrival_at_destination` \| `departure_from_origin` — always shown with IST/local label (C8) |
| carrier_type | TEXT | no | `flight` \| `train` \| `bus` \| `own` \| `unknown` |
| carrier_ref | TEXT | no | Flight no / train no / PNR |
| people_on_this_leg | INTEGER | yes | Default = party_size; editable (C11) |
| transport_needed | BOOLEAN | yes | Guest answer only — no vehicle type from guest |
| guest_notes | TEXT | no | |
| **— admin fills below —** | | | |
| driver_name | TEXT | no | |
| driver_phone | TEXT | no | |
| vehicle_details | TEXT | no | e.g. "White Innova, TS09 AB 1234" |
| vehicle_seats | INTEGER | no | For demand reporting |
| pickup_point | TEXT | no | Exact meeting point |
| pickup_time_confirmed | TEXT | no | |

### 4.4 `email_log`

| Field | Type | Notes |
|---|---|---|
| id | TEXT | |
| registration_id | TEXT | FK |
| type | TEXT | `magic_link` \| `confirmation` |
| to_email | TEXT | |
| sent_at | DATETIME | |
| status | TEXT | `sent` \| `failed` |

---

## 5. Guest flow

**[DECISION NEEDED] Form style.** Default recommendation: **a single scrollable page with clearly titled sections** + a sticky Submit, rather than a multi-step wizard. For elderly mobile users it removes the "where's Next" failure mode and makes autosave trivial. The section list below works either way.

**[DECISION NEEDED] Spam gate.** Optionally require a shared **event code** (one code, set in env, printed in the WhatsApp invite) before the form opens. Recommended — stops bots at near-zero friction. Plus a honeypot field (weak alone; don't oversell it).

### Sections / steps

| Order | Title (plain language) | Fields |
|---|---|---|
| 1 | About you | name, email, phone (+country), WhatsApp ("same as phone"), home city/country, optional address, **consent checkbox + privacy note** |
| 2 | Who's coming | party_size; optional names/age-bands *only if §4.2 is built* |
| 3 | Getting there (arrival) | from → to (pre-fill to = event town), date (or **"Not booked yet"**), time + what it means, flight/train ref, **"Do you need a pickup?"**, people on this leg, notes |
| 4 | Going home (departure) | same, reversed pre-fill |
| 5 | In-between travel | prompt: "Any travel between towns during your stay?" → repeatable leg cards (direction = internal) |
| 6 | Anything we should know | special_requirements, with hint examples (mobility, elderly, baby, diet) |
| 7 | Review & submit | read-only summary, inline "Edit" jumps to each section, then Submit |

### Rules **[BUILD CONSTRAINT]**

- Validate before submit; show errors inline, in plain language, near the field. Be lenient on phone formatting (accept spaces/zeros, normalise to E.164 — don't reject).
- **Autosave the in-progress form to the browser**; **clear it on submit** and offer "Start a new registration" that wipes local state (so a shared phone doesn't pre-fill one relative's data into another's). (R9)
- One idea per screen/section. Never dump the whole DB-shaped form at once.

### Success screen **[BUILD CONSTRAINT]**

"Saved. Here's your private link to edit this anytime — save or screenshot it." Show the link **on screen** and also email it. (C4)

---

## 6. Edit-later flow

1. On submit, generate `edit_token`; email a link `…/edit/<edit_token>` **and** show it on the success screen.
2. Clicking it reopens the **same form, pre-filled**. Guest changes anything (party size, transport, flight/train, dates).
3. On save: `updated_at` set. If the registration was already `confirmed`, set `edited_after_confirm = true` and **reset status to `submitted`** so you re-check transport. Admin sees a "changed since confirmation" flag. (R12)
4. **No password anywhere on the guest side.**
5. Lost-link recovery: a "Find my registration" page — enter email → resend the link.

**[DECISION NEEDED]** Whether guest self-edit is worth the email dependency for ~30 families. Simpler alternative: drop guest self-*editing*, keep email *confirmations*, and let people phone/WhatsApp you (you edit via admin — C3). Recommended if email deliverability is shaky. Default: keep self-edit, since you asked for it, with admin edit as the reliable fallback.

---

## 7. Admin area (private)

Login at `/admin` with the single env credential.

### 7.1 Security **[BUILD CONSTRAINT]**

- **Brute-force lockout + rate-limit on the admin login** (this login holds everyone's PII). (R6)
- Long passphrase; consider IP allowlist or basic 2FA.
- Every admin route (detail, edit, reports, CSV, delete) checks the session — no guessable-id access.
- CSRF protection on all admin state-changing actions and the guest edit form.
- HTTPS only.

### 7.2 Screens

| # | Screen | Purpose / key elements |
|---|---|---|
| A1 | Login | Single credential; lockout. |
| A2 | Dashboard / list | Sortable table; filters (status, arrival date, needs-transport); search; status chips; **possible-duplicate flag** (same email/phone — flag, don't block) (R14); **"edited since confirmation"** flag. |
| A3 | Registration detail | All fields + all legs + special needs. **One-click WhatsApp** link (`https://wa.me/<number>`). |
| A4 | **Edit registration (admin)** | Full edit of guest data — same form as the guest. (C3) |
| A5 | Assign drivers & confirm | Per-leg driver name/phone/vehicle/seats/pickup point/time. "Confirm & send email" → status → `confirmed`, email sent + logged. |
| A6 | Reports hub | Links to §8. |
| A7 | Email log | Sent/failed per registration. |
| A8 | Settings | Event details, event code, **"delete all data after event"**, **backup download (`VACUUM INTO`)**. |

---

## 8. Reports (the part you'll live in)

| Report | Content | Output |
|---|---|---|
| **Arrivals schedule** | Arrival/internal legs needing transport, grouped by date, sorted by time. Guest, people-on-leg, from→to, flight/train ref, driver assigned. | Screen + print + CSV |
| **Departures schedule** | Same, for departures. | Screen + print + CSV |
| **Seat demand by date** | Per date: total **people** needing transport (not legs) so you size vehicles. (C11) | Screen |
| **Per-driver run sheet** | Grouped by driver, sorted by pickup time — what to hand each driver. (R13) | Print |
| **Missing details / chase list** | Registrations with `date_tbc` or no flight/train info — who to chase. (R7) | Screen |
| **Headcount** | Total confirmed people; people per arrival date. | Screen |
| **Full export** | Every registration + legs, flattened. | CSV |

**[BUILD CONSTRAINT]** CSV opens cleanly in Excel: UTF-8 with BOM, dates as text DD-MM-YYYY.

---

## 9. Emails

### Magic-link email (on submit)
Short. Subject e.g. "Your trip registration — your edit link." One clear button/link. (Also shown on the success screen — C4.)

### Confirmation email (on admin confirm)
Warm, plain, professional. Subject: "Your trip to [Event Town] is confirmed".
Body, assembled from data:
- Greeting by name; "Your registration for [N] people is confirmed."
- For each leg needing transport: date, from → to; "You'll be picked up at [pickup_point] around [pickup_time_confirmed]"; "Driver: [name], phone [phone]. Vehicle: [vehicle_details]."
- A line for any special requirement noted.
- The edit link again.
- Organiser contact details (from config).

Log every send in `email_log`; show status in admin.

**[BUILD CONSTRAINT]** Provide a **test mode / single test recipient** so the flow can be checked without emailing real relatives. (R17)

---

## 10. Screen inventory (full)

### Guest-facing
| # | Screen | Notes |
|---|---|---|
| G1 | Landing / Welcome | Birthday header; intro; buttons **Register** + **Edit my registration** + **Find my registration**; optional event-code field. |
| G2–G8 | Form sections 1–7 | Per §5. Single scrollable page (default) or wizard steps. |
| G9 | Submitted / success | Shows edit link on screen + emails it. (C4) |
| G10 | Edit (via magic link) | Pre-filled form. |
| G11 | Find my registration | Enter email → resend link. |
| G12 | Link expired / not found | Friendly message + request new link / contact organiser. |

### Admin-facing
A1 Login · A2 Dashboard · A3 Detail · A4 Edit · A5 Confirm & assign · A6 Reports hub (A6a arrivals · A6b departures · A6c seat demand · A6d driver run sheet · A6e chase list · A6f headcount · A6g CSV) · A7 Email log · A8 Settings.

### System / shared
404, generic error, slow-network/offline notice, validation states, success toasts, **print stylesheet** for arrivals/departures/run sheets.

---

## 11. Screen / navigation map

```
PUBLIC (guests)                              ADMIN (organiser)
─────────────────                            ──────────────────
Landing page                                 Login  (lockout)
   │  ├─ "Edit my registration" ──┐             │
   │  └─ "Find my registration" ──┼─► resend    ▼
   ▼                              │   link    Dashboard
Registration form  ◄──────────────┘           (list · search · filters · flags)
   │  (sections 1–7, autosaved)                  │
   ▼                                             ▼
Submitted                                     View / edit entry  (full guest data)
   │  shows + emails edit link                   │
   │                                             ▼
   └───────── new registration ───────────►  Confirm & assign driver
                                                 │  emails the guest
   ◄───────── confirmation email ────────────────┘
                                                 │
                                                 ▼
                                              Reports & export
                                              (arrivals · departures · seat demand ·
                                               driver run sheet · chase list · CSV)
```

The two lanes touch in only two places: a guest submission appears on the dashboard, and a confirmation goes back to the guest. The edit link loops a guest back into the form.

---

## 12. Privacy, consent, retention, security

- **Consent:** a checkbox + one-line privacy note on section 1; cannot submit without it. Store `consent_given` / `consent_at`.
- **Minimise:** address is optional; collect only what identifies people and arranges transport.
- **Special-category data:** "special requirements" may hold health/mobility info. Treat the whole dataset as sensitive.
- **Retention:** plan to **delete all data N days after the event** (admin action in Settings). Don't let the SQLite file with everyone's PII live forever.
- **Hosting location:** if any travellers are UK/EU residents, prefer a **UK/EU host** to avoid casual cross-border transfer of their data.
- **Backups:** off-box, automated, daily; created with `VACUUM INTO` (C12).
- **Admin:** lockout + rate-limit + CSRF + session checks (§7.1).
- **Public form:** rate-limit + honeypot + optional event-code gate.
- **Edit token:** long, random, unguessable.

---

## 13. Non-functional

| Area | Requirement |
|---|---|
| Look & feel | Clean, professional, lightly celebratory (birthday name/age in header). Generous whitespace, one accent colour, large legible type. |
| Responsive | Mobile-first, 360px → desktop. |
| Accessibility | High contrast, labelled inputs, keyboard usable, screen-reader friendly. |
| Performance | Light pages, fast on mobile data. |
| Language | English UI. **[DECISION NEEDED]** add Hindi/Telugu labels? Default English-only. |

---

## 14. Recommended tech (constraints above matter more than framework)

| Layer | Recommendation | Alternatives |
|---|---|---|
| App | Next.js (App Router) — frontend + API in one | Express + React/static; Python Flask/FastAPI |
| DB | SQLite via `better-sqlite3` (or Prisma + SQLite) | — (per requirement) |
| Email | Resend or SMTP | SendGrid, Mailgun |
| Phone | `intl-tel-input` / `libphonenumber-js` | — |
| Host | Render / Railway / Fly.io / VPS (persistent disk, UK/EU if EU guests) | — (NOT default serverless) |
| Admin auth | Session + env credentials + lockout | — |

Single deployable app. No microservices, no Kafka, no Kubernetes.

---

## 15. Out of scope

Multiple admin accounts / roles · payments · automated WhatsApp *sending* (manual click-to-WhatsApp only) · multi-event support · native mobile apps.

---

## 16. Open decisions to confirm

1. **Form style** — single scrollable page (recommended) or multi-step wizard?
2. **Spam gate** — use a shared event code? (Recommended yes.)
3. **Guest self-edit** — keep it (default), or drop in favour of admin-edits-on-request?
4. **Party member detail** — headcount only (default), or names + age-bands for car seats?
5. **Language** — English only (default), or add Hindi/Telugu labels?
6. **Edit-after-confirm** — reset to "submitted" for re-check (default) — confirm.
7. **Event details to hardcode** — town, dates, organiser name + contact, accent colour, birthday person's name/age.

---

## 17. Acceptance checklist (definition of done)

- [ ] Guest completes the form on a phone; back/refresh never loses data; draft clears on submit.
- [ ] International phone numbers accepted, stored as E.164.
- [ ] Multi-leg journeys (e.g. Hyderabad → Bidar → other town → back) capturable, with people-per-leg.
- [ ] "Not booked yet" dates allowed; chase-list report shows them.
- [ ] On submit, the edit link shows on screen **and** emails; clicking it reopens the pre-filled form.
- [ ] Editing a confirmed registration flags it and resets to "submitted."
- [ ] Admin login has lockout; non-admins can't reach admin/report/edit routes.
- [ ] Admin can view, search, filter, **fully edit** any registration; duplicates flagged.
- [ ] Admin assigns per-leg driver details and confirms; confirmation email sends with correct driver/pickup info and is logged.
- [ ] Reports: arrivals, departures, **seat demand by people**, **per-driver run sheet**, chase list, headcount, CSV — all working and printable.
- [ ] Consent captured; delete-registration and delete-all-after-event actions exist; privacy note shown.
- [ ] SQLite persists across redeploys; backup uses `VACUUM INTO` and runs off-box.
- [ ] Dates DD-MM-YYYY; times labelled with meaning + IST/local; timezone IST.
- [ ] Test/dummy email mode exists.
```