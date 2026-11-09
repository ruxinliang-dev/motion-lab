/* Colour field, a study matched to a still she gave (a portrait card of light): a deep blue frame, a thin violet-pink rim, then
   coral and red-orange falling into a warm orange field; the bottom glows yellow, the left edge carries a yellow-orange band, the
   right edge runs red, the top deepens to red-orange. Heavy film grain, as in the still.
   The card is portrait (4 : 5), full height in the middle of the frame; the blue runs out to the sides.
   Shape and colour are kept apart: the drawing makes grey values (how far in from the card's rounded edge, and how near each
   side), and PALETTE turns them into colour. TUNE holds the numbers she can drag. Effects: the side lights breathe and drift a
   little round the card, a slow shimmer in the field, grain.

     const s = FieldStudy.create(canvas); await s.ready; s.render(t);   // t in 0 - D s, loops
     s.setView(0 | 1);   // 0 colour, 1 the depth as grey */
(() => {
'use strict';
function create(cv) {
  const g = cv.getContext('2d'), D = 12, TAU = Math.PI * 2;
  const BH = 300, buf = document.createElement('canvas'); let BW = 0, bg, img, px;
  const cl = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  /* ---- colour: all of it is here, fitted to her still pixel by pixel (about 8000 points, mean error 11.6 of 255) ---- */
  const PALETTE = {
    ramp: [[0, [52, 68, 186]],   /* the deep blue frame */
           [.012, [117, 94, 190]],    /* blue-violet */
           [.0205, [178, 106, 218]],  /* violet */
           [.0215, [246, 85, 154]],   /* hot pink rim */
           [.046, [251, 86, 90]],     /* pink-coral */
           [.099, [252, 81, 15]],     /* red-orange */
           [.127, [253, 133, 2]],     /* the orange field */
           [1, [249, 145, 0]]],   /* the middle */
    top: [252, 66, 12],      /* the top deepens to red-orange */
    bottom: [252, 194, 0],  /* the bottom glows yellow */
    left: [252, 156, 1],    /* the left edge's yellow-orange band */
    right: [252, 40, 38]    /* the right edge runs red */
  };
  /* ---- the colour of the hour: the still above is the day; the card turns through sunset and night to dawn and back ----
     each state has the same parts as the day (frame and rim ramp, and the four side lights) */
  const HOURS = {
    dusk:  { ramp: [[44, 40, 140], [96, 60, 170], [150, 70, 200], [236, 72, 170], [248, 74, 120], [245, 70, 80], [240, 96, 110], [236, 112, 132]],
             top: [214, 52, 120], bottom: [255, 150, 64], left: [250, 122, 140], right: [192, 40, 112] },
    night: { ramp: [[12, 16, 56], [28, 32, 98], [58, 46, 146], [108, 58, 188], [88, 66, 198], [70, 60, 190], [58, 70, 178], [68, 88, 190]],
             top: [120, 62, 200], bottom: [62, 122, 212], left: [92, 92, 222], right: [142, 52, 172] },
    dawn:  { ramp: [[70, 90, 172], [140, 120, 200], [200, 140, 212], [250, 150, 172], [252, 170, 142], [252, 180, 112], [253, 200, 142], [252, 214, 162]],
             top: [250, 150, 152], bottom: [255, 220, 122], left: [255, 200, 152], right: [240, 122, 142] }
  };
  /* ---- other palettes on the same logic: a frame hue set against the card's, a bridge hue between them at the rim, three colours or so
     a frame; each has the day's parts (the rim ramp's eight colours and the four side lights). TUNE.palette picks one; 0 is PALETTE above,
     the one the colour pickers edit */
  const PRESETS = [null,
    /* B deep violet neon: magenta outside, cyan inside */
    { ramp: [[42, 20, 88], [96, 44, 160], [176, 124, 255], [255, 62, 165], [230, 70, 190], [150, 90, 235], [70, 190, 250], [57, 230, 255]],
      top: [255, 62, 165], bottom: [150, 250, 255], left: [100, 220, 255], right: [200, 40, 160] },
    /* C forest and lemon: bottle green, a young green bridge, orange to lemon */
    { ramp: [[15, 77, 58], [70, 130, 70], [184, 240, 107], [230, 240, 90], [255, 170, 50], [255, 138, 31], [250, 190, 50], [247, 225, 75]],
      top: [255, 120, 20], bottom: [250, 240, 120], left: [247, 225, 75], right: [255, 100, 30] },
    /* D mint and coral: teal, a pale apricot bridge, coral to cream */
    { ramp: [[31, 127, 134], [120, 170, 160], [255, 194, 168], [255, 140, 140], [255, 111, 125], [255, 150, 140], [255, 210, 160], [255, 227, 163]],
      top: [255, 111, 125], bottom: [255, 235, 180], left: [255, 200, 150], right: [255, 90, 110] },
    /* E ice blue, all one family: deep blue, violet, ice blue to near white */
    { ramp: [[27, 45, 184], [70, 70, 220], [122, 107, 255], [140, 150, 255], [130, 190, 255], [159, 216, 255], [200, 232, 255], [234, 246, 255]],
      top: [120, 140, 255], bottom: [234, 246, 255], left: [190, 230, 255], right: [110, 110, 240] },
    /* F black neon: near black, a deep red bridge (kept bright enough that it glows rather than outlines), red to orange, a light box */
    { ramp: [[12, 12, 16], [110, 18, 38], [200, 28, 48], [240, 38, 50], [255, 46, 46], [255, 80, 30], [255, 140, 30], [255, 154, 31]],
      top: [255, 40, 30], bottom: [255, 190, 40], left: [255, 160, 30], right: [230, 20, 40] }
  ];
  /* this frame's colours (CUR): the day (PALETTE, which the Tune panel edits, or a preset) blended through the hours */
  const CUR = { ramp: PALETTE.ramp.map(([x, c]) => [x, [...c]]), top: [...PALETTE.top], bottom: [...PALETTE.bottom], left: [...PALETTE.left], right: [...PALETTE.right] };
  const day = () => PRESETS[TUNE.palette | 0] || ({ ramp: PALETTE.ramp.map(r => r[1]), top: PALETTE.top, bottom: PALETTE.bottom, left: PALETTE.left, right: PALETTE.right });
  function hourAt(t) {   /* which two states, and how far between: each state holds, then turns smoothly into the next */
    const keys = [day(), HOURS.dusk, HOURS.night, HOURS.dawn], n = keys.length, f = (t / D) * n, k = Math.floor(f) % n, u = f - Math.floor(f);
    const hold = TUNE.hold, e = u < hold ? 0 : (() => { const v = (u - hold) / (1 - hold); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; })();
    return [keys[k], keys[(k + 1) % n], TUNE.cycle ? e : 0, TUNE.cycle ? k : 0];
  }
  function setHour(t) {
    let [a, b, e, k] = hourAt(t); if (!TUNE.cycle) { a = b = day(); e = 0; }
    const lerp3 = (out, p, q) => { out[0] = p[0] + (q[0] - p[0]) * e; out[1] = p[1] + (q[1] - p[1]) * e; out[2] = p[2] + (q[2] - p[2]) * e; };
    CUR.ramp.forEach((r, i) => { r[0] = PALETTE.ramp[i][0]; lerp3(r[1], a.ramp[i], b.ramp[i]); });
    ['top', 'bottom', 'left', 'right'].forEach(s => lerp3(CUR[s], a[s], b[s]));
  }
  const LUT_N = 1024, lut = new Float32Array(LUT_N * 3);
  function buildLut() {
    const R = CUR.ramp;
    for (let j = 0; j < LUT_N; j++) {
      const x = j / (LUT_N - 1); let k = 1; while (k < R.length - 1 && R[k][0] < x) k++;
      const [x0, c0] = R[k - 1], [x1, c1] = R[k], u = x1 > x0 ? cl((x - x0) / (x1 - x0)) : 1, e = u * u * (3 - 2 * u);   /* (two stops at one place: a step) */
      for (let c = 0; c < 3; c++) lut[j * 3 + c] = c0[c] + (c1[c] - c0[c]) * e;
    }
  }
  buildLut();   /* (CUR starts as the day) */

  /* ---- the numbers she can drag (depths are shares of the card's width); fitted to her still on 44 sampled points ---- */
  const TUNE = {
    aspect: .805,      /* the card's width over its height (her still: 1215 × 1509) */
    radius: .133,        /* the card's corner radius (her note: squarer corners) */
    depth: 1.616,          /* scales how deep the rim and bands reach in */
    topAmt: 1.491, topAt: .144, topW: .059,          /* the red-orange at the top: strength, depth, width */
    bottomAmt: 1.2, bottomAt: .075, bottomW: .047, /* the yellow at the bottom */
    leftAmt: 1.889, leftAt: .128, leftW: .053,        /* the yellow-orange band on the left */
    rightAmt: 1.727, rightAt: .065, rightW: .018,     /* the red on the right */
    bottomRim: .898,    /* the bottom rim's depth against the others' (her crop of the bottom: about .4) */
    blend: .043,        /* how gradually the band's colour passes from one side to the next round the corners */
    cycle: 0,          /* the hours turn (1) or the card stays in daylight (0) */
    palette: 0,        /* 0 the still's (PALETTE), 1 deep violet neon, 2 forest lemon, 3 mint coral, 4 ice blue, 5 black neon */
    shape: 0,          /* 0 card (the still), 1 circle, 2 arch, 3 pill, 4 diamond */
    orbit: 1,          /* the side lights travel round the card: whole turns per loop (0 = still), negative turns the other way */
    hold: .35,         /* how long each hour holds before it turns into the next, a share of its quarter of the loop */
    fill: 1,           /* the card's height against the frame's (16:9) */
    fillW: .84,        /* the card's width against the frame's, in a narrow frame such as 9:16, leaving blue at the sides for the glow */
    spill: .6,         /* how much of the card's light spills out into the blue */
    spillW: .11,       /* how far it reaches, a share of the card's width */
    spillHue: .45,     /* its colour: 0 the pink rim, 1 the nearest side's light */
    vignette: .22,     /* the blue darkening towards the frame's edges */
    soft: 7.801,          /* how soft it all is (px of a 1080-tall frame) */
    breathe: .15,      /* the side lights breathing over the loop */
    drift: .03,        /* the side lights drifting round the card */
    shimmer: .04,      /* a slow shimmer in the field */
    grain: 2.4
  };
  const TUNE_SPEC = [
    ['aspect', 'Card shape (width / height)', .5, 1.78, .005], ['radius', 'Corner radius', 0, .3, .005], ['depth', 'Rim depth', .4, 2, .01],
    ['topAmt', 'Top red', 0, 2, .01], ['topAt', 'Top red depth', 0, .4, .005], ['topW', 'Top red width', .01, .25, .005],
    ['bottomAmt', 'Bottom yellow', 0, 2, .01], ['bottomAt', 'Bottom yellow depth', 0, .4, .005], ['bottomW', 'Bottom yellow width', .01, .25, .005],
    ['leftAmt', 'Left band', 0, 2, .01], ['leftAt', 'Left band depth', 0, .4, .005], ['leftW', 'Left band width', .01, .25, .005],
    ['rightAmt', 'Right red', 0, 2, .01], ['rightAt', 'Right red depth', 0, .4, .005], ['rightW', 'Right red width', .01, .25, .005],
    ['bottomRim', 'Bottom rim depth', .2, 1.5, .01], ['blend', 'Corner blend', .01, .2, .005], ['palette', 'Palette (A still, B neon, C lemon, D coral, E ice, F black)', 0, 5, 1], ['shape', 'Shape (card, circle, arch, pill, diamond)', 0, 4, 1], ['orbit', 'Light orbit (turns per loop)', -2, 2, 1], ['cycle', 'Day to night (on/off)', 0, 1, 1], ['hold', 'Hold each hour', 0, .8, .01], ['fill', 'Card height', .5, 1, .005], ['fillW', 'Card width (9:16)', .5, 1, .005], ['spill', 'Light spill', 0, 1, .01], ['spillW', 'Spill reach', .01, .3, .005], ['spillHue', 'Spill colour (rim → side)', 0, 1, .01], ['vignette', 'Outer darkening', 0, .6, .01], ['soft', 'Softness', 0, 40, .5], ['breathe', 'Breathing', 0, .5, .01], ['drift', 'Drift', 0, .1, .002], ['shimmer', 'Shimmer', 0, .2, .005], ['grain', 'Grain', 0, 4, .05]
  ].map(([key, label, min, max, step]) => ({ key, label, min, max, step }))
   /* the panel shows only these (her note: too many settings); the rest keep their fitted values here and still load from her saved tune */
   .filter(sp => ['palette', 'shape', 'orbit', 'cycle', 'radius', 'depth', 'fillW', 'spill', 'soft', 'breathe', 'grain'].includes(sp.key))
   .sort((a, b) => ['palette', 'shape', 'orbit', 'cycle', 'radius', 'depth', 'fillW', 'spill', 'soft', 'breathe', 'grain'].indexOf(a.key) - ['palette', 'shape', 'orbit', 'cycle', 'radius', 'depth', 'fillW', 'spill', 'soft', 'breathe', 'grain'].indexOf(b.key));
  const COLOUR_SPEC = PALETTE.ramp.slice(0, 6).map((s, k) => ({ label: ['Frame blue', 'Violet', 'Pink rim', 'Coral', 'Red-orange', 'Orange field'][k], ref: s[1] }))
    .concat([['Top', 'top'], ['Bottom', 'bottom'], ['Left band', 'left'], ['Right', 'right']].map(([label, k]) => ({ label, ref: PALETTE[k] })))
    .map(c => ({ ...c, hidden: !['Frame blue', 'Pink rim', 'Orange field'].includes(c.label) }));   /* the panel shows palette A's three main colours (all stay in place, saved by position) */
  const TUNE0 = { ...TUNE }, COL0 = COLOUR_SPEC.map(c => [...c.ref]);
  let view = 0;

  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const gx = grain.getContext('2d'), gi = gx.createImageData(256, 256); let r = 1234567;
    for (let k = 0; k < gi.data.length; k += 4) { r = (r * 16807) % 2147483647; const u = r / 2147483647 - .5; gi.data[k] = gi.data[k + 1] = gi.data[k + 2] = u > 0 ? 255 : 0; gi.data[k + 3] = Math.abs(u) * 2 * 22; }
    gx.putImageData(gi, 0, 0); }
  let grainPat = null;
  const hash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
  const C = [0, 0, 0], mixI = (a, b, u) => { a[0] += (b[0] - a[0]) * u; a[1] += (b[1] - a[1]) * u; a[2] += (b[2] - a[2]) * u; };
  const band = (d, at, w) => Math.exp(-Math.pow((d - at) / w, 2));

  function render(t) {
    t = ((t % D) + D) % D;
    const w = Math.max(1, Math.round(BH * cv.width / cv.height));
    if (w !== BW) { BW = w; buf.width = BW; buf.height = BH; bg = buf.getContext('2d'); img = bg.createImageData(BW, BH); px = img.data; }
    const T = TUNE, ph = TAU * t / D, ch = Math.min(BH * T.fill, BW * T.fillW / T.aspect), cw = T.aspect * ch, x0 = (BW - cw) / 2, y0 = (BH - ch) / 2,   /* the card fits the frame either way: full height in 16:9, inside the width in 9:16 */
           R = T.radius * cw, dep = T.depth;
    /* the side lights breathe (each on its own phase) and drift a little along their side */
    const br = k => 1 + T.breathe * Math.sin(ph + k * 1.7), dr = k => T.drift * Math.sin(ph + k * 2.3);
    setHour(t); buildLut();
    const TOP = CUR.top, BOT = CUR.bottom, LEF = CUR.left, RIG = CUR.right;
    /* the four side lights as keys round the card (top, right, bottom, left) and the orbit's turn this frame */
    const KEYS = [[TOP, T.topAt, T.topW, T.topAmt * br(0)], [RIG, T.rightAt, T.rightW, T.rightAmt * br(3)], [BOT, T.bottomAt, T.bottomW, T.bottomAmt * br(1)], [LEF, T.leftAt, T.leftW, T.leftAmt * br(2)]];
    const OB = T.orbit * t / D;   /* whole turns over the loop, clockwise */
    const LA = { c: [0, 0, 0], at: 0, wd: 0, amt: 0 };
    function lightAt(ang) {   /* ang: the angle round the card's centre (screen: −π/2 the top, 0 the right) */
      let q = (ang + Math.PI / 2) / TAU - OB; q -= Math.floor(q);   /* 0 top, .25 right, .5 bottom, .75 left, minus the turn */
      const f = q * 4, k = Math.floor(f) % 4, u = f - Math.floor(f), e = u * u * (3 - 2 * u), A = KEYS[k], B = KEYS[(k + 1) % 4];
      for (let c = 0; c < 3; c++) LA.c[c] = A[0][c] + (B[0][c] - A[0][c]) * e;
      LA.at = A[1] + (B[1] - A[1]) * e; LA.wd = A[2] + (B[2] - A[2]) * e; LA.amt = A[3] + (B[3] - A[3]) * e;
    }
    let o = 0;
    for (let y = 0; y < BH; y++) {
      const dy0 = (y + .5), dyT = dy0 - y0, dyB = y0 + ch - dy0;
      for (let x = 0; x < BW; x++) {
        const dxL = x + .5 - x0, dxR = x0 + cw - (x + .5);
        /* ---- shape: grey values only ---- */
        /* depth in from the card's rounded edge, a share of its width (negative outside it) */
        const ex = Math.min(dxL, dxR), ey = Math.min(dyT, dyB / T.bottomRim);   /* the bottom's rim is thinner: yellow runs nearly to the edge */
        let dpx = ex < R && ey < R ? R - Math.hypot(R - ex, R - ey) : Math.min(ex, ey);
        /* other shapes, the same light: depth in from the shape's edge (px), the card's box as their frame */
        const SH = T.shape | 0; let dmD = null;
        if (SH) {
          const qx = x + .5 - (x0 + cw / 2), qy = dy0 - (y0 + ch / 2), r0 = cw / 2;
          if (SH === 1) dpx = r0 - Math.hypot(qx, qy);                                              /* circle */
          else if (SH === 2) { const cyA = y0 + r0 - (y0 + ch / 2);                                  /* arch: round top, flat bottom */
            dpx = qy < cyA ? r0 - Math.hypot(qx, qy - cyA) : Math.min(r0 - Math.abs(qx), (ch / 2 - qy) / T.bottomRim); }
          else if (SH === 3) { const h = ch / 2 - r0, sy = Math.max(-h, Math.min(h, qy)); dpx = r0 - Math.hypot(qx, qy - sy); }   /* pill */
          else {                                                                                        /* diamond: the exact distance to it */
            const a = cw / 2, b = ch / 2, ax = Math.abs(qx), ay = Math.abs(qy), hh = Math.max(-1, Math.min(1, (-2 * (ax * a - ay * b) + a * a - b * b) / (a * a + b * b)));
            dpx = -Math.hypot(ax - .5 * a * (1 - hh), ay - .5 * b * (1 + hh)) * Math.sign(ax * b + ay * a - a * b);
            /* inside, its four edges blended softly (as the card's sides are), so the light has no crease along the diagonals */
            const L = Math.hypot(a, b), tau = T.blend * cw * dep, e = sx => Math.exp(-(a * b - (sx[0] * qx * b + sx[1] * qy * a)) / L / tau);
            /* its depth scaled up to the card's (its middle is only a b / L deep, the card's cw / 2), so the light band keeps the card's proportion */
            if (dpx > 0) dmD = -tau * Math.log(e([1, 1]) + e([1, -1]) + e([-1, 1]) + e([-1, -1])) / cw / dep * (a * L / (a * b));
          }
        }
        const d = dpx / cw / dep;
        if (view === 1) { const v = cl(d * 3) * 255; px[o++] = v; px[o++] = v; px[o++] = v; px[o++] = 255; continue; }
        /* ---- colour: through PALETTE ---- */
        const j = ((cl(d) * (LUT_N - 1)) | 0) * 3; C[0] = lut[j]; C[1] = lut[j + 1]; C[2] = lut[j + 2];
        if (d > 0) {
          /* each side's light, by how near that side is (its own depth), soft at the corners where two sides meet */
          const sT = dyT / cw / dep, sB = dyB / cw / dep, sL = dxL / cw / dep, sR = dxR / cw / dep, fx = (x + .5 - x0) / cw, fy = dyT / ch;
          /* one band of light running round the card, its colour, depth, width and strength passing smoothly from side to side
             (each side weighted by how near it is), so the top's red runs on down the right and the left's yellow runs into the
             bottom, as in the still, with no seam or gap at the corners */
          const tau = T.blend, eT = Math.exp(-sT / tau) * (1 + dr(0) * Math.sin(fx * 6)), eB = Math.exp(-sB / tau) * (1 + dr(1) * Math.sin(fx * 6 + 1)),
                eL = Math.exp(-sL / tau) * (1 + dr(2) * Math.sin(fy * 6 + 2)), eR = Math.exp(-sR / tau) * (1 + dr(3) * Math.sin(fy * 6 + 3)), es = eT + eB + eL + eR;
          const wT = eT / es, wB = eB / es, wL = eL / es, wR = eR / es, dm = SH ? (dmD !== null ? dmD : d) : -tau * Math.log(es);   /* (other shapes: their own depth) */   /* dm: the smooth nearest depth */
          /* the light's colour, depth, width and strength come from where round the card this point is, turned by the orbit (OB), so
             the top's red and the left's yellow travel round the card together; with the orbit off it is the still's layout */
          lightAt(Math.atan2(dyT / ch - .5, dxL / cw - .5));
          const amt = cl(LA.amt) * band(dm, LA.at, LA.wd);
          if (amt > 0) { C[0] += (LA.c[0] - C[0]) * amt; C[1] += (LA.c[1] - C[1]) * amt; C[2] += (LA.c[2] - C[2]) * amt; }
          /* a slow shimmer in the field: a soft warm-to-hot swell crossing it */
          const sh = T.shimmer * Math.sin(ph + fx * 3.1 + fy * 2.3) * sm(.1, .3, d);
          C[1] = C[1] * (1 + sh);
        } else if (T.spill > 0) {
          /* outside the card: its light spills out into the blue, the colour of the nearest side's light warmed towards the pink rim,
             fading with distance, so the card glows rather than sitting on a flat blue */
          const oT = Math.max(0, dyT) / cw, oB = Math.max(0, dyB) / cw, oL = Math.max(0, dxL) / cw, oR = Math.max(0, dxR) / cw, tau = T.blend;
          const eT = Math.exp(-oT / tau), eB = Math.exp(-oB / tau), eL = Math.exp(-oL / tau), eR = Math.exp(-oR / tau), es = eT + eB + eL + eR;
          lightAt(Math.atan2(dyT / ch - .5, dxL / cw - .5)); const RIM = CUR.ramp[3][1], hue = T.spillHue, k0 = LA.c[0], k1 = LA.c[1], k2 = LA.c[2];
          const gc0 = RIM[0] + (k0 - RIM[0]) * hue, gc1 = RIM[1] + (k1 - RIM[1]) * hue, gc2 = RIM[2] + (k2 - RIM[2]) * hue;
          const a = T.spill * (1 + .5 * T.breathe * Math.sin(ph)) * Math.exp(d * dep / T.spillW);   /* d is negative out here */
          C[0] += (gc0 - C[0]) * a; C[1] += (gc1 - C[1]) * a; C[2] += (gc2 - C[2]) * a;
          /* and the blue darkens a little towards the frame's edges, so the eye comes back to the card */
          const fxx = (x + .5) / BW - .5, fyy = (y + .5) / BH - .5, vg = T.vignette * sm(.25, .75, Math.hypot(fxx * BW / BH * .7, fyy));
          C[0] *= 1 - vg; C[1] *= 1 - vg; C[2] *= 1 - vg;
        }
        px[o++] = C[0]; px[o++] = C[1]; px[o++] = C[2]; px[o++] = 255;
      }
    }
    bg.putImageData(img, 0, 0);
    const W = cv.width, H = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.filter = `blur(${(T.soft * H / 1080).toFixed(1)}px)`; g.drawImage(buf, 0, 0, W, H); g.filter = 'none';
    if (T.grain > 0 && !view) {
      if (!grainPat) grainPat = g.createPattern(grain, 'repeat');
      const fr = Math.round(t * 60), ox = Math.floor(hash(fr, 1) * 256), oy = Math.floor(hash(fr, 2) * 256);
      g.save(); g.globalAlpha = Math.min(1, .5 * T.grain); g.translate(-ox, -oy); g.fillStyle = grainPat; g.fillRect(0, 0, W + 256, H + 256); g.restore();
    }
  }
  const VIEWS = ['colour', 'depth (grey)'];
  function setView(n) { view = ((n % VIEWS.length) + VIEWS.length) % VIEWS.length; return VIEWS[view]; }
  function resetTune() { Object.assign(TUNE, TUNE0); COLOUR_SPEC.forEach((c, k) => { c.ref[0] = COL0[k][0]; c.ref[1] = COL0[k][1]; c.ref[2] = COL0[k][2]; }); buildLut(); }
  return { render, ready: Promise.resolve(), D, palette: PALETTE, buildLut, setView, get view() { return view; },
           tune: TUNE, tuneSpec: TUNE_SPEC, colourSpec: COLOUR_SPEC, tuneDefaults: TUNE0, colourDefaults: COL0, resetTune };
}
window.FieldStudy = { create };
})();
