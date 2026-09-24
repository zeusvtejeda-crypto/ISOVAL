// Plantillas HTML seguras: todo lo interpolado se escapa salvo que venga envuelto en raw().
//   el.innerHTML = html`<b>${nombre}</b> ${raw(icon('check'))}`;
// Arreglos se unen; null/undefined/false se omiten.

class Raw { constructor(s) { this.s = String(s); } toString() { return this.s; } }
export const raw = (s) => new Raw(s == null ? '' : s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

// Delegación de eventos: on(root, 'click', '[data-act]', (e, el) => …) → función para quitarlo.
export function on(root, type, selector, fn, opts) {
  const h = (e) => {
    const el = e.target.closest ? e.target.closest(selector) : null;
    if (el && root.contains(el)) fn(e, el);
  };
  root.addEventListener(type, h, opts);
  return () => root.removeEventListener(type, h, opts);
}

export function mount(el, content) { el.innerHTML = String(content); return el; }

export function h(tag, attrs, content) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : v);
  }
  if (content != null) el.innerHTML = String(content);
  return el;
}

// Lee un <form> como objeto (checkbox → bool, múltiples con el mismo name → arreglo).
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      const group = form.querySelectorAll('input[type=checkbox][name="' + el.name + '"]');
      if (group.length > 1) { out[el.name] = out[el.name] || []; if (el.checked) out[el.name].push(el.value); }
      else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value;
  }
  return out;
}
