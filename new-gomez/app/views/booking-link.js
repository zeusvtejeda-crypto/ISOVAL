// Enlace de reservas y QR (#/enlace, dueño): enlace público (SITE_BASE?b=slug y la forma corta /b/slug),
// copiar / compartir / abrir, QR grande con las iniciales o el logo al centro (corrección H), descarga en PNG
// (1024 px) y SVG, cartel imprimible tamaño carta, textos listos para Instagram y WhatsApp, y cambio del slug
// (PATCH /api/shop { slug }) con aviso de que el QR anterior deja de funcionar.
import { html, raw, esc, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, SITE_BASE, LS, getMode } from '../lib/api.js';
import { shop, can } from '../lib/state.js';
import { toast, modal, confirmDialog, busy, copyText, saveFile, avatar } from '../lib/ui.js';
import { time as fmtTime } from '../lib/fmt.js';
import { qrSVG, qrPNG } from '../lib/qr.js';

const RESERVED = ['demo', 'app', 'api', 'admin', 'b', 'www', 'panel'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const DAY_S = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const STOP = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'e', 'the', 'barber', 'barbers', 'barberia', 'barbería', 'barbershop', 'club', 'shop', 'studio', 'estudio', 'salon', 'salón']);

export const bookingUrl = (slug) => SITE_BASE + '?b=' + encodeURIComponent(slug);
export const shortUrl = (slug) => SITE_BASE + 'b/' + encodeURIComponent(slug);
const bare = (u) => String(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
// Tras cambiar el enlace, refreshContext() vuelve a pintar la vista: se lleva al usuario al QR nuevo.
let showNewQr = false;

// Iniciales para el centro del QR: palabras con significado ("La Navaja Barber Club" → "N", "New Gómez" → "NG").
export function qrInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
  const src = sig.length ? sig : words;
  return src.slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase() || 'TB';
}

// Horario agrupado por días consecutivos iguales → [{ days:'Lun–Vie', text:'10:00–20:00' }]
export function hoursLines(hours) {
  const key = (d) => ((hours && (hours[d] || hours[String(d)])) || []).map(([s, e]) => fmtTime(s) + '–' + fmtTime(e)).join(' y ') || 'Cerrado';
  const groups = [];
  for (const d of ORDER) {
    const k = key(d);
    const g = groups[groups.length - 1];
    if (g && g.text === k) g.list.push(d); else groups.push({ text: k, list: [d] });
  }
  return groups.map((g) => ({ days: g.list.length > 2 ? DAY_S[g.list[0]] + '–' + DAY_S[g.list[g.list.length - 1]] : g.list.map((d) => DAY_S[d]).join(' y '), text: g.text }));
}

function slugProblem(s, current) {
  if (!s) return 'Escribe cómo quieres que termine tu enlace.';
  if (s.length < 3) return 'Usa al menos 3 caracteres.';
  if (s.length > 40) return 'Usa máximo 40 caracteres.';
  if (/^-|-$/.test(s)) return 'No puede empezar ni terminar con guion.';
  if (s.includes('--')) return 'No uses dos guiones seguidos.';
  if (!SLUG_RE.test(s)) return 'Solo letras minúsculas, números y guiones.';
  if (RESERVED.includes(s) && s !== current) return 'Ese enlace está reservado. Elige otro.';
  return '';
}
const normSlug = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[\s_.]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40);

// ── QR con logo (imagen) ──
// qr.js reserva el hueco central con logoText (y fuerza corrección H); aquí se cambia el texto por la imagen.
function logoBox(svg) {
  const vb = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(svg);
  const r = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)"/.exec(svg);
  if (!vb || !r) return null;
  return { total: +vb[1], x: +r[1], y: +r[2], w: +r[3], h: +r[4], rx: +r[5] };
}
function svgWithImage(svg, src) {
  const b = logoBox(svg);
  if (!b) return svg;
  const pad = b.w * 0.08;
  const img = '<clipPath id="qrLogoClip"><rect x="' + (b.x + pad) + '" y="' + (b.y + pad) + '" width="' + (b.w - pad * 2) + '" height="' + (b.h - pad * 2) + '" rx="' + (b.rx * 0.8) + '"/></clipPath>' +
    '<image href="' + esc(src) + '" x="' + (b.x + pad) + '" y="' + (b.y + pad) + '" width="' + (b.w - pad * 2) + '" height="' + (b.h - pad * 2) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#qrLogoClip)"/>';
  return svg.replace(/<text[\s\S]*?<\/text>/, img);
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (!/^data:/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('No se pudo cargar el logo'));
    im.src = src;
  });
}
async function pngWithLogo(text, opts, logoSrc, fallbackOpts) {
  if (!logoSrc) return qrPNG(text, opts);
  try {
    const blob = await qrPNG(text, opts);
    const b = logoBox(qrSVG(text, opts));
    const baseUrl = URL.createObjectURL(blob);
    const [base, logo] = await Promise.all([loadImage(baseUrl), loadImage(logoSrc)]);
    URL.revokeObjectURL(baseUrl);
    const size = opts.size;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    const k = size / b.total;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    // Fondo limpio del hueco (tapa el texto provisional) y logo recortado con esquinas redondeadas.
    rr(b.x * k, b.y * k, b.w * k, b.h * k, b.rx * k); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    const pad = b.w * 0.08;
    const x = (b.x + pad) * k, y = (b.y + pad) * k, w = (b.w - pad * 2) * k, h = (b.h - pad * 2) * k;
    ctx.save(); rr(x, y, w, h, b.rx * 0.8 * k); ctx.clip();
    const s = Math.max(w / logo.width, h / logo.height);
    ctx.drawImage(logo, x + (w - logo.width * s) / 2, y + (h - logo.height * s) / 2, logo.width * s, logo.height * s);
    ctx.restore();
    return await new Promise((res, rej) => c.toBlob((bb) => (bb ? res(bb) : rej(new Error('png'))), 'image/png'));
  } catch (e) {
    // Logo de otro dominio sin permiso (CORS) u otra falla: QR con iniciales.
    return qrPNG(text, fallbackOpts || opts);
  }
}

const CSS = `
.bl-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);grid-template-areas:"hero" "qr" "texts" "slug"}
@media (min-width:1000px){.bl-grid{grid-template-columns:minmax(0,1fr) 380px;grid-template-areas:"hero qr" "texts qr" "slug qr";align-items:start}.bl-qr{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.bl-hero{grid-area:hero;position:relative;overflow:hidden}
.bl-hero::before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,var(--brand),transparent 80%)}
.bl-shop{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.bl-shop .avatar{--s:44px;border-radius:13px;font-size:15px}
.bl-url{display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px;border-radius:var(--r-lg);background:var(--surface-2);border:1px solid var(--border-strong);font-family:var(--mono);font-size:15px;font-weight:500;min-width:0}
.bl-url .u{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.35}
.bl-url .u b{color:var(--brand-strong);font-weight:600}
.bl-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.bl-acts .btn{min-height:48px;padding:0 10px}
@media (max-width:420px){.bl-acts .btn span.lg{display:none}}
.bl-short{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 10px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px dashed var(--border-strong);font-size:13.5px;color:var(--text-2)}
.bl-short>.ic{color:var(--text-3)}
.bl-short .lbl{display:grid;min-width:0}
.bl-short .lbl small{font-size:12px;color:var(--text-3)}
.bl-short code{font-family:var(--mono);font-size:13px;color:var(--text);overflow-wrap:anywhere}
.bl-short .note{grid-column:2/-1;font-size:12px;color:var(--text-3)}
.bl-qr{grid-area:qr}
.bl-qrbox{margin:0 auto;width:100%;max-width:300px;aspect-ratio:1;background:#fff;border-radius:22px;padding:14px;box-shadow:0 1px 0 rgba(21,19,15,.04),0 10px 30px rgba(21,19,15,.10);border:1px solid rgba(21,19,15,.08);display:grid;place-items:center;transition:transform .3s var(--ease-out)}
.bl-qrbox:hover{transform:scale(1.015)}
.bl-qrbox svg{width:100%;height:auto}
.bl-qrcap{text-align:center;margin-top:14px}
.bl-qrcap b{display:block;font-family:var(--disp);font-size:22px;font-weight:800;letter-spacing:.01em;line-height:1.1}
.bl-qrcap span{font-size:13px;color:var(--text-2)}
.bl-dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
.bl-dl .btn-dark{grid-column:1/-1}
.bl-seg{display:flex;justify-content:center;margin-top:14px}
.bl-texts{grid-area:texts}
.bl-snip{border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);overflow:hidden}
.bl-snip+.bl-snip{margin-top:10px}
.bl-snip header{display:flex;align-items:center;gap:10px;padding:10px 10px 0 14px}
.bl-snip header .ic-b{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong);flex:none}
.bl-snip header .ic-b.wa{background:rgba(37,211,102,.14);color:#1C9E4B}
.bl-snip header .ic-b .ic{width:17px;height:17px}
.bl-snip header b{font-size:14px;font-weight:600}
.bl-snip header small{display:block;font-size:12px;color:var(--text-3);font-weight:400}
.bl-snip pre{margin:0;padding:10px 14px 12px;font-family:var(--sans);font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text)}
.bl-snip footer{display:flex;gap:6px;justify-content:flex-end;align-items:center;padding:0 10px 10px}
.bl-snip footer .cnt{margin-right:auto;padding-left:4px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}
.bl-snip footer .cnt.over{color:var(--err);font-weight:600}
.bl-slug{grid-area:slug}
.bl-slugin{display:flex;align-items:stretch;border:1px solid var(--border-strong);border-radius:var(--r-sm);background:var(--surface);overflow:hidden;transition:border-color .15s,box-shadow .15s}
.bl-slugin:focus-within{border-color:var(--brand);box-shadow:0 0 0 3.5px var(--brand-soft)}
.field.invalid .bl-slugin{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.bl-slugin .pre{flex:none;display:flex;align-items:center;padding:0 8px 0 12px;background:var(--surface-2);color:var(--text-3);font-family:var(--mono);font-size:13px;white-space:nowrap;border-right:1px solid var(--border)}
.bl-slugin .pre .sm{display:none}
@media (max-width:560px){.bl-slugin .pre .lg{display:none}.bl-slugin .pre .sm{display:inline}}
.bl-slugin .input{flex:1;border:0;box-shadow:none!important;border-radius:0;font-family:var(--mono);min-width:0}
.bl-prev{font-size:12.5px;color:var(--text-3);overflow-wrap:anywhere}
.bl-prev b{color:var(--text);font-family:var(--mono);font-weight:500}
.bl-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.bl-qrhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.bl-qrbox{cursor:zoom-in}
:root[data-theme="dark"] .bl-dl .btn-dark{background:var(--on-ink);color:var(--ink)}
:root[data-theme="dark"] .bl-dl .btn-dark:hover:not(:disabled){background:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .bl-dl .btn-dark{background:var(--on-ink);color:var(--ink)}:root:not([data-theme="light"]) .bl-dl .btn-dark:hover:not(:disabled){background:#fff}}
@media (min-width:720px) and (max-width:999px){
  .bl-qr{display:grid;grid-template-columns:minmax(0,280px) minmax(0,1fr);column-gap:28px;align-content:start}
  .bl-qr>.bl-qrhead{grid-column:1/-1}
  .bl-qr>.bl-qrbox{grid-column:1;grid-row:2 / span 4;align-self:center}
  .bl-qr>:not(.bl-qrhead):not(.bl-qrbox){grid-column:2}
  .bl-qrcap{text-align:left;margin-top:0;align-self:end}
  .bl-seg{justify-content:flex-start}
  .bl-qr>p.faint{text-align:left!important}
}
.bl-full{display:grid;justify-items:center;gap:14px;padding:6px 0 4px;text-align:center}
.bl-full .qr{width:min(100%,380px);aspect-ratio:1;background:#fff;border-radius:24px;padding:16px;box-shadow:0 0 0 1px rgba(21,19,15,.08),var(--shadow-2)}
.bl-full .qr svg{width:100%;height:auto}
.bl-full b{font-family:var(--disp);font-size:26px;font-weight:800;line-height:1.05}
.bl-full span{font-family:var(--mono);font-size:13px;color:var(--text-2);overflow-wrap:anywhere}
`;
function injectCss() { if (!document.getElementById('st-booking-link')) document.head.insertAdjacentHTML('beforeend', '<style id="st-booking-link">' + CSS + '</style>'); }

function snippets(sh, url) {
  const city = sh.city ? ' · ' + sh.city : '';
  return [
    { k: 'ig', icon: 'instagram', title: 'Bio de Instagram', sub: 'Pégala en tu perfil; el enlace también va en el campo «Sitio web».', max: 150,
      text: '💈 ' + sh.name + city + '\n✂️ Cortes, barba y más\n📅 Reserva tu cita aquí 👇\n' + bare(url) },
    { k: 'wa', icon: 'whatsapp', wa: true, title: 'Estado de WhatsApp', sub: 'Publícalo en tu estado o en tu perfil de WhatsApp Business.',
      text: '¡Ya puedes reservar tu cita en línea! 💈\nElige barbero, día y hora en segundos, sin esperar respuesta:\n' + url },
    { k: 'msg', icon: 'message', title: 'Mensaje para tus clientes', sub: 'Mándalo a tus clientes frecuentes o a tus grupos.', send: true,
      text: 'Hola 👋 Ahora puedes agendar tu cita en ' + sh.name + ' desde tu celular, las 24 horas. Elige tu barbero y tu horario aquí: ' + url + '\n¡Te esperamos!' }
  ];
}

// ── Cartel imprimible (carta) ──
function posterHtml(sh, url, qr) {
  const brand = /^#[0-9a-f]{6}$/i.test(sh.brand_color || '') ? sh.brand_color : '#C49A3C';
  const lines = hoursLines((sh.settings && sh.settings.hours) || {});
  const contact = [sh.address, sh.phone ? 'Tel. ' + String(sh.phone).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : ''].filter(Boolean).join(' · ');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Cartel de reservas — ' + esc(sh.name) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">' +
    '<style>' +
    '@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
    'html,body{background:#DCD7CC;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'body{font-family:"IBM Plex Sans",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#15130F}' +
    '.bar{position:sticky;top:0;display:flex;gap:10px;justify-content:center;align-items:center;padding:12px;background:#15130F;color:#F2EDE3;font-size:14px;z-index:2}' +
    '.bar button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:10px 18px;cursor:pointer;background:' + brand + ';color:#15130F}.bar button.g{background:transparent;color:#F2EDE3;border:1px solid rgba(242,237,227,.3)}' +
    '.sheet{width:8.5in;height:11in;margin:24px auto;background:#F7F4EE;position:relative;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
    '.top{background:#15130F;color:#F2EDE3;padding:.5in .6in .42in;text-align:center;position:relative;flex:none}' +
    '.top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:' + brand + '}' +
    '.eyebrow{font-size:12pt;letter-spacing:.32em;text-transform:uppercase;color:' + brand + ';font-weight:600}' +
    '.name{font-family:"Big Shoulders Display","Oswald","Arial Narrow",Impact,sans-serif;font-weight:800;font-size:' + (sh.name.length <= 16 ? 52 : sh.name.length <= 26 ? 40 : 32) + 'pt;line-height:.95;margin-top:10px;letter-spacing:.01em}' +
    '.tag{margin-top:10px;font-size:13pt;color:#BDB5A5}' +
    '.mid{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:.22in .6in .1in;text-align:center}' +
    'h1{font-family:"Big Shoulders Display","Oswald","Arial Narrow",Impact,sans-serif;font-weight:800;font-size:38pt;line-height:1;letter-spacing:.01em}' +
    'h1 em{font-style:normal;color:' + brand + '}' +
    '.sub{font-size:14pt;color:#5B554A;margin-top:8px}' +
    '.qr{flex:none;margin-top:.24in;width:var(--q,4in);height:var(--q,4in);background:#fff;border-radius:.28in;padding:.2in;box-shadow:0 0 0 1.5pt ' + brand + ',0 18px 40px rgba(21,19,15,.12)}' +
    '.qr svg{width:100%;height:100%;display:block}' +
    '.url{margin-top:.2in;font-family:"IBM Plex Mono",Menlo,monospace;font-size:13pt;font-weight:500;color:#15130F;background:#fff;border:1pt solid rgba(21,19,15,.14);border-radius:999px;padding:6px 18px}' +
    '.steps{display:flex;gap:.3in;margin-top:.26in;font-size:11.5pt;color:#5B554A}' +
    '.steps span{display:flex;align-items:center;gap:8px}.steps i{font-style:normal;width:22px;height:22px;border-radius:50%;background:#15130F;color:' + brand + ';display:grid;place-items:center;font-weight:700;font-size:10pt}' +
    '.foot{flex:none;padding:.22in .2in .38in;display:flex;justify-content:space-between;gap:.4in;align-items:flex-end;border-top:1pt solid rgba(21,19,15,.12);margin:0 .5in}' +
    '.hours{display:grid;gap:3px;font-size:11pt}.hours b{font-size:9pt;letter-spacing:.2em;text-transform:uppercase;color:#8C8577;margin-bottom:4px}' +
    '.hours div{display:flex;gap:12px}.hours div span:first-child{min-width:74px;font-weight:600}' +
    '.contact{text-align:right;font-size:10.5pt;color:#5B554A;max-width:3.2in}.contact .brandline{margin-top:8px;font-size:9pt;color:#8C8577;letter-spacing:.04em}' +
    '@media print{html,body{background:none}.bar{display:none}.sheet{margin:0;box-shadow:none}}' +
    '@media screen and (max-width:8.8in){.sheet{transform-origin:top left;margin:12px}}' +
    '</style></head><body>' +
    '<div class="bar"><span>Vista previa del cartel · tamaño carta</span><button type="button" onclick="window.print()">Imprimir</button><button type="button" class="g" onclick="window.close()">Cerrar</button></div>' +
    '<div class="sheet">' +
    '<div class="top"><div class="eyebrow">Reserva en línea</div><div class="name">' + esc(sh.name) + '</div>' + (sh.tagline ? '<div class="tag">' + esc(sh.tagline) + '</div>' : '') + '</div>' +
    '<div class="mid"><h1>Escanea y <em>reserva</em> tu cita</h1><p class="sub">Elige barbero, día y hora en segundos. Sin llamadas, sin esperas.</p>' +
    '<div class="qr">' + qr + '</div><div class="url">' + esc(bare(url)) + '</div>' +
    '<div class="steps"><span><i>1</i>Abre la cámara</span><span><i>2</i>Apunta al código</span><span><i>3</i>Elige tu horario</span></div></div>' +
    '<div class="foot"><div class="hours"><b>Horario</b>' + lines.map((l) => '<div><span>' + esc(l.days) + '</span><span>' + esc(l.text) + '</span></div>').join('') + '</div>' +
    '<div class="contact">' + esc(contact) + '<div class="brandline">Reservas con TuBarbería</div></div></div>' +
    '</div>' +
    '<script>(function(){var q=4;function shrink(){var s=document.querySelector(".sheet");q=4;s.style.setProperty("--q",q+"in");while(s.scrollHeight>s.clientHeight+1&&q>2.4){q-=.1;s.style.setProperty("--q",q.toFixed(2)+"in")}}shrink();addEventListener("beforeprint",shrink);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){shrink();fit()});function fit(){var s=document.querySelector(".sheet");var w=window.innerWidth-24;var k=Math.min(1,w/s.offsetWidth);s.style.transform=k<1?"scale("+k+")":"";s.style.marginBottom=k<1?(-(1-k)*s.offsetHeight+12)+"px":""}fit();addEventListener("resize",fit);' +
    'var auto=' + (window.matchMedia('(min-width:900px)').matches ? 'true' : 'false') + ';if(auto){var go=function(){setTimeout(function(){try{window.print()}catch(e){}},350)};if(document.fonts&&document.fonts.ready){Promise.race([document.fonts.ready,new Promise(function(r){setTimeout(r,1500)})]).then(go)}else go()}})();<\/script>' +
    '</body></html>';
}

export default {
  title: 'Enlace y QR',
  async render(el) {
    injectCss();
    const sh = shop();
    if (!sh) return;
    const url = bookingUrl(sh.slug);
    const short = shortUrl(sh.slug);
    const booking = (sh.settings && sh.settings.booking) || {};
    const initials = qrInitials(sh.name);
    const brand = /^#[0-9a-f]{6}$/i.test(sh.brand_color || '') ? sh.brand_color : '#C49A3C';
    let withLogo = LS.get('tb:qr:logo') !== '0';
    const base = { margin: 2, dark: '#15130F', light: '#FFFFFF' };
    const initialsOpts = (size) => Object.assign({ size }, base, { logoText: initials, logoBg: brand });
    const qrOpts = (size) => (!withLogo ? Object.assign({ size }, base, { ecc: 'M' })
      : sh.logo_url ? Object.assign({ size }, base, { logoText: 'X', logoBg: '#FFFFFF' }) : initialsOpts(size));
    const qrMarkup = (size) => (withLogo && sh.logo_url ? svgWithImage(qrSVG(url, qrOpts(size)), sh.logo_url) : qrSVG(url, qrOpts(size)));
    const snips = snippets(sh, url);
    const demoOrLocal = getMode() === 'demo' || /^(localhost|127\.|\[::1\])/.test(location.hostname);

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Enlace y QR</h2><p>Comparte tu página de reservas: tus clientes eligen barbero, día y hora en segundos.</p></div>
      </div>
      <div class="bl-grid">
        <section class="card card-pad bl-hero fade-up" aria-labelledby="blH">
          <div class="bl-shop">${avatar(sh.name, { src: sh.logo_url || '', color: brand })}
            <div class="grow"><div class="eyebrow">Tu enlace de reservas</div><h3 id="blH" style="font-size:17px;font-weight:700" class="truncate">${sh.name}</h3></div></div>
          <div class="bl-url"><span class="u">${bare(SITE_BASE)}/?b=<b>${sh.slug}</b></span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="copy" aria-label="Copiar enlace" title="Copiar">${raw(icon('copy', 'ic-sm'))}</button></div>
          <div class="bl-acts">
            <button type="button" class="btn btn-primary" data-act="copy">${raw(icon('copy'))}<span>Copiar<span class="lg"> enlace</span></span></button>
            <button type="button" class="btn btn-secondary" data-act="share">${raw(icon('share'))}<span>Compartir</span></button>
            <a class="btn btn-secondary" href="${url}" target="_blank" rel="noopener">${raw(icon('external'))}<span>Abrir</span></a>
          </div>
          <div class="bl-status">
            ${booking.online_enabled === false
              ? html`<div class="banner warn" style="width:100%">${raw(icon('alert'))}<div class="grow"><b>Las reservas en línea están apagadas.</b> Tus clientes verán tu página pero no podrán agendar. <a class="link-btn" href="#/ajustes?s=reservas">Activarlas</a></div></div>`
              : html`<span class="badge ok">Recibiendo reservas en línea</span><span class="faint" style="font-size:12.5px">${booking.auto_confirm === false ? 'Las citas llegan pendientes de confirmar.' : 'Las citas se confirman solas.'}</span>`}
          </div>
          <div class="bl-short">${raw(icon('link', 'ic-sm'))}<span class="lbl"><small>Enlace corto</small><code>${bare(short)}</code></span>
            <button type="button" class="btn btn-ghost btn-sm" data-act="copy-short" aria-label="Copiar enlace corto">${raw(icon('copy', 'ic-sm'))}Copiar</button>
            <span class="note">${demoOrLocal ? 'En la demo solo funciona el enlace principal; en tu página publicada funcionan los dos.' : 'Más fácil de dictar por teléfono o escribir a mano. Lleva a la misma página.'}</span></div>
        </section>

        <section class="card card-pad bl-qr fade-up" aria-labelledby="blQ" style="animation-delay:.06s">
          <div class="bl-qrhead"><div><h3 id="blQ" style="font-size:15px;font-weight:600">Código QR</h3><div class="faint" style="font-size:12.5px">Tus clientes lo escanean con la cámara.</div></div>
            <button type="button" class="btn btn-ghost btn-sm" data-act="full" aria-label="Mostrar el QR en pantalla completa">${raw(icon('maximize', 'ic-sm'))}Mostrar</button></div>
          <div class="bl-qrbox" id="blQrBox" role="img" aria-label="${'Código QR de ' + bare(url)}" data-act="full">${raw(qrMarkup(300))}</div>
          <div class="bl-qrcap"><b>Escanea y reserva</b><span>${sh.name}</span></div>
          <div class="bl-seg"><div class="seg" role="group" aria-label="Centro del QR">
            <button type="button" data-logo="1" aria-pressed="${String(withLogo)}">${sh.logo_url ? 'Con logo' : 'Con iniciales'}</button>
            <button type="button" data-logo="0" aria-pressed="${String(!withLogo)}">Solo código</button></div></div>
          <div class="bl-dl">
            <button type="button" class="btn btn-secondary" data-act="png">${raw(icon('download'))}PNG</button>
            <button type="button" class="btn btn-secondary" data-act="svg">${raw(icon('download'))}SVG</button>
            <button type="button" class="btn btn-dark" data-act="poster">${raw(icon('receipt'))}Imprimir cartel</button>
          </div>
          <p class="faint" style="font-size:12.5px;text-align:center;margin-top:12px">PNG de 1024 px para redes; SVG para imprenta (no pierde calidad). Pruébalo con la cámara de tu celular.</p>
        </section>

        <section class="card bl-texts fade-up" aria-labelledby="blT" style="animation-delay:.1s">
          <div class="card-head"><div><h3 id="blT">Textos listos para compartir</h3><div class="sub">Cópialos tal cual o ajústalos a tu estilo.</div></div></div>
          <div class="card-body">
            ${snips.map((s) => html`<article class="bl-snip" data-snip="${s.k}">
              <header><span class="ic-b ${s.wa ? 'wa' : ''}">${raw(icon(s.icon))}</span><div class="grow"><b>${s.title}</b><small>${s.sub}</small></div></header>
              <pre>${s.text}</pre>
              <footer>${s.max ? html`<span class="cnt ${Array.from(s.text).length > s.max ? 'over' : ''}">${Array.from(s.text).length}/${s.max} caracteres</span>` : html`<span class="cnt"></span>`}
                ${s.send ? html`<a class="btn btn-ghost btn-sm" href="${'https://wa.me/?text=' + encodeURIComponent(s.text)}" target="_blank" rel="noopener">${raw(icon('whatsapp', 'ic-sm'))}Enviar</a>` : ''}
                <button type="button" class="btn btn-secondary btn-sm" data-copy-snip="${s.k}">${raw(icon('copy', 'ic-sm'))}Copiar</button></footer>
            </article>`)}
          </div>
        </section>

        ${can('shop.update') ? html`<section class="card bl-slug fade-up" aria-labelledby="blS" style="animation-delay:.14s">
          <div class="card-head"><div><h3 id="blS">Personalizar el enlace</h3><div class="sub">Elige algo corto y fácil de dictar por teléfono.</div></div></div>
          <form class="card-body stack" id="blSlugForm" novalidate autocomplete="off">
            <div class="field"><label for="blSlug">Final de tu enlace</label>
              <div class="bl-slugin"><span class="pre" aria-hidden="true"><span class="lg">${bare(SITE_BASE)}/?b=</span><span class="sm">…/?b=</span></span>
                <input class="input" id="blSlug" name="slug" value="${sh.slug}" maxlength="40" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url" aria-describedby="blSlugPrev"/></div>
              <p class="error" id="blSlugErr">Revisa el enlace.</p>
              <p class="bl-prev" id="blSlugPrev" aria-live="polite">Solo minúsculas, números y guiones. Ejemplo: <b>barberia-gomez</b></p></div>
            <div class="banner warn">${raw(icon('alert'))}<div class="grow">Si lo cambias, <b>el enlace y el QR anteriores dejarán de funcionar</b>. Tendrás que reemplazar carteles impresos y enlaces que ya compartiste.</div></div>
            <div class="row end"><button type="submit" class="btn btn-primary" id="blSlugSave" disabled>${raw(icon('check'))}Guardar enlace</button></div>
          </form>
        </section>` : ''}
      </div>`);

    const offs = [];
    const paintQr = () => {
      const box = $('#blQrBox', el);
      box.innerHTML = qrMarkup(300);
      box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    };
    offs.push(on(el, 'click', '[data-logo]', (e, b) => {
      withLogo = b.dataset.logo === '1';
      LS.set('tb:qr:logo', withLogo ? '1' : '0');
      el.querySelectorAll('[data-logo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paintQr();
    }));
    offs.push(on(el, 'click', '[data-act]', async (e, b) => {
      const act = b.dataset.act;
      if (act === 'copy') return copyText(url, 'Enlace copiado. Pégalo donde quieras.');
      if (act === 'copy-short') return copyText(short, 'Enlace corto copiado');
      if (act === 'full') {
        // Para que un cliente lo escanee directo desde tu celular o tu mostrador.
        modal({ title: 'Escanea para reservar', size: 'sm',
          body: html`<div class="bl-full"><div class="qr" role="img" aria-label="${'Código QR de ' + bare(url)}">${raw(qrMarkup(380))}</div><b>${sh.name}</b><span>${bare(url)}</span></div>`,
          actions: [{ label: 'Listo', variant: 'primary' }] });
        return;
      }
      if (act === 'share') {
        const data = { title: sh.name, text: 'Reserva tu cita en ' + sh.name + ' en segundos 💈', url };
        if (navigator.share) {
          try { await navigator.share(data); } catch (err) { if (err && err.name !== 'AbortError') copyText(url, 'No se pudo abrir compartir; copiamos el enlace.'); }
        } else copyText(data.text + ' ' + url, 'Invitación copiada. Pégala en WhatsApp o redes.');
        return;
      }
      if (act === 'png') {
        try {
          const blob = await busy(b, pngWithLogo(url, qrOpts(1024), withLogo ? sh.logo_url : '', initialsOpts(1024)));
          saveFile('qr-reservas-' + sh.slug + '.png', blob);
          toast.success('QR descargado en PNG (1024 px)');
        } catch (err) { toast.error('No se pudo generar el PNG. Intenta con el SVG.'); }
        return;
      }
      if (act === 'svg') {
        saveFile('qr-reservas-' + sh.slug + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + qrMarkup(1024), 'image/svg+xml;charset=utf-8');
        toast.success('QR descargado en SVG');
        return;
      }
      if (act === 'poster') {
        const doc = posterHtml(sh, url, qrMarkup(600));
        const w = window.open('', '_blank');
        if (!w) {
          toast.error('Tu navegador bloqueó la ventana del cartel.', { action: { label: 'Descargar', onClick: () => saveFile('cartel-reservas-' + sh.slug + '.html', doc, 'text/html;charset=utf-8') } });
          return;
        }
        w.document.open(); w.document.write(doc); w.document.close();
        try { w.focus(); } catch (err) { /* */ }
      }
    }));
    offs.push(on(el, 'click', '[data-copy-snip]', (e, b) => {
      const s = snips.find((x) => x.k === b.dataset.copySnip);
      if (s) copyText(s.text, s.title + ': texto copiado');
    }));

    // ── Cambio de slug ──
    const form = $('#blSlugForm', el);
    if (form) {
      const inp = form.elements.slug, save = $('#blSlugSave', el), prev = $('#blSlugPrev', el), err = $('#blSlugErr', el);
      const field = inp.closest('.field');
      const check = (showErr) => {
        const v = inp.value;
        const p = slugProblem(v, sh.slug);
        save.disabled = !!p || v === sh.slug;
        if (p && showErr) { field.classList.add('invalid'); err.textContent = p; } else field.classList.remove('invalid');
        prev.innerHTML = v && !p && v !== sh.slug
          ? String(html`Tu nuevo enlace será <b>${bare(SITE_BASE)}/?b=${v}</b>`)
          : v === sh.slug ? 'Este es tu enlace actual. Escribe uno nuevo para cambiarlo.' : 'Solo minúsculas, números y guiones. Ejemplo: <b>barberia-gomez</b>';
        return p;
      };
      check(false);
      offs.push(on(form, 'input', '#blSlug', () => {
        const pos = inp.selectionStart, before = inp.value;
        const n = normSlug(before);
        if (n !== before) { inp.value = n; try { inp.setSelectionRange(Math.max(0, pos - (before.length - n.length)), Math.max(0, pos - (before.length - n.length))); } catch (e) { /* */ } }
        check(inp.value.length >= 3 && inp.value !== sh.slug);
      }));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = inp.value;
        const p = check(true);
        if (p) { inp.focus(); return; }
        if (v === sh.slug) return;
        const ok = await confirmDialog({
          title: '¿Cambiar tu enlace de reservas?', icon: 'alert', danger: true, confirmText: 'Sí, cambiar enlace',
          message: 'El enlace ' + bare(url) + ' y el QR que ya imprimiste o compartiste dejarán de funcionar. Tu nuevo enlace será ' + bare(bookingUrl(v)) + '.'
        });
        if (!ok) return;
        try {
          await busy(save, api.patch('/shop', { slug: v }));
          toast.success('Listo: tu nuevo enlace es ' + bare(bookingUrl(v)) + '. Descarga el QR nuevo.');
          showNewQr = true;
          await window.TB.refreshContext();
        } catch (er) {
          field.classList.add('invalid');
          err.textContent = (er.fields && er.fields.slug) || er.message;
          if (!(er.fields && er.fields.slug)) toast.error(er);
          inp.focus();
          field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
        }
      });
    }
    if (showNewQr) {
      showNewQr = false;
      requestAnimationFrame(() => {
        const q = $('.bl-qr', el), box = $('#blQrBox', el);
        if (q) q.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (box) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
      });
    }
    return () => offs.forEach((f) => f());
  }
};
