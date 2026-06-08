# Family Travel Coordinator — Final Build PRD

## 60th Birthday Celebration · Travel & Transport Registration

**This is the single source of truth.** Hand it to an AI coding model and build the whole site
from it, start to finish. Every open choice has already been decided. Conflicts between the source
specs are resolved inline with a one-line reason. A short "Decisions the organiser may want to
revisit" list is at the end.

Tags used below:
- **[CONSTRAINT]** = non-negotiable. These are the things AI builders most often get wrong.
- **[DECIDED]** = a choice that was contested between source specs; the call and reason are given.

---

## 1. Product summary

A simple, warm, mobile-first website where about 30 family groups register their travel and
transport for a 60th birthday celebration in India. Example event town: **Bidar**. Main airport hub:
**Hyderabad**.

Many guests are elderly, non-technical, on phones, and some travel internationally (India, UK/EU,
US). The public form must feel like a short guided set of questions, not a database.

One organiser runs a private admin area: review each registration, assign drivers and vehicles per
travel leg, confirm by email, chase missing details, and print run sheets for drivers. All data lives
in a single server-side **SQLite** file.

---

## 2. Goals and non-goals

### Goals
1. Let family members register travel details easily on a phone.
2. Capture enough to coordinate pickups, drop-offs, internal transfers, and driver assignment.
3. Let guests edit their details later through a private link (no password).
4. Let the organiser review, fully edit, assign drivers, and confirm by email.
5. Send an acknowledgement email and a confirmation email.
6. Store data in a lightweight SQLite database the organiser can open and read.
7. Produce the operational reports the organiser actually runs the event from.

### Non-goals (do not build)
- Public user accounts or passwords for guests
- Payments, ticket uploads
- Real-time driver tracking, driver mobile app
- Google Maps / forced map selection
- Automated SMS or WhatsApp sending (manual click-to-WhatsApp only)
- Multiple admin accounts or role permissions
- Multi-event support
- Native mobile apps

---

## 3. Users

**Guest (family traveller).** Registers for their own family group. Often elderly, non-technical, on
a phone, sometimes filling it in for several relatives on one shared device. May not have final
travel details yet. No login; edits via a private magic link.

**Admin (the one organiser).** Reviews everything, assigns drivers and vehicles per leg, sends
confirmations, chases missing details, exports reports. Single login from environment variables.

---

## 4. The domain model — get this right

**[CONSTRAINT] A guest journey is a list of travel legs, not a fixed arrival + departure pair.**

A real journey looks like:

> Fly into **Hyderabad** → car to **Bidar** → day trip to another town → back to **Hyderabad** →
> fly home.

That is 3–5 **legs**. So:

- Each registration has **many `transport_legs`** (one row per leg).
- Every leg has its **own people count** (`people_on_this_leg`), defaulting to party size, because
  not everyone travels every leg together. A family of 6 on one leg is not "1 car."
- **The guest only answers "do you need transport on this leg? yes / no / not sure"** and how many
  people are on the leg. **The guest never picks a vehicle type.** The admin sizes the vehicle from
  the seat count.
- On submit, always create one `arrival` leg and one `departure` leg, plus any `internal` legs the
  guest added.

**[DECIDED] Multi-leg `transport_legs` table, not prd1's flat `arrival_*`/`departure_*` columns.**
Reason: the flat columns duplicate the journey in two places and can't model a side trip; the leg
list models the real journey and drives vehicle sizing.

---

## 5. Tech stack

**[DECIDED — LOCKED 2026-06-08] Astro (SSR) on Netlify + Netlify Blobs + TypeScript. Not Flask/SQLite.**
Reason: the organiser is deploying on **Netlify**, which is serverless — there is no persistent disk,
so a SQLite *file* would be wiped on every redeploy. **Netlify Blobs** is Netlify's own built-in,
free, persistent store (no separate hosted database, no credit card). The dataset is tiny (~30
families), so a document store with in-memory querying replaces relational SQL with no real cost.
Astro gives file-based pages (like Jinja templates), server endpoints (like Flask routes), auto-
escaping, and a first-party Netlify adapter that ships almost no client JS — good for elderly mobile.

This supersedes the earlier Flask/SQLite decision. Every framework-independent constraint stays:
multi-leg model, people-per-leg, E.164 phones, IST/DD-MM-YYYY, Excel-safe CSV, consent, retention.

| Layer | Choice |
|---|---|
| Framework | **Astro** (SSR, `output: 'server'`) + `@astrojs/netlify` adapter → builds to Netlify Functions |
| Language | **TypeScript** |
| Storage | **Netlify Blobs** — one document per registration (legs/audit/email-log embedded). No SQL, no migrations. Query in memory. |
| Styling | Tailwind CSS (teal/gold/cream per §15) |
| Wizard state | Plain JavaScript + browser `localStorage` (no server drafts) |
| Email | A provider with a verified sender (Resend recommended; SMTP also fine). Test-recipient mode. |
| Phone | `intl-tel-input` (frontend) + `libphonenumber-js` (server) → store E.164 + raw |
| Host | **Netlify** (free plan). Note: data physically lives in Netlify Blobs (US region) — see §17 hosting note re: UK/EU guests. |
| Backups | Admin "Export all" → single JSON download; keep off-box copies. (Replaces `VACUUM INTO`.) |

**[CONSTRAINT] All persistent data goes in Netlify Blobs, never the function's local disk.** The
serverless filesystem is wiped between invocations and on every redeploy. Anything written to `/tmp`
or a local file is lost. Prove persistence early (see plan Phase 0.5).

**[CONSTRAINT] No server-side session memory and no in-process counters.** Serverless functions are
stateless and ephemeral. Admin sessions use a **signed stateless cookie**; the login-lockout counter
lives in **Netlify Blobs**, not process memory.

---

## 6. Data model

**[UPDATED 2026-06-08] Storage is Netlify Blobs (documents), not SQLite tables.** The SQL below is now
read as the **shape of one registration document**. Keep every field, name, and rule — only the
storage engine changed.

**Document layout in Netlify Blobs:**
- One **store** named `registrations`. **Key = `reference_number`** (e.g. `BDAY-2026-0042`).
- **Value = one JSON object** holding the registration fields **plus** its `legs[]` array, its
  `audit[]` array, and its `emails[]` array embedded inside it. One family = one document = one
  atomic write (no joins, no cross-document consistency to manage).
- Listing/searching = `store.list()` then filter/sort in memory (~30 docs — trivial).
- A second store `system` holds small operational keys: `login_attempts` (lockout counter) and
  `settings`.

```ts
// TypeScript shape of one Netlify Blobs registration document
interface Registration {
  reference_number: string            // PK / blob key, e.g. "BDAY-2026-0042"
  edit_token_hash: string             // sha256(raw token) — raw token never stored
  edit_token_created_at: string
  edit_token_expires_at: string | null
  edit_token_revoked_at: string | null

  main_contact_name: string
  email: string
  phone_raw: string
  phone_e164: string | null
  whatsapp_same_as_phone: boolean
  whatsapp_e164: string | null
  home_city: string | null
  home_country: string
  relationship: string | null

  party_size: number                  // >= 1
  party_names: string | null
  special_requirements: string | null

  stay_type: 'hotel' | 'family_home' | 'own' | 'unsure' | null
  stay_location: string | null

  consent_given: boolean              // must be true to submit
  consent_at: string | null
  status: 'submitted' | 'in_review' | 'confirmed' | 'cancelled'
  confirmed_at: string | null
  edited_after_confirm: boolean
  admin_notes: string | null

  created_at: string
  updated_at: string

  legs: TransportLeg[]                // embedded — see below
  audit: AuditEntry[]                 // embedded
  emails: EmailLogEntry[]             // embedded (metadata only, never the body)
}

interface TransportLeg {
  id: string                          // uuid
  leg_order: number
  direction: 'arrival' | 'internal' | 'departure'
  from_location: string
  to_location: string
  travel_date: string | null
  date_tbc: boolean
  travel_time: string | null
  time_meaning: 'arrival_at_destination' | 'departure_from_origin' | null
  carrier_type: 'flight' | 'train' | 'bus' | 'own' | 'unknown' | null
  carrier_ref: string | null
  people_on_this_leg: number          // default = party_size, editable
  transport_needed: boolean           // guest yes/no ONLY (no vehicle guess)
  guest_notes: string | null
  // admin-filled:
  status: 'requested' | 'needs_clarification' | 'planned' | 'confirmed' | 'not_required' | 'cancelled'
  vehicle_booking_id: string | null   // link to the shared VehicleBooking that serves this leg (see below)
  pickup_point: string | null         // this family's exact meeting point for that vehicle
  pickup_time_confirmed: string | null
  // driver + vehicle live on the VehicleBooking (one hired vehicle can cover several families'
  // legs). These two are an optional cache, copied from the booking so the confirmation email
  // for this family is self-contained:
  driver_name: string | null
  driver_phone_e164: string | null
  admin_notes: string | null
  confirmation_sent_at: string | null
}

interface AuditEntry {
  at: string
  actor: 'guest' | 'admin' | 'system'
  action: string                      // submitted, edited, driver_assigned, confirmation_sent, ...
  details: string | null
}

interface EmailLogEntry {
  at: string
  type: 'ack' | 'confirmation' | 'clarification' | 'updated'
  to_email: string
  subject: string | null
  status: 'sent' | 'failed'
  error_message: string | null
}
```

### Vehicle bookings — a separate store (cross-family)

**[ADDED 2026-06-08] Hired vehicles are their own records, not fields on a leg.** You don't own a
fleet — you **hire** vehicles to fit the arrivals/departures. One hired vehicle (e.g. a 12-seat Tempo
Traveller) often covers **several families' legs** that land in the same place within a short window.
So a booking can't live inside one family's document — it gets its own Blobs store.

**Document layout:**
- Store `vehicle_bookings`. **Key = booking id** (e.g. `VEH-2026-0007`).
- Each booking lists the legs it carries in `covered_legs[]` (which span multiple registrations).
- The matching `TransportLeg.vehicle_booking_id` points back, so a family detail page can show its ride.

```ts
interface VehicleBooking {
  id: string                          // blob key, e.g. "VEH-2026-0007"
  date: string                        // ISO date of the run
  purpose: 'arrival' | 'departure' | 'internal'
  route_from: string                  // e.g. "Hyderabad Airport"
  route_to: string                    // e.g. "Bidar"
  depart_time: string | null          // planned "leave by" time, IST (back-calculated for departures)

  // the vehicle
  vehicle_type: 'car' | 'suv_innova' | 'tempo_traveller' | 'minibus' | 'other'
  seats: number                       // capacity — compare against people carried

  // who provides it (the hire) — INTERNAL ONLY: never shown to families or in any guest-facing email
  operator_name: string | null        // car-hire company / vendor
  operator_contact: string | null
  quote_amount: number | null         // price quoted — organiser budget only
  currency: string                    // default "INR"

  // the driver, once assigned (shared by every covered leg)
  driver_name: string | null
  driver_phone_raw: string | null
  driver_phone_e164: string | null
  vehicle_reg: string | null          // number plate, e.g. "TS09 AB 1234"

  status: 'suggested' | 'to_book' | 'booked' | 'assigned' | 'completed' | 'cancelled'

  // which legs (across families) this one vehicle carries
  covered_legs: Array<{
    registration_ref: string          // FK → registrations key
    leg_id: string                    // FK → that registration's leg
    family_name: string               // cached for the run sheet
    people: number                    // people on this leg
  }>

  notes: string | null
  created_at: string
  updated_at: string
}
```

**Rules:**
- The **planner proposes** `status: 'suggested'` bookings automatically by clustering legs (same place,
  same date, within the configured time window; for departures, by back-calculating "leave Bidar by"
  from each return flight/train time minus check-in minus the ~3 hr Bidar↔Hyderabad drive).
- The admin walks each through **`suggested → to_book → booked → assigned → completed`** (or `cancelled`),
  filling operator, quote, then driver + vehicle reg.
- `sum(covered_legs[].people)` must be **≤ `seats`** — the UI warns when a cluster needs a bigger vehicle
  or a second one.
- Assigning a driver to a booking **copies** `driver_name` / `driver_phone_e164` onto each covered
  `TransportLeg` (the cache used by that family's confirmation email) and sets those legs to `planned`.
- Confirming a booking can confirm **all covered legs at once** and email each family their own details.
- The **hire list** report = `vehicle_bookings` grouped by date; the **driver run sheet** = grouped by
  `driver_name`, ordered by `depart_time`.
- Deleting/cancelling a registration must remove its legs from any `covered_legs[]` and flag the booking
  for review (capacity may have changed).

---

The reference SQL schema (kept for field definitions and CHECK rules) follows. Build the documents
above to match it.

**[DECIDED] Three core tables + one tiny email log, not five.**
Reason: `registrations`, `transport_legs`, `audit_log` cover the whole system for 30 families. A
separate `travellers` table is dropped (keep an optional free-text headcount instead). A minimal
`email_log` is kept because "did the confirmation actually send?" is a real operational question.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. One row per family group ------------------------------------------------
CREATE TABLE registrations (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_number       TEXT UNIQUE NOT NULL,          -- e.g. BDAY-2026-0042

    -- edit access (HASH only; raw token lives only in the email/link)
    edit_token_hash        TEXT NOT NULL,                 -- sha256(raw token)
    edit_token_created_at  TEXT NOT NULL,
    edit_token_expires_at  TEXT,                          -- ISO-8601; null = no expiry
    edit_token_revoked_at  TEXT,                          -- non-null = revoked

    -- contact
    main_contact_name      TEXT NOT NULL,
    email                  TEXT NOT NULL,
    phone_raw              TEXT NOT NULL,
    phone_e164             TEXT,
    whatsapp_same_as_phone INTEGER NOT NULL DEFAULT 1,
    whatsapp_e164          TEXT,
    home_city              TEXT,
    home_country           TEXT NOT NULL,
    relationship           TEXT,                          -- optional

    -- group
    party_size             INTEGER NOT NULL CHECK (party_size >= 1),
    party_names            TEXT,                          -- optional free text, one per line
    special_requirements   TEXT,                          -- diet / mobility / elderly / infant

    -- stay (optional free text — NOT its own table)
    stay_type              TEXT,                          -- hotel | family_home | own | unsure
    stay_location          TEXT,

    -- consent + lifecycle
    consent_given          INTEGER NOT NULL DEFAULT 0,    -- must be 1 to submit
    consent_at             TEXT,
    status                 TEXT NOT NULL DEFAULT 'submitted'
                              CHECK (status IN ('submitted','in_review','confirmed','cancelled')),
    confirmed_at           TEXT,
    edited_after_confirm   INTEGER NOT NULL DEFAULT 0,
    admin_notes            TEXT,

    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL
);

-- 2. Many legs per registration (THE core operational table) -----------------
CREATE TABLE transport_legs (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id        INTEGER NOT NULL,
    leg_order              INTEGER NOT NULL,              -- 1,2,3...
    direction              TEXT NOT NULL
                             CHECK (direction IN ('arrival','internal','departure')),

    -- guest-supplied
    from_location          TEXT NOT NULL,                 -- free text, e.g. Hyderabad Airport
    to_location            TEXT NOT NULL,                 -- free text, e.g. Bidar
    travel_date            TEXT,                          -- ISO date; null allowed
    date_tbc               INTEGER NOT NULL DEFAULT 0,    -- 1 = "not booked yet" -> chase list
    travel_time            TEXT,                          -- "10:30" or "approx morning"
    time_meaning           TEXT,                          -- arrival_at_destination | departure_from_origin
    carrier_type           TEXT,                          -- flight | train | bus | own | unknown
    carrier_ref            TEXT,                          -- flight no / train no / PNR
    people_on_this_leg     INTEGER NOT NULL,              -- default = party_size, editable
    transport_needed       INTEGER NOT NULL DEFAULT 0,    -- guest yes/no ONLY (no vehicle guess)
    guest_notes            TEXT,

    -- admin-supplied (assignment + confirmation)
    status                 TEXT NOT NULL DEFAULT 'requested'
                             CHECK (status IN ('requested','needs_clarification',
                                               'planned','confirmed','not_required','cancelled')),
    driver_name            TEXT,
    driver_phone_raw       TEXT,
    driver_phone_e164      TEXT,
    vehicle_details        TEXT,                          -- "White Innova, TS09 AB 1234"
    vehicle_seats          INTEGER,
    pickup_point           TEXT,
    pickup_time_confirmed  TEXT,
    admin_notes            TEXT,
    confirmation_sent_at   TEXT,

    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE INDEX idx_legs_reg     ON transport_legs(registration_id);
CREATE INDEX idx_legs_date    ON transport_legs(travel_date);
CREATE INDEX idx_legs_status  ON transport_legs(status);
CREATE INDEX idx_legs_driver  ON transport_legs(driver_name);

-- 3. Audit trail -------------------------------------------------------------
CREATE TABLE audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER,
    leg_id          INTEGER,
    actor           TEXT NOT NULL CHECK (actor IN ('guest','admin','system')),
    action          TEXT NOT NULL,                        -- submitted, edited, driver_assigned,
                                                          -- confirmation_sent, email_failed,
                                                          -- clarification_requested, cancelled, deleted
    details         TEXT,                                 -- human-readable; email recipient/subject
    created_at      TEXT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL
);

-- 4. Email log (minimal — "did it send?") ------------------------------------
CREATE TABLE email_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER,
    type            TEXT NOT NULL,                         -- ack | confirmation | clarification | updated
    to_email        TEXT NOT NULL,
    subject         TEXT,
    status          TEXT NOT NULL,                         -- sent | failed
    error_message   TEXT,
    sent_at         TEXT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL
);
```

**[DECIDED] The email log stores metadata only — never the full email body.**
Reason: the body duplicates PII (driver, pickup, contact) into a second table that also leaks if the
DB leaks. Keep type, recipient, subject, status, time.

### Domain rules (build these)
- On submit, create the `registrations` row **and** seed `transport_legs`: always one `arrival` and
  one `departure` leg, plus any `internal` legs. `people_on_this_leg` defaults to `party_size`,
  editable per leg.
- `transport_needed` is the only transport decision the guest makes per leg (yes/no). Vehicle and
  driver are admin-only.
- Editing a `confirmed` registration sets `edited_after_confirm = 1`, resets registration `status`
  to `in_review`, resets affected confirmed legs to `planned`, bumps `updated_at`, and writes an
  `audit_log` row.
- A leg with `date_tbc = 1`, or a flight/train leg with empty `carrier_ref`, appears on the **chase
  list** report.
- The **seat-demand** report sums `people_on_this_leg` (not leg count) per date over legs where
  `transport_needed = 1`.

---

## 7. Guest flow and screens

**[DECIDED] A 5-step wizard, not a single scrollable page, and not prd1's 10 steps.**
Reason: for elderly mobile users a single long scroll hides progress and buries validation errors;
10 steps is too many "Next" taps and causes drop-off. 5 short steps give a felt sense of progress
("Step 2 of 5"), one idea per screen, and thumb-sized screens.

### 7.1 Guest experience principles [CONSTRAINT]
- **Mobile-first at 360px.** Tap targets min 48px, body text min 17px, one-column layout.
- **Show "Step N of 5" and a progress bar** at the top of every step.
- **Autosave on every change to browser `localStorage`.** Back never loses data. Refresh never
  loses data. **Clear the draft on successful submit.** Provide a **"Start a new registration"**
  button that wipes local state (one relative often fills the form for several others on one phone).
- **Sticky primary button** at the bottom on mobile ("Save & Continue" / final step "Submit").
- **Labels above fields**, never placeholder-only. Helper text with real examples under each field.
- **Inline, plain-language validation** next to the field, checked when leaving each step.
- **Be lenient on phone input** — accept spaces and leading zeros, normalise to E.164; never reject.
- **Floating "Need help? WhatsApp" button on every screen** (guest and admin).
- **Never block submission** for missing times, flight numbers, or unbooked dates — allow TBC.

### 7.2 Landing page (G1)
Warm header with the birthday person's name and "60th". One line of intro. Fold the reassurance in
("Takes about 5 minutes. You can edit later. It's fine if some details aren't final yet."). Buttons:
**Register travel details** · **Edit my registration** · **Find my registration**. Floating WhatsApp
help button. (No separate "Before you start" screen — one fewer tap.)

### 7.3 The 5 steps

| Step | Title (plain language) | Fields |
|---|---|---|
| 1 | About you & consent | Full name; email; phone (country selector, default India); "WhatsApp same as phone?" checkbox; home city; home country; **consent checkbox + one-line DPDP privacy note (required to proceed)** |
| 2 | Who's coming | Party size (number stepper, min 1); optional free-text names; optional special-needs hint (or leave to step 5) |
| 3 | Getting there & going home | **Arrival:** from → to (pre-fill to = event town); date *or* "Not booked yet"; time + what it means; mode (flight/train/bus/car/own/not sure); flight/train ref (optional); **"Do you need a pickup? Yes / No / Not sure"**; people on this leg (default = party size). **Departure:** same, reversed pre-fill, **"Do you need a drop-off?"** |
| 4 | Travel between towns (optional) | "Any travel between towns during your stay?" → up to **2** internal transfer cards: from, to, date (or TBC), people on this leg, "need transport? Yes / No / Not sure", notes. **No vehicle-type field.** |
| 5 | Anything we should know & review | Special requirements (textarea; hint examples: mobility, elderly, baby/child seat, diet — *not* "medical"); then a read-only review summary with inline "Edit" links jumping back to each step; **Submit** |

**[DECIDED] Cap internal transfers at 2 in the guest UI (prd3), even though the schema allows any
number.** Reason: dynamic add/remove is exactly the fiddly mobile interaction that defeats elderly
users; 2 covers nearly every real case, and the admin can add more legs if needed.

### 7.4 Transport question rule [CONSTRAINT]
> The guest only answers **"do you need transport? Yes / No / Not sure"** per leg, plus **how many
> people are on that leg** (defaults to party size). The guest **never** chooses a vehicle type.
> Each leg with "Yes" or "Not sure" becomes a transport row the admin must action.

### 7.5 Success screen (G9) [CONSTRAINT]
> "Saved. Here is your private link to edit your details anytime — **save it or take a screenshot**."
- Show the edit link **on screen** (big, copyable) **and** email it.
- Show the reference code (e.g. `BDAY-2026-0042`).
- Buttons: Copy link · Edit registration · Back to home · Start a new registration.

**[DECIDED] Edit link on the success screen, not email-only.**
Reason: the magic-link email is the same fragile channel that lands in spam; if it's the only way
back in, a locked-out elderly guest is stuck.

---

## 8. Edit-later flow

1. On submit, generate the token (see §12), email the link **and** show it on the success screen.
2. The link `…/edit/<reference>?token=<raw token>` reopens the **same 5-step wizard, pre-filled**.
3. On save: set `updated_at`; if already `confirmed`, set `edited_after_confirm = 1`, reset
   registration to `in_review`, reset affected confirmed legs to `planned`, write an `audit_log` row.
4. **No password anywhere on the guest side.**
5. **"Find my registration" page (G11):** enter email → generic message "if a match exists we've
   emailed a fresh link" → resend a fresh link by email. **Never show registration data from
   reference + email alone.**
6. Link expired / not found page (G12): friendly message + request a new link / contact organiser.

**[DECIDED] Keep guest self-edit, with admin-edits-anything as the reliable fallback.**
Reason: relatives often phone/WhatsApp the organiser instead of using a link; the magic link is kept
(the user asked for it) but is never the only path.

---

## 9. Admin area and screens

Login at `/admin/login` with the single env credential. Every admin route re-checks the session.

### 9.1 Admin design principle — guided, not a spreadsheet

**[CONSTRAINT] The admin is ONE busy person, often on a phone. The admin area must show "what needs
you, one thing at a time" — never a wall of data to interpret.** The organiser must not be able to
miss an unassigned vehicle or an unconfirmed family. Dense tables and reports still exist, but they
are **secondary** ("Advanced"), not the front door.

Three layers, which compose:
1. **Action Centre** = the admin home (work by job).
2. **'Needs you' strip** = a thin banner on every other admin page (so nothing is ever out of sight).
3. **Per-family wizard** = the focused flow when you open one family (work by family).

#### A0 · Action Centre (admin home, route `/admin`)
A short, prioritised list of **jobs with live counts**, each opening a guided flow. Computed live from
the data:

| Job | Count = | Opens |
|---|---|---|
| New registrations to review | registrations with status `submitted` (not yet opened → `in_review`) | All-registrations list / per-family wizard |
| Pickups ready to book a vehicle | planner **suggested** clusters not yet booked | Planner / vehicles |
| Vehicles need a driver | `vehicle_bookings` with no `driver_name` (not cancelled) | **Assign-driver flow** |
| Families ready to confirm | bookings `assigned` but not emailed | **Confirm-&-email flow** |
| Missing flight / date info | legs with `date_tbc` / no date / no carrier ref (chase list) | Chase view |

A job with count 0 shows as done (✓), not a dead end. Below the jobs: links to **All registrations**
and **Reports** (the advanced views).

#### One-at-a-time job flows (the "wizard for admin")
Each job opens a **single item per screen with a progress count ("2 of 4")**, the minimal fields, and
one primary button that saves and advances:
- **Assign-driver flow** — one `VehicleBooking` per screen: shows route, time, who it carries (people
  vs seats); fields = driver name, phone, vehicle reg. "Save & next" sets the booking `assigned` and
  copies the driver onto its covered legs. "Skip for now" advances without saving. **No cost field
  here** (cost lives on the booking; never family-facing). Ends with "all vehicles have a driver →
  confirm families".
- **Confirm-&-email flow** — one family per screen: shows the exact **cost-free** message that family
  will receive (date, route, pickup time IST, driver, vehicle), "Send & next" emails + logs + sets the
  covered legs `confirmed`.

#### A-screens (the rest)

| # | Screen | Key elements |
|---|---|---|
| A1 | Login | Password verified against `ADMIN_PASSWORD_HASH`; rate-limit + lockout; idle session timeout; logout |
| A2 | All registrations (Advanced) | The dense, searchable/filterable table (status, date, needs-transport). Topped by the **'Needs you' strip**. Flags: **possible duplicate** (same email/phone — flag, don't block), **edited-since-confirmation**, **New**. Row → per-family wizard. |
| A3 | **Per-family wizard** | Open one family → 4 calm steps: **Review** (contact, group, special needs; "mark reviewed") → **Transport** (all legs + each leg's booking/driver state) → **Assign** (set driver per booked leg; shows when a vehicle is shared with other families) → **Confirm** (preview the cost-free email, send). **One-click WhatsApp** (`https://wa.me/<e164>`) and the audit trail are on this screen. |
| A4 | Edit registration (admin) | **Full edit of any guest data — same form as the guest** (admin must be able to change anything from a phone request). Reached from the per-family wizard. |
| A5 | Vehicles & bookings (Advanced) | The full hire workflow for power use: planner **suggested** bookings (auto-clustered); create/edit a `VehicleBooking`; attach/detach legs across families; vehicle type/seats, operator, quote; status `to_book → booked → assigned → completed`. Capacity warning when people > seats. (The Action-Centre flows are the simple path *into* this data.) |
| A6 | Reports hub | Links to the reports in §10 (incl. the **hire list** + **driver run sheet**, both from `vehicle_bookings`) |
| A7 | Email log | Sent/failed per registration |
| A8 | Settings | Event details, **"delete all data N days after event"**, **"Export all" (JSON backup download)**, test-email mode |

**'Needs you' strip:** on A2, A5, and the reports pages, a thin banner shows the same outstanding
counts as the Action Centre (e.g. "⚠ Needs you: 4 need a driver · 5 to confirm · 1 to chase") with a
jump back to `/admin`.

**[CONSTRAINT] The admin can fully edit every registration**, identical to the guest form. Without
this the organiser becomes a bottleneck with no tool.

### 9.2 Status model

**[DECIDED] Lean status lists; registration has 4 states, leg has 6.**
Reason: prd1's 5-state registration model and `complete` vs `in_review` duplication is more than 30
families need; prd2's 3 states miss the "I'm working on it" state the organiser wants.

**Registration status**

| Status | Meaning |
|---|---|
| submitted | Guest submitted; not yet looked at |
| in_review | Organiser is working on it (also set when a guest edits after confirmation) |
| confirmed | All transport-needed legs confirmed + emailed |
| cancelled | Not attending / withdrawn |

Rule: registration auto-flips to `confirmed` when every `transport_needed` leg is `confirmed`. If a
guest or admin edits afterwards, set `edited_after_confirm = 1`, drop the registration to
`in_review`, and reset affected legs to `planned`.

**Transport-leg status**

| Status | Meaning |
|---|---|
| requested | Guest asked for transport, unassigned |
| needs_clarification | Missing/unclear info; clarification email sent |
| planned | Driver/vehicle assigned, not yet emailed |
| confirmed | Confirmation email sent to guest |
| not_required | Guest/admin marked no transport needed |
| cancelled | Leg dropped |

**Vehicle-booking status** (one hired vehicle, may cover many legs)

| Status | Meaning |
|---|---|
| suggested | Auto-proposed by the planner from a cluster — not acted on yet |
| to_book | Admin accepted the suggestion; needs an operator + quote |
| booked | Operator confirmed; vehicle reserved |
| assigned | Driver + vehicle reg assigned (copied onto covered legs) |
| completed | Run done |
| cancelled | Booking dropped |

---

## 10. Reports — the part the organiser lives in

**[CONSTRAINT] CSV must be Excel-safe: UTF-8 with BOM, dates written as text `DD-MM-YYYY`, phone
numbers kept as `+…` text.** Without the BOM, Indian names and `+` phone numbers mojibake in Excel
and dates flip to US order.

| Report | Content | Output |
|---|---|---|
| **Arrivals schedule** | Arrival + internal legs with `transport_needed`, grouped by date, sorted by time. Columns: date, time (+meaning, IST), guest, people-on-leg, from→to, carrier ref, driver, vehicle, pickup point, status | Screen + print + CSV |
| **Departures schedule** | Same for departure legs | Screen + print + CSV |
| **Seat demand by date** | Per date: total **people** (sum of `people_on_this_leg` where `transport_needed`), not leg count — so vehicles are sized correctly | Screen |
| **Per-driver run sheet** | Grouped by `driver_name`, sorted by pickup time. One printable page per driver: pickup time, point, guest name + phone, people, from→to, vehicle, notes | Print |
| **Chase list (TBC)** | Legs where `date_tbc = 1` OR (flight/train and `carrier_ref` empty). Columns: guest, contact, WhatsApp link, direction, what's missing | Screen |
| **Headcount** | Total confirmed people; people per arrival date | Screen |
| **Full export** | Every registration flattened with its legs | CSV |

**[CONSTRAINT] Exports exclude secrets and minimise sensitive data.** Edit tokens / hashes **never**
appear in any CSV or report. Health/mobility/dietary notes appear **only** in a dedicated
special-requirements view — **never** on the driver run sheet or general export (run sheets get
forwarded to drivers over WhatsApp).

---

## 11. Email workflows

| Email | Trigger | Contents |
|---|---|---|
| Acknowledgement + edit link | On submit (auto) | Reference code; edit link (also shown on success screen); "the organiser will review and confirm" |
| **Confirmation** | Admin "Confirm & Send" (per leg or per family) | Greeting by name; "Your registration for [N] people is confirmed"; for each confirmed leg: date, from→to, pickup point + time (IST), driver name + phone, vehicle; a line for any special requirement; edit link; organiser contact |
| **Clarification** | Admin "Request clarification" | What's missing (preset reasons: arrival time, flight/train number, pickup point unclear, passenger count, departure details, other) + free text; edit link. Sets affected leg → `needs_clarification` |
| Updated arrangements | Admin edits a leg after confirmation | Updated leg details; "this replaces the previous confirmation" |

Rules:
- **[CONSTRAINT] No money, ever, in anything a family sees.** This is an invitation — guests do not pay
  for local transport. Confirmation, clarification, updated-arrangements, and acknowledgement emails,
  the on-screen success/edit pages, and any guest-visible text must **never** include cost, quote,
  operator/vendor name, or budget. Those fields (`VehicleBooking.quote_amount`, `operator_name`,
  `operator_contact`) are organiser-internal only. Family-facing transport details are limited to:
  date, from→to, pickup point + time (IST), driver name + phone, vehicle type/description.
- Every send writes an `email_log` row and an `audit_log` row.
- **Admin must preview before sending.**
- **Test-email mode:** if `TEST_EMAIL_RECIPIENT` is set, all mail goes there so the flow can be
  checked without emailing real relatives.

---

## 12. Edit-token handling (security)

**[DECIDED] Hashed random token with expiry, not prd3's signed-only token.**
Reason: a stateless signed token can't be revoked server-side without a deny-list; the organiser
wants per-registration revoke/regenerate. Hashed-random gives both expiry and revocation.

```text
token   = secrets.token_urlsafe(32)              # >= 32 bytes from a CSPRNG
stored  = sha256(token).hexdigest()              # only the hash is in the DB
link    = {APP_BASE_URL}/edit/{reference}?token={token}

verify  = sha256(submitted_token) == edit_token_hash
          AND edit_token_revoked_at IS NULL
          AND (edit_token_expires_at IS NULL OR now < edit_token_expires_at)

revoke      = SET edit_token_revoked_at = now
regenerate  = new token, overwrite edit_token_hash, clear revoked + reset expiry
```

- Show the link on the success screen **and** email it.
- The **raw token is never stored**, never logged, never in any export, admin table, or report.
- Default expiry = event date + `EDIT_TOKEN_EXPIRY_DAYS` (default **30**), then treated as revoked.

---

## 13. Routes

### Public

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Landing |
| `/register` | GET | Wizard |
| `/register` | POST | Create registration + seed legs |
| `/success/<reference>` | GET | Success + edit link on screen |
| `/edit/<reference>` | GET | Open pre-filled wizard (token in query) |
| `/edit/<reference>` | POST | Save edits |
| `/find` | GET/POST | "Find my registration" → resend link by email |
| `/privacy` | GET | Privacy notice |

### Admin (all require session; CSRF on every POST)

| Route | Method | Purpose |
|---|---|---|
| `/admin/login` | GET/POST | Login (rate-limited, lockout) |
| `/admin/logout` | POST | Logout |
| `/admin` | GET | **Action Centre** (jobs + live counts) |
| `/admin/assign` | GET | Assign-driver flow (one booking at a time) |
| `/admin/confirm` | GET | Confirm-&-email flow (one family at a time) |
| `/admin/registrations` | GET | All-registrations list (Advanced) |
| `/admin/registrations/<id>` | GET | **Per-family wizard** (Review → Transport → Assign → Confirm) |
| `/admin/registrations/<id>` | POST | Edit registration / admin notes / mark reviewed |
| `/admin/registrations/<id>/confirm-all` | POST | Confirm all unsent legs + email |
| `/admin/legs/<id>` | POST | Save driver/vehicle/pickup (→ `planned`) |
| `/admin/legs/<id>/confirm` | POST | Set `confirmed` + send confirmation email |
| `/admin/legs/<id>/clarify` | POST | Send clarification, set `needs_clarification` |
| `/admin/vehicles` | GET | Vehicle bookings list + planner suggestions (hire workflow) |
| `/admin/vehicles/new` | POST | Create a booking (often from a suggested cluster) |
| `/admin/vehicles/<id>` | GET/POST | View/edit a booking: vehicle, operator, quote, driver, status; attach/detach legs |
| `/admin/vehicles/<id>/confirm` | POST | Confirm all covered legs + email each family |
| `/admin/reports` | GET | Reports hub |
| `/admin/reports/hire` | GET | **Vehicles-to-hire list** (bookings grouped by date) |
| `/admin/reports/arrivals.csv` | GET | Arrivals |
| `/admin/reports/departures.csv` | GET | Departures |
| `/admin/reports/seat-demand` | GET | People-per-date demand |
| `/admin/reports/run-sheet` | GET | Per-driver run sheet (print) — grouped from `vehicle_bookings` |
| `/admin/reports/chase-list` | GET | TBC / missing carrier info |
| `/admin/reports/export.csv` | GET | Flattened export (no tokens) |
| `/admin/email-log` | GET | Sent/failed |
| `/admin/settings` | GET/POST | Event config |
| `/admin/settings/export` | GET | Export-all JSON backup download |
| `/admin/settings/delete-all` | POST | Delete all data after event |

---

## 14. Validation rules

**Required to submit:** main contact name; email (valid); phone; home country; party size (>= 1);
consent checkbox ticked; for each of arrival and departure — from, to, and "need transport?" answered.

**Lenient / optional:** dates (allow blank + `date_tbc`); times; flight/train numbers; home city;
relationship; stay details; special requirements; internal legs.

**Conditional / behaviour:**
- Phone: accept messy input, normalise to E.164 with `phonenumbers`; store both raw and E.164;
  never reject.
- If a leg's transport answer is "Yes" or "Not sure" → leg starts at `requested`.
- "Not sure yet" / "Not booked yet" never blocks submission; it powers the chase list.
- Email format checked; everything server-side validated again (never trust the client).
- Escape all user text in admin views.

---

## 15. Visual design and accessibility

**[DECIDED] Palette: teal (primary), gold (accent), cream (background).**
Reason: a coding model builds better from a decided palette than from "gold, maroon, or teal." Warm,
elegant, lightly celebratory (birthday name/age in the header).

Style: white cards, rounded corners, subtle shadow, generous whitespace, clean sans-serif, large
buttons, simple line icons. Avoid heavy birthday graphics, too many colours, dense public forms,
forced maps, spreadsheet-like public UI.

**Accessibility (adopt prd1 §28 wholesale):** large tap targets; high-contrast text; keyboard
accessible; labels above fields; no placeholder-only labels; clear validation messages linked to
fields; one-column public layout; avoid tiny dropdowns; examples and helper text everywhere.

---

## 16. Phone, date, and timezone rules

- **Phone:** `intl-tel-input` frontend (default country India) + `phonenumbers` backend. Store raw
  entry **and** E.164. Same for driver phone. One phone + a "WhatsApp same as phone" checkbox; an
  optional alternate number is fine but not prominent.
- **Timezone:** default `Asia/Kolkata`. Store dates/times as ISO-8601 text. Operational pickup/
  drop-off times are India time.
- **Dates:** input and display as **DD-MM-YYYY**. Display times with **IST** and what the time means
  (e.g. "lands 10:30 IST"). Helper text: "Enter the time shown on your ticket. Pickups are confirmed
  in India time."

---

## 17. Security, privacy, and retention [CONSTRAINT]

**[DECIDED] Store `ADMIN_PASSWORD_HASH` (bcrypt/argon2), never a plaintext `ADMIN_PASSWORD`.**
Reason: comparing a raw env password exposes the credential directly if the env/process leaks.

```
SECURITY & PRIVACY — NON-NEGOTIABLE RULES

Edit tokens (guest magic link)
- >= 32 bytes from a CSPRNG, URL-safe. Store ONLY sha256(token). Raw token never stored.
- Expires at event_date + EDIT_TOKEN_EXPIRY_DAYS (default 30); then treated as revoked.
- Admin can revoke and regenerate.
- Never in logs, admin tables, CSVs, or any report.
- Lost-link recovery: email + reference returns ONLY a generic "if a match exists we've emailed
  a fresh link" message. Registration data is NEVER shown from reference + email alone.

Admin authentication
- Single admin. ADMIN_PASSWORD_HASH (bcrypt or argon2) in env. No plaintext.
- Rate-limit login (e.g. 5 attempts/min/IP) + temporary lockout after repeated failures.
- Session cookie: HttpOnly, Secure, SameSite=Strict. Idle timeout 30 min. Explicit logout.
- Every admin route re-checks the session. No id-guessing access.
- CSRF protection on ALL state-changing forms — admin actions AND the guest edit form.
- HTTPS only in production (HSTS recommended).

Data handling
- Parameterised SQL only. Validate every input server-side. Escape all user text in admin views.
- SQLite file lives outside the web root; never web-served. Restrictive file permissions.
- Backups: admin "Export all" produces one JSON file of every registration document; keep off-box
  copies (download before each big change and before the post-event delete).

Consent & privacy (DPDP-first, GDPR-aware — some travellers are UK/EU)
- Step-1 required consent checkbox + one-line privacy note; cannot submit without it.
- Store consent_given + consent_at.
- Privacy note: "We use these details only to coordinate your travel, pickups, drop-offs, food,
  stay, and event arrangements for the celebration. Your details are visible only to the organiser.
  Please share only what is needed for travel, accessibility, or dietary support — do not enter
  detailed medical information. You can edit or ask us to delete your details at any time. We will
  delete all data within [N] days after the event."

Data minimisation & special-category data
- Address optional (omit unless needed). Do NOT ask for "medical conditions" — only
  travel/accessibility/dietary support needs. Treat the whole dataset as sensitive
  (special-category under GDPR / sensitive under DPDP).

Retention & deletion
- Per-registration delete/cancel (admin).
- Settings action: "Delete all data N days after the event" (default DELETE_ALL_AFTER_EVENT_DAYS=60).

Hosting
- Netlify (serverless) + Netlify Blobs for storage. Netlify Blobs is US-region; if many guests are
  UK/EU residents, disclose this in the privacy note (transparency satisfies GDPR for ~30 people at a
  family event). Free plan; no separate database, no credit card.

Exports — what must NEVER appear
- Edit tokens or hashes: never.
- Health/mobility/dietary notes: only in the special-requirements view — NOT on driver run-sheets
  or the general export.
```

**[DECIDED] DPDP-first consent wording, GDPR-aware.**
Reason: the event and most guests are in India; the wording also satisfies GDPR transparency for the
UK/EU travellers.

---

## 18. Environment variables

Set these in the Netlify dashboard (Site → Environment variables). No `DATABASE_PATH` — Netlify Blobs
needs no connection string; it is wired in automatically for the site's functions.

```env
APP_BASE_URL=https://your-site.netlify.app   # HTTPS only

ADMIN_PASSWORD_HASH=                         # argon2/bcrypt hash — NEVER plaintext
SESSION_SECRET=                              # long random secret for signing the admin cookie
SESSION_IDLE_TIMEOUT_MIN=30
LOGIN_RATELIMIT_PER_MIN=5                     # lockout counter stored in the `system` blob store

# Email (Resend recommended; or SMTP_* if using SMTP)
RESEND_API_KEY=
EMAIL_FROM=Family Travel Coordinator <noreply@your-domain>
TEST_EMAIL_RECIPIENT=                        # set => all mail goes here (test mode)

DEFAULT_TIMEZONE=Asia/Kolkata
EDIT_TOKEN_EXPIRY_DAYS=30                     # measured from the event date
DELETE_ALL_AFTER_EVENT_DAYS=60

# Event config (also editable in Settings)
EVENT_TOWN=Bidar
EVENT_HUB=Hyderabad
EVENT_DATE=
BIRTHDAY_NAME=
BIRTHDAY_AGE=60
ORGANISER_NAME=
ORGANISER_WHATSAPP_E164=                      # powers the floating help button
EVENT_CODE=                                   # optional spam gate (blank = off)
```

---

## 19. Acceptance checklist (definition of done)

- [ ] Guest completes the 5-step wizard on a phone; **back and refresh never lose data**; draft
      clears on submit; "Start a new registration" wipes local state.
- [ ] International phone numbers accepted (default India), stored as E.164 + raw, never rejected.
- [ ] Multi-leg journeys (Hyderabad → Bidar → other town → back) capturable, with people-per-leg.
- [ ] Guest only answers transport yes/no/not-sure per leg; never picks a vehicle.
- [ ] "Not booked yet" dates allowed; chase list shows them.
- [ ] On submit, the edit link shows **on screen** and emails; clicking it reopens the pre-filled
      wizard.
- [ ] Editing a confirmed registration flags it, resets to `in_review`, resets affected legs.
- [ ] Edit token stored as a hash only; expires; admin can revoke/regenerate; never in exports.
- [ ] "Find my registration" never reveals data from reference + email; only resends a link.
- [ ] Admin login uses `ADMIN_PASSWORD_HASH`, has rate-limit + lockout + idle timeout + logout.
- [ ] Non-admins can't reach any admin/report/edit route; CSRF on all POSTs (admin + guest edit).
- [ ] Admin **Action Centre** shows live job counts; **assign-driver** and **confirm-&-email** flows
      work one-at-a-time with a progress count; **'Needs you' strip** appears on advanced pages.
- [ ] Per-family wizard walks Review → Transport → Assign → Confirm; admin can mark reviewed.
- [ ] Admin can view, search, filter, **fully edit** any registration; duplicates flagged not blocked.
- [ ] Admin assigns per-leg driver/vehicle/pickup, confirms per leg and per family; confirmation
      email sends with correct details and is logged.
- [ ] Reports: arrivals, departures, **seat demand by people**, **per-driver run sheet**, chase list,
      headcount, full CSV — all working and printable.
- [ ] CSV is UTF-8 with BOM, dates DD-MM-YYYY text, phones as `+…` text.
- [ ] Driver run sheet / general export contain **no** health/mobility notes and **no** tokens.
- [ ] **No family-facing message (email, success/edit page, confirmation) ever shows cost, quote,
      operator, or budget** — guests don't pay for local transport.
- [ ] Consent captured (given + timestamp); delete-registration and delete-all-after-event exist;
      privacy note shown.
- [ ] Dates DD-MM-YYYY; times labelled with meaning + IST; timezone Asia/Kolkata.
- [ ] Data in Netlify Blobs persists across redeploys (verified in Phase 0.5); "Export all" JSON
      backup downloads and restores correctly, kept off-box.
- [ ] Floating WhatsApp help button on every screen; one-click `wa.me` links in admin.
- [ ] Test-email mode works.

---

## 20. Decisions the organiser may want to revisit

These were decided above to keep the build unblocked. Change them only if the noted assumption is
wrong.

1. **5-step wizard** (vs single scrollable page). Chosen for elderly mobile users.
2. **Internal transfers capped at 2 in the guest UI.** The admin can add more legs manually if a
   guest has a complex itinerary.
3. **Headcount only — no per-person `travellers` table.** Build per-person names + age-bands only if
   car seats by age genuinely matter.
4. **Edit-token expiry 30 days after the event** (not 365). Lengthen if late edits are expected.
5. **Spam gate (`EVENT_CODE`) off by default.** Turn on if the public URL gets shared widely.
6. **English-only UI.** Add Hindi/Telugu labels if many guests prefer it.
7. **Keep guest self-edit** (admin edit is the fallback). Drop self-edit if email deliverability
   proves shaky.
8. **Optional admin 2FA / IP allowlist** left out as over-engineering for one organiser; add if you
   want belt-and-braces.
9. **Hardcoded event details** (town, hub, dates, organiser name + WhatsApp, birthday name/age,
   accent colour) to confirm in Settings / env.

---

## 21. Final build prompt block

```text
Build a complete, deployable mobile-first website called "Family Travel Coordinator" for a 60th
birthday celebration in India (event town Bidar; airport hub Hyderabad). About 30 family groups,
many elderly and international, register travel + transport on their phones. One organiser runs a
private admin area to assign drivers and confirm by email. Data in Netlify Blobs (server-side).

STACK: TypeScript, Astro (SSR, output: 'server') with @astrojs/netlify adapter, Tailwind CSS, a
transactional email provider (Resend) with a verified sender. Deploy to NETLIFY (free plan). Storage
is NETLIFY BLOBS — no SQL database, no hosted DB, no credit card. NEVER write persistent data to the
function's local disk/tmp (it is wiped between invocations and on redeploy). Admin sessions use a
SIGNED STATELESS COOKIE; the login-lockout counter lives in a Netlify Blobs key (no in-process state).

DOMAIN MODEL: a journey is a LIST OF TRAVEL LEGS (arrival, internal, departure), not a fixed
arrival/departure pair. Each leg has its own people count (default = party size). The guest only
answers "need transport? yes/no/not sure" per leg and never picks a vehicle; the admin sizes the
vehicle from the seat count.

DATA: store ONE JSON document per family in a Netlify Blobs store named `registrations`, keyed by
reference_number, with its legs[], audit[], and emails[] arrays embedded. List + filter in memory
(~30 docs). On submit, seed one arrival and one departure leg plus any internal legs. Match the
TypeScript document shape in PRD §6 exactly.

GUEST: a 5-step wizard (About you & consent; Who's coming; Getting there & going home; Travel between
towns — max 2 internal transfers; Anything we should know & review). Mobile-first at 360px, big tap
targets, labels above fields, autosave to localStorage that survives back AND refresh and clears on
submit, sticky primary button, inline plain-language validation, floating WhatsApp help button on
every screen. Lenient phone capture (intl-tel-input + phonenumbers, default India, store E.164 + raw,
never reject). Allow "Not booked yet" dates. Consent checkbox with DPDP-style privacy note in step 1
(required). Success screen shows the edit link ON SCREEN and emails it; show reference code.

EDIT: magic link /edit/<reference>?token=<raw>. Store ONLY sha256(token); expires at event + 30 days;
admin can revoke/regenerate. Reopens the pre-filled wizard. Editing a confirmed registration flags
it, resets to in_review, resets affected legs to planned. "Find my registration" only resends a link,
never shows data from reference + email.

ADMIN: login with ADMIN_PASSWORD_HASH (argon2/bcrypt, never plaintext) + rate-limit + lockout (counter
in Blobs) + idle timeout + logout + CSRF on every POST (admin and guest edit). Dashboard with KPI cards + searchable/
filterable table + duplicate and edited-since-confirmation flags. Full edit of any registration.
Per-leg driver/vehicle/pickup assignment, "Confirm & Send" per leg and "Confirm all unsent legs for
this family", clarification email. One-click wa.me links. Email preview before send. Test-email mode
via TEST_EMAIL_RECIPIENT.

REPORTS: arrivals schedule, departures schedule, seat demand by PEOPLE per date, per-driver printable
run sheet, chase list (date_tbc or missing carrier ref), headcount, full CSV export. CSV is UTF-8
with BOM, dates DD-MM-YYYY as text, phones as +… text. Tokens and health/mobility notes NEVER appear
in run sheets or the general export.

DATES/TIME: store ISO-8601, display DD-MM-YYYY and times with IST + what the time means. Timezone
Asia/Kolkata.

SECURITY/PRIVACY: HTTPS only; never build SQL strings from input (validate + type every field); escape
all user text in admin views (Astro auto-escapes — never use set:html on user data); "Export all" JSON
backups off-box; consent stored with timestamp; data minimisation (no medical questions);
delete-registration and delete-all-after-event actions; disclose US storage region (Netlify Blobs).

DESIGN: warm, lightly celebratory, teal (primary) / gold (accent) / cream (background); white cards,
rounded corners, generous whitespace, large legible type, simple line icons. Accessible: high
contrast, keyboard usable, no placeholder-only labels.

OUTPUT: a complete Astro + Netlify project — pages, server endpoints, a typed Netlify Blobs data layer
(store.ts), package.json, netlify.toml, astro.config, .env.example, a vitest test suite, and a README
with local run (netlify dev), env vars, Netlify deploy steps, and sample-data seeding.

DO NOT BUILD: guest accounts/passwords, payments, ticket uploads, Google Maps, real-time tracking,
multiple admins/roles, multi-event, native apps, automated WhatsApp/SMS sending.

Use this PRD as the single source of truth.
```
```
