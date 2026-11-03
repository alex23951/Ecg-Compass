/* Progress kept in this browser (localStorage). When storage is blocked (private
   mode, a preview) everything still works for the visit and is lost on close.
   Accounts and cross-device sync replace this later; the shape stays the same. */

const KEY = "ecggym.trainer.v1";

function empty() {
  return { cards: {}, answers: [], drills: [], days: [], lang: null, tier: null, lessons: {}, follow: [] };
}

let state = empty();
let persistent = true;

try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = Object.assign(empty(), JSON.parse(raw));
} catch (e) {
  persistent = false;
}

function save() {
  if (!persistent) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    persistent = false;
  }
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function markDay() {
  const t = today();
  if (state.days[state.days.length - 1] !== t) state.days.push(t);
  if (state.days.length > 400) state.days = state.days.slice(-400);
}

export const store = {
  get persistent() {
    return persistent;
  },
  get lang() {
    return state.lang;
  },
  setLang(lang) {
    state.lang = lang;
    save();
  },
  /* The learner's profile: student, nurse, paramedic, resident, specialist or ep. */
  get tier() {
    return state.tier;
  },
  setTier(tier) {
    state.tier = tier;
    save();
  },
  /* Specialists only: cardio (default) or acute (emergency, ATI, internal medicine, GP). */
  get focus() {
    return state.focus || null;
  },
  setFocus(focus) {
    state.focus = focus;
    save();
  },
  /* Lessons of the from-scratch module: {id: {done: time, checks: {stepId: correct}}} */
  lesson(id) {
    return state.lessons[id] || null;
  },
  lessons() {
    return state.lessons;
  },
  logCheck(id, step, correct) {
    const l = state.lessons[id] || (state.lessons[id] = { checks: {} });
    if (!(step in l.checks)) l.checks[step] = correct;
    markDay();
    save();
  },
  finishLesson(id) {
    const l = state.lessons[id] || (state.lessons[id] = { checks: {} });
    l.done = l.done || Date.now();
    save();
  },
  logFollow(id, fid, correct) {
    state.follow.push({ id, fid, correct, t: Date.now() });
    if (state.follow.length > 5000) state.follow = state.follow.slice(-5000);
    save();
  },
  follows() {
    return state.follow;
  },
  card(id) {
    return state.cards[id] || null;
  },
  setCard(id, card) {
    state.cards[id] = card;
    save();
  },
  cards() {
    return state.cards;
  },
  logAnswer(id, chosen, correct) {
    state.answers.push({ id, chosen, correct, t: Date.now() });
    if (state.answers.length > 5000) state.answers = state.answers.slice(-5000);
    markDay();
    save();
  },
  answers() {
    return state.answers;
  },
  logDrill(type, id, err, ok) {
    state.drills.push({ type, id, err, ok, t: Date.now() });
    if (state.drills.length > 5000) state.drills = state.drills.slice(-5000);
    markDay();
    save();
  },
  drills() {
    return state.drills;
  },
  /* Days in a row with any practice, counting today or ending yesterday. */
  streak() {
    const set = new Set(state.days);
    const d = new Date();
    if (!set.has(today())) d.setDate(d.getDate() - 1);
    let n = 0;
    for (;;) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!set.has(k)) return n;
      n++;
      d.setDate(d.getDate() - 1);
    }
  },
  reset() {
    const { lang, tier, focus } = state;
    state = empty();
    state.lang = lang;
    state.tier = tier;
    state.focus = focus;
    save();
  },
};
