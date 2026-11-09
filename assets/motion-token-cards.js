/* One shared clock; only visible studies render. Motion preferences freeze the art.
   The cards run the studies of the reel parts page (blur-orbit-study.js, gradient-study.js, room-study.js, field-study.js) at their
   code defaults, each on its own loop length. A tap zooms the study open: it grows out of its card into a large view
   (same study, same moment, still running) and shrinks back into the card on close (Esc, the close button or the backdrop). */
(function () {
  'use strict';
  var root = document.documentElement;
  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var raf = 0, last = 0;
  var MAKE = {
    blur: function (cv) { return BlurOrbit.create(cv); },
    blurw: function (cv) { return BlurOrbit.create(cv, {weight: true, text: '26'}); },
    grad: function (cv) { return GradientStudy.create(cv); },
    room: function (cv) { return RoomStudy.create(cv); },
    field: function (cv) { return FieldStudy.create(cv); }
  };
  /* the frame shown when motion is off: the mask above the numeral, the frame full of light, mid-corridor, the still */
  var REST = {blur: 1.25, blurw: 1.25, grad: 3, room: 1.2, field: 0};
  var studies = Array.from(document.querySelectorAll('[data-motion-study]')).map(function (card) {
    var canvas = card.querySelector('canvas'), key = card.dataset.motionStudy;
    return {card: card, canvas: canvas, study: MAKE[key](canvas), key: key, time: REST[key], visible: false};
  });
  function calm() { return root.getAttribute('data-motion') === 'off' || preference.matches; }
  function fit(s) {                                       /* the drawing buffer always matches the box on screen, or the art is stretched off centre */
    var bounds = s.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!bounds.width || !bounds.height) return false;
    var w = Math.round(bounds.width*dpr), h = Math.round(bounds.height*dpr);
    if (s.canvas.width !== w || s.canvas.height !== h) { s.canvas.width = w; s.canvas.height = h; }
    return true;
  }
  function paint(s) { if (fit(s)) s.study.render(s.time); }

  /* --- the zoomed view: one dialog, a large study per kind made on first open ------------------------------------------- */
  var zoom = document.createElement('dialog'); zoom.className = 'study-zoom';
  zoom.innerHTML = '<figure class="study-zoom__fig"><canvas aria-hidden="true"></canvas><figcaption><span class="study-zoom__title"></span>' +
    '<span class="study-zoom__loop"></span><button type="button" class="study-zoom__close">Close</button></figcaption></figure>';
  document.body.appendChild(zoom);
  var zfig = zoom.querySelector('figure'), zcv = zoom.querySelector('canvas'), BIG = {}, open = null;
  var zs = {canvas: zcv, study: null};
  function grow(from, back) {                             /* the figure flies between the card's study and its place in the dialog */
    if (calm() || !zfig.animate) return Promise.resolve();
    var a = from.getBoundingClientRect(), b = zfig.getBoundingClientRect();
    var t = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ',' + (a.height / b.height) + ')';
    var k = back ? [{transform: 'none'}, {transform: t}] : [{transform: t}, {transform: 'none'}];
    return zfig.animate(k, {duration: back ? 240 : 320, easing: 'cubic-bezier(.22,1,.36,1)'}).finished.catch(function () {});
  }
  function openZoom(s) {
    open = s;
    zs.study = BIG[s.key] || (BIG[s.key] = MAKE[s.key](zcv));
    zoom.querySelector('.study-zoom__title').textContent = s.card.querySelector('.token__study-title').textContent;
    zoom.querySelector('.study-zoom__loop').textContent = s.card.querySelector('.token__name').textContent;
    zoom.showModal(); fit(zs); zs.study.render(s.time);
    grow(s.canvas, false); sync();
  }
  function closeZoom() {
    if (!open) return;
    var s = open; open = null;
    grow(s.canvas, true).then(function () { zoom.close(); s.card.focus({preventScroll: true}); sync(); });
  }
  zoom.addEventListener('cancel', function (e) { e.preventDefault(); closeZoom(); });
  zoom.addEventListener('click', function (e) { if (e.target === zoom || e.target.closest('.study-zoom__close')) closeZoom(); });
  function active() { return !document.hidden && !calm() && (open || studies.some(function (s) { return s.visible; })); }
  function frame(now) {
    raf = 0;
    if (!active()) { last = 0; return; }
    var dt = last ? Math.min((now-last)/1000, .1) : 0; last = now;
    studies.forEach(function (s) { if (s.visible || s === open) { s.time = (s.time+dt)%s.study.D; if (s.visible) paint(s); } });
    if (open && fit(zs)) zs.study.render(open.time);
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (active()) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } return; }
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (calm()) studies.forEach(function (s) { s.time = REST[s.key]; paint(s); });
  }
  var visibility = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var s = studies.find(function (s) { return s.card === entry.target; });
      s.visible = entry.isIntersecting;
    }); sync();
  }, {threshold: .15});
  studies.forEach(function (s) {
    Promise.resolve(s.study.ready).then(function () { paint(s); });
    new ResizeObserver(function () { paint(s); }).observe(s.canvas);
    s.card.addEventListener('click', function () { openZoom(s); });
    visibility.observe(s.card);
  });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('motionchange', sync);
  preference.addEventListener('change', sync);
})();
