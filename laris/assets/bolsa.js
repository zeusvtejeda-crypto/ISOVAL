/* Lari's Bakehouse — bolsa de pedido.
   Se carga en todas las páginas: actualiza el enlace "pedido" del header y,
   en la carta (si hay .item[data-id]), añade los controles de cantidad, la
   barra de pedido dinámica y el panel #bolsa que manda el pedido por WhatsApp.
   Todo acceso a localStorage va en try/catch: sin storage, la bolsa vive en memoria. */
(function () {
  'use strict';

  var KEY = 'laris.bolsa.v1';
  var KEY_DATOS = 'laris.bolsa.datos.v1';
  var MAX = 99;
  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(reduceMotion && reduceMotion.matches); }
  function L() { return window.LARIS || {}; }
  function waNumber() { return String(L().WA || '523113436860').replace(/\D/g, ''); }
  function zone() { return L().tz || 'America/Mazatlan'; }

  /* ---------------- almacenamiento ---------------- */
  function readStore(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* sin storage: queda en memoria */ }
  }

  function clean(data) {
    var out = { items: [], updated: 0 };
    if (!data || typeof data !== 'object') return out;
    var seen = {};
    (Array.isArray(data.items) ? data.items : []).forEach(function (it) {
      if (!it || typeof it.id !== 'string' || !it.id || seen[it.id]) return;
      var q = Math.floor(Number(it.qty));
      if (!(q > 0)) return;
      seen[it.id] = true;
      out.items.push({
        id: it.id.slice(0, 80),
        name: (typeof it.name === 'string' && it.name.trim() ? it.name : it.id).slice(0, 120),
        qty: Math.min(q, MAX)
      });
    });
    out.updated = Number(data.updated) || 0;
    return out;
  }

  var bag = clean(readStore(KEY));

  function total() {
    var n = 0;
    for (var i = 0; i < bag.items.length; i++) n += bag.items[i].qty;
    return n;
  }
  function indexOf(id) {
    for (var i = 0; i < bag.items.length; i++) if (bag.items[i].id === id) return i;
    return -1;
  }
  function qtyOf(id) {
    var i = indexOf(id);
    return i < 0 ? 0 : bag.items[i].qty;
  }
  function setQty(id, name, q) {
    q = Math.max(0, Math.min(MAX, Math.floor(q) || 0));
    var i = indexOf(id);
    if (q === 0) {
      if (i >= 0) bag.items.splice(i, 1);
    } else if (i >= 0) {
      bag.items[i].qty = q;
      if (name) bag.items[i].name = name;
    } else {
      bag.items.push({ id: id, name: name || id, qty: q });
    }
    bag.updated = Date.now();
    writeStore(KEY, bag);
    render();
  }
  function clearBag() {
    bag = { items: [], updated: Date.now() };
    writeStore(KEY, bag);
    render();
  }

  function piezas(n) { return n + (n === 1 ? ' pieza' : ' piezas'); }

  /* ---------------- render general ---------------- */
  var renderers = [];
  var lastTotal = total();

  function render() {
    var t = total();
    var grew = t > lastTotal;
    lastTotal = t;
    renderBagLinks(t, grew);
    for (var i = 0; i < renderers.length; i++) renderers[i](t, grew);
  }

  function bump(el) {
    if (!el || reduced()) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function renderBagLinks(t, grew) {
    var links = doc.querySelectorAll('.bag-link');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      a.hidden = t === 0;
      // dos o más cifras: en pantallas angostas se muestra solo la cifra (bolsa.css)
      a.classList.toggle('is-long', t >= 10);
      a.setAttribute('aria-label', t ? 'Ver tu pedido: ' + piezas(t) : 'Ver tu pedido');
      var c = a.querySelector('.bag-count');
      if (c) c.textContent = String(t);
      if (grew) bump(a);
    }
    var counts = doc.querySelectorAll('.bag-count');
    for (var j = 0; j < counts.length; j++) counts[j].textContent = String(t);
  }

  /* sincroniza con otras pestañas y con el regreso desde el historial */
  var reconcile = null; // en la carta: descarta lo que ya no está en ella
  function reload() {
    bag = clean(readStore(KEY));
    if (reconcile) reconcile();
    render();
  }
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) reload();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) reload();
  });

  render();

  /* =========================================================
     De aquí en adelante, solo en la carta
     ========================================================= */
  var products = doc.querySelectorAll('.item[data-id]');
  if (!products.length) return;

  /* ---------------- utilidades ---------------- */
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, text, label) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }
  function visible(n) { return !!(n && n.getClientRects().length); }
  function focusEl(n) {
    if (!n) return;
    try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
  }

  var live = el('p', 'bolsa-sr');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  body.appendChild(live);
  var liveT;
  function announce(msg) {
    live.textContent = '';
    clearTimeout(liveT);
    liveT = setTimeout(function () { live.textContent = msg; }, 80);
  }
  function announceQty(name, q) {
    announce(q > 0 ? name + ': ' + q + ' en tu pedido' : name + ': fuera del pedido');
  }

  // tope de 99: aria-disabled en lugar de disabled, para que el botón enfocado no suelte el foco
  function setLimit(b, on) {
    if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  }
  // tras un cambio de estructura (añadir ↔ stepper, línea que se va) el control bajo el puntero
  // es otro: un doble clic no debe tocar una cantidad que no se quería cambiar
  var guard = 0;
  function held() { return Date.now() < guard; }
  function hold() { guard = Date.now() + 400; }

  function makeStepper(name) {
    var wrap = el('div', 'stepper');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Cantidad de ' + name);
    var dec = btn('dec', '−', 'Quitar uno de ' + name);
    var qty = el('span', 'qty', '0');
    var inc = btn('inc', '+', 'Añadir uno de ' + name);
    wrap.appendChild(dec);
    wrap.appendChild(qty);
    wrap.appendChild(inc);
    return { el: wrap, dec: dec, qty: qty, inc: inc };
  }

  /* ---------------- productos ---------------- */
  var cards = [];
  Array.prototype.forEach.call(products, function (item) {
    if (item.hasAttribute('data-ask-only')) return;
    var row = item.querySelector('.item-row');
    if (!row) return;
    var id = item.getAttribute('data-id');
    var h3 = row.querySelector('h3');
    var name = item.getAttribute('data-name') || (h3 ? h3.textContent.trim() : id);

    var buy = el('div', 'buy');
    var add = btn('add', 'añadir', 'Añadir ' + name + ' al pedido');
    var st = makeStepper(name);
    buy.appendChild(add);
    buy.appendChild(st.el);
    row.appendChild(buy);
    item.classList.add('is-buyable');

    add.addEventListener('click', function () {
      if (held()) return;
      setQty(id, name, qtyOf(id) + 1);
      hold();
      focusEl(st.inc);
      announceQty(name, qtyOf(id));
    });
    st.inc.addEventListener('click', function () {
      if (held() || qtyOf(id) >= MAX) return;
      setQty(id, name, qtyOf(id) + 1);
      announceQty(name, qtyOf(id));
    });
    st.dec.addEventListener('click', function () {
      if (held()) return;
      var q = qtyOf(id) - 1;
      setQty(id, name, q);
      if (q <= 0) { hold(); focusEl(add); }
      announceQty(name, Math.max(q, 0));
    });

    cards.push({ id: id, name: name, add: add, st: st });
  });

  // la bolsa solo guarda lo que hoy se puede pedir en la carta, con el nombre que tiene en ella
  // (un producto retirado, uno "solo preguntar" o una bolsa vieja no llegan al mensaje)
  var valid = Object.create(null);
  cards.forEach(function (c) { valid[c.id] = c.name; });
  reconcile = function () {
    var before = JSON.stringify(bag.items);
    bag.items = bag.items.filter(function (it) { return it.id in valid; });
    bag.items.forEach(function (it) { it.name = valid[it.id]; });
    if (JSON.stringify(bag.items) !== before) writeStore(KEY, bag);
  };
  reconcile();
  lastTotal = total();

  renderers.push(function () {
    cards.forEach(function (c) {
      var q = qtyOf(c.id);
      c.add.hidden = q > 0;
      c.st.el.hidden = q === 0;
      c.st.qty.textContent = String(q);
      c.st.el.setAttribute('aria-label', 'Cantidad de ' + c.name + ': ' + q);
      setLimit(c.st.inc, q >= MAX);
    });
  });

  /* ---------------- barra de pedido ---------------- */
  var orderbar = doc.querySelector('.orderbar');
  var obBag = orderbar && orderbar.querySelector('.ob-bag');
  var obWa = orderbar && orderbar.querySelector('.ob-wa');
  if (orderbar) {
    var setObH = function () {
      root.style.setProperty('--ob-h', orderbar.offsetHeight + 'px');
    };
    setObH();
    if ('ResizeObserver' in window) new ResizeObserver(setObH).observe(orderbar);
    else window.addEventListener('resize', setObH);
  }
  renderers.push(function (t, grew) {
    if (!obBag) return;
    var had = !obBag.hidden;
    obBag.hidden = t === 0;
    if (obWa) obWa.hidden = t > 0;
    obBag.setAttribute('aria-label', 'Ver pedido: ' + piezas(t));
    if (grew && had) bump(obBag);
  });

  /* ---------------- panel ---------------- */
  var horas = '<option value="">sin preferencia</option>';
  for (var m = 9 * 60 + 30; m <= 18 * 60; m += 30) {
    var hh = Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2);
    horas += '<option value="' + hh + '" data-min="' + m + '">' + hh + '</option>';
  }

  var velo = el('div', 'bolsa-velo');
  velo.setAttribute('aria-hidden', 'true');
  var panel = el('div'); // role=dialog no se permite en <aside>
  panel.id = 'bolsa';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'bolsa-titulo');
  panel.innerHTML =
    '<div class="b-head">' +
      '<div class="b-top"><span class="eyebrow b-count">La Paz 34 · Tepic</span>' +
      '<button type="button" class="b-close">cerrar</button></div>' +
      '<h2 id="bolsa-titulo" tabindex="-1">Tu pedido</h2>' +
      '<p class="b-meta" hidden><span data-status></span></p>' +
      '<p class="b-closed" hidden>estamos cerrados ahora; te confirmamos en cuanto abramos</p>' +
    '</div>' +
    '<form class="b-form" novalidate>' +
      '<div class="b-scroll">' +
        '<ul class="b-list" aria-label="Piezas de tu pedido"></ul>' +
        '<div class="b-empty" hidden>' +
          '<p class="b-empty-msg" tabindex="-1">todavía no has elegido nada</p>' +
          '<a class="b-back" href="#hojaldres">ver la carta</a>' +
        '</div>' +
        '<div class="b-fields">' +
          '<fieldset><legend>entrega</legend>' +
            '<label class="b-radio"><input type="radio" name="b-entrega" value="recoger" checked> recoger en La Paz 34</label>' +
            '<label class="b-radio"><input type="radio" name="b-entrega" value="envio"> envío dentro de Tepic</label>' +
          '</fieldset>' +
          '<div class="b-field b-dir" hidden>' +
            '<label class="b-label" for="b-dir">colonia o dirección</label>' +
            '<input id="b-dir" type="text" autocomplete="address-line1" placeholder="calle, número y colonia">' +
            '<p class="b-err" id="b-dir-err" hidden>escribe la colonia o dirección para el envío</p>' +
          '</div>' +
          '<div class="b-field">' +
            '<label class="b-label" for="b-dia">día</label>' +
            '<input id="b-dia" type="date">' +
            '<p class="b-err" id="b-dia-err" hidden></p>' +
          '</div>' +
          '<div class="b-field">' +
            '<label class="b-label" for="b-hora">hora aproximada <span class="b-opt">· opcional</span></label>' +
            '<select id="b-hora">' + horas + '</select>' +
          '</div>' +
          '<div class="b-field">' +
            '<label class="b-label" for="b-nombre">nombre</label>' +
            '<input id="b-nombre" type="text" autocomplete="name" aria-required="true">' +
            '<p class="b-err" id="b-nombre-err" hidden>escribe tu nombre para saber de quién es el pedido</p>' +
          '</div>' +
          '<div class="b-field">' +
            '<label class="b-label" for="b-notas">notas <span class="b-opt">· opcional</span></label>' +
            '<textarea id="b-notas" rows="2" placeholder="alergias, si es para regalo, indicaciones de entrega"></textarea>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="b-foot">' +
        '<button type="submit" class="b-send">enviar por WhatsApp</button>' +
        '<p class="b-sent" hidden>¿ya lo mandaste? <button type="button" class="b-clear">vaciar pedido</button></p>' +
      '</div>' +
    '</form>';
  body.appendChild(velo);
  body.appendChild(panel);

  function q(sel) { return panel.querySelector(sel); }
  var title = q('#bolsa-titulo');
  var closeBtn = q('.b-close');
  var countEl = q('.b-count');
  var stWrap = q('.b-meta');
  var statusEl = q('[data-status]');
  var closedEl = q('.b-closed');
  var form = q('.b-form');
  var list = q('.b-list');
  var empty = q('.b-empty');
  var emptyMsg = q('.b-empty-msg');
  var back = q('.b-back');
  var fields = q('.b-fields');
  var foot = q('.b-foot');
  var sent = q('.b-sent');
  var clearBtn = q('.b-clear');
  var radios = panel.querySelectorAll('input[name="b-entrega"]');
  var dirWrap = q('.b-dir');
  var dir = q('#b-dir');
  var dirErr = q('#b-dir-err');
  var dia = q('#b-dia');
  var diaErr = q('#b-dia-err');
  var hora = q('#b-hora');
  var nombre = q('#b-nombre');
  var nombreErr = q('#b-nombre-err');
  var notas = q('#b-notas');

  /* ---- fecha y hora en Tepic ---- */
  function pad(n) { return ('0' + n).slice(-2); }
  function tepicNow() {
    var d = new Date();
    try {
      var o = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone(), year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      return { y: +o.year, m: +o.month, d: +o.day, min: (+o.hour % 24) * 60 + (+o.minute) };
    } catch (e) {
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function todayISO() {
    var n = tepicNow();
    return n.y + '-' + pad(n.m) + '-' + pad(n.d);
  }
  // pasado el cierre (18:30 en Tepic) ya no se puede pedir para hoy: el primer día válido es mañana
  var CLOSE = 18 * 60 + 30;
  function afterClose() { return tepicNow().min >= CLOSE; }
  function minDia() {
    if (!afterClose()) return todayISO();
    var n = tepicNow();
    var d = new Date(Date.UTC(n.y, n.m - 1, n.d + 1));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  // aquí y no antes: minDia() necesita CLOSE ya asignado (var se eleva sin su valor)
  dia.min = minDia();
  // YYYY-MM-DD como fecha local (new Date('2026-10-17') se leería en UTC y caería un día antes)
  function parseISO(v) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null;
  }
  function fmtDia(v) {
    var d = parseISO(v);
    if (!d) return '';
    var s = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    if (d.getFullYear() !== tepicNow().y) s += ' de ' + d.getFullYear();
    return s;
  }

  function refreshHoras() {
    var isToday = dia.value && dia.value === todayISO();
    var now = tepicNow().min;
    Array.prototype.forEach.call(hora.options, function (o) {
      if (!o.value) return;
      o.disabled = !!isToday && +o.getAttribute('data-min') <= now;
    });
    if (hora.selectedOptions && hora.selectedOptions[0] && hora.selectedOptions[0].disabled) hora.value = '';
  }

  function refreshStatus() {
    var st = null;
    try { if (typeof L().status === 'function') st = L().status(); } catch (e) { st = null; }
    if (st && st.label) {
      statusEl.textContent = st.label;
      statusEl.classList.toggle('is-open', !!st.open);
      statusEl.classList.toggle('is-closed', !st.open);
      stWrap.hidden = false;
      closedEl.hidden = !!st.open;
    } else {
      stWrap.hidden = true;
      closedEl.hidden = true;
    }
  }

  /* ---- datos guardados del cliente ---- */
  var datos = readStore(KEY_DATOS) || {};
  if (typeof datos.nombre === 'string') nombre.value = datos.nombre.slice(0, 80);
  if (typeof datos.dir === 'string') dir.value = datos.dir.slice(0, 200);
  Array.prototype.forEach.call(radios, function (r) { r.checked = r.value === (datos.entrega === 'envio' ? 'envio' : 'recoger'); });
  function entrega() {
    for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
    return 'recoger';
  }
  function saveDatos() {
    writeStore(KEY_DATOS, { nombre: nombre.value.trim(), entrega: entrega(), dir: dir.value.trim() });
  }
  function syncEntrega() {
    dirWrap.hidden = entrega() !== 'envio';
    if (dirWrap.hidden) setErr(dir, dirErr, null);
  }
  syncEntrega();

  /* ---- errores en línea ---- */
  function setErr(input, errEl, msg) {
    if (msg) {
      if (msg !== true) errEl.textContent = msg;
      errEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errEl.id);
    } else {
      errEl.hidden = true;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }
  function checkDia() {
    var v = dia.value;
    if (!v) { setErr(dia, diaErr, null); return true; }
    var d = parseISO(v);
    if (!d) { setErr(dia, diaErr, 'elige un día válido'); return false; }
    if (v < todayISO()) { setErr(dia, diaErr, 'elige un día a partir de hoy'); return false; }
    if (d.getDay() === 0) { setErr(dia, diaErr, 'los domingos cerramos; elige otro día'); return false; }
    if (v === todayISO() && afterClose()) { setErr(dia, diaErr, 'hoy ya cerramos; elige otro día'); return false; }
    setErr(dia, diaErr, null);
    return true;
  }

  Array.prototype.forEach.call(radios, function (r) {
    r.addEventListener('change', function () {
      // sin mover el foco: el campo de dirección aparece justo después y Tab llega a él
      syncEntrega();
      saveDatos();
    });
  });
  dir.addEventListener('input', function () { if (dir.value.trim()) setErr(dir, dirErr, null); saveDatos(); });
  nombre.addEventListener('input', function () { if (nombre.value.trim()) setErr(nombre, nombreErr, null); saveDatos(); });
  dia.addEventListener('change', function () { checkDia(); refreshHoras(); });
  dia.addEventListener('input', function () { if (!diaErr.hidden) checkDia(); });

  /* ---- lista del panel ---- */
  var lines = {};
  function makeLine(it) {
    var li = el('li', 'b-line');
    var nm = el('span', 'b-name', it.name);
    var st = makeStepper(it.name);
    li.appendChild(nm);
    li.appendChild(st.el);
    st.inc.addEventListener('click', function () {
      if (held() || qtyOf(it.id) >= MAX) return;
      setQty(it.id, null, qtyOf(it.id) + 1);
      announceQty(it.name, qtyOf(it.id));
    });
    st.dec.addEventListener('click', function () {
      if (held()) return;
      var nq = qtyOf(it.id) - 1;
      var nb = nq <= 0 ? (li.nextElementSibling || li.previousElementSibling) : null;
      setQty(it.id, null, nq);
      if (nq <= 0) { hold(); focusEl(nb ? nb.querySelector('.dec') : emptyMsg); }
      announceQty(it.name, Math.max(nq, 0));
    });
    return { li: li, name: nm, st: st };
  }

  var EMPTY = 'todavía no has elegido nada';
  var THANKS = 'listo; te confirmamos por WhatsApp';
  var thanked = false;
  // "¿ya lo mandaste?" sigue a la vista mientras la bolsa sea la misma que se envió
  var SENT_KEY = 'laris.bolsa.enviado';
  var sentFor = 0;
  renderers.push(function (t) {
    var ids = {};
    bag.items.forEach(function (it, i) {
      ids[it.id] = true;
      var ln = lines[it.id] || (lines[it.id] = makeLine(it));
      ln.name.textContent = it.name;
      ln.st.qty.textContent = String(it.qty);
      ln.st.el.setAttribute('aria-label', 'Cantidad de ' + it.name + ': ' + it.qty);
      setLimit(ln.st.inc, it.qty >= MAX);
      if (list.children[i] !== ln.li) list.insertBefore(ln.li, list.children[i] || null);
    });
    Object.keys(lines).forEach(function (id) {
      if (!ids[id]) {
        if (lines[id].li.parentNode) lines[id].li.parentNode.removeChild(lines[id].li);
        delete lines[id];
      }
    });
    if (t > 0) thanked = false;
    list.hidden = t === 0;
    empty.hidden = t > 0;
    emptyMsg.textContent = thanked ? THANKS : EMPTY;
    fields.hidden = t === 0;
    foot.hidden = t === 0;
    countEl.textContent = t ? piezas(t) : 'La Paz 34 · Tepic';
    sent.hidden = !(t > 0 && sentFor && sentFor === bag.updated);
  });

  /* ---- abrir / cerrar ---- */
  var isOpen = false;
  var lastFocus = null;
  var inerted = [];

  function setInert(on) {
    if (on) {
      inerted = [];
      Array.prototype.forEach.call(body.children, function (n) {
        if (n === panel || n === velo || n === live || n.tagName === 'SCRIPT' || n.hasAttribute('inert')) return;
        n.setAttribute('inert', '');
        inerted.push(n);
      });
    } else {
      inerted.forEach(function (n) { n.removeAttribute('inert'); });
      inerted = [];
    }
  }

  function closeNav() {
    if (!body.classList.contains('nav-open')) return;
    body.classList.remove('nav-open');
    var burger = doc.querySelector('.burger');
    if (burger) burger.setAttribute('aria-expanded', 'false');
  }

  function openPanel(opener) {
    if (isOpen) return;
    closeNav();
    lastFocus = opener || doc.activeElement;
    refreshTime();
    var sbw = window.innerWidth - root.clientWidth;
    root.style.setProperty('--sbw', (sbw > 0 ? sbw : 0) + 'px');
    root.classList.add('bolsa-open');
    setInert(true);
    velo.classList.add('is-open');
    panel.classList.add('is-open');
    isOpen = true;
    if (obBag) obBag.setAttribute('aria-expanded', 'true');
    focusEl(title);
  }

  // con el panel abierto, el aviso de cerrado, las horas de hoy y el día mínimo siguen al reloj
  function refreshTime() {
    dia.min = minDia();
    refreshStatus();
    refreshHoras();
    if (dia.value) checkDia();
  }
  // al cambiar cada minuto, igual que el estado de app.js (así el aviso de cerrado entra a las 18:30 en punto)
  (function tick() {
    setTimeout(function () {
      if (isOpen) refreshTime();
      tick();
    }, 60000 - (Date.now() % 60000) + 80);
  })();
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && isOpen) refreshTime(); });

  function closePanel(restore) {
    if (!isOpen) return;
    isOpen = false;
    if (thanked) { thanked = false; emptyMsg.textContent = EMPTY; }
    panel.classList.remove('is-open');
    velo.classList.remove('is-open');
    root.classList.remove('bolsa-open');
    setInert(false);
    if (obBag) obBag.setAttribute('aria-expanded', 'false');
    if (window.location.hash === '#bolsa' && window.history && history.replaceState) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (restore === false) return;
    var target = lastFocus && lastFocus !== body && doc.contains(lastFocus) && visible(lastFocus) ? lastFocus : null;
    if (!target) target = [obBag, obWa].filter(visible)[0] || null;
    if (target) focusEl(target);
  }

  function focusables() {
    var all = panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    return Array.prototype.filter.call(all, function (n) {
      if (!visible(n)) return false;
      if (n.type === 'radio' && !n.checked) {
        // el grupo de radios es una sola parada de tabulación
        return !Array.prototype.some.call(radios, function (r) { return r.checked; });
      }
      return true;
    });
  }

  doc.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = doc.activeElement;
    var inside = panel.contains(a);
    if (e.shiftKey && (!inside || a === first || a === panel)) {
      e.preventDefault();
      focusEl(last);
    } else if (!e.shiftKey && (!inside || a === last)) {
      e.preventDefault();
      focusEl(first);
    }
  });

  velo.addEventListener('click', function () { closePanel(); });
  closeBtn.addEventListener('click', function () { closePanel(); });
  back.addEventListener('click', function () { closePanel(false); });
  if (obBag) obBag.addEventListener('click', function () { openPanel(obBag); });

  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a || panel.contains(a)) return;
    var href = a.getAttribute('href') || '';
    if (a.classList.contains('bag-link') || href === '#bolsa' || /(^|\/)carta\.html#bolsa$/.test(href)) {
      e.preventDefault();
      openPanel(a);
    }
  });

  function checkHash() {
    if (window.location.hash === '#bolsa') openPanel(null);
  }
  window.addEventListener('hashchange', checkHash);

  /* ---- enviar ---- */
  function message() {
    var l = ['Hola, soy ' + nombre.value.trim() + '. Quiero hacer este pedido:', ''];
    bag.items.forEach(function (it) { l.push('• ' + it.qty + ' × ' + it.name); });
    l.push('');
    l.push(entrega() === 'envio' ? 'Entrega: envío a ' + dir.value.trim() : 'Entrega: recoger en La Paz 34');
    var fd = fmtDia(dia.value);
    if (fd) l.push('Día: ' + fd);
    if (hora.value) l.push('Hora: ' + hora.value);
    var n = notas.value.trim();
    if (n) l.push('Notas: ' + n);
    return l.join('\n');
  }

  function openWhatsApp(url) {
    var w = null;
    try { w = window.open(url, '_blank'); } catch (e) { w = null; }
    if (w) {
      try { w.opener = null; } catch (e) { /* ignore */ }
    } else {
      // misma pestaña (popup bloqueado, navegador dentro de una app): al volver, que siga el aviso de vaciar
      try { window.sessionStorage.setItem(SENT_KEY, String(bag.updated)); } catch (e) { /* sin storage */ }
      window.location.href = url;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!bag.items.length) return;
    var bad = null;
    if (!nombre.value.trim()) { setErr(nombre, nombreErr, true); bad = bad || nombre; }
    if (entrega() === 'envio' && !dir.value.trim()) { setErr(dir, dirErr, true); bad = bad || dir; }
    if (!checkDia()) bad = bad || dia;
    if (bad) {
      // el orden del formulario manda: primero el que aparece antes
      var order = [dir, dia, nombre].filter(function (n) { return n.getAttribute('aria-invalid') === 'true'; });
      focusEl(order[0] || bad);
      if (order[0] && order[0].scrollIntoView) order[0].scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      announce('revisa los datos marcados');
      return;
    }
    saveDatos();
    if (!bag.updated) { bag.updated = Date.now(); writeStore(KEY, bag); }
    sentFor = bag.updated;
    sent.hidden = false;
    openWhatsApp('https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(message()));
  });

  clearBtn.addEventListener('click', function () {
    thanked = true;
    notas.value = '';
    clearBag();
    focusEl(emptyMsg);
    announce('pedido vaciado');
  });

  // de vuelta de WhatsApp por la ruta de respaldo: el panel abierto con "¿ya lo mandaste?"
  function resumeSent() {
    var v = null;
    try { v = window.sessionStorage.getItem(SENT_KEY); window.sessionStorage.removeItem(SENT_KEY); } catch (e) { v = null; }
    if (!v || !bag.items.length || v !== String(bag.updated)) return;
    sentFor = bag.updated;
    render();
    openPanel(null);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) resumeSent(); });

  render();
  checkHash();
  resumeSent();
  // al llegar con #bolsa, el navegador procesa el fragmento al cargar y suelta el foco
  if (isOpen && doc.readyState !== 'complete') {
    window.addEventListener('load', function () {
      setTimeout(function () {
        if (isOpen && !panel.contains(doc.activeElement)) focusEl(title);
      }, 0);
    });
  }
})();
