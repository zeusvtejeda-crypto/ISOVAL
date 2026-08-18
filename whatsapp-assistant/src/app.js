// ═══════════════════════════════════════════════════════════════
//  APP — la lógica del servidor, sin arrancar el puerto.
//  La comparten src/server.js (hosting tradicional: Render, tu compu)
//  y api/index.js (Vercel, serverless).
//
//  Flujo:
//   1) Meta manda cada mensaje entrante a POST /webhook
//   2) Identificamos a qué NEGOCIO pertenece el número que lo recibió
//   3) El "cerebro" (Gemini/Claude) redacta la respuesta
//   4) La enviamos de vuelta por WhatsApp
// ═══════════════════════════════════════════════════════════════
require("./proxy");
const express = require("express");
const { VERIFY_TOKEN } = require("./config");
const { elegirNegocio } = require("./router");
const { generarRespuesta } = require("./brain");
const { enviarTexto } = require("./whatsapp");
const { reporte, aTexto } = require("./salud");
const { textoDelMensaje, respuestaSinTexto } = require("./adjuntos");
const memoria = require("./memory");

const app = express();
app.use(express.json());

// ── Mensajes ya atendidos ───────────────────────────────────────
// Meta espera un 200 rápido; si tardamos (redactar con IA puede llevarse
// varios segundos), da por fallida la entrega y MANDA EL MISMO MENSAJE
// OTRA VEZ. Sin este control el cliente recibe la respuesta duplicada,
// que es de las cosas que más delatan que atiende un robot.
//
// El id de mensaje (wamid...) es el mismo en el reintento, así que basta
// con recordarlos un rato. Ojo: en Vercel cada instancia tiene su propia
// memoria, así que esto atrapa los reintentos que caen en la misma
// instancia, que son la mayoría, pero no puede prometer que los atrape
// todos. Para eso haría falta una base de datos compartida.
const ATENDIDOS_TTL_MS = 10 * 60 * 1000; // 10 minutos
const atendidos = new Map(); // id de mensaje -> cuándo lo atendimos

function yaAtendido(idMensaje) {
  if (!idMensaje) return false; // sin id no podemos saber; mejor contestar

  const ahora = Date.now();
  for (const [id, cuando] of atendidos) {
    if (ahora - cuando > ATENDIDOS_TTL_MS) atendidos.delete(id);
  }

  if (atendidos.has(idMensaje)) return true;
  atendidos.set(idMensaje, ahora);
  return false;
}

// ── Salud: para comprobar que el servidor está vivo ─────────────
app.get("/", (_req, res) => res.send("Asistente de WhatsApp activo ✅"));

// ── Salud REAL: ¿puede de verdad contestar? ─────────────────────
// Ojo: la ruta "/" de arriba solo dice que el servidor encendió, y por
// eso el token vencido pasó desapercibido más de un día. Esta ruta sí
// le pregunta a Meta si el token sirve. Responde 503 si algo está roto
// para que un monitor externo pueda avisarte solo.
app.get("/salud", async (req, res) => {
  const r = await reporte();
  res.status(r.sano ? 200 : 503);
  if ("json" in req.query) return res.json(r);
  res.type("text/plain; charset=utf-8").send(aTexto(r));
});

// El rewrite de Vercel manda TODO aquí, incluido el favicon que pide el
// navegador; sin esta ruta cada visita ensucia los logs con un 404.
app.get(/^\/favicon\.(ico|png)$/, (_req, res) => res.sendStatus(204));

// ── Verificación del webhook (Meta la llama UNA vez al conectar) ─
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] Verificado correctamente ✅");
    return res.status(200).send(challenge);
  }
  console.warn("[webhook] Verificación fallida (token no coincide).");
  return res.sendStatus(403);
});

// Atiende UN mensaje entrante: decide qué contestar y lo manda.
async function atenderMensaje(msg, phoneNumberId) {
  const usuario = msg.from; // número del cliente

  const negocio = elegirNegocio(phoneNumberId);
  if (!negocio) {
    console.warn(
      `[router] Sin negocio para phone_number_id=${phoneNumberId}. ` +
        `Asigna ese número en un perfil o define DEFAULT_BUSINESS.`
    );
    return;
  }

  // El texto puede venir del mensaje normal, del pie de una foto o de
  // un botón que el cliente tocó (ver adjuntos.js).
  const texto = textoDelMensaje(msg);
  let respuesta;

  if (texto) {
    console.log(
      `[${negocio.id}] (num ${phoneNumberId}) ${usuario}: ${texto.slice(0, 80)}`
    );
    respuesta = await generarRespuesta(negocio, usuario, texto);
  } else {
    // Audios, fotos sin pie, ubicaciones… Antes se descartaban en
    // silencio y el cliente se quedaba sin ninguna respuesta.
    respuesta = respuestaSinTexto(negocio, msg, memoria.esNuevo(negocio.id, usuario));
    if (!respuesta) {
      console.log(`[${negocio.id}] Mensaje tipo "${msg.type}" ignorado a propósito.`);
      return;
    }
    console.log(`[${negocio.id}] (num ${phoneNumberId}) ${usuario}: [${msg.type}]`);

    // Lo dejamos anotado en la memoria para que, si el cliente sigue
    // escribiendo, el asistente sepa que ya le contestó esto.
    memoria.agregar(negocio.id, usuario, "user", `(mandó un mensaje de tipo ${msg.type})`);
    memoria.agregar(negocio.id, usuario, "assistant", respuesta);
  }

  const envio = await enviarTexto(
    phoneNumberId, usuario, respuesta, negocio.whatsappToken
  );

  // Dejamos constancia de si SALIÓ o NO. Antes solo se registraba
  // la respuesta redactada, que se escribe igual aunque el envío
  // falle: por eso los logs parecían normales con todo caído.
  if (envio?.ok) {
    console.log(`[${negocio.id}] ENVIADO → ${respuesta.slice(0, 80)}`);
  } else {
    console.error(
      `[${negocio.id}] NO ENVIADO (${envio?.motivo || "motivo desconocido"}) ` +
        `→ ${respuesta.slice(0, 80)}`
    );
  }
}

// ── Recepción de mensajes ───────────────────────────────────────
// IMPORTANTE: procesamos todo ANTES de responder. En hosting serverless
// (Vercel) el proceso puede congelarse justo después de mandar la
// respuesta, así que cualquier código async posterior a res.send()
// podría no llegar a ejecutarse nunca.
app.post("/webhook", async (req, res) => {
  try {
    const entradas = req.body?.entry || [];
    for (const entrada of entradas) {
      for (const cambio of entrada.changes || []) {
        const valor = cambio.value || {};
        const phoneNumberId = valor.metadata?.phone_number_id;

        for (const msg of valor.messages || []) {
          if (yaAtendido(msg.id)) {
            console.log(`[webhook] Mensaje repetido ${msg.id}, ya se contestó.`);
            continue;
          }
          await atenderMensaje(msg, phoneNumberId);
        }
      }
    }
  } catch (err) {
    console.error("[webhook] Error procesando mensaje:", err);
  }

  // Respondemos AL FINAL, ya que todo el trabajo real terminó.
  res.sendStatus(200);
});

module.exports = app;
