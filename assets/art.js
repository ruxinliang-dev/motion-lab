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
  function scene(host, draw, demand) {
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
      var more = draw(ctx, w, h, (now - t0) / 1000, fresh);
      fresh = false;
      if (demand && more === false) running = false;
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
    document.addEventListener('themechange', redraw);

    size();
    function resized() {
      size();
      // Resizing clears a canvas even when its animation is paused.
      if (still() || demand) redraw();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resized) : null;
    if (ro) ro.observe(host);

    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) start(); else stop();
    }, { rootMargin: '120px' }) : null;
    if (io) io.observe(host); else start();

    function teardown() {
      stop();
      document.removeEventListener('motionchange', onMotion);
      document.removeEventListener('themechange', redraw);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
    }
    /* With motion off there is no loop, so a piece that answers the pointer
       has no way to show the answer. This draws exactly one frame. */
    function redraw() {
      if (!w) size();
      var more = draw(ctx, w, h, (performance.now() - t0) / 1000, true);
      fresh = false;
      if (demand && more !== false && !still()) start();
    }
    teardown.redraw = redraw;
    return teardown;
  }

  /* --------------------------------------------------------------------- */
  /* Motion — a family of logistic curves                                   */
  /* --------------------------------------------------------------------- */

  var curves = {
    id: 'motion',
    label: 'Motion',
    span: 'tile--2x2',
    math: '',
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
        if (b.pop) { var ps = 1 + 0.25 * b.pop; ctx.scale(ps, ps); b.pop = Math.max(0, b.pop - 0.06); }
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

      function make(x, y, w, h) {
        var base = Math.max(14, Math.min(w, h) * 0.075);
        var r = base * (0.8 + Math.random() * 0.7);
        return { x: x, y: y, vx: 0, vy: 0, r: r,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3,
          kind: pick(KINDS), col: colour() };
      }
      function release(b) {
        b.vx = (Math.random() - 0.5) * 60; b.vy = 0;
        bodies.push(b);
        if (bodies.length > MAXN) bodies.shift();
      }

      /* Same colour twice in contact: one bigger shape of a random kind replaces both. Its area is the sum of theirs (so it reads as
         the two joined), capped so one shape can never fill the tile. */
      function merge(A, B, i, j, w, h) {
        var cap = Math.min(w, h) * 0.3;
        var r = Math.min(cap, Math.sqrt(A.r * A.r + B.r * B.r) * 1.08);
        var M = { x: (A.x * A.r + B.x * B.r) / (A.r + B.r), y: (A.y * A.r + B.y * B.r) / (A.r + B.r),
                  vx: (A.vx + B.vx) / 2, vy: (A.vy + B.vy) / 2, r: r, rot: Math.random() * 6.28,
                  vr: (Math.random() - 0.5) * 3, kind: pick(KINDS), col: A.col, pop: 1 };
        if (drag === A || drag === B) drag = M;
        bodies.splice(j, 1); bodies.splice(i, 1); bodies.push(M);
        return true;
      }

      /* the tile opens already holding a pile: a dozen shapes are dropped and settled before the first frame is drawn */
      var seeded = false;
      function seed(w, h) {
        seeded = true;
        var n = 12, base = Math.max(14, Math.min(w, h) * 0.075);
        for (var q = 0; q < n; q++) {
          var r = base * (0.8 + Math.random() * 0.7);
          bodies.push({ x: w * (0.08 + 0.84 * Math.random()), y: -r * (1 + q * 1.6), vx: 0, vy: 0, r: r,
            rot: Math.random() * 6.28, vr: 0, kind: pick(KINDS), col: colour() });
        }
        for (var st = 0; st < 360; st++) step(1 / 60, w, h);
      }

      function step(dt, w, h) {
        var i, j, b;
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          if (b === drag) {
            /* follows the pointer with a little lag, which is what makes a throw feel weighted */
            b.sleep = false; b.rest = 0;
            b.vx = (ptr.x - b.x) * 22; b.vy = (ptr.y - b.y) * 22;
            b.x += b.vx * dt; b.y += b.vy * dt;
            b.rot += b.vr * dt;
            continue;
          }
          if (b.sleep) continue;     /* a shape that has come to rest stays exactly where it is until something hits it */
          b.vy += G * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.rot += b.vr * dt;
          b.vr *= Math.exp(-1.6 * dt);
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.4; }
          if (b.x > w - b.r) { b.x = w - b.r; b.vx = -b.vx * 0.4; }
          if (b.y > h - b.r) {
            b.y = h - b.r;
            b.vy = Math.abs(b.vy) < 60 ? 0 : -b.vy * 0.38;
            b.vx *= Math.exp(-4 * dt);
            b.vr = b.vx / b.r;
          }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.3; }
          /* slow for long enough: freeze it, spin included */
          if (Math.abs(b.vx) + Math.abs(b.vy) < 26) b.rest = (b.rest || 0) + dt; else b.rest = 0;
          if (b.rest > 0.35) { b.sleep = true; b.vx = 0; b.vy = 0; b.vr = 0; }
        }
        for (var pass = 0; pass < 3; pass++) {
          for (i = 0; i < bodies.length; i++) {
            for (j = i + 1; j < bodies.length; j++) {
              var A = bodies[i], B = bodies[j];
              var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
              var min = (A.r + B.r) * 0.96;
              if (d >= min) continue;
              if (A.col === B.col && merge(A, B, i, j, w, h)) { i = -1; j = 0; break; }
              var nx = dx / d, ny = dy / d, over = min - d;
              var ma = A.r * A.r, mb = B.r * B.r, tot = ma + mb;
              var fa = (A === drag || A.sleep) ? 0 : ((B === drag || B.sleep) ? 1 : mb / tot);
              var fb = (B === drag || B.sleep) ? 0 : ((A === drag || A.sleep) ? 1 : ma / tot);
              A.x -= nx * over * fa; A.y -= ny * over * fa;
              B.x += nx * over * fb; B.y += ny * over * fb;
              var rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
              if (rv < 0) {
                /* a hard enough knock wakes a resting shape */
                if (rv < -45) { if (A.sleep) { A.sleep = false; A.rest = 0; } if (B.sleep) { B.sleep = false; B.rest = 0; } }
                var imp = -(1 + 0.3) * rv / (1 / ma + 1 / mb);
                if (A !== drag && !A.sleep) { A.vx -= imp * nx / ma; A.vy -= imp * ny / ma; }
                if (B !== drag && !B.sleep) { B.vx += imp * nx / mb; B.vy += imp * ny / mb; }
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
      var dim = { w: 0, h: 0 }, scratch = null, sctx = null;
      var pressT = 0, pressX = 0, pressY = 0, shown = null, shownT = 0;
      function clearPress() { if (pressT) { clearTimeout(pressT); pressT = 0; } }
      var pending = null;      /* a new shape being held, not yet dropped */
      function down(e) {
        if (still()) return;
        var p = local(e); ptr.x = p.x; ptr.y = p.y; ptr.vx = ptr.vy = 0; ptr.t = performance.now();
        var b = hit(p.x, p.y);
        touched = true; shown = null; pressX = p.x; pressY = p.y;
        clearPress();
        if (!b) {
          /* on empty space the new shape is held under the finger; it only falls when you let go (a quick tap is just a short hold) */
          pending = make(p.x, p.y, dim.w, dim.h);
          pressT = setTimeout(function () { pressT = 0; if (pending) { shown = pending; shownT = 0; } }, 480);
        } else {
          drag = b;
          /* lifting a shape out of a pile lets whatever rested on it fall */
          bodies.forEach(function (q) { q.sleep = false; q.rest = 0; });
          pressT = setTimeout(function () { pressT = 0; if (drag === b) { shown = b; shownT = 0; } }, 480);
        }
        try { host.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault();
      }
      function move(e) {
        if (!drag && !pending) return;
        var p = local(e), now = performance.now(), dtm = Math.max(1, now - ptr.t) / 1000;
        if (pressT && Math.hypot(p.x - pressX, p.y - pressY) > 7) clearPress();
        ptr.vx = (p.x - ptr.x) / dtm * 0.6 + ptr.vx * 0.4;
        ptr.vy = (p.y - ptr.y) / dtm * 0.6 + ptr.vy * 0.4;
        ptr.x = p.x; ptr.y = p.y; ptr.t = now;
        if (pending) { pending.x = p.x; pending.y = p.y; }
      }
      function up() {
        clearPress();
        if (pending) {
          /* let go: it drops and the gesture is over, nothing stays attached to the pointer */
          var d = pending; pending = null;
          shownT = shown === d ? 1.4 : 0;
          release(d);
          return;
        }
        if (!drag) return;
        var c = function (v) { return Math.max(-1700, Math.min(1700, v)); };
        if (shown === drag) { drag.vx = 0; drag.vy = 0; shownT = 1.4; }   /* the label lingers a moment after letting go */
        else { drag.vx = c(ptr.vx); drag.vy = c(ptr.vy); drag.vr = drag.vx / drag.r; }
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
        if (!seeded && w > 80 && h > 80) seed(w, h);

        ctx.clearRect(0, 0, w, h);

        /* the toy */
        var dt = lastT ? Math.min(0.033, Math.max(0.001, t - lastT)) : 0.016;
        lastT = t;
        step(dt, w, h);
        /* the shapes are not painted: they are drawn on a half-size scratch canvas and printed as a honeycomb of round dots, the dot
           size following how much of the place the shape covers (so edges fade out over a row or two) and the colour following the shape */
        var hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
        if (!scratch) { scratch = document.createElement('canvas'); sctx = scratch.getContext('2d', { willReadFrequently: true }); }
        if (scratch.width !== hw || scratch.height !== hh) { scratch.width = hw; scratch.height = hh; }
        sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, hw, hh); sctx.scale(0.5, 0.5);
        for (var gi = 0; gi < bodies.length; gi++) drawBody(sctx, bodies[gi]);
        if (pending) { pending.pop = 0.6; drawBody(sctx, pending); }
        var sd = sctx.getImageData(0, 0, hw, hh).data;
        var pit = Math.max(4.4, Math.min(6, w / 100)), rowH = pit * 0.866, spread = pit * 0.8;
        var offs = [0, 0, spread, 0, -spread, 0, 0, spread, 0, -spread];
        for (var jy = 0, ry = 0; ry < h + pit; jy++, ry = jy * rowH) {
          for (var ix = 0, rx = (jy % 2 ? pit / 2 : 0); rx < w + pit; ix++, rx = ix * pit + (jy % 2 ? pit / 2 : 0)) {
            var aS = 0, rS = 0, gS = 0, bS = 0;
            for (var oi = 0; oi < 10; oi += 2) {
              var px = Math.round((rx + offs[oi]) / 2), py = Math.round((ry + offs[oi + 1]) / 2);
              if (px < 0 || py < 0 || px >= hw || py >= hh) continue;
              var di = (py * hw + px) * 4, al = sd[di + 3] / 255;
              if (al > 0) { aS += al; rS += sd[di] * al; gS += sd[di + 1] * al; bS += sd[di + 2] * al; }
            }
            if (aS < 0.25) continue;
            var cv = Math.min(1, aS / 5 * 1.25), rd = pit * 0.52 * Math.pow(cv, 1.1);
            if (rd < 0.5) continue;
            ctx.fillStyle = 'rgb(' + Math.round(rS / aS) + ',' + Math.round(gS / aS) + ',' + Math.round(bS / aS) + ')';
            ctx.beginPath(); ctx.arc(rx, ry, rd, 0, 6.2832); ctx.fill();
          }
        }
        if (shown) {
          if (shownT > 0) { shownT -= dt; if (shownT <= 0) shown = null; }
          if (shown && shown !== pending && bodies.indexOf(shown) < 0) shown = null;
        }
        if (shown) {
          var txt = String(shown.col).toUpperCase();
          ctx.font = '600 12px ' + (tok('--mono') || 'ui-monospace, monospace');
          var tw = ctx.measureText(txt).width + 22, th = 24;
          var lx = Math.max(6, Math.min(w - tw - 6, shown.x - tw / 2));
          var ly = Math.max(6, shown.y - shown.r - th - 10);
          ctx.fillStyle = tok('--ink');
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx, ly, tw, th, 12); else ctx.rect(lx, ly, tw, th);
          ctx.fill();
          ctx.fillStyle = shown.col; ctx.beginPath(); ctx.arc(lx + 12, ly + th / 2, 4.5, 0, 6.2832); ctx.fill();
          ctx.fillStyle = tok('--bg'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(txt, lx + 21, ly + th / 2 + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
        /* every tile keeps its hint in the top right corner, in the same type; a short tile gets one line */
        ctx.font = '500 10.5px ' + (tok('--mono') || 'ui-monospace, monospace');
        ctx.fillStyle = tok('--ink'); ctx.globalAlpha = touched ? 0.45 : 0.6; ctx.textAlign = 'right';
        if (h < 200) {
          ctx.fillText('tap drop · hold colour · drag throw', w - 14, 20);
        } else {
          ctx.fillText('tap → drop a shape', w - 14, 20);
          ctx.fillText('hold → see its colour, let go to drop', w - 14, 35);
          ctx.fillText('drag a shape → throw it', w - 14, 50);
          ctx.fillText('double-tap → clear', w - 14, 65);
        }
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
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
    math: 'three colours, nested, no edges',
    mount: function (host) {
      /* A soft colour field. The whole tile is one set of nested rounded rectangles with no edges: the outermost one is the tile's own
         surface colour, so the field melts into the card it sits on, and inside it three colours of a theme follow one another (a
         glow, a ring, a core). The row of swatches at the foot picks the theme (each swatch shows its three colours); the round
         handle on the left edge pushes the rings in and out; with nothing touched they breathe slowly. */
      var THEMES = [
        { n: 'Sunset', c: ['#ff7a45', '#e8449a', '#ffd36a'] },
        { n: 'Ocean',  c: ['#2f6bff', '#00c2d1', '#aef2e2'] },
        { n: 'Meadow', c: ['#35c76a', '#d4f04a', '#ffe3b8'] },
        { n: 'Berry',  c: ['#7a5cff', '#ff5fa8', '#ffd0e6'] },
        { n: 'Peach',  c: ['#ffb089', '#ff7aa8', '#fff0d8'] },
        { n: 'Ink',    c: ['#2d3436', '#6c7a89', '#d3dae2'] }
      ];
      function toRgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
      function rgbToHsl(c) {
        var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, sat = 0, dd = mx - mn;
        if (dd) {
          sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
          h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60;
        }
        return [h, sat, l];
      }
      function hslToRgb(h, sat, l) {
        h = ((h % 360) + 360) % 360 / 360;
        var q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
        var f = function (t) { t = (t + 1) % 1; return Math.round(255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)); };
        return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
      }
      function fromBase(hex) {          /* any colour you pick becomes a theme: the colour, a vivid neighbour, a pale tint */
        var hsl = rgbToHsl(toRgb(hex)), h = hsl[0], l = Math.max(0.5, Math.min(0.62, hsl[2]));
        return [toRgb(hex), hslToRgb(h + 58, 0.85, l), hslToRgb(h - 32, 0.8, 0.84)];
      }
      var cur = THEMES[0].c.map(toRgb), tgt = cur.map(function (c) { return c.slice(); });
      var S = { y: 0.5, ty: 0.5, on: false, hover: false };
      var geom = { x: 0, y: 0, w: 1, h: 1 };

      /* the swatch row and a full colour picker */
      var bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;' +
        'padding:7px 5px;border-radius:999px;background:rgba(255,255,255,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2;touch-action:manipulation;max-height:calc(100% - 36px)';
      var narrow = host.clientWidth && host.clientWidth < 240;
      var CH = narrow ? 15 : 19;
      var chips = [];
      function pickTheme(i) {
        tgt = THEMES[i].c.map(toRgb);
        chips.forEach(function (ch, k) { ch.style.boxShadow = k === i ? '0 0 0 2px #111' : '0 0 0 1px rgba(0,0,0,.2)'; });
        if (custom) custom.style.boxShadow = '0 0 0 1px rgba(0,0,0,.2)';
      }
      var visible = narrow ? THEMES.slice(0, 4) : THEMES;
      visible.forEach(function (t, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.title = t.n; b.setAttribute('aria-label', 'Colour theme ' + t.n);
        b.style.cssText = 'width:' + CH + 'px;height:' + CH + 'px;border-radius:50%;border:0;padding:0;cursor:pointer;background:linear-gradient(135deg,' + t.c[0] + ' 0%,' + t.c[1] + ' 52%,' + t.c[2] + ' 100%)';
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        b.addEventListener('click', function (e) { e.stopPropagation(); pickTheme(i); });
        bar.appendChild(b); chips.push(b);
      });
      var custom = document.createElement('input');
      custom.type = 'color'; custom.value = '#ff7a45'; custom.title = 'Make a theme from any colour'; custom.setAttribute('aria-label', 'Make a theme from any colour');
      custom.style.cssText = 'width:' + (CH + 4) + 'px;height:' + (CH + 4) + 'px;border:0;padding:0;border-radius:50%;background:none;cursor:pointer;overflow:hidden';
      custom.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      custom.addEventListener('input', function () {
        tgt = fromBase(custom.value);
        chips.forEach(function (ch) { ch.style.boxShadow = '0 0 0 1px rgba(0,0,0,.2)'; });
        custom.style.boxShadow = '0 0 0 2px #111';
      });
      bar.appendChild(custom);
      host.appendChild(bar);
      pickTheme(0);

      function norm(e) {
        var r = host.getBoundingClientRect();
        return Math.max(0.04, Math.min(0.96, (e.clientY - r.top) / r.height));
      }
      function d(e) {
        if (still()) return;
        if (e.target !== host && e.target.tagName !== 'CANVAS') return;
        S.on = true; S.hover = true; S.ty = norm(e);
        try { host.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault();
      }
      function mv(e) { S.hover = true; if (S.on) S.ty = norm(e); }
      function u() { S.on = false; }
      function lv() { if (!S.on) S.hover = false; }

      function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
      function css(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
      function linearChannel(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}
      function displayChannel(v){return 255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055);}
      function sm(t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); }
      var last = 0, scratch = null, sctx = null;
      var stop = scene(host, function (ctx, w, h, t) {
        var dt = last ? Math.min(0.05, t - last) : 0.016; last = t;
        S.ty = 0.5 + 0.22 * Math.sin(t * 0.5);
        S.y += (S.ty - S.y) * Math.min(1, dt * 3);
        for (var i = 0; i < 3; i++) for (var k = 0; k < 3; k++) cur[i][k] += (tgt[i][k] - cur[i][k]) * Math.min(1, dt * 4);
        geom.w = w; geom.h = h;

        var bg = toRgb((tok('--surface') || '#f4f3ee').length === 7 ? tok('--surface') : '#f4f3ee');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = css(bg); ctx.fillRect(0, 0, w, h);

        /* where each colour sits, from the outside in. The handle moves them all together; the breathing is a slow wobble on top. */
        var u = still() ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.1);   /* 0 = the full rounded square, 1 = a small circle: the whole field breathes between the two */
        var sc = (0.78 + 0.34 * S.y) * (1 - 0.34 * u), br = 0.025 * Math.sin(t * 0.9);
        var p1 = Math.min(0.9, 0.80 * sc + br), p2 = 0.52 * sc - br * 0.6, p3 = 0.24 * sc + br * 0.4;
        /* the field sits in a smaller box: room on the left for the swatch column, a margin on the other sides for the label and the line at the foot */
        var fx = 52, fy = 30, fw = Math.max(40, w - fx - 14), fh = Math.max(40, h - fy - 30);
        var N = 220, cx = fx + fw / 2, cy = fy + fh / 2;
        var light = cur.map(function(color){return color.map(linearChannel);});
        /* The field is drawn on a half-size scratch canvas (the outer rings fade out by transparency instead of by mixing into the card),
           then printed as a honeycomb of round dots: the dot size follows the opacity, the dot colour follows the field. */
        var hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
        if (!scratch) { scratch = document.createElement('canvas'); sctx = scratch.getContext('2d', { willReadFrequently: true }); }
        if (scratch.width !== hw || scratch.height !== hh) { scratch.width = hw; scratch.height = hh; }
        sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, hw, hh); sctx.scale(0.5, 0.5);
        for (var q = N; q >= 1; q--) {
          var dn = q / N;                                  /* 1 at the outer edge of the tile, 0 in the middle */
          var col, alp = 1;
          // Broad overlapping colour fields replace isolated bands and hard colour stops.
          var centres=[p1,p2,p3*.3],spread=sc*.235;
          var weights=centres.map(function(centre){return Math.exp(-.5*Math.pow((dn-centre)/spread,2));});
          var sum=weights[0]+weights[1]+weights[2];
          col=[0,1,2].map(function(channel){return displayChannel((light[0][channel]*weights[0]+light[1][channel]*weights[1]+light[2][channel]*weights[2])/sum);});
          if (dn >= p1) alp = sm((1 - dn) / (1 - p1));
          var hx = (fw / 2) * dn * 1.04, hy = (fh / 2) * dn * 1.04, rr = Math.min(hx, hy) * (0.62 + 0.38 * u);
          sctx.beginPath();
          if (sctx.roundRect) sctx.roundRect(cx - hx, cy - hy, hx * 2, hy * 2, rr); else sctx.rect(cx - hx, cy - hy, hx * 2, hy * 2);
          sctx.globalCompositeOperation = 'destination-out'; sctx.fillStyle = '#000'; sctx.fill();       /* replace what is under this ring */
          sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = alp; sctx.fillStyle = css(col); sctx.fill(); sctx.globalAlpha = 1;
        }
        var sd = sctx.getImageData(0, 0, hw, hh).data;
        /* printed as a shape ramp on a square grid: the deeper the colour, the heavier the shape (dot, ring, diamond, rounded square, block),
           and now and then a cell is a code glyph (plus, slash, bracket, chevron) that swaps for another one every second or two */
        var pit = Math.max(8, Math.min(11, w / 30));
        for (var jy = 0; jy * pit < h; jy++) {
          for (var ix = 0; ix * pit < w; ix++) {
            var rx = ix * pit + pit / 2, ry = jy * pit + pit / 2;
            var px = Math.round(rx / 2), py = Math.round(ry / 2);
            if (px < 0 || py < 0 || px >= hw || py >= hh) continue;
            var di = (py * hw + px) * 4, al = sd[di + 3] / 255;
            if (al < 0.05) continue;
            var ddx = (rx - cx) / (fw / 2), ddy = (ry - cy) / (fh / 2), dd = Math.min(1, Math.sqrt(ddx * ddx + ddy * ddy));
            var v = al * (0.4 + 0.6 * Math.pow(1 - dd * 0.85, 0.5));
            if (v < 0.07) continue;
            var hs = Math.sin(ix * 127.1 + jy * 311.7) * 43758.5453; hs -= Math.floor(hs);
            var col = 'rgb(' + sd[di] + ',' + sd[di + 1] + ',' + sd[di + 2] + ')', r = pit * 0.46;
            ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.save(); ctx.translate(rx, ry);
            /* Most cells are plain circles whose size follows the colour. A few cells near the middle are "live": each one, on its own clock, jumps between a small code glyph, another small shape and a circle, and some steps it is simply a circle, so the code appears and disappears at random. */
            var live = hs > 0.84 + dd * 0.3 && dd < 0.6 && v > 0.25, kind = -1, pop = 1;
            if (live) {
              var step = Math.floor(t * 1.1 + hs * 40), ph = t * 1.1 + hs * 40 - step;
              var rnd = Math.sin(step * 12.9898 + hs * 78.233) * 43758.5453; rnd -= Math.floor(rnd);
              if (rnd < 0.62) kind = Math.floor(rnd / 0.62 * 11);              /* 0-6 glyphs, 7-10 other small shapes */
              pop = ph < 0.2 ? 0.55 + 0.45 * Math.sin(ph / 0.2 * 1.5708) + 0.25 * Math.sin(ph / 0.2 * 3.1416) : 1;
            }
            if (kind >= 0) {
              var q = r * 0.62 * pop;
              ctx.lineWidth = 1.3; ctx.scale(1, 1); ctx.beginPath();
              if (kind === 0) { ctx.moveTo(-q, 0); ctx.lineTo(q, 0); ctx.moveTo(0, -q); ctx.lineTo(0, q); }
              else if (kind === 1) { ctx.moveTo(-q * .6, q); ctx.lineTo(q * .6, -q); }
              else if (kind === 2) { ctx.moveTo(-q * .2, -q); ctx.lineTo(-q * .8, -q); ctx.lineTo(-q * .8, q); ctx.lineTo(-q * .2, q); }
              else if (kind === 3) { ctx.moveTo(q * .2, -q); ctx.lineTo(q * .8, -q); ctx.lineTo(q * .8, q); ctx.lineTo(q * .2, q); }
              else if (kind === 4) { ctx.moveTo(-q * .3, -q * .8); ctx.lineTo(q * .7, 0); ctx.lineTo(-q * .3, q * .8); }
              else if (kind === 5) { ctx.moveTo(q * .3, -q * .8); ctx.lineTo(-q * .7, 0); ctx.lineTo(q * .3, q * .8); }
              else if (kind === 6) { ctx.moveTo(-q * .7, -q * .7); ctx.lineTo(q * .7, q * .7); ctx.moveTo(q * .7, -q * .7); ctx.lineTo(-q * .7, q * .7); }
              if (kind <= 6) ctx.stroke();
              else if (kind === 7) { ctx.arc(0, 0, q * 0.9, 0, 6.2832); ctx.stroke(); }
              else if (kind === 8) { ctx.rotate(Math.PI / 4); ctx.fillRect(-q * .6, -q * .6, q * 1.2, q * 1.2); }
              else if (kind === 9) { if (ctx.roundRect) { ctx.roundRect(-q * .75, -q * .75, q * 1.5, q * 1.5, q * .4); ctx.fill(); } else ctx.fillRect(-q * .75, -q * .75, q * 1.5, q * 1.5); }
              else { ctx.arc(0, 0, q * 0.35, 0, 6.2832); ctx.fill(); }
            } else {
              var cv2 = v < 0.3 ? v * 0.9 : 0.27 + (v - 0.3) * 0.62, rc = r * (0.2 + 0.7 * Math.min(1, cv2 / 0.7)) * pop;
              ctx.beginPath(); ctx.arc(0, 0, rc, 0, 6.2832); ctx.fill();
            }
            ctx.restore();
          }
        }

        ctx.font = '500 10.5px ' + (tok('--mono') || 'ui-monospace, monospace');
        ctx.fillStyle = tok('--ink'); ctx.globalAlpha = 0.6; ctx.textAlign = 'right';
        ctx.fillText('pick a theme', w - 14, 20);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
      return function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
        if (stop) stop();
      };
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
    span: 'tile--1x2',
    math: 'Hover or hold to grow · release to pause',
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
      var TRAVEL = 1.2, POP = 1.0;   /* front crossing time, bounce tail */

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
            var rad = 1.9 + 5.8 * g;

            var mine = now, pop = 1, wake = 0;
            if (running) {
              var sx = x - sweepX, sy = y - sweepY;
              /* when the front gets to THIS dot, and how long ago that was */
              var local = age - Math.sqrt(sx * sx + sy * sy) / diag * TRAVEL;
              if (local < 0) mine = was;
              else {
                pop = 1 + 0.82 * Math.exp(-local * 4.5) * Math.sin(local * 12);
                wake = Math.exp(-local * 2.6);
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
              rad = Math.max(rad, 1.9 + 1.6 * seen[at]);
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
          ctx.font = '500 10.5px ' + (tok('--mono') || 'monospace');
          ctx.textAlign = 'right';
          ctx.fillText(found + ' found · Δh ' + dh.toFixed(0) + '°', w - 14, 20);
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
        if(api){if(still()){n=nT;p=pT;}api.redraw();}
      }
      function leave(){active=false;nT=n;pT=p;lastX=lastY=null;}
      function release(e){if(e.pointerType !== 'mouse')leave();}
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
      host.addEventListener('pointerup',release);
      host.addEventListener('dblclick',reset);
      var resetButton=host.parentNode.querySelector('[data-shape-reset]');
      if(resetButton)resetButton.addEventListener('click',reset);
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
        return active && (n !== nT || p !== pT);
      }, true);

      return function () {
        host.removeEventListener('pointerenter',enter);
        host.removeEventListener('pointermove',move);
        host.removeEventListener('pointerleave',leave);
        host.removeEventListener('pointercancel',leave);
        host.removeEventListener('pointerup',release);
        host.removeEventListener('dblclick',reset);
        if(resetButton)resetButton.removeEventListener('click',reset);
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


  /* --------------------------------------------------------------------- */
  /* Halftone: a word made of dots that the pointer pushes aside            */
  /* --------------------------------------------------------------------- */

  /* The word is drawn once, off screen, and read back on a regular grid: each grid cell becomes one dot whose radius follows how much of
     the cell the letters cover (coverage^0.8), so heavy strokes are dense and big, edges thin out into small dots, and a few tiny
     stray dots are scattered just outside the letters. Every dot remembers its home. The pointer pushes the dots near it away,
     slowly, and they drift back when it leaves (a spring that is deliberately soft). No arrow is drawn: the site's own pointer is the cursor. */
  var halftone = {
    id: 'halftone',
    label: 'Halftone',
    span: 'tile--2x2',
    math: 'Move to explore \u00b7 click to edit',
    mount: function (host) {
      var WORD = 'Tone', DEFAULT = 'Tone';
      var dots = [], pitch = 6, W = 0, H = 0;
      var ptr = { x: -999, y: -999, on: false };
      var drift = {x: .94, y: -.34};
      var seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

      function build(w, h) {
        W = w; H = h; dots = []; seed = 7;
        pitch = Math.max(3.6, Math.min(6, w / 92));
        var off = document.createElement('canvas');
        off.width = Math.max(1, Math.round(w)); off.height = Math.max(1, Math.round(h));
        var c = off.getContext('2d');
        c.fillStyle = '#000'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        var heading = document.querySelector('.hero h1, h1, h2');
        var fam = heading ? getComputedStyle(heading).fontFamily : '"Archivo", system-ui, sans-serif';
        var size = 100;
        c.font = '800 ' + size + 'px ' + fam;
        try { c.fontStretch = 'normal'; } catch (e) {}
        var m = c.measureText(WORD);
        size = Math.floor(size * (w * 0.80) / Math.max(1, m.width));
        size = Math.min(size, h * 0.66);
        size = Math.floor(size * 0.94);
        c.font = '800 ' + size + 'px ' + fam;
        try { c.fontStretch = 'normal'; c.letterSpacing = '0px'; } catch (e) {}
        c.fillText(WORD, w / 2, h / 2 + size * 0.36);
        var img = c.getImageData(0, 0, off.width, off.height).data;
        var rowPitch = pitch * 0.866;
        var cols = Math.floor(w / pitch), rows = Math.floor(h / rowPitch);
        var ox = (w - cols * pitch) / 2 + pitch / 2, oy = (h - rows * rowPitch) / 2 + rowPitch / 2;
        var cov = new Float32Array(cols * rows);
        for (var gy = 0; gy < rows; gy++) {
          for (var gx = 0; gx < cols; gx++) {
            var x0 = Math.floor(ox + gx * pitch + (gy%2 ? pitch/2 : 0) - pitch / 2), y0 = Math.floor(oy + gy * rowPitch - pitch / 2), sum = 0, cnt = 0;
            for (var yy = y0; yy < y0 + Math.ceil(pitch); yy += 2) {
              for (var xx = x0; xx < x0 + Math.ceil(pitch); xx += 2) {
                if (xx < 0 || yy < 0 || xx >= off.width || yy >= off.height) continue;
                sum += img[(yy * off.width + xx) * 4 + 3] / 255; cnt++;
              }
            }
            cov[gy * cols + gx] = cnt ? sum / cnt : 0;
          }
        }
        /* A halftone is a full sheet of dots; the picture is only in how big each one is. Every place on the grid gets a dot: big and nearly
           touching where the letters are, tiny everywhere else, and in between the size follows a softly blurred copy of the letters, so
           the edge fades out over a few rows instead of ending. Rows are staggered by half a pitch. Far from the letters a few dots go
           missing, which is what makes the sheet thin out toward its borders. */
        var rMax = pitch * 0.42;
        for (var j = 0; j < rows; j++) {
          for (var i = 0; i < cols; i++) {
            var bl = 0, wsum = 0;
            for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) {
              var ni = i + dx, nj = j + dy;
              if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
              var wgt = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 3.4);
              bl += cov[nj * cols + ni] * wgt; wsum += wgt;
            }
            bl = wsum ? bl / wsum : 0;
            var hx = ox + i * pitch + (j % 2 ? pitch / 2 : 0), hy = oy + j * rowPitch;
            if (hx > w) continue;
            var coverage = cov[j*cols+i];
            if (bl < .012 && coverage < .01) continue;
            var q = Math.max(coverage, bl*.65);
            var r = rMax*Math.pow(q,.72);
            if (r < .18) continue;
            dots.push({ hx: hx, hy: hy, ox: 0, oy: 0, vx: 0, vy: 0, r: r, amount:0 });
          }
        }
      }

      function move(e) {
        var b = host.getBoundingClientRect();
        var nx=e.clientX-b.left, ny=e.clientY-b.top;
        if(ptr.on){var mx=nx-ptr.x,my=ny-ptr.y,speed=Math.hypot(mx,my);if(speed>2){drift.x=mx/speed;drift.y=my/speed;}}
        ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top; ptr.on = true;
        if (stop) stop.redraw();
      }
      function leave() { ptr.on = false; if (stop) stop.redraw(); }
      function release(e) { if (e.pointerType !== 'mouse') leave(); }
      host.style.touchAction = 'pan-y';
      host.addEventListener('pointermove', move);
      host.addEventListener('pointerdown', move);
      host.addEventListener('pointerleave', leave);
      host.addEventListener('pointercancel', leave);
      host.addEventListener('pointerup', release);

      /* type to change the word: click the tile (or tab to it) and write; Escape puts MOTION back */
      var typing = false;
      host.tabIndex = 0;
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', 'Halftone word. Click, then type to change it.');
      var field = document.createElement('input');
      field.type = 'text'; field.maxLength = 8; field.autocapitalize = 'off'; field.autocomplete = 'off'; field.spellcheck = false;
      field.setAttribute('aria-label', 'Type a word for the halftone');
      field.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;pointer-events:none';
      host.appendChild(field);
      function setWord(v) {
        v = (v || '').replace(/[^A-Za-z0-9 .!?&+-]/g, '').slice(0, 8);
        WORD = v.trim() ? v : DEFAULT; built = false;
        if (stop) stop.redraw();
      }
      function focusIt() { try { field.focus({ preventScroll: true }); } catch (e) { field.focus(); } }
      function onFocus() { typing = true; field.value = WORD === DEFAULT ? '' : WORD; }
      function onBlur() { typing = false; }
      function onInput() { setWord(field.value); }
      function onKey(e) {
        e.stopPropagation();                               /* letters belong to the word, not to the page's shortcuts */
        if (e.key === 'Escape') { field.value = ''; WORD = DEFAULT; built = false; field.blur(); if (stop) stop.redraw(); }
      }
      function onClick() { focusIt(); }
      function onHostFocus() { focusIt(); }
      host.addEventListener('click', onClick);
      host.addEventListener('focus', onHostFocus);
      field.addEventListener('focus', onFocus);
      field.addEventListener('blur', onBlur);
      field.addEventListener('input', onInput);
      field.addEventListener('keydown', onKey);
      field.addEventListener('keyup', function (e) { e.stopPropagation(); });

      var last = 0, built = false;
      var stop = scene(host, function (ctx, w, h, t, fresh) {
        if (!built || w !== W || h !== H) {
          /* wait for the heading font if it has not arrived yet; the dots are rebuilt once when it does */
          build(w, h); built = true;
        }
        var dt = last ? Math.min(0.05, t - last) : 0.016; last = t;
        ctx.clearRect(0, 0, w, h);
        var R = Math.max(48, Math.min(w*.28, h*.55));
        var k = 100, c = 20, push = pitch*.28;
        var moving = false;
        ctx.filter = 'none';
        ctx.fillStyle = tok('--ink'); ctx.globalAlpha = 0.95;
        ctx.beginPath();
        for (var n = 0; n < dots.length; n++) {
          var d = dots[n], tx = 0, ty = 0, intensity=0;
          if (ptr.on && !still()) {
            var dx = d.hx - ptr.x, dy = d.hy - ptr.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < R) {
              var edge = Math.max(0,Math.min(1,dist/R));
              var f = 1-edge*edge*(3-2*edge);
              // One smooth displacement field preserves the printed rows and columns.
              tx = drift.x*push*f;
              ty = drift.y*push*f;
              intensity=f;
            }
          }
          if (still()) { d.ox = d.oy = d.vx = d.vy = 0; }
          d.vx += ((tx - d.ox) * k - d.vx * c) * dt;
          d.vy += ((ty - d.oy) * k - d.vy * c) * dt;
          d.ox += d.vx * dt; d.oy += d.vy * dt;
          if (Math.abs(tx-d.ox)+Math.abs(ty-d.oy)+Math.abs(d.vx)+Math.abs(d.vy) > .025) moving = true;
          else { d.ox = tx; d.oy = ty; d.vx = d.vy = 0; }
          d.amount+=(intensity-d.amount)*Math.min(1,dt*12);
          if(Math.abs(intensity-d.amount)>.004)moving=true;else d.amount=intensity;
          var rr = d.r*(1-.48*d.amount);
          var x = d.hx + d.ox, y = d.hy + d.oy;
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, 6.2832);
        }
        ctx.fill();
        ctx.globalAlpha = 0.6; ctx.font = '500 10.5px ' + (tok('--mono') || 'ui-monospace, monospace');
        ctx.textAlign = 'right'; ctx.fillText(typing ? 'typing \u00b7 esc resets' : 'click \u00b7 type a word', w - 14, 20);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
        host.dataset.halftoneState = moving ? 'responding' : 'idle';
        return moving;
      }, true);
      if (document.fonts && document.fonts.load) document.fonts.load('800 100px Archivo', DEFAULT).then(function () { built = false; if (stop) stop.redraw(); });
      return function () {
        host.removeEventListener('click', onClick);
        host.removeEventListener('focus', onHostFocus);
        if (field.parentNode) field.parentNode.removeChild(field);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerdown', move);
        host.removeEventListener('pointerleave', leave);
        host.removeEventListener('pointercancel', leave);
        host.removeEventListener('pointerup', release);
        if (stop) stop();
      };
    }
  };


  /* --------------------------------------------------------------------- */
  /* Icon: web icons and noise, printed as a hex halftone                    */
  /* --------------------------------------------------------------------- */

  /* The tile prints one small picture at a time in a honeycomb of round dots: full dots inside the shape, a band of shrinking dots
     where it fades out, nothing outside. The pictures are the everyday icons of a web page (home, heart, bell, mail, pin ...) and the
     site's own favicon. Between two of them the tile scrambles: a short burst of random characters is printed in the same dots, then
     the next icon settles in. Each dot eases toward the size its place needs, so the change is a ripple rather than a cut. */
  var ICON_PATHS = {
    home:   'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    heart:  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    star:   'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    bell:   'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    mail:   'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    pin:    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    chat:   'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    lock:   'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    play:   'M8 5v14l11-7z'
  };
  var iconDots = {
    id: 'icon',
    label: 'Icon',
    span: 'tile--1x2',
    math: 'r = pitch \u00b7 coverage, on a honeycomb',
    mount: function (host) {
      var ORDER = ['favicon', 'home', 'heart', 'bell', 'mail', 'pin', 'chat', 'star', 'lock', 'search', 'play'];
      var NOISE = '@#%&*?/<>{}[]01xX+=~';
      var HOLD = 2.6, SCRAMBLE = 0.62, FRAME = 0.11;
      var cache = {}, dots = [], gw = 0, gh = 0, pitch = 6;
      var fav = new Image(), favOk = false;
      fav.onload = function () { favOk = true; cache = {}; };
      fav.src = 'assets/apple-touch-icon.png';
      var idx = 0, phase = 'hold', phaseAt = 0, noiseKey = '', noiseAt = 0;
      var ptr = { x: -999, y: -999, on: false };

      function paintShape(c, w, h, key) {
        var S = Math.min(w, h) * (key.charAt(0) === '#' ? 0.52 : 0.6), cx = w / 2, cy = h / 2;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#000';
        if (key === 'favicon') {
          c.beginPath(); c.arc(cx, cy, S * 0.5, 0, 6.2832);
          if (favOk) { c.save(); c.clip(); c.drawImage(fav, cx - S * 0.5, cy - S * 0.5, S, S); c.restore(); } else { c.fill(); }
        } else if (key.charAt(0) === '#') {
          c.font = '800 ' + Math.round(S * 1.15) + 'px "Archivo", ui-monospace, monospace';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          try { c.fontStretch = 'semi-condensed'; } catch (e) {}
          c.fillText(key.slice(1), cx, cy + S * 0.04);
        } else {
          c.save(); c.translate(cx - S / 2, cy - S / 2); c.scale(S / 24, S / 24);
          c.fill(new Path2D(ICON_PATHS[key]), 'evenodd'); c.restore();
        }
      }
      function coverageFor(key, w, h) {
        if (cache[key]) return cache[key];
        var sw = Math.max(1, Math.round(w / 2)), sh = Math.max(1, Math.round(h / 2));
        var cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
        var c = cv.getContext('2d');
        c.scale(0.5, 0.5);
        paintShape(c, w, h, key);
        var bl = document.createElement('canvas'); bl.width = sw; bl.height = sh;
        var b = bl.getContext('2d');
        try { b.filter = 'blur(1.6px)'; } catch (e) {}
        b.drawImage(cv, 0, 0);
        var data = b.getImageData(0, 0, sw, sh).data;
        var out = new Float32Array(dots.length);
        for (var i = 0; i < dots.length; i++) {
          var x = Math.max(0, Math.min(sw - 1, Math.round(dots[i].hx / 2))), y = Math.max(0, Math.min(sh - 1, Math.round(dots[i].hy / 2)));
          out[i] = data[(y * sw + x) * 4 + 3] / 255;
        }
        cache[key] = out;
        return out;
      }
      function layout(w, h) {
        gw = w; gh = h; cache = {}; dots = [];
        pitch = Math.max(4.6, Math.min(6.4, w / 52));
        var rowH = pitch * 0.866, rows = Math.ceil(h / rowH) + 1, cols = Math.ceil(w / pitch) + 1;
        for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
          var x = i * pitch + (j % 2 ? pitch / 2 : 0) - pitch / 4, y = j * rowH;
          if (x < -pitch || x > w + pitch || y < -pitch || y > h + pitch) continue;
          dots.push({ hx: x, hy: y, r: 0 });
        }
      }
      function keyNow(t) {
        if (phase === 'hold') return ORDER[idx];
        if (t - noiseAt > FRAME || !noiseKey) {
          noiseAt = t;
          noiseKey = '#' + NOISE.charAt(Math.floor(Math.random() * NOISE.length));
        }
        return noiseKey;
      }
      function skip() { phase = 'scramble'; phaseAt = -1; }
      function move(e) { var b = host.getBoundingClientRect(); ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top; ptr.on = true; }
      function leave() { ptr.on = false; }
      host.addEventListener('pointermove', move);
      host.addEventListener('pointerleave', leave);
      host.addEventListener('click', skip);

      var last = 0;
      var stop = scene(host, function (ctx, w, h, t) {
        if (!dots.length || w !== gw || h !== gh) layout(w, h);
        var dt = last ? Math.min(0.05, t - last) : 0.016; last = t;
        if (phaseAt === -1) phaseAt = t;
        if (!still()) {
          if (phase === 'hold' && t - phaseAt > HOLD) { phase = 'scramble'; phaseAt = t; }
          else if (phase === 'scramble' && t - phaseAt > SCRAMBLE) { phase = 'hold'; phaseAt = t; idx = (idx + 1) % ORDER.length; noiseKey = ''; }
        }
        var cov = coverageFor(keyNow(t), w, h);
        var k = Math.min(1, dt * (phase === 'scramble' ? 22 : 9));
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = tok('--c1') || '#1a73e8';
        ctx.beginPath();
        for (var n = 0; n < dots.length; n++) {
          var d = dots[n], target = cov[n] < 0.06 ? 0 : pitch * 0.53 * Math.pow(cov[n], 0.9), sw = 1;
          if (ptr.on) {
            var dx = d.hx - ptr.x, dy = d.hy - ptr.y, q = 1 - Math.sqrt(dx * dx + dy * dy) / 60;
            if (q > 0) sw = 1 + 0.5 * q * q;
          }
          d.r += (target * sw - d.r) * k;
          if (d.r > 0.25) { ctx.moveTo(d.hx + d.r, d.hy); ctx.arc(d.hx, d.hy, d.r, 0, 6.2832); }
        }
        ctx.fill();
        ctx.globalAlpha = 0.6; ctx.fillStyle = tok('--ink'); ctx.font = '500 10.5px ' + (tok('--mono') || 'ui-monospace, monospace');
        ctx.textAlign = 'right'; ctx.fillText('click \u00b7 next icon', w - 14, 20);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
      return function () {
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', leave);
        host.removeEventListener('click', skip);
        if (stop) stop();
      };
    }
  };


  /* A small orthographic rain study: all geometry stays in SVG. */
  var rain = {
    id: 'rain', label: 'Rain', span: 'tile--1x2',
    math: '',
    mount: function (host) {
      var ns = 'http://www.w3.org/2000/svg';
      function node(tag, attrs, parent) {
        var n = document.createElementNS(ns, tag);
        Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        (parent || svg).appendChild(n); return n;
      }
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 320 240');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Interactive rain on a shallow water plane');
      host.appendChild(svg); host.style.touchAction = 'pan-y';
      var hint = document.createElement('span');
      hint.textContent = 'move · tap';
      hint.style.cssText = 'position:absolute;top:14px;right:14px;max-width:70%;text-align:right;font:500 10.5px var(--mono);color:var(--ink-3);pointer-events:none;line-height:1.5';
      host.appendChild(hint);
      var controls=document.createElement('div');
      controls.style.cssText='position:absolute;right:14px;top:32px;display:flex;gap:5px;z-index:3';
      host.appendChild(controls);
      var windLevel=1, rainLevel=1;
      function control(label, change){
        var button=document.createElement('button');button.type='button';
        button.style.cssText='border:0;border-radius:99px;padding:4px 7px;background:color-mix(in srgb,var(--c1) 10%,var(--surface));color:var(--c1);font:500 10px var(--mono);cursor:pointer';
        button.addEventListener('click',function(e){e.stopPropagation();change();wake();});
        button.addEventListener('pointermove',function(e){e.stopPropagation();});
        controls.appendChild(button);return button;
      }
      var windButton=control('Wind',function(){windLevel=(windLevel+1)%3;targetWind=[0,.16,.35][windLevel];labels();});
      var rainButton=control('Rain',function(){rainLevel=(rainLevel+1)%3;targetAmount=[.08,.5,1][rainLevel];labels();});
      function labels(){
        windButton.textContent='Wind '+['0','1','2'][windLevel];rainButton.textContent='Rain '+['1','2','3'][rainLevel];
        windButton.setAttribute('aria-label','Wind strength '+windLevel+'. Click to change.');
        rainButton.setAttribute('aria-label','Rain amount '+(rainLevel+1)+'. Click to change.');
      }
      labels();
      // Surface coordinates project into a diamond, shared by drops and rings.
      function project(u, v) { return [160 + (u-v)*126, 116 + (u+v)*31]; }
      var sides = node('g', {stroke:'none'});
      var left = node('path', {d:'M34 147 L160 178 L160 200 L34 169 Z'}, sides);
      var right = node('path', {d:'M160 178 L286 147 L286 169 L160 200 Z'}, sides);
      var top = node('path', {d:'M160 116 L286 147 L160 178 L34 147 Z', stroke:'none'});
      var rings = node('g', {fill:'none', 'stroke-width':'1.4', 'stroke-linecap':'round', 'stroke-dasharray':'.1 3.6'});
      var dropsGroup = node('g', {'stroke-linecap':'round', 'stroke-width':'.8'});
      var drops = [], ripples = [], wind = 0, targetWind = 0, amount = .55, targetAmount = .55;
      var frame = 0, previous = 0, elapsed = 0, visible = false;
      for (var i=0;i<56;i++) {
        drops.push({u:Math.random(), v:Math.random(), phase:Math.random(), speed:.42+Math.random()*.22,
          line:node('line', {}, dropsGroup)});
      }
      for (var j=0;j<22;j++) ripples.push({age:2, u:.5, v:.5, ring:node('ellipse', {opacity:0}, rings)});
      function splash(u,v) {
        var r = ripples.reduce(function(a,b){return a.age>b.age?a:b;});
        r.u=u;r.v=v;r.age=0;
      }
      function palette() {
        var dark=document.documentElement.getAttribute('data-theme')==='dark';
        var azure=tok('--c1') || '#01b6ff', base=tok('--surface') || '#f5f4f1';
        sides.setAttribute('stroke','none');top.setAttribute('stroke','none');
        left.setAttribute('fill',mix(base,azure,dark?.25:.18));
        right.setAttribute('fill',mix(base,azure,dark?.38:.30));
        top.setAttribute('fill',mix(base,azure,dark?.18:.09));
        rings.setAttribute('stroke',azure);dropsGroup.setAttribute('stroke',azure);
      }
      function draw(dt) {
        wind+=(targetWind-wind)*Math.min(1,dt*4);
        amount+=(targetAmount-amount)*Math.min(1,dt*3);
        drops.forEach(function(d,i){
          var active=i<Math.round(18+amount*38), old=d.phase;
          if (!still()) d.phase=(d.phase+dt*d.speed*(.8+amount*.3))%1;
          if (active && d.phase<old) {splash(d.u,d.v);d.u=Math.random();d.v=Math.random();}
          var p=project(d.u,d.v), height=(1-d.phase)*101;
          d.line.setAttribute('x1',p[0]-wind*height);
          d.line.setAttribute('y1',p[1]-height);
          d.line.setAttribute('x2',p[0]-wind*(height+9));
          d.line.setAttribute('y2',p[1]-height-9);
          d.line.setAttribute('opacity',active ? .18+.35*d.phase : 0);
        });
        ripples.forEach(function(r){
          if (!still()) r.age+=dt;
          var p=project(r.u,r.v), a=Math.min(1,r.age/1.4);
          // Keep each ellipse within the projected water plane.
          var room=Math.min(r.u,r.v,1-r.u,1-r.v);
          var radius=Math.min(2+a*15,room*125);
          r.ring.setAttribute('cx',p[0]);r.ring.setAttribute('cy',p[1]);
          r.ring.setAttribute('rx',radius);r.ring.setAttribute('ry',radius*.246);
          r.ring.setAttribute('opacity',a>=1?0:(1-a)*.9);
        });
      }
      function tick(now) {
        frame=0;if(!visible||still())return;
        var dt=previous?Math.min(.05,(now-previous)/1000):1/30;
        if(!previous||now-previous>=32){previous=now;elapsed+=dt;draw(dt);}
        frame=requestAnimationFrame(tick);
      }
      function wake(){if(visible&&!still()&&!frame){previous=0;frame=requestAnimationFrame(tick);}}
      function move(e){
        var b=host.getBoundingClientRect();
        targetWind=((e.clientX-b.left)/b.width-.5)*[0,.40,.85][windLevel];wake();
      }
      function tap(e){
        var b=svg.getBoundingClientRect(), scale=Math.min(b.width/320,b.height/240);
        var x=(e.clientX-b.left-(b.width-320*scale)/2)/scale;
        var y=(e.clientY-b.top-(b.height-240*scale)/2)/scale;
        var u=((x-160)/126+(y-116)/31)/2, v=((y-116)/31-(x-160)/126)/2;
        if(u>0&&u<1&&v>0&&v<1){splash(u,v);draw(0);wake();}
      }
      function motion(){cancelAnimationFrame(frame);frame=0;draw(0);wake();}
      var io=new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;
        if(visible)wake();else{cancelAnimationFrame(frame);frame=0;previous=0;}});
      io.observe(host);palette();splash(.42,.54);draw(0);
      host.addEventListener('pointermove',move);host.addEventListener('click',tap);
      document.addEventListener('motionchange',motion);document.addEventListener('themechange',palette);
      return function(){io.disconnect();cancelAnimationFrame(frame);host.removeEventListener('pointermove',move);
        host.removeEventListener('click',tap);document.removeEventListener('motionchange',motion);
        document.removeEventListener('themechange',palette);svg.remove();hint.remove();controls.remove();};
    }
  };
  lattice.span = 'tile--1x2';

  window.ART = [curves, ramp, iconDots, halftone, lattice, rain];
  /* Pieces that get a page of their own rather than a cell in the bento. */
  window.ART_SOLO = [lame, pulse];
})();




