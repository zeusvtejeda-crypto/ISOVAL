// ═══════════════════════════════════════════════════════════════
//  PANEL DE ATENCIÓN
//  Página donde el dueño del negocio ve, en vivo, qué le están
//  preguntando los clientes y qué está contestando el asistente.
//
//  Se abre con:  https://TU-SERVIDOR/panel?k=CLAVE
//  (la CLAVE es la variable de entorno PANEL_TOKEN)
//
//  Pensado para el celular: se puede guardar en la pantalla de
//  inicio y se ve como una app.
// ═══════════════════════════════════════════════════════════════
const express = require("express");
const { PANEL_TOKEN } = require("./config");
const store = require("./store");

const router = express.Router();

// La clave puede venir en la URL (?k=) o en un encabezado.
function autorizado(req) {
  if (!PANEL_TOKEN) return false; // sin clave configurada, panel apagado
  const dada = req.query.k || req.get("x-panel-token");
  return dada === PANEL_TOKEN;
}

function exigirClave(req, res, next) {
  if (autorizado(req)) return next();
  res
    .status(401)
    .json({ error: "Clave incorrecta o panel no configurado (falta PANEL_TOKEN)." });
}

// ── Datos ───────────────────────────────────────────────────────
router.get("/api/conversaciones", exigirClave, async (_req, res) => {
  try {
    res.json({
      guardado: store.HAY_REDIS,
      conversaciones: await store.listarConversaciones(),
    });
  } catch (err) {
    console.error("[panel] Error listando:", err.message);
    res.status(500).json({ error: "No se pudieron cargar las conversaciones." });
  }
});

router.get("/api/mensajes", exigirClave, async (req, res) => {
  const { negocio, usuario } = req.query;
  if (!negocio || !usuario) {
    return res.status(400).json({ error: "Faltan datos." });
  }
  try {
    res.json({ mensajes: await store.obtenerMensajes(negocio, usuario) });
  } catch (err) {
    console.error("[panel] Error leyendo mensajes:", err.message);
    res.status(500).json({ error: "No se pudo cargar la conversación." });
  }
});

// ── Página ──────────────────────────────────────────────────────
router.get("/", (req, res) => {
  if (!PANEL_TOKEN) {
    return res
      .status(503)
      .send("Panel no configurado. Falta la variable PANEL_TOKEN.");
  }
  if (!autorizado(req)) {
    return res.status(401).send(PAGINA_CLAVE);
  }
  res.type("html").send(PAGINA);
});

const PAGINA_CLAVE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel</title>
<style>
 body{margin:0;height:100vh;display:grid;place-items:center;background:#0b141a;
      color:#e9edef;font:16px/1.5 system-ui,-apple-system,sans-serif;padding:24px}
 .caja{text-align:center;max-width:320px}
 h1{font-size:20px;margin:0 0 8px}
 p{color:#8696a0;margin:0 0 20px}
 input{width:100%;padding:14px;border-radius:10px;border:1px solid #2a3942;
       background:#202c33;color:#e9edef;font-size:16px;box-sizing:border-box}
 button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:10px;
        background:#00a884;color:#fff;font-size:16px;font-weight:600}
</style></head><body>
<div class="caja">
  <h1>🔒 Panel de atención</h1>
  <p>Escribe la clave de acceso</p>
  <input id="k" type="password" placeholder="Clave" autofocus>
  <button onclick="entrar()">Entrar</button>
</div>
<script>
 function entrar(){ location.search = '?k=' + encodeURIComponent(document.getElementById('k').value); }
 document.getElementById('k').addEventListener('keydown', e => { if(e.key==='Enter') entrar(); });
</script>
</body></html>`;

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Conversaciones</title>
<style>
 *{box-sizing:border-box}
 body{margin:0;background:#0b141a;color:#e9edef;
      font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
      padding-bottom:env(safe-area-inset-bottom)}
 header{position:sticky;top:0;z-index:10;background:#202c33;
        padding:calc(12px + env(safe-area-inset-top)) 16px 12px;
        display:flex;align-items:center;gap:12px;border-bottom:1px solid #2a3942}
 header h1{font-size:17px;margin:0;flex:1;font-weight:600}
 .volver{background:none;border:0;color:#00a884;font-size:22px;padding:0 4px;
         cursor:pointer;line-height:1;display:none}
 .aviso{background:#3b2f14;color:#ffd279;font-size:12.5px;padding:9px 16px;
        border-bottom:1px solid #4a3a18}
 .lista{padding:0}
 .chat{display:flex;gap:12px;align-items:center;padding:13px 16px;
       border-bottom:1px solid #1f2c33;cursor:pointer}
 .chat:active{background:#182229}
 .avatar{width:44px;height:44px;border-radius:50%;background:#2a3942;flex:0 0 auto;
         display:grid;place-items:center;font-size:19px}
 .info{flex:1;min-width:0}
 .fila{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
 .nombre{font-weight:600;font-size:15.5px}
 .hora{color:#8696a0;font-size:11.5px;flex:0 0 auto}
 .adelanto{color:#8696a0;font-size:13.5px;white-space:nowrap;
           overflow:hidden;text-overflow:ellipsis;margin-top:2px}
 .etiqueta{display:inline-block;background:#0b3b31;color:#00d9a3;font-size:10.5px;
           padding:1px 6px;border-radius:4px;margin-right:5px;vertical-align:1px}
 #hilo{display:none;padding:14px 12px 24px}
 .msg{max-width:82%;padding:8px 11px;border-radius:9px;margin-bottom:8px;
      white-space:pre-wrap;word-wrap:break-word;font-size:14.5px}
 .cliente{background:#202c33;border-top-left-radius:2px}
 .bot{background:#005c4b;margin-left:auto;border-top-right-radius:2px}
 .meta{font-size:10.5px;color:#8696a0;margin-top:4px;text-align:right}
 .vacio{text-align:center;color:#8696a0;padding:60px 24px;font-size:14px}
 .punto{display:inline-block;width:7px;height:7px;border-radius:50%;
        background:#00d9a3;margin-right:6px;vertical-align:1px}
</style></head><body>

<header>
  <button class="volver" id="volver" onclick="verLista()">‹</button>
  <h1 id="titulo">Conversaciones</h1>
  <span style="font-size:11px;color:#8696a0" id="estado"><span class="punto"></span>en vivo</span>
</header>
<div class="aviso" id="aviso" style="display:none"></div>
<div class="lista" id="lista"></div>
<div id="hilo"></div>

<script>
const CLAVE = new URLSearchParams(location.search).get('k');
let abierta = null;   // {negocio, usuario}
let timer = null;

const hora = ts => {
  const d = new Date(ts), h = new Date();
  const mismoDia = d.toDateString() === h.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
    : d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'});
};

const telefono = u => {
  // 5213111083374 -> +52 311 108 3374
  const s = String(u);
  if (s.length >= 12 && s.startsWith('52')) {
    const n = s.slice(s.length - 10);
    return '+52 ' + n.slice(0,3) + ' ' + n.slice(3,6) + ' ' + n.slice(6);
  }
  return '+' + s;
};

const pedir = async (ruta, params={}) => {
  const q = new URLSearchParams({ k: CLAVE, ...params });
  const r = await fetch(ruta + '?' + q);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
};

async function cargarLista() {
  try {
    const { conversaciones, guardado } = await pedir('/panel/api/conversaciones');

    const aviso = document.getElementById('aviso');
    if (!guardado) {
      aviso.style.display = 'block';
      aviso.textContent = '⚠️ Sin base de datos conectada: el historial se borra cuando el servidor se duerme.';
    } else { aviso.style.display = 'none'; }

    const lista = document.getElementById('lista');
    if (!conversaciones.length) {
      lista.innerHTML = '<div class="vacio">Todavía no hay conversaciones.<br><br>' +
        'Cuando un cliente escriba por WhatsApp, aparecerá aquí.</div>';
      return;
    }
    lista.innerHTML = conversaciones.map(c => \`
      <div class="chat" onclick="verHilo('\${c.businessId}','\${c.usuario}')">
        <div class="avatar">👤</div>
        <div class="info">
          <div class="fila">
            <span class="nombre">\${telefono(c.usuario)}</span>
            <span class="hora">\${hora(c.visto)}</span>
          </div>
          <div class="adelanto"><span class="etiqueta">\${c.businessId}</span>\${escapar(c.adelanto)}</div>
        </div>
      </div>\`).join('');
  } catch (e) {
    document.getElementById('lista').innerHTML =
      '<div class="vacio">No se pudo cargar. Revisa la clave de acceso.</div>';
  }
}

async function verHilo(negocio, usuario) {
  abierta = { negocio, usuario };
  document.getElementById('lista').style.display = 'none';
  document.getElementById('hilo').style.display = 'block';
  document.getElementById('volver').style.display = 'block';
  document.getElementById('aviso').style.display = 'none';
  document.getElementById('titulo').textContent = telefono(usuario);
  await cargarHilo();
}

async function cargarHilo() {
  if (!abierta) return;
  const { mensajes } = await pedir('/panel/api/mensajes',
    { negocio: abierta.negocio, usuario: abierta.usuario });
  document.getElementById('hilo').innerHTML = mensajes.map(m => \`
    <div class="msg \${m.quien === 'bot' ? 'bot' : 'cliente'}">\${escapar(m.texto)}
      <div class="meta">\${hora(m.ts)}\${m.quien === 'bot' ? ' · asistente' : ''}</div>
    </div>\`).join('');
  window.scrollTo(0, document.body.scrollHeight);
}

function verLista() {
  abierta = null;
  document.getElementById('lista').style.display = 'block';
  document.getElementById('hilo').style.display = 'none';
  document.getElementById('volver').style.display = 'none';
  document.getElementById('titulo').textContent = 'Conversaciones';
  cargarLista();
  window.scrollTo(0, 0);
}

const escapar = t => String(t == null ? '' : t)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Refresco automático cada 5 segundos
function latir() { abierta ? cargarHilo().catch(()=>{}) : cargarLista(); }
latir();
timer = setInterval(latir, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) latir(); });
</script>
</body></html>`;

module.exports = router;
