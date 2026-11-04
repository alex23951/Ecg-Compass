/* The trainer: lessons from scratch, practice sessions, measurement drills, library,
   progress and the review screen where Alex approves each case. Plain JavaScript, no
   build step. Views follow the URL hash: #home, #profile, #learn, #lesson-waves,
   #practice, #practice-blocks, #case-blocks-01, #drills, #drill-qt, #library, #progress,
   #review, #review-blocks-01, #review-dx-LBBB, #review-lesson-waves.

   Every learner picks a profile (tier): student, nurse, paramedic, resident,
   specialist or electrophysiologist. A case is core, stretch or not shown for each
   tier; the tier also sets the follow-up questions, the explanation depth and the
   drills. */

import { STRINGS, LEAD_LABELS } from "./i18n.js";
import { EcgView, decode } from "./ecg.js";
import { store } from "./store.js";
import { grade, cardStatus, isDue, buildSession } from "./srs.js";
import { diagram } from "./diagrams.js";

const SESSION_MAX = 10;
const SESSION_NEW = 5;
const DRILL_MAX = 10;
const DRILLS = ["pr", "qrs", "qt", "axis"];
// [within tolerance, close], in ms or degrees
const TOL = { pr: [20, 40], qrs: [12, 24], qt: [20, 40], axis: [20, 40] };
const ZOOMS = [1, 1.5, 2, 3, 4];
const MEASURES = ["hr", "rr", "pr", "qrs", "qt", "qtc_b", "qtc_f", "axis"];

const root = document.querySelector("[data-trainer]");
const PREVIEW = root.dataset.mode === "preview";
const main = root.querySelector(".tr-main");
const navEl = root.querySelector(".tr-nav");
const langBtn = root.querySelector(".tr-lang");
const suffixEl = root.querySelector(".tr-brand-suffix");
const previewEl = root.querySelector(".tr-preview");

// ?lang=en (a link from the English site) wins over the saved choice once, then is saved.
const urlLang = new URLSearchParams(location.search).get("lang");
if (["ro", "en"].includes(urlLang) && urlLang !== store.lang) store.setLang(urlLang);
let lang = ["ro", "en"].includes(store.lang) ? store.lang : root.dataset.lang || "ro";
let DATA = null;
let ORDER = []; // cases in teaching order
const CASES = new Map();
const MODULES = new Map();
const TIERS = new Map();
const LESSONS = new Map();
let showAll = false; // library: also the cases of other profiles

/* ---------------------------------------------------------------- helpers */
function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.en[key];
  return typeof v === "function" ? v(...args) : v ?? key;
}

/* MIMIC-IV-ECG records come without age or sex. */
function patientLine(c) {
  if (c.layout === "monitor") return t("patient_monitor");
  return c.patient ? t("patient", c.patient.sex, c.patient.age) : t("patient_unknown");
}

function creditLine(c) {
  if (c.source.transform) return t("credit_swap", c.source.ecg_id, t(`swap_${c.source.transform}`));
  if (c.layout === "monitor") return t(`credit_${c.source.dataset}`, c.source.record, c.source.start);
  return c.source.dataset === "mimic" ? t("credit_mimic", c.source.study_id) : t("credit", c.source.ecg_id);
}

function tx(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] ?? obj.ro ?? obj.en ?? "";
}

/* Teaching marks in the reader's language; numbered after the finding they illustrate. */
function localMarks(list, numbered = false) {
  return (list || []).map((a) => ({ ...a, label: tx(a.label), n: numbered && a.finding != null ? a.finding + 1 : null }));
}

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "value" || k === "selected" || k === "checked") el[k] = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid != null && kid !== false) el.append(kid);
  }
  return el;
}

/* Append to the main area, flattening lists and skipping empty items. */
function put(...kids) {
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) main.append(kid);
}

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat(Infinity)) if (kid != null) el.append(kid);
  return el;
}

/* Decorative line icons, the same set as the site (website/templates/icons.html). */
const ICONS = {
  rhythm: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z M3.2 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.3",
  blocks: "M3 5h18 M3 19h18 M7 5l3 14 M14 5l1.6 7.5 M13 15h5.5",
  ischaemia: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z M12 5l-2 3.5 3 2.5-2 3.5",
  tachy: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z",
  patterns: "M2 17h4.5l1.5-2.5L11.5 3l3.5 18 2-5H22",
  pacing: "M3 11a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M12 14h3l1.5-10L18 14h3",
  "pacing-site": "M3 11a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M12 14h3l1.5-10L18 14h3",
  "pacing-trouble": "M3 11a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M12 14h3l1.5-10L18 14h3",
  arrest: "M2 12c1.5-5 2.5 5 4 0s2.5-6 4 0 2.5 6 4 0 2.5-5 4 0 2 3 4 0",
  compass: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  home: "M3 10.5 12 3l9 7.5 M5 9v11h14V9 M10 20v-6h4v6",
  learn: "M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5Z M12 6v13.5",
  practice: "M2 12h4l2.5-6 4 12 2.5-6H22",
  drills: "M6 3v18 M18 3v18 M6 12h12 M9 9l-3 3 3 3 M15 9l3 3-3 3",
  library: "M4 4h4v16H4Z M10 4h4v16h-4Z M16.5 4.5l3.7-.9 3 15.5-3.7.9Z",
  progress: "M3 3v18h18 M7 15l4-4 3 3 6-6",
  review: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M8 12.3l2.7 2.7L16 9.5",
  zoom: "M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M21 21l-5.6-5.6 M8.5 11h5 M11 8.5v5",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c2.5 2.5 3.6 5.5 3.6 9s-1.1 6.5-3.6 9 M12 3C9.5 5.5 8.4 8.5 8.4 12s1.1 6.5 3.6 9",
};
function icon(name, cls = "icon") {
  return svg("svg", { class: cls, viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", fill: "none",
    stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
  svg("path", { d: ICONS[name] || ICONS.compass }));
}

/* Correct / wrong mark, so the answer state never rests on colour alone. */
const MARKS = { ok: "M7 12.5l3.2 3.2L17 8.8", bad: "M8.5 8.5l7 7M15.5 8.5l-7 7", "ok-plain": "M5 12.5l4.5 4.5L19 7.5", "bad-plain": "M6.5 6.5l11 11M17.5 6.5l-11 11" };
function markIcon(ok, badge = true) {
  return svg("svg", { class: `mk ${badge ? "mk-badge" : "mk-plain"}`, viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    badge ? svg("circle", { class: "mk-bg", cx: 12, cy: 12, r: 11 }) : null,
    svg("path", { class: "mk-fg", d: MARKS[(ok ? "ok" : "bad") + (badge ? "" : "-plain")], fill: "none", "stroke-width": badge ? 2.4 : 2.6,
      "stroke-linecap": "round", "stroke-linejoin": "round" }));
}
/* Put the mark in an option's letter badge (the letter stays in the DOM, hidden by CSS). */
function markOption(b, ok) {
  const letter = b.querySelector(".cs-letter");
  if (!letter || letter.querySelector(".mk")) return;
  letter.classList.add("has-mark");
  letter.append(markIcon(ok, false));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dxName(key) {
  return tx(DATA.diagnoses[key]?.name) || key;
}

/* ---------------------------------------------------------------- tiers */
function tier() {
  return TIERS.get(store.tier) || null;
}

/* core | stretch | skip for the learner's profile; everything is core until one is picked. */
function fit(c) {
  const tr = tier();
  if (!tr) return "core";
  const f = c.tiers?.[tr.id] || "skip";
  // a focus (specialists) can move modules or single cases from core to stretch
  const focus = (tr.focus || []).find((x) => x.id === store.focus);
  return f === "core" && (focus?.stretch?.includes(c.module) || focus?.stretch?.includes(c.id)) ? "stretch" : f;
}

function shown(c) {
  return fit(c) !== "skip";
}

/* Cases for a practice session: the profile's core cases, then its stretch cases
   (in a module, or once seen). */
function practicePool(module) {
  const cards = store.cards();
  const list = ORDER.filter((c) => !module || c.module === module);
  const core = list.filter((c) => fit(c) === "core");
  const stretch = list.filter((c) => fit(c) === "stretch" && (module || cards[c.id]));
  return [...core, ...stretch];
}

function optionsFor(c) {
  const tr = tier();
  return (tr && c.tier_options?.[tr.id]) || c.options;
}

function questionFor(c) {
  const tr = tier();
  return tx((tr && c.tier_question?.[tr.id]) || c.question || tr?.question) || t("question");
}

/* An answer option as the learner sees it: nurses and paramedics get the plain-language
   description first, then the name. */
function optionLabel(key) {
  const plain = tier()?.explain === "action" ? tx(DATA.diagnoses[key]?.plain) : "";
  return plain ? `${plain} (${dxName(key)})` : dxName(key);
}

/* The lesson that teaches a diagnosis, for the "go back to the lesson" link. */
function lessonFor(key) {
  return (DATA.lessons || []).find((l) => l.teaches?.includes(key) && lessonFit(l) !== "skip") || null;
}

function followupsFor(c) {
  const tr = tier();
  return tr ? (c.followups || []).filter((f) => f.tiers.includes(tr.id)) : [];
}

function fitTag(c) {
  const f = fit(c);
  if (f === "stretch") return h("span", { class: "tag tag-accent", text: t("fit_stretch") });
  if (f === "skip" && tier()) return h("span", { class: "tag", text: t("fit_other") });
  return null;
}

/* A number with the decimal comma in Romanian. */
function num(n) {
  return lang === "ro" ? String(n).replace(".", ",") : String(n);
}

function signed(n, unit = "") {
  if (n > 0) return `+${n}${unit}`;
  if (n < 0) return `−${-n}${unit}`;
  return `0${unit}`;
}

function angle(a) {
  return signed(Math.round(a), "°");
}

function angleDiff(a, b) {
  return ((a - b + 540) % 360) - 180;
}

function axisClass(a) {
  if (a >= -30 && a <= 90) return t("axis_normal");
  if (a < -30 && a >= -90) return t("axis_left");
  if (a > 90 && a <= 180) return t("axis_right");
  return t("axis_extreme");
}

function lines(text) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function when(iso) {
  try {
    return new Date(iso).toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch (e) {
    return iso;
  }
}

/* A measurement as shown to learners: the mean when the two algorithms agree,
   the range between them when they don't. */
function mval(c, k) {
  const v = c.measure[k];
  if (v == null) return null;
  const src = c.measure_sources?.[k];
  if (k === "axis" || c.agree[k] || !Array.isArray(src) || src.length < 2 || src.some((x) => x == null)) return String(v);
  const [a, b] = src.map(Math.round).sort((x, y) => x - y);
  return a === b ? String(a) : `${a}–${b}`;
}

/* ---------------------------------------------------------------- data */
const signalCache = new Map();
function loadSignal(ecgId) {
  if (!signalCache.has(ecgId)) {
    const p = fetch(`data/signals/${ecgId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(decode);
    p.catch(() => signalCache.delete(ecgId));
    signalCache.set(ecgId, p);
  }
  return signalCache.get(ecgId);
}

/* Shared storage for reviews and error reports. Only available when the page is
   opened from claude.ai while signed in; everything else works without it. */
let db = null;
let me = null;
let dbState = "connecting"; // connecting | on | off
const reviews = new Map();
const reports = [];
let reviewRefresh = null;

async function connect() {
  let claude = window.claude;
  if (!claude?.use) {
    await new Promise((r) => setTimeout(r, 800));
    claude = window.claude;
  }
  if (!claude?.use) {
    dbState = "off";
    onShared();
    return;
  }
  try {
    db = await claude.use("db");
    const user = await claude.use("user");
    me = user ? await user.id() : null;
  } catch (e) {
    db = null;
  }
  if (!db) {
    dbState = "off";
    onShared();
    return;
  }
  dbState = "on";
  db.collection("reviews").onSnapshot(
    (snap) => {
      reviews.clear();
      snap.docs.forEach((d) => d.exists && reviews.set(d.id, d.data()));
      onShared();
    },
    () => onShared(),
  );
  db.collection("reports").onSnapshot(
    (snap) => {
      reports.length = 0;
      snap.docs.forEach((d) => d.exists && reports.push({ id: d.id, ...d.data() }));
      onShared();
    },
    () => {},
  );
  onShared();
}

function onShared() {
  const [view, arg] = parseHash();
  if (view === "review" && arg && reviewRefresh) reviewRefresh();
  else if ((view === "review" && !arg) || view === "library") render(false);
}

function reviewStatus(id) {
  return reviews.get(id)?.status || "todo";
}

/* ---------------------------------------------------------------- shell */
let cleanups = [];
function onCleanup(fn) {
  cleanups.push(fn);
}

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, "")) || "home";
  const i = raw.indexOf("-");
  return i < 0 ? [raw, null] : [raw.slice(0, i), raw.slice(i + 1)];
}

const NAV = [
  ["home", "nav_home", ["home", "profile"]],
  ["learn", "nav_learn", ["learn", "lesson"]],
  ["practice", "nav_practice", ["practice"]],
  ["drills", "nav_drills", ["drills", "drill"]],
  ["library", "nav_library", ["library", "case"]],
  ["progress", "nav_progress", ["progress"]],
];
if (PREVIEW) NAV.push(["review", "nav_review", ["review"]]);

function renderChrome(view) {
  document.documentElement.lang = lang;
  suffixEl.textContent = t("brand_suffix");
  langBtn.textContent = t("lang_switch");
  langBtn.setAttribute("aria-label", t("lang_switch_label"));
  langBtn.setAttribute("lang", lang === "ro" ? "en" : "ro");
  previewEl.hidden = !PREVIEW;
  previewEl.textContent = t("preview_note");
  navEl.replaceChildren(
    ...NAV.map(([href, key, views]) =>
      h("a", { href: `#${href}`, "aria-current": views.includes(view) ? "page" : null }, icon(href), h("span", { text: t(key) })),
    ),
  );
  revealNavItem(navEl.querySelector("[aria-current]"));
  navEdges();
}

// scroll the nav row sideways only (never the page) so an item clears the edge fades
function revealNavItem(a) {
  if (!a || navEl.scrollWidth <= navEl.clientWidth) return;
  const n = navEl.getBoundingClientRect();
  const r = a.getBoundingClientRect();
  const pad = 52;
  if (r.right > n.right - pad) navEl.scrollLeft += r.right - n.right + pad;
  else if (r.left < n.left + pad) navEl.scrollLeft -= n.left + pad - r.left;
}
navEl.addEventListener("focusin", (e) => revealNavItem(e.target.closest("a")));

function navEdges() {
  const max = navEl.scrollWidth - navEl.clientWidth;
  navEl.classList.toggle("is-more-left", max > 1 && navEl.scrollLeft > 1);
  navEl.classList.toggle("is-more-right", max > 1 && navEl.scrollLeft < max - 1);
}
navEl.addEventListener("scroll", navEdges, { passive: true });
window.addEventListener("resize", navEdges, { passive: true });

function render(scroll = true) {
  cleanups.splice(0).forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* a view that is already gone */
    }
  });
  reviewRefresh = null;
  const [view, arg] = parseHash();
  renderChrome(view);
  const y = window.scrollY;
  main.replaceChildren();
  if (!DATA) {
    put(h("p", { class: "tr-msg", text: t("loading") }));
    return;
  }
  const views = {
    home: viewHome,
    profile: viewProfile,
    learn: viewLearn,
    lesson: viewLesson,
    practice: viewPractice,
    case: viewCase,
    drills: viewDrills,
    drill: viewDrill,
    library: viewLibrary,
    progress: viewProgress,
    review: viewReview,
  };
  (views[view] || viewHome)(arg);
  if (scroll) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, y);
  }
}

/* ---------------------------------------------------------------- viewer */
function makeViewer(c, { look = [], revealed = false, calipers = "off", span = 0.2, strip = null, marks = [], init = null,
  annotations = [], numbered = false, annOn = revealed } = {}) {
  const narrow = window.matchMedia("(max-width: 700px)").matches;
  // a case can open at 5 mm/mV (very large complexes on a monitor strip)
  const st = { zoom: narrow ? 2 : 1, gain: c.gain || 10, cal: calipers, hl: revealed && look.length > 0, revealed,
    anns: annotations, ann: annOn && annotations.length > 0, focus: null, hlNow: null };
  const shownMarks = () => (st.ann ? localMarks(st.anns, numbered) : []);
  let view = null;
  const listeners = [];

  const readout = h("output", { class: "vw-readout", "aria-live": "polite" });
  const host = h("div", { class: "vw-ecg" }, h("p", { class: "vw-msg", text: t("loading") }));
  const hint = h("p", { class: "vw-hint", text: t("cal_hint"), hidden: st.cal === "off" });

  function group(label, options, get, set) {
    const btns = options.map(([val, text, aria]) =>
      h("button", {
        type: "button", class: "vw-btn", "aria-pressed": String(get() === val), "aria-label": aria || null, text,
        onclick: () => {
          set(val);
          btns.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i][0] === get())));
        },
      }),
    );
    return h("div", { class: "vw-group", role: "group", "aria-label": label },
      h("span", { class: "vw-label", text: label }), h("span", { class: "vw-seg" }, btns));
  }

  function setZoom(z) {
    st.zoom = z;
    if (!view) return;
    const sc = view.scroller;
    const frac = (sc.scrollLeft + sc.clientWidth / 2) / (sc.scrollWidth || 1);
    view.setZoom(z);
    sc.scrollLeft = frac * sc.scrollWidth - sc.clientWidth / 2;
  }

  function showReading(r) {
    if (!r) readout.textContent = "";
    else if (r.mode === "time") readout.textContent = t("cal_time", Math.round(r.ms), r.bpm ? Math.round(r.bpm) : "–");
    else readout.textContent = t("cal_volt", r.mv.toFixed(2), r.mm.toFixed(1));
  }

  const zoom = h("div", { class: "vw-group", role: "group", "aria-label": t("tool_zoom_in") },
    h("span", { class: "vw-label vw-label-icon", "aria-hidden": "true" }, icon("zoom")), h("span", { class: "vw-seg" },
    h("button", { type: "button", class: "vw-btn", "aria-label": t("tool_zoom_out"), text: "−",
      onclick: () => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(st.zoom) - 1)] || 1) }),
    h("button", { type: "button", class: "vw-btn", text: t("tool_fit"), onclick: () => setZoom(1) }),
    h("button", { type: "button", class: "vw-btn", "aria-label": t("tool_zoom_in"), text: "+",
      onclick: () => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(st.zoom) + 1)]) }),
  ));
  const gain = group(t("tool_gain"), [[5, "5"], [10, "10"], [20, "20"]], () => st.gain, (g) => {
    st.gain = g;
    view?.setGain(g);
  });
  const cal = group(t("tool_calipers"), [
    ["off", t("tool_calipers_off")], ["time", t("tool_calipers_time")], ["volt", t("tool_calipers_volt")],
  ], () => st.cal, (m) => {
    st.cal = m;
    hint.hidden = m === "off";
    if (!view) return;
    if (m === "off") view.hideCalipers();
    else {
      view.showCalipers(m, m === "time" ? init || [1, 1 + span] : undefined);
      view.overlay.focus({ preventScroll: true });
    }
  });
  const hlBtn = look.length
    ? h("button", {
      type: "button", class: "vw-btn vw-toggle", "aria-pressed": String(st.hl), disabled: !st.revealed && !tier()?.hints,
      text: t("tool_highlight"),
      onclick: () => {
        st.hl = !st.hl;
        hlBtn.setAttribute("aria-pressed", String(st.hl));
        view?.setHighlight(st.hl ? look : []);
      },
    })
    : null;

  // arrows and labels on the tracing: on once the answer is in (or straight away in a lesson)
  const annBtn = h("button", {
    type: "button", class: "vw-btn vw-toggle", "aria-pressed": String(st.ann), disabled: !st.revealed && !annOn,
    hidden: !annotations.length, text: t("tool_marks"),
    onclick: () => {
      st.ann = !st.ann;
      annBtn.setAttribute("aria-pressed", String(st.ann));
      view?.setAnnotations(shownMarks(), st.focus);
    },
  });

  const el = h("figure", { class: "vw" },
    h("div", { class: "vw-panel" },
      h("div", { class: "vw-bar", role: "toolbar", "aria-label": "ECG" }, zoom, gain, cal, hlBtn, annBtn, readout),
      host),
    hint,
    h("p", { class: "vw-rotate", text: t("rotate_hint") }),
    h("figcaption", { class: "credit", text: creditLine(c) }),
  );

  // a monitor strip is one unnamed lead, drawn full length like a rhythm strip
  if (!strip && c.layout === "monitor") strip = { leads: ["MON"], window: null, full: true, rowH: 44 };
  loadSignal(c.ecg_id)
    .then((ecg) => {
      if (!host.isConnected && !el.isConnected) return;
      host.replaceChildren();
      view = new EcgView(host, ecg, {
        layout: strip ? "strip" : "standard", leads: strip?.leads, window: strip?.window, rowH: strip?.rowH,
        strips: c.strips || ["II"], zoom: st.zoom, gain: st.gain, labels: LEAD_LABELS[lang], maxPxmm: strip && !strip.full ? 8 : null,
        highlight: st.hlNow ?? (st.hl ? look : []), marks, annotations: shownMarks(),
      });
      view.overlay.setAttribute("aria-label", t("tool_calipers"));
      view.onCalipers((r) => {
        showReading(r);
        listeners.forEach((fn) => fn(r));
      });
      if (st.cal === "time") view.showCalipers("time", init || [1, 1 + span]);
      else if (st.cal !== "off") view.showCalipers(st.cal);
    })
    .catch(() => {
      host.replaceChildren(h("p", { class: "vw-msg", text: t("load_error") }));
    });
  onCleanup(() => view?.destroy());

  return {
    el,
    reveal() {
      st.revealed = true;
      if (hlBtn) {
        hlBtn.disabled = false;
        st.hl = true;
        hlBtn.setAttribute("aria-pressed", "true");
      }
      view?.setHighlight(look);
      if (st.anns.length) {
        annBtn.disabled = false;
        st.ann = true;
        annBtn.setAttribute("aria-pressed", "true");
        view?.setAnnotations(shownMarks(), st.focus);
      }
    },
    reading: () => view?.reading() || null,
    onReading: (fn) => listeners.push(fn),
    setMarks: (m) => view?.setMarks(m),
    setHighlight(leads) {
      st.hlNow = leads || [];
      view?.setHighlight(st.hlNow);
    },
    /* new marks (a lesson set or a guided frame); shown unless the reader switched them off */
    setAnnotations(list) {
      st.anns = list || [];
      st.focus = null;
      annBtn.hidden = !st.anns.length;
      view?.setAnnotations(shownMarks());
    },
    /* show one finding's marks at full strength and bring them into view */
    focusFinding(i) {
      if (!st.anns.length) return;
      if (!st.ann) {
        st.ann = true;
        annBtn.setAttribute("aria-pressed", "true");
      }
      st.focus = st.focus === i ? null : i;
      if (!view) return st.focus;
      view.setAnnotations(shownMarks(), st.focus);
      const x = st.focus == null ? null : view.annotationX(st.focus);
      const sc = view.scroller;
      if (x != null && sc.scrollWidth > sc.clientWidth) {
        sc.scrollTo({ left: Math.max(0, x - sc.clientWidth / 2), behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      if (st.focus != null && (r.bottom < 60 || r.top > window.innerHeight - 60)) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return st.focus;
    },
  };
}

/* ---------------------------------------------------------------- home */
function moduleStats(id) {
  const cards = store.cards();
  const list = ORDER.filter((c) => c.module === id && shown(c));
  const seen = list.filter((c) => cards[c.id]).length;
  const mastered = list.filter((c) => cardStatus(cards[c.id]) === "mastered").length;
  const ids = new Set(list.map((c) => c.id));
  const ans = store.answers().filter((a) => ids.has(a.id));
  const acc = ans.length ? Math.round((100 * ans.filter((a) => a.correct).length) / ans.length) : null;
  const stretch = list.filter((c) => fit(c) === "stretch").length;
  return { total: list.length, stretch, seen, mastered, acc, answers: ans.length };
}

function viewHome() {
  if (DATA.tiers?.length && !tier()) return viewProfile();
  const cards = store.cards();
  const now = Date.now();
  const pool = practicePool(null);
  const due = pool.filter((c) => isDue(cards[c.id], now)).length;
  const fresh = pool.filter((c) => !cards[c.id]).length;
  const planDue = Math.min(due, SESSION_MAX);
  const planNew = Math.min(fresh, SESSION_NEW, SESSION_MAX - planDue);
  const answers = store.answers();
  const acc = answers.length ? Math.round((100 * answers.filter((a) => a.correct).length) / answers.length) : null;
  const mine = ORDER.filter(shown);
  const seen = mine.filter((c) => cards[c.id]).length;
  const streak = store.streak();

  const stats = [t("home_due", planDue), t("home_new", planNew)];
  if (streak) stats.push(t("home_streak", streak));
  if (seen) stats.push(t("home_seen", seen, mine.length));
  if (acc != null) stats.push(t("home_accuracy", acc));

  const tr = tier();
  const basics = courseLessons("basics");
  const basicsLeft = basics.filter((l) => !store.lesson(l.id)?.done);
  const lessons = courseLessons("full");
  const required = lessons.filter((l) => lessonFit(l) === "required");
  const left = required.filter((l) => !store.lesson(l.id)?.done);
  const nextLesson = basicsLeft.length ? null : left[0] || null;
  put(
    tr && h("p", { class: "tr-profile" },
      t("profile_line", tx(tr.name)), " ",
      h("a", { href: "#profile", text: t("profile_change") })),
    basicsLeft.length > 0 && h("section", { class: "tr-section tr-teaser tr-learn-teaser tr-basics-teaser" },
      h("span", { class: "tr-module-icon" }, icon("learn")),
      h("div", null,
        h("h2", { text: t("basics_teaser_title") }),
        h("p", { text: t("basics_teaser_text", basics.length - basicsLeft.length, basics.length) }),
      ),
      h("a", { class: "btn", href: `#lesson-${basicsLeft[0].id}`,
        text: basicsLeft.length === basics.length ? t("learn_start") : t("learn_continue") })),
    nextLesson && h("section", { class: "tr-section tr-teaser tr-learn-teaser" },
      h("div", null,
        h("h2", { text: t("learn_teaser_title") }),
        h("p", { text: t("learn_teaser_text", required.length - left.length, required.length) }),
      ),
      h("a", { class: "btn", href: `#lesson-${nextLesson.id}`,
        text: required.length === left.length ? t("learn_start") : t("learn_continue") })),
    h("section", { class: "tr-today" },
      h("h1", { text: t("home_title") }),
      h("ul", { class: "tr-stats" }, stats.map((s) => h("li", { text: s }))),
      planDue + planNew
        ? h("p", null, h("a", { class: "btn btn-lg", href: "#practice" }, t("home_start"), icon("arrow")))
        : h("p", { class: "tr-note", text: t("home_nothing_due") }),
      !store.persistent && h("p", { class: "tr-note", text: t("progress_storage_off") }),
    ),
    h("section", { class: "tr-section" },
      h("h2", { text: t("home_modules") }),
      h("ul", { class: "tr-modules" }, DATA.modules.map((m) => {
        const s = moduleStats(m.id);
        if (!s.total) return null;
        return h("li", { class: "tr-module" },
          h("div", { class: "tr-module-top" },
            h("span", { class: "tr-module-icon" }, icon(m.id)),
            h("h3", { text: tx(m.title) }),
            m.free && h("span", { class: "tag", text: t("badge_free") }),
            m.signature && h("span", { class: "tag tag-accent", text: t("badge_signature") }),
          ),
          h("p", { class: "tr-module-blurb", text: tx(m.blurb) }),
          h("div", { class: "tr-bar", role: "img", "aria-label": t("module_mastered", s.mastered, s.total) },
            h("span", { class: "tr-bar-seen", style: `width:${(100 * s.seen) / s.total}%` }),
            h("span", { class: "tr-bar-done", style: `width:${(100 * s.mastered) / s.total}%` }),
          ),
          h("p", { class: "tr-module-meta" }, `${t("module_cases", s.total)}${s.stretch ? ` · ${t("module_stretch", s.stretch)}` : ""} · ${t("module_mastered", s.mastered, s.total)}`),
          h("a", { class: "btn btn-quiet tr-module-go", href: `#practice-${m.id}` }, t("home_start_module"), icon("arrow")),
        );
      })),
    ),
    h("section", { class: "tr-section tr-teaser tr-drills-teaser" },
      h("span", { class: "tr-module-icon" }, icon("drills")),
      h("div", null,
        h("h2", { text: t("home_drills_title") }),
        h("p", { text: t("home_drills_text") }),
      ),
      h("a", { class: "btn btn-quiet", href: "#drills", text: t("home_drills_go") }),
    ),
  );
}

/* ---------------------------------------------------------------- profile */
function viewProfile() {
  const cur = store.tier;
  put(
    h("h1", { text: t("profile_title") }),
    h("p", { class: "tr-intro", text: t("profile_intro") }),
    h("ul", { class: "tier-grid" }, DATA.tiers.map((tr) => {
      const n = ORDER.filter((c) => c.tiers?.[tr.id] && c.tiers[tr.id] !== "skip").length;
      return h("li", { class: `tier${tr.id === cur ? " is-current" : ""}` },
        h("h2", { text: tx(tr.name) }),
        h("p", { class: "tier-who", text: tx(tr.who) }),
        h("ul", { class: "cs-list" }, (tx(tr.goals) || []).map((g) => h("li", { text: g }))),
        h("p", { class: "tr-module-meta", text: t("module_cases", n) }),
        tr.focus?.length && tr.id === cur ? h("div", { class: "vw-group tier-focus", role: "group", "aria-label": t("profile_focus") },
          h("span", { class: "vw-label", text: t("profile_focus") }),
          h("span", { class: "vw-seg" }, tr.focus.map((f, k) => h("button", { type: "button", class: "vw-btn",
            "aria-pressed": String((store.focus || tr.focus[0].id) === f.id), text: tx(f.name),
            onclick: () => {
              store.setFocus(f.id);
              session = null;
              render(false);
            } })))) : null,
        tr.id === cur
          ? h("p", { class: "tier-mine" }, h("span", { class: "chip chip-ok", text: t("profile_current") }), " ",
            h("a", { href: "#home", text: t("back_home") }))
          : h("button", { type: "button", class: "btn", text: t("profile_pick"),
            onclick: () => {
              store.setTier(tr.id);
              session = null;
              drill = null;
              const first = (DATA.lessons || []).find((l) => lessonFit(l) === "required" && !store.lesson(l.id)?.done);
              location.hash = cur || !first ? "#home" : "#learn";
              render(true);
            } }));
    })),
    h("p", { class: "tr-note", text: t("profile_note") }),
  );
}

/* ---------------------------------------------------------------- lessons */
/* required | optional | skip for the learner's profile */
function lessonFit(l) {
  const tr = tier();
  return tr ? l.tiers?.[tr.id] || "optional" : "required";
}

const COURSES = ["basics", "full"];
const courseOf = (l) => l.course || "full";

/* The lessons of one course that this profile sees, in order. */
function courseLessons(course) {
  return (DATA.lessons || []).filter((l) => courseOf(l) === course && lessonFit(l) !== "skip");
}

function viewLearn() {
  const courses = COURSES.map((id) => [id, courseLessons(id)]).filter(([, list]) => list.length);
  put(
    h("h1", { text: t("nav_learn") }),
    tier() && h("p", { class: "tr-note", text: t("learn_profile", tx(tier().name)) }),
    courses.map(([id, list]) => h("section", { class: `tr-section ls-course ls-course-${id}` },
      h("h2", { text: id === "basics" ? t("course_basics") : courses.length > 1 ? t("course_full") : t("learn_title") }),
      h("p", { class: "tr-intro", text: id === "basics" ? t("course_basics_intro") : t("learn_intro") }),
      h("p", { class: "tr-score", text: t("learn_progress", list.filter((l) => store.lesson(l.id)?.done).length, list.length) }),
      lessonRows(list))),
  );
}

function lessonRows(list) {
  return h("ol", { class: "ls-list" }, list.map((l) => {
      const st = store.lesson(l.id);
      const fitL = lessonFit(l);
      return h("li", null, h("a", { class: "tr-row", href: `#lesson-${l.id}` },
        h("span", { class: "tr-row-title" },
          l.step != null && courseOf(l) === "basics" && h("span", { class: "ls-step-tag", text: t("reading_step", l.step) }),
          h("span", { class: "ls-title", text: tx(l.title) }),
          h("span", { class: "ls-sub", text: tx(l.summary) })),
        h("span", { class: "tr-row-meta" },
          h("span", { class: "tr-row-level", text: t("minutes", l.minutes) }),
          fitL === "optional" && h("span", { class: "tag", text: t("lesson_optional") }),
          st?.done ? h("span", { class: "chip chip-ok", text: t("lesson_done") }) : null,
          reviewTag(`lesson-${l.id}`))));
    }));
}

function viewLesson(id, reviewing = false) {
  const l = LESSONS.get(id);
  if (!l) return viewLearn();
  const list = (DATA.lessons || []).filter((x) => courseOf(x) === courseOf(l) && (lessonFit(x) !== "skip" || x.id === id));
  const i = list.findIndex((x) => x.id === id);
  const next = list[i + 1];
  const finish = h("button", { type: "button", class: "btn",
    text: next ? t("lesson_finish_next") : t("lesson_finish"),
    onclick: () => {
      store.finishLesson(l.id);
      location.hash = next ? `#lesson-${next.id}` : "#learn";
    } });
  put(
    h("article", { class: "ls" },
      h("div", { class: "cs-bar" },
        h("a", { class: "cs-back", href: "#learn", text: `← ${t("nav_learn")}` }),
        h("span", { class: "cs-count", text: t("lesson_of", i + 1, list.length) }),
        h("div", { class: "cs-progress", "aria-hidden": "true" },
          h("span", { style: `width:${(100 * (i + 1)) / list.length}%` }))),
      l.step != null && courseOf(l) === "basics" && h("p", { class: "ls-step-tag", text: t("reading_step", l.step) }),
      h("h1", { class: "cs-q", text: tx(l.title) }),
      h("div", { class: "ls-goals" },
        h("p", { class: "fu-kind", text: t("lesson_goals") }),
        h("ul", { class: "cs-list" }, (tx(l.objectives) || []).map((o) => h("li", { text: o })))),
      l.steps.filter((step) => reviewing || !step.only || !tier() || step.only.includes(tier().id))
        .map((step) => [
          reviewing && step.only && h("p", { class: "tag ls-only", text: t("lesson_only", step.only.map((x) => tx(TIERS.get(x)?.name) || x).join(", ")) }),
          lessonStep(l, step)]),
      !reviewing && h("div", { class: "ls-end" },
        store.lesson(l.id)?.done && h("p", { class: "tr-note", text: t("lesson_done_note") }),
        h("p", { class: "tr-actions" }, finish, h("a", { class: "btn btn-quiet", href: "#learn", text: t("learn_all") }))),
    ),
  );
}

function paragraphs(v) {
  const list = tx(v);
  return (Array.isArray(list) ? list : [list]).filter(Boolean).map((x) => h("p", { text: x }));
}

function lessonStep(l, step) {
  if (step.type === "text") {
    return h("section", { class: "ls-step ls-text" },
      step.heading && h("h2", { text: tx(step.heading) }), paragraphs(step.body));
  }
  if (step.type === "diagram") {
    return h("figure", { class: "ls-step ls-diagram" },
      diagram(step.name, lang),
      step.caption && h("figcaption", { text: tx(step.caption) }));
  }
  if (step.type === "figure") return lessonFigure(step);
  if (step.type === "guided") return lessonGuided(l, step);
  if (step.type === "task") return lessonTask(l, step);
  if (step.type === "check") return lessonCheck(l, step);
  if (step.type === "cases") {
    return h("section", { class: "ls-step ls-cases" },
      step.heading && h("h2", { text: tx(step.heading) }), paragraphs(step.body),
      h("ul", { class: "tr-rows" }, step.cases.filter((cid) => CASES.has(cid)).map((cid) => {
        const c = CASES.get(cid);
        return h("li", null, h("a", { class: "tr-row", href: `#case-${cid}` },
          h("span", { class: "tr-row-title", text: dxName(c.answer) }),
          h("span", { class: "tr-row-meta" }, statusTag(cid))));
      })));
  }
  return null;
}

/* A real ECG strip with teaching marks; optional buttons switch between sets of marks. */
function lessonFigure(step) {
  const sets = step.sets || [];
  const pseudo = { ecg_id: step.ecg, strips: step.strips, source: step.source, layout: step.monitor ? "monitor" : null, gain: step.gain };
  const setAnns = (set) => [...(step.annotations || []), ...(set?.annotations || [])];
  const viewer = makeViewer(pseudo, {
    strip: step.layout === "standard" ? null : { leads: step.leads || ["II"], window: step.window },
    marks: sets.length ? sets[0].marks : step.marks || [],
    look: step.look || [], revealed: !!step.look, annotations: setAnns(sets[0]), annOn: true,
  });
  let current = 0;
  const btns = sets.map((set, k) => h("button", { type: "button", class: "vw-btn", "aria-pressed": String(k === 0), text: tx(set.label),
    onclick: () => {
      current = k;
      btns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === current)));
      viewer.setMarks(set.marks);
      viewer.setAnnotations(setAnns(set));
      note.textContent = tx(set.note) || "";
    } }));
  const note = h("p", { class: "ls-note", "aria-live": "polite", text: sets.length ? tx(sets[0].note) || "" : "" });
  return h("section", { class: "ls-step ls-figure" },
    step.heading && h("h2", { text: tx(step.heading) }),
    paragraphs(step.body),
    btns.length > 1 && h("div", { class: "vw-group ls-sets", role: "group", "aria-label": t("lesson_show") },
      h("span", { class: "vw-label", text: t("lesson_show") }), h("span", { class: "vw-seg" }, btns)),
    viewer.el,
    note,
    step.caption && h("p", { class: "cs-small", text: tx(step.caption) }));
}

/* One tracing explained frame by frame: each frame adds its own arrows, labels and lead
   boxes, with a short text. Back and Next walk through the frames. */
function lessonGuided(l, step) {
  const frames = step.frames || [];
  const pseudo = { ecg_id: step.ecg, strips: step.strips, source: step.source, layout: step.monitor ? "monitor" : null, gain: step.gain };
  const viewer = makeViewer(pseudo, {
    strip: step.layout === "standard" ? null : { leads: step.leads || ["II"], window: step.window },
    marks: frames[0]?.marks || [], annotations: frames[0]?.annotations || [], annOn: true,
  });
  let k = 0;
  const count = h("span", { class: "gd-count" });
  const title = h("h3", { class: "gd-title" });
  const text = h("div", { class: "gd-text" });
  const prev = h("button", { type: "button", class: "btn btn-quiet", text: `← ${t("guided_prev")}`, onclick: () => go(k - 1) });
  const next = h("button", { type: "button", class: "btn", text: `${t("guided_next")} →`, onclick: () => go(k + 1) });
  const dots = frames.map((f, i) => h("button", { type: "button", class: "gd-dot", "aria-label": `${t("guided_goto", i + 1)}: ${tx(f.title)}`,
    onclick: () => go(i) }));
  const body = h("div", { class: "gd-frame", "aria-live": "polite" }, h("p", { class: "gd-kicker" }, count), title, text);
  function go(i, first = false) {
    k = Math.max(0, Math.min(frames.length - 1, i));
    const f = frames[k];
    count.textContent = t("guided_of", k + 1, frames.length);
    title.textContent = tx(f.title);
    text.replaceChildren(...paragraphs(f.text));
    dots.forEach((d, j) => d.setAttribute("aria-current", j === k ? "step" : "false"));
    prev.disabled = k === 0;
    next.disabled = k === frames.length - 1;
    if (!first) {
      viewer.setMarks(f.marks || []);
      viewer.setAnnotations(f.annotations || []);
    }
    viewer.setHighlight(f.highlight || []);
  }
  go(0, true);
  return h("section", { class: "ls-step ls-guided" },
    step.heading && h("h2", { text: tx(step.heading) }),
    paragraphs(step.body),
    viewer.el,
    h("div", { class: "gd-nav" }, prev, h("div", { class: "gd-dots" }, dots), next),
    body,
    step.caption && h("p", { class: "cs-small", text: tx(step.caption) }));
}

/* Measure something with the calipers; checked against the reference with a tolerance. */
function lessonTask(l, step) {
  const pseudo = { ecg_id: step.ecg, strips: step.strips, source: step.source, layout: step.monitor ? "monitor" : null, gain: step.gain };
  // rr, pr, qrs, qt and rate use time calipers; volt (ST, R height) voltage calipers; count none
  const mode = step.measure === "volt" ? "volt" : step.measure === "count" ? "off" : "time";
  const viewer = makeViewer(pseudo, {
    strip: { leads: step.leads || ["II"], window: step.window },
    calipers: mode, init: mode === "time" ? step.init : null, marks: step.marks || [],
  });
  const unit = step.unit || (mode === "volt" ? "mm" : mode === "off" ? "count" : "ms");
  const fromCal = (r) => {
    if (r?.mode === "volt") return Math.round(r.mm * 2) / 2;
    if (r?.mode === "time") return Math.round(unit === "bpm" ? r.bpm : r.ms);
    return NaN;
  };
  const input = h("input", { type: "number", inputmode: mode === "volt" ? "decimal" : "numeric", step: mode === "volt" ? "0.5" : "1",
    min: "0", max: "3000", autocomplete: "off", "aria-label": tx(step.label) || t("drill_value") });
  const result = h("div", { class: "dr-result", "aria-live": "polite" });
  const prior = store.lesson(l.id)?.checks?.[step.id];
  const check = h("button", { type: "button", class: "btn", text: t("drill_submit") });
  const useCal = mode === "off" ? null : h("button", { type: "button", class: "btn btn-quiet", text: t("drill_use_calipers"),
    onclick: () => {
      const v = fromCal(viewer.reading());
      if (Number.isFinite(v)) input.value = v;
    } });
  check.addEventListener("click", () => {
    let v = parseFloat(String(input.value).replace(",", "."));
    if (!Number.isFinite(v)) {
      v = fromCal(viewer.reading());
      if (Number.isFinite(v)) input.value = v;
    }
    if (!Number.isFinite(v)) return input.focus();
    const ok = Math.abs(v - step.ref) <= step.tol + 1e-9;
    store.logCheck(l.id, step.id, ok);
    const u = { bpm: t("per_min"), mm: " mm", count: "", ms: " ms" }[unit] ?? ` ${unit}`;
    result.replaceChildren(
      h("p", { class: `dr-verdict ${ok ? "good" : "off"}` }, markIcon(ok), t(ok ? "drill_good" : "drill_off")),
      h("dl", { class: "dr-nums" },
        h("div", null, h("dt", { text: t("drill_reference") }), h("dd", { text: `${num(step.ref)}${u}` })),
        h("div", null, h("dt", { text: t("drill_yours") }), h("dd", { text: `${num(mode === "volt" ? v : Math.round(v))}${u}` }))),
      h("p", { text: tx(step.explain) }));
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") check.click();
  });
  return h("section", { class: "ls-step ls-task" },
    h("p", { class: "fu-kind", text: t("lesson_task") }),
    h("h2", { text: tx(step.prompt) }),
    paragraphs(step.body),
    viewer.el,
    h("div", { class: "dr-inputs" },
      h("div", { class: "dr-row" }, input, useCal, check),
      h("p", { class: "cs-small", text: t(mode === "off" ? "lesson_count_hint" : mode === "volt" ? "lesson_volt_hint" : "lesson_task_hint") })),
    prior != null && !result.childNodes.length ? h("p", { class: "cs-small", text: t(prior ? "lesson_task_done" : "lesson_task_tried") }) : null,
    result);
}

function lessonCheck(l, step) {
  const out = h("div", { class: "fu-result", "aria-live": "polite" });
  const btns = [];
  const f = step.figure;
  const viewer = f ? makeViewer({ ecg_id: f.ecg, strips: f.strips, source: f.source, layout: f.monitor ? "monitor" : null, gain: f.gain }, {
    strip: f.layout === "standard" ? null : { leads: f.leads || ["II"], window: f.window },
    annotations: f.annotations || [], annOn: false, look: f.look || [],
  }) : null;
  const mark = (i) => {
    viewer?.reveal();
    btns.forEach((b, k) => {
      b.disabled = true;
      b.classList.add(k === step.answer ? "is-correct" : k === i ? "is-wrong" : "is-dim");
      if (k === step.answer || k === i) markOption(b, k === step.answer);
    });
    const ok = i === step.answer;
    out.replaceChildren(
      h("p", { class: `cs-verdict ${ok ? "ok" : "bad"}` }, markIcon(ok), h("strong", { text: t(ok ? "correct" : "wrong") })),
      h("p", { text: tx(step.explain) }),
      f?.annotations?.length ? h("p", { class: "cs-small", text: t("check_marks") }) : null);
  };
  const ol = h("ol", { class: "cs-options fu-options" }, step.options.map((o, i) => {
    const b = h("button", { type: "button", class: "cs-option",
      onclick: () => {
        store.logCheck(l.id, step.id, i === step.answer);
        mark(i);
      } },
    h("span", { class: "cs-letter", "aria-hidden": "true", text: "ABCD"[i] }),
    h("span", { text: tx(o) }));
    btns.push(b);
    return h("li", null, b);
  }));
  return h("section", { class: "ls-step ls-check fu" },
    h("p", { class: "fu-kind", text: t("lesson_check") }),
    h("h2", { class: "fu-q", text: tx(step.question) }),
    viewer?.el, ol, out);
}

/* ---------------------------------------------------------------- practice */
let session = null;

function newSession(key, module) {
  const { ids, extra } = buildSession(practicePool(module), store.cards(), Date.now(), {
    max: SESSION_MAX, newMax: module ? SESSION_MAX : SESSION_NEW,
  });
  return {
    key, extra, pos: 0, finished: false,
    items: ids.map((id) => ({ id, order: shuffle(optionsFor(CASES.get(id))), retry: false, chosen: null })),
    first: new Map(), // case id -> correct on first try
    requeued: new Set(),
  };
}

function viewPractice(module) {
  if (module && !MODULES.has(module)) module = null;
  const key = `${store.tier}:${module || "all"}`;
  if (!session || session.key !== key || session.finished) session = newSession(key, module);
  if (!session.items.length) {
    put(h("h1", { text: t("nav_practice") }), h("p", { class: "tr-note", text: t("progress_none") }));
    return;
  }
  if (session.pos >= session.items.length) return sessionDone();

  const s = session;
  const item = s.items[s.pos];
  const c = CASES.get(item.id);
  const next = s.items[s.pos + 1];
  if (next) loadSignal(CASES.get(next.id).ecg_id).catch(() => {});

  const unique = new Set(s.items.map((i) => i.id)).size;
  const done = Math.min(s.first.size + (item.chosen && !s.first.has(item.id) ? 1 : 0), unique);
  const header = h("div", { class: "cs-bar" },
    h("span", { class: "cs-count", text: t("session_of", Math.min(s.pos + 1, s.items.length), s.items.length) }),
    module && h("span", { class: "tag", text: tx(MODULES.get(module).title) }),
    h("div", { class: "cs-progress", "aria-hidden": "true" },
      h("span", { style: `width:${(100 * done) / unique}%` })),
    h("a", { class: "cs-quit", href: "#home", text: t("session_quit") }),
  );

  const advance = () => {
    s.pos += 1;
    render(true);
  };
  caseScreen(c, {
    mode: "quiz",
    item,
    header,
    extraNote: s.extra && s.pos === 0 ? t("extra_note") : null,
    onAnswer(chosen, ok) {
      item.chosen = chosen;
      store.logAnswer(c.id, chosen, ok);
      const firstTry = !item.retry && !s.first.has(c.id);
      if (firstTry) s.first.set(c.id, ok);
      if (!ok) {
        if (firstTry) store.setCard(c.id, grade(store.card(c.id), "again"));
        if (!s.requeued.has(c.id)) {
          s.requeued.add(c.id);
          s.items.push({ id: c.id, order: shuffle(optionsFor(c)), retry: true, chosen: null });
        }
      }
    },
    onRate(rating) {
      if (!item.retry && !s.extra) store.setCard(c.id, grade(store.card(c.id), rating));
      advance();
    },
    onNext: advance,
  });
}

function sessionDone() {
  const s = session;
  s.finished = true;
  const right = [...s.first.values()].filter(Boolean).length;
  put(
    h("section", { class: "tr-done" },
      h("h1", { text: t("session_done") }),
      h("p", { class: "tr-score", text: t("session_score", right, s.first.size) }),
      h("p", { class: "tr-note", text: t("session_next_due") }),
      h("p", { class: "tr-actions" },
        h("a", { class: "btn", href: "#home", text: t("back_home") }),
        h("button", { type: "button", class: "btn btn-quiet", text: t("session_more"),
          onclick: () => {
            session = null;
            render(true);
          } }),
      ),
    ),
  );
}

/* One ECG with its question (quiz) or its answer straight away (study). */
function caseScreen(c, { mode, item, header, extraNote, onAnswer, onRate, onNext }) {
  const answered = mode === "study" || !!item?.chosen;
  // nurses and paramedics start on the rhythm strip, as on a monitor; the 12-lead is one tap away
  const stripFirst = tier()?.first_view === "strip" && c.layout !== "monitor";
  const notes = { annotations: c.annotations || [], numbered: true };
  let viewer = makeViewer(c, { look: c.look || [], revealed: answered, ...notes,
    strip: stripFirst ? { leads: [(c.strips || ["II"])[0]], window: null, full: true } : null });
  const onFinding = (i) => viewer.focusFinding(i);
  const full = stripFirst ? h("button", { type: "button", class: "btn btn-quiet btn-small", text: t("show_12lead"),
    onclick: () => {
      const v = makeViewer(c, { look: c.look || [], revealed: locked || answered, ...notes });
      viewer.el.replaceWith(v.el);
      viewer = v;
      full.remove();
    } }) : null;
  const feedback = h("div", { class: "cs-feedback" });
  const buttons = [];
  let locked = !!item?.chosen;

  function mark(chosen) {
    for (const [key, b] of buttons) {
      b.disabled = true;
      if (key === c.answer) b.classList.add("is-correct");
      else if (key === chosen) b.classList.add("is-wrong");
      else b.classList.add("is-dim");
      if (key === c.answer || key === chosen) markOption(b, key === c.answer);
    }
  }

  function showFeedback(chosen, focus) {
    const ok = chosen === c.answer;
    const { head, body } = explainParts(c, chosen, mode, { onFinding });
    // follow-up questions come before the explanation, which would give their answers away
    const rest = h("div", { class: "cs-rest" }, body);
    const fu = followups(c, item, () => { rest.hidden = false; });
    rest.hidden = fu.pending;
    feedback.replaceChildren(...[...head, fu.el, rest, rateRow(ok)].filter(Boolean));
    if (focus) feedback.querySelector(".cs-verdict")?.focus({ preventScroll: false });
  }

  function choose(key) {
    if (locked) return;
    locked = true;
    mark(key);
    viewer.reveal();
    onAnswer(key, key === c.answer);
    showFeedback(key, true);
  }

  function rateRow(ok) {
    if (mode === "study") return null;
    if (ok && !item.retry) {
      return h("div", { class: "cs-rate" },
        h("p", { class: "cs-rate-q", text: t("rate_prompt") }),
        h("div", { class: "cs-rate-btns" }, ["hard", "good", "easy"].map((r) =>
          h("button", { type: "button", class: r === "good" ? "btn" : "btn btn-quiet", text: t(`rate_${r}`),
            onclick: () => onRate(r) }))),
      );
    }
    return h("div", { class: "cs-rate" },
      h("button", { type: "button", class: "btn", text: t("next"), onclick: ok ? () => onRate("good") : onNext }));
  }

  const title = h("h1", { class: "cs-q", text: mode === "quiz" ? questionFor(c) : dxName(c.answer) });
  const question = mode === "quiz"
    ? h("div", { class: "cs-question" },
      h("ol", { class: "cs-options" }, item.order.map((key, i) => {
        const b = h("button", { type: "button", class: "cs-option", onclick: () => choose(key) },
          h("span", { class: "cs-letter", "aria-hidden": "true", text: "ABCD"[i] }),
          h("span", { text: optionLabel(key) }));
        buttons.push([key, b]);
        return h("li", null, b);
      })),
    )
    : null;

  put(
    h("article", { class: `cs cs-${mode}` },
      header,
      extraNote && h("p", { class: "tr-note", text: extraNote }),
      title,
      h("p", { class: "cs-patient" },
        h("span", { class: "tag", text: t("level", c.level) }), " ",
        fitTag(c), fitTag(c) && " ",
        patientLine(c)),
      c.vignette && h("p", { class: "cs-vignette", text: tx(c.vignette) }),
      viewer.el,
      full,
      question,
      feedback,
    ),
  );

  if (mode === "study") feedback.append(...[followups(c, null).el, ...explain(c, null, "study", { onFinding })].filter(Boolean));
  else if (item.chosen) {
    mark(item.chosen);
    showFeedback(item.chosen, false);
  }

  if (mode === "quiz") {
    const onKey = (e) => {
      if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest("input, textarea, select, .ecg-overlay")) return;
      const i = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
      if (i >= 0 && buttons[i]) {
        e.preventDefault();
        buttons[i][1].click();
      }
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  }
}

function explain(c, chosen, mode, opts = {}) {
  const { head, body } = explainParts(c, chosen, mode, opts);
  return [...head, ...body];
}

/* The findings of a case. Findings with marks on the tracing get a number (the same as on
   the ECG) and show their marks when tapped. */
function findingsList(c, onFinding) {
  const list = tx(c.findings) || [];
  const marked = new Set((c.annotations || []).map((a) => a.finding).filter((i) => i != null));
  if (!marked.size || !onFinding) return [h("ul", { class: "cs-list" }, list.map((f) => h("li", { text: f })))];
  const btns = [];
  const items = list.map((f, i) => {
    if (!marked.has(i)) return h("li", { class: "cs-finding-plain" }, h("span", { text: f }));
    const b = h("button", { type: "button", class: "cs-finding", "aria-pressed": "false",
      "aria-label": `${t("finding_show", i + 1)}: ${f}`,
      onclick: () => {
        const on = onFinding(i);
        btns.forEach(([k, x]) => x.setAttribute("aria-pressed", String(on === k)));
      } },
    h("span", { class: "cs-finding-n", "aria-hidden": "true", text: String(i + 1) }),
    h("span", { text: f }));
    btns.push([i, b]);
    return h("li", null, b);
  });
  return [h("ul", { class: "cs-findings" }, items), h("p", { class: "cs-small", text: t("findings_tap") })];
}

/* The verdict (head) and everything that explains the case (body). */
function explainParts(c, chosen, mode, { onFinding = null } = {}) {
  const head = [];
  const out = [];
  const answer = DATA.diagnoses[c.answer];
  if (mode === "quiz") {
    const ok = chosen === c.answer;
    head.push(h("p", { class: `cs-verdict ${ok ? "ok" : "bad"}`, tabindex: "-1" },
      markIcon(ok), h("strong", { text: t(ok ? "correct" : "wrong") }),
      ok ? null : ` · ${t("wrong_detail", dxName(c.answer))}`));
    if (!ok) {
      head.push(h("p", { class: "cs-tell" },
        h("strong", { text: `${t("you_chose")}: ${dxName(chosen)}. ` }), tx(DATA.diagnoses[chosen]?.tell)));
      const back = lessonFor(c.answer);
      if (back) head.push(h("p", { class: "cs-small" }, `${t("lesson_back")} `, h("a", { href: `#lesson-${back.id}`, text: tx(back.title) })));
    }
  }
  out.push(h("p", { class: "cs-tell" },
    mode === "quiz" && h("strong", { text: `${dxName(c.answer)}. ` }), tx(answer?.tell)));

  const crit = answer?.criteria ? answer.criteria[lang] || answer.criteria.ro : [];
  const pit = answer?.pitfalls ? answer.pitfalls[lang] || answer.pitfalls.ro : [];
  const depth = tier()?.explain || "standard";
  const action = tx(c.action) || tx(answer?.action);
  if (action && depth === "action") {
    out.push(h("div", { class: "cs-action" }, h("h2", { text: t("action_title") }), h("p", { text: action }),
      h("p", { class: "cs-small", text: t("action_note") })));
  }
  out.push(
    h("div", { class: "cs-explain" },
      h("section", null,
        h("h2", { text: t("systematic") }),
        readTable(c),
        h("p", { class: "cs-small", text: t(c.layout === "monitor" ? "measured_note_monitor" : c.source.dataset === "mimic" ? "measured_note_mimic" : "measured_note") })),
      h("section", null,
        h("h2", { text: t("findings") }),
        findingsList(c, onFinding),
        c.look?.length ? h("p", { class: "cs-small", text: t("look_here") }) : null),
    ),
    h("p", { class: "pearl" }, h("strong", { text: `${t("takeaway")}: ` }), tx(c.takeaway)),
    depth === "deep" && tx(c.deep) && h("p", { class: "pearl pearl-deep" }, h("strong", { text: `${t("deep_title")}: ` }), tx(c.deep)),
    action && depth !== "action" && h("details", { class: "cs-more" },
      h("summary", { text: t("action_title") }),
      h("div", { class: "cs-more-body" }, h("p", { text: action }), h("p", { class: "cs-small", text: t("action_note") }))),
    (crit.length || pit.length) && h("details", { class: "cs-more", open: depth === "deep" },
      h("summary", { text: `${t("criteria")} · ${t("pitfalls")}` }),
      h("div", { class: "cs-more-body" },
        crit.length && h("section", null, h("h3", { text: t("criteria") }),
          h("ul", { class: "cs-list" }, crit.map((x) => h("li", { text: x })))),
        pit.length && h("section", null, h("h3", { text: t("pitfalls") }),
          h("ul", { class: "cs-list" }, pit.map((x) => h("li", { text: x })))),
      )),
    reportForm(c),
  );
  return { head, body: out.filter((x) => x != null && x !== false && x !== 0) };
}

/* Follow-up questions for the learner's profile, asked once the main answer is in.
   item (practice) remembers the answers when the screen redraws. */
function followups(c, item, onDone) {
  const list = followupsFor(c);
  const answers = item ? (item.follow ||= {}) : {};
  const left = () => list.filter((f) => !(f.id in answers)).length;
  if (!list.length) return { el: null, pending: false };
  const skip = h("button", { type: "button", class: "btn btn-quiet btn-small", text: t("follow_skip"),
    onclick: () => {
      skip.hidden = true;
      onDone?.();
    } });
  const blocks = list.map((f) => {
    const out = h("div", { class: "fu-result", "aria-live": "polite" });
    const btns = [];
    function mark(i) {
      btns.forEach((b, k) => {
        b.disabled = true;
        b.classList.add(k === f.answer ? "is-correct" : k === i ? "is-wrong" : "is-dim");
        if (k === f.answer || k === i) markOption(b, k === f.answer);
      });
      const ok = i === f.answer;
      out.replaceChildren(
        h("p", { class: `cs-verdict ${ok ? "ok" : "bad"}` }, markIcon(ok), h("strong", { text: t(ok ? "correct" : "wrong") })),
        h("p", { text: tx(f.explain) }));
    }
    const ol = h("ol", { class: "cs-options fu-options" }, f.options.map((o, i) => {
      const b = h("button", { type: "button", class: "cs-option",
        onclick: () => {
          if (f.id in answers) return;
          answers[f.id] = i;
          store.logFollow(c.id, f.id, i === f.answer);
          mark(i);
          if (!left()) {
            skip.hidden = true;
            onDone?.();
          }
        } },
      h("span", { class: "cs-letter", "aria-hidden": "true", text: "ABCD"[i] }),
      h("span", { text: tx(o) }));
      btns.push(b);
      return h("li", null, b);
    }));
    if (f.id in answers) mark(answers[f.id]);
    return h("div", { class: "fu" },
      h("p", { class: "fu-kind", text: STRINGS[lang][`follow_${f.kind}`] ? t(`follow_${f.kind}`) : t("follow_title") }),
      h("h2", { class: "fu-q", text: tx(f.question) }),
      ol, out);
  });
  const pending = left() > 0;
  skip.hidden = !pending;
  return { el: h("section", { class: "cs-follow", "aria-label": t("follow_title") }, blocks, skip), pending };
}

function readTable(c) {
  const m = c.measure;
  const ms = (k) => (m[k] != null ? `${mval(c, k)} ms` : t("na"));
  let qt = t("na");
  if (m.qt != null) qt = m.qtc_b != null ? `${mval(c, "qt")} / ${mval(c, "qtc_b")} ms` : `${mval(c, "qt")} ms`;
  const rows = [
    [t("row_rate"), m.hr != null ? `${mval(c, "hr")}${t("per_min")}` : t("na")],
    [t("row_rhythm"), tx(c.rhythm)],
    [t("row_axis"), m.axis != null ? `${angle(m.axis)} (${axisClass(m.axis)})` : t("na")],
    [t("row_pr"), ms("pr")],
    [t("row_qrs"), ms("qrs")],
    [t("row_qt"), qt],
  ].filter(([, v]) => c.layout !== "monitor" || v !== t("na"));
  return h("table", { class: "cs-read" },
    h("tbody", null, rows.map(([k, v]) => h("tr", null, h("th", { scope: "row", text: k }), h("td", { text: v })))));
}

function reportForm(c) {
  // Live site without a database: no form, no stored data, just an email link.
  const contact = root.dataset.contact;
  if (!PREVIEW && contact) {
    const subject = encodeURIComponent(`${t("report_error")}: ${c.id}`);
    return h("details", { class: "cs-report" },
      h("summary", { text: t("report_error") }),
      h("div", { class: "cs-report-body" },
        h("p", { class: "cs-small" }, t("report_by_email"), " ",
          h("a", { href: `mailto:${contact}?subject=${subject}`, text: contact }),
          ` (${t("report_case_id")}: ${c.id}).`)));
  }
  const ta = h("textarea", { rows: "3", placeholder: t("report_placeholder"), "aria-label": t("report_error") });
  const msg = h("p", { class: "cs-small", "aria-live": "polite" });
  const send = h("button", { type: "button", class: "btn btn-quiet btn-small", text: t("report_send") });
  send.addEventListener("click", async () => {
    const text = ta.value.trim();
    if (!text) return ta.focus();
    if (!db) {
      msg.textContent = t("review_need_db");
      return;
    }
    send.disabled = true;
    try {
      await db.collection("reports").add({
        caseId: c.id, ecgId: c.ecg_id, text, lang, at: new Date().toISOString(), by: me,
      });
      ta.value = "";
      msg.textContent = t("report_thanks");
    } catch (e) {
      msg.textContent = t("review_error");
    } finally {
      send.disabled = false;
    }
  });
  return h("details", { class: "cs-report" },
    h("summary", { text: t("report_error") }),
    h("div", { class: "cs-report-body" }, ta, h("div", { class: "cs-report-row" }, send, msg),
      PREVIEW && h("p", { class: "cs-small", text: t("report_preview") })));
}

/* ---------------------------------------------------------------- library */
function viewCase(id) {
  const c = CASES.get(id);
  if (!c) return viewLibrary();
  caseScreen(c, {
    mode: "study",
    header: h("div", { class: "cs-bar" },
      h("a", { class: "cs-back", href: "#library", text: `← ${t("nav_library")}` }),
      h("span", { class: "tag", text: tx(MODULES.get(c.module).title) })),
  });
}

function statusTag(id) {
  const st = cardStatus(store.card(id));
  return h("span", { class: `chip chip-${st}`, text: t(`status_${st}`) });
}

function reviewTag(id) {
  if (!PREVIEW) return null;
  const st = reviewStatus(id);
  if (st === "approved") return h("span", { class: "chip chip-ok", text: t("status_approved") });
  if (st === "changes") return h("span", { class: "chip chip-bad", text: t("review_filter_changes") });
  return h("span", { class: "chip", text: t("status_draft") });
}

function viewLibrary() {
  const hidden = ORDER.filter((c) => !shown(c)).length;
  put(
    h("h1", { text: t("library_title") }),
    h("p", { class: "tr-intro", text: t("library_intro") }),
    hidden ? h("p", { class: "tr-actions" },
      h("button", { type: "button", class: "vw-btn", "aria-pressed": String(showAll),
        text: t("library_show_all", hidden),
        onclick: () => {
          showAll = !showAll;
          render(false);
        } })) : null,
    DATA.modules.map((m) => {
      const list = ORDER.filter((c) => c.module === m.id && (showAll || shown(c)));
      if (!list.length) return null;
      return h("section", { class: "tr-section" },
        h("h2", { text: tx(m.title) }),
        h("ul", { class: "tr-rows" }, list.map((c) =>
          h("li", null, h("a", { class: "tr-row", href: `#case-${c.id}` },
            h("span", { class: "tr-row-title", text: dxName(c.answer) }),
            h("span", { class: "tr-row-meta" },
              h("span", { class: "tr-row-level", text: t("level", c.level) }),
              fitTag(c),
              statusTag(c.id),
              reviewTag(c.id)))))));
    }),
  );
}

/* ---------------------------------------------------------------- drills */
let drill = null;

function myDrills() {
  const allowed = tier()?.drills;
  return allowed ? DRILLS.filter((k) => allowed.includes(k)) : DRILLS;
}

function drillPairs(type) {
  const kinds = myDrills();
  const pairs = [];
  for (const c of ORDER) {
    for (const k of c.drills) if (kinds.includes(k) && (type === "mixed" || k === type)) pairs.push({ id: c.id, kind: k });
  }
  return pairs;
}

function viewDrills() {
  const stats = store.drills();
  put(
    h("h1", { text: t("drills_title") }),
    h("p", { class: "tr-intro", text: t("drills_intro") }),
    myDrills().length < DRILLS.length && h("p", { class: "tr-note", text: t("drills_profile", tx(tier().name)) }),
    h("ul", { class: "tr-modules" }, [...myDrills(), ...(myDrills().length > 1 ? ["mixed"] : [])].map((type) => {
      const n = type === "mixed" ? new Set(drillPairs("mixed").map((p) => p.id)).size : drillPairs(type).length;
      const mine = stats.filter((d) => type === "mixed" || d.type === type);
      const ok = mine.filter((d) => d.ok).length;
      return h("li", { class: "tr-module" },
        h("div", { class: "tr-module-top" }, h("span", { class: "tr-module-icon" }, icon("drills")), h("h3", { text: t(`drill_${type}`) })),
        type !== "mixed" && h("p", { class: "tr-module-blurb", text: t(`drill_task_${type}`) }),
        h("p", { class: "tr-module-meta" }, t("drill_count", n),
          mine.length ? ` · ${t("drill_session", ok, mine.length)}` : ""),
        h("a", { class: "btn btn-quiet tr-module-go", href: `#drill-${type}` }, t("drill_start"), icon("arrow")),
      );
    })),
  );
}

function newDrill(type) {
  let pairs = shuffle(drillPairs(type));
  if (type === "mixed") {
    const seen = new Set();
    pairs = pairs.filter((p) => !seen.has(p.id) && seen.add(p.id));
  }
  return { type, items: pairs.slice(0, DRILL_MAX), pos: 0, finished: false };
}

function viewDrill(type) {
  if (![...myDrills(), "mixed"].includes(type)) return viewDrills();
  if (!drill || drill.type !== type || drill.finished) drill = newDrill(type);
  if (drill.pos >= drill.items.length) return drillDone();
  const d = drill;
  const item = d.items[d.pos];
  const c = CASES.get(item.id);
  const kind = item.kind;
  const unit = kind === "axis" ? "°" : " ms";
  const next = d.items[d.pos + 1];
  if (next) loadSignal(CASES.get(next.id).ecg_id).catch(() => {});

  const viewer = makeViewer(c, { calipers: kind === "axis" ? "off" : "time", span: { pr: 0.16, qrs: 0.1, qt: 0.4 }[kind] });
  const input = h("input", {
    id: "dr-value", type: "number", inputmode: kind === "axis" ? "text" : "numeric", step: "1",
    min: kind === "axis" ? "-180" : "0", max: kind === "axis" ? "180" : "999", autocomplete: "off",
  });
  const result = h("div", { class: "dr-result", "aria-live": "polite" });
  const check = h("button", { type: "button", class: "btn", text: t("drill_submit") });
  const dial = kind === "axis" ? axisDial((v) => { input.value = v; }) : null;
  if (dial) input.addEventListener("input", () => dial.set(parseFloat(input.value)));
  const useCal = kind === "axis" ? null : h("button", {
    type: "button", class: "btn btn-quiet", text: t("drill_use_calipers"),
    onclick: () => {
      const r = viewer.reading();
      if (r?.mode === "time") input.value = Math.round(r.ms);
    },
  });

  function showResult(v) {
    const ref = c.measure[kind];
    const diff = kind === "axis" ? Math.round(angleDiff(v, ref)) : Math.round(v - ref);
    const [good, close] = TOL[kind];
    const ad = Math.abs(diff);
    const verdict = ad <= good ? "good" : ad <= close ? "close" : "off";
    input.disabled = true;
    check.disabled = true;
    if (useCal) useCal.disabled = true;
    dial?.showRef(ref);
    const fmt = (x) => (kind === "axis" ? angle(x) : `${Math.round(x)} ms`);
    const extra = [];
    if (kind === "qt" && c.measure.rr) {
      const rr = c.measure.rr / 1000;
      extra.push(h("p", { text: t("drill_qtc", Math.round(v / Math.sqrt(rr)), Math.round(v / Math.cbrt(rr))) }));
      if (c.measure.qtc_b) extra.push(h("p", { class: "cs-small", text: `${t("drill_reference")}: QTc ${c.measure.qtc_b} ms (Bazett), ${c.measure.qtc_f} ms (Fridericia)` }));
    }
    const last = d.pos + 1 >= d.items.length;
    result.replaceChildren(
      h("p", { class: `dr-verdict ${verdict}` }, verdict !== "close" && markIcon(verdict === "good"), t(`drill_${verdict}`)),
      h("dl", { class: "dr-nums" },
        h("div", null, h("dt", { text: t("drill_reference") }), h("dd", { text: fmt(ref) })),
        h("div", null, h("dt", { text: t("drill_yours") }), h("dd", { text: fmt(v) })),
        h("div", null, h("dt", { text: t("drill_diff") }), h("dd", { text: signed(diff, unit.trim() === "ms" ? " ms" : "°") })),
      ),
      h("p", { class: "cs-small", text: `${t("drill_tolerance", `${good}${unit}`)} · ${t(kind === "axis" ? "axis_ref_note" : "drill_interval_note")}` }),
      ...extra,
      h("p", { class: "dr-actions" },
        h("button", { type: "button", class: "btn", text: t(last ? "drill_done" : "drill_next"),
          onclick: () => {
            d.pos += 1;
            render(true);
          } }),
        h("a", { href: `#case-${c.id}`, text: t("drill_reveal_case") })),
    );
    return { diff, verdict };
  }

  check.addEventListener("click", () => {
    let v = parseFloat(String(input.value).replace(",", "."));
    if (!Number.isFinite(v) && kind !== "axis") {
      const r = viewer.reading();
      if (r?.mode === "time") {
        v = Math.round(r.ms);
        input.value = v;
      }
    }
    if (!Number.isFinite(v)) return input.focus();
    if (kind === "axis") v = angleDiff(v, 0);
    const { diff, verdict } = showResult(v);
    item.done = v;
    store.logDrill(kind, c.id, diff, verdict === "good");
    result.querySelector(".dr-verdict")?.focus?.();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") check.click();
  });

  put(
    h("article", { class: "cs dr" },
      h("div", { class: "cs-bar" },
        h("span", { class: "cs-count", text: t("session_of", d.pos + 1, d.items.length) }),
        h("span", { class: "tag", text: t(`drill_${kind}`) }),
        h("div", { class: "cs-progress", "aria-hidden": "true" },
          h("span", { style: `width:${(100 * d.pos) / d.items.length}%` })),
        h("a", { class: "cs-quit", href: "#drills", text: t("session_quit") })),
      h("h1", { class: "cs-q", text: t(`drill_task_${kind}`) }),
      h("p", { class: "cs-patient" }, patientLine(c)),
      viewer.el,
      h("div", { class: "dr-form" },
        dial && dial.el,
        h("div", { class: "dr-inputs" },
          h("label", { for: "dr-value", text: t(kind === "axis" ? "drill_axis_value" : "drill_value") }),
          h("div", { class: "dr-row" }, input, useCal, check),
          h("p", { class: "cs-small", text: t(`drill_tip_${kind}`) }),
        ),
      ),
      result,
    ),
  );
  if (item.done != null) {
    input.value = Math.round(item.done);
    dial?.set(item.done);
    showResult(item.done);
  }
}

function drillDone() {
  const d = drill;
  d.finished = true;
  const recent = store.drills().slice(-d.items.length);
  const ok = recent.filter((r) => r.ok).length;
  put(
    h("section", { class: "tr-done" },
      h("h1", { text: t("session_done") }),
      h("p", { class: "tr-score", text: t("drill_session", ok, recent.length) }),
      h("p", { class: "tr-actions" },
        h("a", { class: "btn", href: "#drills", text: t("nav_drills") }),
        h("button", { type: "button", class: "btn btn-quiet", text: t("session_more"),
          onclick: () => {
            drill = null;
            render(true);
          } }),
      ),
    ),
  );
}

/* Hexaxial reference system. Click or drag to set an axis; 0° is lead I and
   +90° points down, as on the ECG. */
function axisDial(onPick) {
  const R = 96;
  const pos = (deg, r) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const labels = LEAD_LABELS[lang];
  const leads = [["I", 0], ["II", 60], ["III", 120], ["aVF", 90], ["aVL", -30], ["aVR", -150]];
  const user = svg("line", { class: "dial-user", x1: 0, y1: 0, x2: 0, y2: 0, "marker-end": "url(#dial-head)" });
  const ref = svg("line", { class: "dial-ref", x1: 0, y1: 0, x2: 0, y2: 0, visibility: "hidden" });
  const el = svg("svg", { class: "dial", viewBox: "-135 -135 270 270", role: "img", "aria-label": t("drill_axis") },
    svg("defs", null, svg("marker", { id: "dial-head", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" },
      svg("path", { d: "M0 0L10 5L0 10z", class: "dial-head" }))),
    svg("circle", { r: R, class: "dial-ring" }),
    // normal-axis sector, −30° to +90°
    svg("path", { class: "dial-normal", d: `M0 0L${pos(-30, R).join(" ")}A${R} ${R} 0 0 1 ${pos(90, R).join(" ")}Z` }),
    leads.map(([name, deg]) => {
      const [x1, y1] = pos(deg + 180, R);
      const [x2, y2] = pos(deg, R);
      const [lx, ly] = pos(deg, R + 18);
      const text = svg("text", { x: lx, y: ly, class: "dial-lead", "text-anchor": "middle", "dominant-baseline": "middle" });
      text.textContent = labels[name] || name;
      return [svg("line", { x1, y1, x2, y2, class: "dial-axis" }), text];
    }),
    [[0, "0°"], [90, "+90°"], [180, "±180°"], [-90, "−90°"]].map(([deg, s]) => {
      const [x, y] = pos(deg, R - 16);
      const tt = svg("text", { x, y, class: "dial-deg", "text-anchor": "middle", "dominant-baseline": "middle" });
      tt.textContent = s;
      return tt;
    }),
    ref,
    user,
  );
  const set = (deg) => {
    if (!Number.isFinite(deg)) return;
    const [x, y] = pos(deg, R - 4);
    user.setAttribute("x2", x);
    user.setAttribute("y2", y);
  };
  let dragging = false;
  const pick = (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    const deg = Math.round((Math.atan2(y, x) * 180) / Math.PI);
    set(deg);
    onPick(deg);
  };
  el.addEventListener("pointerdown", (e) => {
    if (el.dataset.locked) return;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    pick(e);
  });
  el.addEventListener("pointermove", (e) => dragging && pick(e));
  el.addEventListener("pointerup", () => { dragging = false; });
  return {
    el: h("div", { class: "dial-wrap" }, el),
    set,
    showRef(deg) {
      el.dataset.locked = "1";
      const [x, y] = pos(deg, R - 4);
      ref.setAttribute("x2", x);
      ref.setAttribute("y2", y);
      ref.setAttribute("visibility", "visible");
    },
  };
}

/* ---------------------------------------------------------------- progress */
function viewProgress() {
  const answers = store.answers();
  const drills = store.drills();
  put(h("h1", { text: t("progress_title") }));
  if (!store.persistent) put(h("p", { class: "tr-note", text: t("progress_storage_off") }));
  if (!answers.length && !drills.length && !Object.keys(store.lessons()).length) {
    put(h("p", { class: "tr-note", text: t("progress_none") }),
      h("p", null, h("a", { class: "btn", href: "#practice-rhythm", text: t("home_start") })));
    return;
  }
  const streak = store.streak();
  if (streak) put(h("p", { class: "tr-score", text: t("home_streak", streak) }));
  const lessons = (DATA.lessons || []).filter((l) => lessonFit(l) !== "skip");
  if (lessons.length) {
    const done = lessons.filter((l) => store.lesson(l.id)?.done).length;
    put(h("section", { class: "tr-section" },
      h("h2", { text: t("learn_title") }),
      h("p", null, t("learn_progress", done, lessons.length), " ", h("a", { href: "#learn", text: t("learn_open") }))));
  }

  put(h("section", { class: "tr-section" },
    h("h2", { text: t("progress_cases") }),
    h("div", { class: "tr-table-wrap" }, h("table", { class: "tr-table" },
      h("thead", null, h("tr", null, [t("prog_module"), t("prog_seen"), t("prog_mastered"), t("prog_correct")].map((x) => h("th", { scope: "col", text: x })))),
      h("tbody", null, DATA.modules.map((m) => {
        const s = moduleStats(m.id);
        if (!s.total) return null;
        return h("tr", null,
          h("th", { scope: "row", text: tx(m.title) }),
          h("td", { text: `${s.seen}/${s.total}` }),
          h("td", { text: `${s.mastered}/${s.total}` }),
          h("td", { text: s.acc == null ? "–" : `${s.acc}% (${s.answers})` }));
      })))),
  ));

  put(h("section", { class: "tr-section" },
    h("h2", { text: t("progress_drills") }),
    h("div", { class: "tr-table-wrap" }, h("table", { class: "tr-table" },
      h("thead", null, h("tr", null, [t("prog_measure"), t("prog_attempts"), t("prog_within"), t("prog_mean_err")].map((x) => h("th", { scope: "col", text: x })))),
      h("tbody", null, DRILLS.map((k) => {
        const list = drills.filter((d) => d.type === k);
        const ok = list.filter((d) => d.ok).length;
        const err = list.length ? Math.round(list.reduce((a, d) => a + Math.abs(d.err), 0) / list.length) : null;
        return h("tr", null,
          h("th", { scope: "row", text: t(`drill_${k}`) }),
          h("td", { text: String(list.length) }),
          h("td", { text: list.length ? `${Math.round((100 * ok) / list.length)}%` : "–" }),
          h("td", { text: err == null ? "–" : k === "axis" ? `${err}°` : `${err} ms` }));
      })))),
  ));

  const confirmRow = h("p", { class: "tr-actions", hidden: true },
    h("span", { text: t("progress_reset_confirm") }),
    h("button", { type: "button", class: "btn btn-small", text: t("progress_reset"),
      onclick: () => {
        store.reset();
        session = null;
        drill = null;
        render(true);
      } }),
    h("button", { type: "button", class: "btn btn-quiet btn-small", text: t("cancel"),
      onclick: () => {
        confirmRow.hidden = true;
        resetBtn.hidden = false;
      } }));
  const resetBtn = h("button", { type: "button", class: "btn btn-quiet btn-small", text: t("progress_reset"),
    onclick: () => {
      confirmRow.hidden = false;
      resetBtn.hidden = true;
    } });
  put(h("section", { class: "tr-section" }, resetBtn, confirmRow));
}

/* ---------------------------------------------------------------- review */
let reviewFilter = "all";
const saving = new Set();

function dxKeys() {
  const keys = Object.keys(DATA.diagnoses);
  return keys.sort((a, b) => {
    const ca = DATA.diagnoses[a].criteria ? 0 : 1;
    const cb = DATA.diagnoses[b].criteria ? 0 : 1;
    return ca - cb || dxName(a).localeCompare(dxName(b), lang);
  });
}

function reviewChip(id) {
  const st = reviewStatus(id);
  const map = {
    approved: ["chip-ok", t("review_approve")],
    changes: ["chip-bad", t("review_changes")],
    draft: ["", t("status_draft")],
    todo: ["", t("review_filter_todo")],
  };
  const [cls, text] = map[st] || map.todo;
  return h("span", { class: `chip ${cls}`, text });
}

function passes(id) {
  const st = reviewStatus(id);
  if (reviewFilter === "todo") return st === "todo" || st === "draft";
  if (reviewFilter === "changes") return st === "changes";
  if (reviewFilter === "ok") return st === "approved";
  return true;
}

function counts(ids) {
  let a = 0, b = 0, c = 0;
  for (const id of ids) {
    const st = reviewStatus(id);
    if (st === "approved") a++;
    else if (st === "changes") b++;
    else c++;
  }
  return t("review_counts", a, b, c);
}

function viewReview(arg) {
  if (arg?.startsWith("dx-") && DATA.diagnoses[arg.slice(3)]) return reviewDiagnosis(arg.slice(3));
  if (arg?.startsWith("tier-") && TIERS.has(arg.slice(5))) return reviewTier(arg.slice(5));
  if (arg?.startsWith("lesson-") && LESSONS.has(arg.slice(7))) return reviewLesson(arg.slice(7));
  if (arg && CASES.has(arg)) return reviewCase(arg);
  reviewList();
}

function dbNotice() {
  if (dbState === "on") return null;
  return h("p", { class: "tr-note", text: dbState === "connecting" ? t("loading") : t("review_need_db") });
}

function reviewList() {
  const caseIds = ORDER.map((c) => c.id);
  const dx = dxKeys();
  const filters = [["all", "review_filter_all"], ["todo", "review_filter_todo"], ["changes", "review_filter_changes"], ["ok", "review_filter_ok"]];
  put(
    h("h1", { text: t("review_title") }),
    h("p", { class: "tr-intro", text: t("review_intro") }),
    dbNotice(),
    h("div", { class: "rv-filters", role: "group", "aria-label": t("review_title") }, filters.map(([f, key]) =>
      h("button", { type: "button", class: "vw-btn", "aria-pressed": String(reviewFilter === f), text: t(key),
        onclick: () => {
          reviewFilter = f;
          render(false);
        } }))),
    h("section", { class: "tr-section" },
      h("h2", { text: t("review_cases") }),
      h("p", { class: "cs-small", text: counts(caseIds) }),
      h("ul", { class: "tr-rows" }, ORDER.filter((c) => passes(c.id)).map((c) => {
        const nrep = reports.filter((r) => r.caseId === c.id).length;
        return h("li", null, h("a", { class: "tr-row", href: `#review-${c.id}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: c.id }), " ", dxName(c.answer)),
          h("span", { class: "tr-row-meta" },
            nrep ? h("span", { class: "chip chip-bad", text: `${t("review_reports")}: ${nrep}` }) : null,
            reviewChip(c.id))));
      }))),
    DATA.tiers?.length ? h("section", { class: "tr-section" },
      h("h2", { text: t("review_tiers") }),
      h("p", { class: "cs-small", text: counts(DATA.tiers.map((x) => `tier-${x.id}`)) }),
      h("ul", { class: "tr-rows" }, DATA.tiers.filter((x) => passes(`tier-${x.id}`)).map((x) =>
        h("li", null, h("a", { class: "tr-row", href: `#review-tier-${x.id}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: x.id }), " ", tx(x.name)),
          h("span", { class: "tr-row-meta" }, reviewChip(`tier-${x.id}`))))))) : null,
    DATA.lessons?.length ? h("section", { class: "tr-section" },
      h("h2", { text: t("review_lessons") }),
      h("p", { class: "cs-small", text: counts(DATA.lessons.map((x) => `lesson-${x.id}`)) }),
      h("ul", { class: "tr-rows" }, DATA.lessons.filter((x) => passes(`lesson-${x.id}`)).map((x) =>
        h("li", null, h("a", { class: "tr-row", href: `#review-lesson-${x.id}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: x.id }), " ", tx(x.title)),
          h("span", { class: "tr-row-meta" }, reviewChip(`lesson-${x.id}`))))))) : null,
    DATA.tiers?.length ? h("section", { class: "tr-section" },
      h("h2", { text: t("review_layer_cases") }),
      h("p", { class: "cs-small", text: counts(ORDER.map((c) => `tierfu-${c.id}`)) }),
      h("ul", { class: "tr-rows" }, ORDER.filter((c) => passes(`tierfu-${c.id}`)).map((c) =>
        h("li", null, h("a", { class: "tr-row", href: `#review-${c.id}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: c.id }), " ",
            t("review_layer_count", (c.followups || []).length)),
          h("span", { class: "tr-row-meta" }, reviewChip(`tierfu-${c.id}`))))))) : null,
    DATA.tiers?.length ? h("section", { class: "tr-section" },
      h("h2", { text: t("review_layer_dx") }),
      h("p", { class: "cs-small", text: counts(dxKeys().filter((k) => DATA.diagnoses[k].plain || DATA.diagnoses[k].action).map((k) => `dxa-${k}`)) }),
      h("ul", { class: "tr-rows" }, dxKeys().filter((k) => (DATA.diagnoses[k].plain || DATA.diagnoses[k].action) && passes(`dxa-${k}`)).map((k) =>
        h("li", null, h("a", { class: "tr-row", href: `#review-dx-${k}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: k }), " ", tx(DATA.diagnoses[k].plain) || dxName(k)),
          h("span", { class: "tr-row-meta" }, reviewChip(`dxa-${k}`))))))) : null,
    h("section", { class: "tr-section" },
      h("h2", { text: t("review_teaching") }),
      h("p", { class: "cs-small", text: counts(dx.map((k) => `dx-${k}`)) }),
      h("ul", { class: "tr-rows" }, dx.filter((k) => passes(`dx-${k}`)).map((k) =>
        h("li", null, h("a", { class: "tr-row", href: `#review-dx-${k}` },
          h("span", { class: "tr-row-title" }, h("span", { class: "rv-id", text: k }), " ", dxName(k)),
          h("span", { class: "tr-row-meta" },
            !DATA.diagnoses[k].criteria && h("span", { class: "chip", text: t("review_distractor") }),
            reviewChip(`dx-${k}`))))))),
  );
}

function pairField(label, kind, ro, en) {
  const mk = (l, v) => {
    const text = Array.isArray(v) ? v.join("\n") : v || "";
    if (kind === "input") return h("input", { type: "text", lang: l, value: text });
    const rows = Math.max(kind === "lines" ? 3 : 2, Math.ceil(text.length / 70) + (Array.isArray(v) ? v.length : 0));
    return h("textarea", { lang: l, rows: String(Math.min(rows, 14)), value: text });
  };
  const a = mk("ro", ro);
  const b = mk("en", en);
  return {
    el: h("fieldset", { class: "rv-pair" },
      h("legend", { text: label }),
      h("label", null, h("span", { class: "rv-lang", text: "RO" }), a),
      h("label", null, h("span", { class: "rv-lang", text: "EN" }), b)),
    get: () => (kind === "lines" ? { ro: lines(a.value), en: lines(b.value) } : { ro: a.value.trim(), en: b.value.trim() }),
  };
}

function diffEdits(cur, orig) {
  const out = {};
  for (const k of Object.keys(cur)) if (JSON.stringify(cur[k]) !== JSON.stringify(orig[k])) out[k] = cur[k];
  return out;
}

function reviewNav(list, id) {
  const i = list.indexOf(id);
  const prev = list[i - 1];
  const next = list[i + 1];
  return h("div", { class: "cs-bar" },
    h("a", { class: "cs-back", href: "#review", text: `← ${t("review_back")}` }),
    h("span", { class: "cs-count", text: `${i + 1} / ${list.length}` }),
    h("span", { class: "rv-pn" },
      prev ? h("a", { href: `#review-${prev}`, text: t("review_prev") }) : null,
      next ? h("a", { href: `#review-${next}`, text: t("review_next") }) : null));
}

/* The status line, note and the three buttons shared by both review forms. */
function reviewActions(docId, kind, collect) {
  const doc = reviews.get(docId);
  const note = h("textarea", { rows: "3", placeholder: t("review_note_placeholder"), value: doc?.note || "" });
  const msg = h("p", { class: "cs-small", "aria-live": "polite" });
  const chipSlot = h("span");
  const savedLine = h("span", { class: "cs-small" });
  const refresh = () => {
    chipSlot.replaceChildren(reviewChip(docId));
    const d = reviews.get(docId);
    savedLine.textContent = d?.updatedAt ? t("review_by", when(d.updatedAt)) : "";
  };
  refresh();
  const prevRefresh = reviewRefresh;
  reviewRefresh = () => {
    prevRefresh?.();
    refresh();
  };

  async function save(status) {
    if (!db) {
      msg.textContent = t("review_need_db");
      return;
    }
    if (saving.has(docId)) return;
    const { edits, problem } = collect();
    if (problem && status === "approved") {
      msg.textContent = problem;
      return;
    }
    saving.add(docId);
    msg.textContent = t("review_saving");
    btns.forEach((b) => { b.disabled = true; });
    try {
      await db.collection("reviews").doc(docId).set({
        kind, status, note: note.value.trim(), edits, updatedAt: new Date().toISOString(), updatedBy: me,
      });
      msg.textContent = problem ? `${t("review_saved")}. ${problem}` : t("review_saved");
    } catch (e) {
      msg.textContent = `${t("review_error")} (${e?.code || e?.message || e})`;
    } finally {
      saving.delete(docId);
      btns.forEach((b) => { b.disabled = false; });
    }
  }
  const btns = [
    h("button", { type: "button", class: "btn", text: t("review_approve"), onclick: () => save("approved") }),
    h("button", { type: "button", class: "btn btn-quiet", text: t("review_changes"), onclick: () => save("changes") }),
    h("button", { type: "button", class: "btn btn-quiet", text: t("review_save"), onclick: () => save("draft") }),
  ];
  return {
    status: h("p", { class: "rv-status" }, chipSlot, " ", savedLine),
    el: h("div", { class: "rv-actions" },
      h("label", { class: "rv-field" }, h("span", { text: t("review_note") }), note),
      h("div", { class: "tr-actions" }, btns),
      msg),
  };
}

function reviewCase(id) {
  const c = CASES.get(id);
  const ed = reviews.get(id)?.edits || {};
  const val = (k) => (ed[k] !== undefined ? ed[k] : c[k]);
  const keys = dxKeys();
  const select = (value) => h("select", null, keys.map((k) =>
    h("option", { value: k, selected: k === value, text: `${dxName(k)} (${k})` })));

  const answer = select(val("answer"));
  const options = val("options").map((o) => select(o));
  const rhythm = pairField(t("review_rhythm"), "input", val("rhythm").ro, val("rhythm").en);
  const findings = pairField(t("review_findings"), "lines", val("findings").ro, val("findings").en);
  const takeaway = pairField(t("review_takeaway"), "text", val("takeaway").ro, val("takeaway").en);

  const actions = reviewActions(id, "case", () => {
    const cur = {
      answer: answer.value,
      options: options.map((s) => s.value),
      rhythm: rhythm.get(),
      findings: findings.get(),
      takeaway: takeaway.get(),
    };
    const problem = cur.options.includes(cur.answer) && new Set(cur.options).size === cur.options.length
      ? null : t("review_answer_missing");
    return { edits: diffEdits(cur, c), problem };
  });

  const viewer = makeViewer(c, { look: c.look || [], revealed: true });
  const caseReports = reports.filter((r) => r.caseId === id);
  const src = c.source;

  put(
    h("article", { class: "rv" },
      reviewNav(ORDER.map((x) => x.id), id),
      h("h1", { class: "cs-q" }, h("span", { class: "rv-id", text: c.id }), " ", dxName(c.answer)),
      actions.status,
      h("p", { class: "cs-patient" },
        h("span", { class: "tag", text: t("level", c.level) }), " ",
        `${tx(MODULES.get(c.module).title)} · ${patientLine(c)} · `,
        h("a", { href: `#case-${c.id}`, text: t("review_open_learner") })),
      viewer.el,
      h("div", { class: "rv-grid" },
        h("section", { class: "rv-side" },
          c.layout === "monitor" ? [
            h("h2", { text: t("review_source_monitor") }),
            h("p", { class: "rv-report", lang: "en", text: src.annotation || "–" }),
            h("p", { class: "cs-small", text: creditLine(c) }),
          ] : src.dataset === "mimic" ? [
            h("h2", { text: t("review_source_mimic") }),
            h("p", { class: "rv-report", lang: "en", text: src.report }),
            h("p", { class: "cs-small", text: `MIMIC-IV-ECG ${src.record}` }),
          ] : [
            h("h2", { text: t("review_source") }),
            h("p", { class: "rv-report", lang: "de", text: src.report }),
            h("p", { class: "cs-small" },
              `${t("review_codes")}: ${Object.entries(src.codes).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")} · ${t("review_validated", src.validated)} · PTB-XL ${src.ecg_id}`),
          ],
          c.layout !== "monitor" && [h("h2", { text: t("review_measure") }), measureTable(c)],
          h("p", { class: "cs-small", text: `${t("review_drills")}: ${c.drills.length ? c.drills.map((k) => t(`drill_${k}`)).join(", ") : "–"}` }),
          reviewTierPanel(c),
          caseReports.length ? [
            h("h2", { text: t("review_reports") }),
            h("ul", { class: "cs-list" }, caseReports.map((r) => h("li", { text: `${when(r.at)}: ${r.text}` }))),
          ] : null,
        ),
        h("section", { class: "rv-form" },
          h("fieldset", { class: "rv-pair rv-answer" },
            h("legend", { text: t("review_answer") }),
            answer,
            h("span", { class: "rv-sub", text: t("review_options") }),
            options),
          rhythm.el,
          findings.el,
          takeaway.el,
          actions.el,
        ),
      ),
    ),
  );
}

/* Read-only: which profiles see the case, their questions and follow-ups. Alex comments in the note. */
function reviewTierPanel(c) {
  if (!DATA.tiers?.length) return null;
  const fitText = { core: t("review_fit_core"), stretch: t("fit_stretch"), skip: "–" };
  const layer = reviewActions(`tierfu-${c.id}`, "case-profiles", () => ({ edits: {}, problem: null }));
  return [
    h("h2", { text: t("review_tiers") }),
    h("p", { class: "cs-small", text: t("review_layer_note") }),
    layer.status,
    h("div", { class: "tr-table-wrap" }, h("table", { class: "tr-table" },
      h("tbody", null, DATA.tiers.map((x) => h("tr", null,
        h("th", { scope: "row", text: tx(x.name) }),
        h("td", { text: fitText[c.tiers?.[x.id]] || "–" }),
        h("td", { class: "cs-small", text: [
          c.tier_question?.[x.id] ? `${t("review_question")}: ${tx(c.tier_question[x.id])}` : "",
          c.tier_options?.[x.id] ? `${t("review_options")}: ${c.tier_options[x.id].map(dxName).join(", ")}` : "",
        ].filter(Boolean).join(" · ") })))))),
    (c.followups || []).length ? [
      h("h2", { text: t("review_followups") }),
      h("ol", { class: "cs-list" }, c.followups.map((f) => h("li", null,
        h("p", null, h("strong", { text: tx(f.question) }), " ",
          h("span", { class: "cs-small", text: `(${f.tiers.map((id) => tx(TIERS.get(id)?.name)).join(", ")})` })),
        h("ol", { class: "cs-list", type: "A" }, f.options.map((o, i) =>
          h("li", { class: i === f.answer ? "rv-right" : null, text: tx(o) + (i === f.answer ? " ✓" : "") }))),
        h("p", { class: "cs-small", text: tx(f.explain) })))),
    ] : null,
    tx(c.action) ? [h("h2", { text: t("action_title") }), h("p", { text: tx(c.action) })] : null,
    tx(c.deep) ? [h("h2", { text: t("deep_title") }), h("p", { text: tx(c.deep) })] : null,
    layer.el,
  ];
}

function reviewTier(id) {
  const x = TIERS.get(id);
  const docId = `tier-${id}`;
  const actions = reviewActions(docId, "tier", () => ({ edits: {}, problem: null }));
  const core = ORDER.filter((c) => c.tiers?.[id] === "core");
  const stretch = ORDER.filter((c) => c.tiers?.[id] === "stretch");
  const fu = ORDER.reduce((n, c) => n + (c.followups || []).filter((f) => f.tiers.includes(id)).length, 0);
  const lessons = (DATA.lessons || []).map((l) => [l, l.tiers?.[id] || "optional"]);
  const link = (c) => h("li", null, h("a", { href: `#review-${c.id}`, text: c.id }), ` · ${dxName(c.answer)}`);
  put(
    h("article", { class: "rv" },
      reviewNav(DATA.tiers.map((y) => `tier-${y.id}`), docId),
      h("h1", { class: "cs-q", text: tx(x.name) }),
      actions.status,
      h("p", { class: "tr-intro", text: tx(x.who) }),
      h("ul", { class: "cs-list" }, (tx(x.goals) || []).map((g) => h("li", { text: g }))),
      h("p", { class: "cs-small", text: `${t("review_explain")}: ${t(`explain_${x.explain}`)} · ${t("review_drills")}: ${(x.drills || []).map((k) => t(`drill_${k}`)).join(", ") || "–"} · ${t("review_followups")}: ${fu}` }),
      h("p", { class: "cs-small", text: [
        `${t("review_first_view")}: ${t(x.first_view === "strip" ? "review_view_strip" : "review_view_12lead")}`,
        `${t("review_hints")}: ${t(x.hints ? "review_yes" : "review_no")}`,
        x.question ? `${t("review_question")}: ${tx(x.question)}` : "",
        x.focus?.length ? `${t("review_focus")}: ${x.focus.map((f) => tx(f.name) + (f.stretch?.length ? ` (${f.stretch.join(", ")} → ${t("fit_stretch")})` : "")).join(" · ")}` : "",
      ].filter(Boolean).join(" · ") }),
      x.action_set ? [h("h2", { text: t("review_action_set") }),
        h("ol", { class: "cs-list", type: "A" }, x.action_set.map((o) => h("li", { text: tx(o) })))] : null,
      h("div", { class: "rv-grid" },
        h("section", { class: "rv-side" },
          h("h2", { text: `${t("review_fit_core")} (${core.length})` }), h("ul", { class: "cs-list" }, core.map(link)),
          h("h2", { text: `${t("fit_stretch")} (${stretch.length})` }), h("ul", { class: "cs-list" }, stretch.map(link)),
          h("h2", { text: t("review_lessons") }),
          h("ul", { class: "cs-list" }, lessons.map(([l, f]) => h("li", null,
            h("a", { href: `#review-lesson-${l.id}`, text: tx(l.title) }), ` · ${t(`fit_${f}`)}`)))),
        h("section", { class: "rv-form" }, actions.el)),
    ),
  );
}

function reviewLesson(id) {
  const docId = `lesson-${id}`;
  const actions = reviewActions(docId, "lesson", () => ({ edits: {}, problem: null }));
  const l = LESSONS.get(id);
  put(
    h("div", { class: "rv" },
      reviewNav(DATA.lessons.map((x) => `lesson-${x.id}`), docId),
      h("p", { class: "cs-small", text: `${t("review_lesson_tiers")}: ${Object.entries(l.tiers || {}).map(([k, v]) => `${tx(TIERS.get(k)?.name) || k}: ${t(`fit_${v}`)}`).join(" · ")}` }),
      actions.status,
      actions.el),
  );
  viewLesson(id, true);
}

function measureTable(c) {
  const single = c.source.dataset === "mimic";
  return h("div", { class: "tr-table-wrap" }, h("table", { class: "tr-table rv-measure" },
    h("thead", null, h("tr", null, [t("review_col_measure"), t("review_col_value"), single ? t("review_col_machine") : "Glasgow / GE", t("review_col_check")].map((x) => h("th", { scope: "col", text: x })))),
    h("tbody", null, MEASURES.map((k) => {
      const v = c.measure[k];
      const src = c.measure_sources[k];
      let srcText = "–";
      if (src === "manual") srcText = t("review_manual");
      else if (Array.isArray(src)) srcText = src.map((x) => (x == null ? "–" : Math.round(x))).join(" / ") + (k === "axis" && !single ? ` (${t("review_axis_ours")})` : "");
      const ok = c.agree[k];
      if (single) {
        return h("tr", null,
          h("th", { scope: "row", text: t(`m_${k}`) }),
          h("td", { text: v == null ? t("na") : k === "axis" ? angle(v) : String(v) }),
          h("td", { text: srcText }),
          h("td", { text: v == null ? "" : t("review_single") }));
      }
      return h("tr", null,
        h("th", { scope: "row", text: t(`m_${k}`) }),
        h("td", { text: v == null ? t("na") : k === "axis" ? angle(v) : String(v) }),
        h("td", { text: srcText }),
        h("td", { class: ok ? "ok" : "bad", text: v == null ? "" : ok ? t("review_agree") : t("review_disagree") }));
    }))));
}

function reviewDiagnosis(key) {
  const d = DATA.diagnoses[key];
  const docId = `dx-${key}`;
  const ed = reviews.get(docId)?.edits || {};
  const val = (k) => (ed[k] !== undefined ? ed[k] : d[k]);
  const name = pairField(t("review_name"), "input", val("name").ro, val("name").en);
  const tell = pairField(t("review_tell"), "text", val("tell").ro, val("tell").en);
  const crit = d.criteria ? pairField(t("review_criteria"), "lines", val("criteria").ro, val("criteria").en) : null;
  const pit = d.pitfalls ? pairField(t("review_pitfalls"), "lines", val("pitfalls").ro, val("pitfalls").en) : null;
  const led = reviews.get(`dxa-${key}`)?.edits || {};
  const lval = (k) => (led[k] !== undefined ? led[k] : d[k]);
  const plain = d.plain ? pairField(t("review_plain"), "input", lval("plain").ro, lval("plain").en) : null;
  const act = d.action ? pairField(t("review_action"), "text", lval("action").ro, lval("action").en) : null;
  const layer = (plain || act) && reviewActions(`dxa-${key}`, "diagnosis-profiles", () => {
    const cur = {};
    if (plain) cur.plain = plain.get();
    if (act) cur.action = act.get();
    return { edits: diffEdits(cur, d), problem: null };
  });
  const actions = reviewActions(docId, "diagnosis", () => {
    const cur = { name: name.get(), tell: tell.get() };
    if (crit) cur.criteria = crit.get();
    if (pit) cur.pitfalls = pit.get();
    return { edits: diffEdits(cur, d), problem: null };
  });
  const keys = dxKeys();
  const used = ORDER.filter((c) => c.answer === key || c.options.includes(key));

  put(
    h("article", { class: "rv" },
      reviewNav(keys.map((k) => `dx-${k}`), docId),
      h("h1", { class: "cs-q" }, h("span", { class: "rv-id", text: key }), " ", dxName(key)),
      actions.status,
      h("div", { class: "rv-grid" },
        h("section", { class: "rv-side" },
          h("h2", { text: t("review_used_in") }),
          used.length
            ? h("ul", { class: "cs-list" }, used.map((c) => h("li", null,
              h("a", { href: `#review-${c.id}`, text: c.id }),
              ` · ${c.answer === key ? t("review_answer") : t("review_options")}`)))
            : h("p", { class: "cs-small", text: "–" }),
          !d.criteria && h("p", { class: "cs-small", text: t("review_distractor_note") }),
        ),
        h("section", { class: "rv-form" }, name.el, tell.el, crit?.el, pit?.el, actions.el,
          layer ? [h("h2", { text: t("review_layer_dx") }), layer.status, plain?.el, act?.el, layer.el] : null),
      ),
    ),
  );
}

/* ---------------------------------------------------------------- start */
langBtn.addEventListener("click", () => {
  lang = lang === "ro" ? "en" : "ro";
  store.setLang(lang);
  render(false);
});

async function start() {
  renderChrome(parseHash()[0]);
  try {
    const r = await fetch("data/cases.json");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    DATA = await r.json();
  } catch (e) {
    main.replaceChildren(h("p", { class: "tr-msg", text: t("load_error") }));
    return;
  }
  try {
    const r = await fetch("data/lessons.json");
    if (r.ok) DATA.lessons = (await r.json()).lessons;
  } catch (e) {
    DATA.lessons = [];
  }
  (DATA.lessons || []).forEach((l) => LESSONS.set(l.id, l));
  (DATA.tiers || []).forEach((tr) => TIERS.set(tr.id, tr));
  if (store.tier && !TIERS.has(store.tier)) store.setTier(null);
  DATA.modules.forEach((m, i) => MODULES.set(m.id, { ...m, index: i }));
  ORDER = DATA.cases.slice().sort((a, b) =>
    MODULES.get(a.module).index - MODULES.get(b.module).index || a.level - b.level || a.id.localeCompare(b.id));
  ORDER.forEach((c) => CASES.set(c.id, c));
  window.addEventListener("hashchange", () => render(true));
  render(false);
  connect();
}

start();
