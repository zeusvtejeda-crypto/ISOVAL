(function () {
  var head = document.querySelector('.site-head');
  var burger = document.querySelector('.burger');

  if (burger) {
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (head && head.classList.contains('over')) {
    var onScroll = function () {
      var past = scrollY > 40;
      head.classList.toggle('over', !past);
      head.classList.toggle('solid', past);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (head) {
    head.classList.add('solid');
  }

  var enc = document.getElementById('encargo');
  if (enc) {
    var WA = 'https://wa.me/523113436860?text=';
    var $ = function (id) { return document.getElementById(id); };
    var que = $('e-que'), fecha = $('e-fecha'), fhint = $('e-fecha-hint');
    var regalo = $('e-regalo'), dedic = $('e-dedic'), notas = $('e-notas');
    var aviso = $('e-aviso');
    var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    // parseo local: new Date('2026-09-27') se lee como UTC y en México cae un día antes
    var parse = function (v) {
      var p = (v || '').split('-');
      return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
    };

    var hoy = new Date();
    fecha.min = [hoy.getFullYear(),
                 ('0' + (hoy.getMonth() + 1)).slice(-2),
                 ('0' + hoy.getDate()).slice(-2)].join('-');

    var domingo = function () {
      var d = parse(fecha.value);
      return !!d && d.getDay() === 0;
    };

    fecha.addEventListener('change', function () { fhint.hidden = !domingo(); });

    regalo.addEventListener('change', function () {
      dedic.hidden = !regalo.checked;
      if (regalo.checked) dedic.focus(); else dedic.value = '';
    });

    $('e-enviar').addEventListener('click', function () {
      var q = que.value.trim();
      aviso.hidden = !!q;
      if (!q) { que.focus(); return; }
      if (domingo()) { fhint.hidden = false; fecha.focus(); return; }

      var l = ['Hola, quiero hacer un pedido especial.', '', 'Qué: ' + q];
      var d = parse(fecha.value);
      if (d) l.push('Para cuándo: ' + DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]);
      if (regalo.checked) {
        var ded = dedic.value.trim();
        l.push('Es un regalo' + (ded ? ' — dedicatoria: "' + ded + '"' : ''));
      }
      var n = notas.value.trim();
      if (n) l.push('Notas: ' + n);

      window.open(WA + encodeURIComponent(l.join('\n')), '_blank', 'noopener');
    });
  }

  var rv = document.querySelectorAll('.rv');
  if (!rv.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion:reduce)').matches) {
    rv.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  rv.forEach(function (el) { io.observe(el); });
})();
