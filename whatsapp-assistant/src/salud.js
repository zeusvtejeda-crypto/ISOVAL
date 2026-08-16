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

// Averigua qué números de WhatsApp puede ver realmente un token.
// Truco: debug_token devuelve los "granular_scopes", y ahí vienen los
// IDs de las cuentas de WhatsApp (WABA) a las que ese token tiene
// alcance. Con cada WABA pedimos sus números. Así, cuando el id
// configurado está mal, podemos decir cuál es el bueno en vez de
// dejarte adivinando.
async function numerosVisibles(token) {
  const g = (ruta) =>
    fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ruta}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

  try {
    const dbg = await g(`debug_token?input_token=${encodeURIComponent(token)}`);

    // Importante distinguir "el token no tiene ninguna cuenta asignada"
    // de "no pude preguntar". Si devolviera lista vacía en ambos casos,
    // mandaríamos a cambiar permisos que quizá ya están bien.
    if (dbg?.error) {
      return { numeros: [], pudoConsultar: false, motivo: dbg.error.message };
    }
    if (!dbg?.data) {
      return { numeros: [], pudoConsultar: false, motivo: "debug_token no devolvió datos." };
    }

    // Huella del token: sirve para saber si el token que está corriendo
    // es el nuevo o quedó el viejo (el caso típico es actualizar la
    // variable y que no se haya redesplegado, o al revés).
    const d = dbg.data;
    const fecha = (s) => (s ? new Date(s * 1000).toISOString() : "nunca");
    const huella = {
      emitido: fecha(d.issued_at),
      caduca: d.expires_at ? fecha(d.expires_at) : "nunca",
      valido: d.is_valid,
      tipo: d.type,
      app: d.application,
      permisos: (d.scopes || []).join(", "),
      // Lista vacía de target_ids = "aplica a todos los objetos" (así lo
      // muestra el depurador de Meta). No confundir con "a ninguno".
      alcances: (d.granular_scopes || []).map(
        (s) => `${s.scope}: ${(s.target_ids || []).join(",") || "aplica a todos"}`
      ),
    };

    // OJO: en granular_scopes, target_ids VACÍO significa "aplica a todos
    // los objetos", NO "a ninguno". Por eso no sirve para enumerar: hay
    // que recorrer los negocios del usuario y pedirles sus cuentas.
    const wabas = new Set();
    for (const s of d.granular_scopes || []) {
      if (/whatsapp_business/.test(s.scope || "")) {
        for (const id of s.target_ids || []) wabas.add(id);
      }
    }

    // Camino principal: negocios → cuentas de WhatsApp (propias y de cliente).
    const negociosMeta = await g("me/businesses?fields=id,name&limit=50");
    const portafolios = negociosMeta?.data || [];
    for (const b of portafolios) {
      for (const rel of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
        const res = await g(`${b.id}/${rel}?fields=id,name&limit=50`);
        for (const w of res?.data || []) wabas.add(w.id);
      }
    }

    if (!wabas.size) {
      return {
        numeros: [], pudoConsultar: true, huella,
        portafolios: portafolios.map((b) => `${b.name} (${b.id})`),
        motivo: portafolios.length
          ? "El usuario pertenece a portafolios, pero ninguno tiene cuentas de WhatsApp visibles para este token."
          : "El token no ve ningún portafolio de negocio.",
      };
    }

    const numeros = [];
    for (const waba of wabas) {
      const res = await g(`${waba}/phone_numbers?fields=id,display_phone_number,verified_name`);
      for (const n of res?.data || []) {
        numeros.push({ id: n.id, display_phone_number: n.display_phone_number, waba });
      }
    }
    return { numeros, pudoConsultar: true, cuentas: [...wabas], huella,
      portafolios: portafolios.map((b) => `${b.name} (${b.id})`) };
  } catch (e) {
    return { numeros: [], pudoConsultar: false, motivo: e.message };
  }
}

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

    // El token sirve, pero Meta no reconoce ese número. Casi siempre es
    // que el phone_number_id está mal copiado, o que al Usuario del
    // Sistema no le asignaron la cuenta de WhatsApp como activo.
    // En vez de que adivines cuál de las dos, le preguntamos al token
    // qué números SÍ puede ver y te los listamos.
    const v = await numerosVisibles(token);

    let comoArreglar;
    if (v.numeros.length) {
      comoArreglar =
        `El token sí ve estos números: ${v.numeros
          .map((n) => `${n.display_phone_number} → id ${n.id}`)
          .join(" | ")}. Copia el id correcto en la variable del negocio "${negocio.id}" en Vercel y redespliega.`;
    } else if (v.pudoConsultar) {
      comoArreglar =
        `No pude enumerar las cuentas por esta vía (${v.motivo || "sin datos"}), y en tokens de ` +
        "Usuario del Sistema eso puede ser normal, así que NO concluyas nada de aquí. " +
        "El dato bueno está en Meta › tu app › WhatsApp › Configuración de la API: ahí " +
        "aparecen el 'Identificador del número de teléfono' y el 'Identificador de la cuenta " +
        `de WhatsApp Business'. Compara ese número con el que está configurado (${negocio.phoneNumberId}); ` +
        "si no coinciden, ese es el problema.";
    } else {
      comoArreglar =
        `No pude listar las cuentas del token (${v.motivo}), así que no sé si falta ` +
        "asignar la cuenta de WhatsApp o si el phone_number_id está mal. " +
        "Revísalo en Meta › tu app › WhatsApp › Configuración de la API, donde " +
        "aparece el identificador del número de teléfono.";
    }

    return {
      ...base,
      conectado: true,
      estado: "NUMERO_NO_VISIBLE",
      detalle: err.message || `Meta respondió ${resp.status}.`,
      numerosDisponibles: v.numeros,
      consultaCuentas: v.pudoConsultar ? "ok" : `falló: ${v.motivo}`,
      tokenEnUso: v.huella,
      portafolios: v.portafolios,
      comoArreglar,
    };
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
    if (n.consultaCuentas && n.consultaCuentas !== "ok")
      lineas.push(`      (consulta de cuentas del token ${n.consultaCuentas})`);
    if (n.tokenEnUso) {
      lineas.push(`      Token en uso: emitido ${n.tokenEnUso.emitido}, caduca ${n.tokenEnUso.caduca}, app "${n.tokenEnUso.app}"`);
      for (const a of n.tokenEnUso.alcances || []) lineas.push(`        alcance ${a}`);
    }
    if (n.portafolios?.length) {
      lineas.push("      Portafolios que ve el token:");
      for (const p of n.portafolios) lineas.push(`        - ${p}`);
    }
    if (n.numerosDisponibles?.length) {
      lineas.push("      Números que el token SÍ ve:");
      for (const d of n.numerosDisponibles)
        lineas.push(`        - ${d.display_phone_number}  →  phone_number_id: ${d.id}`);
    }
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
