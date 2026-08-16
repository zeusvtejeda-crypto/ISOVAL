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
const { reporte, aTexto, sondeo } = require("./salud");
const { porId } = require("../businesses");

const app = express();
app.use(express.json());

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

// Sondeo crudo, para diagnosticar cuando /salud no alcanza a explicar
// la causa. Temporal: quitar cuando el asistente esté funcionando.
app.get("/salud/sondeo", async (req, res) => {
  const negocio = porId[req.query.negocio || "camas"];
  if (!negocio) return res.status(404).json({ error: "negocio desconocido" });
  res.json(await sondeo(negocio));
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

          // Registramos el phone_number_id que manda Meta: es el que de
          // verdad se usa para contestar, y sirve para saber si el que
          // está en la variable de entorno (solo para enrutar) coincide.
          console.log(
            `[${negocio.id}] (num ${phoneNumberId}) ${usuario}: ${texto.slice(0, 80)}`
          );

          const respuesta = await generarRespuesta(negocio, usuario, texto);
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
      }
    }
  } catch (err) {
    console.error("[webhook] Error procesando mensaje:", err);
  }

  // Respondemos AL FINAL, ya que todo el trabajo real terminó.
  res.sendStatus(200);
});

module.exports = app;
