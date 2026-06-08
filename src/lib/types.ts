// Data model — mirrors PRD §6. Storage is Netlify Blobs (documents), not SQL tables.
// One Registration document per family (legs/audit/emails embedded) in store "registrations".
// Vehicle bookings are CROSS-FAMILY, so they live in their own store "vehicle_bookings".

export type RegistrationStatus = 'submitted' | 'in_review' | 'confirmed' | 'cancelled';
export type LegDirection = 'arrival' | 'internal' | 'departure';
export type LegStatus =
  | 'requested' | 'needs_clarification' | 'planned' | 'confirmed' | 'not_required' | 'cancelled';

export interface TransportLeg {
  id: string;                       // uuid
  leg_order: number;
  direction: LegDirection;
  from_location: string;
  to_location: string;
  travel_date: string | null;       // ISO date; null allowed
  date_tbc: boolean;                // true = "not booked yet" -> chase list
  travel_time: string | null;       // "10:30" or "approx morning"
  time_meaning: 'arrival_at_destination' | 'departure_from_origin' | null;
  carrier_type: 'flight' | 'train' | 'bus' | 'own' | 'unknown' | null;
  carrier_ref: string | null;       // flight no / train no / PNR
  people_on_this_leg: number;       // default = party_size, editable
  transport_needed: boolean;        // guest yes/no ONLY (no vehicle guess)
  guest_notes: string | null;

  // admin-filled
  status: LegStatus;
  vehicle_booking_id: string | null; // link to the shared VehicleBooking serving this leg
  pickup_point: string | null;       // this family's exact meeting point
  pickup_time_confirmed: string | null;
  driver_name: string | null;        // cache copied from the booking (for this family's email)
  driver_phone_e164: string | null;  // cache
  admin_notes: string | null;
  confirmation_sent_at: string | null;
}

export interface AuditEntry {
  at: string;
  actor: 'guest' | 'admin' | 'system';
  action: string;                   // submitted, edited, driver_assigned, confirmation_sent, ...
  details: string | null;
}

export interface EmailLogEntry {
  at: string;
  type: 'ack' | 'confirmation' | 'clarification' | 'updated';
  to_email: string;
  subject: string | null;
  status: 'sent' | 'failed';
  error_message: string | null;
}

export interface Registration {
  reference_number: string;         // PK / blob key, e.g. "BDAY-2026-0042"
  edit_token_hash: string;          // sha256(raw token) — raw token never stored
  edit_token_created_at: string;
  edit_token_expires_at: string | null;
  edit_token_revoked_at: string | null;

  main_contact_first: string;       // split for surname search
  main_contact_surname: string;
  email: string;
  phone_raw: string;
  phone_e164: string | null;
  whatsapp_same_as_phone: boolean;
  whatsapp_e164: string | null;
  home_city: string | null;
  home_country: string;
  relationship: string | null;

  party_size: number;               // >= 1
  party_members: Array<{ name: string; age_band: 'adult' | 'child' | 'elderly' }>;
  special_requirements: string | null;

  stay_type: 'hotel' | 'family_home' | 'own' | 'unsure' | null;
  stay_location: string | null;

  consent_given: boolean;
  consent_at: string | null;
  status: RegistrationStatus;
  confirmed_at: string | null;
  edited_after_confirm: boolean;
  admin_notes: string | null;

  created_at: string;
  updated_at: string;

  legs: TransportLeg[];
  audit: AuditEntry[];
  emails: EmailLogEntry[];
}

export type VehicleType = 'car' | 'suv_innova' | 'tempo_traveller' | 'minibus' | 'other';
export type BookingStatus =
  | 'suggested' | 'to_book' | 'booked' | 'assigned' | 'completed' | 'cancelled';

export interface VehicleBooking {
  id: string;                       // blob key, e.g. "VEH-2026-0007"
  date: string;                     // ISO date of the run
  purpose: LegDirection;
  route_from: string;
  route_to: string;
  depart_time: string | null;       // planned "leave by" time, IST

  vehicle_type: VehicleType;
  seats: number;

  // INTERNAL ONLY — never shown to families or in any guest-facing email
  operator_name: string | null;
  operator_contact: string | null;
  quote_amount: number | null;
  currency: string;                 // default "INR"

  driver_name: string | null;
  driver_phone_raw: string | null;
  driver_phone_e164: string | null;
  vehicle_reg: string | null;

  status: BookingStatus;

  covered_legs: Array<{
    registration_ref: string;
    leg_id: string;
    family_name: string;
    people: number;
  }>;

  notes: string | null;
  created_at: string;
  updated_at: string;
}
