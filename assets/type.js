/* ---------------------------------------------------------------------------
   Type.

   The body is not a choice. It is the ruxin.art setting: Inter, one size for
   almost everything, line height 1.5, and hierarchy carried by colour and
   weight rather than by size. That rule is the whole character of that site
   and it is what got copied here.

   What is left to choose is the title face. Six of them below, each one
   picked to sit on top of Inter without arguing with it.

   The picker at _fonts.html writes a choice here and index.html reads it.
   Everything downstream uses --font-display plus four display knobs, so
   switching is four custom properties and one link element.

   TYPE CHOICE: Archivo Expanded. She sent a screenshot of the face she
   wanted kept; measuring the ink of "Motion and" against all twelve schemes
   put it at 0.876 IoU (next best 0.77), and the width it needed over Archivo
   at 100% came out at 117.9% against the 118% the scheme already sets. So it
   was this one, at the settings below, and the whole question was why two
   ways of opening the same file disagreed.

   The answer: the choice lived in localStorage, which is per origin.
   file:///C:/... and http://localhost:8766 are different origins with
   separate stores, so whatever the picker wrote in one was invisible in the
   other, and the two fell back differently. A design decision should not be
   stored in one browser's site data.

   So DEFAULT below is the site's setting, in the file, in git. The picker
   still works and still overrides, but the key is versioned: bumping KEY
   retires every value the picker wrote before the decision, which is what
   makes the two origins agree again without anyone clearing anything.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  var G = 'https://fonts.googleapis.com/css2?';
  var FALLBACK = ', system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, ' +
                 '"PingFang SC", "Microsoft YaHei", sans-serif';

  /* Fixed. Loaded once, never swapped. */
  var BODY = {
    family: '"Inter"' + FALLBACK,
    href: G + 'family=Inter:wght@400;500;600;700&display=swap'
  };
  var MONO = {
    family: '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
    href: G + 'family=JetBrains+Mono:wght@400;500&display=swap'
  };

  /* Title faces only. weight / stretch / track are what each one needs at
     display size; caps is the tracking for the uppercase section headings,
     which want a little more than the big lowercase line. vary carries
     font-variation-settings for the faces with unregistered axes.

     Two groups. The quiet ones get out of the way; the studio ones are the
     point of the page. */
  var SCHEMES = [
    {
      id: 'inter-tight', group: 'quiet',
      name: 'Inter Tight',
      sub: 'Same family, tighter cut',
      note: 'The strictest reading of the ruxin.art rule: one typeface for the ' +
            'whole site, and the title is the same face drawn tighter for big ' +
            'sizes. Nothing competes with anything. It is also the quietest ' +
            'option, which may be too quiet for a page about motion.',
      href: G + 'family=Inter+Tight:wght@600;700;800&display=swap',
      family: '"Inter Tight"' + FALLBACK,
      weight: 800, stretch: '100%', track: '-.032em', caps: '.01em'
    },
    {
      id: 'archivo', group: 'quiet',
      name: 'Archivo Expanded',
      sub: 'Wide grotesque, width axis',
      note: 'Set wide, which is what makes the caps headings read as a decision ' +
            'rather than as bold body text. It gives the rule under each heading ' +
            'something to hold. Closest to an editorial masthead.',
      href: G + 'family=Archivo:wdth,wght@75..125,500..800&display=swap',
      family: '"Archivo"' + FALLBACK,
      weight: 800, stretch: '118%', track: '-.02em', caps: '.008em'
    },
    {
      id: 'anton', group: 'quiet',
      name: 'Anton',
      sub: 'Condensed poster face',
      note: 'One weight, very narrow, very loud. A long headline fits on one ' +
            'line and reads across a room. It has no second weight and no ' +
            'italic, so it can only ever be the title. The most committed of ' +
            'the six.',
      href: G + 'family=Anton&display=swap',
      family: '"Anton"' + FALLBACK,
      weight: 400, stretch: '100%', track: '-.005em', caps: '.02em'
    },
    {
      id: 'syne', group: 'quiet',
      name: 'Syne',
      sub: 'Art-world display',
      note: 'Drawn for an art centre, and it shows: wide bowls, an odd G, a ' +
            'shape you remember. It reads as a studio rather than a product ' +
            'team. Strong at large sizes, awkward below about 20px, which is ' +
            'fine because it never goes there.',
      href: G + 'family=Syne:wght@600;700;800&display=swap',
      family: '"Syne"' + FALLBACK,
      weight: 800, stretch: '100%', track: '-.028em', caps: '.01em'
    },
    {
      id: 'bricolage', group: 'quiet',
      name: 'Bricolage Grotesque',
      sub: 'Variable, with an optical size axis',
      note: 'The big line gets its own drawing instead of a scaled-up body ' +
            'font, because the optical size axis actually changes the letter ' +
            'shapes. The most authored of the six, and the one that most ' +
            'obviously is not a default.',
      href: G + 'family=Bricolage+Grotesque:opsz,wght@12..96,600..800&display=swap',
      family: '"Bricolage Grotesque"' + FALLBACK,
      weight: 800, stretch: '100%', track: '-.026em', caps: '.006em'
    },
    {
      id: 'unbounded', group: 'quiet',
      name: 'Unbounded',
      sub: 'Geometric, technical',
      note: 'Near-circular bowls and flat joins. It puts the page in the same ' +
            'register as the formulas on the tiles, which is arguably what ' +
            'this site is. Needs the tracking pulled in hard or it sprawls.',
      href: G + 'family=Unbounded:wght@600;700;800&display=swap',
      family: '"Unbounded"' + FALLBACK,
      weight: 700, stretch: '100%', track: '-.038em', caps: '-.01em'
    },
    {
      id: 'clash',
      group: 'studio',
      name: 'Clash Display',
      sub: 'The studio default, and it earned it',
      note: 'Squared-off, wide, and completely sure of itself. If you have ' +
            'looked at a design studio site in the last three years you have ' +
            'seen it. That is the case for and against. It is the only one ' +
            'here served from Fontshare rather than Google, so it adds a ' +
            'second font host.',
      href: 'https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap',
      family: '"ClashDisplay-Variable", "Clash Display"' + FALLBACK,
      weight: 700, stretch: '100%', track: '-.03em', caps: '-.005em'
    },
    {
      id: 'fraunces',
      group: 'studio',
      name: 'Fraunces, wonky',
      sub: 'Variable serif with SOFT and WONK axes',
      note: 'A serif you can art-direct: SOFT rounds the terminals, WONK ' +
            'swaps in the slanted, off-balance alternates. Set here at SOFT ' +
            '60 and WONK on, which is the setting that stops it looking like ' +
            'a normal serif. Nothing else on this page is drawn like it.',
      href: G + 'family=Fraunces:opsz,wght,SOFT,WONK@9..144,600..900,0..100,0..1&display=swap',
      family: '"Fraunces", Georgia, serif',
      vary: '"SOFT" 60, "WONK" 1, "opsz" 144',
      weight: 800, stretch: '100%', track: '-.024em', caps: '.004em'
    },
    {
      id: 'anybody',
      group: 'studio',
      name: 'Anybody, extended',
      sub: 'Variable width, pushed to 135',
      note: 'A width axis from 50 to 150. Run wide it becomes a poster ' +
            'grotesque with almost no counters left, which is the look most ' +
            'people mean by studio. Run narrow it is a different typeface. ' +
            'The most adjustable option here.',
      href: G + 'family=Anybody:wdth,wght@50..150,600..900&display=swap',
      family: '"Anybody"' + FALLBACK,
      weight: 800, stretch: '135%', track: '-.018em', caps: '.006em'
    },
    {
      id: 'gloock',
      group: 'studio',
      name: 'Gloock',
      sub: 'High-contrast display serif',
      note: 'Hairline thins against heavy stems, the fashion-magazine move. ' +
            'It gives the page an editorial register the grotesques cannot. ' +
            'One weight only, and the thins disappear below about 30px, so it ' +
            'can only ever be the big line.',
      href: G + 'family=Gloock&display=swap',
      family: '"Gloock", Georgia, serif',
      weight: 400, stretch: '100%', track: '-.018em', caps: '.01em'
    },
    {
      id: 'bigshoulders',
      group: 'studio',
      name: 'Big Shoulders Display',
      sub: 'Tall, narrow, American poster',
      note: 'Drawn for Chicago signage. Very tall, very narrow, so a long ' +
            'headline fits on one line and the caps headings get real ' +
            'presence at small sizes. Reads as civic and printed rather ' +
            'than as software.',
      href: G + 'family=Big+Shoulders+Display:wght@600;700;800;900&display=swap',
      family: '"Big Shoulders Display"' + FALLBACK,
      weight: 800, stretch: '100%', track: '.002em', caps: '.03em'
    },
    {
      id: 'boldonse',
      group: 'studio',
      name: 'Boldonse',
      sub: 'Eccentric, one weight',
      note: 'Tight apertures, odd proportions, a face that is clearly a ' +
            'decision. The furthest from neutral of anything here. It will ' +
            'date, and that may be fine for a page that is dated by its ' +
            'nature.',
      href: G + 'family=Boldonse&display=swap',
      family: '"Boldonse"' + FALLBACK,
      weight: 400, stretch: '100%', track: '-.02em', caps: '.01em'
    }
  ];

  var loaded = {};
  function load(href) {
    if (!href || loaded[href]) return;
    loaded[href] = 1;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function apply(id) {
    var s = SCHEMES[0];
    for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].id === id) s = SCHEMES[i];
    load(BODY.href);
    load(MONO.href);
    load(s.href);
    var root = document.documentElement.style;
    root.setProperty('--font', BODY.family);
    root.setProperty('--mono', MONO.family);
    root.setProperty('--font-display', s.family);
    root.setProperty('--display-weight', s.weight);
    root.setProperty('--display-stretch', s.stretch);
    root.setProperty('--display-track', s.track);
    root.setProperty('--caps-track', s.caps);
    root.setProperty('--display-vary', s.vary || 'normal');
    document.documentElement.setAttribute('data-type', s.id);
    return s;
  }

  /* The decision. Changing this line changes the site; everything else is
     just the picker. */
  var DEFAULT = 'archivo';

  /* Bumped when the default changes, which retires the stale overrides the
     picker left in either origin's storage. */
  var KEY = 'rl-type-2';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(id) {
    try { localStorage.setItem(KEY, id); } catch (e) {}
  }

  window.TYPE = {
    schemes: SCHEMES, body: BODY, mono: MONO, DEFAULT: DEFAULT,
    apply: apply, remember: remember, stored: stored,
    /* the picker's "back to the site's own setting" */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      return apply(DEFAULT);
    }
  };
  apply(stored() || DEFAULT);
})();
