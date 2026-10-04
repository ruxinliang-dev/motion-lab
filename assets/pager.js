/* ---------------------------------------------------------------------------
   The deck.

   The site is not one column any more. Chapters sit side by side on a
   horizontal axis; the pages inside a chapter stack on a vertical one. Moving
   is a translate of one big canvas, so the whole site is a single surface you
   are looking at a window onto, rather than a scroll.

   Left and right change chapter, up and down change page. A page that is
   taller than the window still scrolls on its own; the deck only takes over
   once that scroll is at its edge, so long text is never trapped.

   Every position is addressable: #/experiments/3. The minimap in the corner
   is the actual shape of the matrix, not a decoration.

   Durations and easings come from the tokens in site.css, like everything
   else that moves here.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  var root = document.documentElement;

  function tok(n) {
    return getComputedStyle(root).getPropertyValue(n).replace(/\s+/g, ' ').trim();
  }
  function ms(n) { return parseFloat(tok(n)) || 0; }
  function still() {
    return root.getAttribute('data-motion') === 'off' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var deck = document.getElementById('deck');
  if (!deck) return;

  var canvas = deck.querySelector('.deck__canvas');
  var chapters = [].slice.call(canvas.querySelectorAll('.chapter'));
  if (!chapters.length) return;

  /* matrix[col] = array of page elements in that chapter */
  var matrix = chapters.map(function (ch) {
    return [].slice.call(ch.querySelectorAll('.page'));
  });
  var names = chapters.map(function (ch) { return ch.getAttribute('data-chapter'); });
  var total = matrix.reduce(function (n, c) { return n + c.length; }, 0);

  var col = 0, rowOf = matrix.map(function () { return 0; });
  var rail, mini, counter, chapterOut, previous, next;

  function adjacent(direction) {
    var c = col, r = rowOf[col] + direction;
    if (r < 0) { c--; if (c < 0) return null; r = matrix[c].length - 1; }
    if (r >= matrix[c].length) { c++; if (c >= matrix.length) return null; r = 0; }
    return [c, r];
  }

  function turnPage(direction) {
    var target = adjacent(direction);
    if (target) go(target[0], target[1]);
  }

  function titleOf(p) {
    var h = p.querySelector('h1, h2');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  /* --- layout ------------------------------------------------------------ */

  /* Sized in pixels, not percentages. A page at height:100% resolves against
     the chapter, and a chapter is as tall as all its pages stacked, so every
     page came out N screens tall. */
  var pageW = 0, pageH = 0;

  function place() {
    pageW = deck.clientWidth;
    pageH = deck.clientHeight;
    deck.style.setProperty('--page-h', pageH + 'px');
    chapters.forEach(function (ch, c) {
      ch.style.left = (c * pageW) + 'px';
      ch.style.width = pageW + 'px';
      ch.style.height = (matrix[c].length * pageH) + 'px';
      matrix[c].forEach(function (p, r) {
        p.style.top = (r * pageH) + 'px';
        p.style.height = pageH + 'px';
        p.style.width = pageW + 'px';
      });
    });
  }

  function offsetFor(c, r) {
    return { x: -c * pageW, y: -r * pageH };
  }

  var keyboardInput = false;
  document.addEventListener('keydown', function () { keyboardInput = true; }, true);
  document.addEventListener('pointerdown', function () { keyboardInput = false; }, true);

  function move(animate) {
    var o = offsetFor(col, rowOf[col]);
    var t = 'translate3d(' + o.x + 'px,' + o.y + 'px,0)';
    if (animate && !keyboardInput && !still()) {
      canvas.style.transition = 'transform ' + ms('--ui-page') + 'ms ' + tok('--e-out');
    } else {
      canvas.style.transition = 'none';
    }
    canvas.style.transform = t;
  }

  /* --- state -------------------------------------------------------------- */

  function clamp(c, r) {
    c = Math.max(0, Math.min(matrix.length - 1, c));
    r = Math.max(0, Math.min(matrix[c].length - 1, r));
    return [c, r];
  }

  function go(c, r, push, animate) {
    var cr = clamp(c, r);
    var changed = (cr[0] !== col) || (cr[1] !== rowOf[cr[0]]);
    if (push !== false && changed) saveHistory();
    col = cr[0];
    rowOf[col] = cr[1];
    move(animate !== false);
    if (changed) {
      var page = matrix[col][rowOf[col]];
      page.inert = false;
      page.removeAttribute('aria-hidden');
      if (push !== false) page.scrollTop = 0;
      /* the edge timer belongs to the page that had it */
      edgeSince = 0; edgeDir = 0; wheelAcc = 0;
      /* Move focus before hiding the old page, including its input fields. */
      page.setAttribute('tabindex', '-1');
      page.focus({ preventScroll: true });
    }
    paintUI();
    if (push !== false) writeHash();
    return changed;
  }

  function step(dc, dr, animate) {
    if (dc) {
      var next = col + dc;
      if (next < 0 || next >= matrix.length) return false;
      return go(next, rowOf[next], undefined, animate);
    }
    return go(col, rowOf[col] + dr, undefined, animate);
  }

  function index() {
    var n = 0;
    for (var c = 0; c < col; c++) n += matrix[c].length;
    return n + rowOf[col] + 1;
  }

  /* --- routing ------------------------------------------------------------ */

  function routeHash() {
    return '#/' + names[col] + (matrix[col].length > 1 ? '/' + (rowOf[col] + 1) : '');
  }
  function historyState() {
    return { deck: { hash: routeHash(), scroll: matrix[col][rowOf[col]].scrollTop } };
  }
  function saveHistory() {
    if (location.hash === routeHash()) history.replaceState(historyState(), '', location.href);
  }
  function writeHash() {
    if (location.hash !== routeHash()) history.pushState(historyState(), '', routeHash());
  }
  function parseRoute(hash) {
    var m = /^#\/([^/]+)(?:\/(\d+))?$/.exec(hash || '');
    if (!m) return null;
    var name;
    try { name = decodeURIComponent(m[1]); } catch (e) { return null; }
    var c = names.indexOf(name);
    return c < 0 ? null : clamp(c, m[2] ? parseInt(m[2], 10) - 1 : 0);
  }
  function readHash() {
    var cr = parseRoute(location.hash);
    if (!cr) return false;
    if (over) closeOver();
    go(cr[0], cr[1], false);
    var saved = history.state && history.state.deck;
    if (saved && saved.hash === routeHash()) matrix[col][rowOf[col]].scrollTop = saved.scroll || 0;
    return true;
  }

  /* --- the corner index --------------------------------------------------- */

  /* Chapter rail, top right. In rail mode the bottom one does this job, and
     two of them would only disagree with each other. */
  function buildRail() {
    rail = el('nav', 'deck__rail');
    rail.setAttribute('aria-label', 'Chapters');
    names.forEach(function (n, c) {
      var b = el('button', 'deck__chip');
      b.type = 'button';
      b.textContent = n;
      b.addEventListener('click', function () { go(c, rowOf[c]); });
      rail.appendChild(b);
    });
    deck.appendChild(rail);
  }

  /* Back to the dashes, and the matrix they were in: chapters across, pages
     down, which is the shape of the site rather than a row of thirteen.

     The only thing that changes is that each mark now sits inside a button.
     The mark is still 16x3; the hit area around it is 22x15, which was the
     whole problem the first time. */
  function buildMini() {
    mini = el('div', 'deck__mini');
    matrix.forEach(function (pages, c) {
      var colEl = el('span', 'deck__minicol');
      pages.forEach(function (pEl, r) {
        var b = el('button', 'deck__dot');
        b.type = 'button';
        b.title = names[c] + ' \u00b7 ' + titleOf(pEl);
        b.setAttribute('aria-label', b.title);
        b.appendChild(el('i'));
        b.addEventListener('click', function () { go(c, r); });
        colEl.appendChild(b);
      });
      mini.appendChild(colEl);
    });
    return mini;
  }

  function buildUI() {
    buildRail();

    var read = el('div', 'deck__read');
    chapterOut = el('span', 'deck__chapter');
    counter = el('button', 'deck__count');
    counter.type = 'button';
    counter.title = 'All pages (I)';
    counter.setAttribute('aria-expanded', 'false');
    /* Where you are, plus three small stars that blink out of step with each
       other. Without them the readout is a number: nothing about a number
       says you can press it, and the stroke that draws underneath only
       appears once you are already on it. The stars are the part that says
       so before you arrive. */
    counter.innerHTML =
      '<span class="deck__index-label">Index</span><span class="n"></span>' +
      '<span class="deck__stars" aria-hidden="true"><i></i><i></i><i></i></span>';
    counter.addEventListener('click', function () { toggleOver(); });
    read.appendChild(chapterOut);
    read.appendChild(counter);

    var keys = el('div', 'deck__keys',
      '<b>&larr; &rarr;</b> chapter\u3000<b>&uarr; &darr;</b> page\u3000<b>I</b> index');

    var bar = el('div', 'deck__bar');
    bar.appendChild(buildMini());
    bar.appendChild(read);
    bar.appendChild(keys);
    var paging = el('nav', 'deck__paging');
    paging.setAttribute('aria-label', 'Site pages');
    previous = el('button', '', '\u2190 Previous');
    next = el('button', '', 'Next \u2192');
    previous.type = next.type = 'button';
    previous.addEventListener('click', function () { turnPage(-1); });
    next.addEventListener('click', function () { turnPage(1); });
    paging.appendChild(previous);
    paging.appendChild(next);
    bar.appendChild(paging);
    deck.appendChild(bar);
  }

  function paintUI() {
    matrix.forEach(function (pages, c) {
      pages.forEach(function (page, r) {
        var active = c === col && r === rowOf[col];
        page.inert = !active;
        if (active) page.removeAttribute('aria-hidden');
        else page.setAttribute('aria-hidden', 'true');
      });
    });
    rail.querySelectorAll('.deck__chip').forEach(function (b, c) {
      b.setAttribute('aria-current', c === col ? 'true' : 'false');
    });
    mini.querySelectorAll('.deck__minicol').forEach(function (colEl, c) {
      colEl.classList.toggle('on', c === col);
      colEl.querySelectorAll('.deck__dot').forEach(function (b, r) {
        var here = c === col && r === rowOf[col];
        b.classList.toggle('on', here);
        b.classList.toggle('seen', c < col || (c === col && r < rowOf[col]));
        b.setAttribute('aria-current', here ? 'true' : 'false');
      });
    });
    counter.querySelector('.n').textContent =
      String(index()).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    chapterOut.textContent = names[col];
    previous.disabled = !adjacent(-1);
    next.disabled = !adjacent(1);
    root.setAttribute('data-chapter', names[col]);
    if (over) paintOver();
  }

  /* --- the index: the whole matrix at once --------------------------------
     The site is a shape, so the way out of being lost in it is to show the
     shape. The cells sit where the pages sit. */

  var over = null, curC = 0, curR = 0;
  var modalBackground = [];

  function buildOver() {
    over = el('div', 'deck__over');
    over.setAttribute('role', 'dialog');
    over.setAttribute('aria-modal', 'true');
    over.setAttribute('aria-label', 'All pages');

    var grid = el('div', 'deck__matrix');
    matrix.forEach(function (pages, c) {
      var colEl = el('div', 'deck__mcol');
      colEl.appendChild(el('span', 'deck__mname', names[c]));
      pages.forEach(function (pEl, r) {
        var b = el('button', 'deck__mcell');
        b.type = 'button';
        b.innerHTML = '<span class="n"></span><span class="t"></span>';
        b.querySelector('.n').textContent =
          String(r + 1).padStart(2, '0') + ' / ' + matrix[c].length;
        b.querySelector('.t').textContent = titleOf(pEl);
        b.addEventListener('click', function () { closeOver(); go(c, r); });
        b.addEventListener('mouseenter', function () { curC = c; curR = r; paintOver(); });
        b.addEventListener('focus', function () { curC = c; curR = r; paintOver(); });
        colEl.appendChild(b);
      });
      grid.appendChild(colEl);
    });

    var foot = el('p', 'deck__overfoot',
      '<b>&larr; &rarr; &uarr; &darr;</b> pick\u3000<b>Enter</b> go\u3000' +
      '<b>Esc</b> stay where you are');

    /* The colophon lives here rather than at the foot of one page: it is a
       fact about the whole site, and this is the one screen that is about the
       whole site. */
    var mark = el('p', 'deck__colophon',
      '\u00a9 Ruxin Liang \u00b7 ' +
      'Built with plain HTML, CSS and JavaScript');

    over.appendChild(grid);
    var close = el('button', 'deck__close', 'Close index');
    close.type = 'button';
    close.addEventListener('click', closeOver);
    over.appendChild(close);
    over.appendChild(foot);
    over.appendChild(mark);
    /* the empty space around the matrix is a way out, not a dead zone */
    over.addEventListener('click', function (e) {
      if (e.target === over) closeOver();
    });
    deck.appendChild(over);
  }

  function paintOver() {
    var cells = over.querySelectorAll('.deck__mcell');
    var i = 0;
    matrix.forEach(function (pages, c) {
      pages.forEach(function (pEl, r) {
        var b = cells[i++];
        b.classList.toggle('cur', c === curC && r === curR);
        b.classList.toggle('here', c === col && r === rowOf[col]);
        b.setAttribute('aria-current', (c === col && r === rowOf[col]) ? 'true' : 'false');
      });
    });
  }

  function openOver() {
    if (over) return;
    curC = col; curR = rowOf[col];
    buildOver();
    paintOver();
    counter.setAttribute('aria-expanded', 'true');
    root.setAttribute('data-over', 'on');
    var c = over.querySelector('.deck__mcell.cur');
    if (c) c.focus({ preventScroll: true });
    modalBackground = [canvas, rail, deck.querySelector('.deck__bar'),
      document.querySelector('.nav'), document.querySelector('.skip')].filter(Boolean).map(function (node) {
        var state = { node: node, inert: node.inert };
        node.inert = true;
        return state;
      });
  }

  function closeOver() {
    if (!over) return;
    var node = over;
    over = null;
    modalBackground.forEach(function (state) { state.node.inert = state.inert; });
    modalBackground = [];
    counter.focus({ preventScroll: true });
    node.inert = true;
    node.setAttribute('aria-hidden', 'true');
    counter.setAttribute('aria-expanded', 'false');
    root.removeAttribute('data-over');
    if (still()) { node.remove(); return; }
    var a = node.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: ms('--d-2'), easing: tok('--e-in-out'), fill: 'forwards' });
    a.onfinish = function () { node.remove(); };
    setTimeout(function () { if (node.parentNode) node.remove(); }, ms('--d-2') + 120);
  }

  function toggleOver() { over ? closeOver() : openOver(); }

  function overKey(k, e) {
    if (k === 'Escape') { closeOver(); counter.focus(); return true; }
    if (k === 'Tab') {
      var buttons = [].slice.call(over.querySelectorAll('button'));
      var at = buttons.indexOf(document.activeElement);
      var next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true });
      return true;
    }
    var dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
    var dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
    if (!dc && !dr) return false;
    if (dc) {
      curC = Math.max(0, Math.min(matrix.length - 1, curC + dc));
      curR = Math.min(curR, matrix[curC].length - 1);
    } else {
      curR = Math.max(0, Math.min(matrix[curC].length - 1, curR + dr));
    }
    paintOver();
    var cell = over.querySelector('.deck__mcell.cur');
    if (cell) cell.focus({ preventScroll: true });
    return true;
  }

  /* --- input --------------------------------------------------------------
     A page that scrolls keeps its scroll. The deck only moves once that
     scroll has nothing left to give in the direction being asked for. */

  function slackOf(page) { return page.scrollHeight - page.clientHeight; }

  /* Is something between the pointer and the page still able to scroll the way
     the wheel is asking?

     The deck only ever looked at the page. But the page can contain its own
     scrollers — the phone's screen, the flow rail beside it — and a wheel over
     one of those scrolls it AND bubbles up here, where the page, having no
     slack of its own, reads as "at the edge" and turns. So scrolling inside
     the KeePlan prototype flipped the chapter out from under you.

     Walk from whatever the pointer is over up to the page, and if anything on
     the way still has somewhere to go in that direction, this wheel is not the
     deck's. */
  function innerScrolls(target, dir, page) {
    var n = target;
    while (n && n !== page && n.nodeType === 1) {
      var oy = getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        var slack = n.scrollHeight - n.clientHeight;
        if (slack > 2 &&
            (dir > 0 ? n.scrollTop < slack - 2 : n.scrollTop > 2)) return true;
      }
      n = n.parentElement;
    }
    return false;
  }

  function atEdge(page, dir) {
    var slack = slackOf(page);
    if (slack <= 2) return true;
    return dir > 0 ? page.scrollTop >= slack - 2 : page.scrollTop <= 2;
  }

  var wheelLock = 0, wheelAcc = 0;
  /* When a scrolling page runs out of room, the deck does not take over on the
     very next event. A flick delivers its tail long after the page has hit the
     bottom, and without this the last of that tail turns the page before
     anyone has read what they just scrolled to. The rest only applies to pages
     that actually scroll: on a page that fits, the deck answers immediately. */
  var EDGE_REST = 220;
  var edgeSince = 0, edgeDir = 0;
  deck.addEventListener('wheel', function (e) {
    if (over || e.ctrlKey) return;
    var now = Date.now();
    if (now < wheelLock) { e.preventDefault(); return; }
    var page = matrix[col][rowOf[col]];
    var horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

    if (horizontal) {
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 90) {
        if (step(wheelAcc > 0 ? 1 : -1, 0)) wheelLock = now + ms('--d-5');
        wheelAcc = 0;
      }
      e.preventDefault();
      return;
    }

    var dir = e.deltaY > 0 ? 1 : -1;
    if (innerScrolls(e.target, dir, page)) {            /* not ours */
      wheelAcc = 0; edgeSince = 0;
      return;
    }
    if (!atEdge(page, dir)) {                           /* let the page scroll */
      wheelAcc = 0; edgeSince = 0;
      return;
    }
    if (slackOf(page) > 2) {
      if (edgeSince === 0 || edgeDir !== dir) {
        edgeSince = now; edgeDir = dir; wheelAcc = 0;
        e.preventDefault();
        return;
      }
      if (now - edgeSince < EDGE_REST) {
        wheelAcc = 0;
        e.preventDefault();
        return;
      }
    }
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 110) {
      if (step(0, dir)) wheelLock = now + ms('--d-5');
      wheelAcc = 0;
    }
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var k = e.key;
    if (over) { if (overKey(k, e)) e.preventDefault(); return; }
    if (document.querySelector('.sheet') || (t && t.closest('#kp'))) return;
    if (k === 'i' || k === 'I') { e.preventDefault(); openOver(); return; }
    var dir = /^(ArrowDown|PageDown)$/.test(k) ? 1 : /^(ArrowUp|PageUp)$/.test(k) ? -1 : 0;
    if (dir) {
      var page = matrix[col][rowOf[col]];
      if (innerScrolls(t, dir, page)) return;
      e.preventDefault();
      if (!atEdge(page, dir)) {
        page.scrollTop += dir * (k.indexOf('Page') === 0 ? page.clientHeight * .85 : 48);
      } else if (!e.repeat) step(0, dir, false);
      return;
    }
    if (e.repeat && /^(ArrowLeft|ArrowRight)$/.test(k)) { e.preventDefault(); return; }
    if (k === 'ArrowRight') { e.preventDefault(); step(1, 0, false); }
    else if (k === 'ArrowLeft') { e.preventDefault(); step(-1, 0, false); }
    else if (k === 'Home') { e.preventDefault(); go(0, 0, undefined, false); }
    else if (k === 'End') { e.preventDefault(); go(matrix.length - 1, 0, undefined, false); }
  });

  var t0 = null, lockAxis = null, startEdgeDown = false, startEdgeUp = false;
  deck.addEventListener('touchstart', function (e) {
    t0 = null;
    if (over || e.touches.length !== 1 || e.target.closest('#kp, [data-art="lame"]')) return;
    t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    lockAxis = null;
    /* Read the edges now, before the finger moves. This is the whole fix: the
       old code asked at touchend, by which time the swipe had scrolled the
       page to its bottom itself — so one swipe both scrolled to the end and
       turned the page, and a short page could never be read. A gesture that
       starts mid-page now only ever scrolls; turning the page takes a second
       swipe, from a standstill at the edge. */
    var page = matrix[col][rowOf[col]];
    startEdgeDown = atEdge(page, 1) && !innerScrolls(e.target, 1, page);
    startEdgeUp = atEdge(page, -1) && !innerScrolls(e.target, -1, page);
  }, { passive: true });
  deck.addEventListener('touchmove', function (e) {
    if (!t0 || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - t0.x;
    var dy = e.touches[0].clientY - t0.y;
    if (!lockAxis && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      lockAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (lockAxis === 'x') e.preventDefault();
  }, { passive: false });
  deck.addEventListener('touchend', function (e) {
    if (!t0) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    if (lockAxis === 'x' && Math.abs(dx) > 60) step(dx < 0 ? 1 : -1, 0);
    else if (lockAxis === 'y' && Math.abs(dy) > 70) {
      var page = matrix[col][rowOf[col]];
      var dir = dy < 0 ? 1 : -1;
      var wasAtEdge = dir > 0 ? startEdgeDown : startEdgeUp;
      if (wasAtEdge && atEdge(page, dir)) step(0, dir);
    }
    t0 = null; lockAxis = null;
  }, { passive: true });

  /* In-page links to a chapter move the deck instead of jumping. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var cr = parseRoute(a.getAttribute('href'));
    if (!cr) return;
    e.preventDefault();
    go(cr[0], cr[1]);
  });

  window.addEventListener('resize', function () { place(); move(false); });
  window.addEventListener('hashchange', function () { readHash(); });
  window.addEventListener('popstate', function () { readHash(); });

  place();
  buildUI();
  if (!readHash()) { go(0, 0, false); }
  move(false);
  paintUI();
  root.setAttribute('data-deck', 'on');
  history.replaceState(historyState(), '', routeHash());
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  matrix.forEach(function (pages, c) {
    pages.forEach(function (page, r) {
      page.addEventListener('scroll', function () {
        if (c === col && r === rowOf[col]) saveHistory();
      }, { passive: true });
    });
  });

  window.DECK = {
    go: go, step: step, index: toggleOver,
    where: function () { return [col, rowOf[col]]; }
  };
})();
