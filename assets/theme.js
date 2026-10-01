/* ---------------------------------------------------------------------------
   The palette, computed rather than listed.

   Two knobs. Brightness sets the page lightness, greyness sets how much
   chroma survives, measured against six sampled anchors. Everything else falls out of those: surfaces step off the
   page, ink flips when the page goes dark, the six-stop ramp the generative
   tiles draw with is regenerated, and the accents follow.

   The values are written onto :root as the same custom properties site.css
   declares, so nothing downstream knows this file exists. art.js and labs.js
   read those properties through getComputedStyle and cache them, so both are
   told to drop their caches whenever the knobs move.

   Output is hex, not hsl(), because the canvases parse these strings.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  var root = document.documentElement;

  /* A warm neutral. Pure grey on pure white is the thing that reads as
     machine-made, and two degrees of warmth costs nothing. */
  var NEUTRAL_H = 34;
  /* the light end of the ramp runs warmer than the ink does — see build() */
  var PAPER_H = 49;

  /* The six colours, taken off the double-diamond diagram she picked. These
     are anchors, not a formula: at greyness 100 the site prints these exact
     values, and the knob walks them back toward grey from there.

     They are fill colours. On the diagram every card carries near-black text
     on one of these, and that is how they are used here. None of them is a
     text colour on white; the azure is darkened separately for that. */
  var ANCHORS = [
    ['#01b6ff', 'azure'],
    ['#cc9fd2', 'orchid'],
    ['#fe7236', 'orange'],
    ['#24cc71', 'green'],
    ['#fafd5d', 'yellow'],
    ['#94b8ac', 'sage']
  ];

  function toHsl(hex) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16) / 255,
        g = parseInt(h.slice(2, 4), 16) / 255,
        b = parseInt(h.slice(4, 6), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var l = (mx + mn) / 2, d = mx - mn, hh = 0, ss = 0;
    if (d) {
      ss = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60;
    }
    return [hh, ss * 100, l * 100];
  }
  var HSL = ANCHORS.map(function (a) { return toHsl(a[0]); });

  /* Relative luminance, for picking a readable version of the azure rather
     than guessing a lightness that happens to look right on one screen. */
  function lumOf(hex) {
    var h = hex.replace('#', ''), v = [];
    for (var i = 0; i < 3; i++) {
      var c = parseInt(h.substr(i * 2, 2), 16) / 255;
      v.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var x = lumOf(a), y = lumOf(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function hex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2, r;
    if (h < 60) r = [c, x, 0]; else if (h < 120) r = [x, c, 0];
    else if (h < 180) r = [0, c, x]; else if (h < 240) r = [0, x, c];
    else if (h < 300) r = [x, 0, c]; else r = [c, 0, x];
    return '#' + r.map(function (v) {
      return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2);
    }).join('');
  }
  function rgba(h, s, l, a) {
    var c = hex(h, s, l).slice(1);
    return 'rgba(' + parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) +
           ',' + parseInt(c.slice(4, 6), 16) + ',' + a + ')';
  }

  /* brightness 6…100, greyness 0…130 where 100 is the designed default */
  function build(L, S) {
    var k = S / 100;
    var dark = L < 52;
    var away = function (d) { return dark ? L + d : L - d; };   /* off the page */
    var set = {};

    /* The page is paper, and paper is not #ffffff (she: "网页的白色浅色做成
       这种颜色", with an ivory swatch). Pure white is a screen colour: it is
       the brightest thing the display can do, which is why a page made of it
       reads as a lit panel rather than a sheet.

       Two changes, both only in light mode. The light end takes its own hue —
       49, a warmer yellow than the neutrals' 34 — and it is capped just under
       100, because at L = 100 hue and saturation stop meaning anything and
       every tint collapses back to white.

       The saturation is written so that the greyness knob at its designed
       default, 62, lands exactly on her swatch: hsl(49, 100%, 97.8%) is
       #fffdf4 to the byte. Turn greyness down and the paper washes back out
       to neutral, which is what that knob is for. The ink and the lines stay
       on 34 — warming those as well would put an olive cast on the type. */
    /* Turned down once more (she: "整个页面背景颜色太黄，稍微减低饱和度，
       增加亮度"): cap raised 97.8 -> 98.6, and the saturation divisor loosened
       so the default greyness (62) lands at 70% rather than 100%. Same
       formula, same knob — hsl(49, 70%, 98.6%) is #fefdf9 to the byte. */
    /* The paper holds a fixed amount of COLOUR, not a fixed saturation.

       It used to be the other way round, and that is where the yellow page
       came from (she: "brightness 取消黄色背景的可能性"): saturation was
       pinned near 100 because that is what a tint needs at 98% lightness, and
       then the brightness knob was free to drag the lightness down to 59 —
       where hsl(49, 100%, 59%) is not a tint, it is a full yellow.

       HSL chroma is (1 - |2L-1|) * S, so holding the chroma constant means
       the saturation has to rise as the lightness approaches white and fall
       away as it leaves. C0 is the chroma at the design point (L 98.6, S 70),
       scaled by the greyness knob. At L 98.6 it solves back to 70; at L 59 it
       solves to about 2, which is a warm grey. The yellow is now unreachable
       from the slider rather than merely unlikely. */
    var paperL = dark ? L : Math.min(L, 98.6);
    var spread = 1 - Math.abs(2 * (paperL / 100) - 1);
    var C0 = 0.01962 * (S / 62);
    var paperS = dark ? 7 * k
      : (spread > 0 ? Math.min(100, (C0 / spread) * 100) : 0);
    var off = function (d) { return dark ? paperL + d : paperL - d; };

    set['--bg'] = hex(PAPER_H, paperS, paperL);
    /* The tint has to fall away fast as the lightness drops. The first pass
       kept the paper's full saturation on the surfaces and they came out
       manila — #fbf7e6 and #f4efd9, a cream envelope rather than a slightly
       warm grey. 100% saturation only reads as a tint at 98% lightness; four
       points down it is a colour. */
    set['--surface'] = hex(PAPER_H, paperS * 0.22, off(3.4));
    set['--surface-2'] = hex(PAPER_H, paperS * 0.18, off(7.4));
    set['--surface-3'] = hex(PAPER_H, paperS * 0.14, off(14));
    /* The interaction ground. Every hover on the site used to pick between
       --surface-2 and --surface-3 depending on who wrote the rule, so the
       same gesture landed at 7.4 points off the page in one place and 14 in
       another. This is the one value all of them use now, and it sits above
       --surface so a ground that appears under the pointer is lighter than
       the card it appears on, not heavier. */
    set['--tint'] = hex(PAPER_H, paperS * 0.20, off(5.6));
    set['--line'] = hex(NEUTRAL_H, 8 * k, away(14));
    set['--line-soft'] = hex(NEUTRAL_H, 8 * k, away(7));

    /* ruxin.art sets paragraphs at 85% ink rather than solid, which measures
       about 8:1 and keeps long text from looking hard. Her secondary tone is
       .40; here that token also carries running text, so it is walked to a
       real 4.5:1 instead. */
    set['--ink'] = dark ? hex(NEUTRAL_H, 6 * k, 95) : hex(NEUTRAL_H, 11 * k, 11);
    set['--ink-2'] = dark ? hex(NEUTRAL_H, 5 * k, 78) : hex(NEUTRAL_H, 8 * k, 26);
    var metaL = dark ? 58 : 48, guardMeta = 0;
    while (guardMeta++ < 60) {
      var t2 = hex(NEUTRAL_H, 6 * k, metaL);
      if (contrast(t2, set['--bg']) >= 4.5) break;
      metaL += dark ? 2 : -2;
      if (metaL < 4 || metaL > 96) break;
    }
    set['--ink-3'] = hex(NEUTRAL_H, 6 * k, metaL);

    /* The ramp the tiles draw with. Six stops off the azure, dark to light,
       losing a little chroma as it lightens so the pale end does not glow. */
    var AZ = HSL[0];
    for (var i = 0; i < 6; i++) {
      set['--ramp-' + (i + 1)] =
        hex(AZ[0] + i * 2.5, (AZ[1] * 0.92 - i * 7) * k, dark ? 26 + i * 12 : 20 + i * 13);
    }

    /* The six anchors. Lightness is nudged so they hold their weight against
       whatever the page is doing, and at greyness 100 on a light page they
       come out as the values they were sampled at. */
    for (var j = 0; j < 6; j++) {
      var a = HSL[j];
      set['--c' + (j + 1)] = hex(a[0], a[1] * k, dark ? Math.min(78, a[2] + 8) : a[2]);
    }

    /* Fills carry near-black text, the way the source diagram does. */
    set['--accent'] = hex(AZ[0], AZ[1] * k, dark ? 56 : 52);
    set['--on-accent'] = hex(NEUTRAL_H, 8 * k, dark ? 8 : 10);

    /* A link is text, not a card, so the azure is walked toward the page
       until it actually reaches 4.5:1 instead of being eyeballed. */
    var pageHex = set['--bg'];
    var lineL = dark ? 62 : 44, guardLine = 0;
    while (guardLine++ < 60) {
      var trial = hex(AZ[0], AZ[1] * k, lineL);
      if (contrast(trial, pageHex) >= 4.5) break;
      lineL += dark ? 2 : -2;
      if (lineL < 4 || lineL > 96) break;
    }
    set['--accent-line'] = hex(AZ[0], AZ[1] * k, lineL);
    set['--accent-soft'] = rgba(AZ[0], AZ[1] * k, dark ? 56 : 52, 0.14);
    set['--ok'] = hex(HSL[3][0], HSL[3][1] * k, dark ? 58 : 38);

    /* --- an accent that can hold a light numeral --------------------------
       --accent-line is walked to read against the PAGE, so in dark mode it
       goes light — and white on it collapses to 1.04:1. A disc with a light
       numeral in it needs the opposite guarantee, so this one is walked the
       other way: darkened until white measures 4.5 on it.

       That is the difference between "a colour that reads on the page" and
       "a colour that can carry white". They are not the same token and the
       goal numerals were using the first one to do the second one's job. */
    var deep = hex(AZ[0], AZ[1] * k, dark ? 46 : 38);
    for (var dg = 0; dg < 40 && contrast('#ffffff', deep) < 4.5; dg++) {
      var dl = (dark ? 46 : 38) - dg * 1.5;
      if (dl < 4) break;
      deep = hex(AZ[0], AZ[1] * k, dl);
    }
    set['--accent-deep'] = deep;

    /* --- the highlighter -------------------------------------------------
       Orange (she: "做橘色试试"), and it has to move with the page rather
       than be one colour: the selection is a GROUND, so the only thing that
       matters is that it stays clear of whatever the page is and that the
       type on it stays readable.

       So its lightness is set relative to the page's, not absolutely — 26
       points away from --bg, whichever direction there is room in — and the
       type on it is the better of ink and white, measured rather than
       assumed (she: "选中的字根据背景亮度调整"). On a white page that lands
       on a warm orange with ink over it; drag brightness down and the ground
       goes deep amber and the type flips to white on its own. */
    var SEL_H = 27;
    /* 30 points of lightness away from the page, in whichever direction there
       is room — no floor. A floor is what broke the first version: max(62, …)
       meant that any page sitting near 62 got a highlighter at exactly its own
       lightness, and the mark vanished (measured 1.01:1 against the page). */
    var selL = Math.max(14, Math.min(88, paperL > 50 ? paperL - 30 : paperL + 30));
    /* a highlighter has to be vivid or it reads as a smudge — the yellow it
       replaces was #fafd5d, and a muted peach in its place is not a mark */
    var sel = hex(SEL_H, Math.min(100, 100 * Math.max(k, 0.82)), selL);
    set['--sel'] = sel;
    /* Measured against a real dark, not against --ink. In dark mode --ink is
       itself near-white, so "the better of ink and white" was comparing white
       with white and settling for 2.02:1 on the orange. The selection is its
       own ground and its type does not have to be the page's ink. */
    var SEL_DARK = '#231a12';
    set['--sel-ink'] = contrast(SEL_DARK, sel) >= contrast('#ffffff', sel)
      ? SEL_DARK : '#ffffff';

    /* The bar is translucent over the page, so it has to be made of the page.
       On the neutral hue at L it was white at 85% sitting on an ivory sheet,
       which read as a paler strip across the top (she: "这边也用一个颜色").
       Same hue, same lightness as --bg — the blur is then the only difference
       between the bar and what is under it, which is the whole point of it. */
    set['--nav-bg'] = rgba(PAPER_H, paperS, paperL, 0.85);
    set['--scrim'] = rgba(NEUTRAL_H, 10 * k, dark ? 4 : 18, dark ? 0.72 : 0.4);
    set['--shadow-1'] = dark ? '0 1px 2px rgba(0,0,0,.5)' : '0 1px 2px rgba(0,0,0,.04)';
    set['--shadow-2'] = dark
      ? '0 2px 10px rgba(0,0,0,.6), 0 30px 70px rgba(0,0,0,.6)'
      : '0 2px 10px rgba(0,0,0,.07), 0 30px 70px rgba(0,0,0,.14)';

    for (var key in set) root.style.setProperty(key, set[key]);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.setAttribute('data-shade', dark ? 'dark' : 'light');

    /* art.js and labs.js cache what they read. */
    document.dispatchEvent(new CustomEvent('themechange'));
    return set;
  }

  /* --- the control ------------------------------------------------------- */

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch (e) { return null; }
  }

  var L = parseFloat(store('rl-bright'));
  var S = parseFloat(store('rl-grey'));
  if (!isFinite(L)) L = 100;
  if (!isFinite(S)) S = 100;

  var panel, openBtn;

  function paint() {
    var out = build(L, S);
    if (!panel) return;
    panel.querySelector('[data-out="b"]').textContent = Math.round(L);
    panel.querySelector('[data-out="g"]').textContent = Math.round(S);
    var sw = panel.querySelectorAll('.shade__sw i');
    ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6']
      .forEach(function (t, i) { if (sw[i]) sw[i].style.background = out[t]; });
    panel.querySelector('[data-out="hex"]').textContent =
      out['--bg'] + ' · ' + out['--c1'] + ' · ' + out['--accent-line'];
  }

  function mount() {
    var nav = document.querySelector('.nav__in');
    if (!nav) { build(L, S); return; }

    openBtn = document.createElement('button');
    openBtn.className = 'iconbtn';
    openBtn.type = 'button';
    openBtn.id = 'shade';
    openBtn.title = 'Switch to dark';
    openBtn.setAttribute('aria-label', 'Switch to dark');
    openBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/>' +
      '<path d="M12 3.6v16.8" /><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8" fill="currentColor" ' +
      'stroke="none"/></svg>';
    nav.appendChild(openBtn);

    /* One press switches the page between light and dark. No panel, no sliders:
       the knobs stay inside build() but are fixed at two settings, light (100)
       and dark (8), and the choice is remembered. */
    var DARK_L = 8;
    var sync = function () {
      var dark = L < 52;
      openBtn.title = dark ? 'Switch to light' : 'Switch to dark';
      openBtn.setAttribute('aria-label', openBtn.title);
      openBtn.setAttribute('aria-pressed', String(dark));
    };
    L = L < 52 ? DARK_L : 100;
    S = 100;
    openBtn.addEventListener('click', function () {
      L = L < 52 ? 100 : DARK_L;
      store('rl-bright', L); store('rl-grey', S);
      paint(); sync();
    });
    sync();
    paint();
  }

  /* Paint before first render so the page never flashes the CSS defaults. */
  build(L, S);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
