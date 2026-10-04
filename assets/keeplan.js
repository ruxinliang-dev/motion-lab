/* ---------------------------------------------------------------------------
   KeePlan — the product, built rather than drawn.

   Eleven screens in the order a new user meets them. The layouts follow the
   hi-fi boards: the dashboard card row, the Reminder / Meeting / Event
   switch, Feature Activities, Popular Near You, the Weekly Stats rings and
   their To do / Done / Left badges, the timeline, the calendar, the thread
   and Edit Profile. Copy follows the research prototype, with illustrative dates and two
   spellings fixed.

   Every icon is an SVG path in ICONS. The screens share one state object, so
   a task created on New Task shows up on Home and an event joined on Events
   stays joined.

   Durations and easings are read from the site tokens in site.css, the same
   ones the experiments on the index page use.
--------------------------------------------------------------------------- */

(function () {
  'use strict';

  var root = document.documentElement;
  var uid = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function tok(name) {
    return getComputedStyle(root).getPropertyValue(name).replace(/\s+/g, ' ').trim();
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

  /* --------------------------------------------------------------------- */
  /* Icons. 24x24, stroked at 1.7, inheriting colour from their container.  */
  /* --------------------------------------------------------------------- */

  var ICONS = {
    home:   '<path d="M4 11.2 12 4.6l8 6.6V19a1.6 1.6 0 0 1-1.6 1.6H15V15H9v5.6H5.6A1.6 1.6 0 0 1 4 19z"/>',
    bell:   '<path d="M18 15.2V10a6 6 0 1 0-12 0v5.2l-1.5 2.2a.5.5 0 0 0 .4.8h14.2a.5.5 0 0 0 .4-.8z"/><path d="M10 21.2h4"/>',
    plus:   '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    cards:  '<path d="M3.2 9.2A1.8 1.8 0 0 1 5 7.4h14a1.8 1.8 0 0 1 1.8 1.8v8.4A1.8 1.8 0 0 1 19 19.4H5a1.8 1.8 0 0 1-1.8-1.8z"/><path d="M3.2 11.8h17.6M7.6 15.6h3.2"/>',
    chart:  '<path d="M5 20V12.4M10.3 20V5.6M15.7 20v-5.2M21 20V9.2"/>',
    search: '<circle cx="11" cy="11" r="7.2"/><path d="M20.6 20.6 16.1 16.1"/>',
    /* Three dots drawn as three almost-zero-length strokes with round caps,
       which renders a disc the width of the stroke. Before, they were filled
       circles with stroke="none" and a hard-coded radius, which meant they
       were the only icon in the set that did not take the gradient and the
       only one that did not get bolder when the pen did — a kebab menu
       noticeably lighter than the magnifier beside it.

       Now they are made of the same material as every other icon: same paint,
       same weight, and they change with both. */
    dots:   '<path d="M12 5.6h.01M12 12h.01M12 18.4h.01"/>',
    menu:   '<path d="M4 8.4h12M4 14h8"/><circle cx="19" cy="8.4" r="1.6"/>',
    back:   '<path d="M15 4.8 8 12l7 7.2"/>',
    arrowl: '<path d="M19.4 12H4.6M11 5.4 4.6 12 11 18.6"/>',
    next:   '<path d="M9 4.8 16 12l-7 7.2"/>',
    heart:  '<path d="M12 20.2S4.4 15.4 4.4 10.5A4.2 4.2 0 0 1 12 7.9a4.2 4.2 0 0 1 7.6 2.6c0 4.9-7.6 9.7-7.6 9.7z"/>',
    talk:   '<path d="M20.4 11.7a7.6 7.6 0 0 1-11.1 6.8L4 20.2l1.7-4.5A7.6 7.6 0 1 1 20.4 11.7z"/>',
    share:  '<circle cx="17.8" cy="6" r="2.3"/><circle cx="6.2" cy="12" r="2.3"/><circle cx="17.8" cy="18" r="2.3"/><path d="M8.3 10.9 15.7 7.1M8.3 13.1l7.4 3.8"/>',
    check:  '<path d="M5 12.6 10 17.6 19 6.8"/>',
    checkc: '<circle cx="12" cy="12" r="8.4"/><path d="M8.2 12.2 11 15l4.8-5.6"/>',
    /* It read as a bank card (she: "比较像银行卡而不是 calender"): a rounded
       rect with one bar across the top is a card, and the two hangers were
       only 4 units tall against a 13-unit body, so at tab size they read as
       the embossing on one. Longer hangers standing clear of the body, and
       five day marks in the field, and there is nothing else it can be. */
    cal:    '<path d="M3.6 8.4A2 2 0 0 1 5.6 6.4h12.8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z"/><path d="M3.6 11.2h16.8M8 3.2v4.4M16 3.2v4.4"/><path d="M8 14.6h.01M12 14.6h.01M16 14.6h.01M8 17.6h.01M12 17.6h.01"/>',
    clock:  '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3 1.9"/>',
    pin:    '<path d="M12 20.8s5.9-5.6 5.9-9.9a5.9 5.9 0 1 0-11.8 0c0 4.3 5.9 9.9 5.9 9.9z"/><circle cx="12" cy="10.7" r="2.2"/>',
    /* Rounder, after the one she sent: a bigger head, and shoulders that are a
       closed shape with soft corners rather than a thin arc hanging in space.
       The arc read as a pictogram; this reads as a drawing of a person, which
       is what the screen it sits on is asking for.

       Wide and low on the second pass: the shoulders span 13.6 of the 24.
       Squat is the whole look; a semicircle on top of a box is a different
       icon.

       And on the third the head moved in front. The shoulders are an OPEN
       path now: they rise from the bottom corners and stop on the head's own
       circumference, at about 45 degrees below its centre. Nothing is being
       hidden and no shape is filled with a background colour — the line
       simply ends where the head begins, which is what reads as one thing
       standing in front of another. Filling the head to mask the body would
       have needed to know what colour is behind the icon, and that differs on
       the three screens it appears on.

       Used by the sign-in avatar, the message thread and the profile, so all
       three get it. */
    user:   '<circle cx="12" cy="9.5" r="4.2"/>' +
            '<path d="M9 12.5C6.8 13.8 5.4 16.1 5.2 18.9a1.5 1.5 0 0 0 1.5 1.5h10.6' +
            'a1.5 1.5 0 0 0 1.5-1.5c-.2-2.8-1.6-5.1-3.8-6.4"/>',
    send:   '<path d="M20.8 3.2 10.2 13.8M20.8 3.2l-6.9 17.6-3.7-7-7-3.7z"/>',
    eye:    '<path d="M2.6 12S6.3 5.6 12 5.6 21.4 12 21.4 12 17.7 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.9"/>',
    eyeoff: '<path d="M9.6 6a9.6 9.6 0 0 1 2.4-.3c5.7 0 9.4 6.3 9.4 6.3a17 17 0 0 1-2.8 3.6M6.2 7.9A16.6 16.6 0 0 0 2.6 12S6.3 18.4 12 18.4a9 9 0 0 0 3.6-.7"/><path d="M4.2 4.2 19.8 19.8"/>',
    lock:   '<path d="M7.4 10.4V8a4.6 4.6 0 0 1 9.2 0v2.4"/><rect x="5.4" y="10.4" width="13.2" height="9.4" rx="2.6"/>',
    upload: '<path d="M12 16.4V5.6M8.2 9.2 12 5.4l3.8 3.8"/><path d="M4.6 15.6v2.8a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-2.8"/>',
    spark:  '<path d="M12 3.2 13.9 9 19.8 10.9 13.9 12.8 12 18.6 10.1 12.8 4.2 10.9 10.1 9z"/>',
    leaf:   '<path d="M5.2 19.2c-1-8.4 4.6-13.6 14.6-13.6.9 8.9-4.5 14.4-13.1 13.4z"/><path d="M5.6 19.4c2.8-3.1 5.4-5.3 9.2-7.4"/>',
    moon:   '<path d="M20 14.4A8.6 8.6 0 0 1 9.6 4a8.7 8.7 0 1 0 10.4 10.4z"/>',
    /* The toes were r1.9 with their centres 4.6 apart, which at this pen is
       less than the width of two strokes: they overlapped, and the pad sat
       1.2 under them. The whole thing read as one lump. Smaller toes, spread
       6 apart, pad pushed down — every gap is now wider than the pen. */
    paw:    '<circle cx="6" cy="9.6" r="1.3"/><circle cx="12" cy="7.2" r="1.3"/><circle cx="18" cy="9.6" r="1.3"/><path d="M12 13.4c2.5 0 4.5 1.9 4.5 3.9 0 1.4-1.1 2.4-2.6 2.4h-3.8c-1.5 0-2.6-1-2.6-2.4 0-2 2-3.9 4.5-3.9z"/>',
    /* A fork and a knife. It had a plate between them, drawn as two circles,
       and at 18px with this pen the inner one closed up into a dot — a target
       with cutlery either side. Two pieces of cutlery say "dining" on their
       own; the plate was the part that needed the space it did not have. */
    bowl:   '<path d="M7.6 3.4v5a1.9 1.9 0 0 0 1.9 1.9 1.9 1.9 0 0 0 1.9-1.9v-5M9.5 3.4v7.1M9.5 11.2v9.4"/>' +
            '<path d="M16.6 3.4c1.5 1.3 2.2 3.2 2.2 5.7 0 1.7-.8 2.8-2.2 3v8.5"/>',
    basket: '<path d="M4.4 9.6h15.2l-1.5 9a1.8 1.8 0 0 1-1.8 1.5H7.7a1.8 1.8 0 0 1-1.8-1.5z"/><path d="M8.6 9.6 11 4.2M15.4 9.6 13 4.2M9.6 13.4v3.2M14.4 13.4v3.2"/>',
    bag:    '<path d="M4 9.6h16v8.8a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.4z"/><path d="M8.8 9.6V6.2a1.8 1.8 0 0 1 1.8-1.8h2.8a1.8 1.8 0 0 1 1.8 1.8v3.4"/>',
    lift:   '<path d="M4 9.2v5.6M7.2 7.4v9.2M16.8 7.4v9.2M20 9.2v5.6M7.2 12h9.6"/>',
    game:   '<path d="M7.2 8h9.6a4.6 4.6 0 0 1 0 9.2 4.4 4.4 0 0 1-3.2-1.4h-3.2A4.4 4.4 0 0 1 7.2 17.2a4.6 4.6 0 0 1 0-9.2z"/><path d="M9.2 11.4v2.4M8 12.6h2.4"/><circle cx="16" cy="11.8" r=".9" fill="currentColor" stroke="none"/><circle cx="17.8" cy="13.8" r=".9" fill="currentColor" stroke="none"/>',
    compass:'<circle cx="12" cy="12" r="8.2"/><path d="M15.4 8.6 13.4 13.4 8.6 15.4 10.6 10.6z"/>',
    peak:   '<path d="M2.8 19.4 9.4 7.2l4.4 7.6 2.2-3.2 4.8 7.8z"/>',
    zen:    '<circle cx="12" cy="6.6" r="1.9"/><path d="M4.8 19.4c1.6-3 4.2-4.6 7.2-4.6s5.6 1.6 7.2 4.6"/><path d="M4.4 12.2 9 13.9M19.6 12.2 15 13.9"/>',
    dice:   '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.6"/><circle cx="8.8" cy="8.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="15.2" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    cap:    '<path d="M2.6 9.4 12 5.2l9.4 4.2L12 13.6z"/><path d="M6.4 11.2v4.6c0 1.7 2.5 3 5.6 3s5.6-1.3 5.6-3v-4.6M21.4 9.4v5.2"/>',
    brush:  '<path d="M6.4 14.6c-1.8.8-2.4 3-2.6 5.4 2.4-.2 4.6-.8 5.4-2.6"/><path d="M9.6 17.2C8.4 14 10 8.8 14 5.6c2.4-1.9 5.2-2.2 6.2-1.2s.7 3.8-1.2 6.2c-3.2 4-8.4 5.6-11.6 4.4z"/>',
    tag:    '<path d="M4.4 11.2V5.6A1.2 1.2 0 0 1 5.6 4.4h5.6l8.4 8.4a1.7 1.7 0 0 1 0 2.4l-4.8 4.8a1.7 1.7 0 0 1-2.4 0z"/><circle cx="8.4" cy="8.4" r="1.3"/>',
    plusc:  '<circle cx="12" cy="12" r="8.2"/><path d="M12 8.6v6.8M8.6 12h6.8"/>',
    pencil: '<path d="M4.6 19.4h4L19 9a2.4 2.4 0 0 0-3.4-3.4L5.2 16z"/><path d="M14.4 7.2l2.4 2.4"/>',
    doc:    '<path d="M6.4 3.4h7.4l4.4 4.4v12.8a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6V5a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M13.4 3.6v4.6h4.6M8.4 13h7M8.4 17h4.6"/>',
    /* Two nested hooks, tilted, kept mushing into each other at icon size no
       matter how the gap was tuned — because a two-piece glyph is never
       balanced, only more or less crowded. This is ONE continuous stroke
       instead (she: "做平衡一些"), the standard paperclip curve: it loops
       once, crosses its own line once, and every part of it carries the same
       weight, so there is nothing left to collide. */
    clip:   '<path d="M21.4 11 12.3 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 ' +
            '5.7 5.7l-9.2 9.2a2 2 0 0 1-2.9-2.9l8.5-8.5"/>',
    link:   '<path d="M10.2 13.8a3.5 3.5 0 0 0 5 0l2.9-2.9a3.5 3.5 0 0 0-5-5L11.7 7.4"/>' +
            '<path d="M13.8 10.2a3.5 3.5 0 0 0-5 0l-2.9 2.9a3.5 3.5 0 0 0 5 5l1.4-1.5"/>'
  };

  /* The back arrow her screens already draw, made into the control it looks
     like. Four screens have one; the rest get the floating one below. */
  /* An arrow, not a chevron (she: "message 回去使用箭头"). The chevron is the
     month stepper's mark — it means "one along" — and it is also what the send
     button wears. Leaving back on the same glyph made three different jobs
     share one shape. A shaft and a head says "out of here", which is the job. */
  function backBtn() {
    return '<button type="button" class="kp-back" aria-label="Back">' +
           icon('arrowl') + '</button>';
  }

  function icon(name, cls) {
    /* the dots carry their own weight: three discs the width of the pen read
       lighter than a drawn shape of the same pen, so they are given more */
    return '<svg class="kp-ico' + (name === 'dots' ? ' kp-ico--dots' : '') +
           (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" ' +
           'aria-hidden="true"><g class="kp-fit">' + (ICONS[name] || '') +
           '</g></svg>';
  }

  /* The KeePlan mark — traced, not redrawn.

     Two attempts at rebuilding it by hand from the paths I could see produced
     a stick figure: straight segments for the limbs, a circle for the head.
     Her drawing is nothing like that. It is outline art — the body, arms and
     legs are closed tubes with rounded ends, and a runner drawn as line
     segments reads as a pictogram of a runner rather than as her logo.

     So this is her artwork, traced: the purple ink in the frame she sent was
     turned into boundary loops (every edge of the filled region, shared edges
     cancelling, linked into closed loops), smoothed with two rounds of
     Chaikin, and simplified with Ramer-Douglas-Peucker at 0.8px. Rasterising
     the result back and comparing with the source measures IoU 0.93 for the
     purple and 0.94 for the blue; what is missing is the antialiased pixel at
     the edge. fill-rule evenodd does the holes — the inside of the head, the
     insides of every tube — without anyone deciding which loop is which.

     One trap worth remembering: RDP measures distance from the chord between
     the first and last point, and on a CLOSED loop those are the same point.
     The chord has no direction, every distance comes out zero, and the whole
     contour simplifies away to nothing. Split the loop in half first.

     It is still not an image file: it is 5KB of path data, it scales, and it
     follows nothing but its own two colours. */
  function mark() {
    return '<svg class="kp-mark" viewBox="0 0 290 274" aria-hidden="true">' +
      '<path fill="#66399e" fill-rule="evenodd" d="M65.4 0.0 78.6 0.0 87.8 4.1 95.9 12.2 100.0 22.4 100.0 31.6 95.9 42.8 93.8 45.9 92.1 46.2 88.9 51.8 85.1 55.2 84.9 56.8 76.0 67.4 73.8 69.9 70.4 70.0 66.1 65.8 62.9 60.2 48.1 42.8 44.0 31.6 44.0 22.4 48.1 12.2 56.2 4.1 65.4 0.0ZM70.6 9.0 62.2 12.1 58.1 16.2 56.0 20.4 55.0 27.6 58.1 35.8 63.2 40.9 73.4 43.0 78.8 41.9 86.9 34.8 89.0 28.6 89.0 24.4 85.9 16.2 81.8 12.1 77.6 10.0 70.6 9.0ZM168.4 15.0 174.9 16.2 175.0 22.6 172.6 24.0 166.1 21.8 167.1 16.2 168.4 15.0ZM185.4 18.0 191.6 18.0 192.4 19.0 203.6 20.0 209.4 22.0 240.6 26.0 251.8 31.1 258.9 38.2 264.0 49.4 263.0 67.6 256.9 77.8 246.6 85.0 238.6 88.0 228.4 88.0 217.2 83.9 208.1 75.8 203.0 65.6 202.0 52.4 205.1 42.2 209.9 36.8 210.1 35.2 214.9 31.8 214.9 30.2 184.2 25.9 185.4 18.0ZM65.4 19.0 69.8 20.1 71.4 22.0 77.4 19.0 81.9 21.2 81.9 27.8 77.6 32.0 73.8 35.9 70.4 36.0 62.1 27.8 62.1 21.2 65.4 19.0ZM228.6 34.0 219.2 38.1 213.1 45.2 210.0 54.4 211.0 63.6 214.1 69.8 220.2 75.9 231.4 80.0 236.4 79.0 243.8 77.9 251.9 70.8 256.0 61.6 256.0 51.4 252.9 44.2 245.8 37.1 237.6 34.0 228.6 34.0ZM162.4 50.0 173.8 52.1 174.0 56.6 172.0 59.4 162.2 58.9 161.0 57.6 161.0 51.4 162.4 50.0ZM148.4 72.0 159.6 72.0 160.4 73.0 169.6 73.0 170.4 74.0 179.6 74.0 180.4 75.0 189.6 75.0 190.8 74.1 194.8 76.1 204.2 85.9 205.8 86.1 212.2 92.9 213.8 93.1 239.4 117.0 243.9 108.8 244.1 105.2 246.9 100.8 251.1 87.2 254.2 82.1 259.6 82.0 270.2 86.9 280.8 90.1 283.2 91.9 285.8 92.1 289.9 95.2 290.0 99.6 269.9 149.8 260.8 159.9 254.8 162.9 251.6 164.0 237.4 164.0 229.2 160.9 220.8 153.1 219.2 152.9 210.8 144.1 209.2 143.9 201.8 136.1 199.2 136.1 193.1 142.2 192.9 143.8 189.0 147.4 190.0 150.4 191.0 192.6 192.0 193.4 192.0 217.6 187.9 226.8 184.1 230.2 183.8 231.9 173.8 237.9 161.4 240.0 150.2 236.9 131.8 222.1 129.2 222.1 125.0 227.4 118.1 235.2 117.9 236.8 113.1 241.2 112.9 242.8 108.1 247.2 107.9 248.8 103.1 253.2 102.9 254.8 98.1 259.2 97.9 260.8 93.1 265.2 92.9 266.8 88.1 271.2 87.9 272.8 85.6 274.0 80.2 271.9 73.8 265.1 72.2 264.9 57.8 252.1 43.2 249.9 43.0 244.4 44.4 242.0 59.8 243.9 99.0 196.6 69.1 172.8 69.1 167.2 73.9 162.8 74.1 161.2 81.9 152.8 81.9 151.2 60.2 146.9 60.1 140.2 63.6 139.0 64.4 140.0 70.6 140.0 75.4 142.0 82.6 142.0 83.4 143.0 94.8 142.1 105.2 150.9 106.8 151.1 110.2 154.9 115.8 158.1 120.2 162.9 123.2 164.9 125.8 164.9 132.0 156.6 131.0 147.4 132.0 146.6 132.0 141.4 135.0 134.4 128.1 127.8 122.1 117.8 120.0 110.6 120.0 100.4 123.1 90.2 127.1 84.2 132.2 79.1 135.8 77.9 136.2 76.1 148.4 72.0ZM150.6 80.0 139.2 84.1 133.1 90.2 129.0 98.4 128.0 108.6 130.1 115.8 131.9 117.2 133.1 120.8 140.4 128.0 143.9 125.8 144.1 124.2 153.0 114.6 156.0 111.6 151.0 107.6 151.1 105.2 153.9 102.8 154.1 101.2 156.8 101.1 161.8 104.9 164.9 101.8 165.1 100.2 172.9 92.8 173.1 91.2 179.9 84.8 180.0 83.4 177.6 82.0 150.6 80.0ZM190.6 85.0 142.1 139.2 140.0 142.4 139.9 160.8 122.1 181.2 121.9 182.8 117.1 187.2 116.9 188.8 112.1 193.2 111.9 194.8 107.1 199.2 106.9 200.8 102.1 205.2 101.9 206.8 97.1 211.2 96.9 212.8 92.1 217.2 91.9 218.8 87.1 223.2 86.9 224.8 82.1 229.2 81.9 230.8 77.1 235.2 76.9 236.8 72.1 241.2 71.9 242.8 67.1 247.2 67.1 248.8 73.2 254.9 74.8 255.1 83.2 262.9 84.8 262.9 132.4 206.0 137.9 199.8 138.1 198.2 139.9 197.8 143.1 192.2 147.9 187.8 148.1 186.2 152.9 181.8 153.1 180.2 157.9 175.8 158.1 174.2 159.8 173.9 160.1 172.2 164.2 168.1 165.6 168.0 171.0 172.6 160.1 185.2 159.9 197.8 157.8 199.9 154.4 200.0 150.2 197.1 143.1 205.2 142.9 206.8 138.1 211.2 136.1 215.8 141.8 219.1 150.2 226.9 158.4 231.0 168.6 231.0 173.8 228.9 179.9 223.8 182.9 217.8 184.0 214.6 184.0 199.4 183.0 198.6 181.0 144.4 194.0 129.6 188.1 123.8 186.1 119.8 185.0 109.4 188.1 101.2 193.2 96.1 200.0 92.6 190.6 85.0ZM259.6 91.0 252.1 107.2 252.0 110.6 246.1 123.2 245.9 125.8 244.2 126.1 243.6 128.0 239.2 127.9 210.8 102.1 207.6 101.0 199.2 102.1 194.0 107.4 193.0 113.6 194.1 117.8 198.2 122.9 199.8 123.1 206.2 129.9 207.9 130.2 208.2 131.9 210.0 132.4 228.2 149.9 236.2 154.9 239.4 156.0 249.6 156.0 258.8 150.9 263.9 143.8 265.1 138.2 267.9 133.8 270.1 126.2 271.9 124.8 273.1 118.2 280.0 102.6 279.8 99.1 259.6 91.0ZM87.4 93.0 106.8 96.1 108.0 97.6 107.0 98.4 106.9 103.8 105.6 104.0 85.2 100.9 86.0 94.4 87.4 93.0ZM43.4 136.0 50.9 138.2 49.6 145.0 43.4 145.0 42.1 143.8 42.0 138.4 43.4 136.0ZM92.6 153.0 83.1 163.2 82.9 164.8 79.1 168.2 79.1 169.8 88.2 177.9 93.8 181.1 97.2 184.9 105.0 189.6 118.9 172.2 114.8 168.1 113.2 167.9 112.8 166.1 104.2 160.9 98.8 155.1 95.8 153.1 92.6 153.0ZM26.4 239.0 32.6 239.0 33.9 240.2 32.6 248.0 25.1 245.8 26.4 239.0Z"/>' +
      '<path fill="#0b7bff" fill-rule="evenodd" d="M16.4 73.0 26.6 73.0 31.8 75.1 37.9 80.2 42.0 89.4 42.0 97.6 38.9 104.8 24.6 123.0 22.8 124.9 20.4 125.0 18.1 122.8 17.9 121.2 6.1 107.8 2.1 101.8 1.0 97.6 1.0 89.4 4.1 81.2 11.2 75.1 16.4 73.0ZM18.6 80.0 14.2 82.1 11.1 85.2 9.0 90.4 9.0 94.6 12.1 100.8 16.2 103.9 20.4 105.0 23.4 104.0 26.8 103.9 30.9 100.8 34.0 94.6 34.0 90.4 31.9 85.2 28.8 82.1 23.6 80.0 18.6 80.0ZM17.4 87.0 20.4 89.0 25.6 87.0 28.9 89.2 28.9 93.8 25.0 97.4 22.8 99.9 20.4 100.0 14.1 93.8 14.1 89.2 17.4 87.0Z"/>' +
      '</svg>';
  }


  /* the project card's cover is drawn from these (assets/site.js) */
  window.KP_ART = { icons: ICONS, mark: mark };

  /* --------------------------------------------------------------------- */
  /* State                                                                  */
  /* --------------------------------------------------------------------- */

  /* The onboarding list in the order the screen printed it. The grid
     fills row by row, so the two columns interleave here. */
  var TOPICS = [
    ['Everything!', true], ['Explore', false],
    ['Games', false],      ['Sports', false],
    ['Pets', true],        ['Alumni', false],
    ['Food', true],        ['Adventure', false],
    ['Travel', false],     ['Beauty', false],
    ['Niche', false],      ['Advice', false],
    ['Relaxation', true],  ['Random', false]
  ];

  /* categories, with Excercise and Dinning spelled properly. */
  var CATS = ['Meeting', 'Shopping', 'Exercise',
              'Friend', 'Dining', 'Relax',
              'Family', 'Date', 'Festival'];

  var S = {
    topics: {},
    tasks: [
      { k: 'Relax', t: 'Find rest spaces / go out and walk',
        d: 'Apr 30 - Jun 30', p: 50, i: 'leaf' },
      { k: 'Relax', t: 'Keep at least 8 hours of sleep',
        d: 'Feb 10 - Jun 30', p: 70, i: 'moon' },
      { k: 'Health', t: 'At least 30 minutes of exercise every day',
        d: 'Feb 10 - Jun 30', p: 25, i: 'lift' }
    ],
    cats: { Shopping: true, Friend: true },
    priv: 0,
    joined: {},
    liked: { e2: true },
    hidden: { email: true },
    profile: { name: 'Aaron Smith', country: 'United Kingdom', email: 'Aargwe@email.com' },
    day: 19,
    seg: 0,
    who: 'Julie L.'
  };
  TOPICS.forEach(function (t) { S.topics[t[0]] = t[1]; });

  /* --------------------------------------------------------------------- */
  /* Small builders                                                         */
  /* --------------------------------------------------------------------- */

  /* The ring's colour is the value, not a decoration — and it runs light to
     dark, because that is the reading that needs no legend: barely started is
     barely there, nearly done is nearly solid.

     The first version went cyan to blue, which is a hue change. A hue change
     says "different", not "more"; two rings a quarter apart looked like two
     categories rather than two amounts. Lightness says "more" on its own.

     So both move together: the bottom end is a pale CYAN (#72e4ec, the light
     tint of the product's own cyan) and the top is the brand blue. Lightness
     carries the amount; the hue turning with it is what keeps the low end
     from looking like a washed-out version of the high one. */
  function ringColour(pct) {
    var a = RING_LOW;                   /* pale cyan, for the barely begun  */
    var b = [11, 95, 208];              /* --kp-brand #0b5fd0, for the done */
    var t = Math.max(0, Math.min(1, pct / 100));
    return 'rgb(' + a.map(function (v, i) {
      return Math.round(v + (b[i] - v) * t);
    }).join(',') + ')';
  }

  /* One ring, at three sizes. Everything about it is a RATIO of its own
     diameter, so a 30px ring and a 36px one are the same drawing rather than
     two drawings that happen to both be circles:

       stroke  9% of the diameter
       number  30% of the diameter

     They used to share a fixed 3.2px stroke and a fixed 10px number, which
     meant the small ones came out thicker-walled and more crowded — the ratio
     went from .089 to .107 across the screens, and that is exactly the
     difference you can see without being able to name it.

     Both numbers are written as inline styles because an SVG presentation
     attribute loses to any stylesheet rule, and .kp-ring circle has one. */
  /* the bottom of the value ramp: what a fill is coloured when there is
     almost nothing of it. ringColour() interpolates from here to the brand. */
  var RING_LOW = [114, 228, 236];       /* #72e4ec */

  /* Where every value-bearing fill STARTS. Sampled off her own artwork: her
     23% bar runs #0099ff to #02c6ff and her 92% runs #036dff to #0366ff — the
     left end barely moves between them, the right end is the whole story.

     So a fill is not a ramp it slides along; it is a gradient from this blue
     to the colour its own value earns. A long one ends deep blue and reads
     dark all through; a short one ends in cyan and reads light. That is the
     difference she named: "longer is darker, not just a gradient". */
  /* It was one fixed blue for everything. That is right for her Records bars —
     a 23% bar is still a hundred pixels long, so it has room to travel from
     blue to cyan — and wrong for the chart, where a quiet Tuesday is fifty
     pixels tall and spent half of that being brand blue. She saw it straight
     away: the short bars should read cyan.

     So the start follows the value as well: the value's own colour, pushed 45%
     of the way toward the brand. A short fill is cyan with a slightly deeper
     foot, a full one is blue on blue and reads flat — and "longer is darker"
     still holds, which was the point of the whole thing. */
  var FILL_BRAND = [11, 95, 208];

  function fillStart(pct) {
    var c = ringColour(pct).match(/[0-9]+/g).map(Number);
    return 'rgb(' + c.map(function (v, i) {
      return Math.round(v + (FILL_BRAND[i] - v) * 0.45);
    }).join(',') + ')';
  }

  function fillGrad(dir, v) {
    return 'linear-gradient(' + dir + ', ' + fillStart(v) + ', ' + ringColour(v) + ')';
  }

  /* A chart is read against itself. 40 out of a possible 100 is "not much",
     but 40 in a week whose best day is 90 is "not much THIS week", and that
     second reading is the one the eye wants — so the chart maps a day's share
     of the busiest day rather than its raw number.

     Squared, because linear made every middling day come out blue: Monday at
     44% of the peak was already rgb(73,175,225), which is a blue with a
     memory of cyan rather than a cyan. Squared, 44% of the peak lands at 19%
     of the ramp and stays properly cyan, while the peak day is still the full
     brand blue — the quiet days go quiet, which is the whole job. */
  function chartTone(v, top) {
    var share = top ? v / top : 0;
    return Math.round(share * share * 100);
  }

  /* .12, not .09 (she: "这个弧度做粗一些"). At 9% of a 30px ring the arc is
     2.7px, and it is the only thing in that ring carrying a value — a hairline
     reads as a border round the number rather than a measurement of it. */
  var RING_PEN = 0.12, RING_TEXT = 0.30;

  /* One diameter, in one place. Both screens that draw a ring used to name
     their own number, which is how they drifted apart in the first place. */
  var RING_SIZE = 30;

  function ring(label, pct, size) {
    var w = size * RING_PEN;
    var r = (size - w * 2) / 2, c = 2 * Math.PI * r;
    /* Same rule as every bar in the product: the arc starts a little deeper than
       finishes at the colour its own value earns. A nearly-finished ring
       therefore reads deep blue all the way round, and a barely-begun one
       ends in cyan — the gradient says what the length says, twice.

       It used to start at the cyan END of the ramp, which made every ring
       look like a low one no matter what it held. */
    var g = 'kpr' + (++uid);
    return '<span class="kp-ring__wrap" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg class="kp-ring" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + g + '" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0" stop-color="' + fillStart(pct) + '"/>' +
      '<stop offset="1" stop-color="' + ringColour(pct) + '"/></linearGradient></defs>' +
      '<circle class="bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r.toFixed(2) +
      '" style="stroke-width:' + w.toFixed(2) + 'px"/>' +
      '<circle class="fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r.toFixed(2) +
      '" style="stroke-width:' + w.toFixed(2) + 'px;stroke:url(#' + g + ')' +
      '" stroke-dasharray="' + c.toFixed(1) +
      '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '"/></svg>' +
      '<span class="kp-ring__n" style="font-size:' + (size * RING_TEXT).toFixed(1) +
      'px">' + label + '</span></span>';
  }

  /* --- one ink size for all of them ---------------------------------------
     Forty-odd icons drawn by hand in the same 24 box do not fill it by the
     same amount: the leaf runs corner to corner, the basket sits in the
     middle, and dropped into the same 32px badge one looks twice the other.
     "Make the ratio consistent" is not something to eyeball forty times.

     So it is measured. Each icon's ink box is read at runtime and the group
     holding it is scaled and centred until its longer side is ICON_FIT of the
     box. Uniform scale, so nothing is stretched, and the stroke is left out of
     it by vector-effect:non-scaling-stroke — otherwise fitting a small icon up
     would fatten its pen and the weights would drift apart again.

     Degenerate boxes are skipped: the kebab's three dots are 0.01 wide, and
     scaling that to 86% of the box would turn it into a barcode. */
  var ICON_FIT = 0.84;

  function fitIcons(root) {
    (root || document).querySelectorAll('.kp-ico > .kp-fit').forEach(function (g) {
      if (g._fitted) return;
      var b;
      try { b = g.getBBox(); } catch (e) { return; }
      var w = b.width, h = b.height;
      if (w < 0.5 && h < 0.5) { g._fitted = 1; return; }
      var s = (24 * ICON_FIT) / Math.max(w, h);
      g.setAttribute('transform',
        'translate(' + (12 - (b.x + w / 2) * s).toFixed(2) + ' ' +
        (12 - (b.y + h / 2) * s).toFixed(2) + ') scale(' + s.toFixed(3) + ')');
      g._fitted = 1;
    });
  }

  function topbar(title, left) {
    return '<div class="kp-top">' +
      '<span style="display:flex;align-items:center;gap:9px">' +
      (left === 'back' ? backBtn()
        /* The menu mark was decoration — a span. It is the way into Messages
           (she: "这个点击应该左滑进入 messages 画面"), so it is a button, and
           because Messages sits later in the flow than every screen that
           carries this bar, go() plays it as a forward move: it comes in from
           the right, which is the left slide she asked for. */
        : left === 'menu' ? '<button type="button" class="kp-topbtn" aria-label="Messages">' +
            icon(left) + '</button>'
        : left ? '<span style="color:var(--kp-ink-2)">' + icon(left) + '</span>' : '') +
      '<span class="kp-h1">' + title + '</span></span>' +
      '<span class="kp-top__acts">' + icon('search') +
      '<button type="button" class="kp-topbtn kp-topbtn--dots" aria-label="Settings">' +
      icon('dots') + '</button></span></div>';
  }

  function monthStrip() {
    return '<div class="kp-months"><span>Jul</span><span>Aug</span><b>Sep</b>' +
      '<span>Oct</span><span>Nov</span><span>Dec</span></div>';
  }

  function dayStrip(s) {
    var days = el('div', 'kp-days');
    [17, 18, 19, 20, 21, 22].forEach(function (d) {
      var b = el('button', 'kp-day', String(d));
      b.type = 'button';
      b.setAttribute('aria-pressed', d === S.day ? 'true' : 'false');
      b.addEventListener('click', function () {
        S.day = d;
        days.querySelectorAll('.kp-day').forEach(function (x) {
          x.setAttribute('aria-pressed', x.textContent === String(d) ? 'true' : 'false');
        });
      });
      days.appendChild(b);
    });
    s.appendChild(days);
  }

  /* --- the scroll system ---------------------------------------------------
     Every screen has scrolled since the day it was built; the problem was that
     nothing told you so. A phone tells you with momentum and a bar you can
     see; a 260px mock of a phone on a website has neither, so a screen with
     content under the fold looked like a screen that had finished.

     So the device reads its own screen and says: `data-more="d"` when there is
     more below, `"u"` above, `"ud"` both. The fades live on the phone, not on
     the screen, because a pseudo-element inside a scroll container scrolls
     away with the content — which is exactly when you need it. */
  /* --- what actually scrolls -----------------------------------------------
     Every screen but one IS its own scroller. The thread is the exception:
     that screen is a fixed column (bar / thread / composer) and only the
     middle of it moves, which is what keeps the composer pinned to the
     bottom. So the scrollbar lost its subject there and vanished (she:
     "message 里保留滚动 bar").

     Everything that talks to the bar asks this instead of assuming. */
  function scrollerOf(screen) {
    return (screen && screen.querySelector('.kp-msgs')) || screen;
  }
  function currentScroller() {
    return scrollerOf(view && view.querySelector('.kp-screen:last-child'));
  }
  /* how far the scroller's own top sits below the view's, in layout px —
     getBoundingClientRect would be scaled by whatever transform the deck has
     the page under, and this is a pixel offset, not a ratio */
  function offsetInView(node) {
    var y = 0;
    while (node && node !== view && node.offsetParent) {
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return y;
  }

  function scrollState(sc) {
    var phone = phoneEl || document.querySelector('.kp-phone');
    if (!phone || !sc) return;
    var slack = sc.scrollHeight - sc.clientHeight;
    if (slack <= 2) {
      phone.removeAttribute('data-more');
      if (barEl) barEl.hidden = true;
      return;
    }
    var up = sc.scrollTop > 2;
    var down = sc.scrollTop < slack - 2;
    phone.setAttribute('data-more', (up ? 'u' : '') + (down ? 'd' : ''));

    /* The thumb's length is still the share of the screen you can see, but
       clamped. Unclamped it is honest and useless: Home can see 94% of itself,
       so its thumb came out 480px long — a slab down the whole edge that says
       "you are everywhere". 28-72 was the other end of that and read as a
       dash. 44-120 is the third try: about a quarter of the track at most, so
       it is a handle you can see and take hold of, and still short enough to
       leave the track visible behind it. */
    if (!barEl) return;
    var track = sc.clientHeight - 16;
    var h = Math.min(120, Math.max(44, track * (sc.clientHeight / sc.scrollHeight)));
    barEl.hidden = false;
    barEl.style.top = (offsetInView(sc) + 8) + 'px';
    barEl.style.height = h.toFixed(1) + 'px';
    barEl.style.transform =
      'translateY(' + ((track - h) * (sc.scrollTop / slack)).toFixed(1) + 'px)';

    /* And the thumb takes its colour from where it is. Every other reading in
       this product is placed on the cyan-to-brand lerp by its value; the one
       thing the scrollbar knows is how far down the screen you are, so that
       is what it reports. Cyan at the top, brand at the bottom — the same
       sentence the flow rail says outside the device, said inside it.

       It used to be a flat --kp-brand at .4 opacity. A washed-out blue on
       white is browser furniture; a colour that moves is part of the
       interface. */
    barEl.style.background = ringColour((sc.scrollTop / slack) * 100);
  }

  function watchScroll(sc) {
    if (!sc || sc._watched) return;
    sc._watched = 1;
    var tick = function () { scrollState(sc); };
    sc.addEventListener('scroll', tick, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(tick).observe(sc);
    /* the fonts and the canvas rings land after this runs */
    tick();
    setTimeout(tick, 60);
    setTimeout(tick, 400);
  }

  /* --- the clock ----------------------------------------------------------
     It said 9:41, which is the time on every phone in every advertisement.
     That is a fine joke on a marketing page and the wrong thing here: this
     device is running, everything else in it is live, and a frozen clock is
     the one detail that says "picture of an app".

     Intl formats it the way the reader's own machine does — 9:41 or 21:41,
     with whatever separator their locale uses — and the day period is dropped
     because a phone status bar does not print one. Ticking is aligned to the
     next minute rather than polled every second: the display only changes
     sixty times an hour, so it should only be written that often. */
  function clockText() {
    var d = new Date();
    try {
      var ps = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
        .formatToParts(d);
      var out = '';
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].type === 'hour' || ps[i].type === 'minute') out += ps[i].value;
        else if (ps[i].type === 'literal' && out && /[:.·]/.test(ps[i].value)) {
          out += ps[i].value.trim();
        }
      }
      if (out) return out;
    } catch (e) {}
    return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  var clockTimer = 0;
  function startClock(node) {
    if (!node) return;
    clearTimeout(clockTimer);
    clearInterval(clockTimer);
    function write() { node.textContent = clockText(); }
    write();
    /* line up with the top of the next minute, then once a minute after */
    clockTimer = setTimeout(function () {
      write();
      clockTimer = setInterval(write, 60000);
    }, 60000 - (Date.now() % 60000) + 40);
  }

  function toast(text) {
    var phone = document.querySelector('.kp-phone');
    if (!phone) return;
    var old = phone.querySelector('.kp-toast');
    if (old) old.remove();
    var t = el('div', 'kp-toast', icon('check') + '<span>' + text + '</span>');
    phone.appendChild(t);
    fitIcons(t);
    if (!still()) {
      t.animate([{ opacity: 0, transform: 'translateY(14px)' },
                 { opacity: 1, transform: 'none' }],
        { duration: ms('--d-4'), easing: tok('--e-out') });
    }
    setTimeout(function () {
      if (!t.isConnected) return;
      if (still()) { t.remove(); return; }
      t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }],
        { duration: ms('--d-2'), easing: 'linear' }).onfinish = function () { t.remove(); };
    }, 2400);
  }

  function segment(labels, current, onPick) {
    var seg = el('div', 'kp-seg');
    seg.style.setProperty('--n', labels.length);
    var pill = el('span', 'kp-seg__pill');
    pill.style.transform = 'translateX(' + current * 100 + '%)';
    seg.appendChild(pill);
    var btns = labels.map(function (t, i) {
      var b = el('button', null, t);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (i === current) return;
        var from = current; current = i;
        btns.forEach(function (x, k) {
          x.setAttribute('aria-selected', k === i ? 'true' : 'false');
        });
        var stretch = 1 + Math.min(Math.abs(i - from) * 0.13, 0.26);
        if (!still()) {
          pill.animate([
            { transform: 'translateX(' + from * 100 + '%) scaleX(1)' },
            { transform: 'translateX(' + ((from + i) / 2) * 100 + '%) scaleX(' + stretch + ')',
              offset: 0.45 },
            { transform: 'translateX(' + i * 100 + '%) scaleX(1)' }
          ], { duration: ms('--d-3'), easing: tok('--e-spring') });
        }
        pill.style.transform = 'translateX(' + i * 100 + '%)';
        if (onPick) onPick(i);
      });
      seg.appendChild(b);
      return b;
    });
    return seg;
  }

  function taskRow(t) {
    var row = el('div', 'kp-card kp-task');
    row.innerHTML =
      '<span class="kp-task__ico">' + icon(t.i) + '</span>' +
      '<span class="kp-task__b">' +
        '<span class="kp-task__k">' + t.k + '</span>' +
        '<span class="kp-task__t">' + t.t + '</span>' +
        '<span class="kp-task__d">' + t.d + '</span>' +
      '</span>' + ring(t.p, t.p, RING_SIZE);
    return row;
  }

  /* --------------------------------------------------------------------- */
  /* Screens                                                                */
  /* --------------------------------------------------------------------- */

  var SCREENS = {};

  SCREENS.welcome = function () {
    var s = el('div', 'kp-screen');
    var w = el('div', 'kp-welcome');
    w.innerHTML =
      mark() +
      '<div class="kp-word"><span>Kee</span><span>Plan</span></div>' +
      '<p>This app helps you find your way when you feel lost. Enjoy starting your ' +
      'journey of interest as well as start planning for life. Just remember, ' +
      'follow your heart!</p>';
    var b = el('button', 'kp-btn kp-btn--grad kp-cta', 'Start');
    b.type = 'button';
    /* the 12px was pinning it under the paragraph; the stylesheet pushes it to
       the floor, which is where her frame has it */
    b.addEventListener('click', function () { goTo('topics'); });
    w.appendChild(b);
    s.appendChild(w);
    return { el: s, tab: null };
  };

  /* Step 2. In her recording this screen says one thing and shows one
     drawing, and that is the whole point of it: the questions are over. The
     Next button is the one addition — her demo advanced by tapping through a
     prototype hotspot, and a screen you cannot leave is not a screen. */
  /* The message list, which sits in front of the thread. No photographs:
     nothing on this site is an image file, so an avatar is a tinted square
     with an initial in it — six tints off the product's own palette. */
  /* The previews used to carry their own "..." and were cut at about six
     words, because the row gave the timestamp a column of its own and the
     text only got what was left (she: "message 内容显示更多"). The timestamp
     now sits on its own line above the name, the text gets the full width and
     two lines of it, and the truncation is the browser's — so the row shows
     as much as it can fit instead of as much as somebody typed. */
  var PEOPLE = [
    ['Julie L.',  'That sounds good! see you later.', '2 hours ago', false],
    ['Mike W.',   'I also waited for such an opportunity to work with the team.',
                                                      '5 hours ago', false],
    ['Sara K.',   'Great to catch up today. Looking forward to the next session.',
                                                      'Nov 2',       false],
    ['Amiley W.', 'Our plan is to meet in about a week, if that still works for you.',
                                                      'Nov 6',       true],
    ['Mark J.',   "It's okay, I'll plan it out then.", 'Nov 8',       false],
    ['Jacob S.',  'This is indeed the events that people around here keep asking for.',
                                                      'Nov 8',       false]
  ];
  var AV_TINTS = ['#dbe9fb', '#d3f1f7', '#e4dcf5', '#fde5d0', '#d8f0e2', '#e7e9ee'];

  /* One thread per person, and each one ENDS on the line the list shows for
     them — the preview is the last message, which is the only arrangement
     where the list and the thread are telling the same story. Six threads,
     six reasons to be talking: a mentoring pair, a hike, a catch-up, a plan
     being moved, a walk being moved, and the events question. */
  var THREADS = {
    'Julie L.': { role: 'Mentoring', msgs: [
      { me: false, w: 'Nov 4, 18:03',
        t: 'Hey Johnson, thanks for the call yesterday. So pleased that you found the ' +
           'topics we covered useful, and looking forward to seeing what you create. ' +
           'Definitely check out Photoshop too, some great tools for editing photos.' },
      { me: true, w: 'Nov 5, 10:25',
        t: 'Thanks will do! Photoshop looks awesome and I cannot wait to give it a go.' },
      { me: false, w: 'Nov 6, 13:25',
        t: 'Great catching up today Johnson. I have got our next mentoring session ' +
           'scheduled for next Tuesday if this still works for you? How do you feel ' +
           'about tackling some more advanced photography techniques?' },
      { me: true, w: 'Nov 7, 09:18',
        t: 'Thanks Julie, yea was great. More advanced techniques sounds like a plan, ' +
           'speak soon.' },
      { me: false, w: '2 hours ago', t: 'That sounds good! see you later.' }
    ] },
    'Mike W.': { role: 'Hiking', msgs: [
      { me: true, w: 'Nov 3, 19:40',
        t: 'Saw you joined the Saturday hike. Did you get a place on the ridge route, ' +
           'or are you on the short loop with everyone else?' },
      { me: false, w: 'Nov 3, 20:02',
        t: 'Ridge route. Six of us so far, and the leader says there is room for two ' +
           'more if you know anyone who would come.' },
      { me: true, w: 'Nov 4, 08:15',
        t: 'I will ask around. I have wanted to do that one since the spring.' },
      { me: false, w: '5 hours ago',
        t: 'I also waited for such an opportunity to work with the team.' }
    ] },
    'Sara K.': { role: 'Mentoring', msgs: [
      { me: false, w: 'Nov 1, 16:20',
        t: 'Thanks for making time today. The part about cutting the brief down to one ' +
           'sentence was the bit I needed.' },
      { me: true, w: 'Nov 1, 17:05',
        t: 'That is usually the hard part. Try it on the next two and bring both.' },
      { me: false, w: 'Nov 2, 09:12', t: 'Will do. Same time in two weeks?' },
      { me: true, w: 'Nov 2, 09:40', t: 'Same time works. I will put it in the calendar.' },
      { me: false, w: 'Nov 2',
        t: 'Great to catch up today. Looking forward to the next session.' }
    ] },
    'Amiley W.': { role: 'Meditation', msgs: [
      { me: true, w: 'Nov 5, 12:00',
        t: 'Are you going to the Sunday morning session, or is that too early after the ' +
           'week you have had?' },
      { me: false, w: 'Nov 5, 12:26',
        t: 'Too early. There is a Wednesday evening one that is quieter anyway.' },
      { me: true, w: 'Nov 6, 08:30',
        t: 'Wednesday is better for me too. Shall we say the one after next?' },
      { me: false, w: 'Nov 6',
        t: 'Our plan is to meet in about a week, if that still works for you.' }
    ] },
    'Mark J.': { role: 'Pet Related', msgs: [
      { me: false, w: 'Nov 7, 18:44',
        t: 'I have to move the dog walk. Something came up at work and I cannot get out ' +
           'before seven.' },
      { me: true, w: 'Nov 7, 19:02',
        t: 'No problem. Seven is fine, or we push it to the weekend.' },
      { me: false, w: 'Nov 8', t: "It's okay, I'll plan it out then." }
    ] },
    'Jacob S.': { role: 'Events', msgs: [
      { me: true, w: 'Nov 8, 10:10',
        t: 'Three of the low-intensity ones filled up in a day. Is that normal here?' },
      { me: false, w: 'Nov 8, 10:33',
        t: 'It has been like that since the summer. People want something on a weeknight ' +
           'that is not the gym.' },
      { me: true, w: 'Nov 8, 10:41',
        t: 'Makes sense. I will add a second slot for the Thursday one.' },
      { me: false, w: 'Nov 8',
        t: 'This is indeed the events that people around here keep asking for.' }
    ] }
  };

  SCREENS.messages = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML =
      '<div class="kp-top">' +
      backBtn() +
      '<span class="kp-h2">Messages</span>' +
      '<span class="kp-top__acts">' + icon('plus') + '</span></div>' +
      '<div class="kp-search">' + icon('search', 'kp-ico--sm') +
      '<input type="text" placeholder="Search Messages" aria-label="Search messages"></div>';

    var list = el('div', 'kp-people');
    PEOPLE.forEach(function (p, i) {
      var row = el('button', 'kp-person' + (p[3] ? ' is-new' : ''));
      row.type = 'button';
      row.innerHTML =
        '<span class="kp-person__dot"></span>' +
        '<span class="kp-person__av" style="background:' + AV_TINTS[i] + '">' +
        p[0].charAt(0) + '</span>' +
        '<span class="kp-person__t"><span class="kp-person__w">' + p[2] + '</span>' +
        '<b>' + p[0] + '</b><small>' + p[1] + '</small></span>';
      row.addEventListener('click', function () { S.who = p[0]; goTo('message'); });
      list.appendChild(row);
    });
    s.appendChild(list);
    return { el: s, tab: null };
  };

  SCREENS.settings = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML =
      '<div class="kp-top">' +
      backBtn() +
      '<span class="kp-h2">Settings</span>' +
      '<span class="kp-top__acts" style="width:18px"></span></div>';
    var list = el('div', 'kp-set');
    /* By name, not by number. This row was go(13) — and deleting Step 2 moved
       profile from 13 to 12, so it had quietly stopped doing anything. Third
       time this exact bug has appeared in this file; a position is the one
       thing a flow is guaranteed to change. */
    [['pencil', 'Edit Profile', 'profile'],
     ['lock', 'Change Password', null],
     ['link', 'Social Account', null]].forEach(function (r) {
      var row = el('button', 'kp-set__row', icon(r[0]) + '<span>' + r[1] + '</span>');
      row.type = 'button';
      if (r[2]) row.addEventListener('click', function () { goTo(r[2]); });
      list.appendChild(row);
    });
    s.appendChild(list);
    return { el: s, tab: null };
  };

  SCREENS.topics = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML =
      '<div class="kp-steplab"><b>Step 1</b>' +
      '<span>Please tell us what activities you are interested in?</span></div>';

    var grid = el('div', 'kp-checks');
    TOPICS.forEach(function (t) {
      var b = el('button', 'kp-check', '<i></i><span>' + t[0] + '</span>');
      b.type = 'button';
      b.setAttribute('aria-pressed', S.topics[t[0]] ? 'true' : 'false');
      b.addEventListener('click', function () {
        S.topics[t[0]] = !S.topics[t[0]];
        b.setAttribute('aria-pressed', S.topics[t[0]] ? 'true' : 'false');
        if (!still()) {
          b.querySelector('i').animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }],
            { duration: ms('--d-3'), easing: tok('--e-spring') });
        }
        report();
      });
      grid.appendChild(b);
    });
    s.appendChild(grid);

    var type = el('div', 'kp-type');
    type.innerHTML = '<label>Let me type:</label>' +
      '<input type="text" aria-label="Another interest">';
    s.appendChild(type);

    var count = el('p', 'kp-sub');
    count.style.marginTop = '18px';
    s.appendChild(count);

    var next = el('button', 'kp-btn kp-cta', 'Next');
    next.type = 'button';
    next.addEventListener('click', function () { goTo('signin'); });
    s.appendChild(next);

    function report() {
      var n = TOPICS.filter(function (t) { return S.topics[t[0]]; }).length;
      count.textContent = n + (n === 1 ? ' activity picked' : ' activities picked');
      next.disabled = n === 0;
      next.style.opacity = n === 0 ? '.45' : '1';
    }
    report();
    return { el: s, tab: null };
  };

  SCREENS.signin = function () {
    var s = el('div', 'kp-screen kp-screen--flush');
    var w = el('div', 'kp-signin');
    w.innerHTML =
      '<h2>Sign In</h2>' +
      '<span class="kp-signin__av">' + icon('user') + '</span>' +
      '<span class="kp-signin__code"><i></i><i></i><i></i><i></i><i class="off"></i>' +
      '<i class="off"></i></span>' +
      '<span class="kp-signin__rule"></span>';
    var b = el('button', 'kp-signin__btn kp-cta', 'Sign in');
    b.type = 'button';
    b.addEventListener('click', function () { goTo('home'); });
    w.appendChild(b);
    w.appendChild(el('div', 'kp-signin__links',
      '<span>Forgot password?</span><span>Switch account</span>'));
    w.appendChild(el('p', 'kp-signin__note',
      'Mockup screen. Nothing is typed here and nothing is sent anywhere.'));
    s.appendChild(w);
    return { el: s, tab: null, dark: true };
  };

  SCREENS.home = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Hello, John!', 'menu') + monthStrip();
    dayStrip(s);

    var dh = el('p', 'kp-h2', 'Your Dashboard');
    dh.style.marginTop = '13px';
    s.appendChild(dh);
    s.appendChild(segment(['Reminder', 'Meeting', 'Event'], S.seg, function (i) {
      S.seg = i;
      if (i === 2) goTo('events');
    }));

    var dash = el('div', 'kp-dash');
    /* Three cards that all wore the same padlock: only the words told them
       apart, so the row read as one card printed three times. A call, a piece
       of design work and an application in progress are three different kinds
       of thing, and the icon is the fastest way to say which is which. */
    [
      ['Tara Gentile', 'Zoom Meeting', 'Next, 08:00', false, 'talk'],
      ['Project B', 'Graphic Design', 'Sep 24', false, 'bag'],
      ['Art Com Application', 'Work in Progress', 'Oct 03', true, 'cards']
    ].forEach(function (c, k) {
      var card = el('div', 'kp-dash__c' + (c[3] ? ' on' : ''),
        icon(c[4]) + '<b>' + c[0] + '</b><small>' + c[1] + '</small><hr><em>' +
        c[2] + '</em>');
      dash.appendChild(card);
      if (!still()) {
        card.animate([{ opacity: 0, transform: 'translateY(10px)' },
                      { opacity: 1, transform: 'none' }],
          { duration: 420, delay: k * 60, easing: tok('--e-out'), fill: 'both' });
      }
    });
    s.appendChild(dash);

    var head = el('div', 'kp-rowhead');
    head.innerHTML = '<span class="kp-h2">My Tasks</span>';
    var sw = el('div', 'kp-switch');
    ['Active', 'Finished'].forEach(function (t, i) {
      var b = el('button', null, t);
      b.type = 'button';
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        sw.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
        fill(i);
      });
      sw.appendChild(b);
    });
    head.appendChild(sw);
    s.appendChild(head);

    var list = el('div');
    s.appendChild(list);
    function fill(which) {
      list.innerHTML = '';
      var rows = which === 1
        ? [{ k: 'Done', t: 'Book the Thursday class', d: 'Sep 12', p: 100, i: 'checkc' }]
        : S.tasks;
      rows.forEach(function (t, i) {
        var r = taskRow(t);
        list.appendChild(r);
        if (!still()) {
          r.animate([{ opacity: 0, transform: 'translateY(10px)' },
                     { opacity: 1, transform: 'none' }],
            { duration: 420, delay: i * 60, easing: tok('--e-out'), fill: 'both' });
        }
      });
    }
    fill(0);
    return { el: s, tab: 'home' };
  };

  SCREENS.newtask = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('New Task', 'back');

    var f1 = el('div', 'kp-field');
    f1.innerHTML = '<label>Title</label>' +
      '<input type="text" value="Go shopping with Emma" aria-label="Title">';
    var f2 = el('div', 'kp-field');
    f2.innerHTML = '<label>Date</label>' +
      '<input type="text" value="Tuesday, 22 Sep" aria-label="Date">';
    var f3 = el('div', 'kp-field kp-row');
    f3.innerHTML =
      '<span><label>Start Time</label><input type="text" value="1 : 00  PM" aria-label="Start time"></span>' +
      '<span><label>End Time</label><input type="text" value="5 : 00  PM" aria-label="End time"></span>';
    var f4 = el('div', 'kp-field');
    f4.innerHTML = '<label>More Details</label>' +
      '<textarea rows="3" aria-label="More details">I made an appointment with Emma ' +
      'to meet at Square Plaza. We had lunch first and then went shopping nearby.</textarea>';
    s.appendChild(f1); s.appendChild(f2); s.appendChild(f3); s.appendChild(f4);

    var ch = el('div', 'kp-cathead');
    ch.innerHTML = '<span class="kp-h2" style="font-size:var(--kp-fs-5)">Category</span>';
    var pw = el('div', 'kp-switch');
    ['Private', 'Work'].forEach(function (t, i) {
      var b = el('button', null, t);
      b.type = 'button';
      b.setAttribute('aria-selected', i === S.priv ? 'true' : 'false');
      b.addEventListener('click', function () {
        S.priv = i;
        pw.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
      });
      pw.appendChild(b);
    });
    ch.appendChild(pw);
    s.appendChild(ch);

    var cats = el('div', 'kp-cats');
    CATS.forEach(function (c) {
      var b = el('button', 'kp-cat', c);
      b.type = 'button';
      b.setAttribute('aria-pressed', S.cats[c] ? 'true' : 'false');
      b.addEventListener('click', function () {
        S.cats[c] = !S.cats[c];
        b.setAttribute('aria-pressed', S.cats[c] ? 'true' : 'false');
      });
      cats.appendChild(b);
    });
    s.appendChild(cats);

    /* The wait stays inside the button that was pressed, the same pattern as
       experiment 03 on the lab index. */
    var btn = el('button', 'kp-btn kp-btn--grad', 'Create New Task');
    btn.type = 'button';
    btn.style.marginTop = '20px';
    var busy = false;
    btn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      btn.style.width = btn.offsetWidth + 'px';
      btn.innerHTML = '<svg class="kp-ico kp-spin" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-dasharray="44 56"/></svg>';
      btn.setAttribute('aria-busy', 'true');
      setTimeout(function () {
        btn.innerHTML = icon('check') + '<span>Added</span>';
        btn.removeAttribute('aria-busy');
        var picked = CATS.filter(function (c) { return S.cats[c]; });
        S.tasks.unshift({
          k: picked[0] || 'Task',
          t: f1.querySelector('input').value || 'Untitled',
          d: f2.querySelector('input').value.replace('Tuesday, ', ''),
          p: 0,
          i: 'plusc'
        });
        toast(S.priv === 0 ? 'Saved as Private. Only you can see it.' : 'Saved to Work.');
        setTimeout(function () { goTo('home'); }, 1000);
      }, 900);
    });
    s.appendChild(btn);
    return { el: s, tab: 'add' };
  };

  var EVENTS = [
    { id: 'e1', i: 'paw', t: 'Pet Party - Sep 26',
      x: 'Pet owners bring animals to the central animal park, pets can play together!',
      m: 'Today at 5:35 PM - Jamie Allendar', n: 12 },
    { id: 'e2', i: 'bowl', t: 'Look for Tasty! - TBD',
      x: 'People who like food are welcome to participate in this activity, all you ' +
         'need to do is recommend restaurants in the comment section.',
      m: 'Today at 6:25 PM - Angel Harlies', n: 32 },
    { id: 'e3', i: 'basket', t: 'Autumn Picnic - Oct 4',
      x: 'You are welcome to join us for a picnic at Midtown Park. Bring your own ' +
         'food, and we will be happy to share!',
      m: 'Yesterday 12:20 AM - Kate Auston', n: 18 }
  ];

  SCREENS.events = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Hello, John!', 'menu') + monthStrip();
    dayStrip(s);

    var dh = el('p', 'kp-h2', 'Your Dashboard');
    dh.style.marginTop = '13px';
    s.appendChild(dh);
    s.appendChild(segment(['Reminder', 'Meeting', 'Event'], 2, function (i) {
      if (i !== 2) { S.seg = i; goTo('home'); }
    }));

    var fh = el('div', 'kp-rowhead');
    fh.innerHTML = '<span class="kp-h2">Feature Activities</span>' +
      '<span class="kp-switch"><button type="button" aria-selected="true">Explore</button></span>';
    s.appendChild(fh);

    var feat = el('div', 'kp-feat');
    [['zen', 'Meditation', 'Low Intensity'],
     ['paw', 'Pet Related', 'Low Intensity'],
     ['peak', 'Hiking', 'High Intensity']].forEach(function (f, i) {
      var b = el('button', null,
        icon(f[0], 'kp-ico--lg') + '<span>' + f[1] + '</span><small>' + f[2] + '</small>');
      b.type = 'button';
      b.setAttribute('aria-pressed', i === 1 ? 'true' : 'false');
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed',
          b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      });
      feat.appendChild(b);
    });
    s.appendChild(feat);

    var ph = el('div', 'kp-rowhead');
    ph.innerHTML = '<span class="kp-h2">Popular Near You</span>' +
      '<span class="kp-switch"><button type="button" aria-selected="true">All</button>' +
      '<button type="button">Followed</button></span>';
    ph.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        ph.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
      });
    });
    s.appendChild(ph);

    EVENTS.forEach(function (e, idx) {
      var c = el('div', 'kp-card kp-ev');
      c.innerHTML =
        '<div class="kp-ev__top"><span class="kp-ev__ico">' + icon(e.i) + '</span>' +
        '<span><span class="kp-ev__t">' + e.t + '</span>' +
        '<span class="kp-ev__x">' + e.x + '</span>' +
        '<span class="kp-ev__m">' + e.m + '</span></span>' +
        (function () {
          var pct = Math.min(100, e.n * 2.4);
          return ring('<b class="kp-ev__n" style="color:' + ringColour(pct) + '">' +
                      (e.n + (S.joined[e.id] ? 1 : 0)) + '</b>', pct, RING_SIZE);
        })() + '</div>';

      var act = el('div', 'kp-ev__act');
      var like = el('button', null, icon('heart', 'kp-ico--sm'));
      like.type = 'button';
      like.setAttribute('aria-label', 'Like');
      like.setAttribute('aria-pressed', S.liked[e.id] ? 'true' : 'false');
      like.addEventListener('click', function () {
        S.liked[e.id] = !S.liked[e.id];
        like.setAttribute('aria-pressed', S.liked[e.id] ? 'true' : 'false');
        if (S.liked[e.id] && !still()) {
          like.querySelector('svg').animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
            { duration: ms('--d-3'), easing: tok('--e-spring') });
        }
      });
      var talk = el('button', null, icon('talk', 'kp-ico--sm') + '<span>4</span>');
      talk.type = 'button';
      var sh = el('button', null, icon('share', 'kp-ico--sm'));
      sh.type = 'button';
      sh.setAttribute('aria-label', 'Share');
      var join = el('button', 'kp-ev__join', S.joined[e.id] ? 'Going' : 'Join');
      join.type = 'button';
      join.setAttribute('aria-pressed', S.joined[e.id] ? 'true' : 'false');
      join.addEventListener('click', function () {
        S.joined[e.id] = !S.joined[e.id];
        join.setAttribute('aria-pressed', S.joined[e.id] ? 'true' : 'false');
        join.textContent = S.joined[e.id] ? 'Going' : 'Join';
        var n = c.querySelector('.kp-ev__n');
        n.textContent = e.n + (S.joined[e.id] ? 1 : 0);
        /* joining moves the number, so it moves the colour too */
        var pct2 = Math.min(100, (e.n + (S.joined[e.id] ? 1 : 0)) * 2.4);
        n.style.color = ringColour(pct2);
        var fg = c.querySelector('.kp-ring .fg');
        if (fg) fg.style.stroke = ringColour(pct2);
        if (S.joined[e.id]) toast('You are going. Nobody sees more than your avatar.');
      });
      act.appendChild(like); act.appendChild(talk); act.appendChild(sh); act.appendChild(join);
      c.appendChild(act);
      s.appendChild(c);

      if (!still()) {
        c.animate([{ opacity: 0, transform: 'translateY(12px)' },
                   { opacity: 1, transform: 'none' }],
          { duration: 420, delay: idx * 60, easing: tok('--e-out'), fill: 'both' });
      }
    });
    return { el: s, tab: 'events' };
  };

  SCREENS.reminder = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Reminder', 'menu') + monthStrip();
    dayStrip(s);

    var h = el('p', 'kp-h2', 'Your Dashboard');
    h.style.marginTop = '16px';
    s.appendChild(h);
    var h2 = el('p', 'kp-sub', 'Today’s Timeline');
    h2.style.marginTop = '4px';
    s.appendChild(h2);

    var tl = el('div', 'kp-tl');
    [
      { i: 'bag', t: 'Continuing work on project | UI Design', w: '26%', bar: 26 },
      { i: 'lock', t: 'Appointment with Julia', w: '03:30 PM', on: true },
      { i: 'talk', t: 'Zoom meeting for UI design class', w: '04:10 PM' },
      { i: 'bowl', t: 'Dining with Angelica', w: '08:00 PM' }
    ].forEach(function (r, i) {
      var it = el('div', 'kp-tl__i' + (r.on ? ' on' : ''));
      var card = el('div', 'kp-card');
      card.innerHTML =
        '<div class="kp-tl__row">' + icon(r.i, 'kp-ico--sm') +
        '<span class="kp-task__b"><span class="kp-task__t">' + r.t + '</span></span>' +
        '<span class="kp-tl__time">' + r.w + '</span></div>' +
        (r.bar ? '<span class="kp-tl__bar"><i style="width:' + r.bar + '%"></i></span>' : '');
      it.appendChild(card);
      tl.appendChild(it);
      if (!still()) {
        it.animate([{ opacity: 0, transform: 'translateX(10px)' },
                    { opacity: 1, transform: 'none' }],
          { duration: 420, delay: i * 60, easing: tok('--e-out'), fill: 'both' });
      }
    });
    s.appendChild(tl);

    var b = el('button', 'kp-btn kp-btn--ghost', 'Set Reminder');
    b.type = 'button';
    b.style.marginTop = '16px';
    b.addEventListener('click', function () { toast('Reminder set for 03:10 PM.'); });
    s.appendChild(b);
    return { el: s, tab: 'bell' };
  };

  SCREENS.calendar = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Calendar', 'menu');

    var cal = el('div', 'kp-cal');
    cal.innerHTML =
      '<div class="kp-cal__head">' +
      /* no size override: 16 was a one-off between the 13 of a section head
         and the 19 of a screen title, and 19/16 is too weak a step to read as
         a hierarchy anyway. The month is a sub-head under "Calendar", which
         is exactly what .kp-h2 is. */
      '<span class="kp-h2">September</span>' +
      '<span style="display:flex;gap:8px;color:var(--kp-ink-2)">' +
      icon('back', 'kp-ico--sm') + icon('next', 'kp-ico--sm') + '</span></div>';

    var grid = el('div', 'kp-cal__grid');
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (w) {
      grid.appendChild(el('span', 'kp-cal__w', w));
    });

    /* Year-free sample month: September begins on Tuesday in this demo. */
    var lead = 1, days = 30;
    /* Not a set of flags any more — a load per day, 0 to 100. The ring takes
       its colour from ringColour(), the same lerp the task rings and the
       charts use, so a cyan ring on the 8th and a deep blue one on the 16th
       are saying the same thing they would say anywhere else in the product:
       one thing on, versus a day that is full. */
    var busy = { 1: 55, 4: 88, 5: 90, 8: 22, 10: 68, 11: 86, 14: 20,
                 16: 92, 18: 26, 22: 84, 25: 80, 26: 90, 28: 76, 29: 66 };

    for (var i = 0; i < lead; i++) grid.appendChild(el('span', 'kp-cal__d out', '0'));
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var b = el('button', 'kp-cal__d' + (busy[d] ? ' has' : ''), String(d));
        b.type = 'button';
        if (busy[d]) {
          b.style.setProperty('--day', ringColour(busy[d]));
          b.setAttribute('aria-label', d + ' — ' + (busy[d] > 60 ? 'busy' : 'light'));
        }
        b.setAttribute('aria-pressed', d === S.day ? 'true' : 'false');
        b.addEventListener('click', function () {
          S.day = d;
          grid.querySelectorAll('.kp-cal__d').forEach(function (x) {
            x.setAttribute('aria-pressed', x.textContent === String(d) ? 'true' : 'false');
          });
        });
        grid.appendChild(b);
      })(d);
    }
    cal.appendChild(grid);
    s.appendChild(cal);

    /* The day's list, as pills. The fourth number on each row is its load on
       the same 0-100 the calendar rings use, so the bead beside a row and the
       ring around its day are the same colour for the same reason. The first
       row is the one you are on: heavy edge, its own colour in the type. */
    var tl = el('div', 'kp-tl kp-tl--cal');
    [['user', 'Appointment with Julie', '03:30 PM', 88, 1],
     ['talk', 'Zoom meeting for UI design class', '04:10 PM', 72, 0],
     ['bowl', 'Dining with Angelica', '06:00 PM', 22, 0]].forEach(function (r) {
      var it = el('div', 'kp-tl__i' + (r[4] ? ' is-now' : ''));
      it.style.setProperty('--dot', ringColour(r[3]));
      it.innerHTML = '<span class="kp-tl__dot"></span>' +
        '<div class="kp-tl__pill">' + icon(r[0], 'kp-ico--sm') +
        '<span class="kp-tl__t">' + r[1] + '</span>' +
        '<span class="kp-tl__time">' + r[2] + '</span></div>';
      tl.appendChild(it);
    });
    s.appendChild(tl);
    return { el: s, tab: 'events' };
  };

  SCREENS.stats = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Statistics', 'menu');

    /* The ring prints the total and fills by the share that is done, so the
       number and the arc cannot disagree — and it is coloured by that share
       on the same cyan-to-blue ramp as every other ring and every bar in the
       product. These two were the last things still painted a flat brand
       blue, which made them the only place where the colour meant nothing. */
    [[18, 4, 12, 2], [37, 12, 16, 9]].forEach(function (d, k) {
      var total = d[0], todo = d[1], done = d[2], left = d[3];
      var pct = Math.round(done / total * 100);
      var r = 31, c = 2 * Math.PI * r;
      /* Her layout: the ring alone in a white card with the title centred
         over it, and the three readings OUTSIDE the card as one tall bar
         down the right — not three pills floating inside it. The bar is a
         single block with two hairlines across it, which is what makes the
         three read as one set rather than three cards. */
      var card = el('div', 'kp-wstat');
      card.style.marginTop = k ? '10px' : '14px';
      card.innerHTML =
        '<div class="kp-card kp-wstat__card">' +
        '<span class="kp-wstat__t">Weekly Stats</span>' +
        '<div class="kp-bigring"><svg viewBox="0 0 74 74" aria-hidden="true">' +
        '<defs><linearGradient id="kpb' + k + '" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + fillStart(pct) + '"/>' +
        '<stop offset="1" stop-color="' + ringColour(pct) + '"/></linearGradient></defs>' +
        '<circle class="bg" cx="37" cy="37" r="' + r + '"/>' +
        '<circle class="fg" cx="37" cy="37" r="' + r +
        '" style="stroke:url(#kpb' + k + ')" stroke-dasharray="' +
        c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '"/></svg>' +
        '<b>' + total + '</b></div></div>' +
        '<div class="kp-wstat__bar">' +
        '<span><b>' + todo + '</b><small>To do</small></span>' +
        '<span><b>' + done + '</b><small>Done</small></span>' +
        '<span><b>' + left + '</b><small>Left</small></span>' +
        '</div>';
      s.appendChild(card);

      var fg = card.querySelector('.fg');
      if (still()) fg.setAttribute('stroke-dashoffset', (c * (1 - pct / 100)).toFixed(1));
      else {
        fg.animate([{ strokeDashoffset: c }, { strokeDashoffset: c * (1 - pct / 100) }],
          { duration: ms('--d-5'), delay: k * 120, easing: tok('--e-out'), fill: 'both' });
      }
    });

    var act = el('div', 'kp-card');
    act.style.marginTop = '10px';
    var ah = el('div', 'kp-rowhead');
    ah.style.marginTop = '0';
    ah.innerHTML = '<span class="kp-lab">Activity</span>';
    var sw = el('div', 'kp-switch');
    ['Week', 'Month', 'Year'].forEach(function (t, i) {
      var b = el('button', null, t);
      b.type = 'button';
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        sw.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
        draw(i);
      });
      sw.appendChild(b);
    });
    ah.appendChild(sw);
    act.appendChild(ah);

    var bars = el('div', 'kp-bars');
    act.appendChild(bars);
    s.appendChild(act);

    /* Week zig-zags on purpose — seven days compared against each other is
       what a bar chart is for. Month and Year are drawn as curves, and a curve
       through readings that jump every step is a scribble, not a shape: the
       old Month set went 52-44-71-38-66-81-59 and the spline dutifully drew
       every one of those reversals. These two rise, crest and settle. */
    var SETS = [[40, 62, 30, 78, 55, 90, 48],
                [30, 48, 76, 90, 72, 46, 58],
                [34, 41, 58, 75, 68, 84, 72]];
    /* Every bar has a pale track the full height of the chart and a fill that
       stands in it. Before, a bar WAS its value — a short day was a short
       stub with nothing around it, so the chart read as seven unrelated
       marks instead of seven readings off the same scale. The track is the
       scale, drawn.

       The fill takes its colour from the same ramp the rings use, so a number
       means the same thing wherever it appears in this product: pale cyan
       when there is little of it, brand blue when there is a lot. Her board
       does exactly this — Tuesday and Sunday are cyan, Wednesday and Saturday
       are deep blue — and it is the reason the chart can be read without
       looking at the axis. */
    /* Month and Year draw a line instead of bars — which is what her recording
       does, and what the switch is for: a week has seven readings you compare
       one against another, a year has a shape. Bars for the first, a curve
       for the second.

       The curve is a Catmull-Rom spline converted to cubics, so it passes
       through every point rather than near it; under it is the same ramp the
       bars use, fading out downward. */
    function linePath(vals, w, h, pad) {
      /* A 1-2-1 pass over the readings before anything is drawn. The kinks in
         a spline are not the spline's fault: they are the data's corners, and
         the curve is obliged to go round every one of them. Smoothing the
         readings themselves is what makes the line flow, and the dots move
         with them so the curve still passes through every dot — the two can
         never disagree, which is the part that would have been dishonest. */
      vals = vals.map(function (v, i, a) {
        var l = a[i - 1] === undefined ? v : a[i - 1];
        var r = a[i + 1] === undefined ? v : a[i + 1];
        return (l + v * 2 + r) / 4;
      });
      var n = vals.length, top = Math.max.apply(null, vals);
      var pts = vals.map(function (v, i) {
        return [pad + (w - pad * 2) * (i / (n - 1)),
                h - pad - (h - pad * 2) * (v / top)];
      });

      /* The line does not begin and end at a dot: it carries on past both,
         off the sides of the card. Her chart does this and it is the whole
         difference between "a curve" and "a window onto a curve" — a line
         that stops dead at its first reading looks like the data starts
         there. Two points are extrapolated along the end slopes to draw
         through; no dot is put on them. */
      var run = [];
      var f = pts[0], f2 = pts[1], l = pts[n - 1], l2 = pts[n - 2];
      run.push([f[0] - (f2[0] - f[0]) * 0.75, f[1] - (f2[1] - f[1]) * 0.45]);
      run = run.concat(pts);
      run.push([l[0] + (l[0] - l2[0]) * 0.75, l[1] + (l[1] - l2[1]) * 0.45]);

      var d = 'M' + run[0][0].toFixed(1) + ' ' + run[0][1].toFixed(1);
      for (var i = 0; i < run.length - 1; i++) {
        var p0 = run[i - 1] || run[i], p1 = run[i], p2 = run[i + 1],
            p3 = run[i + 2] || run[i + 1];
        /* 3.9 rather than the textbook 6: longer handles, so each segment
           leaves and arrives along the direction of the whole shape instead
           of straightening out in the middle and turning at the dot. The data
           is smooth enough now that the overshoot this would normally risk
           never happens. */
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 3.9).toFixed(1) + ' ' +
                   (p1[1] + (p2[1] - p0[1]) / 3.9).toFixed(1) + ' ' +
                   (p2[0] - (p3[0] - p1[0]) / 3.9).toFixed(1) + ' ' +
                   (p2[1] - (p3[1] - p1[1]) / 3.9).toFixed(1) + ' ' +
                   p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return { d: d, pts: pts, run: run };
    }

    function drawLine(vals) {
      var W = 260, H = 104, PAD = 14;
      var L = linePath(vals, W, H, PAD);
      /* the wash under it closes on the EXTENDED ends, so it reaches the sides
         with the line rather than stopping under the first dot */
      var r0 = L.run[0], rN = L.run[L.run.length - 1];
      var area = L.d + 'L' + rN[0].toFixed(1) + ' ' + (H - 2) +
                 'L' + r0[0].toFixed(1) + ' ' + (H - 2) + 'Z';

      /* The curve is not one colour. A stop is planted at each reading, in the
         colour that reading is worth, so the line runs cyan where the week was
         quiet and deep blue where it was busy — the same rule the bars follow,
         read along the x axis instead of up the y. A flat blue curve would be
         the one chart in the product where the colour said nothing. */
      var peak = Math.max.apply(null, vals);
      var stops = vals.map(function (v, i) {
        return '<stop offset="' + (i / (vals.length - 1) * 100).toFixed(1) +
               '%" stop-color="' + ringColour(chartTone(v, peak)) + '"/>';
      }).join('');
      var dots = L.pts.map(function (p, i) {
        return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
               '" r="3.1" class="kp-line__d" style="stroke:' +
               ringColour(chartTone(vals[i], peak)) + '"/>';
      }).join('');

      bars.innerHTML =
        '<svg class="kp-line" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
        '<defs>' +
        '<linearGradient id="kplinep" x1="0" y1="0" x2="1" y2="0">' + stops +
        '</linearGradient>' +
        /* the ground under it keeps the same horizontal ramp and fades out
           downward, so the wash agrees with the line above it */
        '<linearGradient id="kpline" x1="0" y1="0" x2="1" y2="0">' +
        vals.map(function (v, i) {
          return '<stop offset="' + (i / (vals.length - 1) * 100).toFixed(1) +
                 '%" stop-color="' + ringColour(chartTone(v, peak)) +
                 '" stop-opacity=".2"/>';
        }).join('') +
        '</linearGradient>' +
        '<linearGradient id="kpfade" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff" stop-opacity="1"/>' +
        '<stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<mask id="kpmask"><rect width="' + W + '" height="' + H +
        '" fill="url(#kpfade)"/></mask>' +
        '</defs>' +
        '<path class="kp-line__a" d="' + area + '" mask="url(#kpmask)"/>' +
        '<path class="kp-line__p" d="' + L.d + '"/>' + dots + '</svg>';
    }

    function draw(which) {
      bars.innerHTML = '';
      var peak = Math.max.apply(null, SETS[which]);
      if (which > 0) {
        bars.className = 'kp-bars kp-bars--line';
        drawLine(SETS[which]);
        var days = el('div', 'kp-days7');
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) {
          days.appendChild(el('small', null, d));
        });
        bars.appendChild(days);
        return;
      }
      bars.className = 'kp-bars';
      SETS[which].forEach(function (v, i) {
        var col = el('div');
        var track = el('span', 'kp-bar');
        var bar = el('i');
        bar.style.backgroundImage = fillGrad('to top', chartTone(v, peak));
        bar.style.height = still() ? v + '%' : '0%';
        track.appendChild(bar);
        col.appendChild(track);
        col.appendChild(el('small', null, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]));
        bars.appendChild(col);
        if (!still()) {
          requestAnimationFrame(function () {
            bar.style.transition = 'height ' + ms('--d-5') + 'ms ' + tok('--e-out') +
                                   ' ' + (i * 45) + 'ms';
            bar.style.height = v + '%';
          });
          /* rAF does not run while the tab is not drawing, and a bar that
             never got its frame would sit at zero for ever */
          setTimeout(function () { bar.style.height = v + '%'; },
                     ms('--d-5') + i * 45 + 260);
        }
      });
    }
    draw(0);

    /* Records: the three long-running counts from her demo. The bar is the
       same device as the chart — one ramp, pinned to the track, each row
       showing the part it has reached — and the percentage is printed in the
       colour its own value earns, so the number and the bar agree. */
    var rh = el('div', 'kp-rowhead');
    rh.innerHTML = '<span class="kp-lab">Records</span>';
    s.appendChild(rh);

    [['Participate in 100 activities', 23],
     ['Follow 50 people', 56],
     ['Complete 100 tasks', 92]].forEach(function (r, i) {
      var card = el('div', 'kp-card kp-rec');
      card.innerHTML =
        '<span class="kp-rec__ico">' + icon('doc') + '</span>' +
        '<span class="kp-rec__b"><b>' + r[0] + '</b>' +
        '<span class="kp-rec__bar"><i style="width:' +
        (still() ? r[1] : 0) + '%;background-image:' + fillGrad('to right', r[1]) +
        '"></i></span></span>' +
        '<span class="kp-rec__p" style="color:' + ringColour(r[1]) + '">' +
        r[1] + '%</span>';
      s.appendChild(card);
      var fill = card.querySelector('.kp-rec__bar i');
      if (!still()) {
        requestAnimationFrame(function () {
          fill.style.transition = 'width ' + ms('--d-5') + 'ms ' + tok('--e-out') +
                                  ' ' + (i * 70) + 'ms';
          fill.style.width = r[1] + '%';
        });
        setTimeout(function () { fill.style.width = r[1] + '%'; },
                   ms('--d-5') + i * 70 + 260);
      }
    });

    return { el: s, tab: 'chart' };
  };

  SCREENS.message = function () {
    var s = el('div', 'kp-screen kp-screen--chat');
    var who = THREADS[S.who] ? S.who : 'Julie L.';
    var th = THREADS[who];
    var avI = Object.keys(THREADS).indexOf(who);

    s.innerHTML =
      '<div class="kp-top"><span style="display:flex;align-items:center;gap:10px">' +
      backBtn() +
      '<span class="kp-person__av" style="width:32px;height:32px;' +
      'background:' + AV_TINTS[avI < 0 ? 0 : avI] + '">' + who.charAt(0) + '</span>' +
      '<span><span class="kp-h2">' + who + '</span>' +
      '<span class="kp-task__d">' + th.role + '</span></span></span>' +
      '<span class="kp-top__acts">' + icon('dots') + '</span></div>';

    /* The timestamp used to live inside the bubble, which made the bubble a
       little card with a caption in it. In her reference it sits under the
       bubble, on the bubble's own side, in the page's grey — the bubble is
       just the words, and the time is the page talking about them. */

    /* --- gradient is history, solid is now -----------------------------
       Everything already in the thread wears the product's gradient, white
       text (she, after trying flat colours down the whole conversation and
       rejecting it: "旧 message 还是做渐变，文字白色"). Whatever gets typed
       in THIS sitting is solid brand blue instead — one flat colour for the
       thing you just did, the same texture as everywhere else for the things
       that are already settled.

       The corner the tail sits in is near enough the gradient's own far stop
       (152deg runs blue at 0% to cyan at 100%, and the tail is bottom-right)
       that a solid cyan foot reads as the gradient continuing rather than a
       colour taped on. */
    var box = el('div', 'kp-msgs');    /* --- the thread's own ramp (scheme 01, approved) ----------------------
       Every bubble you sent carries its OWN gradient, and where that gradient
       sits on the cyan-to-brand lerp is decided by the message's place in the
       conversation: the oldest thing you said is cyan, the newest is brand
       blue. 152deg, the same angle as the mark and the Sign In screen, and
       each one spreads only 0.12 either side of its own point — so a bubble
       is a short segment of the ramp rather than the whole of it.

       The tail takes the far stop of its own bubble's gradient, which is the
       colour the gradient has reached at the corner the tail grows from.

       Sending re-spreads the whole thread: two bubbles become three and the
       middle one interpolates. The newest is always the deep end, which is
       what makes a just-sent message read as new without a separate rule. */
    var TH_LO = [0, 182, 212];        /* --kp-cyan  */
    var TH_HI = [11, 95, 208];        /* --kp-brand */
    function thShift(t, d) {
      var f = Math.max(0, Math.min(1, t + d));
      return hexOf([0, 1, 2].map(function (j) {
        return TH_LO[j] + (TH_HI[j] - TH_LO[j]) * f;
      }));
    }
    function paintThread() {
      var mine = [].slice.call(box.querySelectorAll('.kp-msg--me'));
      mine.forEach(function (b, i) {
        var t = mine.length > 1 ? i / (mine.length - 1) : 1;
        b.style.setProperty('--g', 'linear-gradient(152deg, ' +
          thShift(t, -0.12) + ' 0%, ' + thShift(t, 0.12) + ' 100%)');
        b.style.setProperty('--foot', thShift(t, 0.12));
      });
    }

    var box = el('div', 'kp-msgs');
    function render() {
      box.innerHTML = '';
      th.msgs.forEach(function (m) {
        var row = el('div', 'kp-msgrow' + (m.me ? ' kp-msgrow--me' : ''));
        /* no is-new class any more: the ramp says it. A just-sent message is
           the newest, so it lands on the deep end by construction. */
        row.innerHTML = '<div class="kp-msg' + (m.me ? ' kp-msg--me' : '') +
          '">' + m.t + '</div><small>' + m.w + '</small>';
        box.appendChild(row);
      });
      paintThread();
    }
    render();
    s.appendChild(box);

    var comp = el('div', 'kp-compose');
    comp.innerHTML = '<span class="kp-clip">' + icon('clip', 'kp-ico--sm') + '</span>' +
      '<input type="text" placeholder="Write your message..." aria-label="Message">';
    /* A paper plane at 14px is four strokes that read as a smudge. The
       reference uses one arrow in a disc, and that is all a send button has
       ever needed to be (she: "简化发送按键"). */
    var send = el('button', 'kp-send', icon('next', 'kp-ico--sm'));
    send.type = 'button';
    send.setAttribute('aria-label', 'Send');
    comp.appendChild(send);
    function push() {
      var i = comp.querySelector('input');
      var v = i.value.trim();
      if (!v) return;
      th.msgs.push({ me: true, t: v, w: 'Now' });
      i.value = '';
      render();
      var last = box.lastElementChild;
      if (!still()) {
        last.animate([{ opacity: 0, transform: 'translateY(10px) scale(.96)' },
                      { opacity: 1, transform: 'none' }],
          { duration: ms('--d-4'), easing: tok('--e-out') });
      }
      box.scrollTop = box.scrollHeight;
    }
    send.addEventListener('click', push);
    comp.querySelector('input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); push(); }
    });
    s.appendChild(comp);
    return { el: s, tab: null };
  };

  SCREENS.profile = function () {
    var s = el('div', 'kp-screen');
    s.innerHTML = topbar('Edit Profile', 'back') +
      '<div class="kp-avatar">' + icon('user', 'kp-ico--lg') + '</div>' +
      '<div class="kp-upload">' + icon('upload', 'kp-ico--sm') + '</div>';

    /* A screen called Edit Profile where the fields could not be edited: the
       rows were plain text and the only thing that answered a tap was the
       eye on the far right, so pressing "Email" did nothing at all. Each
       field is now a button that opens its own value for editing. Enter or
       leaving the field keeps the change, Escape puts the old one back, and
       the eye still only decides who can see it. A hidden field unblurs
       while you are editing it: it is hidden from other people, not from
       its owner. */
    var rows = [
      ['name', 'Full Name', 'text'],
      ['country', 'Country', 'text'],
      ['email', 'Email', 'email']
    ];
    function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    var wrap = el('div');
    wrap.style.marginTop = '14px';
    rows.forEach(function (r) {
      var key = r[0], label = r[1];
      var row = el('div', 'kp-prow' + (S.hidden[key] ? ' hid' : ''));
      var field = el('button', 'kp-prow__b');
      field.type = 'button';
      field.setAttribute('aria-label', 'Edit ' + label);
      field.innerHTML = '<span class="kp-prow__k">' + label +
        '</span><span class="kp-prow__v">' + S.profile[key] + '</span>';
      row.appendChild(field);

      function open() {
        if (row.classList.contains('editing')) return;
        row.classList.add('editing');
        /* An input cannot live inside the button, so the button steps aside
           for an editor that keeps the same label above the same spot: the
           row does not jump, only the value turns into a place to type. */
        var editor = el('div', 'kp-prow__b kp-prow__edit',
          '<span class="kp-prow__k">' + label + '</span>');
        var input = el('input', 'kp-prow__in');
        input.type = r[2];
        input.value = S.profile[key];
        input.setAttribute('aria-label', label);
        input.autocomplete = 'off';
        editor.appendChild(input);
        field.style.display = 'none';
        row.insertBefore(editor, eye);
        input.focus();
        input.select();

        var done = false;
        function close(keep) {
          if (done) return;
          var v = input.value.trim();
          if (keep && v === S.profile[key]) keep = false;
          if (keep && !v) { toast(label + ' can\'t be empty.'); input.focus(); return; }
          if (keep && key === 'email' && !looksLikeEmail(v)) {
            toast('That doesn\'t look like an email address.');
            input.focus();
            return;
          }
          done = true;
          if (keep) {
            S.profile[key] = v;
            field.querySelector('.kp-prow__v').textContent = v;
            toast(label + ' updated.');
          }
          editor.remove();
          field.style.display = '';
          row.classList.remove('editing');
          field.focus();
        }
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); close(true); }
          else if (e.key === 'Escape') { e.preventDefault(); close(false); }
        });
        input.addEventListener('blur', function () { close(true); });
      }
      field.addEventListener('click', open);

      var eye = el('button', 'kp-eye', icon(S.hidden[key] ? 'eyeoff' : 'eye', 'kp-ico--sm'));
      eye.type = 'button';
      eye.setAttribute('aria-label', (S.hidden[key] ? 'Show ' : 'Hide ') + label);
      /* mousedown, not just click: pressing the eye while a field is open
         would otherwise blur the input first and commit a half-typed value */
      eye.addEventListener('mousedown', function (e) { e.preventDefault(); });
      eye.addEventListener('click', function () {
        S.hidden[key] = !S.hidden[key];
        row.classList.toggle('hid', !!S.hidden[key]);
        eye.innerHTML = icon(S.hidden[key] ? 'eyeoff' : 'eye', 'kp-ico--sm');
        eye.setAttribute('aria-label', (S.hidden[key] ? 'Show ' : 'Hide ') + label);
        toast(S.hidden[key] ? label + ' is hidden from everyone.' : label + ' is visible.');
      });
      row.appendChild(eye);
      wrap.appendChild(row);
    });
    s.appendChild(wrap);

    s.appendChild(el('div', 'kp-note', icon('lock', 'kp-ico--sm') +
      '<span>Hidden fields are hidden from everyone, including people in events you ' +
      'join. Joining never reveals more than your avatar.</span>'));

    var b = el('button', 'kp-btn kp-btn--grad', icon('checkc') + '<span>Save Changes</span>');
    b.type = 'button';
    b.style.marginTop = '16px';
    b.addEventListener('click', function () { toast('Saved.'); });
    s.appendChild(b);
    return { el: s, tab: 'profile' };
  };

  /* --------------------------------------------------------------------- */
  /* The flow                                                               */
  /* --------------------------------------------------------------------- */

  var FLOW = [
    ['welcome',  'Welcome',      'An introduction to the purpose of the app before asking the person to continue.'],
    ['topics',   'Step 1',       'Choose interests to express what you enjoy. Feed personalisation is a proposed next step.'],
    ['signin',   'Sign In',      'The one full-bleed screen. The gradient is the brand at its loudest, used once.'],
    ['home',     'Home',         'Dashboard cards, the Reminder / Meeting / Event switch, then My Tasks.'],
    ['newtask',  'New Task',     'Capture one manageable task. Waiting and confirmation stay inside the button.'],
    ['events',   'Events',       'Feature Activities with intensity, then Popular Near You.'],
    ['reminder', 'Reminder',     'A timeline. One item is live, the rest stay quiet.'],
    ['calendar', 'Calendar',     'A sample September: see the day at a glance, then inspect its plans.'],
    ['stats',    'Statistics',   'The ring prints the total, the arc is the share done. No streak to break.'],
    ['messages', 'Messages',     'Six threads. The unread one is the only thing with colour on it.'],
    ['message',  'Message',      'Where an event turns into a plan with one person.'],
    ['settings', 'Settings',     'Three rows. A settings screen that fits on one screen is a decision.'],
    ['profile',  'Edit Profile', 'Choose which personal fields to hide. The demo illustrates control over disclosure.']
  ];

  var TABS = [
    ['home', 'home', 'Home'], ['bell', 'bell', 'Alerts'], ['add', 'plus', ''],
    ['events', 'cal', 'Events'], ['chart', 'chart', 'Stats']
  ];
  /* Names, not positions — the same fix the jumps got, on the one table that
     was missed. Under the fourteen-screen flow every one of these numbers had
     come to mean a different screen: home pointed at Sign In, which is what
     she hit, and the other four were off by one or two as well. */
  /* The Events tab opens the Calendar (she: "events 页面应该这样", with the
     month grid). It used to open Feature Activities, which is why its icon
     had drifted into looking like a card — it was not a calendar tab yet.
     Feature Activities is still there, as step 7 of the flow; it just is not
     what this tab is for. */
  var TABGO = {
    home: 'home', bell: 'reminder', add: 'newtask',
    events: 'calendar', chart: 'stats'
  };

  var view, tabsEl, phoneEl, stepsEl, prevBtn, nextBtn, lineEl, backEl, barEl, at = -1;

  /* --- screens are addressed by name -------------------------------------
     Every jump in here used to be a number. Inserting Step 2 into FLOW pushed
     ten screens down one, and four of those numbers quietly started meaning a
     different screen — Sign In's meant itself, so pressing it did nothing at
     all, because go() returns early when you are already there.

     A number is a position, and positions are exactly what a flow changes. */
  function idx(name) {
    for (var i = 0; i < FLOW.length; i++) if (FLOW[i][0] === name) return i;
    return -1;
  }
  function goTo(name) {
    var i = idx(name);
    if (i >= 0) go(i);
  }

  var HOME_AT = idx('home');

  /* The line down the numbers is measured, not tiled. A repeating tile drifts
     against the rows, and the row you are on is taller than the others, so it
     drifted differently every time you moved and ended up crossing the
     circles. This one runs from the middle of the first number to the middle
     of the last, and nowhere else. */
  function placeLine() {
    if (!lineEl || !stepsEl || !stepsEl.length) return;
    var list = lineEl.parentNode;
    var first = stepsEl[0].querySelector('.flow__n');
    var last = stepsEl[stepsEl.length - 1].querySelector('.flow__n');
    if (!first || !last) return;
    var box = list.getBoundingClientRect();
    var a = first.getBoundingClientRect();
    var b = last.getBoundingClientRect();
    if (!box.height) return;
    var top = (a.top - box.top) + a.height / 2;
    lineEl.style.left = ((a.left - box.left) + a.width / 2) + 'px';
    lineEl.style.top = top + 'px';
    lineEl.style.height = Math.max(0, (b.top - box.top) + b.height / 2 - top) + 'px';
  }

  function buildTabs(active) {
    tabsEl.innerHTML = '';
    TABS.forEach(function (t) {
      var b = el('button', 'kp-tab' + (t[0] === 'add' ? ' kp-tab--add' : ''),
        icon(t[1]) + (t[2] ? '<span>' + t[2] + '</span>' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', t[2] || 'New task');
      if (t[0] === active) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', function () { goTo(TABGO[t[0]]); });
      tabsEl.appendChild(b);
    });
  }

  /* --- the rail is coloured like everything else in the device ------------
     Inside the phone, a fill's colour is how much of something there is. The
     rail outside it is the same idea one level up: how far through the flow
     you are. So it runs the product's own ramp — cyan at the start, brand
     blue at the end — as one continuous lerp rather than a set of stops.

     Steps you have not reached keep their outline and no fill at all: the
     ramp is a record of where you have been, not a decoration on the list. */
  function lum(hex) {
    var h = hex.trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function rgbFromHex(c) {
    var h = String(c).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    var n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }

  function hexOf(a) {
    return '#' + a.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }).join('');
  }

  function paintRail() {
    if (!stepsEl || !stepsEl.length) return;
    var n = stepsEl.length;
    /* The rail is one continuous lerp between the two ends the palette on
       this chapter actually prints — Cyan --kp-cyan and Brand --kp-brand.
       Six discrete stops down a column of fourteen read as six decisions; one
       lerp reads as one gradient, which is what the rail is saying.

       Both ends are read off .kp at runtime rather than typed in, so the rail
       cannot drift from the swatches two pages earlier, and step 1 is exactly
       the cyan on the card (she: "确保 1 是左边这个 cyan 色"). Nothing is
       darkened to make room for the numeral any more — the colour is the
       thing being specified, so the NUMERAL moves instead. */
    var kp = document.querySelector('.kp');
    var kpTok = function (name, fallback) {
      var v = kp ? getComputedStyle(kp).getPropertyValue(name).trim() : '';
      return rgbFromHex(v) || fallback;
    };
    var RAIL_LO = kpTok('--kp-cyan',  [0, 182, 212]);    /* #00b6d4 Cyan  */
    var RAIL_HI = kpTok('--kp-brand', [11, 95, 208]);    /* #0b5fd0 Brand */
    stepsEl.forEach(function (b, i) {
      var t = n > 1 ? i / (n - 1) : 0;
      var dot = b.querySelector('.flow__n');
      if (!dot) return;
      var c = [0, 1, 2].map(function (j) {
        return RAIL_LO[j] + (RAIL_HI[j] - RAIL_LO[j]) * t;
      });
      /* White on every filled step, asked for twice (她："点击后都做白色字"),
         and the two ends are exactly the two swatches — so nothing is nudged
         and nothing is darkened. The ramp is the pure lerp.

         Stated once and then left alone: white on #00b6d4 measures 2.4:1, so
         the first third of the rail is under the 4.5 floor for small text.
         The numerals are decoration on a list whose labels sit beside them in
         full-contrast ink, which is why this is hers to call. */
      dot.style.setProperty('--tone', hexOf(c));
      dot.style.setProperty('--tone-ink', '#fff');
    });
  }

  /* Where a screen's own back arrow goes.

     It used to be go(at - 1) — one position back in the flow. That is right
     for the Back button under the rail, which walks the flow, and wrong for
     an arrow inside the product, where "back" means the screen you came FROM.
     Messages sits at 10, so its arrow landed on Statistics however you got
     there, and now that the menu mark opens Messages from anywhere, that is
     most of the time. So the device keeps a stack, and its back arrows pop it. */
  var hist = [];
  function goBack() {
    if (hist.length) go(hist.pop(), true);
    else go(at - 1, true);
  }

  function go(i, popping) {
    if (i < 0 || i >= FLOW.length || i === at) return;
    if (!popping && at >= 0) hist.push(at);
    var back = i < at;
    /* The visible screen is the last one. Anything still behind it is a
       leftover whose exit never finished, so it goes now. */
    var olds = [].slice.call(view.querySelectorAll('.kp-screen'));
    var prev = olds.pop() || null;
    olds.forEach(function (n) { n.remove(); });
    var built = SCREENS[FLOW[i][0]]();
    at = i;

    view.appendChild(built.el);
    watchScroll(scrollerOf(built.el));

    /* Any screen that draws its own back arrow is a sheet, and every sheet
       starts at the same height (she: "返回按键保留在一个地方"). Setting it
       here rather than on each screen means a new sheet cannot forget. */
    if (built.el.querySelector('.kp-top .kp-back')) {
      built.el.classList.add('kp-screen--sheet');
    }

    /* whichever back arrow this screen has, it goes back */
    var own = built.el.querySelectorAll('.kp-back');
    own.forEach(function (b) {
      b.addEventListener('click', goBack);
    });
    /* The floating one belongs to the run-in and stops at Home. Before Home
       you are being walked through something and can want out of it; from
       Home on you are inside the product, where the five screens that need a
       back arrow draw their own and the rest are tabs — a tab bar with a back
       button over it is two navigation models arguing. */
    var runIn = i > 0 && i < HOME_AT;
    if (backEl) backEl.hidden = !runIn || own.length > 0;
    phoneEl.classList.toggle('has-back', !!backEl && !backEl.hidden);
    /* Home onward is the product, and the product's screens are lists that
       run past the bottom. The run-in's four are compositions that fit. */
    phoneEl.classList.toggle('in-app', i >= HOME_AT);
    tabsEl.style.display = built.tab ? '' : 'none';
    phoneEl.classList.toggle('is-dark', !!built.dark);
    if (built.tab) {
      buildTabs(built.tab === 'profile' || built.tab === 'cal' ? '' : built.tab);
    }
    /* the whole document, not just the new screen: the tab bar is rebuilt
       outside it and the toast arrives later still. Already-fitted icons cost
       one property read each. */
    fitIcons();

    if (!still()) {
      var d = ms('--d-4'), e = tok('--e-out');
      built.el.animate([
        { opacity: 0, transform: 'translateX(' + (back ? -16 : 16) + 'px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: d, easing: e, fill: 'both' });
      if (prev) {
        var gone = function () { if (prev.isConnected) prev.remove(); };
        prev.animate([
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateX(' + (back ? 14 : -14) + 'px)' }
        ], { duration: ms('--d-3'), easing: tok('--e-standard'), fill: 'both' })
          .onfinish = gone;
        /* A tab that never gets a frame never fires onfinish. */
        setTimeout(gone, ms('--d-3') + 400);
      }
    } else if (prev) { prev.remove(); }

    stepsEl.forEach(function (b, k) {
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', k < i);
    });
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === FLOW.length - 1;
    var t = document.querySelector('.kp-phone .kp-toast');
    if (t) t.remove();
    /* the open row changes the heights, so the line is measured again */
    requestAnimationFrame(placeLine);
    setTimeout(placeLine, ms('--d-3') + 60);
  }

  function build() {
    var host = document.getElementById('kp');
    if (!host) return;

    var flow = el('div', 'flow');
    flow.innerHTML = '<div class="flow__head"><span>User flow</span>' +
      '<span>' + FLOW.length + ' screens</span></div>';
    var list = el('ul', 'flow__list');
    lineEl = el('span', 'flow__line');
    lineEl.setAttribute('aria-hidden', 'true');
    list.appendChild(lineEl);
    stepsEl = FLOW.map(function (f, i) {
      var li = el('li');
      var b = el('button', 'flow__step',
        '<span class="flow__n">' + (i + 1) + '</span>' +
        '<span><span class="flow__t">' + f[1] + '</span>' +
        '<span class="flow__d">' + f[2] + '</span></span>');
      b.type = 'button';
      b.addEventListener('click', function () { go(i); });
      li.appendChild(b);
      list.appendChild(li);
      return b;
    });
    flow.appendChild(list);

    var bar = el('div', 'flow__bar');
    prevBtn = el('button', 'flow__btn', icon('back') + '<span>Back</span>');
    prevBtn.type = 'button';
    prevBtn.addEventListener('click', function () { go(at - 1); });
    nextBtn = el('button', 'flow__btn flow__btn--go', '<span>Next</span>' + icon('next'));
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', function () { go(at + 1); });
    bar.appendChild(prevBtn);
    bar.appendChild(nextBtn);
    bar.appendChild(el('span', 'flow__keys', 'Prototype only: Back / Next and arrow keys change screens here.'));
    flow.appendChild(bar);

    phoneEl = el('div', 'kp-phone');
    phoneEl.appendChild(el('span', 'kp-phone__notch'));
    var status = el('div', 'kp-status',
      '<span class="kp-clock"></span>' +
      '<span class="kp-status__dots"><i></i><i></i><i></i></span>');
    phoneEl.appendChild(status);
    startClock(status.querySelector('.kp-clock'));
    view = el('div', 'kp-view');
    /* topbar() is a string, so the menu mark cannot carry its own listener.
       One delegated handler on the view covers every screen that prints it,
       and keeps working when a screen is rebuilt. */
    view.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.kp-topbtn');
      if (!b || !view.contains(b)) return;
      goTo(b.classList.contains('kp-topbtn--dots') ? 'settings' : 'messages');
    });
    tabsEl = el('nav', 'kp-tabs');
    tabsEl.setAttribute('aria-label', 'KeePlan tabs');
    /* One scrollbar for every screen, living in the view rather than in the
       screen: screens come and go, the scrollbar does not.

       It is a control, not a read-out — it was pointer-events:none, which
       made it a picture of a scrollbar. Now you can take hold of it. */
    barEl = el('span', 'kp-scroll');
    barEl.setAttribute('aria-hidden', 'true');
    barEl.hidden = true;
    view.appendChild(barEl);

    (function () {
      var dragging = false, startY = 0, startTop = 0, sc = null;

      barEl.addEventListener('pointerdown', function (e) {
        sc = currentScroller();
        if (!sc) return;
        var slack = sc.scrollHeight - sc.clientHeight;
        if (slack <= 2) return;
        dragging = true;
        startY = e.clientY;
        startTop = sc.scrollTop;
        barEl.setPointerCapture(e.pointerId);
        phoneEl.classList.add('is-dragging');
        e.preventDefault();
      });

      barEl.addEventListener('pointermove', function (e) {
        if (!dragging || !sc) return;
        var slack = sc.scrollHeight - sc.clientHeight;
        var track = sc.clientHeight - 16;
        var h = parseFloat(barEl.style.height) || 30;
        var room = track - h;
        if (room <= 0) return;
        /* a pixel of thumb is (slack / room) pixels of screen: drag the bar
           and the screen moves by exactly what the bar's position means */
        sc.scrollTop = startTop + (e.clientY - startY) * (slack / room);
      });

      function stop(e) {
        if (!dragging) return;
        dragging = false;
        phoneEl.classList.remove('is-dragging');
        if (e && e.pointerId != null && barEl.hasPointerCapture &&
            barEl.hasPointerCapture(e.pointerId)) {
          barEl.releasePointerCapture(e.pointerId);
        }
      }
      barEl.addEventListener('pointerup', stop);
      barEl.addEventListener('pointercancel', stop);
    })();

    phoneEl.appendChild(view);
    phoneEl.appendChild(tabsEl);

    /* Ten of the fourteen screens do not draw a back arrow — her boards did
       not need one, because a prototype advances by tapping a hotspot. Here
       you can walk in, so you have to be able to walk out. It only appears
       where the screen has not drawn its own, and never on the first screen,
       which has nowhere to go back to. */
    backEl = el('button', 'kp-back kp-back--float', icon('back'));
    backEl.type = 'button';
    backEl.setAttribute('aria-label', 'Back');
    backEl.addEventListener('click', goBack);
    phoneEl.appendChild(backEl);

    host.appendChild(flow);
    host.appendChild(phoneEl);
    go(0);
    paintRail();
    document.addEventListener('themechange', paintRail);
    requestAnimationFrame(placeLine);
    window.addEventListener('resize', placeLine);
    if (window.ResizeObserver) new ResizeObserver(placeLine).observe(list);

    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey ||
          document.documentElement.getAttribute('data-over') === 'on') return;
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      /* On the deck the left and right arrows belong to the deck: they change
         chapter. The flow only takes them once you are inside it, which is
         what clicking a step or tabbing in does. */
      if (document.documentElement.getAttribute('data-deck') === 'on' &&
          !host.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
    });
  }

  function iconWall() {
    var wall = document.getElementById('iconwall');
    if (!wall) return;
    Object.keys(ICONS).forEach(function (k) {
      wall.appendChild(el('figure', null,
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>' +
        '<figcaption>' + k + '</figcaption>'));
    });
    var n = document.getElementById('iconcount');
    if (n) n.textContent = Object.keys(ICONS).length;
  }

  var m = document.getElementById('motion');
  if (m && !m.getAttribute('data-bound')) {
    if (store('rl-motion') === 'off') {
      root.setAttribute('data-motion', 'off');
      m.setAttribute('aria-pressed', 'true');
    }
    m.addEventListener('click', function () {
      var off = root.getAttribute('data-motion') === 'off';
      if (off) { root.removeAttribute('data-motion'); store('rl-motion', 'on'); }
      else { root.setAttribute('data-motion', 'off'); store('rl-motion', 'off'); }
      m.setAttribute('aria-pressed', String(!off));
    });
  }

  /* --- one gradient, every icon --------------------------------------------
     The KeePlan mark is drawn in the blue-to-cyan gradient and the thirty-odd
     icons inside the phone were a flat currentColor, which made the mark look
     like it came from a different product than the screens it sits on top of.

     One <linearGradient> in a hidden svg, referenced by url(#) from every icon
     in the document: a paint server works across separate <svg> elements as
     long as it exists somewhere on the page. objectBoundingBox units are the
     default, so each icon gets its own sweep across its own box rather than a
     slice of one gradient stretched over the screen — which is what makes a
     14px icon and a 22px icon read as the same drawing.

     Icons that sit on a filled ground keep currentColor; the opt-out list is
     in keeplan.css, next to the rule that turns this on. */
  (function () {
    if (document.getElementById('kpIcoGrad')) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML =
      '<defs><linearGradient id="kpIcoGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#0b5fd0"/>' +
      '<stop offset="1" stop-color="#00b6d4"/>' +
      '</linearGradient></defs>';
    document.body.appendChild(svg);
  })();

  /* --- the finger ----------------------------------------------------------
     Her screen recording carries the phone's own touch indicator: a pale
     circle that sits under the finger and shrinks when it presses. Inside the
     device on this page the pointer is a mouse arrow, which is the one thing
     on the screen that says "this is a website" — so within the phone it
     becomes that circle instead.

     Only inside the phone, only while the pointer is actually over it, and
     never when the motion switch is off: a custom cursor is a motion effect
     before it is anything else, and it also takes away the real one, which is
     not a trade someone who turned motion off has agreed to. */
  function finger() {
    var phone = phoneEl || document.querySelector('.kp-phone');
    if (!phone || phone._finger) return;
    phone._finger = 1;

    var dot = document.createElement('i');
    dot.className = 'kp-touch';
    dot.setAttribute('aria-hidden', 'true');
    phone.appendChild(dot);

    var raf = 0, x = 0, y = 0, down = false;
    function draw() {
      raf = 0;
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' +
        (down ? 0.78 : 1) + ')';
    }
    function queue() { if (!raf) raf = requestAnimationFrame(draw); }

    phone.addEventListener('pointerenter', function () {
      if (still()) return;
      phone.classList.add('is-touched');
    });
    phone.addEventListener('pointerleave', function () {
      phone.classList.remove('is-touched');
      down = false;
      queue();
    });
    phone.addEventListener('pointermove', function (e) {
      if (still()) return;
      var r = phone.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      queue();
    });
    phone.addEventListener('pointerdown', function () { down = true; queue(); });
    document.addEventListener('pointerup', function () { down = false; queue(); });
    /* the switch takes it away mid-session too */
    document.addEventListener('motionchange', function () {
      if (still()) phone.classList.remove('is-touched');
    });
  }

  build();
  /* after build(), not before: build() is what creates .kp-phone, so the first
     version of this ran against a document that had no phone in it yet and
     returned without doing anything */
  finger();
  iconWall();
  fitIcons();
  var y = document.getElementById('year');
  if (y && !y.textContent.trim()) y.textContent = new Date().getFullYear();
})();
