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
const { estadoAlmacen } = require("./almacen");

// Pregunta qué CUENTAS de WhatsApp tiene asignadas el usuario del token.
//
// Este es el dato que de verdad decide si el asistente puede contestar, y
// es distinto de los permisos. Los permisos dicen QUÉ puede hacer el token
// (mandar mensajes); los activos dicen SOBRE QUÉ. Un token puede tener
// todos los permisos en verde y aun así no poder mandar nada, porque no
// tiene ninguna cuenta asignada. Eso es exactamente lo que pasaba aquí y
// por qué el depurador de Meta se veía perfecto.
//
// La comprobamos con la arista "assigned_whatsapp_business_accounts", que
// devuelve lista vacía de verdad cuando no hay ninguna (lo verifiqué
// contra una arista inventada: esa da error, no lista vacía). Ojo con
// esto, porque en la Graph API "vacío" no siempre significa "ninguno":
// en granular_scopes, por ejemplo, vacío significa "aplica a todos".
async function cuentasAsignadas(token) {
  const g = (ruta) =>
    fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ruta}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

  try {
    const res = await g("me/assigned_whatsapp_business_accounts?fields=id,name&limit=50");
    if (res?.error) return { pudoConsultar: false, motivo: res.error.message };

    const cuentas = res.data || [];
    const numeros = [];
    for (const c of cuentas) {
      const n = await g(`${c.id}/phone_numbers?fields=id,display_phone_number,verified_name`);
      for (const t of n?.data || []) {
        numeros.push({ id: t.id, display_phone_number: t.display_phone_number, waba: c.id });
      }
    }
    return { pudoConsultar: true, cuentas, numeros };
  } catch (e) {
    return { pudoConsultar: false, motivo: e.message };
  }
}

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

    // Camino que sí funciona con tokens de Usuario del Sistema: preguntar
    // qué portafolio es DUEÑO de la app. /me/businesses viene vacío para
    // estos tokens, así que por sí solo no dice nada.
    const portafolios = [];
    if (d.app_id) {
      const app = await g(`${d.app_id}?fields=owner_business{id,name}`);
      if (app?.owner_business) portafolios.push(app.owner_business);
    }
    const mios = await g("me/businesses?fields=id,name&limit=50");
    for (const b of mios?.data || []) {
      if (!portafolios.some((p) => p.id === b.id)) portafolios.push(b);
    }

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
  const base = {
    id: negocio.id,
    nombre: negocio.nombre || negocio.nombreInterno || negocio.id,
    // A quién le llega el aviso cuando hay que pasar la charla a una
    // persona. Sin esto, la escalación se queda a medias.
    avisaA: (negocio.avisarA || "").replace(/\D/g, ""),
  };
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

  try {
    // Lo que de verdad hay que comprobar es que el TOKEN sirva, porque es
    // lo único que el envío necesita: al responder, el phone_number_id se
    // toma del mensaje entrante de Meta (app.js), no de esta variable.
    // Antes se comprobaba el número configurado y eso daba falsas alarmas:
    // marcaba todo como roto por un dato que el envío ni siquiera usa.
    const meResp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const me = await meResp.json().catch(() => ({}));

    if (!meResp.ok) {
      const e = me.error || {};
      const vencido = e.error_subcode === 463 || /expired/i.test(e.message || "");
      return {
        ...base,
        conectado: true,
        estado: vencido ? "TOKEN_VENCIDO" : "TOKEN_INVALIDO",
        detalle: e.message || "Meta rechazó el token.",
        comoArreglar:
          "Genera un token PERMANENTE de Usuario del Sistema en Meta Business " +
          "(los de prueba del panel de desarrollador duran 24 h), actualiza " +
          `la variable del negocio "${negocio.id}" en Vercel y redespliega.`,
      };
    }

    // El token está vivo. Pero eso NO basta para contestar: hace falta que
    // tenga asignada la cuenta de WhatsApp. Sin eso, todo envío falla con
    // "missing permissions" aunque los permisos se vean perfectos.
    const asignadas = await cuentasAsignadas(token);
    if (asignadas.pudoConsultar && asignadas.cuentas.length === 0) {
      return {
        ...base,
        conectado: true,
        estado: "SIN_CUENTA_ASIGNADA",
        detalle:
          `El token es válido y permanente, pero el usuario del sistema no ` +
          "tiene NINGUNA cuenta de WhatsApp asignada, así que no puede mandar " +
          "mensajes desde ningún número. Los permisos (que se ven bien en el " +
          "depurador de Meta) dicen qué puede hacer; los activos dicen sobre " +
          "qué, y esos están vacíos.",
        comoArreglar:
          "OJO con el orden, porque aquí es donde se pierde el tiempo: el " +
          "usuario del sistema tiene que estar DENTRO del mismo portafolio " +
          "que es dueño de la cuenta de WhatsApp. Si está en otro portafolio, " +
          "el botón 'Agregar activos' ni siquiera te muestra la cuenta, y " +
          "parece que Meta está fallando cuando en realidad estás parado en " +
          "el negocio equivocado. Así que: (1) en Meta Business Settings " +
          "abre el portafolio dueño de la cuenta de WhatsApp; (2) Usuarios " +
          "del sistema › Agregar, si ahí no hay ninguno; (3) selecciónalo › " +
          "'Agregar activos' › pestaña 'Cuentas de WhatsApp' › marca la " +
          "cuenta y dale CONTROL TOTAL; (4) repite en la pestaña 'Apps' con " +
          "la app del asistente; (5) genera un token nuevo, ponlo en la " +
          `variable del negocio "${negocio.id}" en Vercel y redespliega.`,
      };
    }

    // Si sí tiene cuentas, podemos decirte el id bueno en vez de que adivines.
    if (asignadas.pudoConsultar && asignadas.numeros.length) {
      const coincide = asignadas.numeros.find((n) => n.id === String(negocio.phoneNumberId));
      if (coincide) {
        return { ...base, estado: "OK", conectado: true, tokenDe: me.name,
          numero: coincide.display_phone_number };
      }
    }

    // Token válido ⇒ el negocio PUEDE contestar. Lo que sigue es un extra:
    // comprobar el id configurado. Que ese id esté mal NO impide responder,
    // porque al contestar se usa el phone_number_id que viene en el mensaje
    // entrante de Meta (app.js línea 76), no esta variable. Aquí solo sirve
    // para enrutar, y con DEFAULT_BUSINESS el ruteo funciona igual. Por eso
    // es un AVISO y no una falla: marcarlo en rojo sería gritar en falso.
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${negocio.phoneNumberId}?fields=display_phone_number,verified_name`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const datos = await resp.json().catch(() => ({}));

    if (resp.ok) {
      return { ...base, estado: "OK", conectado: true, tokenDe: me.name,
        numero: datos.display_phone_number, verificado: datos.verified_name };
    }

    // El token sirve, pero Meta no reconoce ese id. Casi siempre es que el
    // phone_number_id está mal copiado, o que al Usuario del Sistema no le
    // asignaron la cuenta de WhatsApp como activo. En vez de que adivines
    // cuál de las dos, le preguntamos al token qué números SÍ puede ver.
    const err = datos.error || {};
    const v = await numerosVisibles(token);

    let queHacer;
    if (v.numeros.length) {
      queHacer =
        `El token sí ve estos números: ${v.numeros
          .map((n) => `${n.display_phone_number} → id ${n.id}`)
          .join(" | ")}. Copia el id correcto en la variable del negocio "${negocio.id}" en Vercel y redespliega.`;
    } else {
      queHacer =
        "El dato bueno está en Meta › tu app › WhatsApp › Configuración de la API: " +
        "ahí aparece el 'Identificador del número de teléfono'. Compáralo con el " +
        `configurado (${negocio.phoneNumberId}) y corrígelo si no coinciden.`;
    }

    // Estado intermedio a propósito. Decir "OK" aquí sería repetir el
    // error que causó el apagón: un semáforo en verde que no prueba nada.
    // Decir "ROTO" también sería mentir, porque el token sí sirve y el
    // envío usa otro id. Así que lo dejamos en NO CONFIRMADO: no dispara
    // la alarma (no es una falla demostrada) pero tampoco te deja creer
    // que está probado. Se confirma solo cuando llegue un mensaje real.
    return {
      ...base,
      estado: "SIN_CONFIRMAR",
      conectado: true,
      tokenDe: me.name,
      detalle:
        "El token está vivo y Meta lo acepta, así que la causa del apagón " +
        "anterior (token vencido) ya no está. Pero no pude comprobar el " +
        "envío de punta a punta, porque el id configurado " +
        `${negocio.phoneNumberId} no lo reconoce Meta: ` +
        `${err.message || `respondió ${resp.status}`}.`,
      comoArreglar:
        "Ese id NO se usa al contestar (el envío toma el phone_number_id del " +
        "mensaje entrante), así que probablemente ya funciona. La prueba de " +
        "verdad es mandarle un WhatsApp al número del negocio desde tu " +
        "celular. Para dejarlo confirmado aquí también: " + queHacer,
      numerosDisponibles: v.numeros,
      tokenEnUso: v.huella,
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
  const almacen = await estadoAlmacen();

  // Negocios ya conectados a los que NO se les puede avisar cuando un
  // cliente pide hablar con una persona. No es una falla del asistente
  // (contesta igual), pero sí un agujero: escala a un humano que nunca
  // se entera. Va como aviso, no como alarma.
  const sinAviso = revisados
    .filter((n) => n.conectado && !n.avisaA)
    .map((n) => n.id);

  // Solo los negocios YA conectados cuentan para decidir si hay alarma.
  const conectados = revisados.filter((n) => n.conectado);
  const puedeContestar = conectados.filter((n) => n.estado === "OK");
  const sinConfirmar = conectados.filter((n) => n.estado === "SIN_CONFIRMAR");
  const rotos = conectados.filter((n) => !["OK", "SIN_CONFIRMAR"].includes(n.estado));
  const pendientes = revisados.filter((n) => !n.conectado);

  // Tres estados, no dos. La versión anterior solo tenía sano/roto y eso
  // obligaba a mentir en los casos de en medio: o gritaba en falso, o
  // pintaba de verde algo sin comprobar. Y un verde que no prueba nada es
  // justo lo que dejó el asistente caído más de un día sin que se notara.
  //   ROTO           → falla demostrada, alguien tiene que actuar (503).
  //   SIN_CONFIRMAR  → no hay falla, pero tampoco prueba. No es alarma.
  //   SANO           → comprobado de punta a punta.
  const hayFalla =
    cerebro.estado !== "OK" || rotos.length > 0 || conectados.length === 0;
  const sano = !hayFalla;

  const estado = hayFalla ? "ROTO" : sinConfirmar.length ? "SIN_CONFIRMAR" : "SANO";

  const resumen = hayFalla
    ? conectados.length === 0
      ? "Atención: no hay ningún negocio conectado; nadie puede contestar."
      : `Atención: ${rotos.length} de ${conectados.length} negocio(s) conectado(s) NO pueden contestar.`
    : estado === "SIN_CONFIRMAR"
      ? `Sin fallas, pero sin confirmar: ${sinConfirmar.length} negocio(s) tienen el token bueno, ` +
        "aunque todavía no se ha comprobado un envío real. Mándale un WhatsApp al " +
        "número del negocio desde tu celular y ahí se confirma."
      : `Todo bien: ${puedeContestar.length} negocio(s) conectado(s) pueden contestar.` +
        (pendientes.length ? ` (${pendientes.length} aún sin conectar, es normal.)` : "");

  return {
    sano,
    estado,
    resumen,
    revisado: new Date().toISOString(),
    cerebro,
    almacen,
    sinAviso,
    negocios: revisados,
  };
}

// Versión en texto, para leerla de un vistazo en el navegador.
function aTexto(r) {
  const titulo = {
    SANO: "ASISTENTE SANO ✅",
    SIN_CONFIRMAR: "SIN FALLAS, PERO SIN CONFIRMAR 🟡",
    ROTO: "ASISTENTE CON PROBLEMAS ⚠️",
  };
  const lineas = [
    titulo[r.estado] || (r.sano ? "ASISTENTE SANO ✅" : "ASISTENTE CON PROBLEMAS ⚠️"),
    r.resumen,
    "",
    `Cerebro (${r.cerebro.proveedor}): ${r.cerebro.estado}${r.cerebro.detalle ? " — " + r.cerebro.detalle : ""}`,
    `Memoria (${r.almacen.tipo}): ${r.almacen.persistente ? "PERSISTENTE" : "SE OLVIDA AL REINICIAR"}` +
      (r.almacen.detalle ? " — " + r.almacen.detalle : ""),
  ];
  if (r.sinAviso?.length) {
    lineas.push(
      `Aviso a un humano: SIN CONFIGURAR en ${r.sinAviso.join(", ")} — ` +
        "si un cliente pide hablar con una persona, nadie se entera. " +
        "Llena WHATSAPP_ADMIN (o avisarA en el perfil)."
    );
  }
  lineas.push("", "Negocios conectados:");
  const conectados = r.negocios.filter((n) => n.conectado);
  const pendientes = r.negocios.filter((n) => !n.conectado);

  if (!conectados.length) lineas.push("  (ninguno)");
  for (const n of conectados) {
    lineas.push(`  • ${n.nombre} [${n.id}]: ${n.estado}${n.numero ? " (" + n.numero + ")" : ""}`);
    if (n.detalle) lineas.push(`      ${n.detalle}`);
    if (n.tokenEnUso) {
      lineas.push(`      Token en uso: emitido ${n.tokenEnUso.emitido}, caduca ${n.tokenEnUso.caduca}, app "${n.tokenEnUso.app}"`);
      for (const a of n.tokenEnUso.alcances || []) lineas.push(`        alcance ${a}`);
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
