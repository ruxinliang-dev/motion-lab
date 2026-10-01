/* ---------------------------------------------------------------------------
   The eight experiments.

   Each one is an object:
     id        slug, used for the deep link (#lab/spring-segment)
     n         display number
     title     short name
     question  the thing the study is trying to answer
     note      the write-up shown in the detail sheet
     spec      key/value rows printed under the write-up
     mount(stage, opts)  builds a live instance inside `stage`

   mount runs twice per experiment: once in the card on the home grid, and
   once more at a larger size when the detail sheet opens. So nothing here
   may use a document id or a module-level variable that holds DOM.

   Durations and easings are read from the CSS custom properties in site.css
   with tok(), so the Motion tokens section on the page and the motion in
   these demos cannot drift apart.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* --- tiny helpers ------------------------------------------------------ */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var _tokCache = {};
  /* The palette is rebuilt at runtime, so the cache has to go. */
  document.addEventListener('themechange', function () { _tokCache = {}; });
  function tok(name) {
    if (!(name in _tokCache)) {
      _tokCache[name] = getComputedStyle(document.documentElement)
        .getPropertyValue(name).replace(/\s+/g, ' ').trim();
    }
    return _tokCache[name];
  }
  function ms(name) { return parseFloat(tok(name)) || 0; }

  /* Honours the OS setting and the toggle in the nav. When it is on, demos
     jump to their end state instead of tweening. */
  function still() {
    if (document.documentElement.getAttribute('data-motion') === 'off') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function animate(node, frames, opts) {
    if (still()) {
      var last = frames[frames.length - 1];
      for (var k in last) if (k !== 'offset' && k !== 'easing') node.style[k] = last[k];
      return null;
    }
    return node.animate(frames, opts);
  }


  /* --------------------------------------------------------------------- */
  /* 01 — three days as one ramp                                            */
  /*                                                                        */
  /* The only experiment that reaches the network. Weather comes from       */
  /* Open-Meteo (no key, CORS open) and the three typefaces from Google     */
  /* Fonts. If either is unreachable the card still paints, from a seasonal */
  /* estimate, and says on its face that the numbers are estimated.         */
  /* --------------------------------------------------------------------- */

  var CITIES = [
    ['New York', 40.7128, -74.006, 'America/New_York'],
    ['London', 51.5072, -0.1276, 'Europe/London'],
    ['Tokyo', 35.6762, 139.6503, 'Asia/Tokyo'],
    ['Shanghai', 31.2304, 121.4737, 'Asia/Shanghai'],
    ['Reykjavik', 64.1466, -21.9426, 'Atlantic/Reykjavik']
  ];

  /* One face for the whole line. Three faces was the first idea and it was
     the wrong one: the eye spends its time on the joins instead of the date.
     The randomness stays, it just happens once.

     A font with no glyph for a script does not fail loudly. It falls back one
     character at a time, which reads as a bug rather than as a fallback. So
     every script carries its own pool and nothing is ever drawn by a face
     that cannot draw it. Every family below returned 200 before it went in. */
  var SCRIPTS = {
    latin: [
      'Instrument Serif', 'Playfair Display', 'DM Serif Display', 'Fraunces',
      'Bodoni Moda', 'Spectral', 'Newsreader', 'Lora', 'Gloock', 'Alegreya',
      'Space Grotesk', 'Syne', 'Unbounded', 'Outfit', 'Sora', 'Chivo',
      'Archivo', 'Bricolage Grotesque', 'Anton', 'Cormorant Garamond'
    ],
    cyrillic: [
      'Playfair Display', 'Lora', 'Spectral', 'Alegreya',
      'Cormorant Garamond', 'Unbounded', 'EB Garamond'
    ],
    greek: ['Alegreya', 'EB Garamond', 'Noto Serif', 'Comfortaa', 'Manrope'],
    sc: [
      'Noto Sans SC', 'Noto Serif SC', 'ZCOOL XiaoWei',
      'ZCOOL KuaiLe', 'Ma Shan Zheng', 'LXGW WenKai TC'
    ],
    jp: ['Noto Sans JP', 'Noto Serif JP', 'Zen Maru Gothic', 'Yuji Syuku'],
    kr: ['Noto Sans KR', 'Noto Serif KR', 'Gaegu', 'Jua'],
    arabic: ['Noto Naskh Arabic', 'Cairo', 'Amiri'],
    thai: ['Noto Sans Thai', 'Kanit'],
    devanagari: ['Noto Sans Devanagari', 'Tiro Devanagari Hindi']
  };

  /* English first, and it stays the default. The rest are a shuffle. */
  var LANGS = [
    ['en-GB', 'English', 'latin'],
    ['fr-FR', 'Fran\u00e7ais', 'latin'],
    ['de-DE', 'Deutsch', 'latin'],
    ['es-ES', 'Espa\u00f1ol', 'latin'],
    ['it-IT', 'Italiano', 'latin'],
    ['pt-BR', 'Portugu\u00eas', 'latin'],
    ['tr-TR', 'T\u00fcrk\u00e7e', 'latin'],
    ['pl-PL', 'Polski', 'latin'],
    ['ru-RU', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', 'cyrillic'],
    ['uk-UA', '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', 'cyrillic'],
    ['el-GR', '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac', 'greek'],
    ['zh-CN', '\u4e2d\u6587', 'sc'],
    ['ja-JP', '\u65e5\u672c\u8a9e', 'jp'],
    ['ko-KR', '\ud55c\uad6d\uc5b4', 'kr'],
    ['ar-EG', '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', 'arabic'],
    ['th-TH', '\u0e44\u0e17\u0e22', 'thai'],
    ['hi-IN', '\u0939\u093f\u0928\u094d\u0926\u0940', 'devanagari']
  ];

  /* --- colour ------------------------------------------------------------ */

  function toRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function unlin(c) {
    c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255);
  }
  function hexOf(r) {
    return '#' + r.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }
  /* Mixing in linear light, so a cold blue meeting a warm sand does not go
     through mud on the way. */
  function mixHex(a, b, t) {
    var A = toRgb(a), B = toRgb(b), o = [];
    for (var i = 0; i < 3; i++) o[i] = unlin(lin(A[i]) * (1 - t) + lin(B[i]) * t);
    return hexOf(o);
  }
  function luma(hex) {
    var r = toRgb(hex);
    return 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
  }
  /* Pick whichever ink actually has more contrast against the colour behind
     it. A fixed luminance threshold gets the mid tones wrong, and the mid
     tones are most of a temperate week. */
  function inkFor(hex) {
    var L = luma(hex);
    var onDark = (L + 0.05) / 0.05;               /* against #000 */
    var onLight = 1.05 / (L + 0.05);              /* against #fff */
    return onLight >= onDark ? '#ffffff' : '#101217';
  }
  function rgbaOf(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function toHsl(hex) {
    var c = toRgb(hex).map(function (v) { return v / 255; });
    var mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
    var l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === c[0]) h = ((c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0));
      else if (mx === c[1]) h = (c[2] - c[0]) / d + 2;
      else h = (c[0] - c[1]) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var r;
    if (h < 60) r = [c, x, 0]; else if (h < 120) r = [x, c, 0];
    else if (h < 180) r = [0, c, x]; else if (h < 240) r = [0, x, c];
    else if (h < 300) r = [x, 0, c]; else r = [c, 0, x];
    return hexOf([(r[0] + m) * 255, (r[1] + m) * 255, (r[2] + m) * 255]);
  }

  /* Temperature sets the base colour. Six anchors, interpolated. */
  var TEMP_STOPS = [[-12, '#22407e'], [0, '#3f7ec4'], [9, '#5fb0a6'],
                    [17, '#c4bd6e'], [25, '#df8c46'], [35, '#c9452f']];
  function tempColour(t) {
    if (t <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
    for (var i = 0; i < TEMP_STOPS.length - 1; i++) {
      var a = TEMP_STOPS[i], b = TEMP_STOPS[i + 1];
      if (t <= b[0]) return mixHex(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
    return TEMP_STOPS[TEMP_STOPS.length - 1][1];
  }

  /* The sky then pushes saturation and lightness around. */
  var WX = {
    0: ['Clear', 1.18, 7], 1: ['Mainly clear', 1.12, 5], 2: ['Partly cloudy', 0.82, -2],
    3: ['Overcast', 0.58, -7], 45: ['Fog', 0.42, 1], 48: ['Rime fog', 0.42, 3],
    51: ['Light drizzle', 0.70, -8], 53: ['Drizzle', 0.68, -9], 55: ['Dense drizzle', 0.66, -11],
    56: ['Freezing drizzle', 0.50, -6], 57: ['Freezing drizzle', 0.50, -7],
    61: ['Light rain', 0.66, -11], 63: ['Rain', 0.62, -13], 65: ['Heavy rain', 0.58, -16],
    66: ['Freezing rain', 0.50, -12], 67: ['Freezing rain', 0.48, -14],
    71: ['Light snow', 0.34, 16], 73: ['Snow', 0.30, 19], 75: ['Heavy snow', 0.26, 22],
    77: ['Snow grains', 0.32, 17], 80: ['Rain showers', 0.68, -10],
    81: ['Showers', 0.64, -12], 82: ['Violent showers', 0.60, -15],
    85: ['Snow showers', 0.30, 18], 86: ['Heavy snow showers', 0.28, 20],
    95: ['Thunderstorm', 0.80, -19], 96: ['Thunder, hail', 0.78, -21],
    99: ['Thunder, hail', 0.76, -23]
  };
  function wx(code) { return WX[code] || ['Unsettled', 0.7, -4]; }

  function dayColour(temp, code) {
    var base = toHsl(tempColour(temp));
    var w = wx(code);
    return fromHsl(base[0] + (w[2] < -8 ? -10 : 0), base[1] * w[1], base[2] + w[2] / 100);
  }

  /* Three overcast days seven degrees apart come out almost the same colour,
     which is true and unreadable.

     Multiplying the difference does not fix that: a delta near zero times 1.3
     is still near zero, and a quiet week printed as one wash of mud. So the
     spread has a floor. Each channel is opened around the trio's own mean
     until the widest gap is at least MIN, however small the real one was.
     The direction always comes from the data; only the distance is imposed.

     The absolute hue still tracks temperature, so a cold week is still blue
     and a hot one is still red. The three days inside it just stop being the
     same colour. */
  var MIN_H = 34;    /* degrees between the coolest and the warmest day */
  var MIN_S = 0.30;
  var MIN_L = 0.30;

  function fan(vals, min, mul) {
    var mean = (vals[0] + vals[1] + vals[2]) / 3;
    var d = vals.map(function (v) { return v - mean; });
    var span = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
    var k = mul;
    if (span * mul < min) {
      /* genuinely identical days have no direction to keep, so the only
         ordering left is the one they arrived in: yesterday, today, tomorrow */
      if (span < 1e-6) return vals.map(function (_, i) { return mean + (i - 1) * min / 2; });
      k = min / span;
    }
    return d.map(function (v) { return mean + v * k; });
  }

  function spread(hexes) {
    var hs = hexes.map(toHsl);
    /* hue is a circle: unwrap around the first day or a trio straddling 0
       averages to the opposite side of the wheel */
    var hue = hs.map(function (c) {
      var x = c[0] - hs[0][0];
      while (x > 180) x -= 360;
      while (x < -180) x += 360;
      return hs[0][0] + x;
    });
    var H = fan(hue, MIN_H, 1.45);
    var S = fan(hs.map(function (c) { return c[1]; }), MIN_S, 1.4);
    var L = fan(hs.map(function (c) { return c[2]; }), MIN_L, 1.55);
    return hs.map(function (c, i) {
      return fromHsl(
        H[i],
        Math.min(0.80, Math.max(0.10, S[i] + 0.05)),
        Math.min(0.86, Math.max(0.13, L[i]))
      );
    });
  }

  /* --- data -------------------------------------------------------------- */

  function isoOf(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
           '-' + ('0' + d.getDate()).slice(-2);
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }

  /* Used before the network answers, and instead of it when it does not. A
     latitude and a day of the year is enough for a believable curve. */
  function estimate(city) {
    var out = [], now = new Date();
    for (var k = -1; k <= 1; k++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      var lat = city[1], south = lat < 0, al = Math.abs(lat);
      var mean = 26 - 0.35 * al, amp = 4 + 0.22 * al;
      var phase = south ? doy + 182.5 : doy;
      var h = hash(city[0] + isoOf(d));
      var t = mean + amp * Math.cos(2 * Math.PI * (phase - 196) / 365) + ((h % 61) / 10 - 3);
      var codes = [0, 1, 2, 3, 45, 61, 63, 80];
      out.push({ date: isoOf(d), temp: Math.round(t * 10) / 10, code: codes[h % codes.length] });
    }
    return out;
  }

  var wxCache = {};
  function loadWeather(city, cb) {
    if (wxCache[city[0]]) { cb(wxCache[city[0]]); return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city[1] +
      '&longitude=' + city[2] +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=' +
      encodeURIComponent(city[3]) + '&past_days=1&forecast_days=2';
    var done = false;
    var fin = function (v) { if (done) return; done = true; cb(v); };
    setTimeout(function () { fin(null); }, 4500);
    if (!window.fetch) { fin(null); return; }
    fetch(url).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.daily || !j.daily.time) { fin(null); return; }
        var d = j.daily, out = [];
        for (var i = 0; i < 3 && i < d.time.length; i++) {
          out.push({ date: d.time[i], code: d.weather_code[i],
                     temp: (d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2 });
        }
        if (out.length < 3) { fin(null); return; }
        wxCache[city[0]] = out;
        fin(out);
      })
      .catch(function () { fin(null); });
  }

  /* --- type -------------------------------------------------------------- */

  var fontDone = {};
  function loadFonts(list, cb) {
    var href = 'https://fonts.googleapis.com/css2?' + list.map(function (f) {
      return 'family=' + f.replace(/ /g, '+') + ':wght@400;700';
    }).join('&') + '&display=swap';
    if (fontDone[href]) { cb(); return; }
    var called = false;
    var fin = function () { if (called) return; called = true; fontDone[href] = 1; cb(); };
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', fin);
    link.addEventListener('error', fin);
    document.head.appendChild(link);
    setTimeout(fin, 2500);          /* never block the card on the network */
  }
  function pickFrom(list, notThis) {
    var pool = list.filter(function (x) { return x !== notThis; });
    if (!pool.length) pool = list;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function pickFont(lang, notThis) {
    return pickFrom(SCRIPTS[lang[2]] || SCRIPTS.latin, notThis);
  }

  /* Intl does the work. It knows the order, the separators and the numerals
     for every locale here, so nothing about the date is hard-coded: English
     puts the day first, Chinese puts the year first, Arabic reads the other
     way. formatToParts hands the pieces over in the right order and says what
     each one is, which is what the three sizes need to know. */
  function dateParts(iso, loc) {
    var d = new Date(iso + 'T12:00:00');
    var cls = { day: 'ramp__d', month: 'ramp__m', year: 'ramp__y' };
    var parts;
    try {
      parts = new Intl.DateTimeFormat(loc, {
        day: 'numeric', month: 'long', year: 'numeric'
      }).formatToParts(d);
    } catch (e) {
      parts = [{ type: 'day', value: String(d.getDate()) }];
    }
    var out = [];
    parts.forEach(function (pt) {
      if (pt.type === 'literal') {
        /* the gap between the spans is the spacing; a separator that is not a
           space belongs to the number it follows */
        var t = pt.value.replace(/\s+/g, '');
        if (t && out.length) out[out.length - 1].text += t;
        return;
      }
      out.push({ cls: cls[pt.type] || '', text: pt.value });
    });
    return out;
  }

  function shortDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  var dayRamp = {
    id: 'day-ramp',
    n: '01',
    title: 'Three days as one colour',
    question: 'Can yesterday, today and tomorrow read as one ramp and still leave you standing in today?',
    note:
      '<p>Each day gets a colour from two numbers. Temperature picks a base off ' +
      'six anchors, from a deep blue at -12C to a hot red at 35C. The sky code ' +
      'then multiplies saturation and shifts lightness: clear pushes both up, ' +
      'overcast drops saturation to 0.58, snow drops it to 0.30 and lifts ' +
      'lightness 19 points, a thunderstorm takes 19 points away.</p>' +
      '<p>The card is two layers. Underneath, yesterday travels to tomorrow ' +
      'across the diagonal in nine steps. On top, today is a disc that fades ' +
      'out in a circle.</p>' +
      '<p>The circle is the smoother of the two transitions, and it is the one ' +
      'you see. A diagonal has an axis and an axis has a seam you can find. A ' +
      'radial falloff has neither, and it puts the day you are standing in at ' +
      'the middle of the card rather than at a point you cross. Mixing happens ' +
      'in linear light: in sRGB a cold blue meeting a warm sand goes through ' +
      'mud, which is exactly where the middle of this card is.</p>' +
      '<p>A quiet week breaks this. Three overcast days seven degrees apart ' +
      'come out almost the same colour, which is true and unreadable. ' +
      'Multiplying the difference does not fix it either, because a difference ' +
      'near zero multiplied is still near zero.</p>' +
      '<p>So the spread has a floor. Each channel opens around the trio mean ' +
      'until the widest gap is at least 34 degrees of hue, 0.30 of saturation ' +
      'and 0.30 of lightness, however small the real difference was. The ' +
      'direction always comes from the data; only the distance is imposed. The ' +
      'absolute hue still tracks temperature, so a cold week is still blue. The ' +
      'three days inside it just stop being the same colour.</p>' +
      '<p>The date sits on top of today. The ink is whichever of near-black and ' +
      'white actually has more contrast against that middle colour, computed ' +
      'rather than guessed at with a threshold.</p>' +
      '<p>The date runs on one line in one face, drawn at random from twenty ' +
      'free families. Three faces was the first version of this and it was the ' +
      'wrong one: the eye spends its time on the joins instead of the date. ' +
      'Reroll it. The same three numbers change temperature with the type as ' +
      'much as with the weather.</p>' +
      '<p>The language button is a shuffle, not a translation. It picks one of ' +
      'seventeen at random and hands the date to Intl, which knows the order, ' +
      'the separators and the numerals: English puts the day first, Chinese ' +
      'the year, Arabic reads the other way and gets its own digits. Nothing ' +
      'about the date is written into the code.</p>' +
      '<p>The face has to change with it. A font with no glyph for a script ' +
      'does not fail loudly, it falls back one character at a time, which ' +
      'reads as a bug. So each of the nine scripts here carries its own pool ' +
      'and nothing is drawn by a face that cannot draw it.</p>' +
      '<p>Weather is Open-Meteo, which needs no key. When it is unreachable the ' +
      'card falls back to a seasonal curve from the latitude and the day of the ' +
      'year, and labels itself an estimate rather than pretending.</p>',
    spec: {
      'Base': 'temperature, 6 anchors from -12C to 35C',
      'Modifier': 'WMO weather code, saturation x and lightness +/-',
      'Spread': 'floor of 34 hue, 0.30 sat, 0.30 lightness around the trio mean',
      'Blend': 'linear light, 9 steps under a radial disc of today',
      'Ink': 'flips on the middle colour luminance',
      'Type': 'one line, one face, 9 script pools',
      'Language': '17, shuffled, ordered by Intl',
      'Data': 'Open-Meteo, estimate on failure'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo demo--flush');
      var panel = el('div', 'ramp' + (big ? ' is-big' : ''));
      var paint = el('div', 'ramp__paint');
      var grain = el('div', 'ramp__grain');
      var type = el('div', 'ramp__type');
      var legend = el('div', 'ramp__legend');
      var meta = el('div', 'ramp__meta');
      var fnames = el('div', 'ramp__fonts');
      var foot = el('div', 'ramp__foot');
      foot.appendChild(legend);
      panel.appendChild(paint);
      panel.appendChild(grain);
      panel.appendChild(type);
      panel.appendChild(foot);
      panel.appendChild(meta);
      wrap.appendChild(panel);

      var city = CITIES[0];
      var lang = LANGS[0];
      var font = pickFont(lang);
      var data = estimate(city);
      var live = false;
      var hexOut = null, cityBtns = [];

      if (big) {
        var bar = el('div', 'ramp__bar');
        var cities = el('div', 'ramp__cities');
        CITIES.forEach(function (c) {
          var b = el('button', 'ramp__city', c[0]);
          b.type = 'button';
          b.setAttribute('aria-pressed', c === city ? 'true' : 'false');
          b.addEventListener('click', function () {
            city = c;
            cityBtns.forEach(function (x, k) {
              x.setAttribute('aria-pressed', CITIES[k] === city ? 'true' : 'false');
            });
            data = estimate(city); live = false; paintAll();
            loadWeather(city, function (d) {
              if (city !== c) return;
              if (d) { data = d; live = true; }
              paintAll();
            });
          });
          cities.appendChild(b);
          cityBtns.push(b);
        });
        var reroll = el('button', 'd-btn d-btn--quiet', 'New type');
        reroll.type = 'button';
        reroll.style.color = '#fff';
        reroll.style.borderColor = 'rgba(255,255,255,.35)';
        reroll.addEventListener('click', function () {
          font = pickFont(lang, font);
          loadFonts([font], paintAll);
          paintAll();
        });

        /* The date is the same three numbers in every language. What changes
           is the order, the separators, sometimes the numerals, and which
           faces are able to draw any of it. */
        var langBtn = el('button', 'd-btn d-btn--quiet', 'New language');
        langBtn.type = 'button';
        langBtn.style.color = '#fff';
        langBtn.style.borderColor = 'rgba(255,255,255,.35)';
        langBtn.addEventListener('click', function () {
          lang = pickFrom(LANGS, lang);
          font = pickFont(lang);
          loadFonts([font], paintAll);
          paintAll();
        });
        hexOut = el('div', 'ramp__hex');
        bar.appendChild(cities);
        bar.appendChild(langBtn);
        bar.appendChild(reroll);
        bar.appendChild(hexOut);
        bar.appendChild(fnames);
        foot.appendChild(bar);
      }

      function paintAll() {
        var cols = spread(data.map(function (d) { return dayColour(d.temp, d.code); }));
        /* Two layers. Underneath, yesterday travels to tomorrow across the
           card, cut into nine stops mixed in linear light so the browser never
           has to interpolate far enough to band. On top, today is a disc that
           fades out in a circle.

           A circle is the smoother transition: a diagonal has an axis, and an
           axis has a seam you can find. A radial falloff has neither, and it
           puts the day you are standing in at the middle of the card instead
           of at a point you cross. */
        var base = [];
        for (var i = 0; i <= 8; i++) {
          base.push(mixHex(cols[0], cols[2], i / 8) + ' ' + (i * 12.5) + '%');
        }
        var t = cols[1];
        paint.style.background =
          'radial-gradient(circle at 50% 47%, ' +
            t + ' 0%, ' +
            rgbaOf(t, 0.95) + ' 24%, ' +
            rgbaOf(t, 0.72) + ' 42%, ' +
            rgbaOf(t, 0.34) + ' 60%, ' +
            rgbaOf(t, 0) + ' 78%), ' +
          'linear-gradient(107deg, ' + base.join(', ') + ')';
        panel.style.color = inkFor(cols[1]);
        panel.classList.toggle('is-est', !live);

        var bits = dateParts(data[1].date, lang[0]).map(function (b) {
          return '<span class="' + b.cls + '">' + b.text + '</span>';
        }).join('');
        type.innerHTML =
          '<span class="ramp__row"' +
          (lang[2] === 'arabic' ? ' dir="rtl"' : '') +
          ' style="font-family:&quot;' + font + '&quot;,' +
          (lang[2] === 'latin' ? 'serif' : 'sans-serif') + '">' +
          bits + '</span>';
        fnames.textContent = lang[1] + '   \u00b7   ' + font;

        legend.innerHTML = ['Yesterday', 'Today', 'Tomorrow'].map(function (lab, i) {
          var d = data[i];
          return '<div><b>' + lab + '</b><span>' + Math.round(d.temp) +
            '\u00b0 <em>' + wx(d.code)[0] + '</em></span></div>';
        }).join('');

        meta.textContent = city[0] + ' \u00b7 ' + (live ? 'open-meteo' : 'seasonal');

        if (hexOut) {
          hexOut.innerHTML = cols.map(function (c) { return '<span>' + c + '</span>'; }).join('');
        }
      }

      stage.appendChild(wrap);
      paintAll();
      loadFonts([font], paintAll);
      loadWeather(city, function (d) {
        if (d) { data = d; live = true; }
        paintAll();
      });
    }
  };

  /* --------------------------------------------------------------------- */
  /* 02 — segmented control with a spring                                   */
  /* --------------------------------------------------------------------- */

  var segmented = {
    id: 'spring-segment',
    n: '02',
    title: 'Spring in a segmented control',
    question: 'How much overshoot can a small control take before it reads as sloppy?',
    note:
      '<p>The pill travels one segment width. A spring curve lets it pass the ' +
      'target and come back, which makes the control feel physical. Past about ' +
      '18% overshoot the pill starts to look like it missed, and people tap again.</p>' +
      '<p>It also stretches along the travel axis, peaking at 45% of the way ' +
      'across, then returns to 1.0. The stretch is capped at 1.26 for a two-step ' +
      'jump. Without it a long jump looks like a cut, not a move.</p>' +
      '<p>Drag the sliders. The label colour crossfades on its own timing, ' +
      '200ms linear, so the text never lags behind the pill.</p>',
    spec: {
      'Travel': '1 segment width per step',
      'Duration': 'var(--d-3) 320ms, adjustable 160-560ms',
      'Easing': 'var(--e-spring)',
      'Stretch': 'scaleX up to 1.26 at 45% offset',
      'Label': 'colour crossfade 200ms linear'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo' + (big ? ' demo--pad-lg' : ''));
      var labels = ['Day', 'Week', 'Month'];

      var seg = el('div', 'seg');
      seg.style.setProperty('--count', labels.length);
      seg.setAttribute('role', 'tablist');
      var pill = el('div', 'seg__pill');
      seg.appendChild(pill);

      var dur = ms('--d-3');
      var ease = tok('--e-spring');
      var easeName = 'spring';
      var idx = 0;

      var opts = labels.map(function (t, i) {
        var b = el('button', 'seg__opt', t);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () { move(i); });
        seg.appendChild(b);
        return b;
      });

      var panel = el('div', 'seg__panel');

      function report() {
        panel.textContent = Math.round(dur) + 'ms  /  ' + easeName;
      }

      function move(to) {
        if (to === idx) return;
        var from = idx;
        idx = to;
        opts.forEach(function (b, i) {
          b.setAttribute('aria-selected', i === to ? 'true' : 'false');
        });

        var stretch = 1 + Math.min(Math.abs(to - from) * 0.13, 0.26);
        animate(pill, [
          { transform: 'translateX(' + from * 100 + '%) scaleX(1)' },
          { transform: 'translateX(' + ((from + to) / 2) * 100 + '%) scaleX(' + stretch + ')',
            offset: 0.45 },
          { transform: 'translateX(' + to * 100 + '%) scaleX(1)' }
        ], { duration: dur, easing: ease, fill: 'none' });
        pill.style.transform = 'translateX(' + to * 100 + '%)';
      }

      wrap.appendChild(seg);
      wrap.appendChild(panel);

      if (big) {
        var ctl = el('div', 'd-ctl');
        ctl.innerHTML =
          '<label>duration</label>' +
          '<input type="range" min="160" max="560" step="20" value="' + dur + '">' +
          '<output>' + dur + 'ms</output>';
        var range = ctl.querySelector('input');
        var out = ctl.querySelector('output');
        range.addEventListener('input', function () {
          dur = +range.value; out.textContent = dur + 'ms'; report();
        });

        var pick = el('div', 'd-ctl');
        [['spring', '--e-spring'], ['out', '--e-out'], ['standard', '--e-standard']]
          .forEach(function (pair) {
            var b = el('button', 'd-btn d-btn--quiet', pair[0]);
            b.type = 'button';
            b.style.fontSize = '11px';
            b.style.padding = '5px 11px';
            b.addEventListener('click', function () {
              ease = tok(pair[1]); easeName = pair[0]; report();
              move(idx === labels.length - 1 ? 0 : idx + 1);
            });
            pick.appendChild(b);
          });

        wrap.appendChild(ctl);
        wrap.appendChild(pick);
      }

      report();
      stage.appendChild(wrap);
    }
  };

  /* --------------------------------------------------------------------- */
  /* 03 — shared element expand                                             */
  /* --------------------------------------------------------------------- */

  var expand = {
    id: 'shared-expand',
    n: '03',
    title: 'Card that becomes the page',
    question: 'What does the eye hold on to while one surface turns into another?',
    note:
      '<p>The tile you tap and the detail behind it are two different elements. ' +
      'The detail is placed at its final size, then transformed back onto the ' +
      'tile and released. Four numbers do the work: dx, dy, and a scale on each ' +
      'axis.</p>' +
      '<p>Scaling a box on two axes squashes whatever is inside it. The fix is a ' +
      'second layer that runs the inverse scale, so the artwork and the text keep ' +
      'their real proportions while the frame around them grows.</p>' +
      '<p>Closing reverses the same four numbers instead of fading out. If the ' +
      'card returned to a different place than it left, the connection between ' +
      'the two screens would break.</p>' +
      '<p>One exception, and you can try it on this panel: once you scroll the ' +
      'notes, what fills the screen is not the card any more, so flying back to ' +
      'it would be a lie. Past 8px of scroll the panel drops away in 260ms ' +
      'instead.</p>' +
      '<p>The whole site uses this. Every card on the home grid opens the same way.</p>',
    spec: {
      'Technique': 'FLIP, Web Animations API',
      'Open': 'var(--d-4) 480ms, var(--e-out)',
      'Close': '380ms, var(--e-standard)',
      'Counter-scale': 'inner layer at 1/sx, 1/sy',
      'Radius': '12px to 18px across the same curve'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo' + (big ? ' demo--pad-lg' : ''));
      var data = [
        { k: 'a', t: 'Kettle', s: 'Cast iron, 1.2L' },
        { k: 'b', t: 'Cyanotype', s: 'Print, 18x24cm' },
        { k: 'c', t: 'Moss', s: 'Motion study' }
      ];

      var exp = el('div', 'exp');
      var row = el('div', 'exp__row');
      exp.appendChild(row);
      var open = null;

      var tiles = data.map(function (d, i) {
        var t = el('button', 'exp__tile');
        t.type = 'button';
        t.innerHTML =
          '<span class="exp__art exp__art--' + d.k + '"></span>' +
          '<span class="exp__meta"><b>' + d.t + '</b><small>' + d.s + '</small></span>';
        t.addEventListener('click', function () { openTile(i); });
        row.appendChild(t);
        return t;
      });

      function openTile(i) {
        if (open) return;
        var d = data[i];
        var tile = tiles[i];
        var first = tile.getBoundingClientRect();

        var detail = el('div', 'exp__detail');
        var inner = el('div', 'exp__inner');
        inner.innerHTML =
          '<span class="exp__art exp__art--' + d.k + '"></span>' +
          '<span class="exp__meta"><b>' + d.t + '</b><small>' + d.s + '</small>' +
          '<span class="exp__lines"><i></i><i style="width:82%"></i>' +
          '<i style="width:60%"></i></span></span>';
        detail.appendChild(inner);

        var back = el('button', 'exp__back', 'Back');
        back.type = 'button';
        back.addEventListener('click', function (e) { e.stopPropagation(); close(i, detail, inner); });
        detail.appendChild(back);
        exp.appendChild(detail);

        var last = detail.getBoundingClientRect();
        inner.style.width = last.width + 'px';
        inner.style.height = last.height + 'px';

        var sx = first.width / last.width;
        var sy = first.height / last.height;
        var dx = first.left - last.left;
        var dy = first.top - last.top;

        tile.style.opacity = '0';
        open = i;

        var dur = ms('--d-4'), ease = tok('--e-out');
        animate(detail, [
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')',
            borderRadius: '12px' },
          { transform: 'none', borderRadius: '18px' }
        ], { duration: dur, easing: ease, fill: 'both' });
        animate(inner, [
          { transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')' },
          { transform: 'none' }
        ], { duration: dur, easing: ease, fill: 'both' });
        animate(back, [{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }],
          { duration: dur, easing: 'linear', fill: 'both' });
      }

      function close(i, detail, inner) {
        if (open === null) return;
        var tile = tiles[i];
        var first = tile.getBoundingClientRect();
        var last = detail.getBoundingClientRect();
        var sx = first.width / last.width;
        var sy = first.height / last.height;
        var dx = first.left - last.left;
        var dy = first.top - last.top;
        open = null;

        var dur = 380, ease = tok('--e-standard');
        var a = animate(detail, [
          { transform: 'none', borderRadius: '18px' },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')',
            borderRadius: '12px' }
        ], { duration: dur, easing: ease, fill: 'both' });
        animate(inner, [
          { transform: 'none' },
          { transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')' }
        ], { duration: dur, easing: ease, fill: 'both' });

        var done = function () { detail.remove(); tile.style.opacity = ''; };
        if (a) { a.onfinish = done; } else { done(); }
      }

      wrap.appendChild(exp);
      if (big) wrap.appendChild(el('div', 'd-read', 'Tap a tile, then Back.'));
      stage.appendChild(wrap);
    }
  };

  /* --------------------------------------------------------------------- */
  /* 04 — stateful button                                                   */
  /* --------------------------------------------------------------------- */

  var stateButton = {
    id: 'state-button',
    n: '04',
    title: 'The button holds the wait',
    question: 'Where should a one second wait live, in the button or on the page?',
    note:
      '<p>A spinner that replaces the whole panel throws away the thing the ' +
      'person was looking at. Keeping the wait inside the control they pressed ' +
      'means the rest of the screen stays where it was.</p>' +
      '<p>The button collapses from its label width to a 44px circle over 480ms, ' +
      'which is also the smallest comfortable tap target. The ring only appears ' +
      'after the collapse is 40% done, so the two changes do not fight.</p>' +
      '<p>The check is a stroke, drawn in 320ms, not a static icon that pops. ' +
      'It holds for 1.2s and then the label comes back, because a control that ' +
      'stays in its success state cannot be pressed again.</p>',
    spec: {
      'Idle to busy': 'width and padding, var(--d-4) 480ms, var(--e-out)',
      'Ring': 'rotate 900ms linear, infinite',
      'Work': '1150ms simulated',
      'Check': 'stroke-dashoffset 26 to 0 over var(--d-3)',
      'Hold': '1200ms, then back to idle'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo' + (big ? ' demo--pad-lg' : ''));

      var btn = el('button', 'sbtn');
      btn.type = 'button';
      btn.setAttribute('data-state', 'idle');
      btn.innerHTML =
        '<span class="sbtn__label">Save changes</span>' +
        '<svg class="sbtn__ring" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"></circle></svg>' +
        '<svg class="sbtn__check" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M5 12.5 L10 17.5 L19 7"></path></svg>';

      var log = el('div', 'd-read', 'Press it.');
      var timers = [];
      function later(fn, t) { timers.push(setTimeout(fn, t)); }

      btn.addEventListener('click', function () {
        if (btn.getAttribute('data-state') !== 'idle') return;
        var w = btn.offsetWidth;
        btn.style.width = w + 'px';
        void btn.offsetWidth;

        btn.setAttribute('data-state', 'busy');
        btn.setAttribute('aria-busy', 'true');
        btn.style.width = '44px';
        btn.style.padding = '0';
        log.textContent = 'busy  /  1150ms';

        later(function () {
          btn.setAttribute('data-state', 'done');
          btn.removeAttribute('aria-busy');
          log.textContent = 'done  /  holding 1200ms';
          later(function () {
            btn.setAttribute('data-state', 'idle');
            btn.style.width = w + 'px';
            btn.style.padding = '';
            log.textContent = 'idle';
            later(function () { btn.style.width = ''; }, ms('--d-4'));
          }, 1200);
        }, 1150);
      });

      wrap.appendChild(btn);
      wrap.appendChild(log);
      if (big) {
        wrap.appendChild(el('div', 'd-read',
          'The label width is measured on the first press, so translated ' +
          'copy collapses from its own width.'));
      }
      stage.appendChild(wrap);

      return function () { timers.forEach(clearTimeout); };
    }
  };

  /* --------------------------------------------------------------------- */
  /* 05 — toast stack                                                       */
  /* --------------------------------------------------------------------- */

  var toasts = {
    id: 'toast-stack',
    n: '05',
    title: 'Three toasts, then it is noise',
    question: 'How many notifications can stack before people stop reading them?',
    note:
      '<p>Each new toast enters from 24px below at 0.95 scale. The ones already ' +
      'there move up 10px, shrink by 5%, and lose a quarter of their opacity per ' +
      'step back. Three deep is the limit here. The fourth is removed as the new ' +
      'one lands, so the stack never grows past what a person can scan.</p>' +
      '<p>Drag one sideways. Past 60px or a flick faster than 0.5px/ms it leaves ' +
      'in the direction it was thrown, which keeps the dismissal feeling like the ' +
      'hand did it. Under that it springs back and the timer keeps running.</p>' +
      '<p>Auto-dismiss is 3600ms from arrival. Dragging cancels the timer, since ' +
      'a toast disappearing under a held finger is the single most reported bug ' +
      'in this pattern.</p>',
    spec: {
      'Enter': 'translateY 24px, scale 0.95, var(--d-4), var(--e-out)',
      'Restack': 'translateY -10px and scale -0.05 per step',
      'Depth': '3 visible, oldest removed',
      'Dismiss': '60px or 0.5px/ms',
      'Timeout': '3600ms, cancelled while dragging'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo' + (big ? ' demo--pad-lg' : ''));
      var box = el('div', 'toasts');
      var live = [];
      var seq = 0;
      var msgs = [
        ['Render finished', 'shot_040 / 240 frames'],
        ['Cache cleared', '1.2 GB freed'],
        ['Export queued', 'ProRes 4444, 1080p'],
        ['Version saved', 'v012, 2 minutes ago']
      ];

      function restack() {
        live.forEach(function (t, i) {
          t.dataset.depth = i;
          t.style.transform = 'translateY(' + (-i * 10) + 'px) scale(' + (1 - i * 0.05) + ')';
          t.style.opacity = String(Math.max(0, 1 - i * 0.25));
          t.style.zIndex = String(50 - i);
        });
      }

      function drop(t, dir) {
        clearTimeout(t._timer);
        var i = live.indexOf(t);
        if (i > -1) live.splice(i, 1);
        t.style.transition = 'transform ' + ms('--d-3') + 'ms ' + tok('--e-standard') +
                             ', opacity ' + ms('--d-2') + 'ms linear';
        t.style.transform = 'translateX(' + (dir * 380) + 'px) scale(.9)';
        t.style.opacity = '0';
        setTimeout(function () { t.remove(); }, ms('--d-3') + 40);
        restack();
      }

      function push() {
        var m = msgs[seq++ % msgs.length];
        var t = el('div', 'toast');
        t.innerHTML =
          '<span class="toast__dot"></span>' +
          '<span class="toast__txt"><b>' + m[0] + '</b><small>' + m[1] + '</small></span>';
        var x = el('button', 'toast__x', 'Dismiss');
        x.type = 'button';
        x.addEventListener('click', function () { drop(t, 1); });
        t.appendChild(x);

        t.style.transition = 'none';
        t.style.transform = 'translateY(24px) scale(.95)';
        t.style.opacity = '0';
        box.appendChild(t);
        live.unshift(t);
        while (live.length > 3) drop(live[live.length - 1], 1);

        requestAnimationFrame(function () {
          t.style.transition = 'transform ' + ms('--d-4') + 'ms ' + tok('--e-out') +
                               ', opacity ' + ms('--d-2') + 'ms linear';
          restack();
        });
        t._timer = setTimeout(function () { drop(t, 1); }, 3600);

        /* drag to dismiss */
        var startX = 0, lastX = 0, lastT = 0, vel = 0, dragging = false;
        t.addEventListener('pointerdown', function (e) {
          if (e.target === x) return;
          dragging = true;
          startX = lastX = e.clientX;
          lastT = performance.now();
          vel = 0;
          clearTimeout(t._timer);
          t.setPointerCapture(e.pointerId);
          t.style.transition = 'none';
        });
        t.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          var now = performance.now();
          var dt = now - lastT;
          if (dt > 0) vel = (e.clientX - lastX) / dt;
          lastX = e.clientX; lastT = now;
          var d = +t.dataset.depth || 0;
          t.style.transform = 'translate(' + (e.clientX - startX) + 'px,' +
                              (-d * 10) + 'px) scale(' + (1 - d * 0.05) + ')';
        });
        function end(e) {
          if (!dragging) return;
          dragging = false;
          var dx = e.clientX - startX;
          if (Math.abs(dx) > 60 || Math.abs(vel) > 0.5) {
            drop(t, dx >= 0 ? 1 : -1);
          } else {
            t.style.transition = 'transform ' + ms('--d-4') + 'ms ' + tok('--e-spring');
            restack();
            t._timer = setTimeout(function () { drop(t, 1); }, 3600);
          }
        }
        t.addEventListener('pointerup', end);
        t.addEventListener('pointercancel', end);
      }

      var trigger = el('button', 'd-btn', 'Trigger event');
      trigger.type = 'button';
      trigger.addEventListener('click', push);

      wrap.appendChild(box);
      wrap.appendChild(trigger);
      if (big) wrap.appendChild(el('div', 'd-read', 'Drag a toast sideways to throw it away.'));
      stage.appendChild(wrap);

      return function () { live.forEach(function (t) { clearTimeout(t._timer); }); };
    }
  };

  /* --------------------------------------------------------------------- */
  /* 06 — drag sheet with detents                                           */
  /* --------------------------------------------------------------------- */

  var sheet = {
    id: 'snap-sheet',
    n: '06',
    title: 'A sheet with three places to stop',
    question: 'Should a released sheet go to the nearest stop, or the one you were heading for?',
    note:
      '<p>Nearest-stop snapping feels wrong the moment someone flicks. They ' +
      'pushed the sheet in a direction and it came back. So speed decides first: ' +
      'above 0.45px/ms the sheet takes the next detent in the direction of travel ' +
      'no matter how far it got. Below that, it goes to whichever stop is closest.</p>' +
      '<p>Three detents: 20%, 55%, 92% of the frame. Past the top one the drag is ' +
      'multiplied by 0.35, so it still moves but tells your hand there is nothing ' +
      'further up.</p>' +
      '<p>The scrim behind is tied to sheet position rather than to the snap, so ' +
      'it darkens continuously while you drag, including through the rubber band.</p>',
    spec: {
      'Detents': '0.20 / 0.55 / 0.92 of frame height',
      'Flick threshold': '0.45px/ms',
      'Rubber band': 'overshoot x 0.35',
      'Settle': 'var(--d-4) 480ms, var(--e-out)',
      'Scrim': '0 to 0.38 opacity, tracks position'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo demo--drag' + (big ? ' demo--pad-lg' : ''));

      var phone = el('div', 'phone');
      phone.innerHTML =
        '<div class="phone__bg"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="phone__scrim"></div>';
      var scrim = phone.querySelector('.phone__scrim');

      var ds = el('div', 'dsheet');
      ds.innerHTML =
        '<div class="dsheet__grab"></div>' +
        '<div class="dsheet__t">Shot details</div>' +
        '<div class="dsheet__rows"><i></i><i></i><i></i><i></i></div>';
      phone.appendChild(ds);

      var names = ['peek', 'half', 'full'];
      var stops = [0.20, 0.55, 0.92];
      var readout = el('div', 'detents');
      var marks = names.map(function (nm, i) {
        var b = el('b', i === 0 ? 'on' : '', nm + '  ' + Math.round(stops[i] * 100) + '%');
        readout.appendChild(b);
        return b;
      });

      var at = 0;            /* current detent index  */
      var y = 0;             /* translateY in px      */
      var H = 0;
      var dragging = false, startY = 0, startTop = 0, lastY = 0, lastT = 0, vel = 0;

      function measure() { H = phone.clientHeight || 1; }

      function place(px, animateIt) {
        y = px;
        var open = 1 - y / H;                       /* 0 closed, 1 full   */
        var o2 = Math.max(0, Math.min(0.38, (open - stops[0]) / (stops[2] - stops[0]) * 0.38));
        if (animateIt && !still()) {
          ds.style.transition = 'transform ' + ms('--d-4') + 'ms ' + tok('--e-out');
          scrim.style.transition = 'opacity ' + ms('--d-4') + 'ms ' + tok('--e-out');
        } else {
          ds.style.transition = 'none';
          scrim.style.transition = 'none';
        }
        ds.style.transform = 'translateY(' + y + 'px)';
        scrim.style.opacity = String(o2);
      }

      function snapTo(i) {
        at = Math.max(0, Math.min(stops.length - 1, i));
        marks.forEach(function (b, k) { b.classList.toggle('on', k === at); });
        place(H * (1 - stops[at]), true);
      }

      ds.addEventListener('pointerdown', function (e) {
        measure();
        dragging = true;
        startY = lastY = e.clientY;
        lastT = performance.now();
        vel = 0;
        startTop = y;
        ds.setPointerCapture(e.pointerId);
      });
      ds.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var now = performance.now();
        var dt = now - lastT;
        if (dt > 0) vel = (e.clientY - lastY) / dt;
        lastY = e.clientY; lastT = now;

        var next = startTop + (e.clientY - startY);
        var min = H * (1 - stops[stops.length - 1]);
        var max = H * (1 - stops[0]);
        if (next < min) next = min - (min - next) * 0.35;      /* rubber band */
        if (next > max) next = max + (next - max) * 0.35;
        place(next, false);
      });
      function release() {
        if (!dragging) return;
        dragging = false;
        if (vel < -0.45) { snapTo(at + 1); return; }            /* flick up   */
        if (vel > 0.45) { snapTo(at - 1); return; }             /* flick down */
        var open = 1 - y / H;
        var best = 0, bestD = Infinity;
        stops.forEach(function (s, i) {
          var d = Math.abs(s - open);
          if (d < bestD) { bestD = d; best = i; }
        });
        snapTo(best);
      }
      ds.addEventListener('pointerup', release);
      ds.addEventListener('pointercancel', release);

      var col = el('div', 'demo');
      col.style.padding = '0';
      col.style.gap = '12px';
      col.appendChild(readout);
      var cycle = el('button', 'd-btn d-btn--quiet', 'Next stop');
      cycle.type = 'button';
      cycle.addEventListener('click', function () {
        measure();
        snapTo(at >= stops.length - 1 ? 0 : at + 1);
      });
      col.appendChild(cycle);

      wrap.appendChild(phone);
      wrap.appendChild(col);
      stage.appendChild(wrap);

      requestAnimationFrame(function () { measure(); place(H * (1 - stops[0]), false); });
      var ro = window.ResizeObserver ? new ResizeObserver(function () {
        measure(); place(H * (1 - stops[at]), false);
      }) : null;
      if (ro) ro.observe(phone);

      return function () { if (ro) ro.disconnect(); };
    }
  };

  /* --------------------------------------------------------------------- */
  /* 07 — stagger on load                                                   */
  /* --------------------------------------------------------------------- */

  var stagger = {
    id: 'stagger-load',
    n: '07',
    title: 'Where a list stops being one thing',
    question: 'At what delay do rows stop arriving as a group and start arriving as a queue?',
    note:
      '<p>Push the slider to 0 and five rows land as one slab. Push it past ' +
      '110ms and they read as five separate events, and the last row arrives ' +
      'late enough that people have already started reading the first.</p>' +
      '<p>40 to 70ms is the usable band. The list still enters as one object, ' +
      'and the order of the rows is visible. This demo defaults to 60ms.</p>' +
      '<p>The skeleton is deliberately the same shape as the content, so nothing ' +
      'jumps when the real rows arrive. Only the fill changes and each row rises ' +
      '10px. The shimmer runs at 1.3s, slow enough that it does not compete with ' +
      'the thing it is standing in for.</p>',
    spec: {
      'Skeleton': '900ms, shimmer 1300ms ease-in-out',
      'Row enter': 'opacity 0 to 1, translateY 10px',
      'Duration': '420ms, var(--e-out)',
      'Stagger': '60ms default, 0-140ms live',
      'Rows': '5'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo' + (big ? ' demo--pad-lg' : ''));
      var step = 60;
      var timers = [];

      var feed = el('div', 'feed');
      var rows = [];
      for (var i = 0; i < 5; i++) {
        var r = el('div', 'feed__row');
        r.innerHTML = '<span class="feed__av"></span>' +
          '<span class="feed__txt"><i></i><i></i></span>';
        feed.appendChild(r);
        rows.push(r);
      }

      function run() {
        timers.forEach(clearTimeout); timers = [];
        feed.classList.add('is-skeleton');
        rows.forEach(function (r) { r.style.opacity = ''; r.style.transform = ''; });
        timers.push(setTimeout(function () {
          feed.classList.remove('is-skeleton');
          rows.forEach(function (r, k) {
            animate(r, [
              { opacity: 0, transform: 'translateY(10px)' },
              { opacity: 1, transform: 'none' }
            ], { duration: 420, delay: k * step, easing: tok('--e-out'), fill: 'both' });
          });
        }, 900));
      }

      var bar = el('div', 'd-ctl');
      bar.innerHTML =
        '<label>stagger</label>' +
        '<input type="range" min="0" max="140" step="10" value="60">' +
        '<output>60ms</output>';
      var range = bar.querySelector('input');
      var out = bar.querySelector('output');
      range.addEventListener('input', function () {
        step = +range.value; out.textContent = step + 'ms'; run();
      });

      var again = el('button', 'd-btn d-btn--quiet', 'Reload');
      again.type = 'button';
      again.addEventListener('click', run);

      wrap.appendChild(feed);
      wrap.appendChild(bar);
      if (big) wrap.appendChild(again);
      stage.appendChild(wrap);
      run();

      return function () { timers.forEach(clearTimeout); };
    }
  };


  /* --------------------------------------------------------------------- */
  /* 08 — a field that rearranges itself under the pointer                  */
  /* --------------------------------------------------------------------- */

  /* Every shape is the same thing: 96 radii sampled around a circle. A
     square, a five-point star and a blob are three different functions
     filling the same array, which is the only reason any of them can turn
     into any other. Morphing is a lerp between two arrays. */
  var MN = 96;

  function normalise(r) {
    var mx = 0, i;
    for (i = 0; i < r.length; i++) if (r[i] > mx) mx = r[i];
    if (mx > 0) for (i = 0; i < r.length; i++) r[i] /= mx;
    return r;
  }
  function sample(fn, rot) {
    var r = new Array(MN);
    for (var i = 0; i < MN; i++) r[i] = fn(i / MN * Math.PI * 2 + rot);
    return normalise(r);
  }

  /* n = 2 is a circle, 4 a squircle, 9 reads as a square, below 1 an
     astroid. One family covers most of what people call a shape. */
  function superellipse(n, rot) {
    return sample(function (t) {
      return 1 / Math.pow(Math.pow(Math.abs(Math.cos(t)), n) +
                          Math.pow(Math.abs(Math.sin(t)), n), 1 / n);
    }, rot);
  }
  function polygon(k, rot) {
    var seg = Math.PI * 2 / k;
    return sample(function (t) {
      var a = ((t % seg) + seg) % seg;
      return Math.cos(Math.PI / k) / Math.cos(a - Math.PI / k);
    }, rot);
  }
  function star(points, depth, rot) {
    return sample(function (t) {
      return 1 - depth * Math.pow(Math.abs(Math.sin(points * t / 2)), 0.62);
    }, rot);
  }
  function flower(k, amp, rot) {
    return sample(function (t) { return 1 + amp * Math.cos(k * t); }, rot);
  }
  /* Two or three harmonics with random phases. This is the family that never
     repeats, which is what makes the tenth hover as interesting as the first. */
  function blob(rot) {
    var h = [];
    var count = 2 + Math.floor(Math.random() * 2);
    for (var i = 0; i < count; i++) {
      h.push([2 + Math.floor(Math.random() * 5),
              0.05 + Math.random() * 0.10,
              Math.random() * Math.PI * 2]);
    }
    /* three harmonics that happen to line up can sum to a deep pinch; hold
       the total swing so the worst case is still a lobed circle */
    var sum = 0;
    for (var j = 0; j < h.length; j++) sum += h[j][1];
    if (sum > 0.22) for (var k = 0; k < h.length; k++) h[k][1] *= 0.22 / sum;
    return sample(function (t) {
      var v = 1;
      for (var i = 0; i < h.length; i++) v += h[i][1] * Math.sin(h[i][0] * t + h[i][2]);
      return v;
    }, rot);
  }

  /* --- how thin a shape is allowed to get --------------------------------
     One number decides whether a tile is a shape or a splinter: the narrowest
     radius over the widest. A circle is 1, a square .71, a triangle .50. A
     seven-point star with deep notches falls to .25, and at that point it
     stops reading as a surface being deformed and starts reading as a
     splash — which is the thing to avoid in a grid of tiles that are all
     meant to be the same object wearing different shapes.

     Two defences. The parameter ranges below are pulled in so most rolls land
     fat on their own, and then fatness() checks the result whatever family it
     came from, because the families overlap: a superellipse under n=1 is an
     astroid and just as spiky as any star. */
  var MORPH_MIN_FAT = 0.46;

  function fatness(r) {
    var mn = Infinity, mx = 0;
    for (var i = 0; i < r.length; i++) {
      if (r[i] < mn) mn = r[i];
      if (r[i] > mx) mx = r[i];
    }
    return mx > 0 ? mn / mx : 0;
  }

  var MORPH_FAMILIES = ['superellipse', 'polygon', 'star', 'flower', 'blob'];
  function rollShape() {
    var rot = Math.random() * Math.PI * 2;
    var pick = MORPH_FAMILIES[Math.floor(Math.random() * MORPH_FAMILIES.length)];
    switch (pick) {
      /* 1.8 is a round-cornered circle and 9.3 reads as a square; below about
         1.6 the sides go concave and it is an astroid, not a tile */
      case 'superellipse':
        return { r: superellipse(1.8 + Math.random() * 7.5, rot), name: 'superellipse' };
      case 'polygon':
        return { r: polygon(3 + Math.floor(Math.random() * 6), rot), name: 'polygon' };
      /* depth is exactly 1 - fatness for this family, so .5 is the floor */
      case 'star':
        return { r: star(4 + Math.floor(Math.random() * 5),
                         0.26 + Math.random() * 0.24, rot), name: 'star' };
      case 'flower':
        return { r: flower(3 + Math.floor(Math.random() * 5),
                           0.10 + Math.random() * 0.16, rot), name: 'flower' };
      default:
        return { r: blob(rot), name: 'blob' };
    }
  }

  function randomShape() {
    /* Re-roll rather than clamp: clamping a spiky shape pushes every family
       toward the same middle, and the point of the field is that no two tiles
       agree. Twelve tries is far more than the tightened ranges need; the
       fallback is the one shape that cannot fail. */
    for (var i = 0; i < 12; i++) {
      var s = rollShape();
      if (fatness(s.r) >= MORPH_MIN_FAT) return s;
    }
    return { r: superellipse(2.4 + Math.random() * 3, Math.random() * Math.PI * 2),
             name: 'superellipse' };
  }

  function morphPath(r, size) {
    var c = size / 2, R = size / 2 * 0.92, d = '';
    for (var i = 0; i < MN; i++) {
      var t = i / MN * Math.PI * 2;
      d += (i ? 'L' : 'M') + (c + Math.cos(t) * r[i] * R).toFixed(2) + ' ' +
           (c + Math.sin(t) * r[i] * R).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  var morphField = {
    id: 'morph-field',
    n: '08',
    title: 'A field that will not stay square',
    question: 'How much can a surface change under the pointer before it stops being one surface?',
    note:
      '<p>It starts as one thing: a field of identical squares. Move across it ' +
      'and each cell you touch becomes something else, once, and stays that way. ' +
      'Nothing resets on its own. After a minute the page is a composition you ' +
      'made by walking across it rather than by choosing anything.</p>' +
      '<p>Every shape here is the same object. Ninety-six radii sampled around ' +
      'a circle, filled by a different function. A superellipse at n=2 is a ' +
      'circle, at 4 a squircle, at 9 it reads as a square. A polygon is ' +
      'cos(pi/k) over cos of the angle folded into one segment. A star is ' +
      '1 minus depth times sin(p&theta;/2) to the 0.62.</p>' +
      '<p>That shared array is the whole trick. Two shapes with the same point ' +
      'count can be interpolated straight through, so a triangle becomes an ' +
      'eight-point star without anyone writing a rule for that pair. Path ' +
      'morphing usually breaks on exactly this.</p>' +
      '<p>The fifth family is two or three sine harmonics with random ' +
      'frequencies, amplitudes and phases, which is the one that never repeats. ' +
      'The tenth hover is as new as the first.</p>' +
      '<p>Colour is picked at the same moment from five values, so the field ' +
      'drifts in hue as well as in shape. Under reduced motion the cells snap ' +
      'instead of tweening, and the composition still builds.</p>',
    spec: {
      'Points': '96 per shape, shared by every family',
      'Families': 'superellipse, polygon, star, flower, harmonic blob',
      'Morph': 'radius lerp, var(--d-4) 480ms, var(--e-out)',
      'Trigger': 'pointerover, once per cell per entry',
      'Repeats': 'the blob family does not'
    },
    mount: function (stage, o) {
      var big = o && o.big;
      var wrap = el('div', 'demo demo--flush');
      var field = el('div', 'morph');
      wrap.appendChild(field);

      var hint = el('div', 'morph__hint', big ? 'Move across the field' : 'Hover');
      field.appendChild(hint);

      var read = null, bar = null;
      if (big) {
        bar = el('div', 'morph__bar');
        var reset = el('button', 'd-btn d-btn--quiet', 'All square again');
        reset.type = 'button';
        reset.addEventListener('click', function () { build(true); });
        read = el('span', 'morph__read', '');
        bar.appendChild(reset);
        bar.appendChild(read);
        wrap.appendChild(bar);
      }

      /* Five fills that all hold up on a white page. blue-300 was in here
         and vanished against the paper. */
      /* The six diagram colours, plus ink. This is the one place on the site
         where all of them sit next to each other. */
      var INK = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--ink'];
      var base = superellipse(9, 0);                /* the square everything starts as */
      var cells = [], touched = 0, ro = null, timer = 0;

      function report() {
        if (read) read.textContent = touched + ' of ' + cells.length + ' changed';
      }

      function makeCell(size) {
        var NS = 'http://www.w3.org/2000/svg';
        var cell = el('div', 'morph__cell');
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
        svg.setAttribute('aria-hidden', 'true');

        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', morphPath(base, size));
        path.setAttribute('fill', 'rgba(0,0,0,.10)');
        svg.appendChild(path);
        cell.appendChild(svg);

        /* Flat fills. A gradient version was built and taken out again: a
           field of gradients reads as one smear, and the subject here is the
           shapes. */
        function paint() {
          path.setAttribute('fill', tok(INK[Math.floor(Math.random() * INK.length)]));
        }

        var cur = base.slice(), anim = 0, busy = false, done = false;

        function morphTo(next) {
          if (busy) return;
          busy = true;
          if (!done) { done = true; touched++; report(); }
          paint();

          if (still()) {
            cur = next.r.slice();
            path.setAttribute('d', morphPath(cur, size));
            busy = false;
            return;
          }
          var from = cur.slice(), to = next.r, t0 = performance.now();
          var dur = ms('--d-4');
          var step = function (now) {
            var k = Math.min(1, (now - t0) / dur);
            /* the same curve as var(--e-out), written out because a frame
               loop cannot hand a string to the browser */
            var e = 1 - Math.pow(1 - k, 3);
            var mid = new Array(MN);
            for (var i = 0; i < MN; i++) mid[i] = from[i] + (to[i] - from[i]) * e;
            path.setAttribute('d', morphPath(mid, size));
            if (k < 1) anim = requestAnimationFrame(step);
            else { cur = to.slice(); busy = false; anim = 0; }
          };
          anim = requestAnimationFrame(step);
        }

        cell.addEventListener('pointerover', function () { morphTo(randomShape()); });
        cell.addEventListener('click', function () { morphTo(randomShape()); });
        cell._stop = function () { if (anim) cancelAnimationFrame(anim); };
        return cell;
      }

      function build(force) {
        /* Measure the content box, never the border box minus a guess at how
           tall the control bar is. Guessing made the cell count jump between
           the first build and a reset. */
        field.style.paddingBottom = big ? '46px' : '14px';
        var cs = getComputedStyle(field);
        var innerW = field.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var innerH = field.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        if (innerW < 40 || innerH < 40) return;
        var target = big ? 74 : 56;
        var cols = Math.max(3, Math.round(innerW / target));
        var rows = Math.max(2, Math.round(innerH / target));
        if (!force && cells.length === cols * rows) return;

        cells.forEach(function (c) { c._stop(); });
        field.querySelectorAll('.morph__cell').forEach(function (c) { c.remove(); });
        cells = [];
        touched = 0;
        field.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        field.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
        for (var i = 0; i < cols * rows; i++) {
          var c = makeCell(100);
          field.appendChild(c);
          cells.push(c);
        }
        report();
      }

      stage.appendChild(wrap);
      build(true);
      if (window.ResizeObserver) {
        ro = new ResizeObserver(function () {
          clearTimeout(timer);
          timer = setTimeout(function () { build(false); }, 160);
        });
        ro.observe(field);
      }

      return function () {
        clearTimeout(timer);
        if (ro) ro.disconnect();
        cells.forEach(function (c) { c._stop(); });
      };
    }
  };

  window.LABS = [dayRamp, segmented, expand, stateButton, toasts, sheet, stagger, morphField];
})();
