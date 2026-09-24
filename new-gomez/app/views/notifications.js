// #/notificaciones — centro de notificaciones: agrupadas por día, no leídas resaltadas, tocar → marca leída y abre
// su enlace, "Marcar todo como leído", filtro Sin leer y paginación. Emite bus 'notifications:changed' (número).
import { html, raw, on, $ } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, tz, today, role } from '../lib/state.js';
import { toast, busy, emptyState, errorState } from '../lib/ui.js';
import { dateLongCap, diffDays, ago, clock as clockIn } from '../lib/fmt.js';
import { injectNotifStyle, notifItemHtml, markNotificationsRead, openNotificationLink } from '../lib/notif-panel.js';

const PAGE = 40;
const CSS = `
.nt-wrap{max-width:780px;display:grid;grid-template-columns:minmax(0,1fr)}
.nt-wrap>*{min-width:0}
.nt-wrap .list{grid-template-columns:minmax(0,1fr)}
.nt-day{font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text-3);margin:22px 4px 8px;display:flex;align-items:center;gap:8px}
.nt-group:first-child .nt-day{margin-top:2px}
.nt-day .n{font-weight:600;letter-spacing:0;text-transform:none;color:var(--brand-strong)}
.nt-card{overflow:hidden}
.nt-card .nt-item:first-child{border-top-left-radius:inherit;border-top-right-radius:inherit}
.nt-card .nt-item:last-child{border-bottom-left-radius:inherit;border-bottom-right-radius:inherit}
.nt-cnt{display:inline-grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--err);color:#fff;font-size:10.5px;font-weight:700;margin-left:4px}
.nt-more{display:flex;justify-content:center;margin-top:16px}
.nt-skel .skel-row{padding:14px 16px}
@media (min-width:720px){.nt-item{padding:14px 18px}}
`;
function injectStyle() { if (!document.getElementById('st-notif-view')) document.head.insertAdjacentHTML('beforeend', '<style id="st-notif-view">' + CSS + '</style>'); }

const dayKey = (iso) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); }
  catch (e) { return String(iso || '').slice(0, 10); }
};
const clock = (iso) => clockIn(iso, tz()); // 24 h, como la agenda: '22:06'
function dayLabel(k, t) {
  const d = diffDays(t, k);
  if (d === 0) return 'Hoy';
  if (d === -1) return 'Ayer';
  return dateLongCap(k);
}

export default {
  title: 'Notificaciones',
  async render(el) {
    injectNotifStyle(); injectStyle();
    const isClient = role() === 'client';
    let filter = 'all', items = [], unread = 0, hasMore = false, marking = false;
    el.innerHTML = String(html`<div class="nt-wrap">
      <div class="page-head"><div><h2>Notificaciones</h2><p id="ntSub">${isClient ? 'Avisos sobre tus citas.' : 'Reservas, cambios de cita y avisos de tu barbería.'}</p></div>
        <div class="actions"><button type="button" class="btn btn-secondary" id="ntAll" hidden>${raw(icon('check'))}Marcar todo como leído</button></div></div>
      <div class="toolbar"><div class="seg" role="tablist" aria-label="Filtrar notificaciones">
        <button type="button" role="tab" data-f="all" aria-selected="true">Todas</button>
        <button type="button" role="tab" data-f="unread" aria-selected="false">Sin leer<span class="nt-cnt" id="ntCnt" hidden></span></button>
      </div></div>
      <div id="ntBody" aria-live="polite"></div>
    </div>`);
    const body = $('#ntBody', el);

    const paintHead = () => {
      $('#ntAll', el).hidden = !unread;
      const c = $('#ntCnt', el); c.hidden = !unread; c.textContent = unread > 99 ? '99+' : String(unread);
      $('#ntSub', el).textContent = unread ? (unread === 1 ? 'Tienes 1 notificación sin leer.' : 'Tienes ' + unread + ' notificaciones sin leer.') : (isClient ? 'Avisos sobre tus citas.' : 'Reservas, cambios de cita y avisos de tu barbería.');
    };
    const skeleton = () => {
      let s = '<div class="card nt-card nt-skel" aria-busy="true" aria-label="Cargando">';
      for (let i = 0; i < 6; i++) s += '<div class="skel-row"><div class="skel" style="width:38px;height:38px;border-radius:12px;flex:none"></div><div style="flex:1"><div class="skel skel-line" style="width:' + (48 + (i * 13) % 35) + '%"></div><div class="skel skel-line" style="width:' + (30 + (i * 9) % 40) + '%;height:10px"></div></div></div>';
      return s + '</div>';
    };
    function paint() {
      paintHead();
      if (!items.length) {
        const cfg = filter === 'unread'
          ? { icon: 'check-circle', title: 'Nada pendiente', text: 'Ya leíste todas tus notificaciones.', action: { label: 'Ver todas', id: 'ntShowAll' } }
          : isClient
            ? { icon: 'bell', title: 'Aún no tienes avisos', text: 'Aquí te avisaremos si tu cita cambia de horario o se cancela.', action: { label: 'Ver mis citas', href: '#/mis-citas', icon: 'calendar-check' } }
            : { icon: 'bell', title: 'Todo al día', text: 'Aquí verás las reservas en línea, cancelaciones, cambios de horario y avisos de caja en cuanto sucedan.', action: { label: 'Ir a la agenda', href: '#/agenda', icon: 'calendar' } };
        body.innerHTML = '<div class="card">' + String(emptyState(cfg)) + '</div>';
        return;
      }
      const t = today();
      const groups = [];
      for (const n of items) {
        const k = dayKey(n.created_at);
        let g = groups[groups.length - 1];
        if (!g || g.k !== k) { g = { k, list: [] }; groups.push(g); }
        g.list.push(n);
      }
      body.innerHTML = String(html`<div class="stagger">${groups.map((g) => {
        const isToday = diffDays(t, g.k) === 0;
        const nUnread = g.list.filter((n) => !n.read_at).length;
        return html`<section class="nt-group" aria-label="${dayLabel(g.k, t)}">
          <h3 class="nt-day">${dayLabel(g.k, t)}${nUnread ? html`<span class="n">· ${nUnread} sin leer</span>` : ''}</h3>
          <div class="card nt-card">${g.list.map((n) => notifItemHtml(n, { timeText: isToday ? (Date.now() - Date.parse(n.created_at) < 6 * 3600e3 ? ago(n.created_at) : clock(n.created_at)) : clock(n.created_at) }))}</div>
        </section>`;
      })}</div>
      ${hasMore ? html`<div class="nt-more"><button type="button" class="btn btn-secondary" id="ntMore">${raw(icon('chevron-down'))}Ver anteriores</button></div>` : ''}`);
    }
    async function load(more) {
      if (!more) body.innerHTML = skeleton();
      const q = { limit: PAGE };
      if (filter === 'unread') q.unread = 1;
      if (more && items.length) q.before = items[items.length - 1].created_at;
      const r = await api.get('/notifications', q);
      const got = r.items || [];
      items = more ? items.concat(got.filter((n) => !items.some((x) => x.id === n.id))) : got;
      unread = r.unread || 0;
      hasMore = got.length === PAGE;
      paint();
      marking = true; bus.emit('notifications:changed', unread); marking = false;
    }
    const reload = () => load(false).catch((err) => {
      body.innerHTML = '<div class="card">' + String(errorState(err, 'ntRetry')) + '</div>';
    });

    const offs = [];
    offs.push(on(el, 'click', '[data-f]', (e, b) => {
      if (b.dataset.f === filter) return;
      filter = b.dataset.f;
      el.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      reload();
    }));
    offs.push(on(el, 'click', '#ntShowAll', () => el.querySelector('[data-f="all"]').click()));
    offs.push(on(el, 'click', '#ntRetry', reload));
    offs.push(on(el, 'click', '#ntMore', (e, b) => busy(b, load(true)).catch((err) => toast.error(err))));
    offs.push(on(el, 'click', '#ntAll', async (e, b) => {
      try {
        marking = true;
        unread = await busy(b, markNotificationsRead('all'));
        const now = new Date().toISOString();
        items = filter === 'unread' ? [] : items.map((n) => Object.assign({}, n, { read_at: n.read_at || now }));
        paint();
        toast.success('Listo: todo marcado como leído');
      } catch (err) { toast.error(err); }
      finally { marking = false; }
    }));
    offs.push(on(el, 'click', '[data-nid]', async (e, b) => {
      const n = items.find((x) => x.id === b.dataset.nid);
      if (!n) return;
      if (!n.read_at) {
        n.read_at = new Date().toISOString();
        b.classList.remove('unread');
        unread = Math.max(0, unread - 1);
        paintHead();
        marking = true;
        const p = markNotificationsRead([n.id]).then((u) => { unread = u; paintHead(); }).catch((err) => { n.read_at = null; b.classList.add('unread'); toast.error(err); }).finally(() => { marking = false; });
        if (!n.link) { await p; if (filter === 'unread') { items = items.filter((x) => x !== n); paint(); } return; }
      }
      if (!openNotificationLink(n) && n.read_at) toast.info('Esta notificación no tiene más detalles.');
    }));
    // Si se marcaron desde el popover de la campana, se recarga.
    offs.push(bus.on('notifications:changed', (u) => { if (!marking && typeof u === 'number' && u !== unread) reload(); }));

    reload();
    return () => offs.forEach((f) => f());
  }
};
