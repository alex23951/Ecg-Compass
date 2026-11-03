/* Site behaviour: the live ECG strip, the calipers demo, the weekly quiz and the
   sign-up forms. No libraries. */
(function () {
  "use strict";

  var site = document.querySelector(".site");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cssVar(name) {
    return getComputedStyle(site || document.documentElement).getPropertyValue(name).trim();
  }

  function readTrace() {
    var el = document.getElementById("trace-data");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  /* ECG paper: 1 mm small squares, 5 mm big squares. 25 mm/s, 10 mm/mV. */
  function drawGrid(ctx, w, h, mm) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar("--grid-minor");
    ctx.beginPath();
    for (var x = 0; x <= w; x += mm) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (var y = h; y >= 0; y -= mm) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = cssVar("--grid-major");
    ctx.beginPath();
    for (x = 0; x <= w; x += mm * 5) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (y = h; y >= 0; y -= mm * 5) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
  }

  function setupCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* ---------------------------------------------------------------- strip */
  function heroStrip(trace) {
    var canvas = document.getElementById("hero-trace");
    if (!canvas || !trace) return;
    var samples = trace.samples, fs = trace.fs, n = samples.length;
    var state = null, head = 0, last = 0, raf = 0, visible = true;

    function layout() {
      state = setupCanvas(canvas);
      // 1 mm on screen: big enough to read, small enough to show several beats
      // (5 px/mm up to 720 px wide, so the desktop monitor card shows six beats).
      state.mm = state.w < 720 ? 5 : 6;
      state.pxPerSec = 25 * state.mm;
      state.baseline = state.h * 0.62;
      state.scale = 10 * state.mm / 100; // px per 0.01 mV
    }

    function yAt(i) {
      var v = samples[((i % n) + n) % n];
      return state.baseline - v * state.scale;
    }

    // The value shown at screen column x on the current sweep.
    function sampleForX(x, sweepStart) {
      return Math.floor(((sweepStart + x) / state.pxPerSec) * fs);
    }

    function drawRange(x0, x1, sweepStart) {
      var ctx = state.ctx;
      ctx.strokeStyle = cssVar("--trace");
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var x = x0; x <= x1; x++) {
        var y = yAt(sampleForX(x, sweepStart));
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function full() {
      var ctx = state.ctx;
      ctx.clearRect(0, 0, state.w, state.h);
      drawGrid(ctx, state.w, state.h, state.mm);
    }

    // Monitor sweep: the new sweep overwrites the old one, with a short gap ahead.
    var sweep = 0;
    function frame(t) {
      if (!last) last = t;
      var dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      var gap = 18;
      var prev = head;
      head += dt * state.pxPerSec;
      if (head >= state.w) {
        // finish this sweep, start the next from the left edge
        paintSlice(prev, state.w, sweep, gap);
        sweep += state.w;
        head -= state.w;
        prev = 0;
      }
      paintSlice(prev, head, sweep, gap);
      if (visible) raf = requestAnimationFrame(frame);
    }

    function paintSlice(from, to, sweepStart, gap) {
      var ctx = state.ctx;
      var a = Math.floor(from), b = Math.ceil(to);
      var e1 = Math.min(state.w, b + gap);
      // Clear the new stretch plus a short gap ahead of the write head; the old
      // sweep stays visible beyond the gap, as on a bedside monitor.
      ctx.save();
      ctx.beginPath();
      ctx.rect(a, 0, e1 - a, state.h);
      ctx.clip();
      ctx.clearRect(a, 0, e1 - a, state.h);
      drawGrid(ctx, state.w, state.h, state.mm);
      ctx.restore();
      drawRange(Math.max(0, a - 1), b, sweepStart);
    }

    function start() {
      layout();
      full();
      // Start complete at rest: the previous sweep fills the screen.
      sweep = 0;
      head = 0;
      if (reduceMotion) { drawRange(0, state.w, 0); return; }
      drawRange(0, state.w, -state.w);
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    start();
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(start, 150);
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var on = entries[0].isIntersecting;
        if (on && !visible && !reduceMotion) { visible = true; last = 0; raf = requestAnimationFrame(frame); }
        if (!on) { visible = false; cancelAnimationFrame(raf); }
      }).observe(canvas);
    }
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", start);
    }
  }

  /* ------------------------------------------------------------- calipers */
  function calipers(trace) {
    var stage = document.getElementById("calipers");
    if (!stage || !trace) return;
    var canvas = stage.querySelector("canvas");
    var handles = stage.querySelectorAll(".caliper");
    var outMs = document.querySelector('[data-out="ms"]');
    var outBpm = document.querySelector('[data-out="bpm"]');
    var samples = trace.samples, fs = trace.fs, peaks = trace.r_peaks || [];
    var state, startSample = Math.max(0, (peaks[0] || 0) - Math.round(0.45 * fs));
    // times (s) of the two calipers, relative to the start of the window
    var pos = {
      a: peaks.length > 1 ? (peaks[0] - startSample) / fs : 0.5,
      b: peaks.length > 1 ? (peaks[1] - startSample) / fs : 1.3
    };

    function layout() {
      state = setupCanvas(canvas);
      state.mm = state.w < 600 ? 5 : 6;
      state.pxPerSec = 25 * state.mm;
      state.seconds = state.w / state.pxPerSec;
      state.baseline = state.h * 0.66;
      state.scale = 10 * state.mm / 100;
      draw();
      place();
    }

    function draw() {
      var ctx = state.ctx;
      ctx.clearRect(0, 0, state.w, state.h);
      drawGrid(ctx, state.w, state.h, state.mm);
      ctx.strokeStyle = cssVar("--trace");
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var x = 0; x <= state.w; x++) {
        var i = startSample + Math.floor((x / state.pxPerSec) * fs);
        var v = samples[Math.min(samples.length - 1, i)];
        var y = state.baseline - v * state.scale;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function place() {
      handles.forEach(function (h) {
        var t = pos[h.dataset.which];
        h.style.left = (t * state.pxPerSec) + "px";
        h.setAttribute("aria-valuenow", Math.round(t * 1000));
        h.setAttribute("aria-valuetext", Math.round(t * 1000) + " ms");
      });
      var ms = Math.round(Math.abs(pos.b - pos.a) * 1000);
      outMs.textContent = ms;
      outBpm.textContent = ms >= 200 ? Math.round(60000 / ms) : "–";
    }

    function clampT(t) { return Math.max(0, Math.min(state.seconds, t)); }

    handles.forEach(function (h) {
      var which = h.dataset.which;
      h.addEventListener("pointerdown", function (ev) {
        h.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        h.focus({ preventScroll: true });
      });
      h.addEventListener("pointermove", function (ev) {
        if (!h.hasPointerCapture(ev.pointerId)) return;
        var rect = stage.getBoundingClientRect();
        pos[which] = clampT((ev.clientX - rect.left) / state.pxPerSec);
        place();
      });
      h.addEventListener("keydown", function (ev) {
        var step = ev.shiftKey ? 0.004 : 0.04; // one small square = 40 ms
        if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") pos[which] = clampT(pos[which] - step);
        else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") pos[which] = clampT(pos[which] + step);
        else return;
        ev.preventDefault();
        place();
      });
    });

    layout();
    var timer;
    window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(layout, 150); });
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", layout);
    }
  }

  /* ----------------------------------------------------------------- quiz */
  function quiz() {
    document.querySelectorAll(".quiz").forEach(function (q) {
      var answer = Number(q.dataset.answer);
      var buttons = q.querySelectorAll(".quiz-option");
      var panel = q.querySelector(".quiz-answer");
      var verdict = q.querySelector(".quiz-verdict");
      buttons.forEach(function (b) {
        b.addEventListener("click", function () {
          var chosen = Number(b.dataset.index);
          buttons.forEach(function (o) {
            var i = Number(o.dataset.index);
            o.disabled = true;
            if (i === answer) o.classList.add("is-correct");
            else if (i === chosen) o.classList.add("is-wrong");
            else o.classList.add("is-dim");
          });
          var ok = chosen === answer;
          verdict.textContent = ok ? verdict.dataset.correct : verdict.dataset.wrong;
          verdict.className = "quiz-verdict " + (ok ? "ok" : "bad");
          panel.hidden = false;
          // the options are now disabled: move focus to the verdict so it is read out
          verdict.tabIndex = -1;
          verdict.focus();
        });
      });
    });
  }

  /* ---------------------------------------------------------------- forms */
  function forms() {
    var endpoint = site ? site.dataset.endpoint : "";
    document.querySelectorAll("form.signup").forEach(function (form) {
      var errorBox = form.querySelector(".form-error");
      var done = form.nextElementSibling;
      var button = form.querySelector('button[type="submit"]');
      var label = button.textContent;
      var messages = {};
      form.querySelectorAll(".msg-errors").forEach(function (tpl) {
        tpl.content.querySelectorAll("[data-k]").forEach(function (s) { messages[s.dataset.k] = s.innerHTML; });
      });

      function fail(key) {
        errorBox.innerHTML = messages[key] || messages.server;
        errorBox.hidden = false;
      }

      function finish(status, isPreview) {
        var title = done.querySelector(".form-done-title");
        var text = done.querySelector(".form-done-text");
        if (status === "known") {
          title.textContent = title.dataset.titleKnown;
          text.textContent = text.dataset.textKnown;
        }
        done.querySelector(".form-done-preview").hidden = !isPreview;
        form.hidden = true;
        done.hidden = false;
        done.focus();
      }

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        errorBox.hidden = true;
        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || "")) return fail("email");
        if (!data.role) return fail("role");
        if (data.consent !== "yes") return fail("consent");
        if (data.website) return finish("pending", false); // bots fill hidden fields

        if (!endpoint) return finish("pending", true); // preview: nothing is sent

        button.disabled = true;
        button.textContent = button.dataset.sending;
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(data)
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok || !body.ok) throw new Error(body.error || "server");
            finish(body.status, false);
          });
        }).catch(function (err) {
          fail(["email", "role", "consent"].indexOf(err.message) >= 0 ? err.message : "server");
        }).then(function () {
          button.disabled = false;
          button.textContent = label;
        });
      });
    });
  }

  var trace = readTrace();
  heroStrip(trace);
  calipers(trace);
  quiz();
  forms();
})();
