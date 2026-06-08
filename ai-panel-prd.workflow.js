export const meta = {
  name: 'ai-panel-prd',
  description: 'Replicate ai-panel: 4 panelists review 3 PRDs, judge merges into one best PRD',
  phases: [
    { title: 'Panel', detail: '4 specialist panelists each draft their view of the best PRD' },
    { title: 'Judge', detail: 'one judge merges the best parts into the final PRD' },
  ],
}

const PRD_PATHS = [
  'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\prd1.md',
  'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\prd2.md',
  'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\Prd3.md',
]
const OUT = 'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\ai-panel-run'

const SHARED = `
You are one panelist on an AI review panel. The project: a mobile-first website where ~30 family
members (many elderly, some international) register travel + transport for a 60th birthday celebration
in India (town example: Bidar; airport hub: Hyderabad). One organiser runs admin: reviews, assigns
drivers, confirms by email. Data in server-side SQLite.

Three source PRDs exist. READ ALL THREE with the Read tool before writing anything:
- ${PRD_PATHS[0]}  (prd1: very long, exhaustive, 5-table schema, 10-step wizard)
- ${PRD_PATHS[1]}  (prd2: sharp build-constraints, multi-leg model, people-per-leg, GDPR, ops reports)
- ${PRD_PATHS[2]}  (prd3: concise opinionated build prompt, 3-table schema, 5-step wizard, DPDP, teal/gold/cream)

The user wants ONE best PRD they can hand to an AI coding model to build the site.
`

const PANELISTS = [
  {
    key: 'product-ux',
    lens: `PRODUCT & UX lens. Focus: the elderly/non-technical mobile guest experience.
Decide and justify: wizard (multi-step) vs single scrollable page; how many steps; form-state survival
(back/refresh/autosave); showing the edit link on the success screen vs email-only; phone input;
accessibility; visual design direction; help/WhatsApp affordance. Call out where each PRD is right or wrong.`,
  },
  {
    key: 'backend-data',
    lens: `BACKEND & DATA-MODEL lens. Focus: the schema and the core domain model.
The hardest decision: prd1/prd3 model transport as generic rows; prd2 models a MULTI-LEG journey
(arrival -> internal -> departure) with people-per-leg. Decide the best data model and give the actual
SQL/table list. Decide tech stack (Flask+SQLite vs Next.js+SQLite) and justify for a 30-family,
inspect-and-maintain project. Cover the SQLite-on-persistent-disk + VACUUM INTO backup constraints.
Cover edit-token storage (hashed vs signed). Give routes.`,
  },
  {
    key: 'security-privacy',
    lens: `SECURITY & PRIVACY lens. Focus: protecting PII + special-category (health/mobility) data.
Decide: edit-token scheme (length, hashed-at-rest, expiry, revoke); admin auth (password vs hash,
lockout, rate-limit, session timeout, CSRF, HTTPS); consent (DPDP vs GDPR — note travellers may be
UK/EU); retention + delete-after-event; what must NOT appear in exports. Reconcile the differing
approaches across the three PRDs into one clear set of rules.`,
  },
  {
    key: 'ops-logistics',
    lens: `OPERATIONS & EVENT-LOGISTICS lens. Focus: what the ONE organiser actually does during the event.
Decide the admin dashboard, the per-leg driver assignment, confirmation + clarification emails,
and especially the REPORTS that matter (arrivals/departures schedules, seat-demand-by-people-per-date,
per-driver run sheet, chase list for TBC dates, CSV export with Excel-safe UTF-8 BOM). Decide the
status model for registrations and transport. Make the admin side genuinely run-the-event practical.`,
  },
]

phase('Panel')
const drafts = await parallel(PANELISTS.map(p => () =>
  agent(
    `${SHARED}

YOUR LENS: ${p.lens}

After reading all three PRDs, write a focused panelist memo in Markdown. Structure it as:
1. Verdict — one paragraph: what the best PRD should do in your area, and which source PRD got it most right.
2. Key decisions — a numbered list of concrete decisions WITH the reason, picking the winner when the
   three PRDs disagree (cite "prd1/prd2/prd3").
3. Ready-to-paste content — the actual section(s) you'd want in the final PRD for your area
   (schema SQL, route tables, screen lists, rules — real content, not a description of content).
4. What to drop — anything in the source PRDs that is over-engineering or wrong for ~30 families.

Also WRITE your memo to the file ${OUT}\\drafts\\${p.key}.md using the Write tool.
Then return the full memo text as your final message.`,
    { label: `panel:${p.key}`, phase: 'Panel' }
  )
)).then(rs => rs.map((text, i) => ({ key: PANELISTS[i].key, text })).filter(r => r.text))

phase('Judge')
const panelBlock = drafts.map(d => `===== PANELIST: ${d.key} =====\n${d.text}`).join('\n\n')

const report = await agent(
  `${SHARED}

You are the JUDGE. Four panelists have reviewed the three PRDs from different lenses. Your job is NOT to
average them — pick the best parts from each, resolve conflicts with a clear decision, and produce ONE
final, complete, build-ready PRD.

First READ all three source PRDs yourself (paths above) so you can pull in any strong detail the panelists
missed. Then read the panelist memos below.

PANELIST MEMOS:
${panelBlock}

Now WRITE the final PRD to the file ${OUT}\\BEST-PRD.md using the Write tool. Requirements for the final PRD:
- It must be a single self-contained document an AI coding model can build from start to finish.
- Resolve every conflict explicitly. Where the panelists or PRDs disagreed (e.g. wizard vs scroll,
  Flask vs Next.js, 3-table vs 5-table, multi-leg model, GDPR vs DPDP, hashed vs signed token),
  STATE the decision and one-line reason. No "[DECISION NEEDED]" left open — make the call, but add a
  short "Decisions the organiser may want to revisit" appendix listing them.
- Keep prd2's hard build-constraints (SQLite needs persistent disk; multi-leg journeys; people-per-leg
  vehicle sizing; show edit link on success screen; VACUUM INTO backup; DD-MM-YYYY + IST; Excel-safe CSV).
- Include: product summary, goals/non-goals, users, the multi-leg domain model, full SQLite schema (SQL),
  guest flow + screens, edit flow, admin area + screens, the reports that matter, email workflows,
  routes, validation rules, security + privacy + retention, phone/date/timezone rules, visual + a11y
  direction, env vars, acceptance checklist, and a final "build prompt" block.
- Plain, clear language. The reader is dyslexia-friendly: short sentences, clear headings.

After writing the file, return a SHORT report (not the PRD): how long the final PRD is, the 6-10 biggest
decisions you locked in and why, and which panelist most shaped each major section.`,
  { label: 'judge', phase: 'Judge' }
)

return { draftsWritten: drafts.map(d => d.key), report }
