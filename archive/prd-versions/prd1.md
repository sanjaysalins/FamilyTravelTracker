# PRD / Product Specification

# Family Travel Registration Website

## 60th Birthday Celebration Travel & Transport Coordination

---

## 1. Product Summary

Build a simple, professional, mobile-first website to collect travel and transport details from family members attending a 60th birthday celebration in India.

Family members will be travelling from different parts of India and from abroad. The website must help the organiser collect details such as:

* Who is travelling
* Main family contact
* Number of people in the travelling group
* Arrival date, time, mode, and location
* Departure date, time, mode, and location
* Pickup and drop-off requirements
* Extra transport legs, such as Hyderabad to Bidar, Bidar to Hyderabad, hotel to venue, etc.
* Stay/accommodation information
* Special travel, dietary, mobility, or accessibility requirements
* Contact details including international phone and WhatsApp numbers

The website must also provide an admin area where the organiser can:

* View all registrations
* Review and edit transport requests
* Assign drivers and vehicles
* Confirm pickup/drop-off arrangements
* Send confirmation emails
* Request clarification from travellers
* Export reports
* Query or inspect a simple SQLite database

The system should be easy for non-technical family members, especially older users. The public registration process should be a guided wizard with simple screens and large buttons.

---

## 2. Product Goals

### 2.1 Primary Goals

1. Allow family members to register travel details easily.
2. Capture enough information to coordinate pickups, drop-offs, local transport, and driver assignments.
3. Allow users to edit their registration later using a secure private link.
4. Allow the organiser/admin to privately view, review, update, and confirm travel arrangements.
5. Send acknowledgement and confirmation emails.
6. Store data in a lightweight server-side SQLite database.
7. Generate practical transport reports for planning.

### 2.2 Secondary Goals

1. Make the website look clean, professional, warm, and appropriate for a family event.
2. Support Indian and international travellers.
3. Support international phone numbers and WhatsApp numbers.
4. Work well on mobile phones.
5. Avoid user accounts for public users.
6. Avoid over-engineering.
7. Keep the admin workflow simple, fast, and operationally useful.

---

## 3. Non-Goals

The first version should not include:

* Public user accounts
* Password login for travellers
* Payment processing
* Ticket uploads
* Complex role-based permissions
* Real-time driver tracking
* Google Maps dependency
* SMS or WhatsApp automation unless added later
* Mobile app
* Multi-event management

---

## 4. Target Users

### 4.1 Family Traveller

A family member or family representative who is attending the birthday celebration.

They may be:

* Travelling within India
* Travelling from abroad
* Registering on behalf of a group
* Using a mobile phone
* Non-technical
* Elderly or not comfortable with complex forms
* Unsure of some travel details at the time of registration

### 4.2 Event Organiser / Admin

The person coordinating logistics.

The admin needs to:

* See all family registrations
* See all transport requests
* Identify incomplete or unclear details
* Assign drivers and vehicles
* Send confirmation emails
* Export daily pickup/drop-off reports
* Quickly answer questions like:

  * Who arrives today?
  * Who needs pickup tomorrow?
  * Which transport requests are unassigned?
  * Which travellers updated details after confirmation?
  * Which families have elderly or mobility support needs?

---

## 5. Key Design Principles

The website should be:

* Mobile-first
* Simple
* Guided
* Warm but professional
* Easy for older family members
* Clear and forgiving
* Designed around free-text Indian location entry
* Useful for international travellers

Important UX rule:

> The public form should feel like one simple question at a time, not an admin spreadsheet.

Important admin rule:

> The admin should always be able to see who needs transport, when, from where, to where, and who is handling it.

---

## 6. Recommended Technology Stack

Recommended simple stack:

* Backend: Python Flask
* Database: SQLite
* Templates: Jinja2
* Styling: Bootstrap or Tailwind CSS
* Email: SMTP via standard email provider
* Hosting: small VPS, Render, Railway, Fly.io, or similar

Alternative stack:

* Node.js with Express or Next.js
* SQLite
* Prisma, Drizzle, or better-sqlite3
* Nodemailer
* Tailwind CSS

Preferred first build:

> Flask + SQLite + server-rendered pages + simple JavaScript for wizard state.

This is likely the best fit because the product is small, operational, and should be easy to inspect and maintain.

---

## 7. High-Level User Journeys

---

### 7.1 Traveller Registration Journey

1. User opens the website.
2. User sees a welcome page.
3. User clicks “Register Travel Details”.
4. User sees a short “Before You Start” page.
5. User completes a wizard:

   * Contact details
   * Family/group details
   * Arrival details
   * Arrival pickup
   * Departure details
   * Departure drop-off
   * Other transport requests
   * Stay details
   * Special requirements
   * Review and submit
6. User submits registration.
7. System generates:

   * Registration reference number
   * Secure edit token
8. User sees success page.
9. User receives acknowledgement email with edit link.
10. Admin reviews details later.
11. Admin confirms transport arrangements and sends confirmation email.

---

### 7.2 Edit Existing Registration Journey

1. User clicks “Edit Existing Registration”.
2. User can either:

   * Use their secure edit link from email, or
   * Enter registration reference and email address to request a fresh edit link.
3. User opens pre-filled wizard.
4. User updates details.
5. System saves changes.
6. Registration status changes to “updated_by_traveller”.
7. Admin can see the update.
8. User receives update acknowledgement email.
9. If details changed after confirmation, admin sees a warning.

---

### 7.3 Admin Journey

1. Admin visits `/admin`.
2. Admin logs in using secret password from environment variable.
3. Admin sees dashboard with key metrics.
4. Admin reviews:

   * New registrations
   * Updated registrations
   * Unassigned transport
   * Today’s transport
   * Needs clarification
5. Admin opens a registration or transport request.
6. Admin assigns:

   * Driver
   * Driver phone
   * Vehicle
   * Confirmed date/time
   * Confirmed pickup/drop-off locations
7. Admin previews confirmation email.
8. Admin sends confirmation email.
9. Email log and audit log are updated.
10. Admin can export reports.

---

## 8. MVP Scope

### 8.1 Must-Have

* Public home page
* Guided registration wizard
* SQLite database
* Secure edit link
* Edit existing registration
* Admin login
* Admin dashboard
* Admin registration list
* Admin registration detail page
* Transport request model
* Driver and vehicle assignment per transport leg
* Confirmation email
* Clarification email
* CSV exports
* International phone number support
* India timezone support
* Mobile-friendly UI

### 8.2 Should-Have

* Daily transport board
* Changed-after-confirmation warning
* Email log
* Audit log
* Duplicate registration warning
* Unassigned transport view
* Status filters

### 8.3 Could-Have

* Excel export
* WhatsApp message template copying
* Multiple admin users
* Server-side draft saving
* More advanced reporting
* Calendar export

### 8.4 Do Not Build Initially

* Ticket upload
* Payment
* Google Maps dependency
* Driver mobile app
* Real-time tracking
* Traveller accounts
* Complex permissions

---

## 9. Public Website Screens

---

# Screen 1: Home / Welcome Page

## Purpose

Welcome family members and direct them to register or edit.

## Content

Title:

> Family Travel Registration
> For the 60th Birthday Celebration

Short text:

> Please share your travel plans so we can help coordinate pickups, drop-offs, and local transport during the celebration.

Primary buttons:

* Register Travel Details
* Edit Existing Registration

Secondary link:

* Contact Organiser

## UX Notes

* Keep the page simple.
* Avoid long explanations.
* Use warm but professional visuals.
* Make the primary button very clear.

---

# Screen 2: Before You Start

## Purpose

Prepare users for the wizard and reduce confusion.

## Content

Tell users they may need:

* Main contact name
* Email address
* Mobile or WhatsApp number
* Number of people travelling
* Arrival details
* Departure details
* Pickup/drop-off needs
* Any support or special requirements

Suggested copy:

> This form should take about 5–10 minutes.
> You can update your details later if your plans change.
> Please keep your flight, train, or journey details nearby if you have them. It is okay if some details are not final yet.

Primary button:

* Start Registration

---

## 10. Registration Wizard

The wizard should be broken into short screens.

Each wizard screen should show:

* Step number
* Section title
* Progress indicator
* Clear instructions
* Large fields
* Back button
* Save & Continue button

Example:

> Step 4 of 10
> Arrival Pickup

Buttons:

* Back
* Save & Continue

On mobile, primary button should appear first or be sticky at the bottom.

---

# Screen 3: Contact Details

## Purpose

Capture the main contact for the family group.

## Fields

| Field                              | Type                      | Required |
| ---------------------------------- | ------------------------- | -------: |
| Full name                          | Text input                |      Yes |
| Email address                      | Email input               |      Yes |
| Mobile / WhatsApp number           | International phone input |      Yes |
| Is WhatsApp same as mobile?        | Yes/No                    |       No |
| Alternative contact number         | International phone input |       No |
| Country travelling from            | Dropdown/search           |      Yes |
| City travelling from               | Text input                |       No |
| Relationship to birthday celebrant | Text/dropdown             |       No |

## Helper Text

Phone examples:

* India: `+91 98765 43210`
* UK: `+44 7700 900123`
* USA: `+1 555 123 4567`

## Validation

* Full name required.
* Email must be valid.
* Phone should be stored in international E.164 format where possible.
* Raw phone entry should also be stored for reference.

---

# Screen 4: Family / Group Details

## Purpose

Capture who is travelling with the main contact.

## Fields

| Field                                          | Type                  |    Required |
| ---------------------------------------------- | --------------------- | ----------: |
| Number of people travelling in your group      | Number stepper        |         Yes |
| Traveller names                                | Repeating text fields | Recommended |
| Any children travelling?                       | Yes/No                |          No |
| Number of children                             | Number                | Conditional |
| Any elderly people travelling?                 | Yes/No                |          No |
| Anyone needing mobility/accessibility support? | Yes/No                |          No |
| Mobility/accessibility support notes           | Textarea              | Conditional |

## UX Notes

* Do not make every traveller name mandatory.
* The group size must be at least 1.
* Traveller fields should dynamically match the group size where practical.
* Allow “Add another traveller”.

---

# Screen 5: Arrival Details

## Purpose

Capture how and when the group arrives.

## Fields

| Field                   | Type                  | Required |
| ----------------------- | --------------------- | -------: |
| Arrival date            | Date picker           |      Yes |
| Arrival time            | Time picker           |       No |
| Arrival mode            | Choice cards/dropdown |      Yes |
| Arrival location        | Text input            |      Yes |
| Exact arrival point     | Text input            |       No |
| Coming from             | Text input            |       No |
| Flight/train/bus number | Text input            |       No |
| Arrival notes           | Textarea              |       No |

## Arrival Mode Options

* Flight
* Train
* Bus
* Car
* Other
* Not sure yet

## Location Helper Text

Examples:

* Hyderabad Airport
* Bidar Railway Station
* Hotel
* Family home
* Bus stand
* Other address

## UX Notes

* Do not rely only on maps or location autocomplete.
* Free text is required because Indian local locations may not map cleanly.
* Flight/train/bus number should be requested but not mandatory.

---

# Screen 6: Arrival Pickup

## Purpose

Capture whether the family needs pickup after arrival.

## Fields

| Field                               | Type               |    Required |
| ----------------------------------- | ------------------ | ----------: |
| Do you need pickup when you arrive? | Large choice cards |         Yes |
| Pickup location                     | Text input         | Conditional |
| Pickup destination                  | Text input         | Conditional |
| Desired pickup date/time            | Date/time input    | Conditional |
| Number of passengers for pickup     | Number             | Conditional |
| Luggage amount                      | Dropdown           |          No |
| Pickup notes                        | Textarea           |          No |

## Pickup Options

* Yes, please arrange pickup
* No, I will arrange my own transport
* Not sure yet

## Luggage Options

* Light
* Medium
* Heavy
* Not sure

## Technical Requirement

If pickup is needed or marked “not sure yet”, create a `transport_requests` row with:

```text
transport_type = arrival_pickup
```

---

# Screen 7: Departure Details

## Purpose

Capture how and when the group leaves.

## Fields

| Field                   | Type                  | Required |
| ----------------------- | --------------------- | -------: |
| Departure date          | Date picker           |      Yes |
| Departure time          | Time picker           |       No |
| Departure mode          | Choice cards/dropdown |      Yes |
| Departure location      | Text input            |      Yes |
| Destination after event | Text input            |       No |
| Flight/train/bus number | Text input            |       No |
| Departure notes         | Textarea              |       No |

## Departure Mode Options

* Flight
* Train
* Bus
* Car
* Other
* Not sure yet

---

# Screen 8: Departure Drop-off

## Purpose

Capture whether the family needs transport to their departure point.

## Fields

| Field                           | Type               |    Required |
| ------------------------------- | ------------------ | ----------: |
| Do you need drop-off transport? | Large choice cards |         Yes |
| From location                   | Text input         | Conditional |
| Drop-off location               | Text input         | Conditional |
| Desired drop-off date/time      | Date/time input    | Conditional |
| Number of passengers            | Number             | Conditional |
| Luggage amount                  | Dropdown           |          No |
| Drop-off notes                  | Textarea           |          No |

## Drop-off Options

* Yes, please arrange drop-off
* No, I will arrange my own transport
* Not sure yet

## Technical Requirement

If drop-off is needed or marked “not sure yet”, create a `transport_requests` row with:

```text
transport_type = departure_dropoff
```

---

# Screen 9: Other Transport Requests

## Purpose

Capture additional transport legs beyond arrival and departure.

Examples:

* Hyderabad Airport to Bidar
* Bidar to Hyderabad
* Hotel to birthday venue
* Family home to railway station
* Local transport during stay

## Initial Question

> Do you need any other transport during the trip?

Options:

* No, only arrival/departure transport
* Yes, add another journey
* Not sure yet

## Repeating Journey Fields

| Field                        | Type        | Required |
| ---------------------------- | ----------- | -------: |
| Transport date               | Date picker |      Yes |
| Preferred time               | Time picker |       No |
| From location                | Text input  |      Yes |
| To location                  | Text input  |      Yes |
| Number of passengers         | Number      |      Yes |
| Luggage amount               | Dropdown    |       No |
| Vehicle preference           | Dropdown    |       No |
| Is this transport essential? | Yes/No      |       No |
| Notes                        | Textarea    |       No |

## Vehicle Preference Options

* No preference
* Car
* SUV
* Tempo traveller
* Minibus
* Other

## UX Notes

* Use expandable cards.
* Allow “Add another journey”.
* Allow “Remove journey”.
* Avoid showing a huge dense form by default.

---

# Screen 10: Stay Details

## Purpose

Capture where the family will stay during the event.

## Fields

| Field                      | Type         | Required |
| -------------------------- | ------------ | -------: |
| Where will you be staying? | Choice cards |       No |
| Hotel/home/address/area    | Textarea     |       No |
| Check-in date              | Date         |       No |
| Check-out date             | Date         |       No |
| Stay notes                 | Textarea     |       No |

## Stay Options

* Hotel
* Family home
* Own arrangement
* Not sure yet
* Other

## UX Notes

Do not make stay details required. It is useful for local transport but may not be final.

---

# Screen 11: Special Requirements

## Purpose

Capture practical support needs.

## Fields

| Field                                            | Type     | Required |
| ------------------------------------------------ | -------- | -------: |
| Dietary requirements                             | Textarea |       No |
| Mobility, accessibility, or travel support needs | Textarea |       No |
| Elderly support notes                            | Textarea |       No |
| Other notes for organiser                        | Textarea |       No |

## Privacy-Sensitive Wording

Avoid asking for “medical requirements” directly.

Use:

> Please only share details that are useful for travel, pickup, drop-off, food, or stay arrangements.

---

# Screen 12: Review and Submit

## Purpose

Let users verify everything before submitting.

## Layout

Show grouped summary cards:

1. Contact details
2. Family/group details
3. Arrival details
4. Arrival pickup
5. Departure details
6. Departure drop-off
7. Other transport
8. Stay details
9. Special requirements

Each section should have an Edit button.

## Required Confirmation Checkbox

> I confirm these details are correct to the best of my knowledge. I understand I can update them later if plans change.

## Primary Action

* Submit Registration

---

# Screen 13: Registration Success

## Purpose

Confirm successful submission.

## Content

Show:

* Thank you message
* Registration reference number
* Confirmation that email was sent
* Explanation of next steps
* Reminder that they can update details later

Example:

> Thank you. Your travel details have been received.
> Your registration reference is: `BDAY-2026-0042`
> We have emailed you a copy of your registration details. The organiser will review your travel needs and confirm pickup/drop-off arrangements.

Actions:

* Save Reference Number
* Edit Registration
* Back to Home

---

## 11. Edit Registration Screens

---

# Screen 14: Edit Existing Registration Entry

## Purpose

Allow users to retrieve edit access.

## Preferred Method

User opens private edit link from acknowledgement email.

## Fallback Method

User enters:

| Field                  | Required |
| ---------------------- | -------: |
| Registration reference |      Yes |
| Email address          |      Yes |

Action:

* Send me an edit link

## Security Requirement

Do not show registration details directly after entering reference and email. Send a fresh edit link to the registered email address.

---

# Screen 15: Edit Registration Wizard

## Purpose

Allow users to update existing details.

## Behaviour

* Same wizard screens as registration.
* Existing details should be pre-filled.
* Show banner:

> You are editing registration `BDAY-2026-0042`. Changes will be sent to the organiser for review.

Submit button:

* Save Updated Details

## Technical Behaviour

After edit:

* Save changes.
* Update `registrations.status` to `updated_by_traveller`.
* Update `updated_at`.
* Add audit log entry.
* Send update acknowledgement email.
* If confirmation had already been sent, flag record as changed after confirmation.

---

# Screen 16: Edit Success

## Content

> Your registration has been updated.
> The organiser will review the changes and confirm any transport arrangements.

Actions:

* Back to Home
* Edit Again

---

## 12. Admin Screens

---

# Screen 17: Admin Login

## Route

`/admin/login`

## Fields

| Field    | Type           |
| -------- | -------------- |
| Password | Password input |

## Requirements

* Password comes from environment variable.
* Use secure HTTP-only session cookie.
* Add rate limiting.
* Admin session should expire after inactivity.
* Do not hardcode password.

---

# Screen 18: Admin Dashboard

## Purpose

Show operational overview.

## Metric Cards

* Total registrations
* Pending review
* Updated by traveller
* Transport requests
* Unassigned transport
* Confirmed transport
* Needs clarification
* Arriving today
* Departing today

## Main Sections

1. Today’s Transport
2. Needs Attention
3. Recently Updated
4. Unassigned Transport

## Actions

* View Registrations
* View Transport Board
* Export CSV
* View Reports

---

# Screen 19: Admin Registration List

## Purpose

Search and filter family registrations.

## Table Columns

| Column            |
| ----------------- |
| Reference         |
| Main contact      |
| WhatsApp          |
| Email             |
| Group size        |
| Arrival date      |
| Pickup required   |
| Departure date    |
| Drop-off required |
| Status            |
| Last updated      |
| Action            |

## Filters

* Status
* Arrival date
* Departure date
* Pickup required
* Drop-off required
* Country travelling from
* Updated since confirmation
* Search by name, email, phone, or reference

## UX Notes

* Desktop: table.
* Mobile: stacked cards.
* Highlight records that need action.

---

# Screen 20: Admin Registration Detail

## Purpose

View full details of one registration.

## Layout

Use tabs or sections:

* Overview
* Travellers
* Transport
* Emails
* Audit Log

## Overview Content

* Main contact name
* Email
* Phone / WhatsApp
* Country/city from
* Relationship
* Group size
* Children/elderly/mobility notes
* Stay details
* Dietary/support notes
* Internal admin notes

## Warning Banners

Show if relevant:

* This registration was updated after the last confirmation email.
* There are unassigned transport requests.
* Some details are marked “not sure yet”.
* Clarification has been requested.

---

# Screen 21: Admin Transport Requests for Registration

## Purpose

Manage all transport legs for one registration.

Each transport request should appear as a card.

## Transport Card Fields

Traveller-submitted fields:

* Transport type
* Requested date/time
* From location
* To location
* Passenger count
* Luggage
* Vehicle preference
* Traveller notes

Admin-editable fields:

* Status
* Assigned driver
* Driver phone
* Assigned vehicle
* Confirmed date/time
* Confirmed from location
* Confirmed to location
* Admin notes

Actions:

* Save
* Send Confirmation
* Request Clarification
* Mark Cancelled

## Important Requirement

Admin must be able to confirm individual transport requests, not only the entire registration.

---

# Screen 22: Admin Transport Board

## Purpose

Operational daily planning screen.

## Filters

* Date
* Status
* Driver
* Transport type
* From location
* To location

## Table Columns

| Time | Type | From | To | Contact | Passengers | Driver | Vehicle | Status |
| ---- | ---- | ---- | -- | ------- | ---------: | ------ | ------- | ------ |

## Quick Views

* Today
* Tomorrow
* This Week
* Unassigned
* Needs Clarification
* Changed Since Confirmation

## Status Chips

* Requested
* Needs clarification
* Planned
* Confirmed
* Cancelled
* Not required

---

# Screen 23: Assign Driver / Vehicle Modal

## Purpose

Quickly assign transport from the transport board.

## Fields

| Field                   |
| ----------------------- |
| Driver name             |
| Driver phone            |
| Vehicle                 |
| Confirmed date/time     |
| Confirmed from location |
| Confirmed to location   |
| Admin notes             |

## Actions

* Save Only
* Save and Send Confirmation

---

# Screen 24: Send Confirmation Preview

## Purpose

Prevent incorrect emails.

Before sending, show:

* Recipient
* Subject
* Email body preview
* Transport details being confirmed

Actions:

* Send Confirmation
* Cancel

## Requirement

Admin should always preview before sending confirmation.

---

# Screen 25: Request Clarification

## Purpose

Ask traveller for missing or unclear details.

## Fields

Clarification reason:

* Arrival time missing
* Flight/train details missing
* Pickup location unclear
* Passenger count unclear
* Departure details unclear
* Other

Optional message:

* Admin free-text note

Action:

* Send Clarification Request

## Result

* Email sent to traveller with edit link.
* Relevant registration or transport request status set to `needs_clarification`.
* Audit log updated.

---

# Screen 26: Reports Page

## Purpose

Central report/export area.

## Report Cards

1. All Registrations
2. Pickup Planning
3. Drop-off Planning
4. Daily Transport Schedule
5. Special Requirements
6. Unassigned Transport
7. Changed Since Confirmation

Each report should support:

* View
* Export CSV

Optional:

* Export Excel

---

# Screen 27: Email Log

## Purpose

Track email history.

## Columns

| Date/time | Email type | Recipient | Subject | Status |
| --------- | ---------- | --------- | ------- | ------ |

Useful for confirming whether a traveller has already been emailed.

---

# Screen 28: Audit Log

## Purpose

Track changes and reduce confusion.

## Example Entries

* Traveller submitted registration
* Traveller updated departure date
* Admin assigned driver
* Admin sent confirmation email
* Admin requested clarification
* Traveller updated pickup details

---

## 13. Data Model

Use SQLite.

Recommended core tables:

1. `registrations`
2. `travellers`
3. `transport_requests`
4. `email_logs`
5. `audit_logs`

Important design decision:

> Every pickup, drop-off, and local journey must be stored as a row in `transport_requests`.

Do not store operational driver assignments only at the registration level.

---

## 13.1 Table: registrations

```sql
CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reference_number TEXT UNIQUE NOT NULL,

    edit_token_hash TEXT NOT NULL,
    edit_token_created_at TEXT NOT NULL,
    edit_token_revoked_at TEXT,

    main_contact_name TEXT NOT NULL,
    email TEXT NOT NULL,

    phone_raw TEXT NOT NULL,
    phone_e164 TEXT,
    whatsapp_same_as_phone INTEGER DEFAULT 1,
    whatsapp_phone_raw TEXT,
    whatsapp_phone_e164 TEXT,
    alternative_phone_raw TEXT,
    alternative_phone_e164 TEXT,

    country_from TEXT,
    city_from TEXT,
    relationship_to_celebrant TEXT,

    group_size INTEGER NOT NULL,

    has_children INTEGER DEFAULT 0,
    number_of_children INTEGER,
    has_elderly INTEGER DEFAULT 0,
    needs_mobility_assistance INTEGER DEFAULT 0,
    mobility_notes TEXT,

    arrival_date TEXT,
    arrival_time TEXT,
    arrival_mode TEXT,
    arrival_location TEXT,
    arrival_point_detail TEXT,
    arrival_reference TEXT,
    arrival_from TEXT,
    arrival_notes TEXT,

    departure_date TEXT,
    departure_time TEXT,
    departure_mode TEXT,
    departure_location TEXT,
    destination_after_event TEXT,
    departure_reference TEXT,
    departure_notes TEXT,

    stay_type TEXT,
    stay_location_or_address TEXT,
    checkin_date TEXT,
    checkout_date TEXT,
    stay_notes TEXT,

    dietary_requirements TEXT,
    accessibility_or_support_needs TEXT,
    elderly_support_notes TEXT,
    other_notes TEXT,

    status TEXT DEFAULT 'submitted',
    -- submitted, updated_by_traveller, in_review, complete, cancelled

    changed_after_confirmation INTEGER DEFAULT 0,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

---

## 13.2 Table: travellers

```sql
CREATE TABLE travellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    registration_id INTEGER NOT NULL,
    traveller_name TEXT NOT NULL,
    traveller_age_group TEXT,
    notes TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (registration_id) REFERENCES registrations(id)
);
```

Allowed `traveller_age_group` values:

* adult
* child
* elderly
* not_specified

---

## 13.3 Table: transport_requests

```sql
CREATE TABLE transport_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    registration_id INTEGER NOT NULL,

    transport_type TEXT NOT NULL,
    -- arrival_pickup, departure_dropoff, local_transport, other

    requested_date TEXT,
    requested_time TEXT,

    from_location TEXT,
    to_location TEXT,

    passenger_count INTEGER,
    luggage_amount TEXT,
    vehicle_preference TEXT,
    is_essential INTEGER DEFAULT 0,

    traveller_notes TEXT,

    status TEXT DEFAULT 'requested',
    -- requested, needs_clarification, planned, confirmed, cancelled, not_required

    assigned_vehicle TEXT,
    driver_name TEXT,
    driver_phone_raw TEXT,
    driver_phone_e164 TEXT,

    confirmed_datetime TEXT,
    confirmed_from_location TEXT,
    confirmed_to_location TEXT,

    admin_notes TEXT,

    confirmation_sent_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (registration_id) REFERENCES registrations(id)
);
```

---

## 13.4 Table: email_logs

```sql
CREATE TABLE email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    registration_id INTEGER,
    transport_request_id INTEGER,

    email_type TEXT NOT NULL,
    -- registration_received, registration_updated, transport_confirmed,
    -- transport_updated, clarification_requested, registration_cancelled

    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,

    sent_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,

    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (transport_request_id) REFERENCES transport_requests(id)
);
```

---

## 13.5 Table: audit_logs

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    registration_id INTEGER,
    transport_request_id INTEGER,

    actor_type TEXT NOT NULL,
    -- traveller, admin, system

    action TEXT NOT NULL,
    details TEXT,

    created_at TEXT NOT NULL,

    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (transport_request_id) REFERENCES transport_requests(id)
);
```

---

## 14. Status Model

Use two levels of status.

---

### 14.1 Registration Status

| Status               | Meaning                                   |
| -------------------- | ----------------------------------------- |
| submitted            | Traveller submitted registration          |
| updated_by_traveller | Traveller edited details after submission |
| in_review            | Admin is reviewing                        |
| complete             | Admin has dealt with the registration     |
| cancelled            | Registration cancelled                    |

---

### 14.2 Transport Request Status

| Status              | Meaning                                          |
| ------------------- | ------------------------------------------------ |
| requested           | Traveller requested transport                    |
| needs_clarification | Admin needs more information                     |
| planned             | Admin has started planning but not confirmed     |
| confirmed           | Transport confirmed and communicated             |
| cancelled           | Transport request cancelled                      |
| not_required        | Traveller/admin marked transport as not required |

---

## 15. Email Workflows

---

### 15.1 Registration Received Email

Triggered after first submission.

Subject:

> Travel registration received - {{reference_number}}

Body should include:

* Thank you message
* Reference number
* Summary of submitted details
* Edit link
* Message saying organiser will review and confirm arrangements

---

### 15.2 Registration Updated Email

Triggered after traveller edits registration.

Subject:

> Travel registration updated - {{reference_number}}

Body should include:

* Confirmation that updated details were received
* Reference number
* Updated summary
* Edit link

---

### 15.3 Transport Confirmation Email

Triggered manually by admin.

Subject:

> Your travel arrangements are confirmed - {{reference_number}}

Body should include:

* Main contact name
* Confirmed transport details
* Pickup date/time
* Pickup location
* Destination
* Driver name
* Driver phone number
* Vehicle details
* Organiser notes
* Edit link in case travel plans change

Hide sections that do not apply.

---

### 15.4 Clarification Request Email

Triggered manually by admin.

Subject:

> More travel details needed - {{reference_number}}

Body should include:

* What information is missing or unclear
* Edit link
* Friendly message asking traveller to update details

---

### 15.5 Transport Updated Email

Triggered if admin changes confirmed details after confirmation.

Subject:

> Updated travel arrangements - {{reference_number}}

Body should include:

* Updated transport details
* Driver/vehicle changes if applicable
* Clear note saying this replaces the previous confirmation

---

## 16. Confirmation Email Template

```text
Dear {{main_contact_name}},

Your travel arrangements for the 60th birthday celebration have been confirmed.

Registration reference:
{{reference_number}}

Transport details:
{{transport_type}}
Date/time: {{confirmed_datetime}}
From: {{confirmed_from_location}}
To: {{confirmed_to_location}}

Driver details:
Driver name: {{driver_name}}
Driver phone: {{driver_phone}}
Vehicle: {{assigned_vehicle}}

Notes:
{{admin_notes}}

If your travel plans change, please update your registration using this link:
{{edit_link}}

Thank you,
Event Organiser
```

If a field is empty, hide it cleanly.

---

## 17. Backend Routes

---

### 17.1 Public Routes

| Route                              | Method   | Purpose                              |
| ---------------------------------- | -------- | ------------------------------------ |
| `/`                                | GET      | Home page                            |
| `/register`                        | GET      | Registration wizard                  |
| `/api/register`                    | POST     | Submit registration                  |
| `/registration/success/:reference` | GET      | Success page                         |
| `/edit`                            | GET      | Edit lookup page                     |
| `/edit/request-link`               | POST     | Send fresh edit link                 |
| `/edit/:reference`                 | GET      | Edit registration using secure token |
| `/api/edit/:reference`             | POST/PUT | Save edited registration             |

---

### 17.2 Admin Routes

| Route                              | Method   | Purpose                         |
| ---------------------------------- | -------- | ------------------------------- |
| `/admin/login`                     | GET/POST | Admin login                     |
| `/admin/logout`                    | POST     | Admin logout                    |
| `/admin`                           | GET      | Dashboard                       |
| `/admin/registrations`             | GET      | List registrations              |
| `/admin/registrations/:id`         | GET      | View registration               |
| `/admin/registrations/:id`         | POST/PUT | Update registration/admin notes |
| `/admin/transport`                 | GET      | Transport board                 |
| `/admin/transport/:id`             | GET      | View transport request          |
| `/admin/transport/:id`             | POST/PUT | Update transport request        |
| `/admin/transport/:id/confirm`     | POST     | Send confirmation email         |
| `/admin/transport/:id/clarify`     | POST     | Send clarification request      |
| `/admin/reports`                   | GET      | Reports page                    |
| `/admin/reports/registrations.csv` | GET      | Export all registrations        |
| `/admin/reports/pickups.csv`       | GET      | Export pickup report            |
| `/admin/reports/dropoffs.csv`      | GET      | Export drop-off report          |
| `/admin/reports/daily.csv`         | GET      | Export daily transport schedule |
| `/admin/email-log`                 | GET      | Email log                       |
| `/admin/audit-log`                 | GET      | Audit log                       |

---

## 18. Reporting Requirements

---

### 18.1 All Registrations Report

Columns:

* Reference number
* Main contact name
* Email
* Phone
* WhatsApp
* Country from
* City from
* Group size
* Arrival date/time
* Arrival location
* Departure date/time
* Departure location
* Registration status
* Changed after confirmation
* Last updated

---

### 18.2 Pickup Planning Report

Filter:

* Transport type = `arrival_pickup` or relevant pickup requests

Columns:

* Pickup date
* Pickup time
* From location
* To location
* Contact name
* Phone / WhatsApp
* Number of passengers
* Luggage
* Vehicle preference
* Assigned driver
* Driver phone
* Vehicle
* Status
* Notes

---

### 18.3 Drop-off Planning Report

Filter:

* Transport type = `departure_dropoff`

Columns:

* Drop-off date
* Drop-off time
* From location
* To location
* Contact name
* Phone / WhatsApp
* Passengers
* Driver
* Driver phone
* Vehicle
* Status
* Notes

---

### 18.4 Daily Transport Schedule

Filter by date.

Columns:

* Time
* Type
* From
* To
* Contact
* Phone / WhatsApp
* Passengers
* Driver
* Vehicle
* Status
* Notes

---

### 18.5 Special Requirements Report

Columns:

* Reference
* Contact name
* Group size
* Children
* Elderly travellers
* Mobility/accessibility needs
* Dietary requirements
* Other notes

---

### 18.6 Unassigned Transport Report

Columns:

* Requested date/time
* Transport type
* From
* To
* Contact
* Passengers
* Status
* Notes

---

### 18.7 Changed Since Confirmation Report

Columns:

* Reference
* Contact
* Transport request
* Last confirmation sent at
* Last updated at
* Status
* Action required

---

## 19. Validation Rules

---

### 19.1 Required Registration Fields

Minimum required fields:

* Main contact name
* Email
* Mobile / WhatsApp number
* Country travelling from
* Group size
* Arrival date
* Arrival mode
* Arrival location
* Whether pickup is required
* Departure date
* Departure mode
* Departure location
* Whether drop-off is required

---

### 19.2 Conditional Rules

If pickup is required:

* Pickup location required
* Pickup destination required
* Desired pickup date/time requested
* Passenger count requested

If drop-off is required:

* From location required
* Drop-off location required
* Desired drop-off date/time requested
* Passenger count requested

If travel mode is flight/train/bus:

* Flight/train/bus number should be requested but not mandatory.

If user selects “not sure yet”:

* Allow submission.
* Mark relevant transport request as `needs_clarification` or `requested`.
* Show admin warning.

---

## 20. Date and Time Requirements

Use India timezone as default:

```text
Asia/Kolkata
```

Rules:

* Store dates and times in ISO-8601 text format.
* Store operational pickup/drop-off times in India time.
* Display dates as `DD MMM YYYY`.
* Display times clearly with `IST`.

Example display:

```text
12 Feb 2026, 10:30 AM IST
```

Helper text for travellers:

> Please enter arrival time as shown on your ticket. Pickup and drop-off planning will be confirmed in India time.

---

## 21. Phone Number Requirements

The site must support international phone numbers.

Recommended libraries:

* Frontend: `intl-tel-input`
* Backend Python: `phonenumbers`

Store:

* Raw user entry
* Normalized E.164 number where possible

Fields:

* Main phone
* WhatsApp phone
* Alternative phone
* Driver phone

Examples shown in UI:

* `+91 98765 43210`
* `+44 7700 900123`
* `+1 555 123 4567`

---

## 22. Security Requirements

The website stores private travel and contact data. Security must be taken seriously even though this is a family event.

Requirements:

1. Admin area requires login.
2. Admin password must be stored in environment variable.
3. Do not hardcode secrets.
4. Use secure, HTTP-only, SameSite cookies.
5. Admin session expires after inactivity.
6. Add rate limiting to admin login.
7. Use CSRF protection for admin forms.
8. Use parameterised SQL queries or ORM.
9. Validate all server-side inputs.
10. Sanitize text displayed in admin pages.
11. Use HTTPS in production.
12. Do not expose the SQLite database file publicly.
13. Do not include edit tokens in exports.
14. Store only hashed edit tokens in database.
15. Edit tokens must be long, random, and cryptographically secure.
16. Allow admin to revoke or regenerate edit links.
17. Do not reveal registration data using only reference number and email.
18. Fresh edit links should be sent by email.

---

## 23. Edit Token Requirements

Edit links are convenient but sensitive.

Rules:

* Generate at least 32 bytes of secure randomness.
* Store only a hash of the token.
* Token should be revocable.
* Token should expire after the event or after a configured period.
* Do not expose token in admin tables or exports.
* Do not log full token unnecessarily.
* Admin can regenerate edit link if needed.

Suggested link format:

```text
/edit/BDAY-2026-0042?token={{secure_token}}
```

---

## 24. Privacy Requirements

The registration page should include a short privacy notice.

Suggested text:

> We will use these details only to coordinate travel, pickups, drop-offs, food, stay, and event arrangements. Your details will only be visible to the organiser. Please do not enter highly sensitive medical information unless it is needed for travel or accessibility support.

Additional requirements:

* Admin can mark registration cancelled.
* Admin can delete or anonymise data after the event if needed.
* Exports should be admin-only.
* Export should not include edit tokens.
* Sensitive notes should be excluded from transport-only exports unless necessary.

---

## 25. Duplicate Registration Handling

Users may accidentally submit more than once.

On registration submission, if same email or phone already exists, show a warning:

> We may already have a registration for this email or phone number. Would you like to edit the existing registration instead?

Do not block duplicates completely because one person may manage multiple family groups.

Admin should see possible duplicate warnings based on:

* Same email
* Same phone
* Similar main contact name

---

## 26. Wizard State / Save Behaviour

Minimum requirement:

* Preserve data while moving between wizard steps.
* Use browser local storage before final submission.
* Clear local storage after successful submit.
* Allow Back and Continue without losing data.

Optional enhancement:

* Server-side draft saving after email is entered.

Avoid requiring users to log in.

---

## 27. Visual Design Direction

The UI should feel:

* Warm
* Elegant
* Family-friendly
* Professional
* Clean
* Lightly festive
* Easy to read

Suggested visual style:

* Soft warm off-white background
* White cards
* Rounded corners
* Subtle shadow
* Accent colour such as gold, maroon, or deep teal
* Clean sans-serif body font
* Large buttons
* Simple line icons
* Minimal decoration

Avoid:

* Too many colours
* Heavy birthday graphics
* Tiny fields
* Dense forms on public pages
* Forced map selection
* Spreadsheet-like public UI

---

## 28. Accessibility Requirements

The site should be accessible and usable by older family members.

Requirements:

* Large tap targets
* High contrast text
* Keyboard accessible
* Clear labels above fields
* Do not rely on placeholder-only labels
* Clear validation messages
* Mobile-friendly layout
* One-column public form layout
* Error messages linked to fields
* Avoid tiny dropdowns
* Use examples and helper text

---

## 29. Admin UX Requirements

The admin area should prioritise speed and clarity.

Admin should quickly see:

* Who is arriving today
* Who is departing today
* Who needs pickup
* Who needs drop-off
* Which transport requests are unassigned
* Which travellers updated details after confirmation
* Which records need clarification
* Which emails have been sent

Admin screens can be denser than public screens, but should still be clear.

---

## 30. Environment Variables

```env
APP_BASE_URL=https://your-domain.com
DATABASE_URL=sqlite:///data/family_travel.db

ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=long-random-secret

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=Family Travel Coordinator

ADMIN_EMAIL=
DEFAULT_TIMEZONE=Asia/Kolkata
EDIT_TOKEN_EXPIRY_DAYS=365
```

---

## 31. Acceptance Criteria

---

### 31.1 Traveller Registration

* User can complete registration from a mobile phone.
* User can move back and forth through wizard steps.
* Data is not lost between steps.
* User can submit with required fields.
* User receives reference number.
* User receives acknowledgement email.
* User receives secure edit link.

---

### 31.2 Edit Registration

* User can request edit link by reference and email.
* User can open secure edit link.
* Existing details are pre-filled.
* User can update details.
* Status changes to `updated_by_traveller`.
* User receives update acknowledgement email.
* Admin can see updated records.

---

### 31.3 Admin

* Admin can log in securely.
* Admin can view dashboard.
* Admin can view all registrations.
* Admin can filter and search registrations.
* Admin can view registration detail.
* Admin can view all transport requests.
* Admin can assign driver and vehicle per transport request.
* Admin can send confirmation email.
* Admin can request clarification.
* Admin can see email log.
* Admin can see audit log.

---

### 31.4 Transport Planning

* Arrival pickup creates a transport request.
* Departure drop-off creates a transport request.
* Additional journeys create transport requests.
* Admin can confirm individual transport requests.
* Admin can export pickup, drop-off, and daily transport reports.
* Admin can view unassigned transport.

---

### 31.5 Security

* Admin pages are not accessible without login.
* Edit links require secure token.
* Tokens are stored hashed.
* SQLite database is not publicly accessible.
* Inputs are validated server-side.
* CSV export does not include edit tokens.

---

## 32. Suggested Build Prompt for AI Coding Model

Use the following prompt with an AI coding model:

```text
Build a mobile-first family travel registration website for a 60th birthday celebration in India.

Use Python Flask, SQLite, Jinja templates, Bootstrap or Tailwind CSS, and SMTP email.

The site is for non-technical family members travelling from India and abroad. The public UI must be simple, guided, and wizard-based.

Core requirements:

1. Public home page.
2. Before-you-start page.
3. Guided registration wizard with these steps:
   - Contact details
   - Family/group details
   - Arrival details
   - Arrival pickup
   - Departure details
   - Departure drop-off
   - Other transport requests
   - Stay details
   - Special requirements
   - Review and submit
4. SQLite database using these core tables:
   - registrations
   - travellers
   - transport_requests
   - email_logs
   - audit_logs
5. Every pickup, drop-off, and local journey must be stored as a row in transport_requests.
6. Do not store operational driver assignment only at registration level.
7. Admin should be able to confirm individual transport requests, not only whole registrations.
8. Secure edit links for travellers to update registrations.
9. Edit tokens must be cryptographically secure and stored hashed.
10. Admin login using password from environment variable.
11. Admin dashboard.
12. Admin registration list and detail page.
13. Admin transport board.
14. Admin ability to assign driver, vehicle, confirmed time, confirmed from location, and confirmed to location.
15. Admin ability to preview and send confirmation email.
16. Admin ability to request clarification.
17. CSV exports for all registrations, pickups, drop-offs, daily transport schedule, unassigned transport, and special requirements.
18. Email logging.
19. Audit logging.
20. International phone number support.
21. India timezone support using Asia/Kolkata.
22. Server-side validation.
23. CSRF protection for admin forms.
24. Parameterised database queries or ORM.
25. Mobile-friendly UI with large buttons and plain language.

Design style:
- Warm, clean, professional
- Suitable for older family members
- Soft warm background
- White cards
- Rounded corners
- Large buttons
- Clear labels
- Simple examples
- Free-text location inputs suitable for Indian travel locations

Do not build:
- Public user accounts
- Ticket uploads
- Payment
- Google Maps dependency
- Complex role permissions
- Real-time tracking

Use this PRD as the source of truth.
```

---

## 33. Final Implementation Recommendation

Build the MVP around the `transport_requests` table.

That is the critical design decision.

A registration represents a family group.
A transport request represents an actual journey that needs planning.

This keeps the system clean:

* One family can have many transport needs.
* Each transport need can have its own driver.
* Each transport need can have its own status.
* Reports become easy.
* Confirmation emails become clearer.
* Changes after confirmation can be tracked properly.

Do not overbuild the public traveller experience. Make it simple, guided, forgiving, and mobile-first.

Do make the admin transport board practical, because that is where the organiser will actually run the event logistics.
