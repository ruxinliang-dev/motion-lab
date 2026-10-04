/* ---------------------------------------------------------------------------
   Site shell.

   Builds the experiment grid from window.LABS, runs the expand transition that
   turns a card into the detail sheet, draws the easing curves in the Motion
   tokens section, and handles theme / motion / deep links.

   The expand is the same FLIP described in experiment 02. It is used for real
   navigation here on purpose: a technique that only works in its own demo is
   not worth publishing.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  var root = document.documentElement;

  var _tok = {};
  function tok(name) {
    if (!(name in _tok)) {
      _tok[name] = getComputedStyle(root).getPropertyValue(name)
        .replace(/\s+/g, ' ').trim();
    }
    return _tok[name];
  }
  function ms(name) { return parseFloat(tok(name)) || 0; }
  function still() {
    return root.getAttribute('data-motion') === 'off' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }

  /* --- theme and motion switches ----------------------------------------- */

  (function switches() {
    var saved = store('rl-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

    var t = document.getElementById('theme');
    if (t) {
      t.addEventListener('click', function () {
        var now = root.getAttribute('data-theme');
        if (!now) {
          now = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        var next = now === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        store('rl-theme', next);
        _tok = {};
      });
    }

    var m = document.getElementById('motion');
    if (m) {
      /* keeplan.js binds the same button when it runs on its own page. Both
         would toggle, which lands back where it started. */
      m.setAttribute('data-bound', 'site');
      if (store('rl-motion') === 'off') {
        root.setAttribute('data-motion', 'off');
        m.setAttribute('aria-pressed', 'true');
      }
      m.addEventListener('click', function () {
        var off = root.getAttribute('data-motion') === 'off';
        if (off) { root.removeAttribute('data-motion'); store('rl-motion', 'on'); }
        else { root.setAttribute('data-motion', 'off'); store('rl-motion', 'off'); }
        m.setAttribute('aria-pressed', String(!off));
        /* The canvases run their own loops, so they have to be told. */
        document.dispatchEvent(new CustomEvent('motionchange'));
      });
    }
  })();

  /* --- bento of generative tiles ------------------------------------------
     Each tile is mounted after it is in the document, because the drawing
     code sizes its canvas from the box it actually got. */

  var bento = document.getElementById('bento');
  if (bento) {
    (window.ART || []).forEach(function (a) {
      var tile = el('div', 'tile' + (a.span ? ' ' + a.span : ''));
      var host = el('div', 'tile__art');
      tile.appendChild(host);
      tile.appendChild(el('span', 'tile__label', a.label));
      tile.appendChild(el('span', 'tile__math', a.math));
      bento.appendChild(tile);
      a.mount(host);
    });
  }

  /* A piece that has a page to itself declares which one it wants with
     data-art="lame". Same mount contract as a bento tile, different host. */
  [].slice.call(document.querySelectorAll('[data-art]')).forEach(function (box) {
    var want = box.getAttribute('data-art');
    var piece = (window.ART_SOLO || []).filter(function (a) { return a.id === want; })[0];
    if (!piece) return;
    piece.mount(box);
    var m = box.parentNode.querySelector('.study__math');
    if (m) m.textContent = piece.math;
  });

  /* --- experiment grid ---------------------------------------------------- */

  var labs = window.LABS || [];
  var cards = {};

  /* The deck splits the experiments across two pages, so a grid declares the
     slice it wants with data-labs="0-3". A plain #grid still works. */
  var hosts = [].slice.call(document.querySelectorAll('.grid[data-labs]'));
  if (!hosts.length) {
    var single = document.getElementById('grid');
    if (single) { single.setAttribute('data-labs', '0-' + (labs.length - 1)); hosts = [single]; }
  }

  hosts.forEach(function (grid) {
    var range = (grid.getAttribute('data-labs') || '').split('-');
    var from = parseInt(range[0], 10) || 0;
    var to = isNaN(parseInt(range[1], 10)) ? labs.length - 1 : parseInt(range[1], 10);
    labs.slice(from, to + 1).forEach(function (lab) {
    var card = el('article', 'card');
    card.id = 'lab-' + lab.id;

    var stage = el('div', 'card__stage');
    var body = el('div', 'card__body');
    body.style.position = 'relative';

    var open = el('button', 'card__open', 'Read the notes for ' + lab.title);
    open.type = 'button';
    open.addEventListener('click', function () { openLab(lab, card, open); });

    var spec = el('div', 'card__spec');
    var keys = Object.keys(lab.spec).slice(0, 2);
    keys.forEach(function (k) {
      spec.appendChild(el('span', null, lab.spec[k].replace(/^var\(--[a-z0-9-]+\) /, '')));
    });

    body.appendChild(open);
    body.appendChild(el('span', 'card__hint', 'Notes'));
    body.appendChild(el('span', 'card__n', lab.n));
    body.appendChild(el('h3', 'card__t', lab.title));
    body.appendChild(el('p', 'card__q', lab.question));
    body.appendChild(spec);

    card.appendChild(stage);
    card.appendChild(body);
    grid.appendChild(card);

      lab.mount(stage, { big: false });
      cards[lab.id] = { card: card, open: open, lab: lab };
    });
  });

  /* --- the expand --------------------------------------------------------- */

  var live = null;

  function lock() {
    var gap = window.innerWidth - root.clientWidth;
    document.body.classList.add('is-locked');
    if (gap > 0) document.body.style.paddingRight = gap + 'px';
  }
  function unlock() {
    document.body.classList.remove('is-locked');
    document.body.style.paddingRight = '';
  }

  function openLab(lab, card, returnTo) {
    if (live) return;

    var first = card.getBoundingClientRect();
    var scrim = el('div', 'scrim');
    var sheet = el('div', 'sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', lab.title);

    var pad = window.innerWidth < 640 ? 12 : 22;
    var w = Math.min(880, window.innerWidth - pad * 2);
    var h = window.innerHeight - pad * 2;
    sheet.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
    sheet.style.top = pad + 'px';
    sheet.style.width = w + 'px';
    sheet.style.height = h + 'px';

    /* The scrollbar gutter is reserved in CSS, so the content width is the
       same before and after the notes overflow. Without that, the sheet
       reflowed by the width of a scrollbar halfway through the expand. */
    var inner = el('div', 'sheet__inner');

    var stage = el('div', 'sheet__stage');
    var body = el('div', 'sheet__body');
    body.appendChild(el('span', 'sheet__n', lab.n));
    body.appendChild(el('h2', 'sheet__t', lab.title));
    body.appendChild(el('p', 'sheet__q', lab.question));
    body.appendChild(el('div', 'sheet__note', lab.note));

    var dl = el('dl', 'sheet__table');
    Object.keys(lab.spec).forEach(function (k) {
      dl.appendChild(el('dt', null, k));
      dl.appendChild(el('dd', null, lab.spec[k]));
    });
    body.appendChild(dl);

    inner.appendChild(stage);
    inner.appendChild(body);
    sheet.appendChild(inner);

    var close = el('button', 'sheet__close',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    sheet.appendChild(close);

    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    lock();
    card.classList.add('is-source');

    var cleanup = lab.mount(stage, { big: true });

    var last = sheet.getBoundingClientRect();
    var sx = first.width / last.width;
    var sy = first.height / last.height;
    var dx = first.left - last.left;
    var dy = first.top - last.top;
    var dur = ms('--d-4');
    var ease = tok('--e-out');

    if (still()) {
      scrim.style.opacity = '1';
    } else {
      scrim.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: dur, easing: 'linear', fill: 'both' });
      sheet.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' },
        { transform: 'none' }
      ], { duration: dur, easing: ease, fill: 'both' });
      inner.animate([
        { transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')', opacity: 0.2 },
        { transform: 'none', opacity: 1 }
      ], { duration: dur, easing: ease, fill: 'both' });
      close.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }],
        { duration: dur, easing: 'linear', fill: 'both' });
    }

    live = { lab: lab, card: card, sheet: sheet, inner: inner, scrim: scrim,
             cleanup: cleanup, returnTo: returnTo };

    close.addEventListener('click', closeLab);
    scrim.addEventListener('click', closeLab);
    document.addEventListener('keydown', onKey);
    close.focus({ preventScroll: true });

    /* On the deck the hash is the deck's address, so the panel leaves it
       alone rather than fighting over it. */
    if (history.replaceState && root.getAttribute('data-deck') !== 'on') {
      history.replaceState(null, '', '#lab/' + lab.id);
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeLab(); }
  }

  function closeLab() {
    if (!live) return;
    var L = live;
    live = null;
    document.removeEventListener('keydown', onKey);
    if (typeof L.cleanup === 'function') L.cleanup();

    /* Once the notes have been scrolled, the thing on screen is no longer the
       card that was tapped, so flying back to it would be a lie. Below the
       fold the sheet just drops away instead. */
    var scrolled = L.sheet.scrollTop > 8;

    var first = L.card.getBoundingClientRect();
    var last = L.sheet.getBoundingClientRect();
    var sx = first.width / last.width;
    var sy = first.height / last.height;
    var dx = first.left - last.left;
    var dy = first.top - last.top;

    var done = function () {
      L.sheet.remove();
      L.scrim.remove();
      L.card.classList.remove('is-source');
      unlock();
      if (L.returnTo) L.returnTo.focus({ preventScroll: true });
    };

    if (still()) { done(); }
    else if (scrolled) {
      L.sheet.style.transformOrigin = 'center';
      L.scrim.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 260, easing: 'linear', fill: 'both' });
      L.sheet.animate([
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'scale(.97)' }
      ], { duration: 260, easing: tok('--e-standard'), fill: 'both' }).onfinish = done;
    }
    else {
      var dur = 380, ease = tok('--e-standard');
      L.scrim.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: dur, easing: 'linear', fill: 'both' });
      L.inner.animate([
        { transform: 'none', opacity: 1 },
        { transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')', opacity: 0.2 }
      ], { duration: dur, easing: ease, fill: 'both' });
      var a = L.sheet.animate([
        { transform: 'none' },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }
      ], { duration: dur, easing: ease, fill: 'both' });
      a.onfinish = done;
    }

    if (history.replaceState && root.getAttribute('data-deck') !== 'on') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  /* --- motion tokens ------------------------------------------------------ */

  /* Turns a CSS timing function into points we can draw. Handles the two forms
     used on this site: cubic-bezier(a,b,c,d) and linear(v p%, ...). */
  function samples(fn) {
    var pts = [], i;
    var cb = /cubic-bezier\(([^)]+)\)/.exec(fn);
    if (cb) {
      var n = cb[1].split(',').map(parseFloat);
      for (i = 0; i <= 60; i++) {
        var t = i / 60, u = 1 - t;
        pts.push([
          3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t,
          3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t
        ]);
      }
      return pts;
    }
    var ln = /linear\(([^)]+)\)/.exec(fn);
    if (ln) {
      var raw = ln[1].split(',').map(function (s) { return s.trim(); });
      var stops = raw.map(function (s) {
        var parts = s.split(/\s+/);
        var v = parseFloat(parts[0]);
        var p = parts.length > 1 ? parseFloat(parts[1]) / 100 : null;
        return { v: v, p: p };
      });
      if (stops[0].p === null) stops[0].p = 0;
      if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
      for (i = 0; i < stops.length; i++) {          /* fill the gaps evenly */
        if (stops[i].p !== null) continue;
        var a = i - 1; while (stops[a].p === null) a--;
        var b = i; while (stops[b].p === null) b++;
        var span = (stops[b].p - stops[a].p) / (b - a);
        for (var k = a + 1; k < b; k++) stops[k].p = stops[a].p + span * (k - a);
      }
      return stops.map(function (s) { return [s.p, s.v]; });
    }
    return [[0, 0], [1, 1]];                         /* linear fallback */
  }

  function curvePath(pts) {
    return pts.map(function (p, i) {
      return (i ? 'L' : 'M') + (p[0] * 100).toFixed(2) + ' ' + (100 - p[1] * 100).toFixed(2);
    }).join(' ');
  }

  var easings = [
    ['--e-standard', 'Default. Anything that just needs to arrive.'],
    ['--e-out', 'Leaves fast, settles slowly. Cards, sheets, reveals.'],
    ['--e-in-out', 'Symmetric, so it reads the same played backwards.'],
    ['--e-spring', 'Overshoots and returns. Small controls only.']
  ];

  var tokenBox = document.getElementById('tokens');
  if (tokenBox) {
    var studyNames = ['Arrive', 'Release', 'Exchange', 'Rebound'];
    easings.forEach(function (pair, index) {
      var card = el('button', 'token token--study');
      card.type = 'button';
      card.dataset.motionStudy = index;
      card.setAttribute('aria-label', 'Replay ' + studyNames[index] + ', five-second ' + pair[0] + ' study');
      var stage = el('div', 'token__study');
      var canvas = el('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      stage.appendChild(canvas);
      card.appendChild(stage);
      card.appendChild(el('div', 'token__study-title', studyNames[index]));
      card.appendChild(el('div', 'token__name', pair[0]));
      card.appendChild(el('div', 'token__use', pair[1]));
      tokenBox.appendChild(card);
    });
  }
  /* --- deep link and year ------------------------------------------------- */

  var m = /^#lab\/(.+)$/.exec(location.hash || '');
  if (m && cards[m[1]]) {
    var target = cards[m[1]];
    setTimeout(function () {
      target.card.scrollIntoView({ block: 'center', behavior: 'auto' });
      openLab(target.lab, target.card, target.open);
    }, 60);
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* --- the hand ------------------------------------------------------------
     Four blobs, five colours, five tilts, three sizes, and a hash. Everything
     on this site that leaves a small mark beside a row draws it from here, so
     the chapter list on the first page and the tally on the last are the same
     hand rather than two things that happen to both be round.

     Not one of the blobs is round. A border-radius circle is the same circle
     on every row and reads as a control; a shape traced by hand is a little
     lopsided, and four different lopsided shapes read as four marks somebody
     left. Yellow is out of the colour pool: at this size on the light page it
     disappears. */
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  var PENS = [
    'M10 1.4c4.6-.4 8.4 3 8.6 7.2.2 4.6-3.4 8.6-7.8 9-4.8.4-8.8-3-9.2-7.4C1.2 5.8 5 1.8 10 1.4Z',
    'M9.4 1.2c5 .2 9 3.6 9.2 8.2.2 4.4-3.6 8.6-8.2 8.8C5.6 18.4 1.4 14.6 1.2 10 1 5.4 4.6 1 9.4 1.2Z',
    'M10.6 1.6c5.2.6 8.4 4.4 8 9.2-.4 4.4-4.6 7.8-9 7.4-4.6-.4-8.2-4.4-7.8-9 .4-4.6 4-8.4 8.8-7.6Z',
    'M9.8 1.8c4.4-.6 8.8 2.6 9 7.2.2 4.8-3.2 9-7.8 9.2-4.6.2-8.6-3.4-8.8-8-.2-4.4 3.2-7.8 7.6-8.4Z'
  ];
  var INKS = ['--c1', '--c2', '--c3', '--c4', '--c6'];
  var TILTS = [-14, -6, 0, 8, 17];
  var SIZES = [9, 10.5, 12];

  /* Each row starts from its own hash and then steps until it lands on a shape
     and a colour no other row in the same set has taken. Four rows out of four
     shapes and five colours collide about half the time otherwise, and two
     rows wearing the same green is the one thing that makes the set look like
     a mistake rather than a hand. */
  function free(i, list, used) {
    for (var k = 0; k < list.length; k++) {
      var j = (i + k) % list.length;
      if (!used[j]) { used[j] = 1; return j; }
    }
    return i % list.length;
  }

  /* Draw one. `used` is the set this row belongs to, so the chapter list and
     the tally each avoid repeats within themselves without arguing with each
     other. The caller decides what the mark does; this only decides what it
     looks like. */
  function markDot(host, name, cls, used) {
    if (host.querySelector('.' + cls)) return null;
    var h = hash(name || cls);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', PENS[free(h % PENS.length, PENS, used.pen)]);
    svg.appendChild(path);
    host.style.setProperty('--o-ink',
      'var(' + INKS[free((h >>> 3) % INKS.length, INKS, used.ink)] + ')');
    host.style.setProperty('--o-tilt', TILTS[(h >>> 7) % TILTS.length] + 'deg');
    host.style.setProperty('--o-w', SIZES[(h >>> 11) % SIZES.length] + 'px');
    host.appendChild(svg);
    return svg;
  }

  /* --- the drawn rules -----------------------------------------------------
     Every rule on this site is the same stroke at the same weight, because a
     rule that changes thickness stops reading as the same device. What varies
     is the bend and the length: four strokes exist, and each heading gets one
     picked from its own text, so the page is varied and a reload does not
     reshuffle it. */
  (function () {
    function dress(el, lens) {
      var h = hash((el.textContent || '').trim() || el.className);
      el.style.setProperty('--w', 'var(--wiggle-' + (h % 4 + 1) + ')');
      /* >>> not >>: a hash past 2^31 goes negative with the signed shift and
         indexes the array off its front end */
      el.style.setProperty('--rule-w', lens[(h >>> 3) % lens.length] + 'px');
    }
    var HEAD = [46, 52, 58, 64, 70];
    var EYE = [28, 32, 36, 40];
    document.querySelectorAll('.section__head h2').forEach(function (n) { dress(n, HEAD); });
    document.querySelectorAll('.eyebrow').forEach(function (n) { dress(n, EYE); });

    /* The rule beside a quote, same idea as the rules under the headings: the
       pen comes from the text it is standing next to. A quote that lands on
       the pen its neighbour already has steps to the next one — two identical
       wobbles side by side read as a repeat, which is the one thing a drawn
       mark must not do. */
    var lastPen = -1;
    document.querySelectorAll('.note blockquote').forEach(function (q) {
      var pen = hash((q.textContent || '').trim()) % 4;
      if (pen === lastPen) pen = (pen + 1) % 4;
      lastPen = pen;
      q.style.setProperty('--qpen', 'var(--wiggle-v' + (pen + 1) + ')');
    });

    /* the mark for the row you are on: it arrives when you get there */
    var guideSet = { pen: {}, ink: {} };
    document.querySelectorAll('.guide a').forEach(function (a) {
      var name = (a.querySelector('b') || a).textContent.trim();
      markDot(a, name || a.getAttribute('href') || 'guide', 'guide__o', guideSet);
    });
  })();


  /* --- the contents, four heights ------------------------------------------
     The four chapter lines are the tallest thing on the first page after the
     title. Switch with ?g=rows | strip | inline | names, and the choice
     sticks. Whichever one wins, the other three go. */
  (function () {
    var q = /[?&]g=(side|rows|strip|inline|names)/.exec(location.search);
    var g;
    try {
      if (q) { localStorage.setItem('rl-guide', q[1]); g = q[1]; }
      else g = localStorage.getItem('rl-guide') || 'side';
    } catch (e) { g = q ? q[1] : 'side'; }
    document.documentElement.setAttribute('data-guide', g);
  })();


  /* --- the about page counts itself ----------------------------------------
     The right half of that page was empty and the left half was three
     paragraphs, which is a page that says "I design with numbers" and then
     shows you none.

     Every figure here is counted off the live document rather than typed, so
     it cannot drift: add a page and the number moves. They run up from zero
     on arrival, one after another at the stagger from experiment 07, and the
     motion switch turns it into a straight print. */
  (function () {
    var host = document.getElementById('tally');
    if (!host) return;

    function n(sel) { return document.querySelectorAll(sel).length; }
    function rows() {
      var icons = document.getElementById('iconcount');
      return [
        [n('.page'), 'pages', 'across five chapters'],
        [n('.deck .grid .card'), 'experiments', 'each about one number'],
        [n('.tile'), 'tiles', 'six equations'],
        [n('.flow__step'), 'screens', 'built at runtime'],
        [icons ? parseInt(icons.textContent, 10) || 0 : 0, 'icons', 'drawn as SVG paths'],
        [0, 'image files', 'none, anywhere']
      ];
    }

    function build() {
      host.innerHTML = '';
      /* The same mark the chapter list wears, from the same hand — she asked
         for this one by pointing at it. It runs the other way round, because
         it is answering a different question: on the first page the dot says
         "you are on this row", here it says "this row has a number in it", so
         it is there at rest and leaves as the number lands. Same four shapes,
         same five colours, same spring. */
      var set = { pen: {}, ink: {} };
      rows().forEach(function (r) {
        var row = el('div', 'tally__row');
        row.innerHTML = '<b data-to="' + r[0] + '">0</b>' +
                        '<span class="tally__k">' + r[1] + '</span>' +
                        '<span class="tally__d">' + r[2] + '</span>';
        host.appendChild(row);
        markDot(row, r[1], 'tally__o', set);
      });
    }

    /* The figures are printed, not played. An arrival animation makes a page
       that was already loaded pretend it is still loading, and the first
       keyframe of a fade is a blank page.

       The motion is on the other side of the pointer, and so is the figure
       itself now: at rest the column holding it is zero wide, and running a
       row opens it and decodes the digits. Nothing happens until you ask. */
    function print() {
      host.querySelectorAll('b').forEach(function (b) {
        b.textContent = parseInt(b.getAttribute('data-to'), 10) || 0;
      });
    }

    /* The column has to open to a LENGTH, not to auto, or it snaps instead of
       sliding — so each row is told how wide its own number is. Measured off a
       probe wearing the same type rather than computed from a character count,
       because "41" and "11" are not the same width in a proportional face even
       with tabular figures switched on. Re-measured when the fonts land and
       when the window changes, since the size is a clamp. */
    var probe = el('b', 'tally__probe');
    host.appendChild(probe);

    function measure() {
      host.querySelectorAll('.tally__row').forEach(function (row) {
        probe.textContent = row.querySelector('b').getAttribute('data-to') || '0';
        row.style.setProperty('--slot',
          (Math.ceil(probe.getBoundingClientRect().width) + 1) + 'px');
      });
    }

    /* Digits resolve left to right out of a scramble. The scramble steps every
       70ms rather than every frame: at 60fps it is a blur, and a blur is
       noise. Each digit locks at its own moment, the last one landing at 82%
       so the number is settled a little before the slide finishes — arriving
       and still deciding at the same time reads as a glitch. */
    function decode(b) {
      var to = String(parseInt(b.getAttribute('data-to'), 10) || 0);
      clearTimeout(b._t);
      if (still()) { b.textContent = to; return; }
      var d = ms('--d-5') || 700;
      var t0 = performance.now(), swapped = -1e9, shown = to.split('');
      /* a decode that never gets a frame would sit on a scramble */
      b._t = setTimeout(function () { b.textContent = to; }, d + 240);
      (function step(now) {
        var t = (now - t0) / d;
        if (t >= 1) { b.textContent = to; return; }
        if (now - swapped > 70) {
          for (var i = 0; i < to.length; i++) {
            var lockAt = (i + 1) / to.length * 0.82;
            shown[i] = t >= lockAt ? to.charAt(i)
                                   : String(Math.floor(Math.random() * 10));
          }
          b.textContent = shown.join('');
          swapped = now;
        }
        requestAnimationFrame(step);
      })(t0);
    }

    function wire() {
      host.querySelectorAll('.tally__row').forEach(function (row) {
        var b = row.querySelector('b');
        row.addEventListener('pointerenter', function () { decode(b); });
        row.addEventListener('focusin', function () { decode(b); });
        row.addEventListener('pointerleave', function () {
          clearTimeout(b._t);
          b.textContent = b.getAttribute('data-to');
        });
      });
    }

    build();
    print();
    measure();
    wire();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(function () {});
    }
    window.addEventListener('resize', measure);
    /* pager.js writes the chapter onto the root; rebuild there in case a
       number changed while you were somewhere else */
    new MutationObserver(function () {
      if (root.getAttribute('data-chapter') === 'about') {
        build(); print(); host.appendChild(probe); measure(); wire();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-chapter'] });
  })();


  /* --- the header draws its own line ---------------------------------------
     One stroke, wiped in from the left: the dash offset walks from .8 (a short
     left stub, the same idea as the segment under every heading) to 0.

     It cycled through four pens for a version, so no two visits drew the same
     line. That was a nice trick and one too many: the header is the thing you
     see on every page of the site, and a mark that is different every time you
     look at it is not a signature. One line, always the same line. */
  (function () {
    var name = document.querySelector('.nav__name');
    if (!name) return;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'nav__rule');
    svg.setAttribute('viewBox', '0 0 200 9');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('pathLength', '1');
    path.setAttribute('d', 'M3 6C40 3 78 7 116 4 148 2 176 6 197 4');
    svg.appendChild(path);
    name.appendChild(svg);
  })();


  /* --- colour that follows the pointer --------------------------------------
     The second half of the headline is filled with a radial gradient whose
     centre is wherever the pointer is. It is the Gesture tile's idea moved
     onto letters: the dots swell near the cursor and fade with distance, and
     so does this. Nothing runs on its own — leave the line and the centre
     eases back to the middle.

     The stops are the site's six, each stepped toward the page until it
     actually measures 3:1, the same walk theme.js does for --accent-line.
     A headline you cannot read is not a headline. */
  (function () {
    function rgb(h) {
      var n = parseInt(h.replace('#', ''), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    function hex(c) {
      return '#' + c.map(function (v) {
        return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
      }).join('');
    }
    function lum(c) {
      var s = c.map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    }
    function ratio(a, b) {
      var x = lum(rgb(a)), y = lum(rgb(b));
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function walk(colour, bg, target) {
      if (!/^#[0-9a-f]{6}$/i.test(colour)) return colour;
      var c = rgb(colour), dark = lum(rgb(bg)) > 0.5;
      for (var i = 0; i < 60 && ratio(hex(c), bg) < target; i++) {
        c = c.map(function (v) { return dark ? v * 0.94 : v + (255 - v) * 0.06; });
      }
      return hex(c);
    }
    function paint() {
      var bg = tok('--bg') || '#ffffff';
      /* five of the six, so the run has somewhere to go. Sage is left out:
         it is the one that reads as grey rather than as a colour. */
      ['--c1', '--c2', '--c3', '--c4', '--c5'].forEach(function (t, i) {
        root.style.setProperty('--g' + (i + 1), walk(tok(t), bg, 3));
      });
    }
    paint();
    document.addEventListener('themechange', paint);

    document.querySelectorAll('.hero h1, .phero h1').forEach(function (h1) {
      var em = h1.querySelector('em');
      if (!em) return;
      h1.addEventListener('pointermove', function (e) {
        if (still()) return;
        var r = em.getBoundingClientRect();
        if (!r.width || !r.height) return;
        em.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        em.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
      h1.addEventListener('pointerleave', function () {
        em.style.setProperty('--mx', '50%');
        em.style.setProperty('--my', '50%');
      });
    });
  })();


  /* --- the link pills tip when you touch them ------------------------------
     These four sit at the end of the About page and are the last thing on the
     site you can press, so they are the one place a press should still feel
     drawn rather than clicked.

     The angle is re-rolled on every enter instead of being fixed in CSS. A
     constant -2.6deg is a shape; a different small angle each time is a hand.
     It stays under 2deg: on a 200px pill even 4deg lifts one corner 7px and
     starts to read as a wobble rather than a nudge.
     It never repeats the previous sign, so two hovers in a row never look
     like one hover that failed to reset, and it rests flat — an idle row of
     crooked pills reads as a layout bug, not as a style. */
  (function () {
    var pills = document.querySelectorAll('.links .btn');
    if (!pills.length) return;

    /* Where it starts from: hashed off the label, so each pill leans its own
       way before you have touched anything, and leans the same way tomorrow. */
    var SEED = [-1, 1];
    pills.forEach(function (b) {
      b.dataset.tip = SEED[hash(b.textContent.trim()) % 2];
    });

    function roll(b) {
      if (still()) return;
      var last = parseFloat(b.dataset.tip) || 1;
      var sign = last > 0 ? -1 : 1;             /* never twice the same way */
      var deg = sign * (0.7 + Math.random() * 1.1);
      b.dataset.tip = deg;
      b.style.setProperty('--pill-tip', deg.toFixed(2) + 'deg');
    }

    pills.forEach(function (b) {
      b.addEventListener('pointerenter', function () { roll(b); });
      b.addEventListener('focus', function () { roll(b); });
    });
  })();

})();

/* The intro note starts on the same left edge as the chapter names under it.
   Below 641px the two already share the page gutter; above it the list can sit
   in a column of its own, so the note's left is read off the first name. */
(function () {
  'use strict';
  function align() {
    var b = document.querySelector('.page--intro .guide a b');
    var d = document.querySelector('.page--intro .doodle');
    if (!b || !d) return;
    if (!window.matchMedia('(min-width: 641px)').matches) { d.style.left = ''; return; }
    var rb = b.getBoundingClientRect();
    if (!rb.width) return;                       /* the intro page is not showing */
    var op = d.offsetParent ? d.offsetParent.getBoundingClientRect() : { left: 0 };
    d.style.left = (rb.left - op.left - 4) + 'px';   /* the note carries 4px of its own padding */
  }
  window.addEventListener('resize', align);
  window.addEventListener('hashchange', function () { setTimeout(align, 60); setTimeout(align, 700); });
  window.addEventListener('load', function () { align(); setTimeout(align, 400); });
  if (window.ResizeObserver) {
    var g = document.querySelector('.page--intro .guide');
    if (g) new ResizeObserver(align).observe(g);
  }
})();

/* Opening / refreshing: wait (briefly) for the webfonts and one painted frame, then let the page in with a short fade, and the
   intro's own blocks one after another. If anything is slow the timer in <head> lets the page through anyway. */
(function () {
  'use strict';
  var html = document.documentElement;
  function reveal() {
    if (!html.classList.contains('booting')) return;
    html.classList.remove('booting');
    html.classList.add('booted');
    /* the fade is over after .6s; this only makes sure nothing can stay transparent if the browser never ran it */
    setTimeout(function () { html.classList.add('ready'); }, 1500);
  }
  var calm = html.getAttribute('data-motion') === 'off' ||
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) { html.classList.remove('booting'); return; }
  var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  var cap = new Promise(function (r) { setTimeout(r, 1400); });
  Promise.race([fonts, cap]).then(function () {
    /* a frame after the fonts; the timer is for a tab that is not being drawn, where frames never come */
    requestAnimationFrame(function () { requestAnimationFrame(reveal); });
    setTimeout(reveal, 160);
  });
})();

/* Project pages open over the deck as a sheet: a long page can be closed at any moment (the Close button, Esc, or the browser's
   Back), and the address becomes #/project/<name> so a project can be linked to. The little nav under the bar scrolls the sheet
   to a section and marks the one being read. The deck behind is inert while a sheet is open. */
(function () {
  'use strict';
  var html = document.documentElement;
  var deckEl = document.getElementById('deck');
  var sheets = {};
  [].slice.call(document.querySelectorAll('.casesheet')).forEach(function (el) { sheets[el.id.replace('case-', '')] = el; });
  var openId = null, opener = null;
  var initial = location.hash;           /* captured before the deck rewrites the address */
  var calm = function () {
    return html.getAttribute('data-motion') === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  function scroller(el) { return el.querySelector('.casesheet__scroll'); }

  function mark(el) {
    var sc = scroller(el), links = [].slice.call(el.querySelectorAll('.pnav a[data-scroll]'));
    if (!links.length) return;
    var edge = sc.getBoundingClientRect().top + sc.clientHeight * 0.3, cur = links[0];
    links.forEach(function (l) {
      var t = document.getElementById(l.getAttribute('href').slice(1));
      if (t && t.getBoundingClientRect().top <= edge) cur = l;
    });
    links.forEach(function (l) { l.classList.toggle('on', l === cur); });
  }
  Object.keys(sheets).forEach(function (id) {
    var el = sheets[id];
    var panel = document.createElement('div');
    panel.className = 'casesheet__panel';
    while (el.firstChild) panel.appendChild(el.firstChild);
    el.appendChild(panel);
    scroller(el).addEventListener('scroll', function () { mark(el); }, { passive: true });
    el.querySelector('.casesheet__close').addEventListener('click', close);
    /* the dimmed margin beside the panel is a way out too */
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
  });

  /* The sheet sits between the two menus, so it is placed from where they actually are: below the top bar, above the bottom one.
     On a phone it is full screen. */
  function place() {
    var nav = document.querySelector('.nav'), bar = document.querySelector('.deck__bar');
    var small = window.matchMedia('(max-width: 760px)').matches;
    var top = 0, bottom = 0;
    if (!small) {
      if (nav) top = Math.max(0, Math.round(nav.getBoundingClientRect().bottom));
      if (bar) {
        /* the bar element spans the whole deck and lets clicks through; the menu is its children, at the foot */
        var kids = [].slice.call(bar.children).filter(function (k) { var r = k.getBoundingClientRect(); return r.height > 0 && r.top > window.innerHeight * 0.5; });
        if (kids.length) {
          var topMost = Math.min.apply(null, kids.map(function (k) { return k.getBoundingClientRect().top; }));
          bottom = Math.max(0, Math.round(window.innerHeight - topMost + 8));
        }
      }
    }
    html.style.setProperty('--sheet-top', top + 'px');
    html.style.setProperty('--sheet-bottom', bottom + 'px');
    html.classList.toggle('sheet-full', small);
  }
  window.addEventListener('resize', function () { if (openId) place(); });

  /* KeePlan's phone is 695px tall at its design size, which is more than a sheet shows. The prototype (the step list and the phone together) is
     scaled down (zoom, so layout follows) until all of it fits between the sticky nav and the foot of the sheet. */
  function fit(el) {
    var sc = scroller(el), nav = el.querySelector('.pnav');
    var avail = sc.clientHeight - (nav ? nav.offsetHeight : 0) - 56;
    var k = Math.max(0.5, Math.min(1, avail / 695));
    el.style.setProperty('--kps', k.toFixed(3));
  }
  window.addEventListener('resize', function () { if (openId) fit(sheets[openId]); });
  function show(id) {
    var el = sheets[id];
    if (!el) return false;
    if (openId && openId !== id) { sheets[openId].hidden = true; }
    openId = id;
    el.hidden = false;
    scroller(el).scrollTop = 0;
    html.classList.add('has-sheet');
    place();
    fit(el);
    mark(el);
    el.querySelector('.casesheet__close').focus({ preventScroll: true });
    return true;
  }
  function hide() {
    if (!openId) return;
    sheets[openId].hidden = true;
    openId = null;
    html.classList.remove('has-sheet');
    if (opener && opener.focus) { opener.focus({ preventScroll: true }); }
    opener = null;
  }
  function open(id, from) {
    if (!sheets[id]) return;
    opener = from || null;
    show(id);
    history.pushState({ casesheet: id }, '', '#/project/' + id);
  }
  function close() {
    if (!openId) return;
    if (history.state && history.state.casesheet && !history.state.entry) { history.back(); return; }
    hide();
    history.replaceState(null, '', '#/project');
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('a[data-case]') : null;
    if (card) { e.preventDefault(); open(card.getAttribute('data-case'), card); return; }
    var a = e.target.closest ? e.target.closest('a[data-scroll]') : null;
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById(a.getAttribute('href').slice(1));
    var sc = a.closest('.casesheet__scroll');
    if (!target || !sc) return;
    var nav = sc.querySelector('.pnav');
    var top = target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (nav ? nav.offsetHeight + 34 : 12);
    sc.scrollTo({ top: Math.max(0, top), behavior: calm() ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openId) { e.preventDefault(); close(); } });
  document.addEventListener('click', function (e) {
    if (!openId || !e.target.closest) return;
    if (e.target.closest('.deck__bar, .nav__name, .nav a[href^="#/"]')) {
      hide();
      history.replaceState(null, '', '#/project');
    }
  }, true);

  function fromHash(h) {
    var m = /^#\/project\/(keeplan|p\d+)$/.exec(h || '');
    return m && sheets[m[1]] ? m[1] : null;
  }
  window.addEventListener('popstate', function () {
    var id = fromHash(location.hash);
    if (id) show(id); else if (openId) hide();
  });
  /* opened by address: go to the Projects page first, then lay the sheet over it */
  window.addEventListener('load', function () {
    var id = fromHash(initial);
    if (!id) return;
    if (window.DECK) window.DECK.go(3, 0, false);
    show(id);
    history.replaceState({ casesheet: id, entry: true }, '', '#/project/' + id);
  });
})();
