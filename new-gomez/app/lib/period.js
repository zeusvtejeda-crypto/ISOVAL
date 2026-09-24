// Selector de periodo para pantallas con varios rangos (Comisiones, Caja → Pagos).
// Con espacio: segmentado (.seg) como siempre. Si no cabe completo (teléfono, iPad con barra lateral), el
// segmentado se cambia por un botón «Periodo · Esta quincena ⌄» que abre una hoja con cada periodo y sus fechas,
// igual que los filtros del Inicio (dashboard.js → filtersHtml/fitFilters). Así nunca queda una opción cortada
// a media palabra ni escondida en un scroll sin pista.
// Los botones [data-range] del segmentado siguen siendo la fuente de verdad: la hoja hace click en el elegido,
// así la vista no cambia su lógica (sus manejadores de [data-range] siguen funcionando igual).
//
// Uso:  periodHtml(ranges, cur)                → marcado (ranges: [[clave, 'Etiqueta'], …])
//       const off = wirePeriod(el, { describe }) → hoja + ajuste al ancho; describe(clave) → '16–30 sep 2026'
//       fitPeriod(el)                           → volver a medir después de pintar el marcado de nuevo
import { html, raw, on, $, $$ } from './html.js';
import { icon } from './icons.js';
import { modal } from './ui.js';

const CSS = `
.pp{display:flex;min-width:0;max-width:100%}
.pp-btn{display:none;--h:44px;justify-content:flex-start;padding:0 12px 0 14px;min-width:0;width:100%;gap:8px}
.pp-btn .grow{text-align:left;min-width:0;display:flex;align-items:baseline;gap:6px}
.pp-btn .pp-k{font-size:12.5px;font-weight:500;color:var(--text-3)}
.pp-btn .ic{flex:none;color:var(--text-3)}
.pp.compact .pp-seg{display:none}
.pp.compact .pp-btn{display:inline-flex}
@media (min-width:520px){.pp.compact .pp-btn{width:auto;max-width:100%}}
.pp-list{margin:0 -20px}
.pp-list .list-item{min-height:56px;padding-left:20px;padding-right:20px}
.pp-list .title{display:block;font-weight:600}
.pp-list .meta{display:block;font-size:12.5px;color:var(--text-3)}
.pp-list [aria-selected="true"] .title{color:var(--brand-strong)}
`;
function injectStyle() { if (!document.getElementById('st-period')) document.head.insertAdjacentHTML('beforeend', '<style id="st-period">' + CSS + '</style>'); }

export function periodHtml(ranges, cur, aria) {
  injectStyle();
  const narrow = typeof matchMedia === 'function' && matchMedia('(max-width:519px)').matches;
  const label = (ranges.find((r) => r[0] === cur) || ranges[0])[1];
  return html`<div class="pp ${narrow ? 'compact' : ''}" data-pp>
    <div class="seg pp-seg" role="group" aria-label="${aria || 'Periodo'}">${ranges.map(([k, l]) => html`<button type="button" data-range="${k}" aria-pressed="${String(k === cur)}">${l}</button>`)}</div>
    <button type="button" class="btn btn-secondary pp-btn" data-pp-open aria-haspopup="dialog">${raw(icon('calendar', 'ic-sm'))}<span class="grow"><span class="pp-k">${aria || 'Periodo'}</span><span class="truncate" data-pp-label>${label}</span></span>${raw(icon('chevron-down', 'ic-sm'))}</button>
  </div>`;
}

// Compacto si el segmentado no cabe completo en su renglón.
export function fitPeriod(root) {
  $$('[data-pp]', root).forEach((box) => {
    if (!box.getClientRects().length) return; // oculto: se mide cuando se vea
    box.classList.remove('compact');
    const seg = $('.pp-seg', box);
    if (seg) box.classList.toggle('compact', seg.scrollWidth > seg.clientWidth + 1);
  });
}
// Etiqueta del botón = periodo activo del segmentado.
function syncLabel(root) {
  $$('[data-pp]', root).forEach((box) => {
    const on1 = $('.pp-seg [aria-pressed="true"]', box), lbl = $('[data-pp-label]', box);
    if (on1 && lbl) lbl.textContent = on1.textContent;
  });
}

function openSheet(box, describe) {
  const opts = $$('.pp-seg [data-range]', box).map((b) => ({ k: b.dataset.range, label: b.textContent, sel: b.getAttribute('aria-pressed') === 'true' }));
  const m = modal({
    title: $('.pp-k', box).textContent || 'Periodo', size: 'sm', footer: false,
    body: String(html`<div class="list pp-list" role="listbox" aria-label="Periodos">${opts.map((o) => { const d = describe ? describe(o.k) : ''; return html`<button type="button" class="list-item" role="option" aria-selected="${String(o.sel)}" data-p="${o.k}"><span class="grow"><span class="title">${o.label}</span>${d ? html`<span class="meta">${d}</span>` : ''}</span>${o.sel ? raw(icon('check', 'brand-t')) : ''}</button>`; })}</div>`)
  });
  m.body.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) m.close(b.dataset.p); });
  const first = $('[aria-selected="true"]', m.body);
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  return m.done;
}

// opts: { describe(clave) → texto con las fechas del periodo }
export function wirePeriod(el, opts) {
  opts = opts || {};
  injectStyle();
  const offs = [
    on(el, 'click', '[data-pp-open]', async (e, b) => {
      const box = b.closest('[data-pp]');
      const k = await openSheet(box, opts.describe);
      const target = k && $('.pp-seg [data-range="' + k + '"]', box);
      if (target) target.click();
      b.focus({ preventScroll: true });
    }),
    // Después de los manejadores de la vista (mismo clic): la etiqueta sigue al segmentado.
    on(el, 'click', '[data-range]', () => setTimeout(() => syncLabel(el), 0))
  ];
  let lastW = el.clientWidth, off = false;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { const w = el.clientWidth; if (w !== lastW) { lastW = w; fitPeriod(el); } }) : null;
  if (ro) ro.observe(el);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!off) fitPeriod(el); });
  requestAnimationFrame(() => { if (!off) fitPeriod(el); });
  return () => { off = true; if (ro) ro.disconnect(); offs.forEach((f) => f()); };
}
