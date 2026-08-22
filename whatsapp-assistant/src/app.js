// ═══════════════════════════════════════════════════════════════
//  APP — la lógica del servidor, sin arrancar el puerto.
//  La comparten src/server.js (hosting tradicional: Render, tu compu)
//  y api/index.js (Vercel, serverless).
//
//  Flujo de un mensaje que entra:
//   1) Meta lo manda a POST /webhook
//   2) ¿Ya lo habíamos contestado? (Meta reintenta) -> se ignora
//   3) ¿Lo manda el dueño con una orden? -> se obedece
//   4) ¿La charla está pausada porque entró un humano? -> no se contesta
//   5) ¿Pide hablar con una persona? -> se avisa al dueño y se pausa
//   6) Si no, el cerebro (Gemini/Claude) redacta y se envía
// ═══════════════════════════════════════════════════════════════
require("./proxy");
const express = require("express");
const { VERIFY_TOKEN, PAUSA_HORAS } = require("./config");
const { elegirNegocio } = require("./router");
const { generarRespuesta } = require("./brain");
const { enviarTexto } = require("./whatsapp");
const { reporte, aTexto } = require("./salud");
const { apartar, leer, guardar } = require("./almacen");
const memoria = require("./memory");
const esc = require("./escalacion");

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

// ── Lo que le decimos al cliente cuando lo pasamos con un humano ──
function mensajeDeCierre(negocio) {
  return (
    negocio.mensajeEscalada ||
    "Claro que sí 🙌 En un momento te contesta por aquí una persona del " +
      "equipo. Si quieres, déjame tu nombre y qué necesitas, para que te " +
      "atienda más rápido."
  );
}

// Envía y deja apuntado el id. Ese apunte importa: si tu app está
// suscrita a los ecos, Meta nos devuelve copia de TODO lo que sale del
// número, incluidas nuestras propias respuestas. Sin reconocerlas, el
// asistente creería que entró un humano y se pausaría solo después de
// cada mensaje que manda.
async function responder(negocio, phoneNumberId, cliente, texto) {
  const envio = await enviarTexto(
    phoneNumberId, cliente, texto, negocio.whatsappToken
  );
  if (envio?.ok && envio.id) await guardar(`eco:${envio.id}`, 1, 600);
  return envio;
}

// ── Un mensaje entrante de un cliente ────────────────────────────
async function atenderMensaje(negocio, phoneNumberId, msg) {
  const cliente = msg.from;

  // 1) ¿Ya lo atendimos? Meta reintenta el webhook cuando tardamos o
  //    cuando algo le huele mal, y sin esta guarda el cliente recibe
  //    la misma respuesta dos y tres veces.
  if (msg.id && !(await apartar(`msg:${msg.id}`, 24 * 3600))) {
    console.log(`[${negocio.id}] Mensaje repetido ${msg.id}, ignorado.`);
    return;
  }

  // 2) Mensajes que no son texto. Antes se ignoraban en silencio, y una
  //    nota de voz sin respuesta se ve exactamente igual que un negocio
  //    que no contesta. Avisamos una vez por hora para no dar lata.
  if (msg.type !== "text") {
    console.log(`[${negocio.id}] Mensaje tipo "${msg.type}" de ${cliente}.`);
    if (await apartar(`avisotipo:${negocio.id}:${cliente}`, 3600)) {
      await responder(
        negocio, phoneNumberId, cliente,
        "¡Gracias! 🙌 Por aquí todavía no puedo abrir audios ni archivos. " +
          "¿Me lo escribes en un mensajito? Si prefieres, en un momento te " +
          "atiende una persona del equipo."
      );
    }
    return;
  }

  const texto = msg.text?.body?.trim();
  if (!texto) return;

  // 3) ¿Es el dueño mandando una orden? (pausa / sigue / estado)
  if (esc.esAdministrador(negocio, cliente)) {
    const atendido = await esc.atenderComandoAdmin(
      negocio, texto, phoneNumberId, cliente
    );
    if (atendido !== false) {
      console.log(`[${negocio.id}] Orden del dueño: ${texto.slice(0, 40)}`);
      return;
    }
    // No era una orden: seguimos como conversación normal (el dueño
    // también puede querer probar el asistente desde su celular).
  }

  // 4) ¿Está pausada la conversación porque entró una persona real?
  //    Guardamos igual lo que dice el cliente: cuando el bot regrese,
  //    regresa sabiendo lo que se habló mientras estuvo callado.
  if (await esc.estaPausado(negocio.id, cliente)) {
    await memoria.agregar(negocio.id, cliente, "user", texto);
    console.log(`[${negocio.id}] ${cliente}: (pausado, no contesto) ${texto.slice(0, 60)}`);
    return;
  }

  console.log(
    `[${negocio.id}] (num ${phoneNumberId}) ${cliente}: ${texto.slice(0, 80)}`
  );

  // 5) ¿Pide hablar con una persona, o es una queja / factura?
  const motivo = esc.motivoDeEscalada(negocio, texto);
  if (motivo) {
    await memoria.agregar(negocio.id, cliente, "user", texto);
    await esc.pausar(negocio.id, cliente, PAUSA_HORAS, "escalación");

    const aviso = await esc.avisarAlDueno(negocio, {
      phoneNumberId, cliente, motivo, mensaje: texto,
    });

    const cierre = mensajeDeCierre(negocio);
    await responder(negocio, phoneNumberId, cliente, cierre);
    await memoria.agregar(negocio.id, cliente, "assistant", cierre);

    console.log(
      `[${negocio.id}] ESCALADO (${motivo}) → aviso al dueño: ` +
        (aviso?.ok ? "enviado ✅" : `NO enviado ⚠️ (${aviso?.motivo})`)
    );
    return;
  }

  // 6) Camino normal: que conteste el cerebro.
  const respuesta = await generarRespuesta(negocio, cliente, texto);
  const envio = await responder(negocio, phoneNumberId, cliente, respuesta);

  // Dejamos constancia de si SALIÓ o NO. Antes solo se registraba la
  // respuesta redactada, que se escribe igual aunque el envío falle:
  // por eso los logs parecían normales con todo caído.
  if (envio?.ok) {
    console.log(`[${negocio.id}] ENVIADO → ${respuesta.slice(0, 80)}`);
  } else {
    console.error(
      `[${negocio.id}] NO ENVIADO (${envio?.motivo || "motivo desconocido"}) ` +
        `→ ${respuesta.slice(0, 80)}`
    );
  }
}

// ── Ecos: mensajes que SALIERON del número del negocio ───────────
// Si tú le contestas al cliente a mano (desde Meta Business Suite),
// Meta nos manda copia aquí. Esa es la señal de que entró un humano,
// así que el asistente se hace a un lado y deja de hablar encima.
// Requiere estar suscrito al campo "message_echoes" en el webhook; si
// no lo estás, esto simplemente nunca se ejecuta y te queda el comando
// "pausa <número>" para lograr lo mismo a mano.
async function atenderEco(negocio, eco) {
  if (eco?.id && (await leer(`eco:${eco.id}`))) return; // lo mandamos nosotros
  const cliente = eco?.to || eco?.recipient_id;
  if (!cliente) return;

  await esc.pausar(negocio.id, cliente, PAUSA_HORAS, "humano");
  console.log(
    `[${negocio.id}] Entró una persona con ${cliente}: me callo ${PAUSA_HORAS} h.`
  );
}

// ── Recepción de mensajes ───────────────────────────────────────
// IMPORTANTE: procesamos todo ANTES de responder. En hosting serverless
// (Vercel) el proceso puede congelarse justo después de mandar la
// respuesta, así que cualquier código async posterior a res.send()
// podría no llegar a ejecutarse nunca.
app.post("/webhook", async (req, res) => {
  try {
    for (const entrada of req.body?.entry || []) {
      for (const cambio of entrada.changes || []) {
        const valor = cambio.value || {};
        const phoneNumberId = valor.metadata?.phone_number_id;

        const negocio = elegirNegocio(phoneNumberId);
        if (!negocio) {
          if ((valor.messages || []).length) {
            console.warn(
              `[router] Sin negocio para phone_number_id=${phoneNumberId}. ` +
                `Asigna ese número en un perfil o define DEFAULT_BUSINESS.`
            );
          }
          continue;
        }

        for (const eco of valor.message_echoes || []) {
          await atenderEco(negocio, eco);
        }

        for (const msg of valor.messages || []) {
          await atenderMensaje(negocio, phoneNumberId, msg);
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
