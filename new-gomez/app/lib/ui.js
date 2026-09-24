// Componentes de interfaz: toasts, modales/hojas, confirmaciones, menús, loaders, estados vacíos.
import { html, raw, esc, $ } from './html.js';
import { icon } from './icons.js';
import { initials, colorFor, statusLabel } from './fmt.js';

// ── Toasts ───────────────────────────────────────────────────────────────
let toastRoot = null;
function toastHost() {
  if (!toastRoot || !document.body.contains(toastRoot)) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'toasts';
    toastRoot.setAttribute('role', 'status');
    toastRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastRoot);
  }
  return toastRoot;
}
function showToast(kind, msg, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const ic = kind === 'success' ? 'check' : kind === 'error' ? 'alert' : 'info';
  el.innerHTML = '<span class="t-ic">' + icon(ic) + '</span><span class="t-msg">' + esc(msg) + '</span>' +
    (opts.action ? '<button type="button" class="t-act">' + esc(opts.action.label) + '</button>' : '');
  const host = toastHost();
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  let t = null;
  const close = () => { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (opts.action) el.querySelector('.t-act').onclick = () => { close(); opts.action.onClick(); };
  el.addEventListener('click', (e) => { if (!e.target.closest('.t-act')) close(); });
  t = setTimeout(close, opts.duration || (kind === 'error' ? 5200 : opts.action ? 6000 : 3200));
  if (kind === 'success' && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* */ } }
  return close;
}
export const toast = {
  success: (m, o) => showToast('success', m, o),
  error: (m, o) => showToast('error', errMsg(m), o),
  info: (m, o) => showToast('info', m, o)
};
export function errMsg(e) {
  if (!e) return 'Algo salió mal.';
  if (typeof e === 'string') return e;
  return e.message || 'Algo salió mal. Intenta de nuevo.';
}

// ── Modal (hoja inferior en móvil, diálogo centrado en escritorio) ───────────
const openStack = [];
export function modal(opts) {
  opts = opts || {};
  const prevFocus = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML =
    '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="mdl-t">' +
    '<div class="sheet-handle" aria-hidden="true"></div>' +
    '<div class="modal-head"><div class="grow"><h3 id="mdl-t">' + esc(opts.title || '') + '</h3>' +
    (opts.subtitle ? '<div class="sub">' + esc(opts.subtitle) + '</div>' : '') + '</div>' +
    '<button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
    '<div class="modal-body"></div>' +
    (opts.footer !== false ? '<div class="modal-foot"></div>' : '') + '</div>';
  const box = ov.querySelector('.modal');
  const body = ov.querySelector('.modal-body');
  const foot = ov.querySelector('.modal-foot');
  if (opts.body != null) body.innerHTML = String(opts.body);
  if (foot && opts.footerHtml != null) foot.innerHTML = String(opts.footerHtml);
  if (foot && !opts.footerHtml && !(opts.actions && opts.actions.length)) foot.remove();
  (opts.actions || []).forEach((a) => {
    if (a.spacer) { const s = document.createElement('span'); s.className = 'spacer'; foot.appendChild(s); return; }
    const b = document.createElement('button');
    b.type = a.type || 'button';
    b.className = 'btn ' + (a.variant ? 'btn-' + a.variant : 'btn-secondary');
    b.innerHTML = (a.icon ? icon(a.icon) : '') + esc(a.label);
    if (a.form) b.setAttribute('form', a.form);
    if (a.onClick) b.onclick = async () => {
      if (b.getAttribute('aria-busy') === 'true') return;
      try {
        b.setAttribute('aria-busy', 'true');
        const r = await a.onClick(api, b);
        if (r !== false && a.close !== false) api.close(r);
      } catch (e) { toast.error(e); }
      finally { b.removeAttribute('aria-busy'); }
    };
    else if (a.close !== false && a.type !== 'submit') b.onclick = () => api.close(a.value);
    foot.appendChild(b);
  });
  let resolved = false, resolveFn;
  const done = new Promise((r) => { resolveFn = r; });
  const onKey = (e) => {
    if (openStack[openStack.length - 1] !== api) return;
    if (e.key === 'Escape' && opts.dismissible !== false) { e.preventDefault(); api.close(); }
    if (e.key === 'Tab') trapFocus(e, box);
  };
  const api = {
    el: box, body, foot, overlay: ov, done,
    close(value) {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey, true);
      const i = openStack.indexOf(api); if (i > -1) openStack.splice(i, 1);
      ov.classList.add('closing');
      setTimeout(() => { ov.remove(); if (!openStack.length) unlockScroll(); }, 190);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* */ } }
      if (opts.onClose) opts.onClose(value);
      resolveFn(value);
    },
    setTitle(t) { box.querySelector('#mdl-t').textContent = t; }
  };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && opts.dismissible !== false) api.close(); });
  ov.querySelector('[data-close]').onclick = () => api.close();
  enableSwipeDown(box, () => { if (opts.dismissible !== false) api.close(); });
  document.addEventListener('keydown', onKey, true);
  lockScroll();
  document.body.appendChild(ov);
  openStack.push(api);
  requestAnimationFrame(() => {
    const f = box.querySelector('[autofocus]') || (window.matchMedia('(min-width:720px)').matches ? box.querySelector('.modal-body input:not([type=hidden]),.modal-body select,.modal-body textarea') : null);
    (f || box.querySelector('[data-close]')).focus({ preventScroll: true });
  });
  if (opts.onOpen) opts.onOpen(api);
  return api;
}
export function closeAllModals() { openStack.slice().forEach((m) => m.close()); }
function trapFocus(e, box) {
  const f = Array.from(box.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
let scrollY = 0, locks = 0;
function lockScroll() { if (locks++ === 0) { scrollY = window.scrollY; document.body.style.overflow = 'hidden'; } }
function unlockScroll() { locks = 0; document.body.style.overflow = ''; }
// Deslizar hacia abajo el asa/cabecera de la hoja (móvil) la cierra.
function enableSwipeDown(box, onClose) {
  let y0 = null, dy = 0;
  const zone = (t) => t.closest('.sheet-handle,.modal-head');
  box.addEventListener('touchstart', (e) => { if (!zone(e.target) || window.innerWidth >= 720) return; y0 = e.touches[0].clientY; dy = 0; box.style.transition = 'none'; }, { passive: true });
  box.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); box.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
  box.addEventListener('touchend', () => {
    if (y0 == null) return;
    box.style.transition = ''; y0 = null;
    if (dy > 110) onClose(); else box.style.transform = '';
  });
}

// ── Confirmación antes de acciones delicadas ──
// await confirmDialog({ title, message, confirmText, danger }) → true/false
export function confirmDialog(o) {
  o = o || {};
  const m = modal({
    title: '', size: 'sm',
    body: '<div class="confirm-icon' + (o.danger ? ' danger' : '') + '">' + icon(o.icon || (o.danger ? 'trash' : 'help')) + '</div>' +
      '<h3 style="font-size:18px;margin-bottom:6px">' + esc(o.title || '¿Confirmas?') + '</h3>' +
      (o.message ? '<p class="muted" style="font-size:14px">' + esc(o.message) + '</p>' : '') + (o.html ? String(o.html) : ''),
    actions: [
      { label: o.cancelText || 'Cancelar', variant: 'secondary', value: false },
      { label: o.confirmText || 'Confirmar', variant: o.danger ? 'danger' : 'primary', value: true }
    ]
  });
  m.el.querySelector('.modal-head h3').remove();
  return m.done.then((v) => v === true);
}
// Pide un texto (p. ej. motivo de cancelación). Devuelve string o null si se cancela.
export function promptDialog(o) {
  o = o || {};
  const m = modal({
    title: o.title || '', size: 'sm',
    body: (o.message ? '<p class="muted" style="font-size:14px;margin-bottom:12px">' + esc(o.message) + '</p>' : '') +
      '<div class="field"><label for="pd-in">' + esc(o.label || '') + (o.optional ? ' <span class="opt">(opcional)</span>' : '') + '</label>' +
      (o.multiline ? '<textarea class="textarea" id="pd-in" maxlength="' + (o.max || 300) + '" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.value || '') + '</textarea>'
        : '<input class="input" id="pd-in" maxlength="' + (o.max || 200) + '" placeholder="' + esc(o.placeholder || '') + '" value="' + esc(o.value || '') + '"/>') +
      '<p class="error">Este campo es obligatorio.</p></div>' +
      (o.chips ? '<div class="chips" style="margin-top:10px">' + o.chips.map((c) => '<button type="button" class="chip" data-chip="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : ''),
    actions: [
      { label: o.cancelText || 'Cancelar', variant: 'secondary', value: null },
      { label: o.confirmText || 'Aceptar', variant: o.danger ? 'danger' : 'primary', close: false, onClick: (api) => {
        const v = api.body.querySelector('#pd-in').value.trim();
        if (!v && !o.optional) { api.body.querySelector('.field').classList.add('invalid'); return false; }
        api.close(v); return false;
      } }
    ]
  });
  m.body.addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) { m.body.querySelector('#pd-in').value = c.dataset.chip; } });
  setTimeout(() => { const i = m.body.querySelector('#pd-in'); if (i) i.focus(); }, 60);
  return m.done.then((v) => (v === undefined ? null : v));
}

// ── Menú contextual anclado a un botón ──
// menu(anchorEl, [{ label, icon, onClick, danger } | { sep:true }])
export function menu(anchor, items) {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = items.filter(Boolean).map((it, i) => it.sep ? '<div class="sep"></div>' :
    (it.href ? '<a role="menuitem" href="' + esc(it.href) + '"' + (it.external ? ' target="_blank" rel="noopener"' : '') + ' data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + (it.icon ? icon(it.icon) : '') + esc(it.label) + '</a>'
      : '<button type="button" role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + (it.icon ? icon(it.icon) : '') + esc(it.label) + '</button>')).join('');
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
  let top = r.bottom + 6;
  if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  el.style.left = left + 'px'; el.style.top = top + 'px';
  const list = items.filter(Boolean);
  const close = () => { el.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', close, true); };
  const outside = (e) => { if (!el.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const it = list[+b.dataset.i]; close();
    if (it && it.onClick) it.onClick();
  });
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', key, true); window.addEventListener('scroll', close, true); }, 0);
  const first = el.querySelector('button,a'); if (first) first.focus();
  return close;
}

// ── Loaders ──
// Pone un botón en estado "cargando" mientras corre la promesa. Devuelve el resultado.
export async function busy(btn, promiseOrFn) {
  if (!btn) return typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  if (btn.getAttribute('aria-busy') === 'true') return undefined;
  btn.setAttribute('aria-busy', 'true');
  const dis = btn.disabled; btn.disabled = true;
  try { return await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn); }
  finally { btn.removeAttribute('aria-busy'); btn.disabled = dis; }
}
export function spinner(label) { return raw('<div class="loading-block" role="status"><div class="spinner lg"></div>' + (label ? '<span>' + esc(label) + '</span>' : '<span class="sr">Cargando…</span>') + '</div>'); }
export function skeletonRows(n, opts) {
  opts = opts || {};
  let s = '';
  for (let i = 0; i < (n || 5); i++) s += '<div class="skel-row">' + (opts.avatar !== false ? '<div class="skel" style="width:36px;height:36px;border-radius:50%;flex:none"></div>' : '') +
    '<div style="flex:1"><div class="skel skel-line" style="width:' + (40 + (i * 13) % 35) + '%"></div><div class="skel skel-line" style="width:' + (25 + (i * 7) % 30) + '%;height:10px"></div></div></div>';
  return raw('<div aria-busy="true" aria-label="Cargando">' + s + '</div>');
}
export function skeletonCards(n, h) {
  let s = '';
  for (let i = 0; i < (n || 4); i++) s += '<div class="card skel" style="height:' + (h || 104) + 'px;border:0"></div>';
  return raw(s);
}

// ── Estados vacíos y de error ──
// emptyState({ icon, title, text, action: { label, href | id, icon } , compact })
export function emptyState(o) {
  o = o || {};
  const a = o.action;
  return html`<div class="empty ${o.compact ? 'compact' : ''}">
    <div class="art">${raw(icon(o.icon || 'inbox'))}</div>
    <h3>${o.title || 'Nada por aquí todavía'}</h3>
    ${o.text ? html`<p>${o.text}</p>` : ''}
    ${a ? (a.href ? html`<a class="btn btn-primary" href="${a.href}">${a.icon ? raw(icon(a.icon)) : ''}${a.label}</a>`
      : html`<button type="button" class="btn btn-primary" id="${a.id || 'emptyAction'}">${a.icon ? raw(icon(a.icon)) : ''}${a.label}</button>`) : ''}
  </div>`;
}
export function errorState(err, retryId) {
  return html`<div class="empty">
    <div class="art" style="background:var(--err-soft);color:var(--err)">${raw(icon('alert'))}</div>
    <h3>No se pudo cargar</h3><p>${errMsg(err)}</p>
    ${retryId ? html`<button type="button" class="btn btn-secondary" id="${retryId}">${raw(icon('refresh'))}Reintentar</button>` : ''}
  </div>`;
}

// ── Piezas pequeñas ──
export function avatar(name, opts) {
  opts = opts || {};
  const c = opts.color || colorFor(name);
  const size = opts.size ? ' ' + opts.size : '';
  if (opts.src) return raw('<span class="avatar' + size + '" style="--c:' + esc(c) + '"><img src="' + esc(opts.src) + '" alt="" loading="lazy" decoding="async"/></span>');
  return raw('<span class="avatar' + size + '" style="--c:' + esc(c) + '" aria-hidden="true">' + esc(initials(name)) + '</span>');
}
export function statusBadge(status) { return raw('<span class="badge ' + esc(status) + '">' + esc(statusLabel(status)) + '</span>'); }

export async function copyText(text, okMsg) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast.success(okMsg || 'Copiado');
  } catch (e) { toast.error('No se pudo copiar. Mantén presionado para copiar manualmente.'); }
}

// Anima un número de 0 (o del valor actual) al destino. fmt: función de formato.
export function animateNumber(el, to, fmt, ms) {
  if (!el) return;
  fmt = fmt || ((n) => Math.round(n).toLocaleString('es-MX'));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const from = 0, t0 = performance.now(), dur = ms || 700;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Muestra errores por campo que devuelve la API ({ fields: { name: 'msg' } }) en un <form>.
export function showFieldErrors(form, err) {
  clearFieldErrors(form);
  const fields = err && err.fields;
  let first = null;
  if (fields) for (const [k, msg] of Object.entries(fields)) {
    const input = form.querySelector('[name="' + k + '"]');
    const field = input && input.closest('.field');
    if (!field) continue;
    field.classList.add('invalid');
    let e = field.querySelector('.error');
    if (!e) { e = document.createElement('p'); e.className = 'error'; field.appendChild(e); }
    if (typeof msg === 'string' && msg.length > 3) e.textContent = msg;
    if (!first) first = input;
  }
  if (first) first.focus();
  else toast.error(err);
  const box = form.closest('.modal') || form;
  box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
}
export function clearFieldErrors(form) { form.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid')); }

// Descarga un Blob/texto como archivo.
export function saveFile(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

export { html, raw, esc, icon, $ };
