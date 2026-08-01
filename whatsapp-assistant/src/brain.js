// ═══════════════════════════════════════════════════════════════
//  CEREBRO — genera la respuesta con Claude (Anthropic)
//  Construye las instrucciones del asistente a partir del perfil
//  del negocio y le pide a Claude una respuesta para WhatsApp.
// ═══════════════════════════════════════════════════════════════
const Anthropic = require("@anthropic-ai/sdk");
const { ANTHROPIC_API_KEY, MODEL } = require("./config");
const memoria = require("./memory");

const client = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

// Arma las instrucciones (system prompt) para un negocio concreto.
function construirInstrucciones(negocio) {
  const nombre = negocio.nombrePublico
    ? `El negocio se llama "${negocio.nombrePublico}".`
    : "IMPORTANTE: el nombre del negocio AÚN NO está decidido, así que " +
      "NUNCA inventes ni menciones un nombre de marca. Refiérete a él de " +
      'forma neutral (ej: "nosotros", "el negocio").';

  return `
Eres el asistente de WhatsApp de un negocio real. Tu trabajo es atender a
clientes por WhatsApp de forma útil, breve y cálida.

${nombre}

TONO Y ESTILO:
${negocio.tono}
- Escribe como en WhatsApp: mensajes cortos, claros, sin párrafos largos.
- Responde SIEMPRE en español.
- No uses formato markdown (nada de **negritas** ni listas con guiones raros);
  si necesitas enumerar, usa emojis o números simples.

INFORMACIÓN DEL NEGOCIO (esta es tu única fuente de verdad):
${negocio.info}

REGLAS IMPORTANTES:
- Usa SOLO la información de arriba. Si no sabes un dato (un precio, una
  medida, un horario que no está), NO lo inventes: dilo con naturalidad y
  ofrece que una persona del equipo lo confirme.
- ${negocio.contactoHumano}
- Si el cliente escribe groserías o algo fuera de lugar, mantente amable y
  profesional.
- Nunca digas que eres una inteligencia artificial a menos que te lo
  pregunten directamente; simplemente atiende como parte del equipo.
`.trim();
}

// Respuesta de respaldo cuando no hay API key configurada (modo prueba).
function respuestaDeRespaldo(negocio, textoUsuario) {
  return (
    negocio.saludo +
    "\n\n(⚙️ Modo prueba: falta configurar ANTHROPIC_API_KEY para " +
    "respuestas con IA. Recibí tu mensaje: \"" +
    textoUsuario +
    "\")"
  );
}

// Genera la respuesta para un mensaje entrante.
async function generarRespuesta(negocio, usuario, textoUsuario) {
  // Guardamos el mensaje del cliente en la memoria
  const eraNuevo = memoria.esNuevo(negocio.id, usuario);
  memoria.agregar(negocio.id, usuario, "user", textoUsuario);

  // Sin API key -> modo prueba (para probar la plomería sin gastar)
  if (!client) {
    const r = respuestaDeRespaldo(negocio, textoUsuario);
    memoria.agregar(negocio.id, usuario, "assistant", r);
    return r;
  }

  const instrucciones = construirInstrucciones(negocio);
  const historial = memoria.obtener(negocio.id, usuario);

  // Si es su primer mensaje, le damos una pista para que salude bien.
  const system = eraNuevo
    ? instrucciones +
      `\n\nEs el PRIMER mensaje de este cliente. Salúdalo de forma parecida ` +
      `a: "${negocio.saludo}" (adáptalo a lo que preguntó).`
    : instrucciones;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: historial,
    });

    const texto = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const respuesta = texto || negocio.saludo;
    memoria.agregar(negocio.id, usuario, "assistant", respuesta);
    return respuesta;
  } catch (err) {
    console.error("[brain] Error llamando a Claude:", err.message);
    // No dejamos al cliente sin respuesta
    return (
      "¡Gracias por tu mensaje! 🙌 En un momento te atendemos. " +
      "(Tuvimos un detalle técnico procesando tu mensaje.)"
    );
  }
}

module.exports = { generarRespuesta, construirInstrucciones };
