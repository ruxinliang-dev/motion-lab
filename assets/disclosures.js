/* Native disclosures with interruptible height and ink-like motion. */
(function () {
  'use strict';
  var root = document.documentElement;
  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() {
    return preference.matches || root.getAttribute('data-motion') === 'off';
  }
  function token(name, fallback) {
    return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  }
  document.querySelectorAll('.case-details').forEach(function (details) {
    var summary = details.querySelector('summary');
    var body = details.querySelector('.case-details__body');
    if (!summary || !body || !details.animate) return;
    var expanded = details.open;
    var heightMotion = null, contentMotion = null;

    function state() {
      details.setAttribute('data-expanded', String(expanded));
      summary.setAttribute('aria-expanded', String(expanded));
    }
    function cancel() {
      if (heightMotion) { heightMotion.onfinish = null; heightMotion.cancel(); }
      if (contentMotion) contentMotion.cancel();
      heightMotion = contentMotion = null;
    }
    function finish() {
      cancel();
      details.open = expanded;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      body.inert = false;
      state();
    }
    function toggle(event) {
      event.preventDefault();
      var from = details.getBoundingClientRect().height;
      var opacity = details.open ? getComputedStyle(body).opacity : '0';
      var transform = details.open ? getComputedStyle(body).transform : 'translateY(-10px)';
      expanded = !expanded;
      cancel();
      state();
      if (reduced()) { finish(); return; }
      if (!expanded && body.contains(document.activeElement)) summary.focus({ preventScroll: true });
      body.inert = !expanded;

      // Measure the real endpoint; no fixed max-height or hidden-content guessing.
      details.style.removeProperty('height');
      details.open = expanded;
      var to = details.getBoundingClientRect().height;
      details.open = true;
      details.style.overflow = 'hidden';
      details.style.height = from + 'px';
      var duration = parseFloat(token(expanded ? '--ui-expand' : '--ui-collapse', expanded ? '420' : '280'));
      heightMotion = details.animate([
        { height: from + 'px' }, { height: to + 'px' }
      ], { duration: duration, easing: token('--e-out', 'ease-out'), fill: 'forwards' });
      contentMotion = body.animate([
        { opacity: opacity, transform: transform },
        { opacity: expanded ? 1 : 0, transform: expanded ? 'translateY(0)' : 'translateY(-8px)' }
      ], { duration: duration * .85, easing: token('--e-out', 'ease-out'), fill: 'forwards' });
      heightMotion.onfinish = finish;
    }
    summary.addEventListener('click', toggle);
    // Native Enter/Space activation continues to dispatch click on summary.
    document.addEventListener('motionchange', function () { if (reduced()) finish(); });
    preference.addEventListener('change', function () { if (reduced()) finish(); });
    window.addEventListener('resize', function () { if (heightMotion) finish(); });
    state();
  });
})();
