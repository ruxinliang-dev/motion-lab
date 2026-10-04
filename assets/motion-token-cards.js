/* One shared clock; only visible studies render. Motion preferences freeze the art. */
(function () {
  'use strict';
  var root = document.documentElement;
  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var raf = 0, last = 0;
  var studies = Array.from(document.querySelectorAll('[data-motion-study]')).map(function (card) {
    var canvas = card.querySelector('canvas');
    return {card: card, canvas: canvas, draw: MotionStudies.create(canvas.getContext('2d'), true), index: Number(card.dataset.motionStudy), time: 1.8, visible: false};
  });
  function calm() { return root.getAttribute('data-motion') === 'off' || preference.matches; }
  function paint(s) { s.draw(s.index, s.time, s.canvas.width, s.canvas.height); }
  function active() { return !document.hidden && !calm() && studies.some(function (s) { return s.visible; }); }
  function frame(now) {
    raf = 0;
    if (!active()) { last = 0; return; }
    var dt = last ? Math.min((now-last)/1000, .1) : 0; last = now;
    studies.forEach(function (s) { if (s.visible) { s.time = (s.time+dt)%5; paint(s); } });
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (active()) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else { cancelAnimationFrame(raf); raf = 0; last = 0; }
  }
  var visibility = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var s = studies.find(function (s) { return s.card === entry.target; });
      s.visible = entry.isIntersecting;
    }); sync();
  }, {threshold: .15});
  studies.forEach(function (s) {
    new ResizeObserver(function () {
      var bounds = s.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!bounds.width || !bounds.height) return;
      s.canvas.width = Math.round(bounds.width*dpr); s.canvas.height = Math.round(bounds.height*dpr); paint(s);
    }).observe(s.canvas);
    s.card.addEventListener('click', function () {
      s.time = calm() ? 1.8 : 0; paint(s); sync();
    });
    visibility.observe(s.card);
  });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('motionchange', sync);
  preference.addEventListener('change', sync);
})();
