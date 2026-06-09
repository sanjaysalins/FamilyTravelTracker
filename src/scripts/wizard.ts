// Phase 2b — progressive enhancement for the guest wizard. The form already works without
// JS (Phase 2a); this adds: step-by-step nav + progress, localStorage autosave that survives
// Back AND refresh (excluding the CSRF token), a phone-number preview, and the dynamic people
// list + internal-trip reveal. Everything is guarded so a missing element never throws.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const form = document.getElementById('regform') as HTMLFormElement | null;
if (form) init(form);

function init(form: HTMLFormElement) {
  const DRAFT_KEY = 'ftc_draft_v1';
  const EXCLUDE = new Set(['csrf_token', 'submit_nonce']);
  const hasFlash = form.dataset.hasFlash === '1';

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const val = (name: string): string => {
    const el = form.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null;
    if (!el) return '';
    return 'value' in el ? (el.value ?? '').toString().trim() : '';
  };

  // ---------- localStorage autosave ----------
  function saveDraft() {
    const data: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) {
      if (!EXCLUDE.has(k) && typeof v === 'string') data[k] = v;
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota/private mode */ }
  }
  function applyDraft(data: Record<string, string>) {
    form.querySelectorAll<HTMLInputElement>('input, select, textarea').forEach((el) => {
      const name = el.name;
      if (!name || EXCLUDE.has(name)) return;
      if (el.type === 'checkbox') {
        el.checked = data[name] !== undefined && data[name] !== '';
      } else if (el.type === 'radio') {
        if (name in data) el.checked = el.value === data[name];
      } else if (name in data) {
        el.value = data[name];
      }
    });
  }
  if (!hasFlash) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) applyDraft(JSON.parse(raw));
    } catch { /* ignore corrupt draft */ }
  }

  // ---------- dynamic people list (step 2) ----------
  const peopleBox = $('people');
  const addPersonBtn = $('addperson') as HTMLButtonElement | null;
  const peopleJson = form.elements.namedItem('people_json') as HTMLInputElement | null;
  const sizeSel = $('party_size') as HTMLSelectElement | null;
  const AGES: Array<[string, string]> = [['adult', 'Adult'], ['child', 'Child'], ['elderly', 'Elderly']];
  let people: Array<{ name: string; age_band: string }> = [];

  function writePeople() {
    if (peopleJson) {
      peopleJson.value = JSON.stringify(
        people.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), age_band: p.age_band })),
      );
    }
    if (sizeSel) sizeSel.value = String(Math.min(Math.max(people.length, 1), 10));
    saveDraft();
  }
  function renderPeople() {
    if (!peopleBox) return;
    peopleBox.innerHTML = '';
    people.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'person';
      const name = document.createElement('input');
      name.type = 'text'; name.className = 'pname'; name.placeholder = `Person ${i + 1} name (optional)`;
      name.value = p.name;
      name.addEventListener('input', () => { people[i].name = name.value; writePeople(); });
      const age = document.createElement('select');
      AGES.forEach(([v, label]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = label;
        if (v === p.age_band) o.selected = true; age.appendChild(o);
      });
      age.addEventListener('change', () => { people[i].age_band = age.value; writePeople(); });
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'btn btn-ghost rm'; rm.textContent = '✕'; rm.title = 'Remove';
      rm.addEventListener('click', () => { if (people.length > 1) { people.splice(i, 1); renderPeople(); } });
      row.append(name, age, rm);
      peopleBox.appendChild(row);
    });
    writePeople();
  }
  function initPeople() {
    if (!peopleBox) return;
    let seed: Array<{ name: string; age_band: string }> = [];
    try {
      const arr = JSON.parse(peopleJson?.value || '[]');
      if (Array.isArray(arr)) {
        seed = arr.map((x: any) => ({
          name: String(x?.name ?? ''),
          age_band: ['adult', 'child', 'elderly'].includes(x?.age_band) ? x.age_band : 'adult',
        }));
      }
    } catch { /* ignore */ }
    const wanted = Math.max(1, Number(sizeSel?.value || '1') || 1);
    people = seed.length ? seed : Array.from({ length: wanted }, () => ({ name: '', age_band: 'adult' }));
    renderPeople();
    if (addPersonBtn) addPersonBtn.hidden = false;
  }
  addPersonBtn?.addEventListener('click', () => {
    if (people.length < 10) { people.push({ name: '', age_band: 'adult' }); renderPeople(); }
  });
  sizeSel?.addEventListener('change', () => {
    const n = Math.max(1, Number(sizeSel.value) || 1);
    while (people.length < n) people.push({ name: '', age_band: 'adult' });
    while (people.length > n) people.pop();
    renderPeople();
  });
  initPeople();

  // ---------- internal trip 2 reveal/remove (step 4) ----------
  const trip2 = $('inttrip2');
  const addTrip = $('addtrip') as HTMLButtonElement | null;
  const trip2HasData = () => ['int2_from', 'int2_to', 'int2_date', 'int2_people'].some((n) => val(n));
  function setTrip2(visible: boolean) {
    if (trip2) trip2.hidden = !visible;
    if (addTrip) addTrip.hidden = visible;
  }
  addTrip?.addEventListener('click', () => setTrip2(true));
  trip2?.querySelector('.inttrip-rm')?.addEventListener('click', () => {
    trip2.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
      if (el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    setTrip2(false);
    saveDraft();
  });
  setTrip2(trip2HasData());

  // ---------- WhatsApp toggle + choice-card styling ----------
  const waSame = form.elements.namedItem('wa_same') as HTMLInputElement | null;
  const waBlock = $('waBlock');
  const syncWa = () => { if (waBlock && waSame) waBlock.hidden = waSame.checked; };
  waSame?.addEventListener('change', syncWa);
  syncWa();

  function syncChoice(input: HTMLInputElement) {
    const c = input.closest('.choice');
    if (!c) return;
    if (input.type === 'radio') {
      c.parentElement?.querySelectorAll('.choice').forEach((x) => x.classList.remove('sel'));
      if (input.checked) c.classList.add('sel');
    } else {
      c.classList.toggle('sel', input.checked);
    }
  }
  form.querySelectorAll<HTMLInputElement>('.choice input').forEach((input) => {
    syncChoice(input);
    input.addEventListener('change', () => syncChoice(input));
  });

  // ---------- phone preview (default India; never blocks) ----------
  const phone = $('phone') as HTMLInputElement | null;
  const phoneRegion = form.elements.namedItem('phone_region') as HTMLSelectElement | null;
  const phoneMsg = $('phonemsg');
  function previewPhone() {
    if (!phone || !phoneMsg) return;
    const raw = phone.value.trim();
    if (!raw) { phoneMsg.textContent = ''; phoneMsg.className = 'small'; return; }
    const region = (phoneRegion?.value || 'IN') as CountryCode;
    const p = parsePhoneNumberFromString(raw, region);
    if (p && p.isPossible()) {
      phoneMsg.textContent = `Looks good: ${p.formatInternational()}`;
      phoneMsg.className = 'small ok';
    } else {
      phoneMsg.textContent = "We'll save it as you typed — you can fix it later.";
      phoneMsg.className = 'small bad';
    }
  }
  phone?.addEventListener('blur', previewPhone);
  phoneRegion?.addEventListener('change', previewPhone);
  previewPhone();

  // ---------- step navigation + progress ----------
  const steps = [...form.querySelectorAll<HTMLElement>('.step')];
  const total = steps.length;
  const progress = $('progress');
  const fill = $('fill');
  const stepnum = $('stepnum');
  const stepname = $('stepname');
  const back = $('back') as HTMLButtonElement | null;
  const next = $('next') as HTMLButtonElement | null;
  let cur = 1;

  // a lightweight per-step warning banner
  const warn = document.createElement('div');
  warn.className = 'banner warn'; warn.hidden = true;
  steps[0]?.parentElement?.insertBefore(warn, steps[0]);

  const REQUIRED: Record<number, string[]> = { 1: ['first', 'email', 'phone', 'home_country'], 3: ['arr_from', 'arr_to', 'dep_from', 'dep_to'] };
  function validateStep(n: number): boolean {
    const missing = (REQUIRED[n] || []).filter((name) => !val(name));
    const consentBad = n === 1 && !!(form.elements.namedItem('consent') as HTMLInputElement | null) && !(form.elements.namedItem('consent') as HTMLInputElement).checked;
    const email = n === 1 ? val('email') : '';
    const emailBad = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (missing.length || consentBad || emailBad) {
      warn.textContent = consentBad
        ? 'Please tick the box to share your details so we can plan your travel.'
        : emailBad ? 'That email address doesn’t look right.'
        : 'Please fill the highlighted required fields before continuing.';
      warn.hidden = false;
      const first = missing[0] ?? (consentBad ? 'consent' : 'email');
      (form.elements.namedItem(first) as HTMLElement | null)?.focus?.();
      return false;
    }
    warn.hidden = true;
    return true;
  }

  function show(n: number) {
    cur = Math.min(Math.max(n, 1), total);
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== cur; });
    if (progress) progress.hidden = false;
    if (fill) fill.style.width = `${(cur / total) * 100}%`;
    if (stepnum) stepnum.textContent = `Step ${cur} of ${total}`;
    if (stepname) stepname.textContent = steps[cur - 1]?.dataset.name ?? '';
    if (back) back.hidden = cur === 1;
    if (next) next.textContent = cur === total ? 'Submit registration ✓' : 'Save & Continue →';
    warn.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  back?.addEventListener('click', () => show(cur - 1));
  next?.addEventListener('click', (e) => {
    if (cur < total) {
      e.preventDefault();
      if (validateStep(cur)) show(cur + 1);
    } else if (!validateStep(cur)) {
      e.preventDefault();
    }
    // last step + valid: let the native submit proceed
  });
  // Don't let Enter in a field submit the whole form mid-wizard (it should advance instead).
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && cur < total && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (validateStep(cur)) show(cur + 1);
    }
  });
  // double-submit guard: disable the button once the form actually submits
  form.addEventListener('submit', () => { if (next) { next.disabled = true; next.textContent = 'Submitting…'; } });

  // ---------- "start a new (blank) form" ----------
  const startFresh = $('startfresh') as HTMLButtonElement | null;
  if (startFresh) {
    startFresh.hidden = false;
    startFresh.addEventListener('click', () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      location.href = '/register';
    });
  }

  // ---------- autosave wiring ----------
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);
  saveDraft(); // persist the current (restored or server) state immediately

  show(1);
}
