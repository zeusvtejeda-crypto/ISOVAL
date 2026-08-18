// ═══════════════════════════════════════════════════════════════
//  MENSAJES QUE NO SON TEXTO (audios, fotos, ubicaciones…)
//
//  Por qué existe: por WhatsApp la gente manda audios y fotos todo
//  el tiempo. Antes el servidor los descartaba en silencio, así que
//  ese cliente veía la palomita azul y ni una respuesta — justo lo
//  que el asistente existe para evitar. Peor aún: el que manda un
//  audio suele ser el que más ganas tiene de comprar.
//
//  Aquí decidimos qué contestarle a cada tipo de mensaje. El texto
//  es a propósito neutral (sirve para cualquier negocio) y honesto:
//  no decimos que "ya vimos" la foto, porque el asistente todavía
//  no puede verla; decimos que la revisa una persona.
// ═══════════════════════════════════════════════════════════════

// Lo que contestamos según el tipo de mensaje que llegó.
const RESPUESTAS = {
  audio:
    "Recibí tu audio 🎧, pero por aquí todavía no puedo escucharlo. " +
    "Si me lo escribes te contesto de inmediato; si no, en un momento " +
    "lo escucha una persona del equipo.",

  image:
    "Recibí tu foto 📷. Por aquí todavía no puedo verla, así que en un " +
    "momento la revisa una persona del equipo. Mientras tanto, si me " +
    "cuentas qué necesitas, te voy ayudando.",

  video:
    "Recibí tu video 🎬. Por aquí todavía no puedo verlo, así que en un " +
    "momento lo revisa una persona del equipo. Mientras tanto, si me " +
    "cuentas qué necesitas, te voy ayudando.",

  document:
    "Recibí tu archivo 📎, pero por aquí no puedo abrirlo. En un momento " +
    "lo revisa una persona del equipo. Si me cuentas de qué se trata, " +
    "te voy adelantando.",

  sticker: "😊 ¿En qué te puedo ayudar?",

  location:
    "¡Gracias por mandarme tu ubicación! 📍 En un momento una persona del " +
    "equipo te confirma si llegamos hasta ahí y cómo sería la entrega.",

  contacts:
    "Recibí el contacto que me compartes 🙏. En un momento lo revisa una " +
    "persona del equipo.",
};

// Respuesta para cualquier otro tipo raro (encuestas, mensajes de
// "ver una vez", tipos nuevos que Meta agregue después). Mejor decir
// algo genérico que quedarse callado.
const RESPUESTA_GENERICA =
  "Recibí tu mensaje, pero por aquí solo puedo leer texto. ¿Me escribes " +
  "lo que necesitas? Y si prefieres, en un momento te atiende una persona " +
  "del equipo.";

// Tipos que NO hay que contestar. Responderles sería puro ruido:
//  - reaction: el cliente le puso 👍 a un mensaje nuestro. Contestar
//    un pulgar arriba con un párrafo es molesto.
//  - system / request_welcome: avisos de la propia plataforma
//    (cambios de número, apertura de chat), no los escribe el cliente.
//  - order: pedidos del catálogo de Meta; ese flujo no está montado
//    y contestar de más confundiría.
const IGNORAR = new Set(["reaction", "system", "request_welcome", "order"]);

// Saca el texto de un mensaje, cuando lo trae.
//
// Además del texto normal, aquí caen las respuestas a botones y a
// listas: Meta las manda como tipo "interactive" o "button", pero
// para nosotros son texto del cliente y merecen respuesta del
// cerebro como cualquier otra. Antes se descartaban por no llamarse
// "text", aunque el cliente sí había escrito (o elegido) algo.
function textoDelMensaje(msg) {
  if (!msg) return null;

  if (msg.type === "text") return msg.text?.body?.trim() || null;

  if (msg.type === "interactive") {
    const i = msg.interactive || {};
    const elegido = i.button_reply || i.list_reply || {};
    return (elegido.title || "").trim() || null;
  }

  if (msg.type === "button") return msg.button?.text?.trim() || null;

  // Las fotos y videos pueden venir con pie de foto; si el cliente
  // escribió ahí su pregunta, es texto de verdad y hay que atenderlo.
  const pie = msg[msg.type]?.caption;
  if (pie && pie.trim()) return pie.trim();

  return null;
}

// ¿Qué le contestamos a un mensaje que no trae texto?
// Devuelve null cuando lo correcto es no contestar nada.
//
// esPrimerMensaje sirve para saludar: si lo primero que manda un
// cliente nuevo es un audio, quedaría muy frío soltarle "no puedo
// escucharlo" sin un hola de por medio.
function respuestaSinTexto(negocio, msg, esPrimerMensaje) {
  const tipo = msg?.type || "desconocido";
  if (IGNORAR.has(tipo)) return null;

  const cuerpo = RESPUESTAS[tipo] || RESPUESTA_GENERICA;
  if (!esPrimerMensaje) return cuerpo;

  const nombre = negocio.nombrePublico
    ? ` Gracias por escribir a ${negocio.nombrePublico}.`
    : " Gracias por escribirnos.";
  return `¡Hola! 👋${nombre}\n\n${cuerpo}`;
}

module.exports = { textoDelMensaje, respuestaSinTexto, IGNORAR };
