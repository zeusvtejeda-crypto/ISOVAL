// ═══════════════════════════════════════════════════════════════
//  SALUD — revisa que el asistente REALMENTE pueda contestar.
//
//  Por qué existe: el 14-ago-2026 el token de Meta venció y el
//  asistente dejó de contestar durante más de un día sin que nadie
//  se enterara. El error SÍ se registraba en los logs de Vercel,
//  pero nadie los mira. Y como el webhook siempre le responde 200 a
//  Meta (para que no reintente), por fuera todo se veía sano.
//
//  Esta ruta convierte esa falla invisible en algo que se ve de un
//  vistazo: abre /salud y te dice si cada negocio puede enviar.
//  Devuelve 503 cuando algo está roto, así que le puedes apuntar
//  cualquier monitor gratuito (UptimeRobot, etc.) y que te avise
//  solo, en lugar de enterarte porque un cliente no recibió respuesta.
// ═══════════════════════════════════════════════════════════════
const { negocios } = require("../businesses");
const {
  GRAPH_VERSION,
  WHATSAPP_TOKEN,
  AI_PROVIDER,
  GEMINI_API_KEY,
  ANTHROPIC_API_KEY,
} = require("./config");

// Le pregunta a Meta por el número del negocio. Es la forma más
// barata de saber si el token sirve: si venció, responde 401/190.
async function revisarNegocio(negocio) {
  const base = { id: negocio.id, nombre: negocio.nombre || negocio.id };
  const token = negocio.whatsappToken || WHATSAPP_TOKEN;

  // Sin número de Meta, el negocio está preparado en el código pero
  // todavía no conectado (es el caso de fithouse e isoval). Eso NO es
  // una falla: si lo contáramos como rota, /salud estaría en rojo
  // siempre y la alerta perdería todo su valor por gritar en falso.
  if (!negocio.phoneNumberId) {
    return { ...base, estado: "NO_CONECTADO", conectado: false,
      detalle: "Aún no tiene número de WhatsApp asignado en Meta." };
  }
  if (!token) {
    return { ...base, estado: "SIN_TOKEN", conectado: true,
      detalle: "Tiene número pero le falta el token de acceso." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${negocio.phoneNumberId}?fields=display_phone_number,verified_name`;

  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const datos = await resp.json().catch(() => ({}));

    if (resp.ok) {
      return { ...base, estado: "OK", conectado: true,
        numero: datos.display_phone_number, verificado: datos.verified_name };
    }

    const err = datos.error || {};
    // 190 = problema de token. El subcódigo 463 es específicamente "venció".
    if (resp.status === 401 || err.code === 190) {
      const vencido = err.error_subcode === 463 || /expired/i.test(err.message || "");
      return {
        ...base,
        conectado: true,
        estado: vencido ? "TOKEN_VENCIDO" : "TOKEN_INVALIDO",
        detalle: err.message || "Meta rechazó el token.",
        comoArreglar:
          "Genera un token PERMANENTE de Usuario del Sistema en Meta Business " +
          "(los de prueba del panel de desarrollador duran 24 h) y actualiza " +
          `la variable de entorno del negocio "${negocio.id}" en Vercel.`,
      };
    }

    return { ...base, conectado: true, estado: "ERROR",
      detalle: err.message || `Meta respondió ${resp.status}.` };
  } catch (e) {
    return { ...base, conectado: true, estado: "SIN_CONEXION", detalle: e.message };
  }
}

function revisarCerebro() {
  const usaGemini = AI_PROVIDER === "gemini";
  const clave = usaGemini ? GEMINI_API_KEY : ANTHROPIC_API_KEY;
  return {
    proveedor: AI_PROVIDER,
    estado: clave ? "OK" : "SIN_API_KEY",
    detalle: clave ? undefined : `Falta la API key de ${usaGemini ? "Gemini" : "Anthropic"}.`,
  };
}

async function reporte() {
  const activos = negocios.filter((n) => n.activo);
  const revisados = await Promise.all(activos.map(revisarNegocio));
  const cerebro = revisarCerebro();

  // Solo los negocios YA conectados cuentan para decidir si hay alarma.
  const conectados = revisados.filter((n) => n.conectado);
  const puedeContestar = conectados.filter((n) => n.estado === "OK");
  const conProblema = conectados.filter((n) => n.estado !== "OK");
  const pendientes = revisados.filter((n) => !n.conectado);

  // Si no hay NINGÚN negocio conectado tampoco está sano: significa que
  // se borró la configuración y nadie podría contestar.
  const sano =
    cerebro.estado === "OK" && conProblema.length === 0 && conectados.length > 0;

  return {
    sano,
    resumen: sano
      ? `Todo bien: ${puedeContestar.length} negocio(s) conectado(s) pueden contestar.` +
        (pendientes.length ? ` (${pendientes.length} aún sin conectar, es normal.)` : "")
      : conectados.length === 0
        ? "Atención: no hay ningún negocio conectado; nadie puede contestar."
        : `Atención: ${conProblema.length} de ${conectados.length} negocio(s) conectado(s) NO pueden contestar.`,
    revisado: new Date().toISOString(),
    cerebro,
    negocios: revisados,
  };
}

// Versión en texto, para leerla de un vistazo en el navegador.
function aTexto(r) {
  const lineas = [
    r.sano ? "ASISTENTE SANO ✅" : "ASISTENTE CON PROBLEMAS ⚠️",
    r.resumen,
    "",
    `Cerebro (${r.cerebro.proveedor}): ${r.cerebro.estado}${r.cerebro.detalle ? " — " + r.cerebro.detalle : ""}`,
    "",
    "Negocios conectados:",
  ];
  const conectados = r.negocios.filter((n) => n.conectado);
  const pendientes = r.negocios.filter((n) => !n.conectado);

  if (!conectados.length) lineas.push("  (ninguno)");
  for (const n of conectados) {
    lineas.push(`  • ${n.nombre} [${n.id}]: ${n.estado}${n.numero ? " (" + n.numero + ")" : ""}`);
    if (n.detalle) lineas.push(`      ${n.detalle}`);
    if (n.comoArreglar) lineas.push(`      Cómo arreglar: ${n.comoArreglar}`);
  }
  if (pendientes.length) {
    lineas.push("", "Preparados pero aún sin conectar (no es falla):");
    for (const n of pendientes) lineas.push(`  • ${n.nombre} [${n.id}]`);
  }
  lineas.push("", `Revisado: ${r.revisado}`);
  return lineas.join("\n");
}

module.exports = { reporte, aTexto };
