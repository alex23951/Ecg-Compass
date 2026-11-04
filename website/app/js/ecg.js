/* Draws a 12-lead ECG on ECG paper at true proportions (25 mm/s, 10 mm/mV) and
   runs the calipers. Measurements come from the signal's own time base, so they are
   exact whatever the zoom or screen. No libraries. */

export const LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];

const SPEED = 25; // mm per second
const GAIN = 10; // standard mm per mV (readouts in mm always use this)
const COLS = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], ["V4", "V5", "V6"]];

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
    this.stage.append(this.paper, this.overlay);
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
          ctx.fillText(m.label, mid, s.y - s.h / 2 + 1.6 + fs * (1.25 + k * 1.1));
        }
      }
    }
    ctx.restore();
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
