# Sybil's 60th: "Who knows Sybil best?" quiz. HANDOVER

Status 2026-10-12: **built, committed, pushed, DEPLOYED and live-tested** (69/69 e2e on https://bidarplan.netlify.app). Live data was reset to empty after testing.

## What it is
Guests scan a QR code to a public form (16 scored questions + 1 tiebreaker). Sybil answers on a password page.
Each guest answer is matched to hers (auto-match / maybe / no). The host decides each "maybe" once.
Most points wins; ties go to the closer guess of her eye-surgery count (q13).

## 3 pages (Astro SSR on Netlify, data in Netlify Blobs store `quiz`)
| Page | Access | File |
|---|---|---|
| `/quiz` | public | `src/pages/quiz/index.astro` |
| `/quiz/sybil` | quiz password `bidar2026` OR admin session | `src/pages/quiz/sybil.astro` |
| `/quiz/results` | same | `src/pages/quiz/results.astro` |
| `/quiz/login` | login form | `src/pages/quiz/login.astro` |

API: `src/pages/api/quiz/{submit,login,logout,truths,decide,status,clear}.ts`
Libs: `src/lib/quiz.ts` (questions, board, cleaning), `quiz-match.ts` (fuzzy matcher), `quiz-auth.ts` (host cookie `ftc_quiz`, device cookie `ftc_quiz_dev`).
Store additions: `src/lib/store.ts` (`getQuiz/putQuiz/listQuizEntries/clearQuizEntries`). Keys: `entry-<deviceId>`, `truths`, `decisions`, `state`.
Config: `src/lib/config.ts` adds `quizPasswordHash` (env `QUIZ_PASSWORD_HASH` overrides built-in bcrypt of `bidar2026`).

## Reset (added last)
On `/quiz/results`: type `DELETE` = wipe guest entries + decisions (Sybil's answers kept).
Type `RESET` = also wipe Sybil's answers and reopen entries. Use RESET before the party.

## Tests (all green at last run)
- `npx vitest run` : 19 files, 165 tests (quiz: `test/quiz.test.ts`, `test/quiz-match.test.ts`)
- `npx astro dev --port 4399` then `node scripts/quiz-e2e.mjs http://localhost:4399` : **69 passed, 0 failed** (110 simulated phones)
- `npx astro build` OK.
- Prototype (frozen, superseded): `prototype/quiz/` incl. simulation data in `prototype/quiz/sim/`.

## NOT verified
- Never viewed in a real browser/phone (owner rule: never auto-open; ask first).
- Real Netlify Blobs under load untested (only the local emulator).
- Admin-session access to host pages not e2e-tested (no admin password locally).
- Matcher exists twice: frozen `prototype/quiz/quiz-match.cjs` and canonical `src/lib/quiz-match.ts`.
- Two real guests with the same name must add a surname (name clash rule). 600-entry cap.
- Some choice options guess family details (e.g. Bangalore): owner must check them.

## TOMORROW (in order)
1. Owner says yes -> commit quiz work (trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). Ask again before push/deploy.
2. After deploy: smoke test on live: submit as a few guests -> enter Sybil's answers -> check results -> type `RESET`.
3. Optional: set `QUIZ_PASSWORD_HASH` in Netlify env; QR code / print page; browser check (ask first); edit guessy options; one-blank-answer polish; big agent stress test vs server.
4. Before the party: final `RESET`, then real answers from Sybil.

Untracked unrelated files (not quiz): `family-travel-backup.json`, `requirements_backup.txt`, `prototype/admin-dropoff.html`, `prototype/dropoffs-preview.html`: decide separately.

## Update 2026-10-12
- Results page: tap "See [name]'s answers" under a guest to see each answer, Sybil's answer and Same / Not the same buttons (commit 351203f; decide API takes optional `back` = guest device id).
- Live test report: `prototype/quiz-live-test-report.html`. QR print page: `prototype/quiz/QR-PRINT.html` (+ `qr.png`) -> https://bidarplan.netlify.app/quiz.
- Ranking: most points, then closer tiebreak (q13), else shared rank (5=).
- STILL TO DO: check guessed options (e.g. Bangalore); optional QUIZ_PASSWORD_HASH in Netlify; final RESET on the day, then Sybil's real answers (enter ALL before showing the board; settle "?" answers before naming a winner).
