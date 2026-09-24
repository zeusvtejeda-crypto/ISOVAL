// Instalar la app (PWA). Detecta dispositivo y navegador, ofrece "Instalar ahora" cuando el navegador lo
// permite (beforeinstallprompt → window.TB.pwa.prompt) y muestra los pasos exactos de cada sistema.
// Ruta pública: sin sesión se ve suelta (con enlace para volver al acceso); con sesión, dentro del shell.
import { html, raw, esc, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { bus } from '../lib/state.js';
import { toast, copyText } from '../lib/ui.js';
import { APP_BASE } from '../lib/api.js';

const ICON_SRC = new URL('../icons/icon-192.png', import.meta.url).href;
const INSTALL_URL = APP_BASE + '#/instalar';
const pwa = () => (window.TB && window.TB.pwa) || {};
const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);

// ── Detección ────────────────────────────────────────────────────────────
export function detectPlatform() {
  const ua = navigator.userAgent || '';
  const standalone = mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)') || mq('(display-mode: minimal-ui)') ||
    mq('(display-mode: window-controls-overlay)') || navigator.standalone === true;
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1; // iPad que se anuncia como Mac
  const ios = /iPhone|iPad|iPod/i.test(ua) || iPadOS;
  const android = !ios && /Android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Snapchat|GSA\/|; wv\)/i.test(ua);
  let device, browser, browserName;
  if (ios) {
    device = 'ios';
    const other = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Brave/i.test(ua) || inApp;
    browser = other ? 'other' : 'safari';
    browserName = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : inApp ? 'el navegador de otra app' : other ? 'otro navegador' : 'Safari';
  } else if (android) {
    device = 'android';
    browser = /SamsungBrowser/i.test(ua) ? 'samsung' : /Firefox/i.test(ua) ? 'firefox' : inApp ? 'other' : /Chrome|Chromium/i.test(ua) ? 'chrome' : 'other';
    browserName = { samsung: 'Samsung Internet', firefox: 'Firefox', chrome: /EdgA/.test(ua) ? 'Edge' : /OPR/.test(ua) ? 'Opera' : 'Chrome', other: inApp ? 'el navegador de otra app' : 'otro navegador' }[browser];
  } else {
    device = 'desktop';
    browser = /Firefox/i.test(ua) ? 'firefox' : /Edg\/|Chrome|Chromium|OPR/.test(ua) ? 'chromium' : /Safari/.test(ua) && /Macintosh/.test(ua) ? 'safari' : 'other';
    browserName = browser === 'firefox' ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /OPR/.test(ua) ? 'Opera' : browser === 'chromium' ? 'Chrome' : browser === 'safari' ? 'Safari' : 'tu navegador';
  }
  const deviceName = ios ? (/iPad/i.test(ua) || iPadOS ? 'iPad' : 'iPhone') : android ? 'Android' :
    /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Computadora';
  return { device, browser, deviceName, browserName, standalone, inApp };
}

// ── Piezas visuales ──────────────────────────────────────────────────────
// Tecla/botón del sistema dibujado en línea: k('share-ios', 'Compartir'), k('more-v'), k(null, 'Agregar').
const k = (ic, label) => '<span class="ins-key' + (label ? '' : ' solo') + '">' + (ic ? icon(ic) : '') + (label ? esc(label) : '') + '</span>';
const q = (s) => '<b>“' + esc(s) + '”</b>';
const copyBtn = '<button type="button" class="btn btn-secondary btn-sm" data-act="copy" style="margin-top:8px">' + icon('copy', 'ic-sm') + 'Copiar enlace</button>';

// Barras de navegador simplificadas con el botón que hay que tocar resaltado.
function mock(kind) {
  const host = esc(location.host || 'tubarberia.mx');
  const it = (ic, hot) => '<span class="it' + (hot ? ' hot' : '') + '">' + icon(ic) + '</span>';
  const url = (extra) => '<span class="url">' + icon('lock', 'ic-sm') + '<span class="truncate">' + host + '</span>' + (extra || '') + '</span>';
  const bars = {
    'ios-safari': ['<div class="ins-bar spread">' + it('chevron-left') + it('chevron-right') + it('share-ios', true) + it('book') + it('copy') + '</div>', 'Barra de Safari en iPhone (en iPad está arriba, a la derecha)'],
    'android-chrome': ['<div class="ins-bar">' + it('home') + url() + '<span class="it"><span class="tabs-n">2</span></span>' + it('more-v', true) + '</div>', 'Barra de Chrome en Android'],
    'android-samsung': ['<div class="ins-bar spread">' + it('chevron-left') + it('chevron-right') + it('home') + it('copy') + it('menu', true) + '</div>', 'Barra inferior de Samsung Internet'],
    'android-firefox': ['<div class="ins-bar">' + url() + '<span class="it"><span class="tabs-n">2</span></span>' + it('more-v', true) + '</div>', 'Barra de Firefox en Android'],
    'desktop-chromium': ['<div class="ins-bar"><span class="dots"><i></i><i></i><i></i></span>' + url('<span class="it hot in-url">' + icon('monitor-down') + '</span>') + it('more-v') + '</div>', 'Barra de direcciones de Chrome o Edge'],
    'desktop-safari': ['<div class="ins-bar menu"><span class="m b"></span><span class="m">Safari</span><span class="m hot">Archivo</span><span class="m">Edición</span><span class="m">Visualización</span></div>', 'Barra de menús de la Mac']
  };
  const b = bars[kind];
  return b ? '<figure class="ins-mock" aria-hidden="true">' + b[0] + '<figcaption>' + esc(b[1]) + '</figcaption></figure>' : '';
}

// ── Guías por dispositivo y navegador ────────────────────────────────────
const SAFARI_STEPS = [
  { t: 'Toca ' + k('share-ios', 'Compartir') + ' en la barra de Safari.', n: 'En iPhone está abajo; en iPad, arriba a la derecha. Si no lo ves (iOS 26), toca ' + k('more') + ' y luego ' + q('Compartir') + '.' },
  { t: 'Desliza hacia abajo y toca ' + k('plus-square', 'Agregar a inicio') + '.', n: 'En algunas versiones se llama ' + q('Agregar a pantalla de inicio') + '.' },
  { t: 'Toca ' + k(null, 'Agregar') + ' arriba a la derecha.', n: 'Si aparece la opción ' + q('Abrir como app web') + ', déjala activada.' },
  { t: 'Abre <b>TuBarbería</b> desde tu pantalla de inicio.', n: 'Se abre a pantalla completa, sin la barra de Safari.' }
];
const CHROMIUM_STEPS = [
  { t: 'Haz clic en ' + k('monitor-down', 'Instalar') + ' a la derecha de la barra de direcciones.', n: 'Si no lo ves, abre el menú ' + k('more-v') + ' → ' + q('Transmitir, guardar y compartir') + ' → ' + q('Instalar página como app…') + '. En Edge: menú ' + k('more') + ' → ' + q('Aplicaciones') + ' → ' + q('Instalar este sitio como una aplicación') + '.' },
  { t: 'Confirma con ' + k(null, 'Instalar') + '.' },
  { t: 'Se abre en su propia ventana.', n: 'Ánclala a la barra de tareas (Windows) o al Dock (Mac) para tenerla a un clic.' }
];
const GUIDES = {
  ios: {
    label: 'iPhone o iPad', icon: 'smartphone',
    browsers: [['safari', 'Safari'], ['other', 'Chrome u otro']],
    safari: { mock: 'ios-safari', steps: SAFARI_STEPS },
    other: {
      warn: 'En iPhone y iPad las apps web se instalan desde <b>Safari</b>. Abre esta página ahí:',
      steps: [
        { t: 'Copia el enlace de esta página.', x: copyBtn },
        { t: 'Abre ' + k(null, 'Safari') + ' y pega el enlace en la barra de direcciones.' },
        { t: 'Toca ' + k('share-ios', 'Compartir') + ' → ' + k('plus-square', 'Agregar a inicio') + ' → ' + k(null, 'Agregar') + '.' }
      ],
      foot: 'Algunas versiones recientes de Chrome para iPhone también muestran ' + q('Agregar a pantalla de inicio') + ' dentro de su menú ' + k('share-ios', 'Compartir') + '.'
    }
  },
  android: {
    label: 'Android', icon: 'smartphone',
    browsers: [['chrome', 'Chrome'], ['samsung', 'Samsung Internet'], ['firefox', 'Firefox']],
    chrome: {
      mock: 'android-chrome',
      steps: [
        { t: 'Toca el menú ' + k('more-v') + ' arriba a la derecha de Chrome.' },
        { t: 'Elige ' + k('smartphone', 'Instalar app') + ' o ' + k('plus-square', 'Agregar a pantalla principal') + '.', n: 'Si Chrome te muestra abajo el aviso ' + q('Instalar app') + ', también puedes tocarlo.' },
        { t: 'Confirma con ' + k(null, 'Instalar') + '.', n: 'El ícono aparece en tu pantalla principal y en el cajón de apps.' }
      ]
    },
    samsung: {
      mock: 'android-samsung',
      steps: [
        { t: 'Toca el menú ' + k('menu') + ' abajo a la derecha.', n: 'Si ves el ícono de instalar en la barra de direcciones, tócalo: te lleva al mismo lugar.' },
        { t: 'Elige ' + k('plus-square', 'Agregar página a') + ' y luego ' + q('Pantalla de inicio') + '.' },
        { t: 'Confirma con ' + k(null, 'Agregar') + '.' }
      ]
    },
    firefox: {
      mock: 'android-firefox',
      steps: [
        { t: 'Toca el menú ' + k('more-v') + ' de Firefox.' },
        { t: 'Elige ' + k('smartphone', 'Instalar') + ' o ' + k('plus-square', 'Agregar a pantalla de inicio') + '.' },
        { t: 'Confirma con ' + k(null, 'Agregar') + '.' }
      ]
    },
    other: {
      warn: 'Estás en el navegador de otra app. Para instalarla, ábrela en <b>Chrome</b>: toca ' + k('more-v') + ' → ' + q('Abrir en Chrome') + ' (o copia el enlace).',
      steps: [
        { t: 'Copia el enlace de esta página.', x: copyBtn },
        { t: 'Ábrelo en ' + k(null, 'Chrome') + '.' },
        { t: 'Toca ' + k('more-v') + ' → ' + k('smartphone', 'Instalar app') + ' → ' + k(null, 'Instalar') + '.' }
      ]
    }
  },
  desktop: {
    label: 'Computadora', icon: 'monitor',
    browsers: [['chromium', 'Chrome o Edge'], ['safari', 'Safari (Mac)'], ['firefox', 'Firefox']],
    chromium: { mock: 'desktop-chromium', steps: CHROMIUM_STEPS },
    safari: {
      mock: 'desktop-safari',
      steps: [
        { t: 'En la barra de menús, abre ' + k(null, 'Archivo') + '.' },
        { t: 'Elige ' + k('plus-square', 'Agregar al Dock…') + '.', n: 'Requiere macOS Sonoma o posterior. También está en ' + k('share-ios', 'Compartir') + '.' },
        { t: 'Confirma con ' + k(null, 'Agregar') + '.', n: 'La encontrarás en el Dock y en Launchpad.' }
      ]
    },
    firefox: {
      warn: 'Firefox para computadora todavía no instala apps web. Ábrela en <b>Chrome</b> o <b>Edge</b>:',
      steps: [
        { t: 'Copia el enlace de esta página.', x: copyBtn },
        { t: 'Pégalo en Chrome o Edge.' },
        { t: 'Haz clic en ' + k('monitor-down', 'Instalar') + ' en la barra de direcciones y confirma.' }
      ]
    },
    other: { mock: 'desktop-chromium', steps: CHROMIUM_STEPS, warn: 'Si tu navegador no muestra la opción, abre esta página en Chrome o Edge.' }
  }
};

const BENEFITS = [
  ['smartphone', 'Se abre como app', 'Con su ícono en tu pantalla de inicio, sin buscar el enlace ni abrir el navegador.'],
  ['maximize', 'Pantalla completa', 'Sin barras del navegador: más espacio para tu agenda y tu caja.'],
  ['zap', 'Acceso rápido desde el inicio', 'Un toque y estás en tu agenda. En Android y computadora, mantén presionado el ícono para ir directo a Agenda, Nueva cita o Caja.'],
  ['bell', 'Insignia de notificaciones', 'En los equipos compatibles, el ícono muestra cuántos avisos tienes sin leer.']
];

// ── Estilos propios de la vista (una sola vez) ───────────────────────────
const CSS = `
.ins-bare{max-width:1120px;margin:0 auto;padding:calc(14px + var(--safe-t)) 16px calc(36px + var(--safe-b));animation:pageIn .32s var(--ease-out)}
@media (min-width:1024px){.ins-bare{padding:28px 32px 56px}}
.ins-top{margin-bottom:6px}
.ins-top .logo-mark{width:34px;height:34px;border-radius:10px}.ins-top .logo-mark svg{width:19px;height:19px}
.ins-top .brandname{font-size:19px}
.ins-layout{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
.ins-layout>*{min-width:0}.ins-layout>aside{grid-template-columns:minmax(0,1fr)}
@media (min-width:1024px){.ins-layout{grid-template-columns:minmax(0,1fr) 340px;align-items:start;gap:20px}.ins-hero{grid-column:1/-1}}
.ins-hero{position:relative;overflow:hidden;isolation:isolate;display:grid;gap:22px;padding:22px 20px;border-radius:var(--r-xl);background:var(--ink);color:#F2EDE3;border:1px solid rgba(217,178,90,.2);box-shadow:var(--shadow-2)}
.ins-hero::before{content:"";position:absolute;inset:-30%;z-index:-1;background:radial-gradient(circle at 18% 12%,rgba(217,178,90,.24),transparent 42%),radial-gradient(circle at 92% 100%,rgba(217,178,90,.13),transparent 40%);pointer-events:none}
@media (min-width:760px){.ins-hero{grid-template-columns:minmax(0,1fr) 216px;align-items:center;padding:34px 36px;gap:36px}}
.ins-hero .eyebrow{color:#D9B25A}
.ins-hero h3{font-family:var(--disp);font-size:36px;font-weight:800;line-height:.98;letter-spacing:.01em;margin:8px 0 10px}
@media (min-width:760px){.ins-hero h3{font-size:46px}}
.ins-hero h3 em{font-style:normal;color:#D9B25A}
.ins-hero .lede{color:#BDB5A5;max-width:480px;font-size:15px}
.ins-id{display:flex;align-items:center;gap:12px;margin-top:18px}
.ins-id img{width:56px;height:56px;border-radius:14px;flex:none;box-shadow:0 10px 26px rgba(0,0,0,.45),0 0 0 1px rgba(217,178,90,.25)}
.ins-id b{display:block;font-size:16px}.ins-id small{display:block;color:#A39A88;font-size:12.5px}
.ins-det{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:3px 9px;border-radius:999px;background:rgba(242,237,227,.08);color:#D9D3C6;font-size:12px;font-weight:500}
.ins-det .ic{width:13px;height:13px;color:#D9B25A}
.ins-action{margin-top:20px;display:grid;gap:10px;justify-items:start}
.ins-action .btn-lg{min-width:220px}
.ins-action .hint{color:#A39A88;font-size:13px}
.ins-state{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(242,237,227,.06);border:1px solid rgba(242,237,227,.1);max-width:520px}
.ins-state .ic{width:22px;height:22px;flex:none;margin-top:1px}
.ins-state b{display:block;color:#F2EDE3}.ins-state span{color:#BDB5A5;font-size:13.5px}
.ins-state.ok .ic{color:#6FBF8A}.ins-state.warn .ic{color:#E5A84B}.ins-state.brand .ic{color:#D9B25A}
.ins-state .btn{margin-top:10px}
.ins-hero .btn-secondary{background:rgba(242,237,227,.08);border-color:rgba(242,237,227,.18);color:#F2EDE3;box-shadow:none}
.ins-hero .btn-secondary:hover{background:rgba(242,237,227,.14)}
.ins-phone{display:none}
@media (min-width:760px){.ins-phone{display:block;width:216px;height:330px;padding:9px;border-radius:38px;background:#050504;border:1px solid rgba(242,237,227,.14);box-shadow:0 30px 60px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.03);transform:rotate(3deg)}}
.ins-phone .scr{position:relative;height:100%;border-radius:30px;overflow:hidden;padding:36px 14px 0;background:radial-gradient(circle at 30% 20%,#4a3c22,transparent 55%),linear-gradient(160deg,#2c251a,#15130F 60%,#2a2216)}
.ins-phone .scr::before{content:"";position:absolute;top:9px;left:50%;width:62px;height:18px;margin-left:-31px;border-radius:999px;background:#050504}
.ins-phone .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 11px}
.ins-phone .grid>*,.ins-phone .dock>*{min-width:0}
.ins-phone .a{aspect-ratio:1;border-radius:10px;background:rgba(242,237,227,.1)}
.ins-phone .me{position:relative;display:grid;justify-items:center;gap:4px;margin-bottom:-12px}
.ins-phone .me img{width:100%;border-radius:10px;box-shadow:0 0 0 2px #D9B25A,0 0 18px rgba(217,178,90,.55);animation:insGlow 2.4s var(--ease) infinite}
.ins-phone .me span{font-size:8.5px;color:#F2EDE3;white-space:nowrap;letter-spacing:.01em}
.ins-phone .me i{position:absolute;top:-6px;right:-7px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#E5484D;color:#fff;font:700 10px/17px var(--sans);font-style:normal;text-align:center;box-shadow:0 0 0 2px #1d1913}
.ins-phone .dock{position:absolute;left:10px;right:10px;bottom:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;padding:9px;border-radius:20px;background:rgba(242,237,227,.1);backdrop-filter:blur(6px)}
@keyframes insGlow{0%,100%{box-shadow:0 0 0 2px #D9B25A,0 0 10px rgba(217,178,90,.35)}50%{box-shadow:0 0 0 2px #D9B25A,0 0 22px rgba(217,178,90,.7)}}
#insGuide{scroll-margin-top:calc(var(--topbar-h) + var(--safe-t) + 12px)}
.ins-dev{display:flex;width:100%}.ins-dev button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.ins-dev .ic{width:16px;height:16px}
@media (max-width:440px){.ins-dev .ic{display:none}.ins-dev button{padding:0 8px}}
.ins-br .chip .dot{width:7px;height:7px}.ins-br .chip[aria-pressed="true"] .dot{background:currentColor}
.ins-mock{margin:2px 0 4px}
.ins-mock figcaption{font-size:12px;color:var(--text-3);margin-top:6px}
.ins-bar{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-3);max-width:460px}
.ins-bar .it{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;flex:none;color:var(--text-2)}
.ins-bar .it .ic{width:19px;height:19px}
.ins-bar .url{flex:1;min-width:0;height:34px;border-radius:10px;background:var(--surface-3);display:flex;align-items:center;gap:6px;padding:0 4px 0 10px;font-size:12.5px;color:var(--text-2)}
.ins-bar .url .ic{width:13px;height:13px;flex:none}
.ins-bar .url .truncate{flex:1}
.ins-bar .it.in-url{width:28px;height:28px}
.ins-bar .tabs-n{width:18px;height:18px;border:1.8px solid currentColor;border-radius:5px;font-size:10px;font-weight:700;display:grid;place-items:center}
.ins-bar .hot{color:var(--brand-strong);background:var(--brand-soft);animation:insPulse 1.9s var(--ease) infinite}
.ins-bar .dots{display:flex;gap:6px;padding:0 6px 0 4px}.ins-bar .dots i{width:10px;height:10px;border-radius:50%;background:var(--border-strong)}
.ins-bar.spread{justify-content:space-around}
.ins-bar.menu{gap:2px;padding:5px 8px;font-size:13px;color:var(--text)}
.ins-bar.menu .m{padding:5px 9px;border-radius:7px;white-space:nowrap}
.ins-bar.menu .m.b{width:12px;height:14px;padding:0;margin:0 6px 0 2px;border-radius:50% 50% 45% 45%;background:var(--text)}
.ins-bar.menu .m:nth-child(2){font-weight:700}
.ins-bar.menu .m.hot{font-weight:600}
@keyframes insPulse{0%,100%{box-shadow:0 0 0 2px var(--brand),0 0 0 0 rgba(217,178,90,.5)}60%{box-shadow:0 0 0 2px var(--brand),0 0 0 8px rgba(217,178,90,0)}}
.install-steps.ins-steps{margin-top:4px}
.ins-steps li{padding-top:4px}
.ins-steps .t{font-size:15px;line-height:1.75}
.ins-steps .n{font-size:13px;color:var(--text-2);margin-top:2px;line-height:1.7}
.ins-key{display:inline-flex;align-items:center;gap:5px;vertical-align:middle;height:26px;padding:0 9px;margin:0 1px;border-radius:8px;background:var(--surface);border:1px solid var(--border-strong);box-shadow:0 1.5px 0 var(--border-strong);font-size:13px;font-weight:600;line-height:1;color:var(--text);white-space:nowrap}
.ins-key.solo{padding:0 5px}
.ins-key .ic{width:15px;height:15px;color:var(--brand-strong);stroke-width:2}
.ins-n .ins-key,.ins-steps .n .ins-key{height:22px;font-size:12px;border-radius:7px}
.ins-steps .n .ins-key .ic{width:13px;height:13px}
.ins-foot{font-size:13px;color:var(--text-2);padding-top:12px;border-top:1px solid var(--border);line-height:1.7}
.ins-bens{display:grid;gap:16px}
.ins-ben{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start}
.ins-ben .ib{width:40px;height:40px;border-radius:12px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center}
.ins-ben b{display:block;font-size:14.5px}.ins-ben p{font-size:13px;color:var(--text-2);margin-top:2px}
`;

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Instalar app',
  async render(el, { bare }) {
    if (!document.getElementById('st-install')) document.head.insertAdjacentHTML('beforeend', '<style id="st-install">' + CSS + '</style>');
    const det = detectPlatform();
    let dev = det.device;
    let br = { ios: 'safari', android: 'chrome', desktop: 'chromium' };
    br[det.device] = det.browser === 'other' && det.device === 'desktop' ? 'chromium' : det.browser;

    const head = html`<div class="page-head"><div><h2>Instalar app</h2><p>Ten TuBarbería en tu pantalla de inicio, como cualquier app.</p></div></div>`;
    const top = bare ? html`<div class="row between ins-top">
        <a href="#/login" class="link-btn">${raw(icon('arrow-left', 'ic-sm'))}Volver al acceso</a>
        <span class="row" style="gap:8px"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></span>
      </div>` : '';

    const body = html`
      <div class="ins-layout">
        <section class="ins-hero fade-up" aria-labelledby="insTitle">
          <div>
            <span class="eyebrow">App para iPhone, Android y computadora</span>
            <h3 id="insTitle">Tu barbería,<br/><em>a un toque.</em></h3>
            <p class="lede">Instálala en tu celular o computadora: se abre como app, a pantalla completa y sin buscar el enlace.</p>
            <div class="ins-id">
              <img src="${ICON_SRC}" width="56" height="56" alt="Ícono de TuBarbería"/>
              <div><b>TuBarbería</b><small>Gratis · sin tienda de apps · se actualiza sola</small>
                <span class="ins-det">${raw(icon(det.device === 'desktop' ? 'monitor' : 'smartphone'))}Este equipo: ${det.deviceName} · ${det.browserName}</span></div>
            </div>
            <div class="ins-action" id="insAction" aria-live="polite"></div>
          </div>
          <div class="ins-phone" aria-hidden="true"><div class="scr">
            <div class="grid">
              <span class="a"></span><span class="a"></span><span class="a"></span><span class="a"></span>
              <span class="a"></span><span class="me"><img src="${ICON_SRC}" alt=""/><span>TuBarbería</span><i>3</i></span><span class="a"></span><span class="a"></span>
              <span class="a"></span><span class="a"></span><span class="a"></span><span class="a"></span>
            </div>
            <div class="dock"><span class="a"></span><span class="a"></span><span class="a"></span><span class="a"></span></div>
          </div></div>
        </section>

        <section class="card" id="insGuide" aria-labelledby="insGuideT">
          <div class="card-head"><div><h3 id="insGuideT">Cómo instalarla</h3><p class="sub">Elige tu dispositivo y tu navegador. Toma menos de un minuto.</p></div></div>
          <div class="card-body stack" style="gap:14px">
            <div class="seg ins-dev" role="tablist" aria-label="Dispositivo">
              ${Object.entries(GUIDES).map(([key, g]) => html`<button type="button" role="tab" data-dev="${key}" aria-selected="${String(key === dev)}">${raw(icon(g.icon))}${g.label}</button>`)}
            </div>
            <div class="chips ins-br" id="insBr" role="group" aria-label="Navegador"></div>
            <div id="insSteps" class="stack" style="gap:14px"></div>
          </div>
        </section>

        <aside class="stack-lg">
          <section class="card card-pad" aria-labelledby="insBenT">
            <h3 class="section-title" id="insBenT">Por qué instalarla</h3>
            <div class="ins-bens stagger">
              ${BENEFITS.map(([ic, t, d]) => html`<div class="ins-ben"><span class="ib">${raw(icon(ic))}</span><div><b>${t}</b><p>${d}</p></div></div>`)}
            </div>
          </section>
          <section class="card card-pad" aria-labelledby="insShareT">
            <h3 class="section-title" id="insShareT">Instálala en otro equipo</h3>
            <p class="muted" style="font-size:13.5px;margin:-4px 0 12px">Abre este enlace en el celular de tu equipo o en la computadora de la barbería.</p>
            <div class="copy-field"><span>${INSTALL_URL.replace(/^https?:\/\//, '')}</span>
              <button type="button" class="btn btn-ghost btn-sm" data-act="copy">${raw(icon('copy', 'ic-sm'))}Copiar</button></div>
            ${navigator.share ? html`<button type="button" class="btn btn-secondary btn-block" data-act="share" style="margin-top:10px">${raw(icon('share'))}Compartir enlace</button>` : ''}
          </section>
        </aside>
      </div>`;

    el.innerHTML = bare
      ? '<div class="ins-bare">' + String(top) + String(head) + String(body) + '</div>'
      : String(head) + String(body);

    // ── Área de acción (se repinta cuando llega beforeinstallprompt o se instala) ──
    let accepted = false; // el usuario aceptó el diálogo; falta que el navegador confirme con 'appinstalled'
    const paintAction = () => {
      const box = $('#insAction', el);
      if (!box) return;
      const d = detectPlatform();
      const p = pwa();
      let out;
      if (d.standalone) {
        out = state('ok', 'check-circle', 'Ya estás usando la app', 'Ábrela siempre desde el ícono de TuBarbería en tu pantalla de inicio.');
      } else if (p.installed || accepted) {
        out = p.installed
          ? state('ok', 'check-circle', 'Ya está instalada en este equipo', 'Búscala en tu pantalla de inicio o en tus apps. Puedes cerrar esta pestaña.')
          : state('ok', 'check-circle', 'Instalando TuBarbería…', 'En unos segundos aparecerá en tu pantalla de inicio o en tus apps.');
      } else if (p.prompt) {
        out = '<button type="button" class="btn btn-primary btn-lg" data-act="install">' + icon('download') + 'Instalar ahora</button>' +
          '<span class="hint">Tu navegador la instala en un paso. No ocupa casi espacio.</span>';
      } else if (d.device === 'ios' && d.browser === 'other') {
        out = state('warn', 'alert', 'Ábrela en Safari para instalarla', 'En iPhone y iPad las apps web se instalan desde Safari.',
          '<button type="button" class="btn btn-secondary btn-sm" data-act="copy">' + icon('copy', 'ic-sm') + 'Copiar enlace</button>');
      } else if (d.browser === 'other' && d.inApp) {
        out = state('warn', 'alert', 'Ábrela en tu navegador', 'Estás dentro de otra app. Abre esta página en ' + (d.device === 'android' ? 'Chrome' : 'tu navegador') + ' para instalarla.',
          '<button type="button" class="btn btn-secondary btn-sm" data-act="copy">' + icon('copy', 'ic-sm') + 'Copiar enlace</button>');
      } else if (d.device === 'desktop' && d.browser === 'firefox') {
        out = state('warn', 'info', 'Firefox no instala apps web', 'Abre esta página en Chrome o Edge para instalarla.',
          '<button type="button" class="btn btn-secondary btn-sm" data-act="copy">' + icon('copy', 'ic-sm') + 'Copiar enlace</button>');
      } else {
        out = '<button type="button" class="btn btn-primary btn-lg" data-act="guide">' + icon('arrow-down') + 'Ver cómo instalarla</button>' +
          '<span class="hint">' + (d.device === 'ios' ? 'Son 3 toques desde el botón Compartir de Safari.' : 'Son 2 o 3 toques desde el menú de tu navegador.') + '</span>';
      }
      box.innerHTML = out;
    };
    const state = (kind, ic, title, text, extra) =>
      '<div class="ins-state ' + kind + '">' + icon(ic) + '<div><b>' + esc(title) + '</b><span>' + esc(text) + '</span>' + (extra ? '<div>' + extra + '</div>' : '') + '</div></div>';

    // ── Guía por dispositivo/navegador ──
    const paintGuide = () => {
      const g = GUIDES[dev];
      el.querySelectorAll('[data-dev]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.dev === dev)));
      const cur = g[br[dev]] ? br[dev] : g.browsers[0][0];
      const list = g.browsers.some(([key]) => key === cur) ? g.browsers : g.browsers.concat([[cur, 'Otro navegador']]);
      $('#insBr', el).innerHTML = list.map(([key, label]) =>
        '<button type="button" class="chip" data-br="' + key + '" aria-pressed="' + (key === cur) + '">' +
        (dev === det.device && key === (det.browser === 'other' && dev === 'desktop' ? 'chromium' : det.browser) ? '<span class="dot" title="Tu navegador"></span>' : '') + esc(label) + '</button>').join('');
      const guide = g[cur] || g[g.browsers[0][0]];
      const s = [];
      if (guide.warn) s.push('<div class="banner warn">' + icon('alert') + '<div class="grow">' + guide.warn + '</div></div>');
      if (guide.mock) s.push(mock(guide.mock));
      s.push('<ol class="install-steps ins-steps">' + guide.steps.map((st) =>
        '<li><div><p class="t">' + st.t + '</p>' + (st.n ? '<p class="n">' + st.n + '</p>' : '') + (st.x || '') + '</div></li>').join('') + '</ol>');
      if (guide.foot) s.push('<p class="ins-foot">' + guide.foot + '</p>');
      const box = $('#insSteps', el);
      box.innerHTML = s.join('');
      box.classList.remove('fade-up'); void box.offsetWidth; box.classList.add('fade-up');
    };

    paintAction();
    paintGuide();

    // ── Acciones ──
    const install = async (btn) => {
      const p = pwa().prompt;
      if (!p) { toast.info('Tu navegador no ofrece instalación directa. Sigue los pasos de abajo.'); paintAction(); return; }
      btn.setAttribute('aria-busy', 'true');
      try {
        await p.prompt();
        const choice = await p.userChoice;
        if (window.TB && window.TB.pwa) window.TB.pwa.prompt = null; // el evento solo se puede usar una vez
        if (choice && choice.outcome === 'accepted') { accepted = true; toast.success('Instalando TuBarbería…'); }
        else toast.info('Instalación cancelada. Puedes instalarla cuando quieras.');
      } catch (e) {
        toast.error('No se pudo abrir la instalación. Sigue los pasos de abajo.');
      } finally {
        btn.removeAttribute('aria-busy');
        paintAction();
      }
    };
    const offs = [
      on(el, 'click', '[data-dev]', (e, b) => { dev = b.dataset.dev; paintGuide(); }),
      on(el, 'click', '[data-br]', (e, b) => { br[dev] = b.dataset.br; paintGuide(); }),
      on(el, 'click', '[data-act]', async (e, b) => {
        const act = b.dataset.act;
        if (act === 'install') return install(b);
        if (act === 'guide') return $('#insGuide', el).scrollIntoView({ behavior: mq('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth', block: 'start' });
        if (act === 'copy') return copyText(INSTALL_URL, 'Enlace copiado');
        if (act === 'share') {
          try { await navigator.share({ title: 'TuBarbería', text: 'Instala la app de TuBarbería', url: INSTALL_URL }); }
          catch (err) { if (err && err.name !== 'AbortError') copyText(INSTALL_URL, 'Enlace copiado'); }
        }
      }),
      bus.on('pwa:installable', paintAction),
      bus.on('pwa:installed', paintAction)
    ];
    const standaloneMq = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    if (standaloneMq && standaloneMq.addEventListener) standaloneMq.addEventListener('change', paintAction);
    return () => {
      offs.forEach((f) => f());
      if (standaloneMq && standaloneMq.removeEventListener) standaloneMq.removeEventListener('change', paintAction);
    };
  }
};
