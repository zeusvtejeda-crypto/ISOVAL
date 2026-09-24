// Agenda: Día (columnas por barbero), Semana (una fila por barbero con «Todos»; cuadrícula de horas con un
// solo barbero), Mes (cuadrícula) y Lista (agrupada).
// URL: #/agenda?fecha=AAAA-MM-DD&vista=day|week|month|list (o dia|semana|mes|lista)&barbero=<id>&cita=<id>&nueva=1&q=&estado=
// Tocar un espacio vacío → nueva cita en esa hora/barbero. Tocar una cita → detalle. En escritorio se
// arrastra una cita para reagendarla (mismo día, otro barbero u otro día en la semana).
import { html, raw, esc, $, $$, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, LS } from '../lib/api.js';
import { bus, can, canAny, shop, today, nowMin, me, getStaff } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, confirmDialog, menu, emptyState, errorState, avatar, statusBadge } from '../lib/ui.js';
import { money, compactMoney, time, duration, dateLongCap, dateShort, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, weekday, diffDays, plural, WEEKDAYS_SHORT, MONTHS, MONTHS_SHORT, dayNum, relDay, statusLabel, firstName } from '../lib/fmt.js';
import { openAppointment, openNewAppointment, setAppointmentStatus, cancelAppointment, chargeAppointment, whatsappMenu, openReschedule, moveAppointment } from '../lib/appointment-sheet.js';
import { hexRgb } from '../lib/pickers.js';

const VIEWS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['list', 'Lista']];
const VIEW_ALIAS = { dia: 'day', 'día': 'day', semana: 'week', mes: 'month', lista: 'list' };
const LSK = { view: 'tb:agenda:view', cx: 'tb:agenda:cancelled' };
const OCC = ['pending', 'confirmed', 'completed'];
const ACTIVE = ['pending', 'confirmed'];
const ST_ORDER = ['confirmed', 'pending', 'completed', 'no_show', 'cancelled'];
const MIN_H = 22;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mq = (q) => window.matchMedia(q).matches;
const isMobile = () => mq('(max-width:719px)');
const hourLabel = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

function ensureStyles() {
  if (document.getElementById('st-agenda')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="st-agenda">
.page.ag-page{max-width:1600px;padding-bottom:calc(var(--bottomnav-h) + var(--safe-b) + 12px)}
@media (min-width:1024px){.page.ag-page{padding-bottom:20px}}
.ag-page{--hh:rgba(21,19,15,.045);--off:rgba(21,19,15,.035);--off-line:rgba(21,19,15,.05);--ev-a:.15;--ev-b:.34}
:root[data-theme="dark"] .ag-page{--hh:rgba(242,237,227,.035);--off:rgba(0,0,0,.28);--off-line:rgba(242,237,227,.035);--ev-a:.22;--ev-b:.4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ag-page{--hh:rgba(242,237,227,.035);--off:rgba(0,0,0,.28);--off-line:rgba(242,237,227,.035);--ev-a:.22;--ev-b:.4}}
.ag-bar.page-head{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap;margin:6px 0 14px}
.ag-long{display:none}
.ag-nav{display:flex;align-items:center;gap:6px;min-width:0}
.ag-nav .btn-icon{--h:40px}
.ag-mid{display:flex;align-items:center;gap:8px;min-width:0}
.ag-date{position:relative;min-width:0;border-radius:10px}
.ag-date-btn{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 10px;border-radius:10px;font-family:var(--disp);font-weight:800;font-size:23px;letter-spacing:.01em;white-space:nowrap;transition:background .15s}
.ag-date-btn .ic{color:var(--text-3)}
.ag-date-btn .rel{color:var(--brand-strong)}
.ag-date-in{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;font-size:16px;border:0;-webkit-appearance:none;appearance:none}
.ag-date:hover .ag-date-btn{background:var(--muted-soft)}
.ag-date:focus-within{outline:2.5px solid var(--brand);outline-offset:2px}
.ag-views button{min-width:66px}
.ag-tools{display:flex;align-items:center;gap:8px;min-width:0}
.ag-filt{--h:40px;position:relative;flex:none;padding:0 14px;font-size:13.5px}
.ag-filt .ic{width:17px;height:17px}
.ag-filt-dot{position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 2px var(--surface)}
@media (max-width:719px){
  .ag-bar{gap:8px;margin-top:0}
  .ag-nav{width:100%}
  .ag-nav [data-nav="-1"]{order:1}.ag-nav .ag-mid{order:2;flex:1;justify-content:center}.ag-nav [data-nav="1"]{order:3}
  .ag-date-btn{font-size:21px;justify-content:center;padding:0 4px}
  .ag-tools{width:100%}
  .ag-views{flex:1;min-width:0}.ag-views button{flex:1;min-width:0}
  .ag-filt{order:2;width:40px;padding:0}.ag-filt .lbl{display:none}
}
.ag-filters{display:flex;align-items:center;gap:10px;margin-bottom:10px;min-width:0}
.ag-filters:empty{display:none}
.ag-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0;padding:2px;margin:-2px}
.ag-chips::-webkit-scrollbar{display:none}
.ag-chips .chip{flex:none;min-height:38px;padding:0 13px}
.ag-chips .chip .n{font-size:11.5px;opacity:.65;font-variant-numeric:tabular-nums;font-weight:600}
.ag-dot{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none;box-shadow:0 0 0 2px rgba(var(--c-rgb),.22)}
.ag-stats{display:flex;gap:6px;margin-bottom:12px;min-height:32px;overflow-x:auto;scrollbar-width:none;padding:1px}
.ag-stats::-webkit-scrollbar{display:none}
/* carruseles: sangran hasta el borde de la página (como .rp-nav) para que no se corten en seco en el margen;
   --ag-bleed = padding lateral real de .page (lo fija render()) */
.ag-chips{margin:-2px calc(-1 * var(--ag-bleed,16px));padding:2px var(--ag-bleed,16px);scroll-padding:0 var(--ag-bleed,16px)}
.ag-stats{margin-left:calc(-1 * var(--ag-bleed,16px));margin-right:calc(-1 * var(--ag-bleed,16px));padding:1px var(--ag-bleed,16px);scroll-padding:0 var(--ag-bleed,16px)}
.ag-stat{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:13px;color:var(--text-2);white-space:nowrap;flex:none;animation:fadeUp .3s var(--ease-out) both}
.ag-stat b{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums}
.ag-stat .ic{width:15px;height:15px;color:var(--text-3)}
.ag-stat.warn b{color:var(--warn)}.ag-stat.err b{color:var(--err)}.ag-stat.ok b{color:var(--ok)}
button.ag-stat{cursor:pointer;transition:border-color .15s,background .15s}
button.ag-stat:hover{border-color:var(--border-strong);background:var(--surface-2)}
.ag-stat.skel{width:110px;border:0}
.ag-listbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.ag-listbar .input-group{flex:1;min-width:220px}
.ag-listbar .select{width:auto;min-width:180px}
@media (max-width:719px){.ag-listbar .input-group{min-width:100%}.ag-listbar .select{flex:1}}
.ag-body-wrap{position:relative}
.ag-body-wrap.loading::before{content:"";position:absolute;left:0;right:0;top:-6px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--brand),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:agBar 1s linear infinite;z-index:9}
.ag-body-wrap.loading>*{opacity:.62;transition:opacity .2s}
@keyframes agBar{from{background-position:-40% 0}to{background-position:140% 0}}
/* calendario (día / semana) */
.ag-cal{position:relative;overflow:hidden;padding:0}
@media (max-width:719px){.ag-cal{margin:0 -16px;border-radius:0;border-left:0;border-right:0}}
.ag-scroll{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;position:relative;scrollbar-width:thin;max-height:calc(100vh - 220px)}
.ag-grid{--gut:60px;min-width:calc(var(--gut) + var(--n) * var(--colmin));position:relative}
.ag-dayv{--colmin:172px}.ag-dayv .ag-grid.one{--colmin:0px}
.ag-weekv{--colmin:140px}
@media (max-width:1180px){.ag-weekv{--colmin:100px}}
@media (max-width:719px){.ag-grid{--gut:50px}.ag-dayv{--colmin:150px}.ag-weekv{--colmin:112px}}
.ag-hrow,.ag-brow{display:grid;grid-template-columns:var(--gut) repeat(var(--n),minmax(var(--colmin),1fr))}
.ag-hrow{position:sticky;top:0;z-index:8;background:var(--surface);box-shadow:0 1px 0 var(--border)}
.ag-corner{position:sticky;left:0;z-index:2;background:var(--surface);border-right:1px solid var(--border);display:grid;place-items:end center;padding-bottom:6px;font-size:10px;color:var(--text-3);font-weight:600}
.ag-ch{display:flex;align-items:center;gap:9px;padding:10px 10px;min-width:0;border-left:1px solid var(--border);min-height:60px;background:var(--surface)}
.ag-ch:first-of-type{border-left:0}
.ag-ch .avatar{--s:32px;box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--c)}
.ag-ch-n{font-weight:600;font-size:14px;line-height:1.25}
.ag-ch-m{font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ch.off .ag-ch-n{color:var(--text-2)}
.ag-wh{flex-direction:column;justify-content:center;gap:1px;text-align:center;padding:6px 4px;cursor:pointer;transition:background .15s;width:100%}
.ag-wh:hover{background:var(--surface-2)}
.ag-wh .dow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3)}
.ag-wh .dn{font-family:var(--disp);font-size:22px;font-weight:800;line-height:1;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;font-variant-numeric:tabular-nums}
.ag-wh.today .dn{background:var(--brand);color:var(--brand-ink)}
.ag-wh.today .dow{color:var(--brand-strong)}
.ag-wh .cnt{font-size:11px;color:var(--text-3);white-space:nowrap}
.ag-brow{position:relative;padding:10px 0 16px}
.ag-gutter{position:sticky;left:0;z-index:6;background:var(--surface);border-right:1px solid var(--border)}
.ag-hl{position:absolute;right:8px;font-size:11px;color:var(--text-3);font-variant-numeric:tabular-nums;transform:translateY(-50%);line-height:1;font-weight:500;white-space:nowrap}
.ag-col{position:relative;border-left:1px solid var(--border);background-image:linear-gradient(var(--border),var(--border) 1px,transparent 1px),linear-gradient(var(--hh),var(--hh) 1px,transparent 1px);background-size:100% var(--hour),100% calc(var(--hour) / 2);transition:background-color .15s}
.ag-col:nth-child(2){border-left:0}
.ag-cal.w .ag-col{cursor:pointer}
.ag-col.today{background-color:var(--brand-softer)}
.ag-col.drop{background-color:var(--brand-soft)}
.ag-off{position:absolute;left:0;right:0;background:var(--off);background-image:repeating-linear-gradient(-45deg,transparent 0 8px,var(--off-line) 8px 9px);pointer-events:none}
.ag-off-l{position:sticky;top:70px;display:block;margin:10px auto 0;width:max-content;max-width:90%;font-size:11.5px;font-weight:600;color:var(--text-3);background:var(--surface);border:1px solid var(--border);padding:3px 9px;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-to{position:absolute;left:3px;right:3px;border-radius:9px;background:repeating-linear-gradient(-45deg,var(--surface-3) 0 7px,var(--surface-2) 7px 14px);border:1px dashed var(--border-strong);pointer-events:none;padding:5px 8px;font-size:11.5px;color:var(--text-2);font-weight:600;overflow:hidden;z-index:1;display:flex;gap:5px;align-items:flex-start}
.ag-to .ic{width:13px;height:13px;flex:none;margin-top:1px}
.ag-to span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* fondo opaco (tinte del barbero sobre --surface): las líneas de la cuadrícula no cruzan la tarjeta */
.ag-ev{position:absolute;z-index:2;display:flex;flex-direction:column;align-items:stretch;gap:1px;padding:5px 7px 5px 9px;border-radius:9px;background:linear-gradient(rgba(var(--c-rgb),var(--ev-a)),rgba(var(--c-rgb),var(--ev-a))),var(--surface);border:1px solid rgba(var(--c-rgb),var(--ev-b));border-left:4px solid var(--c);color:var(--text);text-align:left;overflow:hidden;cursor:pointer;box-shadow:var(--shadow-1);transition:box-shadow .15s,transform .15s var(--ease),opacity .15s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-size:12.5px;line-height:1.25;min-width:0;animation:agIn .32s var(--ease-out) both}
@keyframes agIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
.ag-ev:hover{box-shadow:var(--shadow-2);z-index:4;transform:translateY(-1px)}
.ag-ev:focus-visible{outline:2.5px solid var(--brand);outline-offset:1px;z-index:5}
.ag-ev-h{display:flex;align-items:center;gap:4px;min-width:0}
.ag-ev-n{font-weight:650;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.ag-ev-i{width:14px;height:14px;flex:none;stroke-width:2.2}
.ag-ev-t,.ag-ev-s{font-size:11.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ev-t{font-variant-numeric:tabular-nums}
.ag-ev-tt{display:none;font-weight:700;margin-right:4px;font-variant-numeric:tabular-nums}
.ag-ev.xs{flex-direction:row;align-items:center;padding:0 6px 0 8px}
.ag-ev.xs .ag-ev-tt{display:inline}
.ag-ev.xs .ag-ev-t,.ag-ev.xs .ag-ev-s,.ag-ev.sm .ag-ev-s,.ag-ev.xs .ag-ev-due{display:none}
.ag-ev-due{align-self:flex-start;margin-top:auto;font-size:10.5px;font-weight:700;color:var(--warn);background:var(--warn-soft);padding:1px 6px;border-radius:6px;white-space:nowrap}
.ag-ev.sm .ag-ev-due{display:none}
.ag-ev.st-pending{background:linear-gradient(rgba(var(--c-rgb),.07),rgba(var(--c-rgb),.07)),var(--surface);border:1.5px dashed rgba(var(--c-rgb),.8);border-left:4px dashed var(--c)}
.ag-ev.st-pending .ag-ev-i{color:var(--st-pending)}
.ag-ev.st-completed .ag-ev-i{color:var(--st-completed)}
.ag-ev.st-cancelled{background:var(--surface-2);border-color:var(--border);border-left-color:var(--st-cancelled);box-shadow:none}
.ag-ev.st-cancelled .ag-ev-n,.ag-ev.st-cancelled .ag-ev-t{text-decoration:line-through;color:var(--text-3)}
.ag-ev.st-cancelled .ag-ev-s,.ag-ev.st-cancelled .ag-ev-i{color:var(--text-3)}
.ag-ev.st-no_show{background:linear-gradient(var(--err-soft),var(--err-soft)),var(--surface);border-color:rgba(179,38,30,.35);border-left-color:var(--st-no_show)}
.ag-ev.st-no_show .ag-ev-n,.ag-ev.st-no_show .ag-ev-i{color:var(--st-no_show)}
.ag-weekv .ag-ev{padding:4px 5px 4px 7px;border-left-width:3px}
.ag-weekv .ag-ev-n{font-size:12px}
.ag-ev.narrow{padding:3px 3px 3px 5px}
.ag-ev.narrow .ag-ev-i,.ag-ev.narrow .ag-ev-s,.ag-ev.narrow .ag-ev-due{display:none}
.ag-ev.narrow .ag-ev-n{font-size:11.5px;text-overflow:clip}
.ag-ev.narrow .ag-ev-t{font-size:10.5px;text-overflow:clip}
.ag-ev.narrow.xs .ag-ev-tt{display:none}
.ag-weekv .ag-off-l{top:96px}
.ag-grid.nohead .ag-off-l{top:10px}
.ag-grid.nohead .ag-brow{padding-top:16px}
/* semana por barbero (dueño con «Todos»): filas = barberos, columnas = días */
.ag-rosterv{--gut:156px;--colmin:118px}
@media (max-width:1180px){.ag-rosterv{--gut:136px;--colmin:104px}}
@media (max-width:719px){.ag-rosterv{--gut:66px;--colmin:112px}}
.ag-rgrid{min-width:calc(var(--gut) + 7 * var(--colmin));position:relative}
.ag-rrow{display:grid;grid-template-columns:var(--gut) repeat(7,minmax(var(--colmin),1fr));border-top:1px solid var(--border)}
.ag-hrow+.ag-rrow{border-top:0}
.ag-rh{position:sticky;left:0;z-index:6;display:flex;align-items:flex-start;gap:9px;padding:10px 10px;background:var(--surface);border-right:1px solid var(--border);text-align:left;min-width:0;transition:background .15s}
button.ag-rh:hover{background:var(--surface-2)}
.ag-rh .avatar{--s:32px;flex:none;box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--c)}
.ag-rh-t{display:grid;min-width:0;padding-top:1px}
.ag-rh-n{font-weight:600;font-size:14px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-rh-m{font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-rc{position:relative;display:flex;flex-direction:column;gap:4px;min-width:0;min-height:74px;padding:6px 5px 8px;border-left:1px solid var(--border);transition:background-color .15s}
.ag-rh+.ag-rc{border-left:0}
.ag-rc.today{background-color:var(--brand-softer)}
.ag-rc.off{background-color:var(--off);background-image:repeating-linear-gradient(-45deg,transparent 0 8px,var(--off-line) 8px 9px)}
.ag-rosterv.w .ag-rc{cursor:pointer}
.ag-rosterv.w .ag-rc:hover{background-color:var(--brand-softer)}
.ag-rc-l{margin:auto;max-width:100%;font-size:11.5px;font-weight:600;color:var(--text-3);background:var(--surface);border:1px solid var(--border);padding:3px 9px;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ri{display:flex;align-items:center;gap:5px;width:100%;min-width:0;min-height:28px;padding:3px 6px 3px 7px;border-radius:7px;background:linear-gradient(rgba(var(--c-rgb),var(--ev-a)),rgba(var(--c-rgb),var(--ev-a))),var(--surface);border:1px solid rgba(var(--c-rgb),var(--ev-b));border-left:3px solid var(--c);font-size:12.5px;line-height:1.2;color:var(--text);text-align:left;cursor:pointer;transition:box-shadow .15s,transform .15s var(--ease)}
.ag-ri:hover{box-shadow:var(--shadow-2);transform:translateY(-1px)}
.ag-ri:focus-visible{outline:2.5px solid var(--brand);outline-offset:1px}
.ag-ri-t{flex:none;font-weight:700;font-variant-numeric:tabular-nums}
.ag-ri-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ri-i{width:13px;height:13px;flex:none;stroke-width:2.2}
.ag-ri.st-pending{background:var(--surface);border:1.5px dashed rgba(var(--c-rgb),.8);border-left:3px dashed var(--c)}
.ag-ri.st-pending .ag-ri-i{color:var(--st-pending)}
.ag-ri.st-completed .ag-ri-i{color:var(--st-completed)}
.ag-ri.st-cancelled{background:var(--surface-2);border-color:var(--border);border-left-color:var(--st-cancelled)}
.ag-ri.st-cancelled .ag-ri-t,.ag-ri.st-cancelled .ag-ri-n{text-decoration:line-through;color:var(--text-3)}
.ag-ri.st-cancelled .ag-ri-i{color:var(--text-3)}
.ag-ri.st-no_show{background:linear-gradient(var(--err-soft),var(--err-soft)),var(--surface);border-color:rgba(179,38,30,.35);border-left-color:var(--st-no_show)}
.ag-ri.st-no_show .ag-ri-n,.ag-ri.st-no_show .ag-ri-i{color:var(--st-no_show)}
.ag-ri.to{background:repeating-linear-gradient(-45deg,var(--surface-3) 0 7px,var(--surface-2) 7px 14px);border:1px dashed var(--border-strong);color:var(--text-2);cursor:default;font-weight:600;font-size:11.5px}
.ag-ri.to:hover{box-shadow:none;transform:none}
@media (max-width:719px){
  .ag-rh{flex-direction:column;align-items:center;gap:5px;padding:10px 4px;text-align:center}
  .ag-rh .avatar{--s:30px}
  .ag-rh-n{font-size:11.5px}.ag-rh-m{font-size:10.5px}
  .ag-ri{min-height:32px;font-size:12px;gap:4px;padding:3px 5px 3px 6px}
  .ag-ri-i{display:none}
}
.ag-now{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--err);z-index:7;pointer-events:none}
.ag-now.first::before{content:"";position:absolute;left:-6px;top:-7px;width:12px;height:12px;border-radius:50%;background:var(--err);animation:agPulse 2.2s infinite}
@keyframes agPulse{0%{box-shadow:0 0 0 0 rgba(179,38,30,.45)}70%{box-shadow:0 0 0 9px rgba(179,38,30,0)}100%{box-shadow:0 0 0 0 rgba(179,38,30,0)}}
.ag-now-t{position:absolute;right:4px;transform:translateY(-50%);background:var(--err);color:#fff;font-size:10.5px;font-weight:700;padding:2px 5px;border-radius:6px;z-index:7;font-variant-numeric:tabular-nums;line-height:1.3}
.ag-hover{position:absolute;left:3px;right:3px;border-radius:9px;border:1.5px dashed var(--brand);background:var(--brand-softer);color:var(--brand-strong);font-size:12px;font-weight:700;padding:4px 8px;pointer-events:none;z-index:1;display:flex;align-items:flex-start;gap:4px;animation:fadeIn .12s}
.ag-hover .ic{width:14px;height:14px;stroke-width:2.4}
.ag-hover.tap{animation:agTap .5s var(--ease-out) forwards}
@keyframes agTap{0%{opacity:0;transform:scale(.96)}30%{opacity:1;transform:none}100%{opacity:0}}
.ag-ghost{z-index:30!important;box-shadow:var(--shadow-3)!important;opacity:.96;pointer-events:none;transition:top .06s linear,left .08s var(--ease)!important;animation:none!important}
.ag-ghost.saving{opacity:.7}
.ag-ghost-t{position:absolute;right:5px;bottom:4px;background:var(--ink);color:var(--on-ink);font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis}
.ag-ev.ag-src{opacity:.3;animation:none!important;box-shadow:none}
body.ag-dragging,body.ag-dragging *{cursor:grabbing!important;user-select:none!important;-webkit-user-select:none!important}
.ag-flash{animation:agFlash 1.8s var(--ease)!important}
@keyframes agFlash{0%,100%{box-shadow:var(--shadow-1)}20%,60%{box-shadow:0 0 0 4px rgba(var(--c-rgb),.5),var(--shadow-2)}}
.ag-hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:9;display:flex;align-items:center;gap:12px;padding:10px 10px 10px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-2);font-size:13.5px;color:var(--text-2);width:max-content;max-width:calc(100% - 24px);animation:fadeUp .35s var(--ease-out)}
.ag-hint b{color:var(--text);display:block;font-size:14px}
.ag-hint .art{width:36px;height:36px;border-radius:11px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center;flex:none}
/* esqueleto */
.ag-sk{padding:0}
.ag-sk-h{display:flex;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border)}
.ag-sk-b{position:relative;height:460px}
.ag-sk-b .skel{position:absolute;border-radius:10px}
/* mes */
.ag-month{overflow:hidden;padding:0}
@media (max-width:719px){.ag-month{margin:0 -16px;border-radius:0;border-left:0;border-right:0}}
.ag-mh{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--border);background:var(--surface-2)}
.ag-mh span{padding:9px 4px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-3)}
.ag-mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.ag-mc{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:112px;padding:8px 10px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);text-align:left;transition:background-color .15s,box-shadow .15s;min-width:0}
.ag-mc:nth-child(7n){border-right:0}
.ag-mc:hover{background-color:var(--surface-2)!important}
.ag-mc.out{color:var(--text-3)}
.ag-mc.out>*{opacity:.55}
.ag-mc-d{font-weight:700;font-size:13.5px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;margin:-4px 0 2px -6px;font-variant-numeric:tabular-nums}
.ag-mc.today .ag-mc-d{background:var(--brand);color:var(--brand-ink)}
.ag-mc.sel{box-shadow:inset 0 0 0 2px var(--border-strong)}
.ag-mc-n{font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;line-height:1.2}
.ag-mc-n small{font-weight:500;color:var(--text-2);font-size:12px;margin-left:3px}
.ag-mc-r{font-size:12.5px;color:var(--text-2);font-variant-numeric:tabular-nums;font-weight:500}
.ag-mc-f{display:flex;flex-direction:column;gap:1px;margin-top:auto;padding-top:3px;min-width:0;max-width:100%}
.ag-mc-f span{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--st);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-mc-f span::before,.ag-mc-flag{content:"";width:7px;height:7px;border-radius:50%;background:var(--st);flex:none}
.ag-mc-flag{display:none;position:absolute;top:7px;right:7px}
.ag-mc-off{font-size:11px;color:var(--text-3)}
@media (max-width:719px){
  .ag-mc{min-height:66px;padding:6px 2px 7px;align-items:center;gap:3px}
  .ag-mc-r,.ag-mc-n small,.ag-mc-off,.ag-mc-f{display:none}
  .ag-mc-d{margin:0;font-size:13px;width:26px;height:26px}
  .ag-mc-n{font-size:11px;font-weight:600;color:var(--text-2);background:var(--muted-soft);border-radius:999px;min-width:22px;padding:1px 6px;text-align:center;line-height:1.35}
  .ag-mc-flag{display:block;top:5px;right:5px;width:6px;height:6px}
  .ag-legend .ag-lg-ns{display:none}
}
.ag-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2);background:var(--surface-2)}
.ag-legend span{display:inline-flex;align-items:center;gap:6px}
.ag-legend i{width:8px;height:8px;border-radius:50%;background:var(--st)}
.ag-legend i.heat{width:30px;height:10px;border-radius:3px;background:linear-gradient(90deg,rgba(196,154,60,.04),rgba(196,154,60,.2));box-shadow:inset 0 0 0 1px var(--border)}
/* lista */
.ag-list{display:grid;gap:20px}
.ag-lg-h{display:flex;align-items:baseline;gap:8px;margin:0 2px 8px;flex-wrap:wrap}
.ag-lg-d{font-family:var(--disp);font-size:21px;font-weight:800;line-height:1.1}
.ag-lg-d.today{color:var(--brand-strong)}
.ag-lg-f{font-size:13.5px;color:var(--text-2)}
.ag-lg-m{margin-left:auto;font-size:12.5px;color:var(--text-3);font-variant-numeric:tabular-nums}
.ag-lg-list{overflow:hidden}
.ag-row{display:flex;align-items:center;border-bottom:1px solid var(--border);position:relative;transition:background .12s;animation:fadeUp .3s var(--ease-out) both}
.ag-row:last-child{border-bottom:0}
.ag-row:hover{background:var(--surface-2)}
.ag-row-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0;padding:12px 6px 12px 14px;text-align:left;min-height:66px;border-radius:0}
.ag-row-time{display:grid;min-width:44px;font-variant-numeric:tabular-nums;line-height:1.25}
.ag-row-time b{font-size:15px}
.ag-row-time span{font-size:12px;color:var(--text-3)}
.ag-row-bar{width:4px;align-self:stretch;border-radius:3px;background:var(--c);flex:none;margin:2px 0}
.ag-row.st-pending .ag-row-bar{background:repeating-linear-gradient(var(--c) 0 4px,transparent 4px 7px)}
.ag-row.st-cancelled .ag-row-bar{background:var(--st-cancelled);opacity:.45}
.ag-row.st-no_show .ag-row-bar{background:var(--st-no_show)}
.ag-row.st-cancelled .ag-row-n,.ag-row.st-cancelled .ag-row-time b{text-decoration:line-through;color:var(--text-3)}
.ag-row-info{display:grid;min-width:0;flex:1}
.ag-row-n{font-weight:600;font-size:14.5px}
.ag-row-s{font-size:12.5px;color:var(--text-2)}
.ag-row-st{display:none;font-weight:600}
.ag-row-r{display:flex;align-items:center;gap:12px;flex:none}
.ag-row-p{font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;min-width:56px;text-align:right}
.ag-row-p.due{color:var(--warn)}
.ag-row-acts{display:flex;align-items:center;gap:4px;padding-right:10px;flex:none}
.ag-row-acts .btn-sm{--h:36px}
@media (max-width:719px){
  .ag-row-r .badge,.ag-row-acts .lbl{display:none}
  .ag-row-st{display:inline}
  .ag-row-main{padding-left:12px;gap:10px}
  .ag-row-acts{padding-right:6px}
  .ag-row-acts .btn-sm{--h:40px;width:40px;padding:0}
  .ag-row-p{min-width:0}
  .ag-lg-list{margin:0 -16px;border-radius:0;border-left:0;border-right:0}
}
.st-c-pending{--st:var(--st-pending)}.st-c-confirmed{--st:var(--st-confirmed)}.st-c-completed{--st:var(--st-completed)}.st-c-no_show{--st:var(--st-no_show)}.st-c-cancelled{--st:var(--st-cancelled)}
</style>`);
}

export default {
  title: 'Agenda',
  async render(el, { query }) {
    ensureStyles();
    el.classList.add('ag-page');
    const syncBleed = () => el.style.setProperty('--ag-bleed', getComputedStyle(el).paddingLeft);
    syncBleed();
    const own = !can('appointments.read.all');
    const writable = canAny(['appointments.write.all', 'appointments.write.own']);
    const payable = can('payments.write');
    const msgable = can('messages.send');
    const t0 = today();
    const savedView = LS.get(LSK.view);
    const qView = VIEW_ALIAS[String(query.vista || '').toLowerCase()] || query.vista;
    const S = {
      view: VIEWS.some((v) => v[0] === qView) ? qView : (VIEWS.some((v) => v[0] === savedView) ? savedView : 'day'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(query.fecha || '') ? query.fecha : t0,
      staff: own ? '' : (query.barbero || ''),
      cx: LS.get(LSK.cx) === '1', // canceladas ocultas salvo que el usuario las pida
      q: query.q || '', status: query.estado || '',
      appts: [], off: [], staffList: [], avail: {}, total: 0,
      loaded: false, err: null, range: null
    };
    let gone = false, seq = 0, availP = null, drag = null, pending = null, suppressClick = false, qTimer = null, scrollKey = '';
    const offs = [];

    el.innerHTML = String(html`
      <div class="ag-bar page-head">
        <h2 class="sr">Agenda</h2>
        <div class="ag-nav">
          <button type="button" class="btn btn-ghost btn-icon" data-nav="-1" aria-label="Anterior" title="Anterior (←)">${raw(icon('chevron-left'))}</button>
          <button type="button" class="btn btn-ghost btn-icon" data-nav="1" aria-label="Siguiente" title="Siguiente (→)">${raw(icon('chevron-right'))}</button>
          <div class="ag-mid">
            <div class="ag-date"><span class="ag-date-btn" id="agLabel" aria-hidden="true"></span>
              <input type="date" id="agDateIn" class="ag-date-in" aria-label="Ir a una fecha" title="Elegir fecha"/></div>
            <button type="button" class="btn btn-secondary btn-sm ag-today" data-nav="0" title="Ir a hoy (T)" hidden>Hoy</button>
          </div>
          <p class="ag-long" id="agLong"></p>
        </div>
        <div class="ag-tools">
          <button type="button" class="btn btn-secondary ag-filt" id="agFilt" aria-haspopup="menu" aria-label="Filtros" title="Filtros">${raw(icon('filter'))}<span class="lbl">Filtros</span><span class="ag-filt-dot" hidden></span></button>
          <div class="seg ag-views" role="group" aria-label="Vista de la agenda">
            ${VIEWS.map(([k, l]) => html`<button type="button" data-view="${k}" aria-pressed="${String(S.view === k)}" title="${l} (${k === 'week' ? 'S' : l.charAt(0)})">${l}</button>`)}
          </div>
        </div>
      </div>
      <div class="ag-filters" id="agFilters"></div>
      <div class="ag-listbar" id="agListBar" hidden>
        <div class="input-group">${raw(icon('search'))}<input class="input" id="agQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por cliente, teléfono o folio" aria-label="Buscar citas" value="${S.q}"/></div>
        <select class="select" id="agSt" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          ${ST_ORDER.map((s) => html`<option value="${s}" ${S.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`)}
        </select>
      </div>
      <div class="ag-stats" id="agStats" aria-live="polite"></div>
      <div id="agBody" class="ag-body-wrap"></div>`);

    const body = $('#agBody', el);

    // ── Utilidades de datos ──
    const byId = (id) => S.appts.find((a) => a.id === id);
    const showCx = () => S.cx || (S.view === 'list' && S.status === 'cancelled');
    const shown = (list) => list.filter((a) => (a.status !== 'cancelled' || showCx()) && (!S.staff || a.staff_id === S.staff));
    const staffById = (id) => S.staffList.find((s) => s.id === id);
    const colorOf = (a) => a.staff_color || (staffById(a.staff_id) || {}).color || '#8C8577';
    function blocksFor(staffId, date) {
      const w = S.avail[staffId];
      let bl;
      if (w) bl = w[weekday(date)] || w[String(weekday(date))] || [];
      else { const h = (shop() && shop().settings && shop().settings.hours) || {}; bl = h[weekday(date)] || h[String(weekday(date))] || []; }
      return bl.filter((b) => Array.isArray(b) && b[1] > b[0]);
    }
    const offFor = (staffId, date) => S.off.filter((t) => (t.staff_id == null || t.staff_id === staffId) && t.date_from <= date && t.date_to >= date);
    const fullDayOff = (staffId, date) => offFor(staffId, date).find((t) => t.start_min == null || t.end_min == null);
    function range() {
      if (S.view === 'day') return [S.date, S.date];
      if (S.view === 'month') { const a = startOfWeek(startOfMonth(S.date)); return [a, addDays(startOfWeek(endOfMonth(S.date)), 6)]; }
      if (S.view === 'list' && S.q.trim()) return [addDays(S.date, -180), addDays(S.date, 180)];
      const a = startOfWeek(S.date); return [a, addDays(a, 6)];
    }
    function columns(dateAppts) {
      if (own) return S.staffList.length ? S.staffList : (me() ? [me()] : []);
      const withAppts = new Set(dateAppts.map((a) => a.staff_id));
      let cols = S.staffList.filter((s) => s.bookable !== false || withAppts.has(s.id));
      if (!cols.length) cols = S.staffList.slice();
      for (const a of dateAppts) if (!cols.some((c) => c.id === a.staff_id)) cols.push({ id: a.staff_id, name: a.staff_name || 'Sin asignar', color: a.staff_color || '#8C8577', ghost: true });
      if (S.staff) cols = cols.filter((c) => c.id === S.staff);
      return cols;
    }
    function lanes(items, ppm) {
      const arr = items.map((a) => ({ a, s: a.start_min, e: Math.max(a.end_min, a.start_min + Math.ceil(MIN_H / ppm)) }))
        .sort((x, y) => x.s - y.s || y.e - x.e);
      let cl = [], end = -1;
      const flush = () => { const ends = []; for (const it of cl) { let l = ends.findIndex((e) => e <= it.s); if (l < 0) { l = ends.length; ends.push(it.e); } else ends[l] = it.e; it.lane = l; } for (const it of cl) it.lanes = ends.length; cl = []; };
      for (const it of arr) { if (cl.length && it.s >= end) flush(); if (!cl.length) end = it.e; cl.push(it); end = Math.max(end, it.e); }
      flush();
      return arr;
    }
    const sumTotal = (xs) => xs.reduce((m, a) => m + (Number(a.total) || 0), 0);

    // ── Encabezado: etiqueta, resumen, filtros ──
    function labelHtml() {
      const [a, b] = S.range || range();
      if (S.view === 'day') {
        const rd = relDay(S.date, today());
        const special = ['Hoy', 'Mañana', 'Ayer'].includes(rd);
        return (special ? '<span class="rel">' + rd + '</span> · ' : '') + esc(cap(dateShort(S.date))) + icon('chevron-down', 'ic-sm');
      }
      if (S.view === 'month') return esc(cap(MONTHS[+S.date.slice(5, 7) - 1]) + ' ' + S.date.slice(0, 4)) + icon('chevron-down', 'ic-sm');
      if (S.view === 'list' && S.q.trim()) return 'Resultados' + icon('chevron-down', 'ic-sm');
      const ma = +a.slice(5, 7) - 1, mb = +b.slice(5, 7) - 1;
      return esc(dayNum(a) + (ma !== mb ? ' ' + MONTHS_SHORT[ma] : '') + ' – ' + dayNum(b) + ' ' + MONTHS_SHORT[mb]) + icon('chevron-down', 'ic-sm');
    }
    function longText() {
      const [a, b] = S.range || range();
      if (S.view === 'day') return dateLongCap(S.date) + (S.date === today() ? ' · hoy' : '');
      if (S.view === 'month') return 'Todo ' + MONTHS[+S.date.slice(5, 7) - 1] + ' de ' + S.date.slice(0, 4) + ' de un vistazo';
      if (S.view === 'list' && S.q.trim()) return 'Buscando «' + S.q.trim() + '» en 6 meses antes y después';
      return 'Semana del ' + dayNum(a) + ' de ' + MONTHS[+a.slice(5, 7) - 1] + ' al ' + dayNum(b) + ' de ' + MONTHS[+b.slice(5, 7) - 1];
    }
    function paintHeader() {
      $('#agLabel', el).innerHTML = labelHtml();
      $('#agLong', el).textContent = longText();
      $('#agDateIn', el).value = S.date;
      $$('[data-view]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
      // «Hoy» solo cuando sirve: si el periodo ya incluye hoy (o el título dice Mañana/Ayer) sobraría.
      const [a, b] = S.range || range();
      const t = today();
      $('.ag-today', el).hidden = (t >= a && t <= b) || (S.view === 'day' && Math.abs(diffDays(t, S.date)) <= 1);
      const fb = $('#agFilt', el);
      fb.hidden = S.view === 'month'; // en Mes no se dibujan citas sueltas: el filtro no cambiaría nada
      $('.ag-filt-dot', fb).hidden = !S.cx;
      fb.setAttribute('aria-label', S.cx ? 'Filtros (mostrando canceladas)' : 'Filtros');
      $('#agListBar', el).hidden = S.view !== 'list';
    }
    function paintFilters() {
      const f = $('#agFilters', el);
      const [a, b] = S.range || range();
      const inMonth = (x) => S.view !== 'month' || x.date.slice(0, 7) === S.date.slice(0, 7);
      const act = S.appts.filter((x) => OCC.includes(x.status) && inMonth(x) && x.date >= a && x.date <= b);
      let chips = '';
      if (!own && S.staffList.length > 1) {
        const cnt = (id) => act.filter((x) => !id || x.staff_id === id).length;
        chips = '<div class="ag-chips" role="group" aria-label="Filtrar por barbero">' +
          '<button type="button" class="chip" data-staff="" aria-pressed="' + String(!S.staff) + '">' + icon('users', 'ic-sm') + 'Todos <span class="n">' + cnt('') + '</span></button>' +
          S.staffList.filter((s) => s.bookable !== false || act.some((x) => x.staff_id === s.id)).map((s) => '<button type="button" class="chip" data-staff="' + esc(s.id) + '" aria-pressed="' + String(S.staff === s.id) + '" style="--c:' + esc(s.color || '#8C8577') + ';--c-rgb:' + hexRgb(s.color) + '"><span class="ag-dot"></span>' + esc(firstName(s.name)) + ' <span class="n">' + cnt(s.id) + '</span></button>').join('') + '</div>';
      }
      f.innerHTML = chips; // «Canceladas» vive en el menú de filtros (#agFilt), igual en móvil y escritorio
    }
    function paintStats(xs) {
      const st = $('#agStats', el);
      if (!S.loaded) { st.innerHTML = '<span class="ag-stat skel"></span><span class="ag-stat skel" style="width:140px"></span><span class="ag-stat skel" style="width:96px"></span>'; return; }
      const act = xs.filter((a) => OCC.includes(a.status));
      const pend = xs.filter((a) => a.status === 'pending').length;
      const due = xs.filter((a) => a.status === 'completed' && a.balance > 0);
      const done = xs.filter((a) => a.status === 'completed').length;
      const canc = xs.filter((a) => a.status === 'cancelled').length;
      const ns = xs.filter((a) => a.status === 'no_show').length;
      const period = S.view === 'day' ? (S.date === today() ? 'hoy' : 'este día') : S.view === 'month' ? 'este mes' : 'esta semana';
      const past = S.range[1] < today() || (act.length && act.every((a) => a.status === 'completed'));
      let h = '<span class="ag-stat">' + icon('calendar') + '<b>' + act.length + '</b> ' + (act.length === 1 ? 'cita' : 'citas') + '</span>' +
        '<span class="ag-stat">' + icon('wallet') + '<b>' + esc(money(sumTotal(act))) + '</b> ' + (past ? 'en servicios' : 'esperados') + '</span>';
      if (pend) h += '<button type="button" class="ag-stat warn" data-stat="pending"><b>' + pend + '</b> por confirmar</button>';
      if (done && S.view === 'day') h += '<span class="ag-stat ok"><b>' + done + '</b> ' + (done === 1 ? 'atendida' : 'atendidas') + '</span>';
      if (due.length && payable) h += '<button type="button" class="ag-stat warn" data-stat="due"><b>' + esc(money(sumTotal(due) - due.reduce((m, a) => m + (a.paid || 0), 0))) + '</b> por cobrar</button>';
      if (ns) h += '<button type="button" class="ag-stat err" data-stat="no_show"><b>' + ns + '</b> no ' + (ns === 1 ? 'asistió' : 'asistieron') + '</button>';
      if (canc) h += '<button type="button" class="ag-stat" data-stat="cancelled"><b>' + canc + '</b> ' + (canc === 1 ? 'cancelada' : 'canceladas') + '</button>';
      if (!xs.length) h = '<span class="ag-stat">' + icon('calendar') + 'Sin citas ' + period + '</span>';
      st.innerHTML = h;
    }

    // ── Esqueleto ──
    function skeleton() {
      if (S.view === 'list') return '<div class="card">' + String(raw('<div aria-busy="true">' + '<div class="skel-row"><div class="skel" style="width:44px;height:34px"></div><div style="flex:1"><div class="skel skel-line" style="width:45%"></div><div class="skel skel-line" style="width:30%;height:10px"></div></div></div>'.repeat(6) + '</div>')) + '</div>';
      if (S.view === 'month') return '<div class="card ag-month"><div class="ag-mh">' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<span>' + WEEKDAYS_SHORT[d] + '</span>').join('') + '</div><div class="ag-mg">' + '<div class="ag-mc"><div class="skel" style="width:22px;height:18px"></div><div class="skel skel-line" style="width:60%"></div></div>'.repeat(35) + '</div></div>';
      const n = isMobile() ? 2 : 4;
      let blocks = '';
      const seed = [[0, 30, 90], [1, 140, 60], [0, 260, 120], [2, 60, 70], [3, 200, 90], [1, 330, 60], [2, 300, 80], [3, 40, 60]];
      for (const [c, t, h] of seed) if (c < n) blocks += '<div class="skel" style="left:calc(60px + ' + c + ' * (100% - 60px) / ' + n + ' + 6px);width:calc((100% - 60px) / ' + n + ' - 12px);top:' + t + 'px;height:' + h + 'px"></div>';
      return '<div class="card ag-cal ag-sk" aria-busy="true" aria-label="Cargando agenda"><div class="ag-sk-h">' + '<div class="row" style="flex:1"><div class="skel" style="width:32px;height:32px;border-radius:50%"></div><div class="skel skel-line" style="width:60%"></div></div>'.repeat(n) + '</div><div class="ag-sk-b">' + blocks + '</div></div>';
    }

    // ── Bloque de cita ──
    function evHtml(a, lay, rs, ppm, o) {
      const top = (a.start_min - rs) * ppm + 1;
      const h = Math.max(MIN_H, (a.end_min - a.start_min) * ppm - 2);
      const sz = h < 36 ? 'xs' : h < 60 ? 'sm' : '';
      const narrow = o.week && (lay.lanes >= 3 || (isMobile() && lay.lanes >= 2));
      const name = o.week ? firstName(a.client_name || 'Cliente') : (a.client_name || 'Cliente');
      const c = colorOf(a);
      const svc = (a.services || []).map((s) => s.name).join(', ');
      const stIc = { completed: 'check-circle', no_show: 'user-x', pending: 'clock', cancelled: 'x-circle' }[a.status];
      const due = a.status === 'completed' && a.balance > 0 && payable;
      const label = time(a.start_min) + ' a ' + time(a.end_min) + ', ' + (a.client_name || 'Cliente') + ', ' + svc + ', ' + statusLabel(a.status) + (own ? '' : ', con ' + a.staff_name);
      return '<button type="button" class="ag-ev st-' + esc(a.status) + ' ' + sz + (narrow ? ' narrow' : '') + '" data-id="' + esc(a.id) + '" style="top:' + top + 'px;height:' + h + 'px;left:calc(' + lay.lane + ' * 100% / ' + lay.lanes + ' + 2px);width:calc(100% / ' + lay.lanes + ' - 4px);--c:' + esc(c) + ';--c-rgb:' + hexRgb(c) + '" aria-label="' + esc(label) + '">' +
        '<span class="ag-ev-h"><span class="ag-ev-n"><span class="ag-ev-tt">' + time(a.start_min) + '</span>' + esc(name) + '</span>' + (stIc ? icon(stIc, 'ag-ev-i') : '') + '</span>' +
        '<span class="ag-ev-t">' + time(a.start_min) + (narrow ? '' : '–' + time(a.end_min)) + (o.showStaff && !narrow ? ' · ' + esc(firstName(a.staff_name)) : '') + '</span>' +
        '<span class="ag-ev-s">' + esc(svc) + '</span>' + (due ? '<span class="ag-ev-due">Por cobrar</span>' : '') + '</button>';
    }
    function offHtml(blocks, rs, re, ppm, label) {
      if (!blocks.length) return '<div class="ag-off" style="top:0;height:' + ((re - rs) * ppm) + 'px"><span class="ag-off-l">' + esc(label || 'No trabaja este día') + '</span></div>';
      let h = '', cur = rs;
      for (const [s, e] of blocks.slice().sort((x, y) => x[0] - y[0])) {
        if (s > cur) h += '<div class="ag-off" style="top:' + (Math.max(cur, rs) - rs) * ppm + 'px;height:' + (Math.min(s, re) - Math.max(cur, rs)) * ppm + 'px"></div>';
        cur = Math.max(cur, e);
      }
      if (cur < re) h += '<div class="ag-off" style="top:' + (cur - rs) * ppm + 'px;height:' + (re - cur) * ppm + 'px"></div>';
      return h;
    }
    function toHtml(list, rs, re, ppm) {
      return list.map((t) => {
        const full = t.start_min == null || t.end_min == null;
        const s = full ? rs : Math.max(rs, t.start_min), e = full ? re : Math.min(re, t.end_min);
        if (e <= s) return '';
        return '<div class="ag-to" style="top:' + ((s - rs) * ppm + 1) + 'px;height:' + ((e - s) * ppm - 2) + 'px">' + icon('ban') + '<span>' + esc((full ? 'Descanso' : 'Descanso ' + time(t.start_min) + '–' + time(t.end_min)) + (t.reason ? ' · ' + t.reason : '')) + '</span></div>';
      }).join('');
    }
    function hoursRange(pairs, list) {
      let rs = 1440, re = 0;
      for (const [s, e] of pairs) { rs = Math.min(rs, s); re = Math.max(re, e); }
      for (const a of list) { rs = Math.min(rs, a.start_min); re = Math.max(re, a.end_min); }
      if (re <= rs) { rs = 9 * 60; re = 20 * 60; }
      rs = Math.floor(rs / 60) * 60; re = Math.min(1440, Math.ceil(re / 60) * 60);
      if (re - rs < 5 * 60) { re = Math.min(1440, rs + 5 * 60); rs = Math.max(0, re - 5 * 60); }
      return [rs, re];
    }
    function gutterHtml(rs, re, ppm, isToday) {
      let h = '';
      for (let m = rs; m <= re; m += 60) h += '<span class="ag-hl" style="top:' + ((m - rs) * ppm) + 'px">' + (m === 1440 ? '24:00' : hourLabel(m)) + '</span>';
      const nm = nowMin();
      if (isToday && nm >= rs && nm <= re) h += '<span class="ag-now-t" style="top:' + ((nm - rs) * ppm) + 'px">' + time(nm) + '</span>';
      return '<div class="ag-gutter" aria-hidden="true">' + h + '</div>';
    }
    const nowLine = (rs, re, ppm, first) => { const nm = nowMin(); return nm >= rs && nm <= re ? '<div class="ag-now' + (first ? ' first' : '') + '" style="top:' + ((nm - rs) * ppm) + 'px"></div>' : ''; };

    // ── Vista Día ──
    function dayHtml() {
      const date = S.date;
      const all = S.appts.filter((a) => a.date === date);
      const list = shown(all);
      const cols = columns(all.filter((a) => S.cx || a.status !== 'cancelled'));
      if (!cols.length) return noStaffHtml();
      const ppm = isMobile() ? 1.5 : 1.6;
      const pairs = [];
      for (const c of cols) if (!fullDayOff(c.id, date)) pairs.push(...blocksFor(c.id, date));
      const [rs, re] = hoursRange(pairs, list);
      const isToday = date === today();
      const heads = cols.map((c) => {
        const xs = list.filter((a) => a.staff_id === c.id && OCC.includes(a.status));
        const offDay = !blocksFor(c.id, date).length || !!fullDayOff(c.id, date);
        const color = c.color || '#8C8577';
        return '<div class="ag-ch' + (offDay ? ' off' : '') + '" style="--c:' + esc(color) + '">' + avatar(c.name, { size: 'sm', color, src: c.avatar_url || '' }) +
          '<div class="grow" style="min-width:0"><div class="ag-ch-n truncate">' + esc(c.name) + '</div><div class="ag-ch-m">' + (offDay && !xs.length ? 'No trabaja hoy' : esc(plural(xs.length, 'cita') + ' · ' + money(sumTotal(xs)))) + '</div></div></div>';
      }).join('');
      const bodies = cols.map((c, i) => {
        const fo = fullDayOff(c.id, date);
        const bl = fo ? [] : blocksFor(c.id, date);
        const items = lanes(list.filter((a) => a.staff_id === c.id), ppm);
        return '<div class="ag-col' + (isToday ? ' today' : '') + '" data-staff="' + esc(c.id) + '" data-date="' + date + '" aria-label="' + esc('Agenda de ' + c.name) + '">' +
          offHtml(bl, rs, re, ppm, fo ? 'Descanso' + (fo.reason ? ' · ' + fo.reason : '') : '') +
          toHtml(offFor(c.id, date).filter((t) => t.start_min != null && t.end_min != null), rs, re, ppm) +
          items.map((it) => evHtml(it.a, it, rs, ppm, { showStaff: false })).join('') +
          (isToday ? nowLine(rs, re, ppm, i === 0) : '') + '</div>';
      }).join('');
      const closed = cols.every((c) => !!fullDayOff(c.id, date) || !blocksFor(c.id, date).length);
      const empty = !list.length && writable ? '<div class="ag-hint" role="note"><span class="art">' + icon(closed ? 'store' : 'calendar-plus') + '</span><span><b>' + (closed ? 'Este día no hay servicio' : isToday ? 'Día libre por ahora' : 'Sin citas este día') + '</b>' +
        (closed ? 'Si vas a atender a alguien, agéndalo de todas formas.' : 'Toca cualquier horario para agendar.') + '</span><button type="button" class="btn btn-primary btn-sm" data-a="new">Agendar</button></div>' : '';
      // Con una sola columna (barbero o filtro por barbero) la cabecera repetiría el resumen de arriba.
      const one = cols.length === 1;
      return '<div class="card ag-cal ag-dayv' + (writable ? ' w' : '') + '" style="--n:' + cols.length + ';--hour:' + (60 * ppm) + 'px">' +
        '<div class="ag-scroll" id="agScroll" data-rs="' + rs + '" data-re="' + re + '" data-ppm="' + ppm + '" data-kind="day">' +
        '<div class="ag-grid' + (one ? ' one nohead' : '') + '">' +
        (one ? '' : '<div class="ag-hrow"><div class="ag-corner"></div>' + heads + '</div>') +
        '<div class="ag-brow" style="height:' + ((re - rs) * ppm + 26) + 'px">' + gutterHtml(rs, re, ppm, isToday) + bodies + '</div>' +
        '</div></div>' + empty + '</div>';
    }

    // ── Vista Semana ──
    const weekHeads = (days, list, t) => days.map((d) => {
      const xs = list.filter((a) => a.date === d && OCC.includes(a.status));
      return '<button type="button" class="ag-ch ag-wh' + (d === t ? ' today' : '') + '" data-go="' + d + '" aria-label="' + esc('Ver ' + dateLongCap(d)) + '"><span class="dow">' + esc(WEEKDAYS_SHORT[weekday(d)]) + '</span><span class="dn">' + dayNum(d) + '</span><span class="cnt">' + (xs.length ? esc(plural(xs.length, 'cita')) : '—') + '</span></button>';
    }).join('');
    function weekHtml() {
      const [from] = S.range;
      const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
      const all = S.appts.filter((a) => a.date >= from && a.date <= days[6]);
      const list = shown(all);
      // Dueño con «Todos»: una fila por barbero. Mezclar a todo el equipo en una sola cuadrícula de horas
      // deja tiras de 25–40 px ilegibles; la cuadrícula de horas queda para una sola persona.
      if (!own && !S.staff) { const rows = columns(list); if (rows.length > 1) return rosterHtml(days, list, rows); }
      const staffCols = own ? (S.staffList.length ? S.staffList : (me() ? [me()] : [])) : (S.staff ? S.staffList.filter((s) => s.id === S.staff) : S.staffList.filter((s) => s.bookable !== false));
      const ppm = isMobile() ? 1.1 : 1.15;
      const pairs = [];
      for (const d of days) for (const s of staffCols) if (!fullDayOff(s.id, d)) pairs.push(...blocksFor(s.id, d));
      const [rs, re] = hoursRange(pairs, list);
      const t = today();
      const heads = weekHeads(days, list, t);
      const bodies = days.map((d, i) => {
        const union = [];
        for (const s of staffCols) if (!fullDayOff(s.id, d)) union.push(...blocksFor(s.id, d));
        const merged = [];
        for (const b of union.slice().sort((x, y) => x[0] - y[0])) { const l = merged[merged.length - 1]; if (l && b[0] <= l[1]) l[1] = Math.max(l[1], b[1]); else merged.push(b.slice()); }
        const tos = S.off.filter((x) => (x.staff_id == null || (staffCols.length === 1 && x.staff_id === staffCols[0].id)) && x.date_from <= d && x.date_to >= d);
        const items = lanes(list.filter((a) => a.date === d), ppm);
        return '<div class="ag-col' + (d === t ? ' today' : '') + '" data-date="' + d + '"' + (staffCols.length === 1 ? ' data-staff="' + esc(staffCols[0].id) + '"' : '') + ' aria-label="' + esc(dateLongCap(d)) + '">' +
          offHtml(merged, rs, re, ppm, 'Cerrado') + toHtml(tos, rs, re, ppm) +
          items.map((it) => evHtml(it.a, it, rs, ppm, { week: true, showStaff: !own && !S.staff && it.lanes < 3 })).join('') +
          (d === t ? nowLine(rs, re, ppm, true) : '') + '</div>';
      }).join('');
      return '<div class="card ag-cal ag-weekv' + (writable ? ' w' : '') + '" style="--n:7;--hour:' + (60 * ppm) + 'px">' +
        '<div class="ag-scroll" id="agScroll" data-rs="' + rs + '" data-re="' + re + '" data-ppm="' + ppm + '" data-kind="week">' +
        '<div class="ag-grid"><div class="ag-hrow"><div class="ag-corner"></div>' + heads + '</div>' +
        '<div class="ag-brow" style="height:' + ((re - rs) * ppm + 26) + 'px">' + gutterHtml(rs, re, ppm, days.includes(t)) + bodies + '</div></div></div></div>';
    }

    // Semana por barbero: filas = barberos (con su color), columnas = días; cada celda lista sus citas
    // («10:20 Víctor»). Tocar el nombre filtra a ese barbero (cuadrícula de horas); tocar un hueco agenda.
    function riHtml(a) {
      const c = colorOf(a);
      const svc = (a.services || []).map((s) => s.name).join(', ');
      const stIc = { no_show: 'user-x', pending: 'clock', cancelled: 'x-circle' }[a.status]; // atendida: sin icono (ruido)
      const full = time(a.start_min) + '–' + time(a.end_min) + ' · ' + (a.client_name || 'Cliente') + (svc ? ' · ' + svc : '') + ' · ' + statusLabel(a.status);
      return '<button type="button" class="ag-ri st-' + esc(a.status) + '" data-id="' + esc(a.id) + '" data-open="' + esc(a.id) + '" style="--c:' + esc(c) + ';--c-rgb:' + hexRgb(c) + '" title="' + esc(full) + '" aria-label="' + esc(cap(dateShort(a.date)) + ', ' + full + ', con ' + (a.staff_name || '')) + '">' +
        '<span class="ag-ri-t">' + time(a.start_min) + '</span><span class="ag-ri-n">' + esc(firstName(a.client_name || 'Cliente')) + '</span>' + (stIc ? icon(stIc, 'ag-ri-i') : '') + '</button>';
    }
    function rosterHtml(days, list, rows) {
      const t = today();
      const works = (s, d) => !s.ghost && blocksFor(s.id, d).length > 0 && !fullDayOff(s.id, d);
      const closed = days.map((d) => rows.every((s) => !works(s, d)));
      const body = rows.map((s, ri) => {
        const mine = list.filter((a) => a.staff_id === s.id);
        const n = mine.filter((a) => OCC.includes(a.status)).length;
        const color = s.color || '#8C8577';
        const hd = String(avatar(s.name, { size: 'sm', color, src: s.avatar_url || '' })) + '<span class="ag-rh-t"><span class="ag-rh-n">' + esc(firstName(s.name)) + '</span><span class="ag-rh-m">' + esc(plural(n, 'cita')) + '</span></span>';
        const head = s.ghost ? '<div class="ag-rh" style="--c:' + esc(color) + '">' + hd + '</div>'
          : '<button type="button" class="ag-rh" data-staff="' + esc(s.id) + '" style="--c:' + esc(color) + '" title="' + esc('Ver solo la semana de ' + s.name) + '" aria-label="' + esc(s.name + ': ' + plural(n, 'cita') + '. Ver solo su semana') + '">' + hd + '</button>';
        const cells = days.map((d, di) => {
          const on = s.ghost || works(s, d);
          const fo = on ? null : fullDayOff(s.id, d);
          const items = mine.filter((a) => a.date === d).map((a) => [a.start_min, riHtml(a)]);
          const tos = s.ghost ? [] : offFor(s.id, d).filter((x) => x.start_min != null && x.end_min != null)
            .map((x) => [x.start_min, '<span class="ag-ri to" title="' + esc('Descanso ' + time(x.start_min) + '–' + time(x.end_min) + (x.reason ? ' · ' + x.reason : '')) + '"><span class="ag-ri-n">' + esc('Descanso ' + time(x.start_min)) + '</span></span>']);
          const inner = items.concat(tos).sort((x, y) => x[0] - y[0]).map((x) => x[1]).join('');
          // Día cerrado para todos: la etiqueta va solo en la primera fila para no repetirla.
          const label = on || items.length ? '' : fo ? 'Descanso' + (fo.reason ? ' · ' + fo.reason : '') : closed[di] ? (ri === 0 ? 'Cerrado' : '') : 'No trabaja';
          return '<div class="ag-rc' + (d === t ? ' today' : '') + (on ? '' : ' off') + '" data-date="' + d + '"' + (s.ghost ? '' : ' data-sid="' + esc(s.id) + '"') + '>' + inner + (label ? '<span class="ag-rc-l">' + esc(label) + '</span>' : '') + '</div>';
        }).join('');
        return '<div class="ag-rrow">' + head + cells + '</div>';
      }).join('');
      return '<div class="card ag-cal ag-rosterv' + (writable ? ' w' : '') + '" style="--n:7">' +
        '<div class="ag-scroll" id="agScroll" data-kind="roster">' +
        '<div class="ag-rgrid"><div class="ag-hrow"><div class="ag-corner"></div>' + weekHeads(days, list, t) + '</div>' + body + '</div></div></div>';
    }

    // ── Vista Mes ──
    function monthHtml() {
      const [from, to] = S.range;
      const month = S.date.slice(0, 7);
      const t = today();
      const list = shown(S.appts);
      const byDay = {};
      for (const a of list) (byDay[a.date] = byDay[a.date] || []).push(a);
      let max = 1;
      for (const k of Object.keys(byDay)) max = Math.max(max, byDay[k].filter((a) => OCC.includes(a.status)).length);
      const staffCols = own ? S.staffList : (S.staff ? S.staffList.filter((s) => s.id === S.staff) : S.staffList.filter((s) => s.bookable !== false));
      let cells = '';
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const xs = byDay[d] || [];
        const act = xs.filter((a) => OCC.includes(a.status));
        const rev = sumTotal(act);
        const out = d.slice(0, 7) !== month;
        const closed = staffCols.length && staffCols.every((s) => !blocksFor(s.id, d).length || fullDayOff(s.id, d));
        // Días de otro mes: solo el número (sus citas se ven al cambiar de mes).
        const heat = act.length && !out ? (0.025 + 0.11 * (act.length / max)).toFixed(3) : 0;
        // En lugar de un punto por cita (casi todos del mismo color) solo se marca lo que pide atención.
        const pend = out ? 0 : xs.filter((a) => a.status === 'pending').length;
        const ns = out ? 0 : xs.filter((a) => a.status === 'no_show').length;
        const flags = (pend ? '<span class="st-c-pending">' + pend + ' por confirmar</span>' : '') + (ns ? '<span class="st-c-no_show">' + ns + ' no ' + (ns === 1 ? 'asistió' : 'asistieron') + '</span>' : '');
        const sr = act.length ? plural(act.length, 'cita') + ', ' + money(rev) + (pend ? ', ' + pend + ' por confirmar' : '') + (ns ? ', ' + ns + ' no ' + (ns === 1 ? 'asistió' : 'asistieron') : '') : 'sin citas';
        cells += '<button type="button" class="ag-mc' + (out ? ' out' : '') + (d === t ? ' today' : '') + (d === S.date && d !== t && S.date !== startOfMonth(S.date) ? ' sel' : '') + '" data-go="' + d + '"' +
          (heat ? ' style="background-color:rgba(196,154,60,' + heat + ')"' : '') + ' aria-label="' + esc(dateLongCap(d) + (out ? '' : ': ' + sr)) + '">' +
          '<span class="ag-mc-d">' + dayNum(d) + '</span>' +
          (out ? '' : act.length ? '<span class="ag-mc-n">' + act.length + '<small>' + (act.length === 1 ? 'cita' : 'citas') + '</small></span><span class="ag-mc-r">' + esc(compactMoney(rev)) + '</span>' : (closed ? '<span class="ag-mc-off">Cerrado</span>' : '')) +
          (flags ? '<span class="ag-mc-f" aria-hidden="true">' + flags + '</span>' : '') + (pend ? '<i class="ag-mc-flag st-c-pending" aria-hidden="true"></i>' : '') +
          '</button>';
      }
      const legend = '<span><i class="heat"></i>Tono más intenso = más citas</span><span class="st-c-pending"><i></i>Por confirmar</span><span class="st-c-no_show ag-lg-ns"><i></i>No asistió</span>';
      return '<div class="card ag-month"><div class="ag-mh">' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<span>' + WEEKDAYS_SHORT[d] + '</span>').join('') + '</div>' +
        '<div class="ag-mg stagger-off">' + cells + '</div><div class="ag-legend">' + legend + '</div></div>';
    }

    // ── Vista Lista ──
    function quickFor(a) {
      if (!writable && !payable) return '';
      const started = a.date < today() || (a.date === today() && a.start_min <= nowMin() + 60);
      if (writable && a.status === 'pending') return '<button type="button" class="btn btn-secondary btn-sm" data-q="confirm" title="Confirmar">' + icon('check-circle', 'ic-sm') + '<span class="lbl">Confirmar</span></button>';
      if (writable && a.status === 'confirmed' && started) return '<button type="button" class="btn btn-secondary btn-sm" data-q="complete" title="Marcar atendida">' + icon('check', 'ic-sm') + '<span class="lbl">Atendida</span></button>';
      if (payable && a.status === 'completed' && a.balance > 0) return '<button type="button" class="btn btn-secondary btn-sm" data-q="pay" title="Cobrar">' + icon('cash', 'ic-sm') + '<span class="lbl">Cobrar</span></button>';
      return '';
    }
    function listHtml() {
      let xs = shown(S.appts);
      if (S.status) xs = xs.filter((a) => a.status === S.status);
      if (!xs.length) {
        const searching = S.q.trim() || S.status;
        return String(emptyState({
          icon: searching ? 'search' : 'calendar',
          title: searching ? 'No encontramos citas' : 'No hay citas esta semana',
          text: searching ? 'Prueba con otro nombre, teléfono o folio, o quita el filtro de estado.' : 'Cuando agendes o te reserven en línea, las verás aquí agrupadas por día.',
          action: searching ? { label: 'Limpiar búsqueda', id: 'agClear', icon: 'x' } : (writable ? { label: 'Agendar cita', id: 'agEmptyNew', icon: 'plus' } : null)
        }));
      }
      const t = today();
      const groups = [];
      for (const a of xs) { let g = groups[groups.length - 1]; if (!g || g.date !== a.date) { g = { date: a.date, items: [] }; groups.push(g); } g.items.push(a); }
      return '<div class="ag-list">' + groups.map((g) => {
        const act = g.items.filter((a) => OCC.includes(a.status));
        const rd = relDay(g.date, t);
        const special = ['Hoy', 'Mañana', 'Ayer'].includes(rd);
        return '<section><div class="ag-lg-h"><span class="ag-lg-d' + (g.date === t ? ' today' : '') + '">' + esc(special ? rd : cap(WEEKDAYS_SHORT[weekday(g.date)]) + ' ' + dayNum(g.date)) + '</span><span class="ag-lg-f">' + esc(dateLongCap(g.date)) + '</span><span class="ag-lg-m">' + esc(plural(act.length, 'cita') + ' · ' + money(sumTotal(act))) + '</span></div>' +
          '<div class="card ag-lg-list">' + g.items.map((a) => {
            const c = colorOf(a);
            const due = a.status === 'completed' && a.balance > 0;
            const svc = (a.services || []).map((s) => s.name).join(', ');
            const more = writable || payable || msgable;
            return '<div class="ag-row st-' + esc(a.status) + '" data-id="' + esc(a.id) + '" style="--c:' + esc(c) + ';--c-rgb:' + hexRgb(c) + '">' +
              '<button type="button" class="ag-row-main" data-open="' + esc(a.id) + '" aria-label="' + esc('Ver cita de ' + (a.client_name || 'cliente') + ' a las ' + time(a.start_min)) + '">' +
              '<span class="ag-row-time"><b>' + time(a.start_min) + '</b><span>' + time(a.end_min) + '</span></span><span class="ag-row-bar"></span>' +
              '<span class="ag-row-info"><span class="ag-row-n truncate">' + esc(a.client_name || 'Cliente') + '</span><span class="ag-row-s truncate">' + esc(svc) + (own ? '' : ' · ' + esc(firstName(a.staff_name))) +
              '<span class="ag-row-st" style="color:var(--st-' + esc(a.status) + ')"> · ' + esc(statusLabel(a.status)) + '</span></span></span>' +
              '<span class="ag-row-r">' + String(statusBadge(a.status)) + '<span class="ag-row-p' + (due ? ' due' : '') + '">' + esc(money(a.total)) + '</span></span></button>' +
              '<div class="ag-row-acts">' + quickFor(a) + (more ? '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-q="more" aria-label="Más acciones">' + icon('more') + '</button>' : '') + '</div></div>';
          }).join('') + '</div></section>';
      }).join('') + '</div>';
    }

    function noStaffHtml() {
      return String(emptyState({ icon: 'scissors', title: 'Aún no hay barberos en tu equipo', text: 'Agrega a tu equipo para empezar a recibir citas en la agenda.', action: can('staff.manage') ? { label: 'Ir a Equipo', href: '#/equipo', icon: 'plus' } : null }));
    }

    // ── Pintar ──
    // El resumen cuenta también las canceladas (aunque estén ocultas) para ofrecer el acceso «N canceladas».
    function statsSource() {
      const [a, b] = S.range;
      return S.appts.filter((x) => (!S.staff || x.staff_id === S.staff) && x.date >= a && x.date <= b &&
        (S.view !== 'month' || x.date.slice(0, 7) === S.date.slice(0, 7)) &&
        (S.view !== 'list' || !S.status || x.status === S.status));
    }
    function paint(o) {
      o = o || {};
      paintHeader();
      paintFilters();
      if (S.err) { paintStats([]); $('#agStats', el).innerHTML = ''; body.innerHTML = String(errorState(S.err, 'agRetry')); return; }
      if (!S.loaded) { paintStats([]); body.innerHTML = skeleton(); return; }
      paintStats(statsSource());
      const old = $('#agScroll', body);
      const key = S.view + '|' + S.date + '|' + S.staff;
      const keep = old && o.keepScroll && key === scrollKey ? { top: old.scrollTop, left: old.scrollLeft } : null;
      const keepWin = o.keepScroll ? window.scrollY : null;
      body.innerHTML = S.view === 'day' ? dayHtml() : S.view === 'week' ? weekHtml() : S.view === 'month' ? monthHtml() : listHtml();
      if (S.total > S.appts.length) body.insertAdjacentHTML('afterbegin', '<div class="banner warn" style="margin-bottom:10px">' + icon('info') + '<div class="grow">Mostramos las primeras ' + S.appts.length + ' citas de este periodo. Usa el filtro por barbero o la búsqueda para ver el resto.</div></div>');
      const sc = $('#agScroll', body);
      if (sc) {
        fitHeight();
        if (keep) { sc.scrollTop = keep.top; sc.scrollLeft = keep.left; }
        else autoScroll(sc);
      }
      if (keepWin != null && o.keepScroll) window.scrollTo(0, keepWin);
      scrollKey = key;
      if (o.flash) {
        const f = body.querySelector('[data-id="' + CSS.escape(o.flash) + '"]');
        if (f) {
          f.classList.add('ag-flash');
          if (!keep && f.classList.contains('ag-ev') && sc) { const top = f.offsetTop - sc.clientHeight / 3; sc.scrollTo({ top, behavior: 'smooth' }); }
          else if (!keep && f.classList.contains('ag-ri') && sc) {
            const fr = f.getBoundingClientRect(), sr = sc.getBoundingClientRect();
            const gut = ($('.ag-corner', sc) || {}).offsetWidth || 0;
            const top = fr.top < sr.top + 70 || fr.bottom > sr.bottom ? sc.scrollTop + fr.top - sr.top - sc.clientHeight / 3 : sc.scrollTop;
            const left = fr.left < sr.left + gut || fr.right > sr.right ? sc.scrollLeft + fr.left - sr.left - gut - 8 : sc.scrollLeft;
            sc.scrollTo({ top, left, behavior: 'smooth' });
          }
        }
      }
      $$('.ag-ev', body).forEach((e, i) => { if (i > 24 || o.keepScroll) e.style.animation = 'none'; });
    }
    function fitHeight() {
      const sc = $('#agScroll', body);
      if (!sc) return;
      const top = sc.getBoundingClientRect().top + window.scrollY;
      const nav = document.querySelector('.bottom-nav');
      const bottom = nav && getComputedStyle(nav).display !== 'none' ? nav.offsetHeight : 0;
      const h = Math.max(isMobile() ? 360 : 420, window.innerHeight - top - bottom - (isMobile() ? 10 : 22));
      sc.style.maxHeight = h + 'px';
    }
    function autoScroll(sc) {
      if (sc.dataset.kind === 'roster') {
        // Semana por barbero: si hoy queda fuera de la vista (móvil), se lleva su columna junto a los nombres.
        const td = $('.ag-wh.today', sc), gut = $('.ag-corner', sc);
        sc.scrollTop = 0;
        sc.scrollLeft = td && gut && td.offsetLeft + td.offsetWidth > sc.clientWidth ? td.offsetLeft - gut.offsetWidth : 0;
        return;
      }
      const rs = +sc.dataset.rs, ppm = +sc.dataset.ppm;
      const [a, b] = S.range;
      const t = today();
      let target;
      if (t >= a && t <= b) target = nowMin() - 60;
      else {
        const xs = shown(S.appts).filter((x) => x.date >= a && x.date <= b);
        target = xs.length ? Math.min(...xs.map((x) => x.start_min)) - 30 : rs;
      }
      sc.scrollTop = Math.max(0, (target - rs) * ppm);
    }
    function setLoading(v) {
      body.classList.toggle('loading', !!v && S.loaded);
      body.setAttribute('aria-busy', String(!!v));
    }

    async function load(o) {
      o = o || {};
      const my = ++seq;
      S.range = range();
      const [from, to] = S.range;
      if (!o.silent) { if (!S.loaded) paint(); paintHeader(); setLoading(true); }
      try {
        if (!availP) availP = api.get('/availability').catch(() => ({}));
        const q = S.view === 'list' && S.q.trim() ? S.q.trim() : undefined;
        const [staffAll, avail, ap, off] = await Promise.all([
          own ? Promise.resolve(me() ? [me()] : []) : getStaff().catch(() => []),
          availP,
          api.get('/appointments', { from, to, limit: 2000, q }),
          api.get('/time-off', { from, to }).catch(() => [])
        ]);
        if (my !== seq || gone) return;
        S.staffList = own ? staffAll : (staffAll || []).filter((s) => s.active !== false);
        if (own && me()) S.staffList = [Object.assign({}, me(), S.staffList.find((s) => s.id === me().id) || {})];
        if (S.staff && !S.staffList.some((s) => s.id === S.staff)) S.staff = '';
        S.avail = avail || {};
        S.appts = ap.items || [];
        S.total = ap.total || S.appts.length;
        S.off = Array.isArray(off) ? off : [];
        S.err = null; S.loaded = true;
        paint(o);
      } catch (e) {
        if (my !== seq || gone) return;
        if (o.silent && S.loaded) return;
        S.err = e; paint(o);
      } finally { if (my === seq && !gone) setLoading(false); }
    }

    function syncUrl() {
      setQuery({ fecha: S.date !== today() ? S.date : '', vista: S.view, barbero: S.staff || '', q: S.view === 'list' ? S.q.trim() : '', estado: S.view === 'list' ? S.status : '' });
    }
    function go(o) {
      Object.assign(S, o || {});
      if (o && o.view) LS.set(LSK.view, S.view);
      syncUrl();
      load();
    }
    function step(dir) {
      if (dir === 0) return go({ date: today() });
      if (S.view === 'day') return go({ date: addDays(S.date, dir) });
      if (S.view === 'month') return go({ date: addMonths(S.date, dir) });
      return go({ date: addDays(S.date, dir * 7) });
    }

    // ── Eventos ──
    offs.push(on(el, 'click', '[data-nav]', (e, b) => step(+b.dataset.nav)));
    offs.push(on(el, 'click', '[data-view]', (e, b) => { if (b.dataset.view !== S.view) go({ view: b.dataset.view }); }));
    const dateIn = $('#agDateIn', el);
    dateIn.addEventListener('click', () => { if (dateIn.showPicker) { try { dateIn.showPicker(); } catch (x) { /* */ } } });
    dateIn.addEventListener('change', () => { if (/^\d{4}-\d{2}-\d{2}$/.test(dateIn.value)) go({ date: dateIn.value }); });
    offs.push(on(el, 'click', '[data-staff]', (e, b) => { if (b.closest('.ag-col')) return; S.staff = b.dataset.staff; syncUrl(); paint({ keepScroll: S.view !== 'day' }); }));
    const setCx = (v) => { S.cx = v; LS.set(LSK.cx, S.cx ? '1' : '0'); paint({ keepScroll: true }); toast.info(S.cx ? 'Mostrando citas canceladas' : 'Citas canceladas ocultas'); };
    offs.push(on(el, 'click', '#agFilt', (e, b) => menu(b, [
      { label: S.cx ? 'Ocultar citas canceladas' : 'Mostrar citas canceladas', icon: S.cx ? 'eye-off' : 'eye', onClick: () => setCx(!S.cx) }
    ])));
    offs.push(on(el, 'click', '[data-stat]', (e, b) => {
      const k = b.dataset.stat;
      go({ view: 'list', status: k === 'due' ? 'completed' : k, q: '' }); // la lista muestra canceladas si ese es el filtro
      const sel = $('#agSt', el); if (sel) sel.value = S.status;
      const qi = $('#agQ', el); if (qi) qi.value = '';
    }));
    offs.push(on(el, 'input', '#agQ', (e, i) => { S.q = i.value; clearTimeout(qTimer); qTimer = setTimeout(() => { syncUrl(); load(); }, 320); }));
    offs.push(on(el, 'change', '#agSt', (e, s) => { S.status = s.value; syncUrl(); paint(); }));
    offs.push(on(el, 'click', '#agRetry', () => { S.err = null; S.loaded = false; load(); }));
    offs.push(on(el, 'click', '#agClear', () => { S.q = ''; S.status = ''; $('#agQ', el).value = ''; $('#agSt', el).value = ''; syncUrl(); load(); }));
    offs.push(on(el, 'click', '#agEmptyNew,[data-a="new"]', () => openNewAppointment({ date: S.date >= today() ? S.date : today(), staff_id: S.staff || undefined })));
    offs.push(on(el, 'click', '[data-go]', (e, b) => go({ view: 'day', date: b.dataset.go })));
    offs.push(on(el, 'click', '[data-open]', (e, b) => openAppointment(b.dataset.open)));
    offs.push(on(el, 'click', '.ag-ev', (e, b) => { if (suppressClick || b.classList.contains('ag-ghost')) return; e.stopPropagation(); openAppointment(b.dataset.id); }));
    offs.push(on(el, 'click', '[data-q]', async (e, b) => {
      const row = b.closest('[data-id]');
      const a = row && byId(row.dataset.id);
      if (!a) return;
      const k = b.dataset.q;
      if (k === 'confirm') return setAppointmentStatus(a, 'confirmed', { btn: b });
      if (k === 'complete') return setAppointmentStatus(a, 'completed', { btn: b });
      if (k === 'pay') return chargeAppointment(a);
      if (k === 'more') {
        // «No asistió» solo cuando ya llegó la hora de la cita (antes el cliente todavía puede llegar).
        const started = a.date < today() || (a.date === today() && a.start_min <= nowMin());
        const act = ACTIVE.includes(a.status);
        menu(b, [
          { label: 'Ver detalle', icon: 'eye', onClick: () => openAppointment(a.id) },
          writable && act && { label: 'Reagendar', icon: 'calendar-clock', onClick: () => openReschedule(a) },
          msgable && a.client_phone && { label: 'WhatsApp…', icon: 'whatsapp', onClick: () => setTimeout(() => whatsappMenu(b, a), 0) },
          payable && a.status !== 'cancelled' && a.balance > 0 && { label: 'Cobrar ' + money(a.balance), icon: 'cash', onClick: () => chargeAppointment(a) },
          writable && act && started && { label: 'No asistió', icon: 'user-x', onClick: () => setAppointmentStatus(a, 'no_show') },
          writable && a.status === 'cancelled' && { label: 'Restaurar', icon: 'refresh', onClick: () => setAppointmentStatus(a, 'confirmed') },
          writable && act && { sep: true },
          writable && act && { label: 'Cancelar cita', icon: 'calendar-x', danger: true, onClick: () => cancelAppointment(a) }
        ]);
      }
    }));

    // Tocar un espacio vacío → nueva cita.
    const snapOf = () => { const st = shop() && shop().settings && shop().settings.booking ? Number(shop().settings.booking.step_min) : 15; return [5, 10, 15, 20, 30].includes(st) ? st : 15; };
    function minuteAt(col, clientY) {
      const sc = $('#agScroll', body);
      const r = col.getBoundingClientRect();
      const rs = +sc.dataset.rs, re = +sc.dataset.re, ppm = +sc.dataset.ppm;
      const snap = snapOf();
      let m = rs + (clientY - r.top) / ppm;
      m = Math.floor(m / snap) * snap;
      return Math.max(rs, Math.min(re - snap, m));
    }
    offs.push(on(el, 'click', '.ag-col', (e, col) => {
      if (suppressClick || !writable || e.target.closest('.ag-ev')) return;
      const m = minuteAt(col, e.clientY);
      const sc = $('#agScroll', body);
      const ppm = +sc.dataset.ppm, rs = +sc.dataset.rs;
      let tap = col.querySelector('.ag-hover');
      if (!tap) { tap = document.createElement('div'); tap.className = 'ag-hover'; col.appendChild(tap); }
      tap.style.top = ((m - rs) * ppm + 1) + 'px'; tap.style.height = Math.max(MIN_H, 30 * ppm - 2) + 'px';
      tap.innerHTML = icon('plus') + time(m);
      tap.classList.remove('tap'); void tap.offsetWidth; tap.classList.add('tap');
      openNewAppointment({ date: col.dataset.date, start_min: m, staff_id: col.dataset.staff || S.staff || (own && me() ? me().id : undefined) });
    }));
    // Semana por barbero: tocar el hueco de una celda agenda con ese barbero ese día.
    offs.push(on(el, 'click', '.ag-rc', (e, c) => {
      if (!writable || !c.dataset.sid || e.target.closest('.ag-ri')) return;
      openNewAppointment({ date: c.dataset.date, staff_id: c.dataset.sid });
    }));
    // Sombra "+ 10:15" al pasar el mouse (solo puntero fino).
    let hoverRaf = 0;
    const onHover = (e) => {
      if (drag || !writable || !mq('(hover:hover) and (pointer:fine)')) return;
      const col = e.target.closest && e.target.closest('.ag-col');
      const prev = body.querySelector('.ag-hover:not(.tap)');
      if (!col || e.target.closest('.ag-ev')) { if (prev) prev.remove(); return; }
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        const sc = $('#agScroll', body); if (!sc) return;
        const m = minuteAt(col, e.clientY);
        const ppm = +sc.dataset.ppm, rs = +sc.dataset.rs;
        let g = col.querySelector('.ag-hover:not(.tap)');
        if (prev && prev.parentNode !== col) prev.remove();
        if (!g) { g = document.createElement('div'); g.className = 'ag-hover'; col.appendChild(g); }
        g.style.top = ((m - rs) * ppm + 1) + 'px'; g.style.height = Math.max(MIN_H, 30 * ppm - 2) + 'px';
        g.innerHTML = icon('plus') + time(m);
      });
    };
    const onLeave = () => { const g = body.querySelector('.ag-hover:not(.tap)'); if (g) g.remove(); };
    body.addEventListener('mousemove', onHover);
    body.addEventListener('mouseleave', onLeave);

    // ── Arrastrar para reagendar (mouse) ──
    const onDown = (e) => {
      const ev = e.target.closest && e.target.closest('.ag-ev');
      if (!ev || e.button !== 0 || e.pointerType !== 'mouse' || !writable) return;
      const a = byId(ev.dataset.id);
      if (!a || !ACTIVE.includes(a.status)) return;
      const sc = $('#agScroll', body);
      if (!sc) return;
      drag = { a, ev, sc, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, started: false, pid: e.pointerId, rs: +sc.dataset.rs, re: +sc.dataset.re, ppm: +sc.dataset.ppm, grab: e.clientY - ev.getBoundingClientRect().top };
    };
    const onMove = (e) => {
      if (!drag || drag.saving || e.pointerId !== drag.pid) return;
      drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
        startDrag();
      }
      e.preventDefault();
      updateDrag();
    };
    function startDrag() {
      drag.started = true;
      onLeave();
      drag.ev.classList.add('ag-src');
      const g = drag.ev.cloneNode(true);
      g.classList.add('ag-ghost'); g.classList.remove('ag-src', 'ag-flash'); g.removeAttribute('data-id'); g.setAttribute('aria-hidden', 'true'); g.tabIndex = -1;
      const lab = document.createElement('span'); lab.className = 'ag-ghost-t'; g.appendChild(lab);
      drag.ghost = g; drag.lab = lab;
      $('.ag-brow', body).appendChild(g);
      document.body.classList.add('ag-dragging');
      const loop = () => {
        if (!drag || !drag.started || drag.saving) return;
        const r = drag.sc.getBoundingClientRect();
        let dy = 0, dx = 0;
        if (drag.y < r.top + 70) dy = -Math.ceil((r.top + 70 - drag.y) / 6); else if (drag.y > r.bottom - 40) dy = Math.ceil((drag.y - r.bottom + 40) / 6);
        if (drag.x < r.left + 70) dx = -Math.ceil((r.left + 70 - drag.x) / 6); else if (drag.x > r.right - 40) dx = Math.ceil((drag.x - r.right + 40) / 6);
        if (dy || dx) { drag.sc.scrollTop += dy; drag.sc.scrollLeft += dx; updateDrag(); }
        drag.raf = requestAnimationFrame(loop);
      };
      drag.raf = requestAnimationFrame(loop);
    }
    function updateDrag() {
      const d = drag;
      const cols = $$('.ag-col', body);
      if (!cols.length) return;
      let col = cols.find((c) => { const r = c.getBoundingClientRect(); return d.x >= r.left && d.x < r.right; });
      if (!col) col = d.x < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1];
      const r = col.getBoundingClientRect();
      const dur = d.a.end_min - d.a.start_min;
      let m = d.rs + (d.y - d.grab - r.top) / d.ppm;
      m = Math.round(m / 5) * 5;
      m = Math.max(d.rs, Math.min(Math.min(d.re, 1440) - dur, m));
      const to = { date: col.dataset.date, staff_id: col.dataset.staff || d.a.staff_id, start_min: m };
      d.to = to;
      if (d.col !== col) { if (d.col) d.col.classList.remove('drop'); col.classList.add('drop'); d.col = col; }
      const br = $('.ag-brow', body).getBoundingClientRect();
      const g = d.ghost;
      g.style.left = (r.left - br.left + 2) + 'px'; g.style.width = (r.width - 4) + 'px';
      g.style.top = (r.top - br.top + (m - d.rs) * d.ppm + 1) + 'px';
      const st = to.staff_id !== d.a.staff_id ? staffById(to.staff_id) : null;
      d.lab.textContent = time(m) + '–' + time(m + dur) + (to.date !== d.a.date ? ' · ' + cap(dateShort(to.date)) : '') + (st ? ' · ' + firstName(st.name) : '');
    }
    function endDrag() {
      if (!drag) return;
      cancelAnimationFrame(drag.raf);
      if (drag.ghost) drag.ghost.remove();
      if (drag.col) drag.col.classList.remove('drop');
      drag.ev.classList.remove('ag-src');
      document.body.classList.remove('ag-dragging');
      drag = null;
      if (pending) { const f = pending; pending = null; load({ silent: true, keepScroll: true, flash: f.flash }); }
    }
    const onUp = async (e) => {
      if (!drag || drag.saving || e.pointerId !== drag.pid) return;
      if (!drag.started) { drag = null; return; }
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      const d = drag;
      d.saving = true;
      cancelAnimationFrame(d.raf);
      const a = d.a, to = d.to;
      if (!to || (to.date === a.date && to.start_min === a.start_min && to.staff_id === a.staff_id)) { endDrag(); return; }
      if (d.col) d.col.classList.remove('drop');
      const st = to.staff_id !== a.staff_id ? staffById(to.staff_id) : null;
      const from = cap(dateShort(a.date)) + ' ' + time(a.start_min) + (st ? ' con ' + firstName(a.staff_name) : '');
      const dest = cap(dateShort(to.date)) + ' ' + time(to.start_min) + (st ? ' con ' + firstName(st.name) : '');
      const ok = await confirmDialog({ title: '¿Mover la cita de ' + firstName(a.client_name || 'Cliente') + '?', message: from + '  →  ' + dest, confirmText: 'Mover cita', cancelText: 'No moverla', icon: 'calendar-clock' });
      if (!ok || gone) { endDrag(); return; }
      if (d.ghost) d.ghost.classList.add('saving');
      await moveAppointment(a, to);
      endDrag();
    };
    const onCancel = (e) => { if (drag && e.pointerId === drag.pid && !drag.saving) endDrag(); };
    body.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);

    // Atajos de teclado (escritorio).
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (drag && e.key === 'Escape') { e.preventDefault(); endDrag(); return; }
      const t = e.target;
      if (t && (t.closest('input,textarea,select,[contenteditable]') || t.closest('.overlay,.menu'))) return;
      if (document.querySelector('.overlay')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (k === 't') step(0);
      else if (k === 'd') go({ view: 'day' });
      else if (k === 's' || k === 'w') go({ view: 'week' });
      else if (k === 'm') go({ view: 'month' });
      else if (k === 'l') go({ view: 'list' });
      else if (k === 'n' && writable) { e.preventDefault(); openNewAppointment({ date: S.date >= today() ? S.date : today(), staff_id: S.staff || undefined }); }
    };
    document.addEventListener('keydown', onKey);

    // Línea de "ahora" (cada 30 s) y actualización silenciosa (cada 2 min con la pestaña visible).
    let tick = 0;
    const iv = setInterval(() => {
      tick++;
      const sc = $('#agScroll', body);
      if (sc && !drag && sc.dataset.rs) {
        const rs = +sc.dataset.rs, re = +sc.dataset.re, ppm = +sc.dataset.ppm;
        const nm = nowMin();
        const inR = nm >= rs && nm <= re;
        $$('.ag-now', body).forEach((n) => { n.style.top = ((nm - rs) * ppm) + 'px'; n.hidden = !inR; });
        $$('.ag-now-t', body).forEach((n) => { n.style.top = ((nm - rs) * ppm) + 'px'; n.textContent = time(nm); n.hidden = !inR; });
      }
      if (tick % 4 === 0 && !document.hidden && !drag && !document.querySelector('.overlay')) load({ silent: true, keepScroll: true });
    }, 30000);
    const onVis = () => { if (!document.hidden && S.loaded && !drag) load({ silent: true, keepScroll: true }); };
    document.addEventListener('visibilitychange', onVis);
    let rzT = 0, lastMobile = isMobile();
    const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { syncBleed(); if (isMobile() !== lastMobile) { lastMobile = isMobile(); paint({ keepScroll: false }); } else fitHeight(); }, 120); };
    window.addEventListener('resize', onResize);

    offs.push(bus.on('appointments:changed', (e) => {
      const flash = e && ['created', 'moved', 'edited'].includes(e.action) ? e.id : null;
      if (drag) { pending = { flash }; return; } // se recarga al terminar el arrastre
      load({ silent: true, keepScroll: true, flash });
    }));
    offs.push(bus.on('payments:changed', () => load({ silent: true, keepScroll: true })));
    offs.push(bus.on('staff:changed', () => { availP = null; load({ silent: true, keepScroll: true }); }));
    offs.push(bus.on('availability:changed', () => { availP = null; load({ silent: true, keepScroll: true }); }));

    // Enlace a una cita sin fecha (#/agenda?cita=<id>, p. ej. desde una notificación): la agenda se abre en
    // el día de esa cita y la resalta, para que al cerrar el detalle quede a la vista.
    let focus = null;
    if (query.cita && !query.fecha) {
      S.range = range(); paint();
      const a = await api.get('/appointments/' + encodeURIComponent(query.cita)).then((r) => r && r.appointment).catch(() => null);
      if (a && /^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) {
        S.date = a.date; focus = a.id;
        if (a.status === 'cancelled') S.cx = true; // solo en esta visita; no cambia la preferencia guardada
      }
    }
    syncUrl();
    await load({ flash: focus });

    // Enlaces directos: ?cita=<id> abre el detalle; ?nueva=1 abre el formulario.
    if (query.cita) openAppointment(query.cita);
    else if (query.nueva && writable) openNewAppointment({ date: S.date >= today() ? S.date : today(), staff_id: S.staff || undefined });

    return () => {
      gone = true;
      offs.forEach((f) => f());
      endDrag();
      clearInterval(iv); clearTimeout(qTimer); clearTimeout(rzT);
      body.removeEventListener('pointerdown', onDown);
      body.removeEventListener('mousemove', onHover);
      body.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }
};
