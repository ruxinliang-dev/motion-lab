/* Colour room, a study after a "gradient exploration" by Clemens Mako (seen on Instagram): a corridor in one-point perspective,
   seen from low down, with an opening (the dark hole) that keeps growing towards the camera. The colour is one looping gradient
   laid along the corridor's depth: deeper in the hole the colours are further along the loop, and the whole of it flows out from
   the hole to the edges of the frame, so it reads as moving forward, endlessly, through rooms of colour.
   Measured from the reference video (read in the page, frame by frame): one loop of colour every 1.248 s; how far along the loop a
   point is = 0.59 × (1 − its rectangular distance from the vanishing point) ^ 1.4, the distance being 1 at the frame's top and
   sides; the floor is shallow, so the frame's bottom sits beyond it (1.2). Fitted on 48 points of three frames: mean error 13 of 255.
   Shape and colour are kept apart, as in the gradient study: the drawing makes one value per pixel (where along the loop) and
   PALETTE turns it into colour through a looping lookup table. TUNE holds the numbers she can drag.

     const s = RoomStudy.create(canvas); await s.ready; s.render(t);   // t in 0 - D s, loops
     s.setView(0 | 1);   // 0 colour, 1 the depth as grey */
(() => {
'use strict';
function create(cv) {
  const g = cv.getContext('2d'), D = 6.24;
  const BH = 270, buf = document.createElement('canvas'); let BW = 0, bg, img, px;
  const cl = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  /* ---- colour: all of it is here, read from the reference video ---- */
  const PALETTE = {
    /* four broad colours, her pick (2026-10-14): violet, magenta, pale pink, rose; a frame shows about three at a time */
    loop: [[204, 77, 255], [233, 92, 255], [255, 168, 239], [254, 154, 202]]
  };
  const LUT_N = 1200, lut = new Float32Array(LUT_N * 3);
  function buildLut() {
    const L = PALETTE.loop, n = L.length;
    for (let j = 0; j < LUT_N; j++) {
      const f = j / LUT_N * n, k = Math.floor(f), u = f - k, a = L[k % n], b = L[(k + 1) % n];
      /* a smooth, rounded path between the steps (Catmull-Rom), as the video's own gradient is */
      const p = L[(k - 1 + n) % n], q = L[(k + 2) % n], u2 = u * u, u3 = u2 * u;
      for (let c = 0; c < 3; c++) lut[j * 3 + c] = .5 * (2 * a[c] + (-p[c] + b[c]) * u + (2 * p[c] - 5 * a[c] + 4 * b[c] - q[c]) * u2 + (-p[c] + 3 * a[c] - 3 * b[c] + q[c]) * u3);
    }
  }
  buildLut();

  /* ---- the numbers she can drag ---- */
  const TUNE = {
    /* her tuned look (2026-10-14), from the Tune panel */
    loops: 3,          /* loops of colour in the study's 6.24 s (5 = the reference's speed); whole numbers keep it seamless */
    reach: .5,         /* how much of the loop is seen from the frame's edge to the far end of the hole */
    ease: .6,          /* how the colours bunch: above 1, slower near the edges and faster into the hole; below 1 the reverse */
    vpY: .87,          /* the vanishing point's height in the frame, 0 top, 1 bottom (fitted to the reference: .85) */
    floorReach: 1.1,   /* how far the frame's bottom reaches past the floor's edge (fitted to the reference: 1.2) */
    width: .535,       /* the corridor's half-width, in shares of the frame's height (the reference's square frame: .5) */
    corner: 20,        /* how sharp the corners where walls meet ceiling and floor are (higher, sharper) */
    centreRound: 4,    /* how round the hole is: 2 a circle, higher towards a rounded square */
    holeSize: .51,     /* how far out the hole stays round before it turns into the room's rectangle (0 - 1 of the way to the edge) */
    birth: .26,        /* where a new colour starts: a round disc this far out, with a firmer edge than the rest */
    birthEdge: .9,     /* how firm the new colour's edge is (0 soft as the rest, 1 a solid disc) */
    centreFlat: 1.8,   /* how flat the colour is at the very middle (1: a new colour starts as a point; higher: it fills the middle as a broad bloom) */     /* how far out the hole stays round before it turns into the room's rectangle (0 - 1 of the way to the edge) */
    soft: 6,           /* how soft every gradient is (a blur over the whole picture, in px of a 1080-tall frame) */
    sideBlur: 55,      /* depth of field: how out of focus the sides are (px of a 1080-tall frame) */
    zoomBlur: .2,      /* motion blur: how far the picture is smeared outwards from the opening, as it moves forward */
    blurFrom: .62,     /* where, from the middle (0) to the edges (1), the side blur and motion blur begin */
    grain: 3
  };
  const TUNE_SPEC = [
    ['loops', 'Loops per 6.24 s', 1, 10, 1], ['reach', 'Colour reach', .2, 1.2, .01], ['ease', 'Colour easing', .6, 2, .01],
    ['vpY', 'Vanishing point height', .4, .9, .005], ['floorReach', 'Floor depth', 1, 3, .01], ['width', 'Corridor width', .35, 1, .005],
    ['corner', 'Corner sharpness', 2, 20, .5], ['centreRound', 'Hole roundness (2 = circle)', 2, 8, .1], ['holeSize', 'Round hole reaches', .1, 1, .01], ['centreFlat', 'Middle bloom', 1, 4, .05], ['birth', 'New colour disc size', .02, .5, .005], ['birthEdge', 'New colour edge', 0, 1, .01], ['soft', 'Softness', 0, 30, .5], ['sideBlur', 'Side blur (depth of field)', 0, 60, 1], ['zoomBlur', 'Motion blur', 0, .2, .005], ['blurFrom', 'Blur starts at', 0, .9, .01], ['grain', 'Grain', 0, 3, .05]
  ].map(([key, label, min, max, step]) => ({ key, label, min, max, step }));
  const COLOUR_SPEC = PALETTE.loop.map((ref, k) => ({ label: `Loop ${k + 1}`, ref }));
  const TUNE0 = { ...TUNE }, COL0 = COLOUR_SPEC.map(c => [...c.ref]);
  let view = 0;

  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const gx = grain.getContext('2d'), gi = gx.createImageData(256, 256); let r = 1234567;
    for (let k = 0; k < gi.data.length; k += 4) { r = (r * 16807) % 2147483647; const u = r / 2147483647 - .5; gi.data[k] = gi.data[k + 1] = gi.data[k + 2] = u > 0 ? 255 : 0; gi.data[k + 3] = Math.abs(u) * 2 * 18; }
    gx.putImageData(gi, 0, 0); }
  let grainPat = null;
  const fx = document.createElement('canvas'), fc = fx.getContext('2d'), mk = document.createElement('canvas'), mc = mk.getContext('2d');
  const hash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };

  function render(t) {
    t = ((t % D) + D) % D;
    const w = Math.max(1, Math.round(BH * cv.width / cv.height));   /* the sheet follows the canvas's shape */
    if (w !== BW) { BW = w; buf.width = BW; buf.height = BH; bg = buf.getContext('2d'); img = bg.createImageData(BW, BH); px = img.data; }
    const T = TUNE, p = T.corner, phase = t / D * T.loops, up = T.vpY, down = (1 - T.vpY) / T.floorReach, half = T.width;
    let o = 0;
    for (let y = 0; y < BH; y++) {
      const fy = (y + .5) / BH, dy = fy - up, ry = dy < 0 ? -dy / up : dy / down;   /* distance up to the ceiling's edge, or down to the floor's */
      for (let x = 0; x < BW; x++) {
        const dx = ((x + .5) / BW - .5) * BW / BH, rx = Math.abs(dx) / half;
        /* the rectangular distance from the vanishing point, its corners a touch rounded */
        /* near the vanishing point the corners round off into a soft square, so the far end is a square glow, not a star of
           crossing corner lines; further out they sharpen into the room's corners */
        /* round in the middle, the room's rectangle further out. The two distances are blended over the whole way out from the
           vanishing point (not over a short span), so along any line from the middle the distance only grows: a short, steep blend
           folded the contours back on themselves and left stray shapes (wings) above the hole */
        const R0 = Math.min(half, up), iso = Math.hypot(dx, dy > 0 ? dy * R0 / down : dy) / R0,   /* below the vanishing point the circle is squashed to the floor, so the floor stays flat */
          rr = Math.pow(Math.pow(rx, p) + Math.pow(ry, p), 1 / p);
        const rnd = Math.pow(2 / T.centreRound, .5);   /* hole roundness: 2 keeps the full circle, higher lets the room's shape in sooner */
        const r = iso + (rr - iso) * sm(0, T.holeSize / rnd, iso);
        /* ---- shape: where along the loop this point is ---- */
        const u = 1 - Math.pow(r, T.centreFlat), depth = T.reach * Math.sign(u) * Math.pow(Math.abs(u), T.ease);   /* flat at the very middle: a new colour blooms over the whole centre instead of starting as a dot */
        let k = phase + depth;
        /* where the colours start (the middle), each colour change is firmer: the loop holds each colour and steps to the next
           over a short span, so a new colour appears as a solid round disc; further out it eases back to the soft blend */
        const firm = T.birthEdge * (1 - sm(T.birth * .5, T.birth * 2.2, r));
        if (firm > 0) { const n = PALETTE.loop.length, f = k * n, fi = Math.floor(f), fr = f - fi; k = (fi + fr + (sm(.42, .58, fr) - fr) * firm) / n; }
        const w01 = k - Math.floor(k);
        if (view === 1) { const v = w01 * 255; px[o++] = v; px[o++] = v; px[o++] = v; px[o++] = 255; continue; }
        /* ---- colour: through the looping PALETTE ---- */
        const j = ((w01 * LUT_N) | 0) % LUT_N * 3;
        px[o++] = lut[j]; px[o++] = lut[j + 1]; px[o++] = lut[j + 2]; px[o++] = 255;
      }
    }
    bg.putImageData(img, 0, 0);
    const W = cv.width, H = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const k = H / 1080;
    g.filter = `blur(${(T.soft * k).toFixed(1)}px)`; g.drawImage(buf, 0, 0, W, H); g.filter = 'none';
    /* the sides: a copy smeared outwards from the vanishing point (moving forward) and out of focus, laid over the picture only
       towards the edges, through a soft mask centred on the vanishing point */
    if (T.sideBlur > 0 || T.zoomBlur > 0) {
      if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; mk.width = W; mk.height = H; }
      const vx = W / 2, vy = H * T.vpY, n = 8;
      fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalCompositeOperation = 'source-over'; fc.globalAlpha = 1; fc.filter = 'none'; fc.clearRect(0, 0, W, H);
      fc.filter = `blur(${(T.sideBlur * k).toFixed(1)}px)`;
      for (let i = 0; i < n; i++) {   /* a running average of copies scaled up round the vanishing point */
        const sc = 1 + T.zoomBlur * i / (n - 1);
        fc.globalAlpha = 1 / (i + 1); fc.setTransform(sc, 0, 0, sc, vx * (1 - sc), vy * (1 - sc)); fc.drawImage(cv, 0, 0);
      }
      fc.setTransform(1, 0, 0, 1, 0, 0); fc.filter = 'none'; fc.globalAlpha = 1;
      /* the mask: nothing round the opening, full towards the edges (an ellipse matched to the frame, smoothstepped) */
      mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, W, H);
      const R = Math.hypot(Math.max(vx, W - vx), Math.max(vy, H - vy)), gr = mc.createRadialGradient(vx, vy, 0, vx, vy, R);
      for (let j = 0; j <= 12; j++) { const u = j / 12, f = T.blurFrom + (1 - T.blurFrom) * u * .8, a = u * u * (3 - 2 * u); gr.addColorStop(f, `rgba(0,0,0,${a.toFixed(3)})`); }
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      mc.fillStyle = gr; mc.fillRect(0, 0, W, H);
      fc.globalCompositeOperation = 'destination-in'; fc.drawImage(mk, 0, 0); fc.globalCompositeOperation = 'source-over';
      g.drawImage(fx, 0, 0);
    }
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
window.RoomStudy = { create };
})();
