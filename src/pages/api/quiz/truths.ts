// POST /api/quiz/truths: Sybil's answers (+ "also OK" words). Host only. If an answer changes, the
// host's earlier Same/Different calls for that question are dropped (they were made against the old one).
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { quizHostPost } from '../../../lib/quiz-auth';
import { cleanTruths, type Truths } from '../../../lib/quiz';
import type { Decisions } from '../../../lib/quiz-match';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await quizHostPost(ctx);
  if (g instanceof Response) return g;
  const { truths, missing } = cleanTruths((k) => g.form.get(k));

  const old = (await store.getQuiz<Truths>('truths')) ?? {};
  const decisions = (await store.getQuiz<Decisions>('decisions')) ?? {};
  let changed = false;
  for (const qid of Object.keys(decisions)) {
    if (JSON.stringify(old[qid] ?? null) !== JSON.stringify(truths[qid] ?? null)) { delete decisions[qid]; changed = true; }
  }
  if (changed) await store.putQuiz('decisions', decisions);
  await store.putQuiz('truths', truths);
  return ctx.redirect(`/quiz/sybil?saved=1&missing=${missing.length}`, 303);
};
