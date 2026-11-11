/* Draws a 12-lead ECG on ECG paper at true proportions (25 mm/s, 10 mm/mV) and
   runs the calipers. Measurements come from the signal's own time base, so they are
   exact whatever the zoom or screen. No libraries. */

export const LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];

const SPEED = 25; // mm per second
const GAIN = 10; // standard mm per mV (readouts in mm always use this)
const COLS = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], ["V4", "V5", "V6"]];
const SVGNS = "http://www.w3.org/2000/svg";
// where a label sits from the point it explains
const DIRV = { n: [0, -1], ne: [0.72, -0.72], e: [1, 0], se: [0.72, 0.72], s: [0, 1], sw: [-0.72, 0.72], w: [-1, 0], nw: [-0.72, -0.72] };

/* ------------------------------------------------------------------ data */
export function decode(json) {
  const leads = {};
  json.leads.forEach((name, i) => {
    const bin = atob(json.data[i]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const raw = new Int16Array(bytes.buffer);
    const mv = new Float32Array(raw.length);
    // -32768 marks blank stretches at the edges of the recording
    for (let k = 0; k < raw.length; k++) mv[k] = raw[k] === -32768 ? NaN : raw[k] / 1000;
    leads[name] = mv;
  });
  return { fs: json.fs, n: json.n, leads, ecgId: json.ecg_id };
}

/* --------------------------------------------------------------- layouts */
// Every layout maps time t (s) to x (mm) the same way inside a row, so a caliper
// spanning columns still reads true time.
function layoutStandard(ecg, strips = ["II"]) {
  const left = 12; // calibration pulse lives here
  const rowH = 34;
  const top = 4;
  const dur = Math.min(10, ecg.n / ecg.fs);
  const colW = (dur / 4) * SPEED;
  const segs = [];
  COLS.forEach((leads, c) => {
    leads.forEach((lead, r) => {
      segs.push({
        lead, row: r, t0: (c * dur) / 4, t1: ((c + 1) * dur) / 4,
        x0: left + c * colW, y: top + rowH * (r + 0.5), h: rowH,
      });
    });
  });
  // one or more full-length rhythm strips under the 3 x 4 grid (II by default; pacing cases add V1)
  strips.forEach((lead, i) => {
    segs.push({ lead, rhythm: true, row: 3 + i, t0: 0, t1: dur, x0: left, y: top + rowH * (3.5 + i), h: rowH });
  });
  const rows = 3 + strips.length;
  return { w: left + 4 * colW + 4, h: top * 2 + rowH * rows, left, top, rowH, rows, segs, t0: 0, dur };
}

function layoutStrip(ecg, leads, win, rowH = 30) {
  const left = 12;
  const top = 3;
  const full = Math.min(10, ecg.n / ecg.fs);
  const t0 = win ? win[0] : 0;
  const t1 = win ? Math.min(win[1], full) : full;
  const segs = leads.map((lead, r) => ({
    lead, row: r, t0, t1, x0: left, y: top + rowH * (r + 0.5), h: rowH, rhythm: true,
  }));
  return {
    w: left + (t1 - t0) * SPEED + 4, h: top * 2 + rowH * leads.length,
    left, top, rowH, rows: leads.length, segs, t0, dur: t1,
  };
}

/* ------------------------------------------------------------------ view */
export class EcgView {
  /* host: an element to fill. opts: {layout: "standard" | "strip", leads: [...],
     strips: rhythm strips under the grid (default ["II"]), zoom: number, onCalipers(fn),
     highlight: [lead names, "II-rhythm", "V1-rhythm"],
     marks: teaching marks on strip rows, each {t0, t1, tone: "p" | "qrs" | "t" | "seg" | "rr",
     label, bracket: true for an interval drawn as a bracket under the trace, lead: one row only}} */
  constructor(host, ecg, opts = {}) {
    this.host = host;
    this.ecg = ecg;
    this.opts = Object.assign({ layout: "standard", leads: ["II"], zoom: 1, gain: GAIN, labels: {} }, opts);
    this.gain = this.opts.gain;
    this.highlight = new Set(opts.highlight || []);
    this.marks = opts.marks || [];
    this.anns = opts.annotations || []; // teaching arrows and labels, drawn as SVG (see _annotate)
    this.annFocus = null;
    this.cal = null; // {mode: "time" | "volt", a, b, active}
    this.listeners = [];

    host.classList.add("ecg-host");
    host.innerHTML = "";
    this.scroller = document.createElement("div");
    this.scroller.className = "ecg-scroll";
    this.stage = document.createElement("div");
    this.stage.className = "ecg-stage";
    this.paper = document.createElement("canvas");
    this.overlay = document.createElement("canvas");
    this.overlay.className = "ecg-overlay";
    this.overlay.tabIndex = -1;
    this.annLayer = document.createElementNS(SVGNS, "svg");
    this.annLayer.setAttribute("class", "ecg-ann");
    this.annLayer.setAttribute("aria-hidden", "true");
    this.stage.append(this.paper, this.annLayer, this.overlay);
    this.scroller.append(this.stage);
    host.append(this.scroller);

    this.layout = this.opts.layout === "strip"
      ? layoutStrip(ecg, this.opts.leads, this.opts.window, this.opts.rowH)
      : layoutStandard(ecg, this.opts.strips);
    this._bindPointer();
    this._bindKeys();
    this._ro = new ResizeObserver(() => this.draw());
    this._ro.observe(this.scroller);
    this._mq = window.matchMedia("(prefers-color-scheme: dark)");
    this._onTheme = () => this.draw();
    this._mq.addEventListener("change", this._onTheme);
    this._themeObs = new MutationObserver(() => this.draw());
    this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  destroy() {
    this._ro.disconnect();
    this._mq.removeEventListener("change", this._onTheme);
    this._themeObs.disconnect();
    this.host.innerHTML = "";
  }

  setZoom(z) {
    this.opts.zoom = z;
    this.draw();
  }

  setGain(g) {
    this.gain = g;
    this.draw();
  }

  setLabels(labels) {
    this.opts.labels = labels || {};
    this.draw();
  }

  setHighlight(leads) {
    this.highlight = new Set(leads || []);
    this.draw();
  }

  setMarks(marks) {
    this.marks = marks || [];
    this.draw();
  }

  /* annotations: [{kind, lead, rhythm?, t, v, label (a string), n?: badge number, finding?}]
     (built by trainer/annotate.py). focus: a finding index to show at full strength. */
  setAnnotations(anns, focus = null) {
    this.anns = anns || [];
    this.annFocus = focus;
    this._annotate();
  }

  /* x (CSS px) of the first annotation of a finding, to scroll it into view */
  annotationX(finding) {
    const a = this.anns.find((x) => (finding == null || x.finding === finding) && this._annSeg(x));
    const s = a && this._annSeg(a);
    if (!s) return null;
    const t = a.t ?? a.t0 ?? (a.times && a.times[0]) ?? s.t0;
    return (s.x0 + (t - s.t0) * SPEED) * this.pxmm;
  }

  /* Does this layout draw at least one mark of this finding? (a strip shows only some leads) */
  showsFinding(finding, list = this.anns) {
    return list.some((a) => a.finding === finding && ((a.kind === "vline" && !a.lead) || !!this._annSeg(a)));
  }

  /* -------------------------------------------------------------- drawing */
  _colors() {
    const cs = getComputedStyle(this.host);
    const v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    return {
      bg: v("--ecg-bg", "#fff"),
      minor: v("--ecg-minor", "rgba(214,96,88,.18)"),
      major: v("--ecg-major", "rgba(214,96,88,.42)"),
      trace: v("--ecg-trace", "#111"),
      label: v("--ecg-label", "#333"),
      hl: v("--ecg-highlight", "#b3261e"),
      // the box fill has its own token, so a cool outline colour cannot turn the pink paper grey
      hlFill: cs.getPropertyValue("--ecg-highlight-fill").trim(),
      cal: v("--ecg-caliper", "#1d4ed8"),
      font: v("--font-mono", "monospace"),
      mark: {
        p: v("--ecg-mark-p", "rgba(37, 99, 235, 0.16)"),
        qrs: v("--ecg-mark-qrs", "rgba(190, 40, 30, 0.16)"),
        t: v("--ecg-mark-t", "rgba(22, 150, 70, 0.16)"),
        seg: v("--ecg-mark-seg", "rgba(200, 130, 0, 0.2)"),
        rr: v("--ecg-mark-rr", "rgba(109, 40, 217, 0.12)"),
      },
    };
  }

  draw() {
    const L = this.layout;
    const avail = this.scroller.clientWidth || 800;
    // short strips (lessons) would grow huge at full width: cap the scale
    const fitPx = Math.min(avail / L.w, this.opts.maxPxmm || Infinity);
    this.pxmm = fitPx * this.opts.zoom;
    const wCss = Math.round(L.w * this.pxmm);
    const hCss = Math.round(L.h * this.pxmm);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (const c of [this.paper, this.overlay]) {
      c.width = Math.round(wCss * dpr);
      c.height = Math.round(hCss * dpr);
      c.style.width = wCss + "px";
      c.style.height = hCss + "px";
    }
    this.stage.style.width = wCss + "px";
    this.stage.style.height = hCss + "px";
    this.dpr = dpr;
    this.col = this._colors();
    const ctx = this.paper.getContext("2d");
    ctx.setTransform(dpr * this.pxmm, 0, 0, dpr * this.pxmm, 0, 0);
    this._grid(ctx);
    this._traces(ctx);
    this._annotate();
    this._drawOverlay();
  }

  _grid(ctx) {
    const L = this.layout;
    const c = this.col;
    const px = 1 / this.pxmm; // one CSS pixel in mm
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    const drawLines = (step, color, width) => {
      ctx.beginPath();
      for (let x = 0; x <= L.w + 0.01; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, L.h); }
      for (let y = 0; y <= L.h + 0.01; y += step) { ctx.moveTo(0, y); ctx.lineTo(L.w, y); }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // Small squares only when they are at least 2.5 screen pixels apart.
    if (this.pxmm >= 2.5) drawLines(1, c.minor, Math.max(0.5 * px, 0.06));
    drawLines(5, c.major, Math.max(1 * px, 0.12));
  }

  _traces(ctx) {
    const L = this.layout;
    const c = this.col;
    const ecg = this.ecg;
    const px = 1 / this.pxmm;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // calibration pulse at the start of every row: 1 mV high, 0.2 s wide
    ctx.strokeStyle = c.trace;
    ctx.lineWidth = Math.max(1.3 * px, 0.25);
    for (let r = 0; r < L.rows; r++) {
      const y = L.top + L.rowH * (r + 0.5);
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(4, y);
      ctx.lineTo(4, y - this.gain);
      ctx.lineTo(9, y - this.gain);
      ctx.lineTo(9, y);
      ctx.lineTo(L.left - 0.5, y);
      ctx.stroke();
    }

    // highlights behind the traces
    for (const s of L.segs) {
      const key = s.rhythm && this.opts.layout === "standard" ? s.lead + "-rhythm" : s.lead;
      if (!this.highlight.has(key)) continue;
      const x0 = s.x0;
      const w = (s.t1 - s.t0) * SPEED;
      ctx.save();
      ctx.fillStyle = c.hlFill || c.hl;
      ctx.globalAlpha = c.hlFill ? 1 : 0.09;
      ctx.fillRect(x0 + 0.3, s.y - s.h / 2 + 0.6, w - 0.6, s.h - 1.2);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = c.hl;
      ctx.lineWidth = Math.max(2 * px, 0.4);
      ctx.strokeRect(x0 + 0.3, s.y - s.h / 2 + 0.6, w - 0.6, s.h - 1.2);
      ctx.restore();
    }

    const marks = this.marks.length ? L.segs.filter((s) => s.rhythm) : [];
    // wave bands behind the traces
    for (const s of marks) {
      for (const m of this.marks) {
        if (m.bracket || (m.lead && m.lead !== s.lead)) continue;
        const a = Math.max(m.t0, s.t0);
        const b = Math.min(m.t1, s.t1);
        if (b <= a) continue;
        ctx.fillStyle = c.mark[m.tone] || c.mark.seg;
        ctx.fillRect(s.x0 + (a - s.t0) * SPEED, s.y - s.h / 2 + 0.6, (b - a) * SPEED, s.h - 1.2);
      }
    }

    ctx.strokeStyle = c.trace;
    ctx.lineWidth = Math.max(1.3 * px, 0.22);
    for (const s of L.segs) {
      const data = ecg.leads[s.lead];
      if (!data) continue;
      const i0 = Math.max(0, Math.floor(s.t0 * ecg.fs));
      const i1 = Math.min(data.length - 1, Math.ceil(s.t1 * ecg.fs));
      const base = s.y;
      ctx.beginPath();
      let pen = false;
      for (let i = i0; i <= i1; i++) {
        const v = data[i];
        if (v !== v) { pen = false; continue; } // NaN: gap
        const x = s.x0 + (i / ecg.fs - s.t0) * SPEED;
        const y = base - v * this.gain;
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }

    // column separators and lead labels
    ctx.fillStyle = c.label;
    const fs = Math.min(Math.max(3.2, 11 * px), 15 * px);
    ctx.font = `600 ${fs}px ${c.font}`;
    ctx.textBaseline = "top";
    for (const s of L.segs) {
      const label = this.opts.labels[s.lead] || s.lead;
      // a highlighted lead has a box outline: keep its label clear of the stroke
      const hk = s.rhythm && this.opts.layout === "standard" ? s.lead + "-rhythm" : s.lead;
      const inset = this.highlight.has(hk) ? 1 : 0;
      ctx.fillText(label, s.x0 + 1.2 + inset, s.y - s.h / 2 + 1.4 + inset);
      if (s.t0 > 0 && !s.rhythm) {
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y - 4);
        ctx.lineTo(s.x0, s.y + 4);
        ctx.strokeStyle = c.label;
        ctx.lineWidth = Math.max(1.3 * px, 0.25);
        ctx.stroke();
        ctx.strokeStyle = c.trace;
      }
    }
    ctx.lineWidth = Math.max(1.3 * px, 0.22);
    if (marks.length) this._markLabels(ctx, marks);
  }

  /* Labels over the wave bands and interval brackets under the trace. */
  _markLabels(ctx, rows) {
    const c = this.col;
    const px = 1 / this.pxmm;
    const fs = Math.min(Math.max(2.6, 11 * px), 14 * px);
    ctx.save();
    ctx.font = `600 ${fs}px ${c.font}`;
    ctx.fillStyle = c.label;
    ctx.strokeStyle = c.label;
    ctx.lineWidth = Math.max(1.2 * px, 0.2);
    for (const s of rows) {
      const ends = []; // right edge of the last band label on each text line
      for (const m of this.marks) {
        if (!m.label || (m.lead && m.lead !== s.lead)) continue;
        if (m.t1 <= s.t0 || m.t0 >= s.t1) continue;
        const x0 = s.x0 + (Math.max(m.t0, s.t0) - s.t0) * SPEED;
        const x1 = s.x0 + (Math.min(m.t1, s.t1) - s.t0) * SPEED;
        const mid = (x0 + x1) / 2;
        ctx.textAlign = "center";
        if (m.bracket) {
          const y = s.y + s.h / 2 - fs - 2.2 - (m.level || 0) * (fs + 2);
          ctx.beginPath();
          ctx.moveTo(x0, y - 1.2);
          ctx.lineTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.lineTo(x1, y - 1.2);
          ctx.stroke();
          ctx.textBaseline = "top";
          ctx.fillText(m.label, mid, y + 0.6);
        } else {
          // a line under the lead name, so the two never overlap; labels of
          // neighbouring narrow bands (P, QRS) step down a line instead of colliding
          const half = ctx.measureText(m.label).width / 2;
          let k = 0;
          while (ends[k] != null && ends[k] > mid - half - fs * 0.4) k++;
          ends[k] = mid + half;
          ctx.textBaseline = "top";
          const y = s.y - s.h / 2 + 1.6 + fs * (1.25 + k * 1.1);
          // a halo in the paper colour keeps a longer label ("PR segment") readable where a
          // tall R wave runs through it
          ctx.save();
          ctx.strokeStyle = c.bg;
          ctx.lineWidth = fs * 0.3;
          ctx.lineJoin = "round";
          ctx.strokeText(m.label, mid, y);
          ctx.restore();
          ctx.fillText(m.label, mid, y);
        }
      }
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------- annotations */
  _annSeg(a) {
    const segs = this.layout.segs;
    const strip = this.opts.layout === "strip";
    return segs.find((s) => s.lead === a.lead && (strip || !!s.rhythm === !!a.rhythm)) || null;
  }

  /* Arrows, brackets, boxes and labels over the paper. The SVG uses the paper's own
     millimetres, so every mark sits on the trace at any zoom or gain; line widths and
     text are kept at a fixed size on screen. */
  _annotate() {
    const g = this.annLayer;
    if (!g || !this.pxmm) return;
    const L = this.layout;
    g.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
    g.style.width = Math.round(L.w * this.pxmm) + "px";
    g.style.height = Math.round(L.h * this.pxmm) + "px";
    g.replaceChildren();
    if (!this.anns.length) return;
    const u = 1 / this.pxmm; // one screen pixel, in mm
    const small = this.pxmm < 3; // a whole 12-lead on a phone: smaller labels and arrows
    const FS = small ? 11 : 12.5; // label size in px
    const font = `600 ${FS}px ${getComputedStyle(this.host).getPropertyValue("--font-sans").trim() || "sans-serif"}`;
    const meas = (this._measure ||= document.createElement("canvas").getContext("2d"));
    meas.font = font;
    const el = (tag, attrs, parent = g) => {
      const e = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
      parent.append(e);
      return e;
    };
    const placed = []; // label boxes already drawn, to step around them
    const clampX = (x, hw) => Math.min(Math.max(x, hw + 2 * u), L.w - hw - 2 * u);
    const clampY = (y, hh) => Math.min(Math.max(y, hh + 2 * u), L.h - hh - 2 * u);
    const hits = (b) => placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);

    // a label pill centred at (cx, cy); pushes along (dx, dy) while it overlaps another
    const pill = (parent, text, cx, cy, n, dx = 0, dy = -1, cls = "") => {
      const tw = meas.measureText(text).width * u;
      const pad = 6 * u;
      const badge = n != null ? 16 * u : 0;
      const w = tw + 2 * pad + (badge ? badge + 3 * u : 0);
      const hgt = (FS + 9) * u;
      let x = clampX(cx, w / 2);
      let y = clampY(cy, hgt / 2);
      for (let k = 0; k < 6; k++) {
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - hgt / 2, y1: y + hgt / 2 };
        if (!hits(box)) break;
        x = clampX(x + (dx || 0.35) * (hgt + 2 * u) * (dx ? 1 : 0), w / 2);
        y = clampY(y + (dy || 1) * (hgt + 2 * u), hgt / 2);
      }
      placed.push({ x0: x - w / 2, x1: x + w / 2, y0: y - hgt / 2, y1: y + hgt / 2 });
      el("rect", { x: x - w / 2, y: y - hgt / 2, width: w, height: hgt, rx: hgt / 2, class: `a-pill ${cls}` }, parent);
      let tx = x - w / 2 + pad;
      if (badge) {
        el("circle", { cx: tx + badge / 2, cy: y, r: badge / 2, class: "a-badge" }, parent);
        const bt = el("text", { x: tx + badge / 2, y, class: "a-badge-text", "font-size": 10.5 * u }, parent);
        bt.textContent = String(n);
        tx += badge + 3 * u;
      }
      const te = el("text", { x: tx, y, class: `a-text ${cls}`, "font-size": FS * u }, parent);
      te.textContent = text;
      return { x, y, w, h: hgt };
    };

    // an arrowhead at (x, y) pointing along (dx, dy)
    const head = (parent, x, y, dx, dy, size = 7) => {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const s = size * u;
      el("path", {
        d: `M${x},${y} L${x - ux * s - uy * s * 0.55},${y - uy * s + ux * s * 0.55} L${x - ux * s + uy * s * 0.55},${y - uy * s - ux * s * 0.55} Z`,
        class: "a-head",
      }, parent);
    };

    const order = [...this.anns].sort((a, b) => (a.kind === "tag") - (b.kind === "tag"));
    for (const a of order) {
      const s = a.kind === "vline" && !a.lead ? null : this._annSeg(a);
      if (a.lead && !s) continue;
      const X = (t) => s.x0 + (t - s.t0) * SPEED;
      const Y = (v) => s.y - v * this.gain;
      const inCell = (t) => t >= s.t0 - 1e-6 && t <= s.t1 + 1e-6;
      const dim = this.annFocus != null && a.finding !== this.annFocus;
      const grp = el("g", { class: `a a-k-${a.kind}${dim ? " is-dim" : ""}${this.annFocus != null && !dim ? " is-focus" : ""}` });
      const n = a.n ?? null;
      const text = a.label || "";

      if (a.kind === "arrow" || a.kind === "dot") {
        if (!inCell(a.t)) continue;
        const px = X(a.t), py = Y(a.v);
        const [dx, dy] = DIRV[a.dir || "n"];
        const len = (a.kind === "dot" ? 22 : 34) * (a.len || 1) * (small ? 0.75 : 1) * u;
        const gap = (a.kind === "dot" ? 7 : 2.5) * u;
        const tx = px + dx * len, ty = py + dy * len;
        if (a.kind === "dot") el("circle", { cx: px, cy: py, r: 5.5 * u, class: "a-ring" }, grp);
        el("line", { x1: tx, y1: ty, x2: px + dx * gap, y2: py + dy * gap, class: "a-line" }, grp);
        if (a.kind === "arrow") head(grp, px + dx * gap, py + dy * gap, -dx, -dy);
        if (text) {
          const tw = meas.measureText(text).width * u + 12 * u + (n != null ? 19 * u : 0);
          const th = (FS + 9) * u;
          pill(grp, text, tx + dx * (tw / 2 + 2 * u) * Math.abs(dx) ** 2, ty + dy * (th / 2 + 1 * u), n, dx, dy || -1);
        }
      } else if (a.kind === "bracket") {
        const x0 = X(Math.max(a.t0, s.t0)), x1 = X(Math.min(a.t1, s.t1));
        if (x1 <= x0) continue;
        const y = Math.min(Math.max(Y(a.v), s.y - s.h / 2 + 3), s.y + s.h / 2 - 3);
        const tick = (a.side === "above" ? 5 : -5) * u;
        el("path", { d: `M${x0},${y + tick} L${x0},${y} L${x1},${y} L${x1},${y + tick}`, class: "a-line a-bracket-line" }, grp);
        if (text) {
          const th = (FS + 9) * u;
          pill(grp, text, (x0 + x1) / 2, y + (a.side === "above" ? -1 : 1) * (th / 2 + 2 * u), n, 0, a.side === "above" ? -1 : 1, "a-pill-quiet");
        }
      } else if (a.kind === "rise") {
        if (!inCell(a.t)) continue;
        const x = X(a.t), y0 = Y(a.v0), y1 = Y(a.v1);
        el("line", { x1: x - 9 * u, y1: y0, x2: x + 9 * u, y2: y0, class: "a-line a-dash" }, grp);
        if (Math.abs(y1 - y0) > 4 * u) {
          el("line", { x1: x, y1: y0, x2: x, y2: y1, class: "a-line" }, grp);
          head(grp, x, y1, 0, y1 - y0, 6);
        }
        const [dx, dy] = DIRV[a.dir || (a.v1 >= a.v0 ? "ne" : "se")];
        if (text) {
          const tw = meas.measureText(text).width * u + 12 * u + (n != null ? 19 * u : 0);
          const th = (FS + 9) * u;
          const yEnd = dy < 0 ? Math.min(y0, y1) : dy > 0 ? Math.max(y0, y1) : (y0 + y1) / 2;
          pill(grp, text, x + (dx ? Math.sign(dx) : 0) * (tw / 2 + 8 * u), yEnd + dy * (th / 2 + 6 * u), n, dx, dy || -1);
        }
      } else if (a.kind === "baseline") {
        const x0 = X(Math.max(a.t0, s.t0)), x1 = X(Math.min(a.t1, s.t1));
        if (x1 <= x0) continue;
        el("line", { x1: x0, y1: Y(a.v), x2: x1, y2: Y(a.v), class: "a-line a-dash a-base" }, grp);
        if (text) {
          const tw = meas.measureText(text).width * u + 12 * u;
          pill(grp, text, x1 - tw / 2, Y(a.v) + 14 * u, n, 0, 1, "a-pill-quiet");
        }
      } else if (a.kind === "box") {
        const x0 = X(Math.max(a.t0, s.t0)), x1 = X(Math.min(a.t1, s.t1));
        if (x1 <= x0) continue;
        const pad = 2 * u;
        const yTop = Math.max(Y(a.v1) - pad, s.y - s.h / 2 + 1), yBot = Math.min(Y(a.v0) + pad, s.y + s.h / 2 - 1);
        el("rect", { x: x0 - pad, y: yTop, width: x1 - x0 + 2 * pad, height: Math.max(yBot - yTop, 4 * u), rx: 4 * u, class: "a-box" }, grp);
        if (text) {
          const [dx, dy] = DIRV[a.dir || "n"];
          const th = (FS + 9) * u;
          const cx = (x0 + x1) / 2 + dx * ((x1 - x0) / 2 + 30 * u);
          const cy = dy < 0 ? yTop - th / 2 - 3 * u : dy > 0 ? yBot + th / 2 + 3 * u : (yTop + yBot) / 2;
          pill(grp, text, cx, cy, n, dx, dy || -1);
        }
      } else if (a.kind === "count") {
        (a.times || []).forEach((t, i) => {
          if (!inCell(t)) return;
          const x = X(t);
          const top = s.y - s.h / 2;
          const y = Math.max(Math.min(Y(a.vs?.[i] ?? 0) - 16 * u, s.y - 6 * u), top + 9 * u);
          el("circle", { cx: x, cy: y, r: 8.5 * u, class: "a-count" }, grp);
          const e = el("text", { x, y, class: "a-count-text", "font-size": 10.5 * u }, grp);
          e.textContent = String(i + 1);
        });
      } else if (a.kind === "tag") {
        // just right of the lead name, at the top of the lead's cell
        const lf = Math.min(Math.max(3.2, 11 * u), 15 * u);
        meas.font = `600 ${lf / u}px ${this.col?.font || "monospace"}`;
        const name = (this.opts.labels || {})[s.lead] || s.lead;
        const after = s.x0 + 1.2 + meas.measureText(name).width * u + 7 * u;
        meas.font = font;
        const tw = meas.measureText(text).width * u + 12 * u + (n != null ? 19 * u : 0);
        pill(grp, text, after + tw / 2, s.y - s.h / 2 + 1.4 + lf / 2 + 1 * u, n, 1, 0, "a-pill-tag");
      } else if (a.kind === "vline") {
        const rows = a.lead ? [s] : L.segs.filter((x) => a.t >= x.t0 && a.t <= x.t1);
        for (const r of rows) {
          const x = r.x0 + (a.t - r.t0) * SPEED;
          el("line", { x1: x, y1: r.y - r.h / 2 + 1, x2: x, y2: r.y + r.h / 2 - 1, class: "a-line a-dash" }, grp);
        }
        if (text && rows.length) {
          const r = rows[0];
          const x = r.x0 + (a.t - r.t0) * SPEED;
          pill(grp, text, x, r.y - r.h / 2 + (FS + 9) * u / 2 + 2 * u, n, 1, 0, "a-pill-quiet");
        }
      }
    }
  }

  /* -------------------------------------------------------------- calipers */
  timeToX(t) {
    return (this.layout.left + (t - this.layout.t0) * SPEED) * this.pxmm;
  }

  xToTime(x) {
    return (x / this.pxmm - this.layout.left) / SPEED + this.layout.t0;
  }

  /* mode "time": a, b in seconds. mode "volt": a, b in mV relative to the row
     baseline of `row` (0 = top). */
  showCalipers(mode = "time", init) {
    const L = this.layout;
    if (mode === "time") {
      const span = L.dur - L.t0;
      const t = init || [L.t0 + span * 0.1, L.t0 + span * 0.18];
      this.cal = { mode, a: t[0], b: t[1], active: "a" };
    } else {
      const row = (init && init.row) || 0;
      this.cal = { mode, row, a: 0, b: 0.1, active: "b" };
    }
    this.overlay.tabIndex = 0;
    this.overlay.setAttribute("role", "slider");
    this._drawOverlay();
    this._emit();
  }

  hideCalipers() {
    this.cal = null;
    this.overlay.tabIndex = -1;
    this.overlay.removeAttribute("role");
    this._drawOverlay();
    this._emit();
  }

  reading() {
    if (!this.cal) return null;
    if (this.cal.mode === "time") {
      const ms = Math.abs(this.cal.b - this.cal.a) * 1000;
      return { mode: "time", ms, bpm: ms > 0 ? 60000 / ms : null };
    }
    const mv = Math.abs(this.cal.b - this.cal.a);
    return { mode: "volt", mv, mm: mv * GAIN };
  }

  onCalipers(fn) {
    this.listeners.push(fn);
  }

  _emit() {
    const r = this.reading();
    this.listeners.forEach((fn) => fn(r));
  }

  _rowBase(row) {
    const L = this.layout;
    return L.top + L.rowH * (row + 0.5);
  }

  _drawOverlay() {
    const ctx = this.overlay.getContext("2d");
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!this.cal) return;
    const c = this.col || this._colors();
    const W = this.overlay.width / dpr;
    const H = this.overlay.height / dpr;
    ctx.strokeStyle = c.cal;
    ctx.fillStyle = c.cal;
    ctx.lineWidth = 1.5;
    if (this.cal.mode === "time") {
      const xa = this.timeToX(this.cal.a);
      const xb = this.timeToX(this.cal.b);
      for (const [k, x] of [["a", xa], ["b", xb]]) {
        ctx.globalAlpha = this.cal.active === k ? 1 : 0.75;
        ctx.setLineDash(this.cal.active === k ? [] : [5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        // grab handle
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, 10, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(xa, 10);
      ctx.lineTo(xb, 10);
      ctx.stroke();
    } else {
      const base = this._rowBase(this.cal.row);
      for (const [k, v] of [["a", this.cal.a], ["b", this.cal.b]]) {
        const y = (base - v * this.gain) * this.pxmm;
        ctx.globalAlpha = this.cal.active === k ? 1 : 0.75;
        ctx.setLineDash(this.cal.active === k ? [] : [5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(10, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  _posFromEvent(e) {
    const r = this.overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _bindPointer() {
    let drag = null;
    const o = this.overlay;
    o.addEventListener("pointerdown", (e) => {
      if (!this.cal) return;
      const p = this._posFromEvent(e);
      const cal = this.cal;
      let k;
      if (cal.mode === "time") {
        const da = Math.abs(this.timeToX(cal.a) - p.x);
        const db = Math.abs(this.timeToX(cal.b) - p.x);
        k = da <= db ? "a" : "b";
      } else {
        const base = this._rowBase(cal.row);
        const ya = (base - cal.a * this.gain) * this.pxmm;
        const yb = (base - cal.b * this.gain) * this.pxmm;
        k = Math.abs(ya - p.y) <= Math.abs(yb - p.y) ? "a" : "b";
      }
      cal.active = k;
      drag = { k, id: e.pointerId };
      o.setPointerCapture(e.pointerId);
      this._move(k, p);
      e.preventDefault();
    });
    o.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this._move(drag.k, this._posFromEvent(e));
    });
    const end = () => { drag = null; };
    o.addEventListener("pointerup", end);
    o.addEventListener("pointercancel", end);
  }

  _move(k, p) {
    const cal = this.cal;
    if (cal.mode === "time") {
      cal[k] = Math.max(this.layout.t0, Math.min(this.layout.dur, this.xToTime(p.x)));
    } else {
      // snap to 0.05 mV (half a small square) so ST measurements are steady
      const base = this._rowBase(cal.row);
      const v = (base - p.y / this.pxmm) / this.gain;
      cal[k] = Math.round(v * 20) / 20;
      // pick the row under the pointer when moving the first line
      const row = Math.floor((p.y / this.pxmm - this.layout.top) / this.layout.rowH);
      if (k === "a" && row >= 0 && row < this.layout.rows && row !== cal.row) {
        cal.row = row;
        cal.a = 0;
        cal.b = Math.round(((this._rowBase(row) - p.y / this.pxmm) / this.gain) * 20) / 20;
      }
    }
    this._drawOverlay();
    this._emit();
  }

  _bindKeys() {
    this.overlay.addEventListener("keydown", (e) => {
      const cal = this.cal;
      if (!cal) return;
      if (e.key === " " || e.key === "Tab" && !e.shiftKey && cal.active === "a") {
        if (e.key === " ") {
          cal.active = cal.active === "a" ? "b" : "a";
          this._drawOverlay();
          e.preventDefault();
        }
        return;
      }
      let d = 0;
      if (cal.mode === "time") {
        const step = e.shiftKey ? 0.02 : 0.004;
        if (e.key === "ArrowLeft") d = -step;
        if (e.key === "ArrowRight") d = step;
      } else {
        if (e.key === "ArrowUp") d = 0.05;
        if (e.key === "ArrowDown") d = -0.05;
      }
      if (!d) return;
      cal[cal.active] = Math.round((cal[cal.active] + d) * 1000) / 1000;
      this._drawOverlay();
      this._emit();
      e.preventDefault();
    });
  }
}

/* -------------------------------------------------------- formatting helpers */
export function fmtMs(ms) {
  return Math.round(ms) + " ms";
}
