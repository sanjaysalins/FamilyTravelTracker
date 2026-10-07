# TODO: Pickup page (https://bidarplan.netlify.app/pickups)

Always `git pull` before editing.

## How it works now
- `/pickups` is server-rendered from `src/lib/pickups.ts` (plan data) + saved driver details (Blobs `system` store, key `pickup_drivers`).
- Driver company: `/driver` login (shared password) -> edits driver name, phone, car reg per pickup. Family sees changes instantly.
- Organiser: when logged in to `/admin`, `/pickups` also shows "Edit driver" and a "Set the driver company password" box.
- Old link `/pickups.html` redirects to `/pickups`.

## Open items
- [ ] **Organiser: log in at /admin, open /pickups, "Set the driver company password"**, then give the driver company the `/driver` link + password.
- [ ] Driver company fills in driver name / phone / car reg for each pickup (all show TBC until then).
- [ ] Confirm contacts marked "Contact to be confirmed": Tanu + 2, Mali, Rani's sister, Chotu + Jaswanth, Thamma Fly, Indu, Dr Sam + Beneita.
- [ ] Check names not found in the registrations backup: Tanu (Tanya?), Sughandi, Katherin Aunty, Leena, Boby, Beneita, Pastor Joe, Mali.
- [ ] Check head-counts: Anil and Sanjay (page 6, registration 9); Boby + Serina (2, registration 10).
- [ ] Changing the plan itself (times, families, contacts) still means editing `src/lib/pickups.ts` and pushing.
- [ ] Group numbers are auto-set by time order (1..19). Old Grp numbers are retired; tell people to use the family name.

## Notes
- Page is public and lists 26 people's phones and emails (owner chose this on 2026-10-07).
- WhatsApp group: create with invite link, admin-only messages, approve new participants; pin the page link.
