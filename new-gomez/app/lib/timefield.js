// Hora en 24 h con un <select> (de 15 en 15 min) en lugar de <input type="time">: el nativo se pinta en 12 h
// ('02:00 PM', '2:00 p.m.') según el idioma del navegador, y el resto del panel usa 24 h (fmt.time → '14:00',
// '10:00–14:00' en ayudas y resúmenes). El valor sigue siendo 'HH:MM', así que el código que lee .value y
// escucha 'input'/'change' no cambia. Una hora fuera de la cuadrícula (p. ej. '10:10' importada) se conserva.
import { time } from './fmt.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// opts: { step (min, 15), end (agrega '23:59' = fin del día, como toHHMM(1440)) }
export function timeOptions(value, opts) {
  opts = opts || {};
  const step = opts.step || 15;
  const vals = [];
  for (let m = 0; m < 1440; m += step) vals.push(time(m));
  if (opts.end) vals.push('23:59');
  const v = /^\d{2}:\d{2}$/.test(value || '') ? value : '';
  if (v && !vals.includes(v)) { vals.push(v); vals.sort(); }
  return (v ? '' : '<option value="" selected>--:--</option>') + vals.map((x) => '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('');
}

const CSS = '.time-sel{font-variant-numeric:tabular-nums;text-align:center;text-align-last:center;cursor:pointer}';
function injectStyle() { if (typeof document !== 'undefined' && !document.getElementById('st-timesel')) document.head.insertAdjacentHTML('beforeend', '<style id="st-timesel">' + CSS + '</style>'); }

// <select class="input select time-sel …" …atributos>opciones</select>. attrs: { 'data-t': 's', id, name, 'aria-label', … }
export function timeSelect(value, attrs, opts) {
  opts = opts || {};
  injectStyle();
  const a = Object.entries(attrs || {}).filter(([, v]) => v != null && v !== false).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('');
  return '<select class="input select time-sel' + (opts.cls ? ' ' + opts.cls : '') + '"' + a + '>' + timeOptions(value, opts) + '</select>';
}
