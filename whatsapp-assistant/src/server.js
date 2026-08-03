// ═══════════════════════════════════════════════════════════════
//  SERVIDOR — recibe los WhatsApp de Meta y contesta con el asistente
//
//  Flujo:
//   1) Meta manda cada mensaje entrante a POST /webhook
//   2) Identificamos a qué NEGOCIO pertenece el número que lo recibió
//   3) El "cerebro" (Claude) redacta la respuesta
//   4) La enviamos de vuelta por WhatsApp
// ═══════════════════════════════════════════════════════════════
require("./proxy");
const express = require("express");
const { PORT, VERIFY_TOKEN } = require("./config");
const { elegirNegocio } = require("./router");
const { generarRespuesta } = require("./brain");
const { enviarTexto } = require("./whatsapp");

const app = express();
app.use(express.json());

// ── Salud: para comprobar que el servidor está vivo ─────────────
app.get("/", (_req, res) => res.send("Asistente de WhatsApp activo ✅"));

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
app.post("/webhook", async (req, res) => {
  // Respondemos 200 de inmediato para que Meta no reintente.
  res.sendStatus(200);

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

          console.log(
            `[${negocio.id}] ${usuario}: ${texto.slice(0, 80)}`
          );

          const respuesta = await generarRespuesta(negocio, usuario, texto);
          await enviarTexto(phoneNumberId, usuario, respuesta);

          console.log(`[${negocio.id}] → ${respuesta.slice(0, 80)}`);
        }
      }
    }
  } catch (err) {
    console.error("[webhook] Error procesando mensaje:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Asistente de WhatsApp escuchando en el puerto ${PORT}`);
});
