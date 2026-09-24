// Notificaciones: popover de la campana (escritorio/tablet) y piezas compartidas con la vista #/notificaciones.
//   openNotificationsPanel(anchorEl) → abre/cierra el popover con las últimas 8, "Marcar todo como leído" y "Ver todas".
//   markNotificationsRead(ids | 'all') → Promise<unread>  (emite bus 'notifications:changed' con el número)
//   openNotificationLink(n) → navega al link de la notificación (#/agenda?cita=… , #/caja, …)
//   NOTIF_TYPE, notifMeta(type), notifItemHtml(n, { timeText }) → HTML seguro, injectNotifStyle()
import { html, raw, $ } from './html.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { bus } from './state.js';
import { toast, errMsg } from './ui.js';
import { ago } from './fmt.js';
import { navigate } from './router.js';

export const NOTIF_TYPE = {
  booking_new: { icon: 'calendar-plus', tone: 'info', label: 'Nueva cita' },
  booking_cancelled: { icon: 'x-circle', tone: 'err', label: 'Cancelación' },
  booking_rescheduled: { icon: 'repeat', tone: 'warn', label: 'Cambio de horario' },
  reminder_due: { icon: 'whatsapp', tone: 'ok', label: 'Recordatorios' },
  cash_closed: { icon: 'wallet', tone: 'brand', label: 'Caja' },
  client_new: { icon: 'user-plus', tone: 'brand', label: 'Nuevo cliente' },
  system: { icon: 'sparkles', tone: 'plain', label: 'Aviso' }
};
export const notifMeta = (t) => NOTIF_TYPE[t] || NOTIF_TYPE.system;

const CSS = `
.nt-item{display:flex;align-items:flex-start;gap:12px;width:100%;padding:13px 16px;text-align:left;border-bottom:1px solid var(--border);position:relative;transition:background .12s;color:inherit;text-decoration:none;min-height:64px}
.nt-item:last-child{border-bottom:0}
.nt-item:hover{background:var(--surface-2)}
.nt-item.unread{background:var(--brand-softer)}
.nt-item.unread:hover{background:var(--brand-soft)}
.nt-ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--muted-soft);color:var(--text-2)}
.nt-ic .ic{width:19px;height:19px}
.nt-ic.info{background:var(--info-soft);color:var(--info)}.nt-ic.err{background:var(--err-soft);color:var(--err)}
.nt-ic.warn{background:var(--warn-soft);color:var(--warn)}.nt-ic.ok{background:var(--ok-soft);color:var(--ok)}
.nt-ic.brand{background:var(--brand-soft);color:var(--brand-strong)}
.nt-main{flex:1;min-width:0;display:grid;gap:2px}
.nt-title{font-size:14px;font-weight:500;line-height:1.35;color:var(--text)}
.nt-item.unread .nt-title{font-weight:700}
.nt-body{font-size:13px;color:var(--text-2);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nt-time{font-size:12px;color:var(--text-3)}
.nt-dot{width:9px;height:9px;border-radius:50%;background:var(--brand);flex:none;margin-top:6px;box-shadow:0 0 0 3px var(--brand-soft)}
.nt-item:not(.unread) .nt-dot{visibility:hidden}
.nt-item.reading{opacity:.6}
.notif-pop{position:fixed;z-index:115;width:392px;max-width:calc(100vw - 24px);background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-3);display:flex;flex-direction:column;overflow:hidden;animation:menuIn .18s var(--ease-out);transform-origin:top right}
.notif-pop.closing{animation:fadeOut .14s var(--ease) forwards}
.notif-pop .np-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 12px;border-bottom:1px solid var(--border)}
.notif-pop .np-head h3{font-size:15.5px;font-weight:700;display:flex;align-items:center;gap:8px}
.notif-pop .np-head .badge{height:20px}
.notif-pop .np-list{overflow-y:auto;overscroll-behavior:contain;max-height:var(--mh,480px)}
.notif-pop .np-foot{border-top:1px solid var(--border);padding:8px;background:var(--surface-2)}
.notif-pop .np-foot a{display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;border-radius:10px;font-weight:600;font-size:13.5px;color:var(--text);text-decoration:none}
.notif-pop .np-foot a:hover{background:var(--muted-soft)}
.notif-pop .link-btn{font-size:13px;min-height:32px}
.notif-pop .link-btn[disabled]{opacity:.45;pointer-events:none}
`;
export function injectNotifStyle() { if (!document.getElementById('st-notif')) document.head.insertAdjacentHTML('beforeend', '<style id="st-notif">' + CSS + '</style>'); }

export function notifItemHtml(n, opts) {
  opts = opts || {};
  const meta = notifMeta(n.type);
  const unread = !n.read_at;
  return html`<button type="button" class="nt-item ${unread ? 'unread' : ''}" data-nid="${n.id}" aria-label="${(unread ? 'Sin leer: ' : '') + n.title}">
    <span class="nt-ic ${meta.tone}" aria-hidden="true">${raw(icon(meta.icon))}</span>
    <span class="nt-main"><span class="nt-title">${n.title}</span>${n.body ? html`<span class="nt-body">${n.body}</span>` : ''}<span class="nt-time">${opts.timeText || ago(n.created_at)}</span></span>
    <span class="nt-dot" aria-hidden="true"></span>
  </button>`;
}

export async function markNotificationsRead(ids) {
  const body = ids === 'all' ? { all: true } : { ids: [].concat(ids || []) };
  const r = await api.post('/notifications/read', body);
  const unread = r && typeof r.unread === 'number' ? r.unread : 0;
  bus.emit('notifications:changed', unread);
  return unread;
}

export function openNotificationLink(n) {
  const link = String((n && n.link) || '').trim();
  if (!link) return false;
  if (/^https?:\/\//i.test(link)) { window.open(link, '_blank', 'noopener'); return true; }
  const h = link.replace(/^#/, '');
  if (!h.startsWith('/')) return false;
  const [p, qs] = h.split('?');
  navigate(p, { query: Object.fromEntries(new URLSearchParams(qs || '')), force: true });
  return true;
}

// ── Popover ──
let current = null;
export function closeNotificationsPanel() { if (current) current.close(); }

export function openNotificationsPanel(anchor) {
  injectNotifStyle();
  if (current) { const same = current.anchor === anchor; current.close(); if (same) return; }
  const el = document.createElement('div');
  el.className = 'notif-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Notificaciones');
  el.innerHTML = String(html`<div class="np-head"><h3>Notificaciones <span class="badge brand plain" id="npCount" hidden></span></h3>
      <button type="button" class="link-btn" id="npAll" disabled>${raw(icon('check', 'ic-sm'))}Marcar todo como leído</button></div>
    <div class="np-list" id="npList">${raw(skel())}</div>
    <div class="np-foot"><a href="#/notificaciones" id="npMore">Ver todas las notificaciones${raw(icon('arrow-right', 'ic-sm'))}</a></div>`);
  document.body.appendChild(el);
  const place = () => {
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { bottom: 60, right: window.innerWidth - 16 };
    const top = Math.round(r.bottom + 8);
    const right = Math.max(12, Math.round(window.innerWidth - r.right - 6));
    el.style.top = top + 'px';
    el.style.right = right + 'px';
    el.style.setProperty('--mh', Math.max(220, Math.min(520, window.innerHeight - top - 90)) + 'px');
  };
  place();
  if (anchor) anchor.setAttribute('aria-expanded', 'true');
  const prevFocus = document.activeElement;
  let items = [];
  const list = $('#npList', el), allBtn = $('#npAll', el), countEl = $('#npCount', el);

  const paintCount = (unread) => {
    countEl.hidden = !unread;
    countEl.textContent = unread > 99 ? '99+ nuevas' : unread + (unread === 1 ? ' nueva' : ' nuevas');
    allBtn.disabled = !unread;
  };
  const paint = () => {
    if (!items.length) {
      list.innerHTML = String(html`<div class="empty compact"><div class="art">${raw(icon('bell'))}</div><h3>Todo al día</h3><p>Aquí verás nuevas reservas, cancelaciones y avisos de caja.</p></div>`);
      return;
    }
    list.innerHTML = items.map((n) => String(notifItemHtml(n))).join('');
  };
  const load = async () => {
    try {
      const r = await api.get('/notifications', { limit: 8 });
      if (!document.body.contains(el)) return;
      items = r.items || [];
      paint(); paintCount(r.unread || 0);
      bus.emit('notifications:changed', r.unread || 0);
    } catch (err) {
      list.innerHTML = String(html`<div class="empty compact"><div class="art" style="background:var(--err-soft);color:var(--err)">${raw(icon('alert'))}</div><h3>No se pudo cargar</h3><p>${errMsg(err)}</p><button type="button" class="btn btn-secondary btn-sm" id="npRetry">${raw(icon('refresh'))}Reintentar</button></div>`);
    }
  };

  const onClick = async (e) => {
    if (e.target.closest('#npRetry')) { list.innerHTML = skel(); load(); return; }
    if (e.target.closest('#npMore')) { close(); return; }
    if (e.target.closest('#npAll')) {
      allBtn.disabled = true;
      try { const u = await markNotificationsRead('all'); items = items.map((n) => Object.assign({}, n, { read_at: n.read_at || new Date().toISOString() })); paint(); paintCount(u); toast.success('Todo marcado como leído'); }
      catch (err) { allBtn.disabled = false; toast.error(err); }
      return;
    }
    const b = e.target.closest('[data-nid]');
    if (!b) return;
    const n = items.find((x) => x.id === b.dataset.nid);
    if (!n) return;
    if (!n.read_at) { b.classList.add('reading'); markNotificationsRead([n.id]).catch(() => {}); }
    close();
    openNotificationLink(n);
  };
  const outside = (e) => { if (!el.contains(e.target) && !(anchor && anchor.contains(e.target))) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); if (anchor && anchor.focus) anchor.focus(); } };
  const onHash = () => close();
  el.addEventListener('click', onClick);
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('touchstart', outside, true); }, 0);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('hashchange', onHash);
  window.addEventListener('resize', place);

  function close() {
    if (!current || current.el !== el) return;
    current = null;
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('touchstart', outside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('hashchange', onHash);
    window.removeEventListener('resize', place);
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    el.classList.add('closing');
    setTimeout(() => el.remove(), 150);
    if (prevFocus && el.contains(document.activeElement) && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  current = { el, anchor, close };
  setTimeout(() => { const f = el.querySelector('#npAll:not([disabled]), .nt-item, #npMore'); if (f) f.focus({ preventScroll: true }); }, 30);
  load();
  return { close };
}

function skel() {
  let s = '';
  for (let i = 0; i < 4; i++) s += '<div class="skel-row"><div class="skel" style="width:38px;height:38px;border-radius:12px;flex:none"></div><div style="flex:1"><div class="skel skel-line" style="width:' + (55 + (i * 11) % 30) + '%"></div><div class="skel skel-line" style="width:' + (35 + (i * 7) % 30) + '%;height:10px"></div></div></div>';
  return s;
}
