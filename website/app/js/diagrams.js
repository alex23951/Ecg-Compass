/* Schematic figures for the lessons: ECG paper, one labelled beat, the conduction
   system, electrode placement (IEC colours, as used in Romania), the hexaxial system,
   lead groups and the rule of 300. Plain SVG, themed by app.css. */

const NS = "http://www.w3.org/2000/svg";

const WORDS = {
  ro: {
    small: "1 pătrățel = 1 mm", small_t: "0,04 s (40 ms)", small_v: "0,1 mV",
    big: "1 pătrat mare = 5 mm", big_t: "0,2 s (200 ms)", big_v: "0,5 mV",
    speed: "Viteza hârtiei: 25 mm/s", cal: "Semnal de calibrare: 10 mm = 1 mV", time: "timp", volt: "amplitudine",
    pr_int: "interval PR", pr_seg: "segment PR", st_seg: "segment ST", qt: "interval QT", qrs: "QRS",
    sa: "nodul sinusal", av: "nodul atrioventricular", his: "fasciculul His", rbb: "ramura dreaptă",
    lbb: "ramura stângă", laf: "fasciculul anterior stâng", lpf: "fasciculul posterior stâng", purk: "rețeaua Purkinje",
    ra: "AD", la: "AS", rv: "VD", lv: "VS",
    r_arm: "braț drept", l_arm: "braț stâng", l_leg: "picior stâng", r_leg: "picior drept (neutru)",
    iec: "Culori IEC (Europa, România)",
    sternum: "stern", mcl: "linia medioclaviculară", aal: "linia axilară anterioară", mal: "linia axilară medie",
    ics4: "spațiul intercostal 4", ics5: "spațiul intercostal 5",
    mon3: "Monitorizare cu 3 electrozi", mon5: "Monitorizare cu 5 electrozi",
    under_r: "sub clavicula dreaptă", under_l: "sub clavicula stângă", low_l: "rebord costal stâng", low_r: "rebord costal drept",
    chest_c: "electrod toracic (de obicei poziția V1)",
    normal: "ax normal: −30° … +90°",
    inferior: "inferior", lateral: "lateral", septal: "septal", anterior: "anterior", avr: "aVR",
    big_boxes: "pătrate mari între două unde R", rate: "frecvența (/min)",
    front: "Torace anterior", back: "Privit din spate",
    v4r: "V4R: spațiul intercostal 5 drept, linia medioclaviculară dreaptă (în oglindă cu V4)",
    v7: "V7: linia axilară posterioară", v8: "V8: linia scapulară (vârful scapulei)", v9: "V9: linia paravertebrală stângă",
    same_level: "V7–V9 pe aceeași orizontală cu V6",
    pads_al: "Poziția anterolaterală", pads_ap: "Poziția anteroposterioară",
    pad_r: "sub clavicula dreaptă, lângă stern", pad_l: "sub axila stângă, pe linia axilară medie",
    pad_front: "anterior: precordial stâng", pad_back: "posterior: sub scapula stângă",
    device: "stimulator sau defibrilator implantat: electrozii la peste 8 cm de aparat sau în altă poziție (ERC 2025)",
    avb1: "BAV gradul I: PR constant, alungit; fiecare P este urmată de QRS",
    avb2a: "BAV gradul II tip Mobitz I (perioade Luciani-Wenckebach): PR se alungește până la o undă P blocată",
    avb2b: "BAV gradul II tip Mobitz II: PR constant, apoi o undă P blocată brusc",
    avb21: "BAV gradul II cu conducere 2:1: o undă P condusă, una blocată",
    avb3: "BAV gradul III (complet): undele P și QRS merg fiecare în ritmul lor",
    blocked: "P blocată", pr_ms: "PR (ms)", escape: "ritm de scăpare",
    schematic: "Schemă, nu traseul unui pacient",
  },
  en: {
    small: "1 small square = 1 mm", small_t: "0.04 s (40 ms)", small_v: "0.1 mV",
    big: "1 large square = 5 mm", big_t: "0.2 s (200 ms)", big_v: "0.5 mV",
    speed: "Paper speed: 25 mm/s", cal: "Calibration: 10 mm = 1 mV", time: "time", volt: "amplitude",
    pr_int: "PR interval", pr_seg: "PR segment", st_seg: "ST segment", qt: "QT interval", qrs: "QRS",
    sa: "sinus node", av: "atrioventricular node", his: "bundle of His", rbb: "right bundle branch",
    lbb: "left bundle branch", laf: "left anterior fascicle", lpf: "left posterior fascicle", purk: "Purkinje fibres",
    ra: "RA", la: "LA", rv: "RV", lv: "LV",
    r_arm: "right arm", l_arm: "left arm", l_leg: "left leg", r_leg: "right leg (neutral)",
    iec: "IEC colours (Europe)",
    sternum: "sternum", mcl: "midclavicular line", aal: "anterior axillary line", mal: "midaxillary line",
    ics4: "4th intercostal space", ics5: "5th intercostal space",
    mon3: "3-electrode monitoring", mon5: "5-electrode monitoring",
    under_r: "below the right clavicle", under_l: "below the left clavicle", low_l: "left lower ribs", low_r: "right lower ribs",
    chest_c: "chest electrode (usually the V1 position)",
    normal: "normal axis: −30° … +90°",
    inferior: "inferior", lateral: "lateral", septal: "septal", anterior: "anterior", avr: "aVR",
    big_boxes: "large squares between two R waves", rate: "rate (/min)",
    front: "Front of the chest", back: "Seen from behind",
    v4r: "V4R: right 5th intercostal space, right midclavicular line (mirror of V4)",
    v7: "V7: posterior axillary line", v8: "V8: scapular line (tip of the scapula)", v9: "V9: left paraspinal line",
    same_level: "V7–V9 on the same horizontal line as V6",
    pads_al: "Anterolateral position", pads_ap: "Anteroposterior position",
    pad_r: "below the right clavicle, beside the sternum", pad_l: "below the left armpit, in the midaxillary line",
    pad_front: "front: left precordium", pad_back: "back: below the left scapula",
    device: "implanted pacemaker or ICD: pads more than 8 cm from the device, or another position (ERC 2025)",
    avb1: "First-degree AV block: constant, long PR; every P is followed by a QRS",
    avb2a: "Second-degree AV block, Mobitz I (Wenckebach): the PR lengthens until a P is blocked",
    avb2b: "Second-degree AV block, Mobitz II: constant PR, then a P is suddenly blocked",
    avb21: "Second-degree AV block with 2:1 conduction: one P conducted, one blocked",
    avb3: "Third-degree (complete) AV block: P waves and QRS complexes each keep their own rate",
    blocked: "blocked P", pr_ms: "PR (ms)", escape: "escape rhythm",
    schematic: "Schematic, not a patient's tracing",
  },
};

// IEC electrode colours
const IEC = { R: "#d62828", L: "#f2c300", F: "#2a9d3a", N: "#1b1b1b", C: "#f4f4f4",
  C1: "#d62828", C2: "#f2c300", C3: "#2a9d3a", C4: "#8b5a2b", C5: "#1b1b1b", C6: "#8e44ad" };

function el(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  for (const kid of kids.flat(Infinity)) if (kid != null) e.append(kid);
  return e;
}

function text(x, y, s, cls = "dg-label", anchor = "start") {
  const e = el("text", { x, y, class: cls, "text-anchor": anchor, "dominant-baseline": "middle" });
  e.textContent = s;
  return e;
}

function svg(w, h, label, ...kids) {
  return el("svg", { class: "dg", viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label, style: `max-width:${w}px` }, ...kids);
}

function grid(x0, y0, w, h, mm) {
  const lines = [];
  for (let i = 0; i <= w; i++) {
    lines.push(el("line", { x1: x0 + i * mm, y1: y0, x2: x0 + i * mm, y2: y0 + h * mm, class: i % 5 ? "dg-minor" : "dg-major" }));
  }
  for (let j = 0; j <= h; j++) {
    lines.push(el("line", { x1: x0, y1: y0 + j * mm, x2: x0 + w * mm, y2: y0 + j * mm, class: j % 5 ? "dg-minor" : "dg-major" }));
  }
  return lines;
}

function bracketH(x1, x2, y, label, up = false) {
  const d = up ? -4 : 4;
  return [
    el("path", { d: `M${x1} ${y + d}V${y}H${x2}V${y + d}`, class: "dg-bracket" }),
    text((x1 + x2) / 2, y - (up ? 9 : -12), label, "dg-label dg-small", "middle"),
  ];
}

function electrode(x, y, color, code, r = 9) {
  return el("g", { class: "dg-electrode" },
    el("circle", { cx: x, cy: y, r, fill: color, class: "dg-el" }),
    text(x, y + 0.5, code, color === IEC.N || color === IEC.C5 || color === IEC.R || color === IEC.C1 || color === IEC.C6 || color === IEC.C4 ? "dg-el-code dg-el-light" : "dg-el-code", "middle"));
}

/* ------------------------------------------------------------------ figures */
function paper(w) {
  const mm = 12;
  const x0 = 20;
  const y0 = 20;
  const cols = 25;
  const rows = 15;
  const base = y0 + 12 * mm;
  const cal = el("path", { d: `M${x0} ${base}h${2 * mm}v${-10 * mm}h${5 * mm}v${10 * mm}h${3 * mm}`, class: "dg-trace" });
  return svg(x0 * 2 + cols * mm + 250, y0 * 2 + rows * mm + 10, w.speed,
    grid(x0, y0, cols, rows, mm),
    cal,
    text(x0 + 3.5 * mm, y0 - 9, w.cal, "dg-label dg-small"),
    // one small square
    el("rect", { x: x0 + 15 * mm, y: y0 + 2 * mm, width: mm, height: mm, class: "dg-hl" }),
    // one big square
    el("rect", { x: x0 + 15 * mm, y: y0 + 5 * mm, width: 5 * mm, height: 5 * mm, class: "dg-hl dg-hl-2" }),
    bracketH(x0 + 15 * mm, x0 + 20 * mm, y0 + 10 * mm + 6, w.big_t),
    text(x0 + cols * mm + 16, y0 + 2.5 * mm, w.small, "dg-label"),
    text(x0 + cols * mm + 16, y0 + 2.5 * mm + 18, `${w.time}: ${w.small_t}`, "dg-label dg-small"),
    text(x0 + cols * mm + 16, y0 + 2.5 * mm + 34, `${w.volt}: ${w.small_v}`, "dg-label dg-small"),
    text(x0 + cols * mm + 16, y0 + 7.5 * mm, w.big, "dg-label"),
    text(x0 + cols * mm + 16, y0 + 7.5 * mm + 18, `${w.time}: ${w.big_t}`, "dg-label dg-small"),
    text(x0 + cols * mm + 16, y0 + 7.5 * mm + 34, `${w.volt}: ${w.big_v}`, "dg-label dg-small"),
    text(x0 + cols * mm + 16, y0 + 12.5 * mm, w.speed, "dg-label"),
    el("path", { d: `M${x0 + 21 * mm} ${y0 + 2.5 * mm}H${x0 + cols * mm + 10}`, class: "dg-lead" }),
    el("path", { d: `M${x0 + 20 * mm} ${y0 + 7.5 * mm}H${x0 + cols * mm + 10}`, class: "dg-lead" }),
  );
}

/* One schematic beat with its waves, intervals and segments (not to a patient's scale). */
function beat(w) {
  const y = 150;
  const x = (ms) => 40 + ms * 0.9; // 0.9 px per ms
  // P 0-100, PR segment to 160, QRS 160-250, ST to 330, T 330-500, end 500
  const d = [
    `M${x(-40)} ${y}H${x(0)}`,
    `C${x(25)} ${y - 26},${x(75)} ${y - 26},${x(100)} ${y}`,
    `H${x(160)}L${x(178)} ${y + 14}L${x(205)} ${y - 120}L${x(230)} ${y + 32}L${x(250)} ${y}`,
    `H${x(330)}C${x(380)} ${y - 4},${x(400)} ${y - 52},${x(430)} ${y - 52}C${x(465)} ${y - 52},${x(480)} ${y - 6},${x(500)} ${y}`,
    `H${x(600)}`,
  ].join("");
  const band = (a, b, cls) => el("rect", { x: x(a), y: 20, width: x(b) - x(a), height: 180, class: cls });
  return svg(x(620), 290, `${w.pr_int}, ${w.qrs}, ${w.qt}`,
    band(0, 100, "dg-band dg-p"), band(160, 250, "dg-band dg-qrs"), band(330, 500, "dg-band dg-t"),
    el("path", { d, class: "dg-trace" }),
    text(x(50), y - 40, "P", "dg-wave", "middle"),
    text(x(176), y + 28, "Q", "dg-wave", "middle"),
    text(x(205), y - 134, "R", "dg-wave", "middle"),
    text(x(234), y + 46, "S", "dg-wave", "middle"),
    text(x(430), y - 66, "T", "dg-wave", "middle"),
    bracketH(x(100), x(160), y - 12, w.pr_seg, true),
    bracketH(x(250), x(330), y - 12, w.st_seg, true),
    bracketH(x(0), x(160), 214, w.pr_int),
    bracketH(x(160), x(250), 246, w.qrs),
    bracketH(x(160), x(500), 278 - 4, w.qt),
  );
}

/* The conduction system on a simplified heart (the patient's right on the left). */
function conduction(w) {
  const heart = el("path", {
    d: "M250 60 C210 60 180 90 180 130 L180 190 C180 260 270 330 340 360 C410 330 500 260 500 190 L500 130 C500 90 470 60 430 60 C390 60 360 80 340 100 C320 80 290 60 250 60 Z",
    class: "dg-heart",
  });
  const path = (d, cls = "dg-cond") => el("path", { d, class: cls });
  const node = (cx, cy) => el("circle", { cx, cy, r: 9, class: "dg-node" });
  // label on the left (x1 = text end) or right (x1 = text start), leader to the point (px, py)
  const left = (y, s, px, py) => [el("path", { d: `M168 ${y}L${px} ${py}`, class: "dg-lead" }), text(162, y, s, "dg-label dg-small", "end")];
  const right = (y, s, px, py) => [el("path", { d: `M512 ${y}L${px} ${py}`, class: "dg-lead" }), text(518, y, s, "dg-label dg-small", "start")];
  return svg(700, 390, w.sa,
    heart,
    el("path", { d: "M340 100 V178 M184 180 H496 M340 180 V350", class: "dg-septum" }),
    text(226, 150, w.ra, "dg-chamber", "middle"), text(430, 128, w.la, "dg-chamber", "middle"),
    text(262, 250, w.rv, "dg-chamber", "middle"), text(418, 250, w.lv, "dg-chamber", "middle"),
    path("M218 86 C250 120 300 150 328 172"), // atrial spread to the AV node
    path("M332 180 V214"), // His bundle
    path("M334 214 C334 260 310 300 275 318"), // right bundle branch
    path("M346 214 C352 228 368 232 398 220"), // left anterior fascicle
    path("M346 214 C352 262 380 300 410 316"), // left posterior fascicle
    path("M275 318 C250 300 222 270 212 232 M275 318 C300 332 320 338 336 340 M410 316 C440 300 468 262 474 222 M398 220 C428 204 458 196 480 196", "dg-cond dg-thin"),
    node(218, 86), node(330, 178),
    left(70, w.sa, 210, 82),
    left(176, w.av, 320, 178),
    left(290, w.rbb, 300, 296),
    left(336, w.purk, 236, 300),
    right(150, w.his, 334, 200),
    right(214, w.laf, 392, 222),
    right(250, w.lbb, 350, 222),
    right(300, w.lpf, 402, 306),
  );
}

function body(extra) {
  return [
    el("circle", { cx: 200, cy: 46, r: 30, class: "dg-body" }),
    el("path", { d: "M150 90 H250 L300 110 L340 250 M100 250 L140 110 L150 90 M150 90 L140 110 L150 300 H250 L260 110 L250 90 M150 300 L140 470 M250 300 L260 470", class: "dg-body" }),
    extra,
  ];
}

function limbLeads(w) {
  const R = [110, 260]; const L = [330, 260]; const F = [262, 450]; const N = [138, 450];
  return svg(640, 500, w.iec,
    body(),
    el("path", { d: `M${R[0]} ${R[1]} L${L[0]} ${L[1]} L${F[0]} ${F[1]} Z`, class: "dg-triangle" }),
    text(220, R[1] - 12, "I", "dg-wave", "middle"),
    text(170, 365, "II", "dg-wave", "middle"),
    text(316, 365, "III", "dg-wave", "middle"),
    electrode(R[0], R[1], IEC.R, "R"), electrode(L[0], L[1], IEC.L, "L"),
    electrode(F[0], F[1], IEC.F, "F"), electrode(N[0], N[1], IEC.N, "N"),
    text(380, 200, w.iec, "dg-label"),
    text(380, 230, `R: ${w.r_arm}`, "dg-label dg-small"),
    text(380, 254, `L: ${w.l_arm}`, "dg-label dg-small"),
    text(380, 278, `F: ${w.l_leg}`, "dg-label dg-small"),
    text(380, 302, `N: ${w.r_leg}`, "dg-label dg-small"),
  );
}

function chestLeads(w) {
  // chest seen from the front: the patient's right on the left
  const ribs = [];
  for (let i = 0; i < 6; i++) {
    const y = 120 + i * 36;
    ribs.push(el("path", { d: `M200 ${y} C160 ${y + 6} 110 ${y + 22} 80 ${y + 46}`, class: "dg-rib" }));
    ribs.push(el("path", { d: `M240 ${y} C280 ${y + 6} 340 ${y + 22} 380 ${y + 46}`, class: "dg-rib" }));
    ribs.push(text(212, y, String(i + 1), "dg-label dg-tiny", "middle"));
  }
  // ribs 1-6 meet the sternum at y = 120 ... 300; they slope down by about 18 px at the midclavicular line
  const y4 = 120 + 3 * 36 + 18; // 4th intercostal space (between ribs 4 and 5) at the sternum
  const v4 = 120 + 4 * 36 + 18 + 18; // 5th intercostal space at the midclavicular line
  const pos = {
    V1: [192, y4], V2: [248, y4], V4: [312, v4], V3: [280, (y4 + v4) / 2],
    V5: [352, v4], V6: [392, v4],
  };
  const col = { V1: IEC.C1, V2: IEC.C2, V3: IEC.C3, V4: IEC.C4, V5: IEC.C5, V6: IEC.C6 };
  return svg(680, 410, w.ics4,
    el("path", { d: "M70 80 C120 70 170 74 200 82 M240 82 C270 74 320 70 370 80", class: "dg-body" }),
    el("rect", { x: 200, y: 84, width: 40, height: 250, rx: 10, class: "dg-sternum" }),
    ribs,
    el("path", { d: "M312 70 V360", class: "dg-guide" }),
    el("path", { d: "M352 80 V360", class: "dg-guide" }),
    el("path", { d: "M392 90 V360", class: "dg-guide" }),
    text(312, 376, w.mcl, "dg-label dg-tiny", "middle"),
    text(352, 392, w.aal, "dg-label dg-tiny", "middle"),
    text(430, 360, w.mal, "dg-label dg-tiny", "start"),
    text(220, 350, w.sternum, "dg-label dg-tiny", "middle"),
    Object.entries(pos).map(([k, [x, y]]) => electrode(x, y, col[k], k.slice(1), 10)),
    text(440, 140, "V1, V2: " + w.ics4, "dg-label dg-small"),
    text(440, 164, "V4: " + w.ics5 + ",", "dg-label dg-small"),
    text(440, 184, w.mcl, "dg-label dg-small"),
    text(440, 208, "V3: V2 ↔ V4", "dg-label dg-small"),
    text(440, 232, "V5, V6: = V4", "dg-label dg-small"),
  );
}

function monitor(w) {
  const panel = (dx, title, items) => [
    text(dx + 200, 18, title, "dg-label", "middle"),
    el("g", { transform: `translate(${dx} 20)` }, body(items)),
  ];
  return svg(820, 560, w.mon3,
    panel(0, w.mon3, [
      electrode(150, 112, IEC.R, "R"), electrode(250, 112, IEC.L, "L"), electrode(262, 270, IEC.F, "F"),
    ]),
    panel(410, w.mon5, [
      electrode(150, 112, IEC.R, "R"), electrode(250, 112, IEC.L, "L"), electrode(262, 270, IEC.F, "F"),
      electrode(140, 270, IEC.N, "N"), electrode(190, 172, IEC.C, "C"),
    ]),
    text(410, 516, `R: ${w.under_r} · L: ${w.under_l} · F: ${w.low_l} · N: ${w.low_r}`, "dg-label dg-small", "middle"),
    text(410, 540, `C: ${w.chest_c}`, "dg-label dg-small", "middle"),
  );
}

function hexaxial(w) {
  const R = 130;
  const pos = (deg, r) => [200 + r * Math.cos((deg * Math.PI) / 180), 170 + r * Math.sin((deg * Math.PI) / 180)];
  const leads = [["I", 0], ["II", 60], ["III", 120], ["aVF", 90], ["aVL", -30], ["aVR", -150]];
  const [ax, ay] = pos(-30, R);
  const [bx, by] = pos(90, R);
  return svg(420, 360, w.normal,
    el("path", { d: `M200 170L${ax} ${ay}A${R} ${R} 0 0 1 ${bx} ${by}Z`, class: "dg-band dg-t" }),
    el("circle", { cx: 200, cy: 170, r: R, class: "dg-ring" }),
    leads.map(([name, deg]) => {
      const [x1, y1] = pos(deg + 180, R);
      const [x2, y2] = pos(deg, R);
      const [lx, ly] = pos(deg, R + 22);
      return [el("line", { x1, y1, x2, y2, class: "dg-axis" }), el("circle", { cx: x2, cy: y2, r: 3.5, class: "dg-node" }),
        text(lx, ly, `${name} ${deg > 0 ? "+" : deg < 0 ? "−" : ""}${Math.abs(deg)}°`, "dg-label dg-small", "middle")];
    }),
    text(200, 345, w.normal, "dg-label", "middle"),
  );
}

function leadGroups(w) {
  const cells = [["I", "lateral"], ["aVR", "avr"], ["V1", "septal"], ["V4", "anterior"],
    ["II", "inferior"], ["aVL", "lateral"], ["V2", "septal"], ["V5", "lateral"],
    ["III", "inferior"], ["aVF", "inferior"], ["V3", "anterior"], ["V6", "lateral"]];
  const order = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]];
  // standard layout: columns I-II-III, aVR-aVL-aVF, V1-V3, V4-V6
  const layout = { I: [0, 0], II: [0, 1], III: [0, 2], aVR: [1, 0], aVL: [1, 1], aVF: [1, 2], V1: [2, 0], V2: [2, 1], V3: [2, 2], V4: [3, 0], V5: [3, 1], V6: [3, 2] };
  void order;
  return svg(560, 300, w.inferior,
    cells.map(([lead, g]) => {
      const [c, r] = layout[lead];
      return el("g", null,
        el("rect", { x: 10 + c * 135, y: 10 + r * 80, width: 125, height: 70, rx: 6, class: `dg-cell dg-${g}` }),
        text(72 + c * 135, 34 + r * 80, lead, "dg-wave", "middle"),
        text(72 + c * 135, 60 + r * 80, w[g], "dg-label dg-small", "middle"));
    }),
  );
}

function rate300(w) {
  const mm = 14;
  const x0 = 20;
  const y0 = 30;
  const cols = 35;
  const rows = 10;
  const base = y0 + 7 * mm;
  const rx = x0 + 5 * mm;
  const r = (x) => `M${x - 8} ${base}L${x - 4} ${base + 6}L${x} ${y0 + 1 * mm}L${x + 5} ${base + 14}L${x + 10} ${base}`;
  const labels = [300, 150, 100, 75, 60, 50];
  return svg(x0 * 2 + cols * mm, y0 + rows * mm + 60, w.big_boxes,
    grid(x0, y0, cols, rows, mm),
    el("path", { d: `M${x0} ${base}H${rx - 8}${r(rx).replace("M", "L")}H${x0 + cols * mm}`, class: "dg-trace" }),
    labels.map((n, i) => {
      const x = rx + (i + 1) * 5 * mm;
      return [el("line", { x1: x, y1: y0, x2: x, y2: y0 + rows * mm, class: "dg-mark" }),
        text(x, y0 - 12, String(n), "dg-wave dg-small", "middle")];
    }),
    text(x0, y0 + rows * mm + 22, `${w.rate}: 300 / ${w.big_boxes}`, "dg-label dg-small"),
  );
}

/* Right-sided V4R on the front of the chest; V7-V9 on the back, at the level of V6. */
function extraLeads(w) {
  const tag = (x, y, code) => el("g", { class: "dg-electrode" },
    el("circle", { cx: x, cy: y, r: 13, fill: IEC.C4, class: "dg-el" }),
    text(x, y + 0.5, code, "dg-el-code dg-el-light", "middle"));
  return svg(820, 600, w.same_level,
    text(200, 18, w.front, "dg-label", "middle"),
    el("g", { transform: "translate(0 20)" }, body([
      el("path", { d: "M200 95 V250", class: "dg-guide" }),
      el("path", { d: "M175 100 V300", class: "dg-guide" }),
      tag(175, 200, "V4R"),
    ])),
    text(610, 18, w.back, "dg-label", "middle"),
    // from behind the patient's left is on the viewer's left
    el("g", { transform: "translate(410 20)" }, body([
      el("path", { d: "M200 92 V300", class: "dg-spine" }),
      el("path", { d: "M152 120 L186 128 L178 196 Z M248 120 L214 128 L222 196 Z", class: "dg-body" }),
      el("path", { d: "M140 200 H200", class: "dg-guide" }),
      [["V7", 143], ["V8", 168], ["V9", 193]].map(([k, x]) => [
        el("circle", { cx: x, cy: 200, r: 7, fill: IEC.C4, class: "dg-el" }),
        text(x, 182, k, "dg-label dg-small", "middle")]),
    ])),
    text(410, 516, w.v4r, "dg-label dg-small", "middle"),
    text(410, 540, `${w.v7} · ${w.v8} · ${w.v9}`, "dg-label dg-small", "middle"),
    text(410, 564, w.same_level, "dg-label dg-small", "middle"),
  );
}

/* Defibrillation pad positions, and the distance from an implanted device. */
function pads(w) {
  const pad = (x, y, rot = 0) => el("rect", { x: x - 16, y: y - 24, width: 32, height: 48, rx: 6, class: "dg-pad", transform: rot ? `rotate(${rot} ${x} ${y})` : null });
  // the patient's left is on the viewer's right; the device sits below the left clavicle
  const device = () => el("rect", { x: 222, y: 108, width: 20, height: 14, rx: 4, class: "dg-device" });
  return svg(820, 620, w.device,
    text(200, 18, w.pads_al, "dg-label", "middle"),
    el("g", { transform: "translate(0 20)" }, body([pad(168, 130), pad(256, 210, -20), device()])),
    text(610, 18, w.pads_ap, "dg-label", "middle"),
    // the back pad (dashed) lies behind the heart, under the left scapula
    el("g", { transform: "translate(410 20)" }, body([
      el("rect", { x: 200, y: 150, width: 50, height: 72, rx: 8, class: "dg-pad dg-pad-back" }),
      pad(228, 188), device()])),
    text(200, 512, w.pad_r, "dg-label dg-small", "middle"),
    text(200, 534, w.pad_l, "dg-label dg-small", "middle"),
    text(610, 512, w.pad_front, "dg-label dg-small", "middle"),
    text(610, 534, w.pad_back, "dg-label dg-small", "middle"),
    text(410, 580, w.device, "dg-label", "middle"),
  );
}

/* AV blocks as schematic rhythm strips: P waves at a fixed rate, the PR of each conducted beat
   written under it, blocked P waves marked. Times in ms; not to a patient's scale. */
function avBlocks(w) {
  const X0 = 30;
  const PX = 0.14; // px per ms
  const DUR = 5400;
  const PP = 760;
  const ROW = 118;
  const bump = (t, c, half, h) => (Math.abs(t - c) < half ? h * Math.cos((Math.PI / 2) * (t - c) / half) ** 2 : 0);
  const qrs = (t, c, wide) => {
    const k = wide ? 1.7 : 1;
    const d = (t - c) / k;
    if (d < -40 || d > 50) return 0;
    if (d < -20) return -8 * (d + 40) / 20;
    if (d < 0) return -8 + 58 * (d + 20) / 20;
    if (d < 25) return 50 - 66 * d / 25;
    return -16 + 16 * (d - 25) / 25;
  };
  const strip = (y, ps, beats) => {
    const pts = [];
    for (let t = 0; t <= DUR; t += 5) {
      let v = 0;
      for (const p of ps) v += bump(t, p + 50, 50, 11);
      for (const b of beats) v += qrs(t, b.q + 40, b.wide) + bump(t, b.q + (b.wide ? 400 : 330), b.wide ? 120 : 100, b.wide ? -14 : 16);
      pts.push(`${(X0 + t * PX).toFixed(1)},${(y - v).toFixed(1)}`);
    }
    return el("polyline", { points: pts.join(" "), class: "dg-trace", fill: "none" });
  };
  const row = (i, title, prs, opts = {}) => {
    const y = 44 + i * ROW + 66;
    const ps = [];
    const beats = [];
    const marks = [];
    for (let k = 0, t = 120; t < DUR - 200; k++, t += PP) {
      ps.push(t);
      const pr = prs ? prs[k % prs.length] : null;
      if (pr) {
        beats.push({ q: t + pr });
        marks.push(text(X0 + (t + pr / 2) * PX, y + 30, String(pr), "dg-label dg-small", "middle"));
      } else if (opts.markP) {
        marks.push(text(X0 + (t + 50) * PX, y - 24, "P", "dg-label dg-small", "middle"));
      } else if (prs) {
        marks.push(el("path", { d: `M${X0 + (t + 50) * PX} ${y - 28}v10`, class: "dg-block-arrow" }),
          text(X0 + (t + 50) * PX, y - 36, w.blocked, "dg-label dg-small dg-blocked", "middle"));
      }
    }
    if (opts.escape) {
      for (let t = 600; t < DUR - 300; t += 1580) beats.push({ q: t, wide: true });
      marks.push(text(X0 + 600 * PX, y + 34, w.escape, "dg-label dg-small", "start"));
    }
    return [
      text(X0, y - 58, title, "dg-label", "start"),
      strip(y, ps, beats),
      marks,
    ];
  };
  const W = X0 * 2 + DUR * PX;
  return svg(W, 44 + 5 * ROW + 20, w.avb2a,
    row(0, w.avb1, [320]),
    row(1, w.avb2a, [200, 280, 330, null]),
    row(2, w.avb2b, [200, 200, 200, null]),
    row(3, w.avb21, [200, null]),
    row(4, w.avb3, null, { escape: true, markP: true }),
    text(X0, 22, `${w.schematic} · ${w.pr_ms}`, "dg-label dg-small", "start"),
  );
}

const FIGURES = { paper, beat, conduction, limb_leads: limbLeads, chest_leads: chestLeads, extra_leads: extraLeads, monitor, pads, hexaxial, lead_groups: leadGroups, rate300, av_blocks: avBlocks };

export const DIAGRAMS = Object.keys(FIGURES);

export function diagram(name, lang) {
  const f = FIGURES[name];
  if (!f) return null;
  return f(WORDS[lang] || WORDS.ro);
}
