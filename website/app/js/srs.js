/* Spaced repetition, SM-2 style. A card is {reps, interval (days), ease, due (ms),
   lapses, last}. A case counts as mastered once its interval reaches a week. */

const MIN = 60e3;
const DAY = 864e5;
export const MASTERED_DAYS = 7;

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfToday(now = Date.now()) {
  return startOfDay(now) + DAY - 1;
}

/* rating: "again" | "hard" | "good" | "easy" */
export function grade(card, rating, now = Date.now()) {
  const c = card ? { ...card } : { reps: 0, interval: 0, ease: 2.5, due: now, lapses: 0, last: null };
  if (!c.reps) {
    // first time right, or still learning after a miss
    if (rating === "again") {
      c.interval = 0;
    } else {
      c.reps = 1;
      c.interval = rating === "easy" ? 3 : 1;
      if (rating === "hard") c.ease = Math.max(1.3, c.ease - 0.15);
      if (rating === "easy") c.ease += 0.15;
    }
  } else if (rating === "again") {
    c.lapses += 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.interval = 1;
    c.reps = 1;
  } else if (rating === "hard") {
    c.interval = Math.max(1, Math.round(c.interval * 1.2));
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.reps += 1;
  } else if (rating === "good") {
    c.interval = c.reps === 1 ? 3 : Math.max(c.interval + 1, Math.round(c.interval * c.ease));
    c.reps += 1;
  } else {
    c.interval = Math.max(c.reps === 1 ? 4 : c.interval + 1, Math.round(c.interval * c.ease * 1.3));
    c.ease += 0.15;
    c.reps += 1;
  }
  c.interval = Math.min(c.interval, 365);
  c.due = c.interval ? startOfDay(now) + c.interval * DAY : now + 10 * MIN;
  c.last = now;
  return c;
}

export function cardStatus(card) {
  if (!card) return "new";
  return card.interval >= MASTERED_DAYS ? "mastered" : "learning";
}

export function isDue(card, now = Date.now()) {
  return !!card && card.due <= endOfToday(now);
}

/* Due reviews first (most overdue first), then new cases in teaching order.
   When nothing is due or new, offer the cases seen longest ago as extra practice. */
export function buildSession(cases, cards, now, { module = null, max = 10, newMax = 5 } = {}) {
  const pool = module ? cases.filter((c) => c.module === module) : cases;
  const due = pool
    .filter((c) => isDue(cards[c.id], now))
    .sort((a, b) => cards[a.id].due - cards[b.id].due);
  let ids = due.slice(0, max).map((c) => c.id);
  let fresh = 0;
  for (const c of pool) {
    if (ids.length >= max || fresh >= newMax) break;
    if (!cards[c.id]) {
      ids.push(c.id);
      fresh++;
    }
  }
  let extra = false;
  if (!ids.length) {
    extra = true;
    ids = pool
      .filter((c) => cards[c.id])
      .sort((a, b) => (cards[a.id].last || 0) - (cards[b.id].last || 0))
      .slice(0, Math.min(max, 5))
      .map((c) => c.id);
  }
  return { ids, extra };
}
