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
const { elegirNegocio, elegirNegocioPorPagina } = require("./router");
const { generarRespuesta } = require("./brain");
const { enviarTexto } = require("./whatsapp");
const { enviarMensaje, extraerMensajes } = require("./messenger");
const store = require("./store");
const panel = require("./panel");

const app = express();
app.use(express.json());

// ── Salud: para comprobar que el servidor está vivo ─────────────
app.get("/", (_req, res) => res.send("Asistente de WhatsApp activo ✅"));

// El rewrite de Vercel manda TODO aquí, incluido el favicon que pide el
// navegador; sin esta ruta cada visita ensucia los logs con un 404.
app.get(/^\/favicon\.(ico|png)$/, (_req, res) => res.sendStatus(204));

// ── Panel de atención (ver conversaciones en vivo) ──────────────
app.use("/panel", panel);

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

// Anota en la bitácora del panel. Nunca revienta: si la bitácora
// falla, el cliente igual recibe su respuesta (es lo que importa).
async function anotar(businessId, usuario, quien, texto) {
  try {
    await store.registrar(businessId, usuario, quien, texto);
  } catch (err) {
    console.error("[panel] No se pudo anotar el mensaje:", err.message);
  }
}

// Atiende UN mensaje: piensa la respuesta, la manda y la anota.
// "canal" solo sirve para las bitácoras (whatsapp / instagram / facebook).
async function atender(negocio, usuario, texto, canal, responder) {
  console.log(`[${negocio.id}/${canal}] ${usuario}: ${texto.slice(0, 80)}`);
  await anotar(negocio.id, usuario, "cliente", texto);

  const respuesta = await generarRespuesta(negocio, usuario, texto);
  await responder(respuesta);

  console.log(`[${negocio.id}/${canal}] → ${respuesta.slice(0, 80)}`);
  await anotar(negocio.id, usuario, "bot", respuesta);
}

// ── Recepción de mensajes ───────────────────────────────────────
// Un solo webhook atiende los tres canales. Meta los distingue con el
// campo "object": "whatsapp_business_account", "instagram" o "page".
//
// IMPORTANTE: procesamos todo ANTES de responder. En hosting serverless
// (Vercel) el proceso puede congelarse justo después de mandar la
// respuesta, así que cualquier código async posterior a res.send()
// podría no llegar a ejecutarse nunca.
app.post("/webhook", async (req, res) => {
  try {
    const tipo = req.body?.object;
    const entradas = req.body?.entry || [];

    for (const entrada of entradas) {
      if (tipo === "instagram" || tipo === "page") {
        await atenderRedesSociales(entrada, tipo);
      } else {
        await atenderWhatsApp(entrada);
      }
    }
  } catch (err) {
    console.error("[webhook] Error procesando mensaje:", err);
  }

  // Respondemos AL FINAL, ya que todo el trabajo real terminó.
  res.sendStatus(200);
});

// ── WhatsApp ────────────────────────────────────────────────────
async function atenderWhatsApp(entrada) {
  for (const cambio of entrada.changes || []) {
    const valor = cambio.value || {};
    const phoneNumberId = valor.metadata?.phone_number_id;

    for (const msg of valor.messages || []) {
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

      await atender(negocio, usuario, texto, "whatsapp", (respuesta) =>
        enviarTexto(phoneNumberId, usuario, respuesta, negocio.whatsappToken)
      );
    }
  }
}

// ── Instagram y Facebook ────────────────────────────────────────
async function atenderRedesSociales(entrada, tipo) {
  const canal = tipo === "instagram" ? "instagram" : "facebook";
  const paginaId = entrada.id;

  const negocio = elegirNegocioPorPagina(paginaId);
  if (!negocio) {
    console.warn(
      `[router] Sin negocio para la página/cuenta ${paginaId}. ` +
        `Agrega "paginaId" o "instagramId" en el perfil del negocio.`
    );
    return;
  }

  for (const { de, texto } of extraerMensajes(entrada)) {
    await atender(negocio, de, texto, canal, (respuesta) =>
      enviarMensaje(de, respuesta, negocio.metaPageToken)
    );
  }
}

module.exports = app;
