# TODO: Pickup page (https://bidarplan.netlify.app/pickups.html)

File: `public/pickups.html` (static; data is the `P` array near the top of the script).

## Open items
- [ ] Add **driver name, phone and car reg** per pickup as soon as they are confirmed (every row shows Driver: TBC).
      Row format: `[group, place, family, day, weekday, "h:mm AM/PM", people, car type, [contacts], [driver name, driver phone, car reg]]`
      (the driver part is index 9; page currently shows name + phone only, add car reg to the render).
- [ ] Confirm contacts marked "Contact to be confirmed": Tanu + 2, Mali, Rani's sister, Chotu + Jaswanth, Thamma Fly, Indu, Dr Sam + Beneita.
- [ ] Check names not found in the registrations backup: Tanu (Tanya?), Sughandi, Katherin Aunty, Leena, Boby, Beneita, Pastor Joe, Mali.
- [ ] Check head-counts: Anil and Sanjay (page 6, registration 9); Boby + Serina (2, registration 10).
- [ ] Group numbers are auto-set by time order (1..19). Old Grp numbers are retired; tell people to use family name.
- [ ] Decide: move driver entry into the admin app (see below) instead of editing the HTML by hand.

## Admin app
Existing admin (`/admin/vehicles`, `/admin/assign`) already stores driver_name, driver_phone and vehicle_reg per booking,
but it is separate from this static page. Linking them needs the page to be server-rendered from vehicle bookings.

## Notes
- Page is public and lists 26 people's phones and emails (owner chose this on 2026-10-07).
- WhatsApp group: create with invite link, admin-only messages, approve new participants; pin the page link.
