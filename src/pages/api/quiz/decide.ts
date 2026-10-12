// POST /api/quiz/decide: the host's call on one distinct typed answer: v=1 Same, v=0 Different,
// v=x clear. One call counts for everyone who wrote that answer. Host only.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { quizHostPost } from '../../../lib/quiz-auth';
import { type QuizEntry, validDecision } from '../../../lib/quiz';
import type { Decisions } from '../../../lib/quiz-match';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const g = await quizHostPost(ctx);
  if (g instanceof Response) return g;
  const qid = (g.form.get('q') ?? '').toString();
  const key = (g.form.get('key') ?? '').toString();
  const v = (g.form.get('v') ?? '').toString();
  if (!['1', '0', 'x'].includes(v)) return new Response('Bad request.', { status: 400 });
  const entries = await store.listQuizEntries<QuizEntry>();
  if (!validDecision(qid, key, entries)) return new Response('Unknown answer.', { status: 400 });

  const decisions = (await store.getQuiz<Decisions>('decisions')) ?? {};
  const forQ = (decisions[qid] ??= {});
  if (v === 'x') delete forQ[key]; else forQ[key] = v === '1';
  if (!Object.keys(forQ).length) delete decisions[qid];
  await store.putQuiz('decisions', decisions);
  return ctx.redirect(`/quiz/sybil#${qid}`, 303);
};
