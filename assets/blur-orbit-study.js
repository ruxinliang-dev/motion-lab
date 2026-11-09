/* Blur orbit, a study after the "9" of a Cavalry experiment by Antonin Waterkeyn: one white numeral, a 2 in Quicksand 700 (her
   pick), on a blue gradient, in portrait (4 : 5), and a very soft mask that goes round the picture once every five seconds, left,
   above, right, below, and back to the left, so the loop is seamless. Only the numeral is blurred, by how much the mask says:
   copies of it from sharp to very soft, each weighted by the mask so the shares add up to one, added on a clear sheet, then lifted
   where the mask is so the blurred part glows. The ground is untouched. The sharp copies are drawn at the resolution the frame is
   shown at, the soft ones at a half or a quarter of it, where nobody can tell, so it plays in real time.

   Colour lives in PALETTE, the numbers she can drag in TUNE (the parts page's Tune panel); the drawing reads both every frame.

     const s = BlurOrbit.create(canvas, { weight, text }); await s.ready; s.render(t);   // t in 0 - 5 s, loops */
(() => {
'use strict';
function create(cv, opts = {}) {
  /* opts.weight: the blurred side of the 2 is bolder: each blur level is drawn at its own weight (Quicksand is variable), from 400 on
     the sharp side to 700 where it is softest, so the weight follows the mask round the numeral */
  let WGT = 700;
  const g = cv.getContext('2d'), D = 5, TAU = Math.PI * 2;
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)), rgb = c => `rgb(${c.map(Math.round)})`, rgba = (c, a) => `rgba(${c.map(Math.round)},${a})`;
  /* ---- colour: all of it is here ---- */
  const PALETTE = {
    groundTop: hex('#0b3cff'), groundMid: hex('#0419f6'), groundDeep: hex('#0208d8'),   /* the deep electric blue, lighter at the top left */
    side: [60, 130, 255], sideOuter: [40, 100, 255],                                          /* the soft lighter blue on the right */
    glowCore: [18, 176, 255], glowMid: [8, 156, 255], glowEdge: [0, 120, 255],              /* the saturated cyan-blue round the blur */
    tint1: [86, 205, 255], tint2: [64, 184, 255], tint3: [100, 222, 255],                   /* the haze colours, drifting with the mask */
    numeral: [255, 255, 255]
  };
  /* ---- the numbers she can drag ---- */
  const TUNE = {
    size: opts.text && opts.text.length > 1 ? 880 : 1250,   /* the numeral's size (px of the 1350-tall frame) */
    tracking: opts.text && opts.text.length > 1 ? -.04 : 0,  /* letter spacing, a fraction of the size */
    wMin: opts.weight ? 400 : 700, wMax: 700, wCurve: 2.2,      /* weight on the sharp side, on the softest side, and how it ramps */
    even: .52,          /* how much of the numeral is blurred, averaged */
    orbit: .58,         /* the mask's path, how far out from the middle */
    glow: .95, haze: .75, tintIn: .35,
    round: opts.weight ? .007 : 0,   /* a thin round-joined outline round each glyph, as a share of its size: it rounds the font's cut corners */
    smear: opts.weight ? 2 : 1,        /* the mask drawn out along its path (1 a circle): a long, liquid wipe instead of a round disc */
    trail: opts.weight ? .28 : 0,      /* how far the wipe trails behind where the mask is going, a share of its reach */
    sway: opts.weight ? .18 : 0,       /* how much the wipe's length and angle breathe as it goes, so it reads as liquid */
    maskEdge: opts.weight ? 1.15 : 1.6,  /* the mask's falloff: lower, a softer, hazier edge */
    glowEven: opts.weight ? 1 : 0,   /* 0: a bright core where the mask is; 1: one even wash with no hot spot */
    glowSize: opts.weight ? 2700 : 1900, glowPush: opts.weight ? 1 : 1.4,   /* how wide the glow is, and how far it is pushed out towards the mask */
    hazeEven: opts.weight ? 1 : 0   /* the haze colour: a core at the mask (0) or even (1) */   /* the cyan-blue glow round it, the liquid haze, the colour reaching into the numeral */
  };
  const TUNE_SPEC = [
    ['size', 'Numeral size', 500, 1400, 10], ['tracking', 'Letter spacing', -.15, .15, .005],
    ['wMin', 'Weight, sharp side', 300, 700, 10], ['wMax', 'Weight, softest side', 300, 700, 10], ['wCurve', 'Weight ramp', .5, 4, .05],
    ['even', 'Blur amount', .25, .8, .01], ['orbit', 'Mask path', .35, .8, .01],
    ['glow', 'Glow', 0, 1, .01], ['haze', 'Liquid haze', 0, 1, .01], ['tintIn', 'Colour in the numeral', 0, .8, .01],
    ['round', 'Corner rounding', 0, .03, .0005], ['smear', 'Mask smear (1 = circle)', 1, 4, .05], ['trail', 'Mask trail', 0, .8, .01], ['sway', 'Mask sway', 0, .5, .01], ['maskEdge', 'Mask edge softness', .6, 2.5, .05], ['glowEven', 'Glow evenness', 0, 1, .01], ['glowSize', 'Glow size', 1200, 3600, 10], ['glowPush', 'Glow follows mask', .3, 1.6, .01], ['hazeEven', 'Haze evenness', 0, 1, .01]
  ].map(([key, label, min, max, step]) => ({ key, label, min, max, step }));
  const COLOUR_SPEC = [['Ground, top', 'groundTop'], ['Ground, middle', 'groundMid'], ['Ground, deep', 'groundDeep'], ['Side light', 'side'],
    ['Glow, core', 'glowCore'], ['Glow, middle', 'glowMid'], ['Glow, edge', 'glowEdge'], ['Haze 1', 'tint1'], ['Haze 2', 'tint2'], ['Haze 3', 'tint3'], ['Numeral', 'numeral']]
    .map(([label, k]) => ({ label, ref: PALETTE[k] }));
  const TUNE0 = { ...TUNE }, COL0 = COLOUR_SPEC.map(c => [...c.ref]);
  let TEXT = opts.text || '2';
  /* the weight grows with the blur from the very first level, slowly at first (an ease-in): each step thicker is smaller than
     the blur that hides it, so the stroke widens smoothly along the mask. (It used to stay thin for three levels and then jump,
     concave, which showed as a kink where the thin stroke met the bold one) */
  const weightOf = j => TUNE.wMin + (TUNE.wMax - TUNE.wMin) * Math.pow(j / (LEVELS.length - 1), TUNE.wCurve);
  const PH = 1350, PW = PH * 16 / 9, CW = 1080;          /* a 16 : 9 frame; the composition is still the 1080-wide portrait in its middle, only the ground runs out to the sides */
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  /* buffers at the scale the frame is shown at: the frame, the summed numeral, and one working sheet at full, half and quarter size */
  let S = 0, frame, sum, pg, ug, work = [];
  function size(s) {
    if (s === S) return; S = s;
    frame = mk(PW * S, PH * S); sum = mk(PW * S, PH * S); pg = frame.getContext('2d'); ug = sum.getContext('2d');
    work = [1, .5, .25, .125, .125].map(q => { const c = mk(PW * S * q, PH * S * q); return { q, c, x: c.getContext('2d') }; });
  }
  /* the mask's path: a circle just outside the frame, starting at the left and turning clockwise */
  const maskPos = t => { const a = Math.PI + TAU * t / D, O = TUNE.orbit; return [PW / 2 + CW * O * Math.cos(a), PH * (.5 + O * Math.sin(a) * CW / PH * 1.08)]; };
  let REACH = 1750;                                       /* how far the mask reaches; set each frame so the 2 is always blurred by the same amount in all */
  const LEVELS = [0].concat(Array.from({ length: 15 }, (_, i) => 2 * Math.pow(1.42, i)));   /* blur strengths, sharp to 270 px */
  const ease = u => u * u * u * (u * (u * 6 - 15) + 10); /* smootherstep */
  const maskAt = d => Math.pow(1 - ease(Math.min(1, d / REACH)), TUNE.maskEdge);
  /* the mask's shape this frame: an ellipse drawn out along the way it is moving and set a little behind it (MK) */
  const MK = { cx: 0, cy: 0, c: 1, s: 0, sx: 1 };
  function setMask(t, mx, my) {
    const a = Math.PI + TAU * t / D, k = CW / PH * 1.08 * PH / CW, dx = -Math.sin(a), dy = Math.cos(a) * k, L = Math.hypot(dx, dy) || 1;
    const sw = TUNE.sway, wob = Math.sin(TAU * t / D * 3), ang = Math.atan2(dy / L, dx / L) + sw * .35 * Math.sin(TAU * t / D * 2 + 1);
    MK.c = Math.cos(ang); MK.s = Math.sin(ang); MK.sx = Math.max(1, TUNE.smear * (1 + sw * wob));
    MK.cx = mx - MK.c * TUNE.trail * REACH; MK.cy = my - MK.s * TUNE.trail * REACH;
  }
  const mdist = (x, y) => { const u = x - MK.cx, v = y - MK.cy, a = u * MK.c + v * MK.s, b = -u * MK.s + v * MK.c; return Math.hypot(a / MK.sx, b); };
  /* fill a canvas with a gradient in the mask's shape (an ellipse, centred and turned like the mask), R its radius across */
  function fillE(c, sc, R, stops) {
    c.save(); c.setTransform(MK.c * MK.sx, MK.s * MK.sx, -MK.s, MK.c, MK.cx * sc, MK.cy * sc);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, R * sc); stops(gr); c.fillStyle = gr; c.fillRect(-1e5, -1e5, 2e5, 2e5); c.restore();
  }
  const maskStops = (fn, n) => gr => { for (let k = 0; k <= n; k++) { const f = k / n; gr.addColorStop(f, `rgba(0,0,0,${fn(f * REACH * 1.02).toFixed(4)})`); } };   /* wide and soft, its faint tail pressed to nothing so what is sharp is fully sharp */
  const share = (j, d) => Math.max(0, 1 - Math.abs(maskAt(d) * (LEVELS.length - 1) - j));

  const FONT = '"Quicksand"';
  let cap = 0, GLYPHS = [];
  function two(c, blur, sc) {
    c.font = `${Math.round(WGT)} ${(TUNE.size * sc).toFixed(1)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgb(PALETTE.numeral);
    c.filter = blur > 0 ? `blur(${(blur * sc).toFixed(2)}px)` : 'none';
    /* each character at its own fixed centre, laid out once at 700: a heavier or lighter copy grows round the same centre, so the
       copies at different weights stay on top of each other (centring the whole string at each weight shifted them: a ghost) */
    for (const [ch, cx] of GLYPHS) c.fillText(ch, cx * sc, (PH / 2 + cap / 2) * sc);
    if (TUNE.round > 0) {   /* the same glyphs outlined with round joins: every sharp corner (the 2's cut base corner) comes out round */
      c.strokeStyle = c.fillStyle; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = TUNE.round * TUNE.size * sc;
      for (const [ch, cx] of GLYPHS) c.strokeText(ch, cx * sc, (PH / 2 + cap / 2) * sc);
    }
    c.filter = 'none';
  }
  /* ---- weight as one shape (opts.weight) ----
     The numeral is drawn once, thin (the sharp side's weight), and grown outwards by a distance field: each pixel just outside it
     knows how far it is from the stroke, and the stroke is thickened there by an amount that follows the mask, so it widens
     continuously along the numeral as one outline. Every blur level then blurs this same shape, so there are no copies at
     different weights to show through each other. The growth also rounds the corners. */
  const glyphCv = document.createElement('canvas'), glyphG = glyphCv.getContext('2d', { willReadFrequently: true });
  const thickCv = document.createElement('canvas'), thickG = thickCv.getContext('2d');
  let GF = null, gfKey = '';
  function inkOf(weight) {
    glyphG.setTransform(1, 0, 0, 1, 0, 0); glyphG.clearRect(0, 0, glyphCv.width, glyphCv.height);
    glyphG.font = `${Math.round(weight)} ${(TUNE.size * S).toFixed(1)}px ${FONT}`; glyphG.textAlign = 'center'; glyphG.textBaseline = 'alphabetic'; glyphG.fillStyle = '#fff';
    for (const [ch, cx] of GLYPHS) glyphG.fillText(ch, cx * S, (PH / 2 + cap / 2) * S);
    return glyphG.getImageData(0, 0, glyphCv.width, glyphCv.height).data;
  }
  function halfWidth(a, w, h) {   /* a stroke's half-width: its area over its outline's length */
    let area = 0, edge = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4 + 3; if (a[i] < 128) continue; area++;
      if (a[i - 4] < 128 || a[i + 4] < 128 || a[i - w * 4] < 128 || a[i + w * 4] < 128) edge++; }
    return edge ? area / edge : 0;
  }
  function edt1(f, n, d, v, z) {   /* squared distance transform along one line (Felzenszwalb & Huttenlocher) */
    let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let q = 1; q < n; q++) {
      let sq = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (sq <= z[k]) { k--; sq = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = sq; z[k + 1] = 1e20;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  function buildField() {
    const W = Math.round(PW * S), H = Math.round(PH * S);
    if (glyphCv.width !== W || glyphCv.height !== H) { glyphCv.width = thickCv.width = W; glyphCv.height = thickCv.height = H; }
    const thin = inkOf(TUNE.wMin), hwMin = halfWidth(thin, W, H), hwMax = halfWidth(inkOf(TUNE.wMax), W, H);
    const grow = Math.max(0, hwMax - hwMin), roundPx = TUNE.round * TUNE.size * S / 2, M = Math.ceil(grow + roundPx + 3);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (thin[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - M); y0 = Math.max(0, y0 - M); x1 = Math.min(W - 1, x1 + M); y1 = Math.min(H - 1, y1 + M);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, A = new Float32Array(bw * bh), F = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const a = thin[((y + y0) * W + x + x0) * 4 + 3] / 255; A[y * bw + x] = a; F[y * bw + x] = a >= .5 ? 0 : 1e20; }
    const n = Math.max(bw, bh), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < bw; x++) { for (let y = 0; y < bh; y++) f[y] = F[y * bw + x]; edt1(f, bh, d, v, z); for (let y = 0; y < bh; y++) F[y * bw + x] = d[y]; }
    for (let y = 0; y < bh; y++) { for (let x = 0; x < bw; x++) f[x] = F[y * bw + x]; edt1(f, bw, d, v, z); for (let x = 0; x < bw; x++) F[y * bw + x] = Math.sqrt(d[x]); }
    const band = []; for (let i = 0; i < bw * bh; i++) if (F[i] > 0 && F[i] <= grow + roundPx + 1.5) band.push(i);   /* only these pixels can change */
    GF = { x0, y0, bw, bh, A, D: F, band: Int32Array.from(band), grow, roundPx, img: thickG.createImageData(bw, bh) };
    const px = GF.img.data; for (let i = 0; i < bw * bh; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255; px[i * 4 + 3] = A[i] * 255; }
  }
  function growShape(mx, my) {   /* this frame's numeral: the thin glyph grown by the mask */
    const key = [S, TEXT, TUNE.size, TUNE.tracking, TUNE.wMin, TUNE.wMax, TUNE.round].join('|');
    if (key !== gfKey) { buildField(); gfKey = key; }
    const { x0, y0, bw, A, D, band, grow, roundPx, img } = GF, px = img.data, wc = TUNE.wCurve;
    for (let k = 0; k < band.length; k++) {
      const i = band[k], x = i % bw, y = (i - x) / bw, m = maskAt(mdist((x + x0) / S, (y + y0) / S));
      const off = roundPx + grow * Math.pow(m, wc), a = Math.max(A[i], Math.min(1, Math.max(0, off - D[i] + .5)));
      px[i * 4 + 3] = a * 255;
    }
    thickG.clearRect(0, 0, thickCv.width, thickCv.height); thickG.putImageData(img, x0, y0);
  }
  function ground(c) {
    /* after her reference: a deep, saturated electric blue, a little lighter at the top left, with a soft lighter blue on the right */
    const bg = c.createLinearGradient(0, 0, PW * S * .35, PH * S);
    bg.addColorStop(0, rgb(PALETTE.groundTop)); bg.addColorStop(.45, rgb(PALETTE.groundMid)); bg.addColorStop(1, rgb(PALETTE.groundDeep));   /* deep and fully saturated where the light does not reach */
    c.fillStyle = bg; c.fillRect(0, 0, PW * S, PH * S);
    const side = c.createRadialGradient(PW * S * 1.02, PH * S * .62, 0, PW * S * 1.02, PH * S * .62, PW * S * .55);
    side.addColorStop(0, rgba(PALETTE.side, .35)); side.addColorStop(.5, rgba(PALETTE.sideOuter, .12)); side.addColorStop(1, rgba(PALETTE.sideOuter, 0));
    c.fillStyle = side; c.fillRect(0, 0, PW * S, PH * S);
  }
  /* the goo: an alpha curve that pulls soft lobes together into one liquid body before it is softened again */
  if (!document.getElementById('bo-goo')) {
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="bo-goo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2.4 -.38"/></filter></svg>';
    document.body.appendChild(d);
  }
  /* the colour in the blur, a cyan-leaning blue that drifts a little with the mask */
  function tintAt(t) {
    const TINTS = [PALETTE.tint1, PALETTE.tint2, PALETTE.tint3];   /* cyan-leaning blues, drifting a little */
    const f = (t / D) * TINTS.length, i = Math.floor(f) % TINTS.length, u = f - Math.floor(f), e = u * u * (3 - 2 * u), a = TINTS[i], b = TINTS[(i + 1) % TINTS.length];
    return a.map((v, k) => Math.round(v + (b[k] - v) * e));
  }
  function paint(mx, my, t) {
    const w = frame.width, h = frame.height;
    ground(pg);
    /* the ground lifts towards a cyan-leaning sky blue round the blur, following the mask: deep blue, then azure, then the white haze */
    /* it reaches out into the sides of the wide frame: pushed outwards across the width as the mask goes left and right, and large */
    const ax = PW / 2 + (mx - PW / 2) * TUNE.glowPush, ay = PH / 2 + (my - PH / 2) * Math.min(1, TUNE.glowPush), az = pg.createRadialGradient(ax * S, ay * S, 0, ax * S, ay * S, TUNE.glowSize * S);
    const gk = TUNE.glow / .95, ev = TUNE.glowEven, gl = (a, b) => (a + (b - a) * ev) * gk;   /* even: a flat plateau that rolls off smoothly, no hot core */
    az.addColorStop(0, rgba(PALETTE.glowCore, gl(.95, .62))); az.addColorStop(.3, rgba(PALETTE.glowMid, gl(.8, .6))); az.addColorStop(.6, rgba(PALETTE.glowEdge, gl(.42, .4))); az.addColorStop(1, rgba(PALETTE.glowEdge.map((v, k) => k === 1 ? v * .75 : v), 0));   /* a saturated cyan-blue */
    pg.fillStyle = az; pg.fillRect(0, 0, frame.width, frame.height);
    ug.globalCompositeOperation = 'source-over'; ug.clearRect(0, 0, w, h); ug.globalCompositeOperation = 'lighter';
    if (opts.weight) growShape(mx, my);
    LEVELS.forEach((b, j) => {
      const W = work[b < 2.5 ? 0 : b < 9 ? 1 : 2], sc = S * W.q, x = W.x, cw = W.c.width, ch = W.c.height;   /* softer levels on smaller sheets */
      x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cw, ch);
      if (opts.weight) { x.filter = b > 0 ? `blur(${(b * sc).toFixed(2)}px)` : 'none'; x.drawImage(thickCv, 0, 0, cw, ch); x.filter = 'none'; }   /* the one grown shape, at this level's blur */
      else { WGT = weightOf(j); two(x, b, sc); }
      x.globalCompositeOperation = 'destination-in'; fillE(x, sc, REACH * 1.02, maskStops(d => share(j, d), 48));
      ug.drawImage(W.c, 0, 0, w, h);
    });
    /* the blurred part glows: the summed numeral laid on again, as strongly as the mask is there */
    const L = work[0].x; L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, w, h); L.drawImage(sum, 0, 0);
    L.globalCompositeOperation = 'destination-in'; fillE(L, S, REACH * 1.02, maskStops(d => maskAt(d), 32));
    /* and a haze over the blue round it: a wide, very soft glow so the light fades into the ground with no edge, and a liquid
       body: the glow blurred less, pulled together by the goo so the soft parts join like liquid, then softened again */
    const Q = work[3], qx = Q.x, qs = S * Q.q, qw = Q.c.width, qh = Q.c.height, G = work[4], gx = G.x;   /* both hazes at an eighth: they are all softness */
    const col = tintAt(t), tint = r => {
      const he = TUNE.hazeEven, mid = col.map(v => Math.round(v + (255 - v) * .42)), c0 = col.map((v, k) => Math.round(v + (mid[k] - v) * he * .7));   /* even: the core no deeper than the middle */
      r.addColorStop(0, `rgb(${c0})`); r.addColorStop(.55, `rgb(${mid})`); r.addColorStop(1, '#ffffff'); };
    qx.globalCompositeOperation = 'source-over'; qx.clearRect(0, 0, qw, qh);
    qx.filter = `blur(${(170 * qs).toFixed(1)}px)`; qx.drawImage(work[0].c, 0, 0, qw, qh); qx.drawImage(work[0].c, 0, 0, qw, qh); qx.filter = 'none';
    qx.globalCompositeOperation = 'source-in'; fillE(qx, qs, REACH * .85, tint);
    pg.drawImage(Q.c, 0, 0, w, h);
    gx.globalCompositeOperation = 'source-over'; gx.clearRect(0, 0, qw, qh);
    gx.filter = `blur(${(60 * qs).toFixed(1)}px)`; gx.drawImage(work[0].c, 0, 0, qw, qh); gx.filter = 'none';
    qx.globalCompositeOperation = 'source-over'; qx.clearRect(0, 0, qw, qh);
    qx.filter = `url(#bo-goo) blur(${(26 * qs).toFixed(1)}px)`; qx.drawImage(G.c, 0, 0); qx.filter = 'none';
    qx.globalCompositeOperation = 'source-in'; fillE(qx, qs, REACH * .85, tint);
    pg.globalAlpha = TUNE.haze; pg.drawImage(Q.c, 0, 0, w, h); pg.globalAlpha = 1;
    /* the numeral over the haze, so its sharp side stays pure white, then its glow */
    pg.drawImage(sum, 0, 0); pg.drawImage(work[0].c, 0, 0); pg.drawImage(work[0].c, 0, 0);
    /* the colour reaches into the blurred numeral too, a little */
    const T = work[1], tx = T.x, ts = S * T.q, tw = T.c.width, th = T.c.height;
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, tw, th); tx.drawImage(work[0].c, 0, 0, tw, th);
    tx.globalCompositeOperation = 'source-in';   /* subtle, light, the same drifting colour */
    fillE(tx, ts, REACH * .7, t2 => { t2.addColorStop(0, `rgba(${col},${TUNE.tintIn})`); t2.addColorStop(1, `rgba(${col},0)`); });
    pg.drawImage(T.c, 0, 0, w, h);
  }
  /* the 2 is not round, so a mask at the same distance covers more of it below than above; this sets the reach each frame so that,
     averaged over the numeral, the blur is always the same (0.52), and the sweep reads even all the way round */
  let PTS = null, T_NOW = 0;
  function evenReach(mx, my) {
    if (!PTS) return REACH;
    let lo = 600, hi = 5000;
    for (let k = 0; k < 18; k++) { const r = (lo + hi) / 2; REACH = r; setMask(T_NOW, mx, my); let s = 0; for (const [x, y] of PTS) s += maskAt(mdist(x, y)); if (s / PTS.length < TUNE.even) lo = r; else hi = r; }
    return REACH = (lo + hi) / 2;
  }
  function render(t) {
    t = ((t % D) + D) % D;
    size(cv.height / PH);                                 /* the frame fills the player's height, at its pixels */
    if (measured !== TEXT + '|' + TUNE.size + '|' + TUNE.tracking) measure();
    const [mx, my] = maskPos(t); T_NOW = t; evenReach(mx, my); setMask(t, mx, my);
    paint(mx, my, t);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#0A0A0C'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(frame, Math.round((cv.width - frame.width) / 2), 0);
  }
  /* the numeral's height, and points on it every 10 units to measure how much of it the mask covers; again whenever it changes */
  let measured = '';
  function measure() {
    const m = mk(8, 8).getContext('2d'); m.font = `700 ${TUNE.size}px ${FONT}`; cap = m.measureText(TEXT).actualBoundingBoxAscent;
    /* the layout: each character's centre, from its advance at 700 plus the letter spacing, the whole centred on the frame */
    const chars = [...TEXT], adv = chars.map(ch => m.measureText(ch).width), gap = TUNE.tracking * TUNE.size;
    const total = adv.reduce((a, b) => a + b, 0) + gap * (chars.length - 1); let at = PW / 2 - total / 2;
    GLYPHS = chars.map((ch, k) => { const cx = at + adv[k] / 2; at += adv[k] + gap; return [ch, cx]; });
    const c = mk(PW / 5, PH / 5), x = c.getContext('2d'); x.font = `700 ${TUNE.size / 5}px ${FONT}`; x.textAlign = 'center'; x.fillStyle = '#fff';
    for (const [ch, cx] of GLYPHS) x.fillText(ch, cx / 5, (PH / 2 + cap / 2) / 5);
    const d = x.getImageData(0, 0, c.width, c.height).data; PTS = [];
    for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) if (d[(y * c.width + xx) * 4 + 3] > 128) PTS.push([xx * 5, y * 5]);
    measured = TEXT + '|' + TUNE.size + '|' + TUNE.tracking;
  }
  const ready = document.fonts.load(`700 100px ${FONT}`).then(measure);
  function resetTune() { Object.assign(TUNE, TUNE0); COLOUR_SPEC.forEach((c, k) => { c.ref[0] = COL0[k][0]; c.ref[1] = COL0[k][1]; c.ref[2] = COL0[k][2]; }); }
  return { render, ready, D, get frame() { return frame; },
           tune: TUNE, tuneSpec: TUNE_SPEC, colourSpec: COLOUR_SPEC, tuneDefaults: TUNE0, colourDefaults: COL0, resetTune, buildLut() {},
           get text() { return TEXT; }, set text(v) { TEXT = String(v || '2'); } };
}
window.BlurOrbit = { create };
})();
