// POST /api/quiz/clear (host only). Two levels, each needs its own typed word:
//   confirm=DELETE -> delete every guest entry and the host's Same/Different calls; Sybil's answers stay.
//   confirm=RESET  -> everything above PLUS Sybil's answers, and entries go back to "open".
// For wiping test data on the live site before the party.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { quizHostPost } from '../../../lib/quiz-auth';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await quizHostPost(ctx);
  if (g instanceof Response) return g;
  const word = (g.form.get('confirm') ?? '').toString().trim();
  if (word !== 'DELETE' && word !== 'RESET') return ctx.redirect('/quiz/results?cleared=no', 303);
  const n = await store.clearQuizEntries();
  await store.putQuiz('decisions', {});
  if (word === 'RESET') {
    await store.putQuiz('truths', {});
    await store.putQuiz('state', { open: true });
    return ctx.redirect(`/quiz/results?cleared=${n}&reset=1`, 303);
  }
  return ctx.redirect(`/quiz/results?cleared=${n}`, 303);
};
