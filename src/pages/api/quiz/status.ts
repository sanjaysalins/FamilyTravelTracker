// POST /api/quiz/status: open or close guest entries (host only). Close it before Sybil starts
// reading her answers out, so nobody can still submit what they just heard.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { quizHostPost } from '../../../lib/quiz-auth';
import type { QuizState } from '../../../lib/quiz';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await quizHostPost(ctx);
  if (g instanceof Response) return g;
  const open = (g.form.get('open') ?? '').toString() === '1';
  const state: QuizState = { open, updated_at: new Date().toISOString() };
  await store.putQuiz('state', state);
  return ctx.redirect('/quiz/results', 303);
};
