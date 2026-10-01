/* ---------------------------------------------------------------------------
   Generative tiles.

   Six pieces of artwork, each one drawn from a formula at runtime instead of
   loaded from a file. That is the point: a tile is correct at any size the
   grid hands it, on any pixel density, and the parameters are readable.

   Each tile is an object:
     id     slug
     label  the word in the top-left corner
     span   class suffix for its grid footprint
     math   the formula, printed on hover
     mount(host)  draws into host, returns a stop() function

   Colours come from the blue ramp in site.css. Nothing here picks a hex
   literal that is not already a token.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* --- shared ------------------------------------------------------------ */

  var _tok = {};
  /* The palette is rebuilt at runtime, so the cache has to go. */
  document.addEventListener('themechange', function () { _tok = {}; });
  function tok(name) {
    if (!(name in _tok)) {
      _tok[name] = getComputedStyle(document.documentElement)
        .getPropertyValue(name).replace(/\s+/g, ' ').trim();
    }
    return _tok[name];
  }
  function still() {
    return document.documentElement.getAttribute('data-motion') === 'off' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* hex to [r,g,b] and back, with a linear-light mix in between. Blending in
     sRGB directly turns a blue-to-white ramp muddy through the middle. */
  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toSrgb(c) {
    c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255);
  }
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b), o = [];
    for (var i = 0; i < 3; i++) o[i] = toSrgb(toLin(A[i]) * (1 - t) + toLin(B[i]) * t);
    return 'rgb(' + o[0] + ',' + o[1] + ',' + o[2] + ')';
  }
  /* Position on the five-stop blue ramp, 0 dark to 1 light. */
  function blue(t) {
    var ramp = ['--ramp-1', '--ramp-2', '--ramp-3', '--ramp-4', '--ramp-5', '--ramp-6'];
    t = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
    var i = Math.min(ramp.length - 2, Math.floor(t));
    return mix(tok(ramp[i]), tok(ramp[i + 1]), t - i);
  }
  function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  /* The flow field leaves trails by drawing the tile colour over the last
     frame at low alpha. That colour is a token, so it follows the theme
     instead of being a near-black literal. */
  function fade() {
    var c = rgb(tok('--surface'));
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',.085)';
  }

  /* A canvas that keeps itself the size of its host, runs a draw loop while
     it is on screen, and draws a single frame when motion is off. */
  function scene(host, draw) {
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    host.appendChild(cv);

    var w = 0, h = 0, raf = 0, running = false, t0 = performance.now(), fresh = true;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fresh = true;
    }

    function frame(now) {
      if (still()) { running = false; raf = 0; return; }
      draw(ctx, w, h, (now - t0) / 1000, fresh);
      fresh = false;
      raf = running ? requestAnimationFrame(frame) : 0;
    }
    function start() {
      if (running) return;
      if (still()) { size(); draw(ctx, w, h, 0, true); return; }
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    /* The switch in the header fires this. Turning motion off leaves the last
       frame on screen; turning it back on picks the loop up again. */
    var onMotion = function () { if (still()) stop(); else start(); };
    document.addEventListener('motionchange', onMotion);

    size();
    var ro = window.ResizeObserver ? new ResizeObserver(size) : null;
    if (ro) ro.observe(host);

    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) start(); else stop();
    }, { rootMargin: '120px' }) : null;
    if (io) io.observe(host); else start();

    function teardown() {
      stop();
      document.removeEventListener('motionchange', onMotion);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
    }
    /* With motion off there is no loop, so a piece that answers the pointer
       has no way to show the answer. This draws exactly one frame. */
    teardown.redraw = function () {
      if (!w) size();
      draw(ctx, w, h, (performance.now() - t0) / 1000, true);
    };
    return teardown;
  }

  /* --------------------------------------------------------------------- */
  /* Motion — a family of logistic curves                                   */
  /* --------------------------------------------------------------------- */

  var curves = {
    id: 'motion',
    label: 'Motion',
    span: 'tile--2x2',
    math: 'f(x) = 1 / (1 + e^-k(x - 0.5)),  k = 5 … 16',
    mount: function (host) {
      var ks = [5, 7, 9, 12, 16];

      /* ---- the toy ------------------------------------------------------
         Tap an empty spot to drop a shape, drag one to throw it. Shapes fall
         under gravity, bounce on the floor of the plot and on each other, and
         pile up. Colours are the six tokens of the ramp, so the toy follows the
         light/dark switch. Every collision is a circle; the drawn shapes
         (circle, hexagon, rounded square, flower, pill) only differ in how
         they look. */
      var bodies = [], drag = null, lastT = 0, touched = false, ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
      var G = 1900, MAXN = 34;
      var KINDS = ['circle', 'hex', 'square', 'flower', 'pill'];
      function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
      function colour() { return tok('--c' + (1 + Math.floor(Math.random() * 6))) || '#4aa3ff'; }

      function drawBody(ctx, b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.col; ctx.strokeStyle = b.col; ctx.lineJoin = 'round';
        var r = b.r;
        if (b.kind === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
        } else if (b.kind === 'hex') {
          ctx.lineWidth = r * 0.34;
          ctx.beginPath();
          for (var i = 0; i < 6; i++) {
            var an = i * Math.PI / 3 + Math.PI / 6, rr = r * 0.84;
            ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (b.kind === 'square') {
          var q = r * 0.78;
          ctx.lineWidth = r * 0.5;
          ctx.fillRect(-q, -q, q * 2, q * 2);
          ctx.strokeRect(-q, -q, q * 2, q * 2);
        } else if (b.kind === 'flower') {
          var lr = r * 0.56;
          ctx.beginPath();
          for (var k = 0; k < 4; k++) {
            var ak = k * Math.PI / 2 + Math.PI / 4;
            ctx.moveTo(Math.cos(ak) * r * 0.5 + lr, Math.sin(ak) * r * 0.5);
            ctx.arc(Math.cos(ak) * r * 0.5, Math.sin(ak) * r * 0.5, lr, 0, 6.2832);
          }
          ctx.moveTo(r * 0.45, 0); ctx.arc(0, 0, r * 0.45, 0, 6.2832);
          ctx.fill();
        } else {
          ctx.lineWidth = r; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
        }
        ctx.restore();
      }

      function spawn(x, y, w, h) {
        var base = Math.max(14, Math.min(w, h) * 0.075);
        var r = base * (0.8 + Math.random() * 0.7);
        bodies.push({ x: x, y: y, vx: (Math.random() - 0.5) * 120, vy: 0, r: r,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4,
          kind: pick(KINDS), col: colour() });
        if (bodies.length > MAXN) bodies.shift();
      }

      function step(dt, w, h) {
        var i, j, b;
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          if (b === drag) {
            /* follows the pointer with a little lag, which is what makes a throw feel weighted */
            b.vx = (ptr.x - b.x) * 22; b.vy = (ptr.y - b.y) * 22;
            b.x += b.vx * dt; b.y += b.vy * dt;
            b.rot += b.vr * dt;
            continue;
          }
          b.vy += G * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.rot += b.vr * dt;
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.4; }
          if (b.x > w - b.r) { b.x = w - b.r; b.vx = -b.vx * 0.4; }
          if (b.y > h - b.r) {
            b.y = h - b.r;
            b.vy = Math.abs(b.vy) < 60 ? 0 : -b.vy * 0.38;
            b.vx *= Math.exp(-4 * dt);
            b.vr = b.vx / b.r;
          }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.3; }
        }
        for (var pass = 0; pass < 3; pass++) {
          for (i = 0; i < bodies.length; i++) {
            for (j = i + 1; j < bodies.length; j++) {
              var A = bodies[i], B = bodies[j];
              var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
              var min = (A.r + B.r) * 0.96;
              if (d >= min) continue;
              var nx = dx / d, ny = dy / d, over = min - d;
              var ma = A.r * A.r, mb = B.r * B.r, tot = ma + mb;
              var fa = A === drag ? 0 : (B === drag ? 1 : mb / tot);
              var fb = B === drag ? 0 : (A === drag ? 1 : ma / tot);
              A.x -= nx * over * fa; A.y -= ny * over * fa;
              B.x += nx * over * fb; B.y += ny * over * fb;
              var rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
              if (rv < 0) {
                var imp = -(1 + 0.3) * rv / (1 / ma + 1 / mb);
                if (A !== drag) { A.vx -= imp * nx / ma; A.vy -= imp * ny / ma; }
                if (B !== drag) { B.vx += imp * nx / mb; B.vy += imp * ny / mb; }
              }
            }
          }
        }
      }

      function local(e) {
        var r = host.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      function hit(x, y) {
        for (var i = bodies.length - 1; i >= 0; i--) {
          var b = bodies[i], dx = x - b.x, dy = y - b.y;
          if (dx * dx + dy * dy <= b.r * b.r * 1.1) return b;
        }
        return null;
      }
      var dim = { w: 0, h: 0 };
      function down(e) {
        if (still()) return;
        var p = local(e); ptr.x = p.x; ptr.y = p.y; ptr.vx = ptr.vy = 0; ptr.t = performance.now();
        var b = hit(p.x, p.y);
        if (!b) { spawn(p.x, p.y, dim.w, dim.h); b = bodies[bodies.length - 1]; }
        drag = b; touched = true;
        try { host.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault();
      }
      function move(e) {
        if (!drag) return;
        var p = local(e), now = performance.now(), dtm = Math.max(1, now - ptr.t) / 1000;
        ptr.vx = (p.x - ptr.x) / dtm * 0.6 + ptr.vx * 0.4;
        ptr.vy = (p.y - ptr.y) / dtm * 0.6 + ptr.vy * 0.4;
        ptr.x = p.x; ptr.y = p.y; ptr.t = now;
      }
      function up() {
        if (!drag) return;
        var c = function (v) { return Math.max(-1700, Math.min(1700, v)); };
        drag.vx = c(ptr.vx); drag.vy = c(ptr.vy);
        drag.vr = drag.vx / drag.r;
        drag = null;
      }
      host.style.touchAction = 'none';
      host.style.cursor = 'pointer';
      host.addEventListener('pointerdown', down);
      host.addEventListener('pointermove', move);
      host.addEventListener('pointerup', up);
      host.addEventListener('pointercancel', up);
      /* a drag on the toy must not be read as a page-turning swipe by the pager */
      ['touchstart', 'touchmove', 'touchend'].forEach(function (n) {
        host.addEventListener(n, function (e) { e.stopPropagation(); }, { passive: true });
      });
      /* double click clears the floor */
      host.addEventListener('dblclick', function () { bodies.length = 0; drag = null; });

      var stopScene = scene(host, function (ctx, w, h, t) {
        dim.w = w; dim.h = h;

        var padX = Math.max(26, w * 0.09), padY = Math.max(26, h * 0.13);
        var pw = w - padX * 2, ph = h - padY * 2;
        ctx.clearRect(0, 0, w, h);

        /* plot grid */
        ctx.strokeStyle = 'rgba(0,0,0,.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var i = 0; i <= 12; i++) {
          var gx = Math.round(padX + pw * i / 12) + 0.5;
          ctx.moveTo(gx, padY); ctx.lineTo(gx, padY + ph);
        }
        for (var j = 0; j <= 8; j++) {
          var gy = Math.round(padY + ph * j / 8) + 0.5;
          ctx.moveTo(padX, gy); ctx.lineTo(padX + pw, gy);
        }
        ctx.stroke();

        /* the curves, normalised so every k starts at 0 and ends at 1 */
        ks.forEach(function (k, n) {
          var lo = 1 / (1 + Math.exp(k * 0.5));
          var hi = 1 / (1 + Math.exp(-k * 0.5));
          var f = function (x) { return (1 / (1 + Math.exp(-k * (x - 0.5))) - lo) / (hi - lo); };

          ctx.strokeStyle = blue(0.35 + 0.6 * n / (ks.length - 1));
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          for (var s = 0; s <= 90; s++) {
            var x = s / 90;
            var px = padX + x * pw, py = padY + ph - f(x) * ph;
            if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();

          /* one dot per curve, all released at the same moment */
          var tau = ((t / 3.4) + n * 0.045) % 1;
          ctx.fillStyle = tok('--ink');
          ctx.beginPath();
          ctx.arc(padX + tau * pw, padY + ph - f(tau) * ph, 3.4, 0, 6.2832);
          ctx.fill();
        });

        /* the two ends of the track */
        ctx.fillStyle = blue(0.7);
        [[padX, padY + ph], [padX + pw, padY]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 4.2, 0, 6.2832); ctx.fill();
        });
        /* the toy, drawn over the curves */
        var dt = lastT ? Math.min(0.033, Math.max(0.001, t - lastT)) : 0.016;
        lastT = t;
        step(dt, w, h);
        for (var gi = 0; gi < bodies.length; gi++) drawBody(ctx, bodies[gi]);
        if (!touched) {
          ctx.font = '500 11px ' + (tok('--mono') || 'ui-monospace, monospace');
          ctx.fillStyle = tok('--ink'); ctx.globalAlpha = 0.55; ctx.textAlign = 'right';
          ctx.fillText('tap to drop \u00b7 drag to throw \u00b7 double-tap to clear', w - 14, 20);
          ctx.globalAlpha = 1; ctx.textAlign = 'left';
        }
      });
      return function () {
        host.removeEventListener('pointerdown', down);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerup', up);
        host.removeEventListener('pointercancel', up);
        if (stopScene) stopScene();
      };
    }
  };

  /* --------------------------------------------------------------------- */
  /* Color — a ramp built by smoothstep, not by dropping stops              */
  /* --------------------------------------------------------------------- */

  var ramp = {
    id: 'color',
    label: 'Color',
    span: 'tile--1x2',
    math: 'mix(a, b, t) where t = s²(3 - 2s)',
    mount: function (host) {
      return scene(host, function (ctx, w, h, t) {
        ctx.clearRect(0, 0, w, h);
        /* During the first layout pass the host can be a pixel wide. Clamp the
           inset so the box never goes negative and roundRect never sees a
           negative radius. */
        var m = Math.min(Math.max(14, Math.min(w, h) * 0.11), w * 0.4, h * 0.4);
        var x = m, y = m;
        var bw = Math.max(1, w - m * 2), bh = Math.max(1, h - m * 2);
        var r = Math.max(0, Math.min(20, bw * 0.12));

        /* 24 stops sampled off the curve, so the midpoint sits where the
           formula puts it rather than where a colour picker did */
        var g = ctx.createLinearGradient(0, y, 0, y + bh);
        for (var i = 0; i <= 24; i++) {
          var s = i / 24;
          var e = smoothstep(s);
          g.addColorStop(s, blue(0.10 + 0.74 * (1 - e)));
        }

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, r);
        else ctx.rect(x, y, bw, bh);
        ctx.fillStyle = g;
        ctx.fill();

        /* the sampling line, with four handles drifting on their own sines */
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1;
        var cx = x + bw / 2;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + bh); ctx.stroke();
        for (var k = 0; k < 4; k++) {
          var base = 0.12 + k * 0.26;
          var p = base + Math.sin(t * 0.55 + k * 1.7) * 0.035;
          var py = y + bh * p;
          ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.62)' : '#fff';
          ctx.beginPath();
          ctx.arc(cx, py, k % 2 ? 2.6 : 3.6, 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      });
    }
  };

  /* --------------------------------------------------------------------- */
  /* Field — particles walking a closed-form vector field                   */
  /* --------------------------------------------------------------------- */

  var field = {
    id: 'field',
    label: 'Field',
    span: 'tile--2x2',
    math: 'θ = 1.7 sin(0.011x + 0.35t) + 1.7 cos(0.013y - 0.27t)',
    mount: function (host) {
      var ps = null, lastW = 0, lastH = 0;
      return scene(host, function (ctx, w, h, t, fresh) {
        if (fresh || !ps || w !== lastW || h !== lastH) {
          lastW = w; lastH = h;
          ps = [];
          var n = Math.round(Math.min(560, Math.max(150, w * h / 320)));
          for (var i = 0; i < n; i++) {
            ps.push({ x: Math.random() * w, y: Math.random() * h, life: Math.random() * 120 });
          }
          ctx.fillStyle = tok('--surface');
          ctx.fillRect(0, 0, w, h);
        }

        /* the trail: last frame dimmed, never fully cleared */
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = fade();
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        for (var p, a, nx, ny, i2 = 0; i2 < ps.length; i2++) {
          p = ps[i2];
          a = 1.7 * Math.sin(p.x * 0.011 + t * 0.35) +
              1.7 * Math.cos(p.y * 0.013 - t * 0.27);
          nx = p.x + Math.cos(a) * 1.05;
          ny = p.y + Math.sin(a) * 1.05;

          ctx.strokeStyle = blue(0.62 - 0.42 * (0.5 + 0.5 * Math.sin(a)));
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(nx, ny);
          ctx.stroke();

          p.x = nx; p.y = ny; p.life--;
          if (p.life < 0 || p.x < -4 || p.x > w + 4 || p.y < -4 || p.y > h + 4) {
            p.x = Math.random() * w; p.y = Math.random() * h; p.life = 90 + Math.random() * 130;
          }
        }
      });
    }
  };

  /* --------------------------------------------------------------------- */
  /* Icon — the four-point star as a polar equation                         */
  /* --------------------------------------------------------------------- */

  /* --- her clover ---------------------------------------------------------
     Read straight out of the PNG she sent, not approximated: 24x24, her own
     pixels, symmetric both ways. The polar equation the tile used to draw is
     a four-point star, which is a different shape — it has points, and this
     has leaves with notches cut between them. No equation is being fitted to
     it; the bitmap IS the target. */
  var CLOVER = [
    '..########....########..',
    '..########....########..',
    '##########....##########',
    '##########....##########',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '....################....',
    '....################....',
    '....################....',
    '....################....',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '########################',
    '##########....##########',
    '##########....##########',
    '..########....########..',
    '..########....########..'
  ];
  var CN = CLOVER.length;

  /* Signed distance from every cell to the clover's edge, in cells, negative
     inside. Brute force over 576 cells, which is 331k comparisons once at
     load — cheaper to write than a distance transform and invisible next to
     one frame of anything else on this page.

     This is what lets a circle become the clover. Interpolating "is this cell
     filled" between two bitmaps gives noise; interpolating DISTANCE and
     re-thresholding gives a boundary that walks from one shape to the other,
     which is the same trick the morph field uses with radii. */
  /* Signed distance from every cell to a mask's edge, in cells, negative
     inside. Brute force over 576 cells, which is 331k comparisons per shape —
     cheaper to write than a distance transform and invisible next to one
     frame of anything else on this page.

     This is what lets one shape become another. Interpolating "is this cell
     filled" between two bitmaps gives noise; interpolating DISTANCE and
     re-thresholding gives a boundary that walks from one shape to the other,
     which is the same trick the morph field uses with radii. */
  function sdfOf(inside) {
    var d = new Float32Array(CN * CN), i, j;
    for (j = 0; j < CN; j++) {
      for (i = 0; i < CN; i++) {
        var me = inside[j * CN + i], best = 1e9;
        for (var b = 0; b < CN; b++) {
          for (var a = 0; a < CN; a++) {
            if (inside[b * CN + a] === me) continue;
            var dx = a - i, dy = b - j, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < best) best = dist;
          }
        }
        d[j * CN + i] = me ? -best : best;
      }
    }
    return d;
  }

  /* The bud: a circle of this many cells. It is where the first bloom starts
     and it is the only shape here that is not a flower. */
  var BUD_R = 3.2;

  function discMask(r) {
    var m = new Uint8Array(CN * CN), mid = (CN - 1) / 2;
    for (var j = 0; j < CN; j++) {
      for (var i = 0; i < CN; i++) {
        var u = i - mid, v = j - mid;
        m[j * CN + i] = Math.sqrt(u * u + v * v) <= r ? 1 : 0;
      }
    }
    return m;
  }

  /* The other flowers are not drawn, they are solved. A cell is inside when
     its distance from the middle is under the petal profile at its angle:

       rho(a) = R * (1 - amp + amp * |cos(p*a/2)|^g)

     p counts the petals, amp is how deep the notch between two of them cuts,
     and g is the petal's shoulder: below 1 it is a narrow blade, above 1 a
     round lobe. A disc of `core` cells is always filled, because a flower
     without a middle reads as a set of loose petals.

     Her clover stays a bitmap. It is the one shape here somebody drew, it is
     always the first one you get, and nothing about it is derived. */
  function petalMask(p, amp, g, R, core) {
    var m = new Uint8Array(CN * CN), mid = (CN - 1) / 2;
    for (var j = 0; j < CN; j++) {
      for (var i = 0; i < CN; i++) {
        var u = i - mid, v = j - mid;
        var dist = Math.sqrt(u * u + v * v);
        var a = Math.atan2(v, u);
        var rho = R * (1 - amp + amp * Math.pow(Math.abs(Math.cos(p * a / 2)), g));
        m[j * CN + i] = (dist <= rho || dist <= core) ? 1 : 0;
      }
    }
    return m;
  }

  var cloverMask = (function () {
    var m = new Uint8Array(CN * CN);
    for (var j = 0; j < CN; j++) {
      for (var i = 0; i < CN; i++) m[j * CN + i] = CLOVER[j].charAt(i) === '#' ? 1 : 0;
    }
    return m;
  })();

  /* A flake on a 24-cell grid has about eleven cells of radius to work with,
     so every number here is fighting quantisation. Two things were making it
     read as scratches rather than a snowflake: arms under one cell wide, which
     the grid breaks into dashes, and no hub, which leaves six separate sticks
     that happen to meet. Both are fixed below. */
  function snowMask() {
    var arms=6, phase=0, radius=9.6+Math.random()*1.8, width=.85+Math.random()*.35;
    var branches=[radius*.34+Math.random()*.8, radius*.62+Math.random()*.8];
    var spread=1.8+Math.random()*1.4, core=1.7+Math.random()*.7;
    var m = new Uint8Array(CN * CN), mid = (CN - 1) / 2;
    function segment(x, y, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay;
      var t = Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
      return Math.hypot(x-ax-t*dx, y-ay-t*dy);
    }
    for (var j=0;j<CN;j++) for (var i=0;i<CN;i++) {
      var x=i-mid,y=j-mid,hit=Math.hypot(x,y)<=core;
      for (var arm=0;arm<arms && !hit;arm++) {
        var a=arm*Math.PI*2/arms+phase,c=Math.cos(a),s=Math.sin(a);
        var u=x*c+y*s,v=-x*s+y*c;
        if (segment(u,v,0,0,radius,0)<width) hit=true;
        branches.forEach(function (r) {
          if (segment(u,v,r,0,r-spread,spread)<width || segment(u,v,r,0,r-spread,-spread)<width) hit=true;
        });
      }
      m[j*CN+i]=hit?1:0;
    }
    return m;
  }

  /* Recipes, not three free numbers. generate() used to roll amp, g and core
     independently, and at a shallow amp with a round shoulder and a fat core
     all three cancel: the notches close up and what comes out is a disc with
     dents in it. Each row below is a kind of flower that survives 24 cells,
     and the jitter is small enough that it stays that kind.
       p = petals, amp = notch depth, g = shoulder, R = radius */
  var PETALS = [
    [5,  .44, .72, 10.4],   /* cosmos   - five broad petals   */
    [6,  .48, .58, 10.6],   /* anemone  - six, slightly split */
    [8,  .52, .48, 10.8],   /* daisy    - eight narrow        */
    [4,  .40, 1.0, 10.0],   /* dogwood  - four round lobes    */
    [6,  .60, .36, 11.0],   /* aster    - deep, blade-like    */
    [10, .46, .52, 10.8]    /* marigold                       */
  ];
  function randomPetal() {
    var r = PETALS[Math.floor(Math.random() * PETALS.length)];
    var amp = r[1] + (Math.random() - .5) * .10;
    var g   = r[2] * (.85 + Math.random() * .3);
    var R   = r[3] + (Math.random() - .5) * 1.2;
    /* The core has to sit INSIDE the notch. A core wider than the profile's
       minimum radius fills the gaps between the petals, and the flower goes
       back to being the disc this list exists to avoid. */
    var core = Math.min(2.9, R * (1 - amp) * .55);
    return petalMask(r[0], amp, g, R, core);
  }

  var FLOWERS = [
    { name: 'clover', mask: cloverMask },
    { name: 'daisy',     mask: petalMask(8,  0.46, 0.55, 10.6, 2.6) },
    { name: 'cosmos',    mask: petalMask(5,  0.38, 0.85, 10.2, 2.4) },
    { name: 'anemone',   mask: petalMask(6,  0.42, 0.62, 10.6, 2.8) },
    { name: 'aster',     mask: petalMask(12, 0.52, 0.34, 11.0, 2.6) },
    { name: 'dogwood',   mask: petalMask(4,  0.34, 1.35, 10.0, 2.2) },
    { name: 'marigold',  mask: petalMask(10, 0.30, 0.75, 10.8, 3.4) },
    { name: 'snowflake', mask: snowMask() }
  ];

  /* Distance fields cost 331k comparisons each, so none is built until the
     flower it belongs to is actually asked for. */
  var BUD = { sdf: null, mask: null };
  function budField() {
    if (!BUD.sdf) { BUD.mask = discMask(BUD_R); BUD.sdf = sdfOf(BUD.mask); }
    return BUD.sdf;
  }
  function fieldOf(n) {
    var f = FLOWERS[n];
    if (!f.sdf) f.sdf = sdfOf(f.mask);
    return f.sdf;
  }

  /* Which cells are filled part way between two fields, as a string so two
     stages can be compared. Used to find the stages worth stopping on. */
  function cellKey(A, B, e) {
    var out = '';
    for (var q = 0; q < CN * CN; q++) {
      if (A[q] + (B[q] - A[q]) * e <= 0) out += q + ';';
    }
    return out;
  }

  /* Pixel art does not tween, it has frames. So the bloom is quantised — but
     not into a round number of equal steps, which was the first attempt and
     wasted half of them: a sixteenth of the way is often not enough to move a
     single cell, and a frame that changes nothing is not a frame, it is a
     stutter.

     Instead the stages are found. Sweep e from 0 to 1, keep the values where
     the set of filled cells actually differs, then thin to twenty so each is
     held long enough to be a frame you could stop on. The last one is kept
     whatever the count: it is the target shape, exactly. */
  var STAGE_CACHE = {};
  function stagesFor(key, A, B) {
    /* A null key means A is a field nobody will ask for twice — the shape
       caught part way through a morph — so there is nothing worth keeping. */
    if (key && STAGE_CACHE[key]) return STAGE_CACHE[key];
    var out = [], prev = null;
    for (var q = 0; q <= 240; q++) {
      var e = q / 240, k = cellKey(A, B, e);
      if (k !== prev) { out.push(e); prev = k; }
    }
    var MAX = 20;
    if (out.length > MAX) {
      var thin = [];
      for (var t = 0; t < MAX; t++) thin.push(out[Math.round(t / (MAX - 1) * (out.length - 1))]);
      out = thin;
    }
    if (out[out.length - 1] !== 1) out.push(1);
    if (key) STAGE_CACHE[key] = out;
    return out;
  }

  var star = {
    id: 'icon',
    label: 'Icon',
    span: '',
    math: 'Hover to grow · leave to pause',
    mount: function (host) {
      // Fresh procedural targets; interpolation freezes exactly on pointer leave.
      var from = sdfOf(petalMask(6,.48,.58,10.6,2.4)), to = from;
      var k = 1, last = 0, active = false, hue = 0, hueFrom = 0, hueTarget = 0;
      var generation = 0, api;
      host.tabIndex = 0;
      host.setAttribute('role', 'button');
      host.setAttribute('aria-label', 'Random flower: hover or hold to transform, leave or release to pause');
      function eNow() { return k*k*(3-2*k); }
      function generate() {
        var e=eNow(), snap=new Float32Array(CN*CN);
        for(var q=0;q<snap.length;q++) snap[q]=from[q]+(to[q]-from[q])*e;
        from=snap;
        var mask = Math.random()<.5 ? snowMask() : randomPetal();
        to=sdfOf(mask);
        k=0;hueFrom=hue;
        var shift=(Math.random()<.5?-1:1)*(5+Math.random()*8);
        if(Math.abs(hue+shift)>28) shift=-shift;
        hueTarget=hue+shift;
        host.setAttribute('data-generation', String(++generation));
      }
      function begin() {
        if(active) return;
        active=true;host.setAttribute('data-generating','true');
        if(k>=1) generate();
        if(still()) { k=1;hue=hueTarget;if(api) api.redraw(); }
      }
      function pause() { active=false;host.setAttribute('data-generating','false'); }
      function enter(e) { if(e.pointerType!=='touch') begin(); }
      function down() { begin(); }
      function up(e) { if(e.pointerType!=='mouse') pause(); }
      function key(e) { if(e.key==='Enter'||e.key===' ') { e.preventDefault();begin(); } }
      function keyUp(e) { if(e.key==='Enter'||e.key===' ') {e.preventDefault();pause();} }
      host.addEventListener('pointerenter',enter);
      host.addEventListener('pointerleave',pause);
      host.addEventListener('pointerdown',down);
      host.addEventListener('pointerup',up);
      host.addEventListener('pointercancel',pause);
      host.addEventListener('keydown',key);
      host.addEventListener('keyup',keyUp);
      host.addEventListener('blur',pause);

      var stop = api = scene(host, function (ctx, w, h, t, fresh) {
        var dt=fresh?.016:Math.max(0,Math.min(.05,t-last));last=t;
        if(active && !still()) {
          if(k>=1) generate();
          k=Math.min(1,k+dt/1.15);
          hue=hueFrom+(hueTarget-hueFrom)*eNow();
        }

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.filter = 'hue-rotate(' + hue + 'deg)';

        var e = eNow();
        // Fit the current silhouette, including intermediate morphs, to one size.
        var minX=CN,minY=CN,maxX=-1,maxY=-1;
        for(var y=0;y<CN;y++) for(var x=0;x<CN;x++) {
          var at=y*CN+x;
          if(from[at]+(to[at]-from[at])*e<=0) {
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);
            minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
        }
        if(maxX<0) { ctx.restore();return; }
        var size=Math.round(Math.min(w,h)*.76);
        var cell=size/Math.max(maxX-minX+1,maxY-minY+1);
        var ox=(w-(maxX-minX+1)*cell)/2-minX*cell;
        var oy=(h-(maxY-minY+1)*cell)/2-minY*cell;

        var g = ctx.createLinearGradient(ox, oy, ox + CN * cell, oy + CN * cell);
        g.addColorStop(0, tok('--c1'));
        g.addColorStop(0.34, tok('--c2'));
        g.addColorStop(0.68, tok('--c3'));
        g.addColorStop(1, tok('--c5'));
        ctx.fillStyle = g;

        for (var j = 0; j < CN; j++) {
          for (var i = 0; i < CN; i++) {
            var q = j * CN + i;
            if (from[q] + (to[q] - from[q]) * e <= 0) {
              var left=Math.round(ox+i*cell),top=Math.round(oy+j*cell);
              ctx.fillRect(left,top,Math.round(ox+(i+1)*cell)-left,Math.round(oy+(j+1)*cell)-top);
            }
          }
        }
        ctx.restore();
      });

      return function () {
        host.removeEventListener('pointerenter',enter);
        host.removeEventListener('pointerleave',pause);
        host.removeEventListener('pointerdown',down);
        host.removeEventListener('pointerup',up);
        host.removeEventListener('pointercancel',pause);
        host.removeEventListener('keydown',key);
        host.removeEventListener('keyup',keyUp);
        host.removeEventListener('blur',pause);
        stop();
      };
    }
  };

  var path = {
    id: 'path',
    label: 'Path',
    span: '',
    math: 'Move to reshape · click for another orbit',
    mount: function (host) {
      var tx=.5,ty=.5,px=.5,py=.5,changed=false,mode=0,blend=1;
      var modes=[[3,2],[5,4],[2,3],[5,2]],old=modes[0],current=modes[0],api;
      host.tabIndex=0;host.setAttribute('role','button');
      host.setAttribute('aria-label','Reshape path with pointer or arrow keys. Click or Enter changes orbit.');
      host.style.touchAction='none';
      function redraw() { if(still()&&api) api.redraw(); }
      function move(e) {
        var r=host.getBoundingClientRect();
        tx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
        ty=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));changed=true;redraw();
      }
      function cycle() {
        old=current;mode=(mode+1)%modes.length;current=modes[mode];blend=0;
        host.setAttribute('data-orbit',String(mode));redraw();
      }
      function key(e) {
        if(e.key==='Enter'||e.key===' ') {e.preventDefault();cycle();return;}
        if(!/^Arrow/.test(e.key)) return;
        e.preventDefault();e.stopPropagation();changed=true;
        tx=Math.max(0,Math.min(1,tx+(e.key==='ArrowRight'?.08:e.key==='ArrowLeft'?-.08:0)));
        ty=Math.max(0,Math.min(1,ty+(e.key==='ArrowDown'?.08:e.key==='ArrowUp'?-.08:0)));redraw();
      }
      host.addEventListener('pointermove',move);
      host.addEventListener('click',cycle);
      host.addEventListener('keydown',key);
      var stop=api=scene(host, function (ctx, w, h, t) {
        px=still()?tx:px+(tx-px)*.12;py=still()?ty:py+(ty-py)*.12;
        blend=still()?1:Math.min(1,blend+.035);
        ctx.clearRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2;
        var rx = w * (.26+.12*(1-py)), ry = h * (.16+.25*py);
        var phi = changed ? (px-.5)*Math.PI*2 : t * 0.3;
        function point(s) {
          var ease=blend*blend*(3-2*blend);
          var x1=Math.sin(old[0]*s+phi),x2=Math.sin(current[0]*s+phi);
          var y1=Math.sin(old[1]*s),y2=Math.sin(current[1]*s);
          return [cx+rx*(x1+(x2-x1)*ease),cy+ry*(y1+(y2-y1)*ease)];
        }

        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        var pathGradient=ctx.createLinearGradient(cx-rx,cy-ry,cx+rx,cy+ry);
        pathGradient.addColorStop(0,tok('--c1'));
        pathGradient.addColorStop(.5,tok('--c2'));
        pathGradient.addColorStop(1,tok('--c3'));
        ctx.strokeStyle = pathGradient;
        ctx.beginPath();
        for (var i = 0; i <= 480; i++) {
          var s = i / 480 * Math.PI * 2;
          var p = point(s), x=p[0], y=p[1];
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();

        var s2 = (t * 0.7) % (Math.PI * 2);
        ctx.fillStyle = tok('--ink');
        ctx.beginPath();
        var dot=point(s2);
        ctx.arc(dot[0],dot[1], 3.2, 0, 6.2832);
        ctx.fill();
      });
      return function () {
        host.removeEventListener('pointermove',move);
        host.removeEventListener('click',cycle);
        host.removeEventListener('keydown',key);stop();
      };
    }
  };

  /* --------------------------------------------------------------------- */
  /* Gesture — a lattice bent by a gaussian under the pointer               */
  /* --------------------------------------------------------------------- */

  /* hex to h,s,l so a palette colour can be shifted in hue without leaving
     the palette's own saturation and lightness behind. */
  function hslOf(hex) {
    var c = rgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 2, h = 0, sat = 0;
    if (d) {
      sat = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: h, s: sat * 100, l: l * 100 };
  }
  function hslStr(c, dh) {
    return 'hsl(' + (((c.h + (dh || 0)) % 360 + 360) % 360).toFixed(1) +
           ',' + c.s.toFixed(1) + '%,' + c.l.toFixed(1) + '%)';
  }

  var lattice = {
    id: 'gesture',
    label: 'Gesture',
    span: 'tile--2x2',
    math: 'hidden dot: Δh · e^(-d² / 2σ²)  — the field reveals it',
    mount: function (host) {
      /* Two things share this grid and they do not interfere.

         The Gaussian decides SIZE, as the tile always did. It also decides
         what you can SEE: one dot is Δh degrees off the others, and that
         difference is multiplied by the same e^(-d²/2σ²) — so at rest every
         dot is exactly the site blue and the odd one is invisible. You sweep
         the pointer across the grid like a torch and it gives the colour up
         only where the field is strong. Find it, press it.

         With no pointer nothing is revealed at all. The attractor still walks
         its Lissajous path so the tile is alive on the page, but it moves the
         sizes only — an idle loop that solved the puzzle for you would be the
         whole game, played by nobody.

         Colours are the site's own six. The base walks --c1, --c3, --c4 … one
         step per find, so a round is always a colour this site already uses,
         and never the one you just had. */
      var PALETTE = ['--c1', '--c3', '--c4', '--c2', '--c6', '--c5'];
      var DH0 = 34, DH_MIN = 7;
      var TRAVEL = 0.46, POP = 0.44;   /* front crossing time, bounce tail */

      var px = -999, py = -999, hasPointer = false;
      var slot = 0, dh = DH0, found = 0, round = 0;
      var odd = null, grid = null, api = null;
      var seen = null;                /* how much of each cell you have swept */
      var sweepAt = -9, sweepX = 0, sweepY = 0, prevSlot = 0;

      function pick() {
        if (!grid) return;
        /* a new round covers the board again */
        seen = new Float32Array(grid.cols * grid.rows);
        var c, r;
        do {
          c = Math.floor(Math.random() * grid.cols);
          r = Math.floor(Math.random() * grid.rows);
        } while (odd && c === odd.c && r === odd.r && grid.cols * grid.rows > 1);
        odd = { c: c, r: r };
      }

      function move(e) {
        var b = host.getBoundingClientRect();
        px = e.clientX - b.left; py = e.clientY - b.top; hasPointer = true;
      }
      function leave() { hasPointer = false; }

      function press(e) {
        if (!grid || !odd) return;
        var b = host.getBoundingClientRect();
        var x = e.clientX - b.left, y = e.clientY - b.top;
        var ox = grid.ox + odd.c * grid.step, oy = grid.oy + odd.r * grid.step;
        /* a generous target: the dot is a few pixels across, and a game you
           lose to your own mouse is not a game */
        var reach = grid.step * 0.5;
        if (Math.abs(x - ox) > reach || Math.abs(y - oy) > reach) return;

        found++; round++;
        prevSlot = slot;
        slot = (slot + 1) % PALETTE.length;
        dh = Math.max(DH_MIN, DH0 * Math.pow(0.88, round));
        sweepAt = grid.t; sweepX = ox; sweepY = oy;
        pick();
        /* the answer has to appear whether or not a frame was going to run */
        if (api && api.redraw) api.redraw();
      }

      host.addEventListener('pointermove', move);
      host.addEventListener('pointerleave', leave);
      host.addEventListener('pointerdown', press);

      var stop = api = scene(host, function (ctx, w, h, t) {
        ctx.clearRect(0, 0, w, h);
        var step = Math.max(16, Math.min(w, h) / 11);
        var cols = Math.floor(w / step), rows = Math.floor(h / step);
        var ox = (w - (cols - 1) * step) / 2, oy = (h - (rows - 1) * step) / 2;
        var changed = !grid || grid.cols !== cols || grid.rows !== rows;
        grid = { cols: cols, rows: rows, step: step, ox: ox, oy: oy, t: t };
        if (changed || !odd || !seen) pick();

        var ax = hasPointer ? px : w * (0.5 + 0.34 * Math.sin(t * 0.47));
        var ay = hasPointer ? py : h * (0.5 + 0.34 * Math.sin(t * 0.61 + 1.1));
        /* A tight field. At 0.24 the torch lit about a third of the grid at
           once and the odd dot fell into it without being looked for; the
           search was over before it started. */
        var sigma = Math.min(w, h) * 0.13;
        var two = 2 * sigma * sigma;

        var now = hslOf(tok(PALETTE[slot]));
        var was = hslOf(tok(PALETTE[prevSlot]));

        /* The refresh. A front leaves the dot you just found, and every dot
           it reaches takes the new colour and bounces once.

           The bounce is a damped sine on the RADIUS: 1 + A e^(-kt) sin(wt).
           At t = 0 the sine is 0, so a dot starts at exactly the size it
           already was and there is no step to see — the first version swapped
           the colour at the front and that hard edge was the whole animation,
           which is what made it read as coarse. Each dot has its own t, so
           the tile ripples instead of flipping. */
        var age = t - sweepAt;
        var diag = Math.sqrt(w * w + h * h);
        var running = age >= 0 && age < TRAVEL + POP;

        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var x = ox + c * step, y = oy + r * step;
            var dx = x - ax, dy = y - ay;
            var g = Math.exp(-(dx * dx + dy * dy) / two);
            var rad = 1.1 + 4.4 * g;

            var mine = now, pop = 1, wake = 0;
            if (running) {
              var sx = x - sweepX, sy = y - sweepY;
              /* when the front gets to THIS dot, and how long ago that was */
              var local = age - Math.sqrt(sx * sx + sy * sy) / diag * TRAVEL;
              if (local < 0) mine = was;
              else {
                pop = 1 + 0.82 * Math.exp(-local * 10) * Math.sin(local * 27);
                wake = Math.exp(-local * 6);
              }
            }

            /* What the pointer has touched, it keeps. `seen` only ever goes
               up, so a cell you have swept stays swept and the odd dot stays
               out once you have been over it — you are uncovering the board,
               not holding a torch to it. Only a real pointer uncovers: the
               idle Lissajous walk moves sizes and nothing else, or the tile
               would quietly solve itself while nobody was playing. */
            var at = r * cols + c;
            if (hasPointer) {
              var rev = Math.max(0, Math.min(1, (g - 0.12) / 0.4));
              if (rev > seen[at]) seen[at] = rev;
            }

            var isOdd = odd && c === odd.c && r === odd.r;
            var shift = 0;
            if (isOdd) {
              shift = dh * seen[at];
              /* The size floor is tied to `seen` as well. A flat floor of 2.6
                 was a leak: a covered dot two and a half pixels wide among
                 one-pixel neighbours announces itself by shape, and you could
                 find it without sweeping anything. Uncovered it still needs
                 the room — a hue difference on a 1.1px dot is a rounding
                 error — so the floor arrives exactly as the colour does. */
              rad = Math.max(rad, 1.1 + 1.6 * seen[at]);
            }
            rad = Math.max(0.45, rad * pop);

            /* Every dot on the board is in the current colour; the ones the
               field is not touching just hold it at a fifth. That is what
               lets the refresh reach the dots you cannot see — `wake` brings
               them all the way up as the front passes and lets them sink
               back, so the whole grid answers a find, not only the lit part
               of it. Drawing them as flat grey meant two thirds of the board
               sat out the animation entirely. */
            /* The board keeps the round's colour throughout — what is hidden
               is the one dot's DIFFERENCE, not the colour of the grid. 0.2
               covered, 0.42 swept, 1 under the pointer, and the refresh takes
               every one of them to 1 on its way past. */
            /* The target's opacity rides on `seen` like everything else about
               it. A flat `|| isOdd` was the last thing giving it away — full
               opacity on a board of 0.2 dots made it the one solid mark on
               the tile, findable without moving the mouse. Dropping it went
               too far the other way: once swept it sank back to 0.42 as soon
               as the pointer left, so what you had uncovered was barely
               there. Tied to `seen` it is invisible at 0 and solid at 1, and
               what you uncovered stays uncovered. */
            var floorA = 0.2 + 0.22 * seen[at];
            if (isOdd) floorA = Math.max(floorA, seen[at]);
            ctx.globalAlpha = Math.max(g > 0.02 ? 1 : floorA, floorA + (1 - floorA) * wake);
            ctx.fillStyle = hslStr(mine, shift);
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, 6.2832);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        /* No ring on the wavefront any more. It was there to show where the
           colour was changing, and the dots now say that themselves. */

        if (found) {
          ctx.fillStyle = 'rgba(0,0,0,.34)';
          ctx.font = '500 10px ' + (tok('--mono') || 'monospace');
          ctx.textAlign = 'right';
          ctx.fillText(found + ' found · Δh ' + dh.toFixed(0) + '°', w - 12, 18);
        }
      });

      return function () {
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', leave);
        host.removeEventListener('pointerdown', press);
        stop();
      };
    }
  };

  /* --------------------------------------------------------------------- */
  /* Lame - a superellipse family the pointer reshapes, and which then stands */
  /* --------------------------------------------------------------------- */

  /* One equation draws all of it:  |x/a|^n + |y/b|^n = 1.
     n is the only thing that decides what kind of shape it is. At n = 1 it is
     a diamond, at n = 2 an ellipse, and by n = 8 a rectangle with the corners
     still soft. Parametrically that is
       x = a * sgn(cos T) * |cos T|^(2/n)
       y = b * sgn(sin T) * |sin T|^(2/n)
     which is what the loop below walks.

     The rings are the same curve at scales (i/R)^p, so p decides whether they
     crowd against the outside or spread toward the middle.

     n and p are the whole state of the piece. The pointer writes them and
     nothing ever writes them back: there is no rest pose, no idle animation,
     no timeout. Taking the pointer away is not an event here, which is why
     the shape you left is the shape that stays. */
  var lame = {
    id: 'lame',
    label: 'Lame',
    span: 'tile--2x2',
    math: '|x/a|^n + |y/b|^n = 1,  n = 1.6 … 8,  R = 5,  r_i = (i/R)^p',
    mount: function (host) {
      var R=5,n=4,p=.82,nT=n,pT=p,active=false,lastX=null,lastY=null,api=null;
      host.tabIndex=0;host.style.touchAction='none';
      host.setAttribute('aria-label','Five nested shapes. Move horizontally to reshape, vertically to adjust spacing. Double-click or press R to reset.');
      function enter(e) {active=true;lastX=e.clientX;lastY=e.clientY;}
      function move(e) {
        if(lastX===null) {enter(e);return;}
        var r=host.getBoundingClientRect();if(!r.width||!r.height)return;
        active=true;
        nT=Math.max(1.6,Math.min(8,nT+(e.clientX-lastX)/r.width*7));
        pT=Math.max(.58,Math.min(1.12,pT+(e.clientY-lastY)/r.height*.8));
        lastX=e.clientX;lastY=e.clientY;
        if(still()&&api){n=nT;p=pT;api.redraw();}
      }
      function leave(){active=false;nT=n;pT=p;lastX=lastY=null;}
      function reset(){n=nT=4;p=pT=.82;if(api)api.redraw();}
      function key(e){
        if(e.key.toLowerCase()==='r'){e.preventDefault();reset();return;}
        if(!/^Arrow/.test(e.key))return;e.preventDefault();e.stopPropagation();
        n=nT=Math.max(1.6,Math.min(8,n+(e.key==='ArrowRight'?.3:e.key==='ArrowLeft'?-.3:0)));
        p=pT=Math.max(.58,Math.min(1.12,p+(e.key==='ArrowDown'?.04:e.key==='ArrowUp'?-.04:0)));
        if(api)api.redraw();
      }
      host.addEventListener('pointerenter',enter);
      host.addEventListener('pointermove',move);
      host.addEventListener('pointerleave',leave);
      host.addEventListener('pointercancel',leave);
      host.addEventListener('dblclick',reset);
      host.addEventListener('keydown',key);

      /* Grain has to be the same grain every frame or the whole piece boils.
         This is the usual sin-hash: deterministic in the sample index, so a
         dot that is 0.4px left of the curve stays 0.4px left of it. */
      function jitter(k) {
        var x = Math.sin(k * 12.9898) * 43758.5453;
        return (x - Math.floor(x)) * 2 - 1;
      }

      api = scene(host, function (ctx, w, h) {
        /* ease toward what the pointer asked for, then stop */
        if(active){
          n+=(nT-n)*.18;p+=(pT-p)*.18;
          if(Math.abs(nT-n)<.001)n=nT;
          if(Math.abs(pT-p)<.001)p=pT;
        }
        host.setAttribute('data-shape-state',n.toFixed(4)+','+p.toFixed(4));

        ctx.clearRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2;
        var ax = w * 0.38, ay = h * 0.31;
        var e = 2 / n;

        function point(T, s) {
          var c = Math.cos(T), si = Math.sin(T);
          return [
            cx + ax * s * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), e),
            cy + ay * s * (si < 0 ? -1 : 1) * Math.pow(Math.abs(si), e)
          ];
        }

        var STEPS=720;
        ctx.lineJoin='round';ctx.lineCap='round';
        for(var i=R;i>=1;i--){
          var scale=Math.pow(i/R,p),points=[],lengths=[0],total=0;
          for(var j=0;j<=STEPS;j++){
            var q=point(j/STEPS*Math.PI*2,scale);points.push(q);
            if(j){total+=Math.hypot(q[0]-points[j-1][0],q[1]-points[j-1][1]);lengths.push(total);}
          }
          // A closed ink stroke provides the silhouette; stationary grain lives inside it.
          var weight=Math.max(2,Math.min(w,h)*.008);
          ctx.strokeStyle=blue(.55+.05*(R-i));ctx.lineWidth=weight;
          ctx.beginPath();points.forEach(function(q,j){if(j)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);});
          ctx.closePath();ctx.stroke();
          var count=Math.ceil(total/1.4),seg=1;
          ctx.fillStyle=tok('--bg');ctx.globalAlpha=.28;
          for(var k=0;k<count;k++){
            var d=k/count*total;while(seg<STEPS&&lengths[seg]<d)seg++;
            var before=points[seg-1],after=points[seg],len=lengths[seg]-lengths[seg-1];
            var f=len?(d-lengths[seg-1])/len:0;
            var seed=i*10000+k,offset=jitter(seed)*weight*.32;
            var dx=after[0]-before[0],dy=after[1]-before[1];
            var x=before[0]+dx*f-dy/(len||1)*offset,y=before[1]+dy*f+dx/(len||1)*offset;
            ctx.beginPath();ctx.arc(x,y,.3+.4*Math.abs(jitter(seed+7919)),0,Math.PI*2);ctx.fill();
          }
          ctx.globalAlpha=1;
        }
        var marker=point(-Math.PI/4,1);
        ctx.fillStyle=tok('--ink');ctx.beginPath();
        ctx.arc(marker[0],marker[1],Math.max(5,Math.min(w,h)*.012),0,Math.PI*2);ctx.fill();
      });

      return function () {
        host.removeEventListener('pointerenter',enter);
        host.removeEventListener('pointermove',move);
        host.removeEventListener('pointerleave',leave);
        host.removeEventListener('pointercancel',leave);
        host.removeEventListener('dblclick',reset);
        host.removeEventListener('keydown',key);
        api();
      };
    }
  };

  /* --------------------------------------------------------------------- */
  /* Pulse - a flat ripple with an echo behind it                           */
  /* --------------------------------------------------------------------- */

  /* Ring i of a press sits at
       r_i(t) = R (1 - (1 - min(1, (t - i·lag)/life))^1.5)
     an ease-out gentle enough that three rings stay apart the whole way out.
     A squared or cubed curve piles them against the edge in the back half of
     the life and what you see is one thick band, not three rings.

     Two families are drawn. The RIPPLE is the site blue: a 1.5px hairline
     with a soft-edged 6px wake just inside it, over a very faint disc that
     fills in behind the leading ring. The ECHO follows 0.45s later and runs
     slower, three hairlines in --c1, --c3 and --c4 at a fifth of the alpha —
     the same press coming back in the site's own colours.

     Nothing here is a glow: flat strokes, flat fills, no radial gradients and
     no additive blending. It still keeps its dark stage, because a 16% tint
     has nowhere to sit on ivory. */
  var pulse = {
    id: 'pulse',
    label: 'Pulse',
    math: 'r_i(t) = R(1 - (1 - (t - i·lag)/life)^1.5),  echo at +0.45s',
    mount: function (host) {
      var RINGS = 3, LAG = 0.34, LIFE = 2.4, EASE = 1.5;
      var ECHOES = 3, ECHO_IN = 0.45, ECHO_LAG = 0.38, ECHO_LIFE = 3.2;
      var ECHO_TOK = ['--c1', '--c3', '--c4'];

      var taps = [], now = 0, lastReal = performance.now();

      /* The scene's clock only advances when a frame is drawn, and frames stop
         whenever the tile is off screen, the tab is hidden or motion is off.
         Stamping a press with `now` in those moments dates it to whenever the
         last frame happened to run, which can be seconds ago — the ring is
         then born already half expired, or already gone. This carries the
         scene's clock forward by the real time since that frame. */
      function stamp() { return now + (performance.now() - lastReal) / 1000; }

      function press(e) {
        var r = host.getBoundingClientRect();
        if (!r.width) return;
        taps.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: stamp() });
        if (taps.length > 5) taps.shift();   /* five at once is already a lot */
        if (still() && api && api.redraw) api.redraw();
      }
      function key(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        var r = host.getBoundingClientRect();
        taps.push({ x: r.width / 2, y: r.height / 2, t0: stamp() });
        if (still() && api && api.redraw) api.redraw();
      }
      host.tabIndex = 0;
      host.setAttribute('role', 'button');
      host.setAttribute('aria-label', 'Press anywhere to release a pulse');
      host.addEventListener('pointerdown', press);
      host.addEventListener('keydown', key);

      /* where ring i of a family is, or null if it has not left yet */
      function at(age, i, lag, life) {
        var a = age - i * lag;
        if (a <= 0) return null;
        var u = Math.min(1, a / life);
        return { u: u, r: 1 - Math.pow(1 - u, EASE), fade: Math.pow(1 - u, 1.1) };
      }
      function rgba(hex, a) {
        var c = rgb(hex);
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
      }
      function circle(ctx, x, y, r) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, 6.2832);
      }

      var api = scene(host, function (ctx, w, h, t) {
        now = t; lastReal = performance.now();
        ctx.clearRect(0, 0, w, h);

        var R = Math.min(w, h) * 0.46;
        var cx = w / 2, cy = h / 2;
        var BLUE = tok('--c1');

        /* the resting mark: one flat disc and one hairline around it, so the
           tile is not empty before it is pressed */
        var breathe = still() ? 0 : Math.sin(t * 1.1) * 0.035;
        ctx.fillStyle = rgba(BLUE, 0.16);
        circle(ctx, cx, cy, R * (0.15 + breathe)); ctx.fill();
        ctx.strokeStyle = rgba(BLUE, 0.34);
        ctx.lineWidth = 1.3;
        circle(ctx, cx, cy, R * (0.27 + breathe)); ctx.stroke();

        for (var p = taps.length - 1; p >= 0; p--) {
          var tp = taps[p], age = now - tp.t0;
          if (age - ECHO_IN - (ECHOES - 1) * ECHO_LAG > ECHO_LIFE) {
            taps.splice(p, 1); continue;
          }

          /* the echo, behind everything: the press coming back in the site's
             other colours, a fifth of the weight and slower than the ripple */
          for (var e = ECHOES - 1; e >= 0; e--) {
            var s = at(age - ECHO_IN, e, ECHO_LAG, ECHO_LIFE);
            if (!s) continue;
            ctx.strokeStyle = rgba(tok(ECHO_TOK[e % ECHO_TOK.length]), 0.22 * s.fade);
            ctx.lineWidth = 1.2;
            circle(ctx, tp.x, tp.y, R * s.r); ctx.stroke();
          }

          /* The tint the leading ring leaves behind it, held back until the
             ring is a third of the way out. In the first half second the
             three rings are still close together and a disc under them fills
             the gaps: the press read as one shape for its first second, which
             is exactly the second you are looking at it. */
          var lead = at(age, 0, LAG, LIFE);
          if (lead && lead.r > 0.34) {
            ctx.fillStyle = rgba(BLUE, 0.09 * lead.fade *
                                  Math.min(1, (lead.r - 0.34) / 0.2));
            circle(ctx, tp.x, tp.y, R * lead.r); ctx.fill();
          }

          /* The ripple: a wake, then the line at its leading edge. The wake
             is scaled by how far out the ring is — a 6px band on a 12px
             circle is not a wake, it is a disc, and it closes the gap to the
             ring behind it. */
          for (var i = RINGS - 1; i >= 0; i--) {
            var m = at(age, i, LAG, LIFE);
            if (!m) continue;
            var r = R * m.r;
            var wk = 6 * Math.min(1, m.r / 0.4);
            ctx.strokeStyle = rgba(BLUE, 0.20 * m.fade);
            ctx.lineWidth = wk;
            circle(ctx, tp.x, tp.y, r - wk / 2 - 0.5); ctx.stroke();
            ctx.strokeStyle = rgba(BLUE, 0.95 * m.fade);
            ctx.lineWidth = 1.5;
            circle(ctx, tp.x, tp.y, r); ctx.stroke();
          }
        }
      });

      return function () {
        host.removeEventListener('pointerdown', press);
        host.removeEventListener('keydown', key);
        api();
      };
    }
  };

  window.ART = [curves, ramp, star, path, lattice, field];
  /* Pieces that get a page of their own rather than a cell in the bento. */
  window.ART_SOLO = [lame, pulse];
})();
