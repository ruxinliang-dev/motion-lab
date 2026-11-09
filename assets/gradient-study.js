/* Gradient study, after a Cavalry "gradient exercise" by yuuraa (seen on Instagram): on a warm black, two cones of light come in
   from the left and right edges, meet in the middle as a bow tie, open up and down until the frame is full, and settle to a pale
   cream pink. The light is seen through fluted glass: the frame is cut into narrow vertical ribs, and each rib shows the gradient
   behind it a little magnified and shifted, which is where the fine vertical stripes come from. Pink at the edge of the light,
   cream inside it, a soft lilac where the two cones cross.
   The picture is computed per pixel on a small sheet (it is all gradient, so nothing is lost) and scaled up smoothly.
   Shape and colour are kept apart: the drawing only makes grey values, 0 - 1 (how far into the light, how much violet, ...),
   and PALETTE turns them into colour, the main one through a lookup table, like an SVG feComponentTransfer. A note about
   colour changes PALETTE only; a note about shape or timing changes the grey values only.

     const s = GradientStudy.create(canvas); await s.ready; s.render(t);   // t in 0 - D s
     s.setView(0 | 1 | 2);   // 0 colour, 1 the light as grey, 2 the tint weights (violet red, top/bottom peach green, settle blue) */
(() => {
'use strict';
function create(cv) {
  const g = cv.getContext('2d'), D = 6.3;
  const BW = 1440, BH = 120,   /* wide and short: crisp rib edges across, the light is smooth up and down anyway */
        buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
  const bg = buf.getContext('2d'), img = bg.createImageData(BW, BH), px = img.data;
  const cl = x => x < 0 ? 0 : x > 1 ? 1 : x, lerp = (a, b, u) => a + (b - a) * u;
  const sm = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const seg = (t, a, b) => cl((t - a) / (b - a)), eio = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  /* ---- colour: all of it is here. Colours picked from the reference frame, each pushed a little more saturated ----
     ramp:   the light, ground to pink-white, by one grey value (positions 0 - 1 along it)
     tints:  colours laid over the ramp, each by its own grey weight
     grade:  the frame's look: a little richer in the middle, lighter towards the edges */
  const PALETTE = {
    ramp: [[0, [8, 2, 0]],            /* the warm black ground */
           [.3, [78, 28, 34]],       /* the glow just outside the light */
           [.4, [212, 86, 112]],     /* rose, the edge of the light */
           [.55, [238, 126, 158]],   /* pink */
           [.75, [253, 233, 187]],   /* butter */
           [1, [242, 250, 248]]],    /* cream, the middle of the light: bright, with a cool cyan touch */
    violet: [180, 124, 242], settle: [253, 237, 225], edge: [238, 138, 166],
    mint: [196, 236, 210],   /* a soft green that ramps into the cream towards the end */
    grade: { light: [255, 247, 242], lighten: .34, richMiddle: .2, paleEdge: .12,
             rim: [200, 178, 246], rimAmt: .4 }   /* a soft cool lilac at the far left and right, where the glass is nearest */
  };
  /* the ramp as a lookup table, 1024 steps */
  const LUT_N = 1024, lut = new Float32Array(LUT_N * 3);
  function buildLut() {
    const R = PALETTE.ramp;
    for (let j = 0; j < LUT_N; j++) {
      const x = j / (LUT_N - 1); let k = 1; while (k < R.length - 1 && R[k][0] < x) k++;
      const [x0, c0] = R[k - 1], [x1, c1] = R[k], u = cl((x - x0) / (x1 - x0));
      for (let c = 0; c < 3; c++) lut[j * 3 + c] = c0[c] + (c1[c] - c0[c]) * u;
    }
  }
  buildLut();
  let view = 0;
  /* ---- timing and look she can drag on the parts page (the tune panel); the drawing reads them every frame ---- */
  const TUNE = {
    meet: 1.35,        /* the cones meet */
    open: 2.6,        /* the frame is full */
    band0: 1.55, band1: 2.75,   /* the band through the middle grows */
    stagger: .38,      /* how much later the middle ribs run than the outer ones */
    pinkFade: 2.3,     /* the pinks start to pale (over .8 s) */
    peachSoft: 1.9,    /* the peach's edges start to soften (over .9 s) */
    violetOut: 2.6, violetDur: .8,   /* the violet starts to leave the outer ribs; how long each rib takes */
    mintIn: 3.4, mintDur: 1.5, mintAmt: .5, mintWidth: .7,   /* the mint: start, each rib's time, strength, widest */
    endOff: 4.1, endDur: 2.1,   /* the close: the opening run backwards, the light drawing back out to the sides; ends in black for the loop */
    chrome: .011,      /* the colour split at the edges */
    focus: .75,        /* sharp by */
    grain: 1           /* the fine grain that keeps the pale gradients from banding when the video is compressed */
  };
  const TUNE_SPEC = [
    ['meet', 'Cones meet', .6, 2, .01], ['open', 'Frame full', 1.8, 3.6, .01], ['band0', 'Middle band from', .8, 2.6, .01], ['band1', 'Middle band to', 2, 4, .01],
    ['stagger', 'Rib stagger', 0, .8, .01], ['pinkFade', 'Pinks pale from', 1.5, 4, .01], ['peachSoft', 'Peach softens from', 1.5, 4, .01],
    ['violetOut', 'Violet leaves from', 2, 4.5, .01], ['violetDur', 'Violet, each rib', .3, 2, .01],
    ['mintIn', 'Mint in from', 2.5, 4.8, .01], ['mintDur', 'Mint, each rib', .3, 2.5, .01], ['mintAmt', 'Mint strength', 0, 1, .01], ['mintWidth', 'Mint width', .2, 1.2, .01],
    ['endOff', 'Close from', 3.4, 5.2, .01], ['endDur', 'Close takes', .5, 2.7, .01], ['chrome', 'Chrome', 0, .03, .001], ['focus', 'In focus by', .1, 1.5, .01], ['grain', 'Grain', 0, 3, .05]
  ].map(([key, label, min, max, step]) => ({ key, label, min, max, step }));
  const COLOUR_SPEC = [
    ['Ground', PALETTE.ramp[0][1]], ['Glow', PALETTE.ramp[1][1]], ['Rose', PALETTE.ramp[2][1]], ['Pink', PALETTE.ramp[3][1]], ['Butter', PALETTE.ramp[4][1]],
    ['Cream', PALETTE.ramp[5][1]], ['Violet', PALETTE.violet], ['Mint', PALETTE.mint], ['Pale (settle)', PALETTE.settle], ['Edge lilac', PALETTE.grade.rim]
  ].map(([label, ref]) => ({ label, ref }));
  const TUNE0 = { ...TUNE }, COL0 = COLOUR_SPEC.map(c => [...c.ref]);
  /* the fluted glass, matched to the reference: about 3.5 % of the frame's height a rib, narrower in the middle and wider to the
     sides; each rib is a strong lens, so it shows only a small slice of the light behind it, magnified, and the gradient steps
     from rib to rib (the dark wedges get stepped edges, the lilac band breaks into ovals) */
  const RIBS = 38, LENS = .32;   /* wider ribs */   /* each rib shows the light offset from its neighbours; it still moves smoothly inside the rib */
  const warp = z => z * (1.25 - .25 * Math.abs(z));       /* 0 - 1 across half the frame; steeper in the middle = narrower ribs there */
  const unwarp = w => { const a = Math.abs(w), z = (1.25 - Math.sqrt(1.5625 - a)) / .5; return Math.sign(w) * z; };

  /* the cones' progress, 0 - 1: a two-piece Hermite curve through K at the meeting with the average speed there, still at the end */
  /* T0, TIP0, M0: starts soon, from near the edge, already moving; the meeting, the full frame and the middle band are in TUNE */
  const T0 = .05, TIP0 = 1.05, K = TIP0 / (TIP0 + .55), M0 = 1.3;
  const herm = (u, p0, p1, m0, m1) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };
  const run = t => { const M = TUNE.meet, END = Math.max(TUNE.open, M + .1), MV = 1 / (END - T0); return t <= T0 ? 0 : t >= END ? 1 : t < M ? herm((t - T0) / (M - T0), 0, K, M0, MV * (M - T0)) : herm((t - M) / (END - M), K, 1, MV * (END - M), 0); };

  /* the camera and the glass: a short focal length, and the fluted panel bends towards the camera at its left and right, so
     its sides are nearer: the ribs there are wider and the light behind them taller, and they are out of focus (the blur below).
     The ribs stay straight and upright, as on a panel curved round an upright axis. Worked out per column, once */
  const FISH = .2, VMAG = .28;
  const cZ0 = new Float32Array(BW), cZ = new Float32Array(BW), cVS = new Float32Array(BW), cI = new Int16Array(BW),
        cF = new Float32Array(BW), cQ = new Float32Array(BW), cU = new Float32Array(BW);
  /* per rib, worked out once a frame: the slice of light it shows, and its own clock */
  const N = RIBS, rUC = new Float32Array(N);
  for (let i = 0; i < N; i++) rUC[i] = unwarp((i - N / 2 + .5) * 2 / N);
  const hash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
  const rS = new Float32Array(N); for (let i = 0; i < N; i++) { const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; rS[i] = .1 + .16 * (h - Math.floor(h)); }   /* how softly each rib's ends blur out, a little different rib to rib */
  for (let x = 0; x < BW; x++) {
    const z0 = (x + .5) / BW * 2 - 1, z = z0 * (1 - FISH * z0 * z0);   /* where this column looks on the panel */
    const wz = warp(z) * N / 2, rf = Math.floor(wz), f = wz - rf, ii = rf + N / 2, i = ii < 0 ? 0 : ii > N - 1 ? N - 1 : ii;
    cZ0[x] = z0; cZ[x] = z; cVS[x] = 1 - VMAG * z0 * z0; cI[x] = i; cF[x] = f; cQ[x] = 2 * f - 1; cU[x] = rUC[i] + (z - rUC[i]) * LENS;
  }
  /* the light's edges are arcs, not straight lines: the dark at the top and bottom comes in as a rounded bowl */
  const arc = x => { const a = Math.abs(x); return Math.sign(x) * (.85 * a * a + .15 * a); };
  const P = {}; ['tip', 'slope', 'band', 'ylo', 'fill', 'size', 'sizeP', 'settle', 'seam', 'Hr', 'wq', 'lv', 'ga', 'sc', 'tube', 'pf', 'mw', 'sw'].forEach(k => P[k] = new Float32Array(N));
  /* chrome: the red, green and blue of the picture drawn at slightly different sizes, so the colours split more towards the edges */
  const caC = document.createElement('canvas'); caC.width = 1440; caC.height = 810; const caG = caC.getContext('2d');
  const chan = ['#ff0000', '#00ff00', '#0000ff'].map(col => { const c = document.createElement('canvas'); c.width = BW; c.height = BH; return { c, x: c.getContext('2d'), col }; });
  /* the edges of the frame: lighter and softer, the middle sharpest; blurred copies, each kept only towards the edges */
  const MW = 640, MH = 360, mk = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; return c; };
  const mid = mk(), tmp = mk(), mg = mid.getContext('2d'), tg = tmp.getContext('2d');
  const C = [0, 0, 0];
  /* a mask kept to the left and right: full up to a (a fraction of the width in from each edge), nothing from b, with a smoothstep
     between in many stops, so no straight-line kink shows as a line in the dark or in a soft glow */
  const edgeMask = (ctx, w, a, b) => {
    const m = ctx.createLinearGradient(0, 0, w, 0);
    for (let k = 0; k <= 12; k++) { const u = k / 12, x = a + (b - a) * u, al = (1 - u * u * (3 - 2 * u)).toFixed(4); m.addColorStop(cl(x), `rgba(0,0,0,${al})`); m.addColorStop(cl(1 - x), `rgba(0,0,0,${al})`); }
    return m;
  };
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const gx = grain.getContext('2d'), gi = gx.createImageData(256, 256); let r = 1234567;
    for (let k = 0; k < gi.data.length; k += 4) { r = (r * 16807) % 2147483647; const u = r / 2147483647 - .5, w = u > 0 ? 255 : 0; gi.data[k] = gi.data[k + 1] = gi.data[k + 2] = w; gi.data[k + 3] = Math.abs(u) * 2 * 18; }   /* white or black specks, each at a small random strength: a +/- dither */
    gx.putImageData(gi, 0, 0); }
  let grainPat = null;
  /* a tile of alpha between ~.88 and 1, multiplied into every mask: blending a layer over the same colour rounds by a level, and
     on the near-black ground that one level showed as a hard line where the mask crossed half; jittering the mask breaks the line */
  const jit = document.createElement('canvas'); jit.width = jit.height = 64;
  { const jx = jit.getContext('2d'), ji = jx.createImageData(64, 64); let r = 7654321;
    for (let k = 0; k < ji.data.length; k += 4) { r = (r * 16807) % 2147483647; ji.data[k] = ji.data[k + 1] = ji.data[k + 2] = 0; ji.data[k + 3] = 225 + 30 * r / 2147483647; }
    jx.putImageData(ji, 0, 0); }
  const jitter = (ctx, w, h) => { ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = ctx.createPattern(jit, 'repeat'); ctx.fillRect(0, 0, w, h); };
  const mixI = (a, b, u) => { a[0] += (b[0] - a[0]) * u; a[1] += (b[1] - a[1]) * u; a[2] += (b[2] - a[2]) * u; };   /* mixes into a, in place */

  function render(t) {
    t = ((t % D) + D) % D;
    /* the close, 0 - 1: the opening backwards, soft and smooth; the middle band goes first, then the cones slide back out */
    const tcl = TUNE.endOff + (t - TUNE.endOff) * 1.6 / TUNE.endDur;   /* the close's own clock: every step in it stretches with Close takes */
    const cls = Math.pow(seg(t, TUNE.endOff, TUNE.endOff + TUNE.endDur), 1.3);   /* starts gently, keeps moving */
    const ce = sm(TUNE.endOff, TUNE.endOff + .35, tcl);
    const cs = sm(TUNE.endOff + .45, TUNE.endOff + .75, tcl);
    const hn = .32 * sm(TUNE.endOff + .3, TUNE.endOff + .55, tcl);   /* from ~4.3 the butter/orange highlight in each panel narrows a little */   /* from ~4.45: the middle of the light goes soft, and the dark's arc is kept round */
    const rr = .16 * sm(TUNE.endOff + .3, TUNE.endOff + .7, tcl), rarc = x => arc(Math.sqrt(x * x + rr * rr)) - arc(rr);   /* rounds the point where the two arcs meet */   /* the close's first 0.35 s: the peach edge sharpens back and the pale wash lifts, so the dark returns clean */
    /* how open the light is through the close (three Hermite pieces, never stopping on the way): the frame closes down to two
       cones at the sides by .35; over most of the close they slowly draw back and shrink (.5 → .2, the part that is still
       visible); then the last of them slips out, arriving at 0 with no speed */
    const hClose = 1 + 1.3 * sm(.3, 1, cls), sfc = sm(.05, .4, cls);   /* sfc: how far the panels have gone soft for the close */   /* and as they go, the cones get shorter */
    const closeCurve = c => c < .35 ? herm(c / .35, 1, .5, -.3 * .35, -.55 * .35)
                          : c < .9 ? herm((c - .35) / .55, .5, .2, -.55 * .55, -.5 * .55)
                          : herm((c - .9) / .1, .2, 0, -.5 * .1, 0);
    for (let i = 0; i < N; i++) {
      const tl = t - TUNE.stagger * (1 - Math.abs(rUC[i]));   /* each rib a little later than the one outside it */
      /* the cones: tips start outside the edges and meet in the middle, in one move that never stops on the way; they open and
         the band through the middle thickens until the frame is full */
      const E = Math.max(0, run(tl) * closeCurve(cls));   /* never below 0 (a hair under 0 made the last frame blank) */   /* the cones slide all the way out, no cut; the last part, at the sides, slow */   /* closing: the cones draw back out the way they came, unhurried, and only leave the frame at the very end */
      P.tip[i] = TIP0 - (TIP0 + .55) * E; P.slope[i] = .5 + 3.2 * Math.pow(E, 4.2);
      P.band[i] = .12 * cl((E - K) / .12) + .75 * eio(seg(tl, TUNE.band0, TUNE.band1)) * (1 - sm(0, .5, cls));   /* nothing across the middle until the cones meet */
      P.ylo[i] = lerp(.35, .05, eio(seg(tl, .5, 1.15))) + .17 * eio(seg(tl, 1.4, 2.2));   /* the butter shows early, inside even a thin cone; it widens back as the cone opens */
      /* and in each rib it first fills only the middle 60 %, then spreads to the rib's edges and joins its neighbours */
      P.fill[i] = .6 * eio(seg(tl, .5, 1.25)) + .65 * eio(seg(tl, 1.9, 2.6));   /* the whole rib by 2.6 */
      /* the violet, by shape, in every rib along the middle: it grows in just after the butter, then leaves, outer ribs first */
      /* how far the violet has left: rib by rib from the sides, the middle last; each rib speeds up as it goes, and the ribs follow
         one another faster and faster (the spread .7 s, bunched towards the middle) */
      { const w = .7 * Math.pow(1 - Math.abs(rUC[i]), .7), u = seg(t, TUNE.violetOut + w, TUNE.violetOut + TUNE.violetDur + w); P.lv[i] = u * u * (2 - u); }
      P.size[i] = Math.pow(seg(tl, .6, 2.7), 1.5); P.sizeP[i] = Math.max(Math.pow(P.size[i], 1.4), 1e-4);   /* small at first, spreading slowly */
      /* how far the light reaches in this rib's middle; each rib's light starts as a thin sliver and widens to the rib as it grows */
      P.Hr[i] = P.slope[i] * (arc(Math.abs(rUC[i])) - arc(P.tip[i])) + P.band[i]; P.wq[i] = .12 + 1.03 * sm(0, .3, P.Hr[i]);
      /* closing: the panels narrow again to slivers, the middle ones first */
      { const m = 1 - Math.abs(rUC[i]); P.wq[i] *= 1 - .8 * eio(seg(tcl, TUNE.endOff + .35 + .45 * (1 - m), TUNE.endOff + .95 + .45 * (1 - m))); }
      /* the black gaps between ribs close, so by 2.28 even the middle ribs (which run later) have joined; the scattered ends settle */
      P.ga[i] = 1 - sm(1.5, 1.9, tl); P.sc[i] = 1 - sm(1.9, 2.3, tl);
      /* the tube wake, kept short and simple: about half the ribs blink off once, briefly, just as the light reaches them (opening only) */
      P.pf[i] = sm(TUNE.pinkFade, TUNE.pinkFade + .8, t);   /* the pinks start to pale and lose their saturation */
      /* the mint's width in this rib: it grows from the rib's middle like the violet, outer ribs first; the middle ones only begin by the end */
      P.mw[i] = TUNE.mintWidth * eio(seg(t, TUNE.mintIn + 1.0 * (1 - Math.abs(rUC[i])), TUNE.mintIn + TUNE.mintDur + 1.0 * (1 - Math.abs(rUC[i]))));
      P.tube[i] = t < .77 && hash(i, 3) > .5 && P.Hr[i] > .04 && P.Hr[i] < .09 ? .12 : 1;
      P.settle[i] = eio(seg(tl, 2.95, 4.0)); P.sw[i] = sm(2.75, 4.35, tl);   /* sw: the settle's slower, panel-wise opening */ P.seam[i] = 1 - .7 * P.settle[i];
    }
    const RIM = PALETTE.grade.rim, VIO = PALETTE.violet, SET = PALETTE.settle, EDG = PALETTE.edge, GR = PALETTE.grade, LIT = GR.light;
    const GROUND = PALETTE.ramp[0][1], MINT = PALETTE.mint, PALE = PALETTE.settle;
    const ks = 1 + 2.2 * sm(TUNE.peachSoft, TUNE.peachSoft + .9, t) * (1 - ce);   /* from 2.5 the peach's edges go from sharp to soft */
    let o = 0;
    for (let y = 0; y < BH; y++) {
      const v0 = (y + .5) / BH * 2 - 1;
      for (let x = 0; x < BW; x++) {
        const z0 = cZ0[x], i = cI[x], f = cF[x], q = cQ[x], u = cU[x], au = Math.abs(u), aq = Math.abs(q);
        const vv = v0 * cVS[x] * hClose;                                               /* nearer sides: the light behind them looks taller */
        const nw = (1 - sm(.08, .55, P.Hr[i])) * (1 - ce);   /* how new this rib's light is (opening only) */
        const q2 = q * q, v = vv / (.6 + .4 * sm(0, .5, P.Hr[i])) / (1 - nw + nw * Math.sqrt(Math.max(.02, 1 - .97 * q2))), av = Math.abs(v);   /* while new, an oval: its height follows an ellipse across the rib, so the ends round off rather than spike */   /* a thin rib is a little shorter; while new, its ends come to a soft point (an i), then it turns into a long rectangle */
        /* how far inside the light (> 0). The reach is the rib's own (its middle), so each rib's end is flat across, like the end
           of a box, rounded only at the corners; the rib's edges see less light, so black shows between ribs until they join */
        const ac = Math.abs(rUC[i]) + (au - Math.abs(rUC[i])) * (.15 + .4 * sfc);   /* as it closes the panels lose their straight sides, so the fading peach has no hard edges */
        /* the rib's light is a rectangle: straight sides (its sliver while thin, then a black gap at its edges until the ribs join) and a
           flat top and bottom, the same height right across */
        const ahead = Math.max(0, arc(P.tip[i]) - arc(ac));   /* ribs the cones have not reached yet stay black, however soft the ends */
        const d0 = P.slope[i] * (rarc(ac) - arc(P.tip[i])) + P.band[i] - av - 1.5 * ahead
          - .1 * sm(TUNE.endOff + .1, TUNE.endOff + .5, tcl) * (1 - Math.sqrt(Math.max(0, 1 - .96 * q * q))) / (1 - Math.sqrt(.04));   /* as it closes, each panel's ends are round caps (a fixed radius, not stretched with the panel's height) */   /* gaps show only near the light's edge, as before */
        const pen = 1.5 * sm(P.wq[i] - .04 - .3 * sfc - .2 * cs, P.wq[i] + .06 + .3 * sfc + .2 * cs, aq) + 1.5 * P.ga[i] * sm(.84, .97, aq) * (1 - sm(.25, .7, d0));
        const d = d0 - pen;
        /* the same depth, but from this pixel's own place rather than its rib's, for the soft glow outside the light only: so the
           glow round the light is one smooth haze, not stepped rib by rib (the stepping showed as hard lines in the soft peach) */
        /* the light's edge as one smooth arc: the rib's own values blended with its neighbour's across it, and each pixel's own place,
           so the outline of the light is a smooth curve and the panels are only cut out of it (by their gaps and caps) */
        const jn = f < .5 ? (i > 0 ? i - 1 : i) : (i < N - 1 ? i + 1 : i), wn = Math.abs(f - .5);
        const tipS = P.tip[i] + (P.tip[jn] - P.tip[i]) * wn, slS = P.slope[i] + (P.slope[jn] - P.slope[i]) * wn, bnS = P.band[i] + (P.band[jn] - P.band[i]) * wn;
        const HrS = P.Hr[i] + (P.Hr[jn] - P.Hr[i]) * wn, nwS = (1 - sm(.08, .55, HrS)) * (1 - ce);
        const avS = Math.abs(vv / (.6 + .4 * sm(0, .5, HrS)) / (1 - nwS + nwS * Math.sqrt(Math.max(.02, 1 - .97 * q2)))), azS = Math.abs(cZ0[x] * (1 - FISH * cZ0[x] * cZ0[x]));
        const dSm = slS * (rarc(azS) - arc(tipS)) + bnS - avS - 1.5 * Math.max(0, arc(tipS) - arc(azS)) - (d0 - (P.slope[i] * (rarc(ac) - arc(P.tip[i])) + P.band[i] - av - 1.5 * ahead)) - pen;
        const dE = d + (dSm - d) * .5 * (1 - sm(.1, .45, d)) * (1 - sm(TUNE.endOff, TUNE.endOff + .3, tcl));   /* (not while closing: there each panel leaves with its own round cap) */   /* half the smooth arc, half the panel's own height: the edge keeps the arc's line but each panel's end sits a little apart */   /* only at the edge; inside, the panels' own colours stay */
        const dg = dE;   /* at the light's edge it is the rib's own; just outside, the pixel's, so soft edges and glow are one smooth haze */
        const sE = (.1 + (rS[i] - .1) * P.sc[i]) * ks + .18 * nw, inside = sm(-sE, .05 + (.12 + .5 * sm(TUNE.endOff, TUNE.endOff + .3, tcl)) * sE, dg);   /* soft towards the dark only: the light side of the edge stays crisp */   /* the ends blur out */
        /* ---- shape: grey values only ---- */
        /* the light, 0 - 1: a tight glow outside it (so the dark stays dark), its edge, then in the middle of each rib pink, butter
           and pink-white; between the ribs it goes straight to butter-white */
        /* every step of the ramp is a long, soft blend; butter holds a wide middle, pink-white only deep inside */
        const ylo = P.ylo[i], fl = P.fill[i] * (1 - .45 * sm(TUNE.endOff + .25, TUNE.endOff + .5, tcl)), core = fl > 0 ? sm(fl + .3, fl - .15, aq) : 0;
        const Hr = P.Hr[i], dn = Hr > .02 ? d / Hr : 0, small = 1 - sm(.15, .5, Hr);   /* dn: depth measured against this rib's own reach */
        /* butter by depth, and in the small middle ribs by their own reach too, so even they have butter (and so violet) */
        const base = .3 * sm(-.1 - .5 * sE, 0, dg) + .1 * inside,   /* a tight glow, so nothing shows between the cones before they meet */ yel = Math.max(sm(ylo + .08 - .1 * cs + hn, ylo + .6 + .6 * cs + hn, d), sm(.3 + .25 * hn, .7 + .3 * cs + .25 * hn, dn));   /* hn: the highlight a little narrower as it closes */   /* by depth, or by the rib's own reach */
        let inner = base + .15 * sm(-.02, .3 + .5 * cs, dE) + .2 * yel + .25 * sm(ylo + 1.5, ylo + 2.9, d), gap = base + .45 * sm(0, .4, dE);
        /* the small middle ribs take the same colours as the rest by their own reach: a thin pink rim, butter, then cream round the violet */
        inner += (base + .15 * sm(0, .2, dn) + .2 * sm(.15, .45, dn) + .12 * sm(.45, .9, dn) - inner) * small;
        let light = gap + (inner - gap) * core;
        /* where the ribs have joined, a soft cream between them keeps the structure */
        const sW = sm(.7, 1, aq) * sm(.3, .8, d) * .7; light += (.92 - light) * sW;
        /* the violet never fades, and always sits inside the butter: across the rib's whole width, along the middle; it grows
           and shrinks up and down only, blending softly into the butter round it; taller on the nearer sides */
        /* as it leaves it gets lower and much softer, spreading out thin rather than standing tall */
        const lv = P.lv[i], size = P.size[i], wV0 = size > 0 ? Math.exp(-(v * v * 9 / (1 + 7 * z0 * z0)) / (P.sizeP[i] * (1 + 2.5 * lv)))   /* taller towards the sides (nearer the camera) */ * Math.max(sm(ylo + .15, ylo + .9, d), sm(.5, .9, dn)) * (1 - .6 * sW) * inside : 0;
        /* richest in the middle of each rib, paler to its sides; when it leaves it does not shrink to a shape: it turns into the butter round it and is gone */
        /* as it leaves, it narrows in each rib to a thin line and is gone, softening into the butter as it goes */
        const wd = 1 - lv, wV = .8 * wV0 * (1 - .7 * lv) * (.2 + .8 * Math.pow(1 - q2, 1.5)) * sm(wd + .5, wd - .25, aq);   /* narrowing softly, with a hazy edge, and paling as it goes */
        light += (.75 - light) * wV0 * lv * (1 - lv) * .8;
        /* the switch out of the pale wash, panel by panel like the violet and mint: in each panel it opens from the middle line
           out to the edges, the outer panels a little first */
        const cw = 1.8 * sm(TUNE.endOff + .1 * (1 - Math.abs(rUC[i])), TUNE.endOff + .38 + .1 * (1 - Math.abs(rUC[i])), tcl) - .2,   /* done before the dark arrives */ lift = sm(cw + .25, cw - .15, aq);
        /* the shift to the pale (green-cream) settle, panel by panel: it opens from each panel's middle line out to its edges */
        const sp = 1.7 * P.sw[i] - .35, sPan = P.sw[i] > 0 ? sm(sp + .45, sp - .25, aq) * P.settle[i] : 0;   /* slow and soft: a wide soft edge, over about 1.6 s per panel */
        const wS = sPan * (.55 * (1 - lift) + .3 * inside) * (1 - .9 * wV / .8);   /* (as it closes, the dark coming back is not washed pale) */   /* it all settles to pale, except where the violet still is: that leaves on its own clock */
        const as = Math.abs(vv) / (1 - .12 * q * q);                                    /* the top and bottom peach: long soft ends */
        /* the peach rides the rim of the light at the top and bottom: as the dark there is pushed out of the frame, the peach goes
           with it and leaves; it never comes back */
        const dd = d + pen, wE = sm(-.02, .08, dd) * (1 - sm(.15, .55, dd)) * sm(.3, .7, as) * .6 * (1 - .7 * P.pf[i]);
        const e = sm(.2, 1.05, Math.sqrt(z0 * z0 + v0 * v0 * .16));                     /* 0 in the middle of the frame, 1 at its edges */
        let rib = 1 - P.seam[i] * (1 - sm(TUNE.endOff, TUNE.endOff + .3, tcl)) * (.03 * (1 - sm(0, .08, f) * sm(1, .92, f)) + .012 * Math.cos(f * Math.PI * 2));   /* a fine seam at each rib's edge */
        if (view === 1) { const w = light * 255 * rib; px[o++] = w; px[o++] = w; px[o++] = w; px[o++] = 255; continue; }
        if (view === 2) { px[o++] = wV * 255; px[o++] = wE * 255; px[o++] = wS * 255; px[o++] = 255; continue; }
        /* ---- colour: the grey values through PALETTE ---- */
        const j = (light * (LUT_N - 1) + .5 | 0) * 3; C[0] = lut[j]; C[1] = lut[j + 1]; C[2] = lut[j + 2];
        mixI(C, PALE, sm(.33, .45, light) * (1 - sm(.6, .72, light)) * inside * P.pf[i] * .7);   /* where the light is rose or pink, it pales */
        mixI(C, VIO, wV); mixI(C, SET, wS); mixI(C, EDG, wE);
        const lum = .3 * C[0] + .59 * C[1] + .11 * C[2], k = 1 + GR.richMiddle * (1 - e) - GR.paleEdge * e;
        C[0] = lum + (C[0] - lum) * k; C[1] = lum + (C[1] - lum) * k; C[2] = lum + (C[2] - lum) * k;
        mixI(C, LIT, GR.lighten * e * lum / 255);
        mixI(C, RIM, GR.rimAmt * sm(.8, 1, Math.abs(z0)) * lum / 255);
        /* the mint ramps into the cream: only where it is cream (settled pale, or the top of the ramp), entering from the sides
           and stronger towards them, so it reads as a gradient moving in */
        /* the mint, only on the cream: in each rib a soft column from its middle, widening like the violet did, richest at the middle */
        const mw = P.mw[i], creamy = Math.max(wS, sm(.82, 1, light));
        mixI(C, MINT, mw > 0 ? TUNE.mintAmt * creamy * sm(mw + .6, mw - .4, aq) * (.4 + .6 * (1 - q2)) * sm(0, .25, mw) : 0);   /* soft edges, and it grows in soft from nothing */
        mixI(C, GROUND, 1 - P.tube[i]);   /* the opening: a rib the light has just reached flickers on, like a tube waking; off is the ground, not darker */
        const rk = 1 - (1 - rib) * sm(12, 70, .3 * C[0] + .59 * C[1] + .11 * C[2]);   /* the seams only where there is light: on the near-black ground they showed as rib-wide bands */
        px[o++] = C[0] * rk; px[o++] = C[1] * rk; px[o++] = C[2] * rk; px[o++] = 255;
      }
    }
    bg.putImageData(img, 0, 0);
    const W = cv.width, H = cv.height, foc = 1 - sm(.3, TUNE.focus, t);   /* foc: how far out of focus, at the start */
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    /* the picture, clean; then the chrome: each channel on its own, added back together, red and green a little larger than
       blue, kept only towards the left and right, so it is nothing in the far middle and strongest at the near edges */
    g.globalCompositeOperation = 'source-over'; g.drawImage(buf, 0, 0, W, H);
    if (!view) {   /* the grey views skip the chrome split */
      const CW = caC.width, CH = caC.height;
      caG.globalCompositeOperation = 'source-over'; caG.fillStyle = '#000'; caG.fillRect(0, 0, CW, CH);
      caG.globalCompositeOperation = 'lighter'; caG.imageSmoothingQuality = 'high';
      chan.forEach((ch, j) => {
        ch.x.globalCompositeOperation = 'source-over'; ch.x.drawImage(buf, 0, 0);
        ch.x.globalCompositeOperation = 'multiply'; ch.x.fillStyle = ch.col; ch.x.fillRect(0, 0, BW, BH);
        /* stronger in the first half; from 2.4 it softens (blurred, weaker) so the coloured rings do not break up the smooth light */
        const soft = sm(2.4, 3.0, t), sc = 1 + TUNE.chrome * (1 + .4 * (1 - sm(1.7, 2.6, t)) + 1.2 * foc) * (1 - .5 * soft) * (2 - j), w = CW * sc, h = CH * sc;   /* much more while out of focus */
        const pad = 3 + 15 * soft;   /* drawn a little past the sheet's edges, so its blur does not pull in black there */
        caG.filter = `blur(${(1 + 5 * soft).toFixed(1)}px)`; caG.drawImage(ch.c, (CW - w) / 2 - pad, (CH - h) / 2 - pad, w + 2 * pad, h + 2 * pad); caG.filter = 'none';
      });
      caG.globalCompositeOperation = 'destination-in';
      const m = edgeMask(caG, CW, .08, .32 + .17 * foc);   /* out of focus: over the whole picture */
      caG.fillStyle = m; caG.fillRect(0, 0, CW, CH); jitter(caG, CW, CH);
      g.drawImage(caC, 0, 0, W, H);
    }
    mg.imageSmoothingQuality = 'high'; mg.drawImage(cv, 0, 0, MW, MH);
    /* motion blur at the left and right, the parts nearest the camera: the light there opens up and down, so it is smeared up
       and down, as far as the light is moving fast at this moment */
    const spd = Math.abs(run(t + .03) - run(t - .03)) / .06 * 2.5 + Math.abs(eio(seg(t + .03, TUNE.band0, TUNE.band1)) - eio(seg(t - .03, TUNE.band0, TUNE.band1))) / .06 * .75;
    const pb = sm(1.85, 2.1, t) * (1 - sm(2.3, 2.6, t));   /* around 2.15: the peach rims sweep through the middle; their motion blur is stronger and reaches the middle */
    const smear = 7 * cl(spd / 1.2) * (1 + .4 * (1 - sm(1.7, 2.6, t)) + 1.3 * pb);   /* stronger in the first half */
    if (smear > .5) {
      const n = 9;
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, MW, MH);
      tg.globalCompositeOperation = 'lighter'; tg.globalAlpha = 1 / n;
      for (let k = 0; k < n; k++) tg.drawImage(mid, 0, (k / (n - 1) - .5) * 2 * smear);
      tg.globalAlpha = 1; tg.globalCompositeOperation = 'destination-in';
      const m = edgeMask(tg, MW, .12 + .2 * pb, .3 + .25 * pb);
      tg.fillStyle = m; tg.fillRect(0, 0, MW, MH); jitter(tg, MW, MH);
      mg.drawImage(tmp, 0, 0); g.drawImage(tmp, 0, 0, W, H);
    }
    /* depth of field: the panel's sides are nearer the camera than the focus, so the blur grows towards the left and right */
    [[2.5, .15, .75], [5, .35, .95], [8, .55, 1.15], [12, .75, 1.35]]   /* four layers, wide overlapping ramps: no single edge where the blur stops */.forEach(([b, r0, r1]) => {
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, MW, MH);
      tg.filter = `blur(${b}px)`; tg.drawImage(mid, 0, 0); tg.filter = 'none';
      tg.globalCompositeOperation = 'destination-in';
      const m = edgeMask(tg, MW, (1 - r1) / 2, (1 - r0) / 2);
      tg.fillStyle = m; tg.fillRect(0, 0, MW, MH); jitter(tg, MW, MH);
      g.drawImage(tmp, 0, 0, W, H);
    });
    /* the focus pull: at the start the whole picture is soft, and it comes sharp by 0.75 */
    if (foc > .005) {
      mg.drawImage(cv, 0, 0, MW, MH);
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, MW, MH);
      tg.filter = `blur(${(5 * foc).toFixed(1)}px)`; tg.drawImage(mid, 0, 0); tg.filter = 'none';
      g.globalAlpha = sm(0, .2, foc); g.drawImage(tmp, 0, 0, W, H); g.globalAlpha = 1;
    }
    /* grain, over everything: faint white and black specks, a few levels either way, so compressed video does not band */
    if (TUNE.grain > 0 && !view) {
      if (!grainPat) grainPat = g.createPattern(grain, 'repeat');
      const fr = Math.round(t * 60), ox = Math.floor(hash(fr, 1) * 256), oy = Math.floor(hash(fr, 2) * 256);
      g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, .5 * TUNE.grain);
      g.translate(-ox, -oy); g.fillStyle = grainPat; g.fillRect(0, 0, W + 256, H + 256); g.restore();
    }
  }
  const VIEWS = ['colour', 'light (grey)', 'tints: violet R, peach G, settle B'];
  function setView(n) { view = ((n % VIEWS.length) + VIEWS.length) % VIEWS.length; return VIEWS[view]; }
  function resetTune() { Object.assign(TUNE, TUNE0); COLOUR_SPEC.forEach((c, k) => { c.ref[0] = COL0[k][0]; c.ref[1] = COL0[k][1]; c.ref[2] = COL0[k][2]; }); buildLut(); }
  return { render, ready: Promise.resolve(), D, palette: PALETTE, buildLut, setView, get view() { return view; },
           tune: TUNE, tuneSpec: TUNE_SPEC, colourSpec: COLOUR_SPEC, tuneDefaults: TUNE0, colourDefaults: COL0, resetTune };
}
window.GradientStudy = { create };
})();
