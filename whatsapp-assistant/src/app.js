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

const app = express();
app.use(express.json());

// ── Salud: para comprobar que el servidor está vivo ─────────────
app.get("/", (_req, res) => res.send("Asistente de WhatsApp activo ✅"));

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
        const mensajes = valor.messages || [];

        for (const msg of mensajes) {
          // Solo atendemos mensajes de texto por ahora
          if (msg.type !== "text") {
            console.log(`[webhook] Mensaje tipo "${msg.type}" ignorado.`);
            continue;
          }

          const usuario = msg.from; // número del cliente
          const texto = msg.text?.body?.trim();
          if (!texto) continue;

          const negocio = elegirNegocio(phoneNumberId);
          if (!negocio) {
            console.warn(
              `[router] Sin negocio para phone_number_id=${phoneNumberId}. ` +
                `Asigna ese número en un perfil o define DEFAULT_BUSINESS.`
            );
            continue;
          }

          console.log(`[${negocio.id}] ${usuario}: ${texto.slice(0, 80)}`);

          const respuesta = await generarRespuesta(negocio, usuario, texto);
          await enviarTexto(phoneNumberId, usuario, respuesta, negocio.whatsappToken);

          console.log(`[${negocio.id}] → ${respuesta.slice(0, 80)}`);
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
