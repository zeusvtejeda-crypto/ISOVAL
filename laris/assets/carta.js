/* Lari's Bakehouse — índice de la carta: marca la categoría visible
   (IntersectionObserver) y, en móvil, la centra en la fila desplazable. */
(function () {
  'use strict';

  var nav = document.querySelector('.cat-index');
  if (!nav || !('IntersectionObserver' in window)) return;
  var list = nav.querySelector('ul') || nav;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;
  var last = links[links.length - 1];
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  // cada categoría ocupa su encabezado y el bloque que le sigue (rejilla o formulario)
  var regions = [];
  var head = document.querySelector('.page-head');
  if (head) regions.push({ el: head, link: null, on: false });
  links.forEach(function (a) {
    var t = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!t) return;
    regions.push({ el: t, link: a, on: false });
    var n = t.nextElementSibling;
    var isTarget = n && n.id && links.some(function (l) { return l.hash === '#' + n.id; });
    if (n && !isTarget && n.tagName !== 'H2' && n.tagName !== 'SCRIPT') regions.push({ el: n, link: a, on: false });
  });

  var current;
  var lock = false;
  var lockT;

  function center(a) {
    if (list.scrollWidth <= list.clientWidth + 1) return;
    var left = a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2;
    left = Math.max(0, Math.min(left, list.scrollWidth - list.clientWidth));
    if (Math.abs(list.scrollLeft - left) < 2) return;
    try {
      list.scrollTo({ left: left, behavior: reduced() ? 'auto' : 'smooth' });
    } catch (e) {
      list.scrollLeft = left;
    }
  }

  function setActive(a) {
    if (a === current) return;
    current = a;
    links.forEach(function (l) {
      if (l === a) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    if (a) center(a);
  }

  function atBottom() {
    var se = document.scrollingElement || document.documentElement;
    return window.innerHeight + window.pageYOffset >= se.scrollHeight - 4;
  }

  function pick() {
    if (lock) return;
    if (atBottom()) { setActive(last); return; }
    for (var i = 0; i < regions.length; i++) {
      if (regions[i].on) { setActive(regions[i].link); return; }
    }
    // ninguna en la franja: se queda la última marcada
  }

  var io;
  function build() {
    if (io) io.disconnect();
    var stickyTop = parseFloat(window.getComputedStyle(nav).top) || 0;
    var top = Math.round(stickyTop + nav.offsetHeight + 24);
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var band = Math.max(40, (vh - top) * 0.38);
    var bottom = Math.max(0, Math.round(vh - top - band));
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var i = 0; i < regions.length; i++) {
          if (regions[i].el === en.target) regions[i].on = en.isIntersecting;
        }
      });
      pick();
    }, { rootMargin: '-' + top + 'px 0px -' + bottom + 'px 0px', threshold: 0 });
    regions.forEach(function (r) { r.on = false; io.observe(r.el); });
  }
  build();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { build(); if (current) center(current); }, 150);
  });

  // el final de la página no siempre deja subir "por encargo" hasta la franja
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      if (!lock && atBottom()) setActive(last);
    });
  }, { passive: true });

  // al elegir una categoría, se marca de inmediato y el espía espera a que termine el desplazamiento
  function release() {
    lock = false;
    clearTimeout(lockT);
    window.removeEventListener('scrollend', release);
  }
  links.forEach(function (a) {
    a.addEventListener('click', function () {
      setActive(a);
      lock = true;
      clearTimeout(lockT);
      if ('onscrollend' in window) window.addEventListener('scrollend', release);
      lockT = setTimeout(release, reduced() ? 200 : 1200);
    });
  });
})();
