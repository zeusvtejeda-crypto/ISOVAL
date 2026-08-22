// Prueba de punta a punta: levanta el asistente con un "Meta" falso y
// comprueba el comportamiento autónomo mensaje por mensaje.
// (sin proxy: las peticiones de la prueba van a localhost, y el proxy
//  del entorno de desarrollo se las tragaba antes de llegar al server)
for (const v of ["HTTPS_PROXY","https_proxy","HTTP_PROXY","http_proxy"]) delete process.env[v];
process.env.DEFAULT_BUSINESS = "camas";
process.env.WHATSAPP_TOKEN = "TOKEN-FALSO";
process.env.WHATSAPP_ADMIN = "5213111216033"; // "mi" celular
process.env.PAUSA_HORAS = "3";
process.env.GEMINI_API_KEY = ""; // modo prueba: sin llamadas de IA

const NUM_NEGOCIO = "111222333";
const CLIENTE = "5213339998877";
const ADMIN = "5213111216033";

// ── Meta falso ───────────────────────────────────────────────────
const enviados = [];
let contador = 0;
const fetchReal = global.fetch;
global.fetch = async (url, opciones = {}) => {
  const u = String(url);
  if (u.includes("graph.facebook.com") && u.endsWith("/messages")) {
    const cuerpo = JSON.parse(opciones.body);
    const id = `wamid.PROPIO${++contador}`;
    enviados.push({ para: cuerpo.to, texto: cuerpo.text?.body || `[${cuerpo.type}]`, id });
    return new Response(JSON.stringify({ messages: [{ id }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  return fetchReal(url, opciones);
};

const app = require("../src/app.js");
const servidor = app.listen(4123);

const entra = (valor) =>
  fetchReal("http://localhost:4123/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [{ changes: [{ value: {
      metadata: { phone_number_id: NUM_NEGOCIO }, ...valor } }] }] }),
  });

const texto = (de, cuerpo, id) => entra({ messages: [{ id, from: de, type: "text", text: { body: cuerpo } }] });
const audio = (de, id) => entra({ messages: [{ id, from: de, type: "audio", audio: { id: "a1" } }] });
const eco = (para, id) => entra({ message_echoes: [{ id, to: para, type: "text" }] });

// ── Comprobaciones ───────────────────────────────────────────────
let fallos = 0;
function revisar(titulo, condicion, detalle) {
  console.log(`${condicion ? "  ✅" : "  ❌"} ${titulo}`);
  if (!condicion) { fallos++; if (detalle) console.log(`       ${detalle}`); }
}
const desde = () => enviados.length;
const nuevos = (n) => enviados.slice(n);

async function main() {
  console.log("\n─── 1. Mensaje normal ───");
  let m = desde();
  await texto(CLIENTE, "Hola, cuanto cuesta una base queen?", "wamid.1");
  revisar("contesta al cliente", nuevos(m).length === 1 && nuevos(m)[0].para === CLIENTE,
    JSON.stringify(nuevos(m)));

  console.log("\n─── 2. Meta reintenta el MISMO mensaje ───");
  m = desde();
  await texto(CLIENTE, "Hola, cuanto cuesta una base queen?", "wamid.1");
  revisar("no contesta dos veces", nuevos(m).length === 0, JSON.stringify(nuevos(m)));

  console.log("\n─── 3. Nota de voz ───");
  m = desde();
  await audio(CLIENTE, "wamid.2");
  revisar("responde algo en vez de quedarse mudo", nuevos(m).length === 1);
  revisar("le dice que no puede oír audios", /audios/i.test(nuevos(m)[0]?.texto || ""));
  m = desde();
  await audio(CLIENTE, "wamid.3");
  revisar("no repite el aviso con el segundo audio", nuevos(m).length === 0);

  console.log("\n─── 4. El cliente pone una QUEJA (escalarA) ───");
  m = desde();
  await texto(CLIENTE, "Quiero poner una queja, me llegó rayada", "wamid.4");
  const salidas = nuevos(m);
  const alAdmin = salidas.find((e) => e.para === ADMIN);
  const alCliente = salidas.find((e) => e.para === CLIENTE);
  revisar("te avisa a TU celular", !!alAdmin, JSON.stringify(salidas));
  revisar("el aviso trae el número del cliente", (alAdmin?.texto || "").includes(CLIENTE));
  revisar("el aviso trae el motivo", /queja/i.test(alAdmin?.texto || ""));
  revisar("el cliente recibe respuesta de cierre", !!alCliente);

  console.log("\n─── 5. El cliente insiste (charla pausada) ───");
  m = desde();
  await texto(CLIENTE, "Sigo esperando", "wamid.5");
  revisar("el bot NO habla encima del humano", nuevos(m).length === 0, JSON.stringify(nuevos(m)));

  console.log("\n─── 6. Desde mi celular mando: sigue <cliente> ───");
  m = desde();
  await texto(ADMIN, `sigue ${CLIENTE}`, "wamid.6");
  revisar("me confirma la orden", nuevos(m).some((e) => e.para === ADMIN && /vuelvo a atender/i.test(e.texto)),
    JSON.stringify(nuevos(m)));

  console.log("\n─── 7. El cliente escribe otra vez ───");
  m = desde();
  await texto(CLIENTE, "Gracias, ya quedó", "wamid.7");
  revisar("el bot volvió a contestar", nuevos(m).length === 1 && nuevos(m)[0].para === CLIENTE);

  console.log("\n─── 8. Eco de mi PROPIA respuesta ───");
  const mio = enviados[enviados.length - 1].id;
  await eco(CLIENTE, mio);
  m = desde();
  await texto(CLIENTE, "Otra pregunta", "wamid.8");
  revisar("no se pausa por su propio eco", nuevos(m).length === 1, JSON.stringify(nuevos(m)));

  console.log("\n─── 9. Eco de un mensaje escrito por una PERSONA ───");
  await eco(CLIENTE, "wamid.HUMANO");
  m = desde();
  await texto(CLIENTE, "¿Entonces?", "wamid.9");
  revisar("se calla porque entró un humano", nuevos(m).length === 0, JSON.stringify(nuevos(m)));

  console.log("\n─── 10. Memoria del hilo ───");
  const memoria = require("../src/memory.js");
  const hilo = await memoria.obtener("camas", CLIENTE);
  revisar("guarda el hilo de la conversación", hilo.length >= 4, `mensajes: ${hilo.length}`);
  revisar("guarda también lo dicho durante la pausa",
    hilo.some((x) => x.content === "¿Entonces?"), JSON.stringify(hilo.map((x) => x.content)));

  console.log(`\n${fallos === 0 ? "TODO BIEN ✅" : `FALLARON ${fallos} ⚠️`}\n`);
  servidor.close();
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
