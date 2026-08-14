// ═══════════════════════════════════════════════════════════════
//  CEREBRO — genera la respuesta con IA (Gemini o Claude)
//  Construye las instrucciones del asistente a partir del perfil
//  del negocio y le pide al proveedor configurado una respuesta.
//
//  Proveedor por defecto: Gemini (gratis, sin tarjeta). Si más
//  adelante quieres mejor calidad y no te importa pagar, cambia
//  AI_PROVIDER=anthropic en el .env — no hay que tocar código.
// ═══════════════════════════════════════════════════════════════
const Anthropic = require("@anthropic-ai/sdk");
const {
  AI_PROVIDER, ANTHROPIC_API_KEY, MODEL,
  GEMINI_API_KEY, GEMINI_MODEL,
} = require("./config");
const memoria = require("./memory");

const anthropicClient = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

function hayCerebroConfigurado() {
  if (AI_PROVIDER === "anthropic") return !!anthropicClient;
  return !!GEMINI_API_KEY; // gemini por defecto
}

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

// Respuesta de respaldo cuando no hay ningún cerebro configurado (modo prueba).
function respuestaDeRespaldo(negocio, textoUsuario) {
  const faltante = AI_PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
  return (
    negocio.saludo +
    `\n\n(⚙️ Modo prueba: falta configurar ${faltante} para ` +
    "respuestas con IA. Recibí tu mensaje: \"" +
    textoUsuario +
    "\")"
  );
}

async function llamarAnthropic(system, historial) {
  const resp = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    messages: historial, // [{role:'user'|'assistant', content:'...'}]
  });
  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Modelo de respaldo por si el principal viene saturado (error 503).
const GEMINI_MODELO_RESPALDO = "gemini-flash-lite-latest";

// Errores temporales de Google: vale la pena reintentar.
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Una sola llamada a la API. "sinPensar" apaga el modo thinking, que
// para respuestas de WhatsApp solo agrega lentitud (y no todos los
// modelos lo aceptan, por eso se puede desactivar el parámetro).
async function pedirAGemini(modelo, system, contents, sinPensar) {
  const generationConfig = { maxOutputTokens: 500 };
  if (sinPensar) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent` +
      `?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig,
      }),
    }
  );

  if (resp.ok) {
    const data = await resp.json();
    const partes = data?.candidates?.[0]?.content?.parts || [];
    return { texto: partes.map((p) => p.text || "").join("\n").trim() };
  }

  return { status: resp.status, detalle: await resp.text() };
}

async function llamarGemini(system, historial) {
  // Gemini usa roles "user" y "model" (no "assistant").
  const contents = historial.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Primero el modelo configurado; si sigue saturado, el de respaldo.
  const modelos = [GEMINI_MODEL];
  if (GEMINI_MODELO_RESPALDO !== GEMINI_MODEL) modelos.push(GEMINI_MODELO_RESPALDO);

  let ultimoError = "sin respuesta";

  for (const modelo of modelos) {
    let sinPensar = true;

    for (let intento = 1; intento <= 2; intento++) {
      const r = await pedirAGemini(modelo, system, contents, sinPensar);
      if (r.texto !== undefined) return r.texto;

      ultimoError = `${modelo} ${r.status}: ${r.detalle.slice(0, 200)}`;

      // Algunos modelos no aceptan thinkingConfig: reintenta sin él.
      if (r.status === 400 && sinPensar) {
        sinPensar = false;
        continue;
      }
      if (!REINTENTABLES.has(r.status)) break; // error real, no insistas

      console.warn(`[brain] ${modelo} devolvió ${r.status}, reintentando…`);
      await esperar(500 * intento);
    }
  }

  throw new Error(`Gemini falló: ${ultimoError}`);
}

// Genera la respuesta para un mensaje entrante.
async function generarRespuesta(negocio, usuario, textoUsuario) {
  // Guardamos el mensaje del cliente en la memoria
  const eraNuevo = memoria.esNuevo(negocio.id, usuario);
  memoria.agregar(negocio.id, usuario, "user", textoUsuario);

  // Sin cerebro configurado -> modo prueba (para probar la plomería sin gastar)
  if (!hayCerebroConfigurado()) {
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
    const texto = AI_PROVIDER === "anthropic"
      ? await llamarAnthropic(system, historial)
      : await llamarGemini(system, historial);

    const respuesta = texto || negocio.saludo;
    memoria.agregar(negocio.id, usuario, "assistant", respuesta);
    return respuesta;
  } catch (err) {
    console.error(`[brain] Error llamando a ${AI_PROVIDER}:`, err.message);
    // No dejamos al cliente sin respuesta
    return (
      "¡Gracias por tu mensaje! 🙌 En un momento te atendemos. " +
      "(Tuvimos un detalle técnico procesando tu mensaje.)"
    );
  }
}

module.exports = { generarRespuesta, construirInstrucciones };
