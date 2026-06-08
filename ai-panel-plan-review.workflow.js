export const meta = {
  name: 'ai-panel-plan-review',
  description: 'AI panel reviews the development plan: 4 lenses critique, judge merges into a verdict',
  phases: [
    { title: 'Review', detail: '4 specialist reviewers critique the build plan' },
    { title: 'Judge', detail: 'judge merges into one prioritised verdict + plan fixes' },
  ],
}

const PRD = 'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\PRD.md'
const PLAN = 'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\DEVELOPMENT_PLAN.md'
const OUT = 'C:\\Users\\sanjay\\PycharmProjects\\FamilyTravelTracker\\ai-panel-run'

const SHARED = `
Project: "Family Travel Coordinator" — a mobile-first Flask + SQLite site where ~30 family groups
register multi-leg travel for a 60th birthday in India; one organiser assigns drivers per leg and
confirms by email.

READ BOTH of these with the Read tool before writing anything:
- PRD (source of truth):      ${PRD}
- Development plan to review:  ${PLAN}

You are reviewing the DEVELOPMENT PLAN, not rewriting the PRD. Be concrete and critical. It is more
useful to find real problems than to praise. If the plan is right, say so briefly and move on.
`

const REVIEWERS = [
  {
    key: 'plan-delivery',
    lens: `DELIVERY & SEQUENCING lens. Is the phase order correct? Are dependencies right (can each phase
really be built and tested with only what came before)? Are the time estimates realistic for one
developer? Where is the biggest risk of rework or a phase that should be split or merged? Is anything
on the critical path buried too late (e.g. deploy/persistent-disk verification, email deliverability)?`,
  },
  {
    key: 'plan-architecture',
    lens: `ARCHITECTURE & STACK lens. Does the planned file structure and phase content actually satisfy
the PRD? What is missing or mis-placed? Specifically pressure-test the **Flask vs Next.js** decision —
steelman Next.js, then say which is right for THIS project and why. Flag any technical gap (CSRF wiring,
session store, WAL/locking, migrations, config loading, how wizard state maps to server validation).`,
  },
  {
    key: 'plan-testing',
    lens: `TESTING & VERIFICATION lens. The plan has "Done when" checks but no real test strategy. What
should be automated vs manual? Where are the highest-value tests (token verify, leg seeding, status
transitions on edit-after-confirm, CSV BOM, people-per-leg seat demand)? How do you test email and the
mobile/localStorage behaviour without spamming relatives or buying devices? Name concrete test cases.`,
  },
  {
    key: 'plan-risk',
    lens: `RISK, SECURITY & OPS lens. What could go wrong that the plan under-weights? Pressure-test the
risk table. Is hardening (Phase 7) too late — should security be built in from Phase 0, not bolted on?
Is the backup/restore actually tested (not just "VACUUM INTO exists")? Data deletion, PII in logs,
rate-limit store across restarts, secrets handling, what happens on a half-filled form or a duplicate
submit. Call out missing operational steps (monitoring, the chase-list workflow, a dry-run with real
relatives).`,
  },
]

phase('Review')
const reviews = await parallel(REVIEWERS.map(r => () =>
  agent(
    `${SHARED}

YOUR LENS: ${r.lens}

Write a focused review memo in Markdown:
1. Verdict — 2-3 sentences: is the plan sound in your area? Biggest single problem?
2. Findings — numbered list. For each: the issue, why it matters, and a concrete fix (what to change
   in the plan). Mark each [BLOCKER] / [SHOULD-FIX] / [NICE-TO-HAVE].
3. Anything the plan gets RIGHT that should not be changed (keep this short).

Also WRITE your memo to ${OUT}\\drafts\\${r.key}.md using the Write tool, then return the full memo.`,
    { label: `review:${r.key}`, phase: 'Review' }
  )
)).then(rs => rs.map((text, i) => ({ key: REVIEWERS[i].key, text })).filter(r => r.text))

phase('Judge')
const block = reviews.map(r => `===== REVIEWER: ${r.key} =====\n${r.text}`).join('\n\n')

const verdict = await agent(
  `${SHARED}

You are the JUDGE. Four reviewers critiqued the development plan from different lenses. Do NOT average
them — pick the strongest findings, drop the weak ones, resolve any disagreement with a clear call.

REVIEWER MEMOS:
${block}

Settle the Flask-vs-Next.js question explicitly with a one-paragraph ruling.

WRITE a review report to ${OUT}\\PLAN-REVIEW.md using the Write tool, containing:
- A one-paragraph overall verdict (is the plan good enough to start building?).
- A single prioritised, de-duplicated table of changes: each row = Priority (BLOCKER/SHOULD-FIX/
  NICE-TO-HAVE), the issue, the concrete fix, and which phase of the plan it touches.
- A short "What's already right — don't change" list.
- The Flask-vs-Next.js ruling.

Then return a SHORT summary (not the whole report): the overall verdict, the count of blockers /
should-fix / nice-to-have, and the top 5 changes in one line each.`,
  { label: 'judge', phase: 'Judge' }
)

return { reviewsWritten: reviews.map(r => r.key), verdict }
