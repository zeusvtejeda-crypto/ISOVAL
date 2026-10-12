/* Lari's Bakehouse — comportamiento común (ES5, sin dependencias)
 *
 * window.LARIS
 *   WA        '523113436860'
 *   tz        'America/Mazatlan' (Tepic, UTC-7 todo el año)
 *   status()  -> { open: Boolean, label: String }  (opcional: status(fecha))
 *   today()   -> 'AAAA-MM-DD' de hoy en Tepic
 *   wa(text)  -> URL de wa.me con el texto ya codificado
 *   openUrl(url) abre en pestaña nueva sin dar acceso a window.opener
 *   refresh() vuelve a pintar todos los [data-status]
 */
(function () {
  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  root.className += (root.className ? ' ' : '') + 'js';

  var each = function (list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------------- hora de Tepic ---------------- */

  var TZ = 'America/Mazatlan';
  var OPEN = 9 * 60 + 30;   // 9:30
  var CLOSE = 18 * 60 + 30; // 18:30
  var WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  var fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false, weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    if (typeof fmt.formatToParts !== 'function') fmt = null;
  } catch (e) { fmt = null; }

  // Partes de la fecha en Tepic, sin importar la zona horaria del visitante.
  var tepic = function (date) {
    var d = date instanceof Date && !isNaN(date) ? date : new Date();
    if (fmt) {
      try {
        var o = {};
        each(fmt.formatToParts(d), function (p) { o[p.type] = p.value; });
        var dow = WEEKDAY[o.weekday];
        if (dow !== undefined) {
          return {
            y: +o.year, m: +o.month, d: +o.day, dow: dow,
            min: (+o.hour % 24) * 60 + (+o.minute) // algunos motores dan "24" a medianoche
          };
        }
      } catch (e) { /* sigue al respaldo */ }
    }
    // Respaldo: Tepic está en UTC-7 sin horario de verano.
    var t = new Date(d.getTime() - 7 * 36e5);
    return {
      y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
      dow: t.getUTCDay(), min: t.getUTCHours() * 60 + t.getUTCMinutes()
    };
  };

  var hm = function (min) { return Math.floor(min / 60) + ':' + pad(min % 60); };

  var status = function (date) {
    var t = tepic(date);
    var workday = t.dow !== 0; // domingo cerrado
    if (workday && t.min >= OPEN && t.min < CLOSE) {
      return { open: true, label: 'abierto ahora · cerramos a las ' + hm(CLOSE) };
    }
    var when;
    if (workday && t.min < OPEN) when = 'hoy';
    else if (t.dow === 6 || t.dow === 0) when = 'el lunes';
    else when = 'mañana';
    return { open: false, label: 'cerrado · abrimos ' + when + ' a las ' + hm(OPEN) };
  };

  var today = function (date) {
    var t = tepic(date);
    return t.y + '-' + pad(t.m) + '-' + pad(t.d);
  };

  var WA_NUM = '523113436860';
  var wa = function (text) {
    return 'https://wa.me/' + WA_NUM + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  // window.open(url, '_blank', 'noopener') siempre devuelve null; abrimos sin
  // "features" y cortamos opener a mano. Si el navegador bloquea la ventana,
  // seguimos el enlace en la misma pestaña.
  var openUrl = function (url) {
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (w) {
      try { w.opener = null; } catch (e) { /* nada */ }
      return true;
    }
    window.location.href = url;
    return false;
  };

  var hooks = [];
  var paint = function () {
    var s = status();
    each(doc.querySelectorAll('[data-status]'), function (el) {
      if (el.textContent !== s.label) el.textContent = s.label;
      el.classList.remove(s.open ? 'is-closed' : 'is-open');
      el.classList.add(s.open ? 'is-open' : 'is-closed');
    });
    each(hooks, function (fn) { try { fn(); } catch (e) { /* nada */ } });
  };

  var L = window.LARIS = window.LARIS || {};
  L.WA = WA_NUM;
  L.tz = TZ;
  L.status = function (date) { return status(date); };
  L.today = function (date) { return today(date); };
  L.wa = wa;
  L.openUrl = openUrl;
  L.refresh = paint;

  paint();
  // otros scripts diferidos (bolsa.js) pueden crear más [data-status] antes de este evento
  doc.addEventListener('DOMContentLoaded', paint);
  // refresco al cambiar cada minuto (alineado al reloj) y al volver a la pestaña
  setTimeout(function () {
    paint();
    setInterval(paint, 60000);
  }, 60000 - (Date.now() % 60000) + 50);
  doc.addEventListener('visibilitychange', function () {
    if (!doc.hidden) paint();
  });

  /* ---------------- header y menú ---------------- */

  var head = doc.querySelector('.site-head');
  var burger = doc.querySelector('.burger');
  var panel = doc.querySelector('.nav-panel');

  if (burger && panel) {
    if (!panel.id) panel.id = 'menu';
    burger.setAttribute('type', 'button');
    burger.setAttribute('aria-controls', panel.id);
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    panel.setAttribute('inert', '');

    var navOpen = false;
    var isOpen = function () { return navOpen; };
    var focusables = function () {
      var list = [burger];
      each(panel.querySelectorAll('a[href], button:not([disabled])'), function (el) {
        if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) list.push(el);
      });
      return list;
    };

    var openNav = function () {
      navOpen = true;
      body.classList.add('nav-open');
      panel.removeAttribute('inert');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Cerrar menú');
      var first = panel.querySelector('a[href]');
      if (first) {
        first.focus();
        if (doc.activeElement !== first) setTimeout(function () { if (navOpen) first.focus(); }, 60);
      }
    };

    // deja el menú cerrado en ARIA/inert; la clase la quita closeNav (o ya la quitó otro script)
    var settle = function () {
      navOpen = false;
      panel.setAttribute('inert', '');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menú');
    };

    var closeNav = function (giveBack) {
      if (!navOpen) return;
      body.classList.remove('nav-open');
      settle();
      if (giveBack) burger.focus();
    };

    burger.addEventListener('click', function () {
      if (isOpen()) closeNav(true); else openNav();
    });

    panel.addEventListener('click', function (e) {
      var a = e.target;
      while (a && a !== panel && a.tagName !== 'A') a = a.parentNode;
      if (a && a.tagName === 'A') closeNav(true);
    });

    doc.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeNav(true);
        return;
      }
      if (e.key === 'Tab') {
        var list = focusables();
        var n = list.length;
        var i = list.indexOf(doc.activeElement);
        var next = i < 0 ? (e.shiftKey ? n - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + n) % n;
        e.preventDefault();
        list[next].focus();
      }
    });

    // al volver con "atrás" desde la caché del navegador
    window.addEventListener('pageshow', function () { closeNav(false); });

    // si otro script quita body.nav-open (p. ej. bolsa.js al abrir el pedido), sincronizamos estado
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        if (navOpen && !body.classList.contains('nav-open')) settle();
      }).observe(body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (head && head.classList.contains('over')) {
    var onScroll = function () {
      var past = (window.pageYOffset || root.scrollTop) > 40;
      head.classList.toggle('over', !past);
      head.classList.toggle('solid', past);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (head) {
    head.classList.add('solid');
  }

  /* ---------------- encargo (carta.html) ---------------- */

  var $ = function (id) { return doc.getElementById(id); };
  var enc = $('encargo');
  var que = $('e-que');
  var enviar = $('e-enviar');

  if (enc && que && enviar) {
    var fecha = $('e-fecha'), fhint = $('e-fecha-hint');
    var regalo = $('e-regalo'), dedic = $('e-dedic'), notas = $('e-notas');
    var aviso = $('e-aviso');
    var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var HINT_DOMINGO = fhint ? fhint.textContent : '';
    var HINT_PASADO = 'Esa fecha ya pasó — elige otro día.';
    var HINT_CERRADO = 'Hoy ya cerramos — elige otro día.';

    // parseo por partes: new Date('2026-09-27') se lee como UTC y en México cae un día antes
    var parse = function (v) {
      var p = (v || '').split('-');
      return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
    };

    // pasado el cierre ya no se puede encargar para hoy
    var closed = function () { return tepic().min >= CLOSE; };
    // fecha mínima = hoy en Tepic (no la fecha local del visitante); mañana si ya cerramos
    var setMin = function () {
      if (fecha) fecha.min = closed() ? today(new Date(Date.now() + 864e5)) : today();
    };
    setMin();
    hooks.push(setMin);

    var problema = function () {
      if (!fecha || !fecha.value) return '';
      var d = parse(fecha.value);
      if (!d || isNaN(d)) return '';
      if (fecha.value < today()) return HINT_PASADO;
      if (d.getDay() === 0) return HINT_DOMINGO;
      if (fecha.value === today() && closed()) return HINT_CERRADO;
      return '';
    };
    // el aviso queda ligado al campo (aria-invalid + aria-describedby) mientras esté a la vista
    var marca = function (input, msg, on) {
      if (!input || !msg) return;
      if (on) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', msg.id);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    };
    var mostrar = function () {
      var p = problema();
      if (fhint) {
        if (p) fhint.textContent = p;
        fhint.hidden = !p;
      }
      marca(fecha, fhint, !!p);
      return p;
    };

    if (fecha) {
      fecha.addEventListener('change', mostrar);
      fecha.addEventListener('input', mostrar);
    }

    if (regalo && dedic) {
      regalo.addEventListener('change', function () {
        dedic.hidden = !regalo.checked;
        if (regalo.checked) dedic.focus(); else dedic.value = '';
      });
    }

    que.addEventListener('input', function () {
      if (que.value.trim() && aviso && !aviso.hidden) {
        aviso.hidden = true;
        marca(que, aviso, false);
      }
    });

    var lastSend = 0; // un doble clic no abre WhatsApp dos veces
    enviar.addEventListener('click', function () {
      var q = que.value.trim();
      if (aviso) aviso.hidden = !!q;
      marca(que, aviso, !q);
      if (!q) { que.focus(); return; }
      if (mostrar()) { fecha.focus(); return; }
      if (Date.now() - lastSend < 1500) return;
      lastSend = Date.now();

      var l = ['Hola, quiero hacer un pedido especial.', '', 'Qué: ' + q];
      var d = fecha ? parse(fecha.value) : null;
      if (d && !isNaN(d)) l.push('Para cuándo: ' + DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]);
      if (regalo && regalo.checked) {
        var ded = dedic ? dedic.value.trim() : '';
        l.push('Es un regalo' + (ded ? ' — dedicatoria: "' + ded + '"' : ''));
      }
      var n = notas ? notas.value.trim() : '';
      if (n) l.push('Notas: ' + n);

      openUrl(wa(l.join('\n')));
    });
  }

  /* ---------------- aparición suave (.rv) ---------------- */

  var rv = doc.querySelectorAll('.rv');
  if (rv.length) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) {
      each(rv, function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        each(entries, function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' });
      var vh = window.innerHeight || root.clientHeight;
      each(rv, function (el) {
        var r = el.getBoundingClientRect();
        // lo que ya está a la vista al cargar aparece sin esperar al observer
        if (r.bottom > 0 && r.top < vh && (r.width || r.height)) el.classList.add('in');
        else io.observe(el);
      });
    }
  }
})();
