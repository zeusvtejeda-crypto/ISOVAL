// WhatsApp desde el panel (modo manual → wa.me · modo automático → cola de envío). Contratos:
//   sendWhatsApp({ appointment_id?, client_id?, kind, body?, name?, silent? })
//     → Promise<{ message, body, to_phone, wa_link, opened?, queued? } | null>
//     Llámala DENTRO del gesto del clic (antes de cualquier await propio): abre la pestaña en ese mismo
//     gesto para que el navegador no la bloquee. En iOS instalada (standalone) o si el navegador bloquea
//     la ventana, muestra una hoja con un enlace real "Abrir WhatsApp". Marca el mensaje como 'opened'.
//   editAndSendWhatsApp({ appointment_id?, client_id?, kind?, body?, name?, phone?, kinds? }) → igual,
//     pero antes abre un editor con la plantilla prellenada, vista previa tipo burbuja y contador.
//   markMessage(id, 'opened'|'sent'|'failed') → Message · waMode() → 'manual'|'auto'
//   KIND_LABEL, MSG_STATUS, formatWa(text) → HTML seguro, bubbleHtml(text) → HTML seguro, waLinkFor(phone, text)
import { html, raw, esc, $ } from './html.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { bus, shop } from './state.js';
import { toast, modal, busy, copyText, confirmDialog } from './ui.js';
import { firstName, phone as fmtPhone } from './fmt.js';

export const KIND_LABEL = {
  confirmation: 'Confirmación', reminder: 'Recordatorio', reschedule: 'Cambio de horario', cancellation: 'Cancelación',
  thanks: 'Agradecimiento', no_show: 'No asistió', custom: 'Mensaje libre'
};
export const MSG_STATUS = {
  prepared: { label: 'Preparado', cls: 'plain' }, opened: { label: 'Abierto en WhatsApp', cls: 'info' },
  sent: { label: 'Enviado', cls: 'ok' }, queued: { label: 'En cola', cls: 'warn' }, failed: { label: 'Falló', cls: 'err' }
};
export const MAX_BODY = 1000;

export const waMode = () => {
  const s = shop();
  return s && s.settings && s.settings.whatsapp && s.settings.whatsapp.mode === 'auto' ? 'auto' : 'manual';
};
const countryCode = () => { const s = shop(); return String((s && s.settings && s.settings.whatsapp && s.settings.whatsapp.country_code) || '52'); };
// Mismo formato que el servidor: 10 dígitos → se antepone la lada del país.
export function waLinkFor(ph, text) {
  const d = String(ph || '').replace(/\D/g, '');
  const n = d.length === 10 ? countryCode() + d : d;
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}

const CSS = `
.wa-chat{--wa-bg:#EFEAE2;--wa-bubble:#D9FDD3;--wa-text:#111B21;--wa-meta:#667781;--wa-link:#027EB5;--wa-dot:rgba(17,27,33,.045);background-color:var(--wa-bg);background-image:radial-gradient(var(--wa-dot) 1px,transparent 1.2px);background-size:13px 13px;border-radius:var(--r-lg);padding:14px 14px 14px 12px;display:flex;justify-content:flex-end;border:1px solid var(--border);min-width:0}
:root[data-theme="dark"] .wa-chat{--wa-bg:#0B141A;--wa-bubble:#005C4B;--wa-text:#E9EDEF;--wa-meta:rgba(233,237,239,.62);--wa-link:#53BDEB;--wa-dot:rgba(233,237,239,.035)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .wa-chat{--wa-bg:#0B141A;--wa-bubble:#005C4B;--wa-text:#E9EDEF;--wa-meta:rgba(233,237,239,.62);--wa-link:#53BDEB;--wa-dot:rgba(233,237,239,.035)}}
.wa-bubble{position:relative;max-width:92%;min-width:90px;background:var(--wa-bubble);color:var(--wa-text);border-radius:10px 0 10px 10px;padding:7px 10px 6px;font-size:14.2px;line-height:1.4;box-shadow:0 1px .5px rgba(11,20,26,.13);overflow-wrap:anywhere;animation:fadeUp .3s var(--ease-out)}
.wa-bubble::after{content:"";position:absolute;right:-7px;top:0;width:8px;height:13px;background:var(--wa-bubble);clip-path:polygon(0 0,100% 0,0 100%)}
.wa-bubble .wa-link{color:var(--wa-link);text-decoration:underline;text-underline-offset:2px}
.wa-bubble code{font-family:var(--mono);font-size:13px}
.wa-meta{display:flex;justify-content:flex-end;align-items:center;gap:3px;font-size:11px;color:var(--wa-meta);margin-top:3px;line-height:1}
.wa-meta svg{width:16px;height:11px;color:#53BDEB}
.wa-empty{color:var(--wa-meta);font-style:italic}
.wa-edit,.wa-ready{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
.wa-edit>*,.wa-ready>*{min-width:0}
.wa-kinds{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:2px 20px 4px}
.wa-kinds::-webkit-scrollbar{display:none}
.wa-kinds .chip{flex:none;min-height:36px}
.wa-count{font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wa-count.warn{color:var(--warn)}.wa-count.err{color:var(--err);font-weight:600}
.wa-to{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:13.5px}
.wa-to .ic{color:#25D366}
.wa-skel{width:min(100%,280px);display:grid;gap:7px;padding:4px 0}
`;
function injectStyle() { if (!document.getElementById('st-wa')) document.head.insertAdjacentHTML('beforeend', '<style id="st-wa">' + CSS + '</style>'); }

// ── Formato estilo WhatsApp (*negritas*, _cursivas_, ~tachado~, ```mono```) sobre texto ya escapado ──
export function formatWa(text) {
  let s = esc(String(text == null ? '' : text));
  s = s.replace(/```([^`]+)```/g, '<code>$1</code>');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<span class="wa-link">$1</span>');
  const wrap = (ch, tag) => { s = s.replace(new RegExp('(^|[\\s(¡¿"])\\' + ch + '([^\\' + ch + '\\n]+?)\\' + ch + '(?=$|[\\s.,;:!?)"])', 'gm'), '$1<' + tag + '>$2</' + tag + '>'); };
  wrap('*', 'b'); wrap('_', 'i'); wrap('~', 's');
  return s.replace(/\n/g, '<br>');
}
const CHECKS = '<svg viewBox="0 0 16 11" aria-hidden="true"><path fill="currentColor" d="M11.07.65 4.68 7.02 2.08 4.43 1 5.5l3.68 3.66 7.46-7.44zM15 .65 8.6 7.02l-.6-.6-1.07 1.07 1.67 1.67L16.07 1.72z"/></svg>';
export function bubbleHtml(text, opts) {
  opts = opts || {};
  injectStyle();
  const t = opts.time || new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  return '<div class="wa-chat"><div class="wa-bubble"' + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + '><div class="wa-text">' +
    (text && String(text).trim() ? formatWa(text) : '<span class="wa-empty">Escribe tu mensaje…</span>') +
    '</div><div class="wa-meta"><span>' + esc(t) + '</span>' + CHECKS + '</div></div></div>';
}

// ── Pestaña en el mismo gesto del clic ──
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1);
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function preOpen() {
  // En iPhone/iPad con la app instalada, una ventana en blanco no se puede redirigir después: se usa un enlace real.
  if (isIOS() && isStandalone()) return null;
  let w = null;
  try { w = window.open('', '_blank'); } catch (e) { w = null; }
  if (w) {
    try {
      w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abriendo WhatsApp…</title>' +
        '<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#0B141A;color:#E9EDEF;font:15px -apple-system,system-ui,Segoe UI,Roboto,sans-serif}.s{width:42px;height:42px;border-radius:50%;border:3px solid rgba(37,211,102,.22);border-top-color:#25D366;margin:0 auto 14px;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}</style></head>' +
        '<body><div style="text-align:center"><div class="s"></div>Abriendo WhatsApp…</div></body></html>');
      w.document.close();
    } catch (e) { /* */ }
  }
  return w;
}
const closeWin = (w) => { if (w && !w.closed) { try { w.close(); } catch (e) { /* */ } } };

export async function markMessage(id, status) {
  const m = await api.patch('/messages/' + encodeURIComponent(id), { status });
  bus.emit('messages:changed', m);
  return m;
}

// Hoja con enlace real (iOS instalada o ventana bloqueada). Resuelve true si tocaron "Abrir WhatsApp".
function readySheet(res, name) {
  injectStyle();
  return new Promise((resolve) => {
    let tapped = false;
    const m = modal({
      title: 'Tu mensaje está listo', size: 'sm',
      subtitle: (name ? 'Para ' + name + ' · ' : '') + fmtPhone(res.to_phone),
      body: '<div class="wa-ready">' + bubbleHtml(res.body) +
        '<a class="btn btn-wa btn-lg btn-block" data-go href="' + esc(res.wa_link) + '" target="_blank" rel="noopener">' + icon('whatsapp') + 'Abrir WhatsApp</a>' +
        '<button type="button" class="btn btn-ghost btn-block" data-copy>' + icon('copy') + 'Copiar texto</button></div>',
      onClose: () => resolve(tapped)
    });
    m.body.addEventListener('click', (e) => {
      if (e.target.closest('[data-go]')) { tapped = true; setTimeout(() => m.close(), 80); }
      if (e.target.closest('[data-copy]')) copyText(res.body, 'Mensaje copiado');
    });
  });
}

export async function sendWhatsApp(opts) {
  opts = opts || {};
  injectStyle();
  const auto = waMode() === 'auto';
  const win = auto ? null : preOpen(); // ← síncrono, dentro del gesto
  const payload = {};
  for (const k of ['appointment_id', 'client_id', 'kind', 'body']) if (opts[k] != null && opts[k] !== '') payload[k] = opts[k];
  if (!payload.kind) payload.kind = payload.body ? 'custom' : 'reminder';
  let res;
  try { res = await api.post('/messages/prepare', payload); }
  catch (err) { closeWin(win); if (!opts.silent) toast.error(err); return null; }
  const msg = res.message;
  const name = firstName(opts.name || (msg && msg.client_name) || '');
  if (msg && msg.status === 'queued') {
    closeWin(win);
    if (!opts.silent) toast.success('Enviado a la cola de envío automático' + (name ? ' · ' + name : ''));
    bus.emit('messages:changed', msg);
    return Object.assign({ queued: true, opened: false }, res);
  }
  let opened = false;
  if (win && !win.closed) {
    try { win.opener = null; } catch (e) { /* */ }
    try { win.location.replace(res.wa_link); opened = true; } catch (e) { opened = false; }
  }
  if (!opened) { closeWin(win); opened = await readySheet(res, name); }
  if (!opened) { bus.emit('messages:changed', msg); return Object.assign({ opened: false }, res); }
  let marked = msg;
  if (msg) { try { marked = await api.patch('/messages/' + encodeURIComponent(msg.id), { status: 'opened' }); } catch (e) { /* no crítico */ } }
  bus.emit('messages:changed', marked);
  if (!opts.silent) {
    toast.success(name ? 'WhatsApp listo para ' + name + ' · solo toca enviar' : 'WhatsApp listo · solo toca enviar', msg ? {
      action: { label: 'Ya lo envié', onClick: () => markMessage(msg.id, 'sent').then(() => toast.success('Marcado como enviado')).catch((e) => toast.error(e)) }
    } : undefined);
  }
  return Object.assign({ opened: true }, res, { message: marked });
}

// ── Editor antes de enviar ──
export function editAndSendWhatsApp(opts) {
  opts = opts || {};
  injectStyle();
  const auto = waMode() === 'auto';
  let kinds = (opts.kinds || (opts.appointment_id ? ['reminder', 'confirmation', 'thanks', 'reschedule', 'no_show', 'cancellation', 'custom'] : ['thanks', 'custom'])).filter((k) => KIND_LABEL[k]);
  let kind = opts.kind && KIND_LABEL[opts.kind] ? opts.kind : kinds[0];
  if (!kinds.includes(kind)) kinds = [kind].concat(kinds);
  return new Promise((resolve) => {
    let result = null, dirty = false, seq = 0, canSend = true;
    const m = modal({
      title: 'Mensaje de WhatsApp',
      subtitle: opts.name ? 'Para ' + opts.name + (opts.phone ? ' · ' + fmtPhone(opts.phone) : '') : (auto ? 'Envío automático' : 'Se abrirá WhatsApp con el texto listo'),
      body: String(html`<div class="wa-edit">
        ${kinds.length > 1 ? html`<div class="chips wa-kinds" role="group" aria-label="Tipo de mensaje">${kinds.map((k) => html`<button type="button" class="chip" data-kind="${k}" aria-pressed="${String(k === kind)}">${KIND_LABEL[k]}</button>`)}</div>` : ''}
        <div id="waErr"></div>
        <div class="field"><label for="waText">Mensaje</label>
          <textarea class="textarea" id="waText" rows="7" maxlength="${String(MAX_BODY)}" placeholder="Escribe tu mensaje…"></textarea>
          <div class="row between"><p class="hint">Usa *negritas* y _cursivas_ como en WhatsApp.</p><span class="wa-count faint" id="waCount" aria-live="polite">0/${String(MAX_BODY)}</span></div>
          <p class="error">Escribe el mensaje.</p></div>
        <div class="stack-sm"><span class="eyebrow">Vista previa</span><div id="waPrev"></div></div>
        ${auto ? html`<div class="banner info">${raw(icon('zap'))}<div class="grow"><b>Envío automático activo.</b> El mensaje se agrega a la cola y sale solo, sin abrir WhatsApp.</div></div>` : ''}
      </div>`),
      footerHtml: String(html`<button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
        <button type="button" class="btn btn-wa" id="waGo">${raw(icon('whatsapp'))}${auto ? 'Enviar a la cola' : 'Abrir WhatsApp'}</button>`),
      onClose: () => resolve(result)
    });
    const ta = $('#waText', m.body), prev = $('#waPrev', m.body), count = $('#waCount', m.body), errBox = $('#waErr', m.body), go = $('#waGo', m.foot);
    const paint = () => {
      const n = ta.value.length;
      count.textContent = n + '/' + MAX_BODY;
      count.className = 'wa-count ' + (n > MAX_BODY ? 'err' : n > MAX_BODY * 0.9 ? 'warn' : 'faint');
      prev.innerHTML = bubbleHtml(ta.value);
      go.disabled = !canSend || !ta.value.trim();
    };
    const skeleton = () => { prev.innerHTML = '<div class="wa-chat"><div class="wa-bubble"><div class="wa-skel"><div class="skel skel-line" style="width:92%"></div><div class="skel skel-line" style="width:70%"></div><div class="skel skel-line" style="width:84%"></div></div></div></div>'; };
    async function load() {
      const my = ++seq;
      errBox.innerHTML = '';
      canSend = true;
      if (kind === 'custom') { ta.value = opts.kind === 'custom' && opts.body ? opts.body : ''; dirty = false; paint(); ta.focus(); return; }
      if (opts.body && kind === opts.kind && my === 1) { ta.value = opts.body; paint(); return; }
      ta.disabled = true; go.disabled = true; skeleton();
      try {
        const r = await api.post('/messages/prepare', { preview: true, kind, appointment_id: opts.appointment_id || undefined, client_id: opts.client_id || undefined });
        if (my !== seq) return;
        ta.value = r.body || '';
        dirty = false;
        if (!opts.phone && r.to_phone) m.el.querySelector('.modal-head .sub').textContent = (opts.name ? 'Para ' + opts.name + ' · ' : '') + fmtPhone(r.to_phone);
      } catch (err) {
        if (my !== seq) return;
        const noPhone = err && err.fields && err.fields.phone;
        if (noPhone) canSend = false;
        errBox.innerHTML = String(html`<div class="banner ${noPhone ? 'err' : 'warn'}">${raw(icon('alert'))}<div class="grow">${err.message || 'No se pudo cargar la plantilla.'}${noPhone ? ' ' : ''}</div></div>`);
        if (!ta.value) ta.value = '';
      } finally {
        if (my === seq) { ta.disabled = false; paint(); }
      }
    }
    ta.addEventListener('input', () => { dirty = true; ta.closest('.field').classList.remove('invalid'); paint(); });
    m.body.addEventListener('click', async (e) => {
      const c = e.target.closest('[data-kind]');
      if (!c || c.dataset.kind === kind) return;
      if (dirty && ta.value.trim() && !(await confirmDialog({ title: '¿Cambiar de plantilla?', message: 'Se reemplazará el texto que escribiste por la plantilla de "' + KIND_LABEL[c.dataset.kind] + '".', confirmText: 'Cambiar', icon: 'edit' }))) return;
      kind = c.dataset.kind;
      m.body.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
      load();
    });
    m.foot.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancel]')) { m.close(); return; }
      if (!e.target.closest('#waGo') || go.getAttribute('aria-busy') === 'true') return;
      const text = ta.value.trim();
      if (!text || text.length > MAX_BODY) { const f = ta.closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = text ? 'Máximo ' + MAX_BODY + ' caracteres.' : 'Escribe el mensaje.'; ta.focus(); return; }
      // sendWhatsApp abre la pestaña en este mismo gesto (sin await antes).
      const p = sendWhatsApp({ appointment_id: opts.appointment_id, client_id: opts.client_id, kind, body: text, name: opts.name });
      busy(go, p);
      p.then((r) => { if (r) { result = r; m.close(r); } });
    });
    paint();
    load();
  });
}
