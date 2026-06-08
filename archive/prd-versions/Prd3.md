You are an expert full-stack Python developer who builds beautiful, simple, production-ready web applications.

Build a complete, deployable Flask + SQLite web application called "Family Travel Coordinator" for a 60th birthday family holiday celebration (primarily India, some international travellers).

Strictly follow this complete PRD v1.1:

PROJECT GOALS
Extremely simple guided experience for non-techie and elderly family members. Warm, professional, celebratory design. Mobile-first. Full edit capability. Admin can assign drivers and send confirmation emails with exact pickup details.

MUST INCLUDE THESE SCREENS WITH EXACT UI/UX RULES:
1. Landing Page – warm hero, single big CTA, floating help button
2. 5-step Registration Wizard with automatic localStorage state saving and the exact simplified Step 4 (three sections: Arrival Pickup, Departure Drop-off, optional max 2 internal transfers)
3. Success page with reference code and edit link
4. Edit flow (reuse wizard, prefilled, with audit logging)
5. Admin login (password only + rate limiting + session timeout)
6. Admin Dashboard with KPI cards, searchable table, Reports tab, and CSV export
7. Admin Detail view with editable logistics per leg + big “Confirm & Send Email” button
8. Simple Privacy Notice page
9. Floating “Need help? WhatsApp [Your Number]” button on EVERY screen

MANDATORY v1.1 FEATURES FROM RED-TEAM:
- Consent checkbox in Step 1 with clear DPDP-style language
- Time-limited signed edit tokens
- Audit log table for all changes
- Hardened admin auth (rate limiting, session timeout, logout)
- CSRF protection
- Privacy notice + data deletion process
- Simplified transport step (no fully dynamic cards for elderly users)
- Large readable text, generous spacing, big touch targets, teal/gold/cream palette throughout

DATABASE
Use the exact three-table schema (registrations + transport_legs + audit_log) provided in the PRD.

EMAIL
Two triggers: immediate acknowledgement + magic edit link, and admin-triggered rich confirmation with driver/vehicle/pickup details.

OUTPUT REQUIREMENTS
Provide complete working code:
- Full app.py (Flask routes, logic, templates)
- requirements.txt
- .env.example
- Detailed README.md with local run instructions, environment variables, deployment steps for Render/Railway with persistent disk, and how to seed sample data

Make the UI feel premium and the wizard feel magical and forgiving for non-technical users. Prioritise perfect mobile experience and the admin confirmation flow. Start building now.