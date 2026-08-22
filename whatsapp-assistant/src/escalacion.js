// ═══════════════════════════════════════════════════════════════
//  ESCALACIÓN — el momento en que el asistente se hace a un lado
//  y llama a una persona real.
//
//  POR QUÉ EXISTE: todos los perfiles de negocio ya traían un campo
//  "escalarA" con las frases que deben pasar la charla a un humano
//  ("hablar con una persona", "queja", "factura"…), pero NINGÚN
//  archivo lo leía. Era letra muerta. El asistente le decía al
//  cliente "en un momento te atiende alguien del equipo" y ese
//  alguien no se enteraba nunca. Para un asistente que trabaja solo,
//  esta es la pieza que más falta hace: no que conteste todo, sino
//  que sepa cuándo NO debe contestar y a quién avisarle.
//
//  Al escalar pasan tres cosas:
//    1) se pausa el bot en esa conversación (para no hablar encima
//       de la persona que va a entrar),
//    2) te llega un WhatsApp con el número del cliente y qué pide,
//    3) el cliente recibe una respuesta de cierre, no un silencio.
// ═══════════════════════════════════════════════════════════════
const { leer, guardar, borrar } = require("./almacen");
const { enviarTexto, enviarPlantilla, esVentanaCerrada } = require("./whatsapp");
const {
  WHATSAPP_ADMIN,
  PAUSA_HORAS,
  PLANTILLA_AVISO,
  PLANTILLA_IDIOMA,
} = require("./config");

// Quita acentos y mayúsculas: así "queja" también atrapa "QUEJA" y
// "hablar con una persona" atrapa "Hablar con una Persona".
const normalizar = (s) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Compara dos teléfonos por sus últimos 10 dígitos. En México el
// mismo número aparece como 3111216033, 523111216033 o 5213111216033
// según de dónde salga; comparar el texto completo fallaría siempre.
function mismoNumero(a, b) {
  const d = (x) => (x || "").replace(/\D/g, "").slice(-10);
  return d(a).length === 10 && d(a) === d(b);
}

// A quién le avisamos de este negocio (su propio número o el general).
function destinatarioAviso(negocio) {
  return (negocio.avisarA || WHATSAPP_ADMIN || "").replace(/\D/g, "");
}

function esAdministrador(negocio, numero) {
  const admin = destinatarioAviso(negocio);
  return !!admin && mismoNumero(admin, numero);
}

// ── Pausa por conversación ───────────────────────────────────────
const clavePausa = (negocioId, cliente) => `pausa:${negocioId}:${cliente}`;

async function pausar(negocioId, cliente, horas = PAUSA_HORAS, quien = "escalación") {
  await guardar(
    clavePausa(negocioId, cliente),
    { desde: new Date().toISOString(), quien },
    Math.max(1, Math.round(horas * 3600))
  );
}

async function estaPausado(negocioId, cliente) {
  return !!(await leer(clavePausa(negocioId, cliente)));
}

async function reanudar(negocioId, cliente) {
  await borrar(clavePausa(negocioId, cliente));
}

// ── ¿Este mensaje hay que pasarlo a una persona? ─────────────────
// Devuelve la frase que lo disparó, o null si el bot puede seguir.
function motivoDeEscalada(negocio, texto) {
  const t = normalizar(texto);
  for (const frase of negocio.escalarA || []) {
    if (t.includes(normalizar(frase))) return frase;
  }
  return null;
}

// ── El aviso que te llega a TU WhatsApp ──────────────────────────
async function avisarAlDueno(negocio, { phoneNumberId, cliente, motivo, mensaje }) {
  const admin = destinatarioAviso(negocio);
  if (!admin) {
    console.warn(
      `[escalación] ${negocio.id}: hay que avisarle a una persona, pero no ` +
        "hay número configurado (avisarA en el perfil o WHATSAPP_ADMIN)."
    );
    return { ok: false, motivo: "sin número de aviso" };
  }

  const aviso =
    `🔔 Un cliente necesita que lo atiendas tú.\n\n` +
    `Negocio: ${negocio.nombreInterno || negocio.id}\n` +
    `Cliente: +${cliente}\n` +
    `Motivo: ${motivo}\n` +
    `Dijo: "${(mensaje || "").slice(0, 300)}"\n\n` +
    `El asistente ya se calló en esa conversación por ${PAUSA_HORAS} h. ` +
    `Para que vuelva a contestar antes, mándame: sigue ${cliente}`;

  const r = await enviarTexto(phoneNumberId, admin, aviso, negocio.whatsappToken);
  if (r.ok) return r;

  // Texto libre rechazado por la ventana de 24 h: reintentamos con
  // plantilla, que es lo único que Meta acepta en ese caso.
  if (esVentanaCerrada(r.motivo) && PLANTILLA_AVISO) {
    console.warn(
      `[escalación] Ventana de 24 h cerrada con ${admin}; reintento con plantilla.`
    );
    const p = await enviarPlantilla(
      phoneNumberId, admin, PLANTILLA_AVISO, PLANTILLA_IDIOMA,
      [negocio.nombreInterno || negocio.id, `+${cliente}`], negocio.whatsappToken
    );
    if (p.ok) return p;
    console.error(`[escalación] La plantilla tampoco salió: ${p.motivo}`);
    return p;
  }

  console.error(
    `[escalación] NO pude avisarte (${r.motivo}). ` +
      (esVentanaCerrada(r.motivo)
        ? "Pasaron más de 24 h desde tu último mensaje al número del negocio " +
          "y no hay PLANTILLA_AVISO configurada (ver README)."
        : "")
  );
  return r;
}

// ── Comandos que TÚ puedes mandarle al número del negocio ────────
// Como el aviso te llega por WhatsApp, lo natural es poder contestarle
// por ahí mismo. Tu número escribiéndole al número del negocio entra
// por el mismo webhook que cualquier cliente, así que lo tratamos
// aparte: son órdenes, no una conversación que haya que contestar
// con IA.
async function atenderComandoAdmin(negocio, texto, phoneNumberId, quienEscribe) {
  const t = normalizar(texto).trim();
  const responder = (msg) =>
    enviarTexto(phoneNumberId, quienEscribe, msg, negocio.whatsappToken);

  const pausaM = t.match(/^(pausa|silencio|calla)\s+(\+?[\d\s-]{10,})$/);
  if (pausaM) {
    const cliente = pausaM[2].replace(/\D/g, "");
    await pausar(negocio.id, cliente, PAUSA_HORAS, "admin");
    return responder(
      `Listo ✅ No le contesto a +${cliente} por ${PAUSA_HORAS} h.\n` +
        `Para reactivarlo antes: sigue ${cliente}`
    );
  }

  const sigueM = t.match(/^(sigue|reanuda|continua|activa)\s+(\+?[\d\s-]{10,})$/);
  if (sigueM) {
    const cliente = sigueM[2].replace(/\D/g, "");
    await reanudar(negocio.id, cliente);
    return responder(`Listo ✅ Vuelvo a atender a +${cliente}.`);
  }

  if (/^(estado|salud|status)$/.test(t)) {
    // Se carga aquí y no arriba para no crear un ciclo de requires
    // (salud.js necesita los negocios, y los negocios este archivo).
    const { reporte, aTexto } = require("./salud");
    const r = await reporte();
    return responder(aTexto(r).slice(0, 3500));
  }

  if (/^(ayuda|comandos|help)$/.test(t)) {
    return responder(
      "Comandos que entiendo de tu número:\n\n" +
        "• pausa 3111234567 — dejo de contestarle a ese cliente\n" +
        "• sigue 3111234567 — vuelvo a atenderlo\n" +
        "• estado — te digo si todo está funcionando\n" +
        "• ayuda — esta lista"
    );
  }

  // No es un comando: no hacemos nada. Devolvemos false para que quien
  // llama sepa que este mensaje sí hay que atenderlo como conversación
  // normal (tu propio número también puede querer probar el asistente).
  return false;
}

module.exports = {
  motivoDeEscalada,
  avisarAlDueno,
  pausar,
  reanudar,
  estaPausado,
  esAdministrador,
  atenderComandoAdmin,
  destinatarioAviso,
  mismoNumero,
};
