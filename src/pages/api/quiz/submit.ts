// POST /api/quiz/submit: a guest's answers (public). CSRF-checked. One entry per phone (the device
// cookie is the key): sending again REPLACES that phone's entry while entries are open. Refused when
// the host has closed entries, or when another phone already used the same name.
import type { APIRoute } from 'astro';
import { store } from '../../../lib/store';
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrf } from '../../../lib/csrf';
import { cleanSubmission, nameKey, type QuizEntry, type QuizState } from '../../../lib/quiz';
import { deviceId, setDeviceCookie } from '../../../lib/quiz-auth';

export const prerender = false;
const MAX_ENTRIES = 600; // far above the ~100 guests; stops junk from filling the store

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const field = form.get(CSRF_FIELD);
  if (!verifyCsrf(cookies.get(CSRF_COOKIE)?.value, typeof field === 'string' ? field : null)) {
    return new Response('Invalid or expired form session. Please reload and try again.', { status: 403 });
  }

  const state = (await store.getQuiz<QuizState>('state')) ?? { open: true };
  if (!state.open) return redirect('/quiz?err=closed', 303);

  const cleaned = cleanSubmission((k) => form.get(k));
  if ('error' in cleaned) return redirect('/quiz?err=name', 303);

  const dev = deviceId(cookies);
  const entries = await store.listQuizEntries<QuizEntry>();
  const key = nameKey(cleaned.name);
  if (entries.some((e) => e.name_key === key && e.device !== dev.id)) return redirect('/quiz?err=taken', 303);
  const mine = entries.find((e) => e.device === dev.id);
  if (!mine && entries.length >= MAX_ENTRIES) return redirect('/quiz?err=full', 303);

  const now = new Date().toISOString();
  const entry: QuizEntry = {
    device: dev.id,
    name: cleaned.name,
    name_key: key,
    answers: cleaned.answers,
    created_at: mine?.created_at ?? now,
    updated_at: now,
  };
  await store.putQuiz('entry-' + dev.id, entry);
  setDeviceCookie(cookies, dev.id);
  return redirect('/quiz?done=1', 303);
};
